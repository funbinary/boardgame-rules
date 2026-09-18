package api

import (
	"sync"
	"time"
)

// Limiter 是进程内固定窗口限流器，key 由调用方拼装（如 "login:"+ip）。
// 单实例部署足够；重启即清零，可接受。
type Limiter struct {
	mu sync.Mutex
	m  map[string]*limiterEntry
}

type limiterEntry struct {
	count   int
	resetAt time.Time
}

func NewLimiter() *Limiter {
	return &Limiter{m: make(map[string]*limiterEntry)}
}

// Allow 记录一次命中并返回是否放行。
func (l *Limiter) Allow(key string, limit int, window time.Duration) bool {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()
	e, ok := l.m[key]
	if !ok || now.After(e.resetAt) {
		if len(l.m) > 10000 {
			l.pruneLocked(now)
		}
		l.m[key] = &limiterEntry{count: 1, resetAt: now.Add(window)}
		return true
	}
	e.count++
	return e.count <= limit
}

// Prune 清除全部已过期窗口，供后台定时调用。
func (l *Limiter) Prune() {
	l.mu.Lock()
	l.pruneLocked(time.Now())
	l.mu.Unlock()
}

func (l *Limiter) pruneLocked(now time.Time) {
	for k, e := range l.m {
		if now.After(e.resetAt) {
			delete(l.m, k)
		}
	}
}
