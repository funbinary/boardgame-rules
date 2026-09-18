// rules-api：桌游规则书站点的用户与收藏服务。
//
// 环境变量：
//
//	ADDR          监听地址（默认 127.0.0.1:8787，生产由 nginx 反代）
//	DB_PATH       SQLite 文件路径（默认 ./rules.db）
//	SESSION_TTL   会话有效期（Go duration，默认 720h = 30 天）
//	COOKIE_SECURE 会话 Cookie 是否带 Secure（生产 1，本地 http 调试 0）
//	SERVE_STATIC  非空时同时托管该目录的静态文件（仅本地开发用）
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/funbinary/boardgame-rules/server/internal/api"
	"github.com/funbinary/boardgame-rules/server/internal/static"
	"github.com/funbinary/boardgame-rules/server/internal/store"
)

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	log.SetFlags(log.LstdFlags | log.LUTC)

	addr := env("ADDR", "127.0.0.1:8787")
	dbPath := env("DB_PATH", "rules.db")
	ttl, err := time.ParseDuration(env("SESSION_TTL", "720h"))
	if err != nil {
		log.Fatalf("SESSION_TTL 不合法: %v", err)
	}
	cookieSecure, _ := strconv.ParseBool(env("COOKIE_SECURE", "1"))
	staticDir := os.Getenv("SERVE_STATIC")

	st, err := store.Open(dbPath)
	if err != nil {
		log.Fatalf("打开数据库失败: %v", err)
	}
	defer st.Close()

	srv := api.New(api.Config{Store: st, SessionTTL: ttl, CookieSecure: cookieSecure})
	srv.PruneEvery(time.Hour)

	var handler http.Handler = srv.Handler()
	if staticDir != "" {
		log.Printf("本地开发模式：同时托管静态目录 %s", staticDir)
		root := http.NewServeMux()
		root.Handle("/api/", srv.Handler())
		root.Handle("/", static.Handler(staticDir))
		handler = root
	}

	httpSrv := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Printf("rules-api 监听 %s（DB: %s，会话有效期 %s）", addr, dbPath, ttl)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP 服务退出: %v", err)
		}
	}()

	<-ctx.Done()
	log.Printf("收到退出信号，优雅关闭…")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(shutdownCtx); err != nil {
		log.Printf("关闭超时: %v", err)
	}
}
