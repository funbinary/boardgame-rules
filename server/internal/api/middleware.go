package api

import (
	"bufio"
	"errors"
	"log"
	"net"
	"net/http"
	"time"
)

// statusRecorder 记录响应状态码供访问日志使用。
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// Hijack 透传:WebSocket(/api/play/ws)升级需要劫持底层连接,
// 包装层必须实现 http.Hijacker,否则升级以 501 失败。
func (r *statusRecorder) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	h, ok := r.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, errors.New("response writer 不支持 hijack")
	}
	return h.Hijack()
}

// Flush 透传(SSE/流式响应需要)。
func (r *statusRecorder) Flush() {
	if f, ok := r.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func withLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		if r.URL.Path != "/api/health" { // 健康检查刷屏，跳过
			log.Printf("%s %s %d %s %s", clientIP(r), r.Method, rec.status, r.URL.Path, time.Since(start).Round(time.Millisecond))
		}
	})
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}
