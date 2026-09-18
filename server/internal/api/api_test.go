package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/funbinary/boardgame-rules/server/internal/store"
)

func newTestServer(t *testing.T) (*Server, *httptest.Server) {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { st.Close() })
	s := New(Config{Store: st, SessionTTL: time.Hour, CookieSecure: false})
	ts := httptest.NewServer(s.Handler())
	t.Cleanup(ts.Close)
	return s, ts
}

// client 建一个带 Cookie Jar 的客户端（每个测试独立会话）。
func client(t *testing.T, ts *httptest.Server) *http.Client {
	t.Helper()
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}
	return &http.Client{Jar: jar}
}

func doJSON(t *testing.T, c *http.Client, ts *httptest.Server, method, path string, body any) (int, map[string]any) {
	t.Helper()
	var rd *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	} else {
		rd = bytes.NewReader(nil)
	}
	req, err := http.NewRequest(method, ts.URL+path, rd)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var out map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&out)
	return resp.StatusCode, out
}

func register(t *testing.T, c *http.Client, ts *httptest.Server, username string) int {
	t.Helper()
	code, _ := doJSON(t, c, ts, "POST", "/api/register",
		map[string]string{"username": username, "password": "pw123456"})
	return code
}

func TestAuthFlow(t *testing.T) {
	_, ts := newTestServer(t)
	c := client(t, ts)

	if code := register(t, c, ts, "小明"); code != http.StatusOK {
		t.Fatalf("register 中文用户名: got %d", code)
	}

	code, out := doJSON(t, c, ts, "GET", "/api/me", nil)
	if code != http.StatusOK || out["username"] != "小明" {
		t.Fatalf("me after register: %d %v", code, out)
	}

	code, _ = doJSON(t, c, ts, "POST", "/api/logout", nil)
	if code != http.StatusOK {
		t.Fatalf("logout: %d", code)
	}
	if code, _ := doJSON(t, c, ts, "GET", "/api/me", nil); code != http.StatusUnauthorized {
		t.Fatalf("me after logout should 401: %d", code)
	}

	code, _ = doJSON(t, c, ts, "POST", "/api/login",
		map[string]string{"username": "小明", "password": "wrong-pw"})
	if code != http.StatusUnauthorized {
		t.Fatalf("login wrong password should 401: %d", code)
	}
	code, _ = doJSON(t, c, ts, "POST", "/api/login",
		map[string]string{"username": "小明", "password": "pw123456"})
	if code != http.StatusOK {
		t.Fatalf("login: %d", code)
	}
	if code, _ := doJSON(t, c, ts, "GET", "/api/me", nil); code != http.StatusOK {
		t.Fatalf("me after login: %d", code)
	}
}

func TestRegisterValidation(t *testing.T) {
	_, ts := newTestServer(t)
	c := client(t, ts)

	cases := []struct {
		username, password string
		want               int
		note               string
	}{
		{"ab", "short", http.StatusBadRequest, "密码过短"},
		{"", "pw123456", http.StatusBadRequest, "用户名为空"},
		{"a", "pw123456", http.StatusBadRequest, "用户名过短"},
		{"has space", "pw123456", http.StatusBadRequest, "用户名含空格"},
		{"alice", "pw123456", http.StatusOK, "正常注册"},
		{"ALICE", "pw123456", http.StatusConflict, "用户名忽略大小写查重"},
	}
	for _, tc := range cases {
		code, _ := doJSON(t, c, ts, "POST", "/api/register",
			map[string]string{"username": tc.username, "password": tc.password})
		if code != tc.want {
			t.Fatalf("%s (%s): got %d want %d", tc.note, tc.username, code, tc.want)
		}
	}
}

