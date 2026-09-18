package api

import (
	"net"
	"net/http"
	"strings"
)

// clientIP 取请求来源 IP。服务只经 nginx 反代或本机访问到达，
// 信任 X-Forwarded-For / X-Real-IP 首值即可。
func clientIP(r *http.Request) string {
	if xf := r.Header.Get("X-Forwarded-For"); xf != "" {
		if i := strings.IndexByte(xf, ','); i >= 0 {
			xf = xf[:i]
		}
		return strings.TrimSpace(xf)
	}
	if xr := r.Header.Get("X-Real-IP"); xr != "" {
		return strings.TrimSpace(xr)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
