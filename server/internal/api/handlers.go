package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/funbinary/boardgame-rules/server/internal/auth"
	"github.com/funbinary/boardgame-rules/server/internal/store"
)

// ---- JSON 工具 ----

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func apiError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func readJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(v); err != nil {
		apiError(w, http.StatusBadRequest, "请求体不是合法 JSON")
		return false
	}
	return true
}

// ---- 健康检查 ----

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "service": "rules-api"})
}

// ---- 注册 / 登录 / 登出 ----

type credentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var in credentials
	if !readJSON(w, r, &in) {
		return
	}
	in.Username = strings.TrimSpace(in.Username)
	if !usernameRe.MatchString(in.Username) {
		apiError(w, http.StatusBadRequest, "用户名需为 2-24 个中文、字母、数字、_ 或 -")
		return
	}
	if n := len(in.Password); n < 6 || n > 72 {
		apiError(w, http.StatusBadRequest, "密码长度需为 6-72 个字符")
		return
	}
	// 限流放在校验之后：改错几次表单不该消耗注册配额
	if !s.limiter.Allow("register:"+clientIP(r), registerLimit, time.Hour) {
		apiError(w, http.StatusTooManyRequests, "注册过于频繁，请稍后再试")
		return
	}
	pwHash, err := auth.HashPassword(in.Password)
	if err != nil {
		apiError(w, http.StatusInternalServerError, "服务器内部错误")
		return
	}
	u, err := s.store.CreateUser(r.Context(), in.Username, pwHash)
	if errors.Is(err, store.ErrUsernameTaken) {
		apiError(w, http.StatusConflict, "用户名已被注册")
		return
	}
	if err != nil {
		apiError(w, http.StatusInternalServerError, "服务器内部错误")
		return
	}
	if err := s.createSession(w, r, u.ID); err != nil {
		apiError(w, http.StatusInternalServerError, "服务器内部错误")
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	ip := clientIP(r)
	if !s.limiter.Allow("login:"+ip, loginLimit, 5*time.Minute) {
		apiError(w, http.StatusTooManyRequests, "尝试过于频繁，请稍后再试")
		return
	}
	var in credentials
	if !readJSON(w, r, &in) {
		return
	}
	u, pwHash, err := s.store.GetUserByUsername(r.Context(), strings.TrimSpace(in.Username))
	if errors.Is(err, store.ErrNotFound) {
		apiError(w, http.StatusUnauthorized, "用户名或密码错误")
		return
	}
	if err != nil {
		apiError(w, http.StatusInternalServerError, "服务器内部错误")
		return
	}
	if !auth.CheckPassword(pwHash, in.Password) {
		apiError(w, http.StatusUnauthorized, "用户名或密码错误")
		return
	}
	if err := s.createSession(w, r, u.ID); err != nil {
		apiError(w, http.StatusInternalServerError, "服务器内部错误")
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(auth.CookieName); err == nil && c.Value != "" {
		_ = s.store.DeleteSession(r.Context(), auth.HashToken(c.Value))
	}
	s.clearSessionCookie(w)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	u := s.currentUser(r)
	if u == nil {
		apiError(w, http.StatusUnauthorized, "未登录")
		return
	}
	writeJSON(w, http.StatusOK, u)
}

// ---- 收藏 ----

type collectionResponse struct {
	Counts   map[string]int          `json:"counts"`
	Owned    []store.CollectionItem `json:"owned"`
	Wishlist []store.CollectionItem `json:"wishlist"`
	Play     []store.CollectionItem `json:"play"`
}

func (s *Server) handleListCollection(w http.ResponseWriter, r *http.Request) {
	u := s.currentUser(r)
	if u == nil {
		apiError(w, http.StatusUnauthorized, "未登录")
		return
	}
	items, err := s.store.ListCollection(r.Context(), u.ID)
	if err != nil {
		apiError(w, http.StatusInternalServerError, "服务器内部错误")
		return
	}
	resp := collectionResponse{
		Counts:   map[string]int{},
		Owned:    []store.CollectionItem{},
		Wishlist: []store.CollectionItem{},
		Play:     []store.CollectionItem{},
	}
	for _, it := range items {
		switch it.Status {
		case store.StatusOwned:
			resp.Owned = append(resp.Owned, it)
		case store.StatusWishlist:
			resp.Wishlist = append(resp.Wishlist, it)
		case store.StatusPlay:
			resp.Play = append(resp.Play, it)
		}
	}
	resp.Counts["owned"] = len(resp.Owned)
	resp.Counts["wishlist"] = len(resp.Wishlist)
	resp.Counts["play"] = len(resp.Play)
	writeJSON(w, http.StatusOK, resp)
}

// normalizeKey 校验并返回 game_key；非法返回 ""。
func normalizeKey(raw string) string {
	raw = strings.Trim(raw, "/")
	if !gameKeyRe.MatchString(raw) {
		return ""
	}
	return raw
}

func (s *Server) handleGetItem(w http.ResponseWriter, r *http.Request) {
	u := s.currentUser(r)
	if u == nil {
		apiError(w, http.StatusUnauthorized, "未登录")
		return
	}
	key := normalizeKey(r.PathValue("key"))
	if key == "" {
		apiError(w, http.StatusNotFound, "游戏标识不合法")
		return
	}
	status, err := s.store.CollectionStatus(r.Context(), u.ID, key)
	if err != nil {
		apiError(w, http.StatusInternalServerError, "服务器内部错误")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"game_key": key, "status": status})
}

type putItemInput struct {
	Status string `json:"status"`
	Name   string `json:"name"`
	En     string `json:"en"`
}

func (s *Server) handlePutItem(w http.ResponseWriter, r *http.Request) {
	u := s.currentUser(r)
	if u == nil {
		apiError(w, http.StatusUnauthorized, "未登录")
		return
	}
	if !s.limiter.Allow("collect:"+clientIP(r), collectLimit, time.Minute) {
		apiError(w, http.StatusTooManyRequests, "操作过于频繁，请稍后再试")
		return
	}
	key := normalizeKey(r.PathValue("key"))
	if key == "" {
		apiError(w, http.StatusBadRequest, "游戏标识不合法")
		return
	}
	var in putItemInput
	if !readJSON(w, r, &in) {
		return
	}
	// status 为空串/none 表示移除收藏
	if in.Status == "" || in.Status == "none" {
		if err := s.store.DeleteCollection(r.Context(), u.ID, key); err != nil {
			apiError(w, http.StatusInternalServerError, "服务器内部错误")
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"game_key": key, "status": ""})
		return
	}
	if !store.ValidStatuses[in.Status] {
		apiError(w, http.StatusBadRequest, "status 需为 owned / wishlist / play")
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" || utf8.RuneCountInString(in.Name) > 60 {
		apiError(w, http.StatusBadRequest, "name 必填且不超过 60 字")
		return
	}
	in.En = strings.TrimSpace(in.En)
	if utf8.RuneCountInString(in.En) > 80 {
		in.En = string([]rune(in.En)[:80])
	}
	item := store.CollectionItem{GameKey: key, Status: in.Status, Name: in.Name, En: in.En}
	if err := s.store.UpsertCollection(r.Context(), u.ID, item); err != nil {
		apiError(w, http.StatusInternalServerError, "服务器内部错误")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"game_key": key, "status": in.Status})
}