func TestPasswordStrength(t *testing.T) {
	_, ts := newTestServer(t)
	c := client(t, ts)

	cases := []struct {
		pw   string
		want int
		note string
	}{
		{"12345678", http.StatusBadRequest, "纯数字缺字母"},
		{"abcdefgh", http.StatusBadRequest, "纯字母缺数字"},
		{"ab12", http.StatusBadRequest, "过短"},
		{"password1", http.StatusBadRequest, "常见弱密码"},
		{"a1234567", http.StatusBadRequest, "常见弱密码2"},
		{"goodpass123", http.StatusOK, "合规"},
	}
	for i, tc := range cases {
		code, _ := doJSON(t, c, ts, "POST", "/api/register",
			map[string]string{"username": fmt.Sprintf("pwuser%d", i), "password": tc.pw})
		if code != tc.want {
			t.Fatalf("%s (%s): got %d want %d", tc.note, tc.pw, code, tc.want)
		}
	}
}

func TestShareFlow(t *testing.T) {
	_, ts := newTestServer(t)
	c := client(t, ts)
	anon := client(t, ts)
	register(t, c, ts, "sharer")

	// 未登录操作分享 → 401
	if code, _ := doJSON(t, anon, ts, "POST", "/api/share", nil); code != http.StatusUnauthorized {
		t.Fatalf("anon share create should 401: %d", code)
	}

	// 初始状态：未开启
	code, out := doJSON(t, c, ts, "GET", "/api/share", nil)
	if code != http.StatusOK || out["enabled"] != false {
		t.Fatalf("initial share status: %d %v", code, out)
	}

	// 开启分享
	code, out = doJSON(t, c, ts, "POST", "/api/share", nil)
	if code != http.StatusOK || out["enabled"] != true || len(out["token"].(string)) < 20 {
		t.Fatalf("share create: %d %v", code, out)
	}
	token1 := out["token"].(string)

	// 公开视图：空清单也能看到用户名
	code, shared := doJSON(t, anon, ts, "GET", "/api/shared/"+token1, nil)
	if code != http.StatusOK || shared["username"] != "sharer" {
		t.Fatalf("shared view: %d %v", code, shared)
	}

	// 加一条收藏后公开视图可见
	doJSON(t, c, ts, "PUT", "/api/collection/seti",
		map[string]string{"status": "owned", "name": "SETI", "en": "SETI"})
	code, shared = doJSON(t, anon, ts, "GET", "/api/shared/"+token1, nil)
	counts := shared["counts"].(map[string]any)
	if code != http.StatusOK || counts["owned"].(float64) != 1 {
		t.Fatalf("shared after add: %d %v", code, shared)
	}

	// 重新生成：旧 token 失效
	code, out = doJSON(t, c, ts, "POST", "/api/share", nil)
	token2 := out["token"].(string)
	if token2 == token1 {
		t.Fatal("regenerate should produce new token")
	}
	if code, _ := doJSON(t, anon, ts, "GET", "/api/shared/"+token1, nil); code != http.StatusNotFound {
		t.Fatalf("old token should 404: %d", code)
	}
	if code, _ := doJSON(t, anon, ts, "GET", "/api/shared/"+token2, nil); code != http.StatusOK {
		t.Fatalf("new token should work: %d", code)
	}

	// 非法 token
	if code, _ := doJSON(t, anon, ts, "GET", "/api/shared/BAD!TOKEN", nil); code != http.StatusNotFound {
		t.Fatalf("malformed token should 404: %d", code)
	}

	// 关闭分享
	if code, _ := doJSON(t, c, ts, "DELETE", "/api/share", nil); code != http.StatusOK {
		t.Fatalf("share delete: %d", code)
	}
	if code, _ := doJSON(t, anon, ts, "GET", "/api/shared/"+token2, nil); code != http.StatusNotFound {
		t.Fatalf("disabled token should 404: %d", code)
	}
	code, out = doJSON(t, c, ts, "GET", "/api/share", nil)
	if code != http.StatusOK || out["enabled"] != false {
		t.Fatalf("status after disable: %d %v", code, out)
	}
}

