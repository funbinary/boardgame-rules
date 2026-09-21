// Package api 提供用户与收藏的 JSON HTTP 接口。
package api

import (
	"context"
	"log"
	"net/http"
	"regexp"
	"time"

	"github.com/funbinary/boardgame-rules/server/internal/auth"
	"github.com/funbinary/boardgame-rules/server/internal/play"
	"github.com/funbinary/boardgame-rules/server/internal/store"
)

// gameKey：精选页 slug（seti）或 BGA 页（bga/catan）。
var gameKeyRe = regexp.MustCompile(`^(?:bga/)?[a-z0-9][a-z0-9-]{0,62}$`)

// username：中文/字母/数字/下划线/连字符，2-24 字符。
var usernameRe = regexp.MustCompile(`^[\p{Han}a-zA-Z0-9_-]{2,24}$`)

const (
	maxBodyBytes = 4 << 10
	// 限流阈值：公网开放注册下的防滥用基线
	registerLimit = 5   // 次/时/IP
	loginLimit    = 15  // 次/5分/IP
	collectLimit  = 120 // 次/分/IP（正常点按远低于此）
)

type Server struct {
	store        *store.Store
	ttl          time.Duration
	cookieSecure bool
	limiter      *Limiter
	play         *play.Handler
}

type Config struct {
	Store        *store.Store
	SessionTTL   time.Duration
	CookieSecure bool
}

func New(cfg Config) *Server {
	s := &Server{
		store:        cfg.Store,
		ttl:          cfg.SessionTTL,
		cookieSecure: cfg.CookieSecure,
		limiter:      NewLimiter(),
	}
	s.play = play.NewHandler(cfg.Store, s.currentUser)
	return s
}

// Handler 组装路由与中间件。
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.handleHealth)
	mux.HandleFunc("POST /api/register", s.handleRegister)
	mux.HandleFunc("POST /api/login", s.handleLogin)
	mux.HandleFunc("POST /api/logout", s.handleLogout)
	mux.HandleFunc("GET /api/me", s.handleMe)
	mux.HandleFunc("GET /api/collection", s.handleListCollection)
	mux.HandleFunc("GET /api/collection/{key...}", s.handleGetItem)
	mux.HandleFunc("PUT /api/collection/{key...}", s.handlePutItem)
	mux.HandleFunc("GET /api/share", s.handleShareStatus)
	mux.HandleFunc("POST /api/share", s.handleShareCreate)
	mux.HandleFunc("DELETE /api/share", s.handleShareDelete)
	mux.HandleFunc("GET /api/shared/{token}", s.handleSharedCollection)
	s.play.Routes(mux)
	return withLog(securityHeaders(mux))
}

// PruneEvery 周期清理过期会话与限流窗口。
func (s *Server) PruneEvery(interval time.Duration) {
	go func() {
		t := time.NewTicker(interval)
		defer t.Stop()
		for range t.C {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			if err := s.store.PurgeExpiredSessions(ctx); err != nil {
				log.Printf("清理过期会话失败: %v", err)
			}
			cancel()
			s.limiter.Prune()
		}
	}()
}

// currentUser 由 Cookie 还原登录用户；未登录返回 nil。
func (s *Server) currentUser(r *http.Request) *store.User {
	c, err := r.Cookie(auth.CookieName)
	if err != nil || c.Value == "" {
		return nil
	}
	u, _, err := s.store.UserBySession(r.Context(), auth.HashToken(c.Value))
	if err != nil {
		return nil
	}
	return u
}

func (s *Server) setSessionCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     auth.CookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   int(s.ttl.Seconds()),
		HttpOnly: true,
		Secure:   s.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

func (s *Server) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     auth.CookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   s.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

func (s *Server) createSession(w http.ResponseWriter, r *http.Request, userID int64) error {
	token, tokenHash, err := auth.NewToken()
	if err != nil {
		return err
	}
	if err := s.store.CreateSession(r.Context(), tokenHash, userID, time.Now().Add(s.ttl)); err != nil {
		return err
	}
	s.setSessionCookie(w, token)
	return nil
}