func TestCollectionFlow(t *testing.T) {
	_, ts := newTestServer(t)
	c := client(t, ts)
	register(t, c, ts, "collector")

	// 未登录访问 → 401
	anon := client(t, ts)
	if code, _ := doJSON(t, anon, ts, "GET", "/api/collection", nil); code != http.StatusUnauthorized {
		t.Fatalf("anon list should 401")
	}

	set := func(key, status string) (int, map[string]any) {
		return doJSON(t, c, ts, "PUT", "/api/collection/"+key,
			map[string]string{"status": status, "name": "某游戏", "en": "Some Game"})
	}

	if code, _ := set("seti", store.StatusOwned); code != http.StatusOK {
		t.Fatalf("set owned: %d", code)
	}
	if code, out := doJSON(t, c, ts, "GET", "/api/collection/seti", nil); code != http.StatusOK || out["status"] != "owned" {
		t.Fatalf("get item: %d %v", code, out)
	}
	// 移动到想玩
	if code, _ := set("seti", store.StatusPlay); code != http.StatusOK {
		t.Fatalf("move to play: %d", code)
	}
	// BGA 带斜杠 key
	if code, _ := set("bga/catan", store.StatusWishlist); code != http.StatusOK {
		t.Fatalf("set bga key: %d", code)
	}
	// 移除
	if code, out := set("bga/catan", ""); code != http.StatusOK || out["status"] != "" {
		t.Fatalf("remove: %d %v", code, out)
	}

	code, list := doJSON(t, c, ts, "GET", "/api/collection", nil)
	if code != http.StatusOK {
		t.Fatalf("list: %d", code)
	}
	counts := list["counts"].(map[string]any)
	if counts["play"].(float64) != 1 || counts["wishlist"].(float64) != 0 || counts["owned"].(float64) != 0 {
		t.Fatalf("counts wrong: %v", counts)
	}

	// 非法输入
	if code, _ := set("BAD KEY!", store.StatusOwned); code != http.StatusBadRequest {
		t.Fatalf("invalid key should 400: %d", code)
	}
	if code, _ := set("seti", "someday"); code != http.StatusBadRequest {
		t.Fatalf("invalid status should 400: %d", code)
	}
	code, _ = doJSON(t, c, ts, "PUT", "/api/collection/seti",
		map[string]string{"status": store.StatusOwned, "name": ""})
	if code != http.StatusBadRequest {
		t.Fatalf("empty name should 400: %d", code)
	}
	// 他人数据隔离
	register(t, anon, ts, "other")
	if code, out := doJSON(t, anon, ts, "GET", "/api/collection/seti", nil); code != http.StatusOK || out["status"] != "" {
		t.Fatalf("other user should not see collector's item: %d %v", code, out)
	}
}

func TestLoginRateLimit(t *testing.T) {
	_, ts := newTestServer(t)
	c := client(t, ts)
	var last int
	for i := 0; i < loginLimit+3; i++ {
		code, _ := doJSON(t, c, ts, "POST", "/api/login",
			map[string]string{"username": "ghost", "password": "wrong"})
		last = code
	}
	if last != http.StatusTooManyRequests {
		t.Fatalf("after %d attempts should be 429, got %d", loginLimit+3, last)
	}
}

func TestPruneExpiredSessions(t *testing.T) {
	s, ts := newTestServer(t)
	c := client(t, ts)
	register(t, c, ts, "shortlived")

	// 把所有会话改成已过期
	// （直接用 store 层验证过期逻辑，不动 Cookie）
	u, _, err := s.store.GetUserByUsername(t.Context(), "shortlived")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.store.CreateSession(t.Context(), "expired-token", u.ID, time.Now().Add(-time.Minute)); err != nil {
		t.Fatal(err)
	}
	if _, _, err := s.store.UserBySession(t.Context(), "expired-token"); err != store.ErrNotFound {
		t.Fatalf("expired session should be ErrNotFound, got %v", err)
	}
	if err := s.store.PurgeExpiredSessions(t.Context()); err != nil {
		t.Fatal(err)
	}
}
