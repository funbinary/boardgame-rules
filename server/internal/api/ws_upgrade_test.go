package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/coder/websocket"

	"github.com/funbinary/boardgame-rules/server/internal/auth"
	"github.com/funbinary/boardgame-rules/server/internal/play"
	"github.com/funbinary/boardgame-rules/server/internal/store"
)

// 回归:withLog 的 statusRecorder 必须透传 Hijacker,
// 否则 /api/play/ws 的 WebSocket 升级会以 501 失败(真实事故)。
func TestWSUpgradeThroughMiddleware(t *testing.T) {
	s, err := store.Open(t.TempDir() + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	u, err := s.CreateUser(context.Background(), "wsuser", "x")
	if err != nil {
		t.Fatal(err)
	}
	token, tokenHash, err := auth.NewToken()
	if err != nil {
		t.Fatal(err)
	}
	if err := s.CreateSession(context.Background(), tokenHash, u.ID, time.Now().Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	srv := &Server{store: s, ttl: time.Hour, limiter: NewLimiter()}
	srv.play = play.NewHandler(s, srv.currentUser)
	ts := httptest.NewServer(srv.Handler())
	t.Cleanup(ts.Close)

	// 建房(直接走 store)
	room, err := s.CreatePlayRoom(context.Background(), u.ID, store.PlayRoom{GameKey: "burgundy", Seats: 2, TurnSeconds: 90})
	if err != nil {
		t.Fatal(err)
	}

	h := http.Header{}
	h.Set("Cookie", auth.CookieName+"="+token)
	ws, _, err := websocket.Dial(context.Background(), ts.URL+"/api/play/ws?room="+room.ID, &websocket.DialOptions{HTTPHeader: h})
	if err != nil {
		t.Fatalf("WS 升级失败(中间件未透传 Hijacker?): %v", err)
	}
	defer ws.Close(websocket.StatusNormalClosure, "")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, data, err := ws.Read(ctx)
	if err != nil {
		t.Fatalf("读 init 失败: %v", err)
	}
	if !websocketIsInit(string(data)) {
		t.Fatalf("期望 init 消息,得到: %s", data)
	}
}

func websocketIsInit(s string) bool {
	return len(s) >= 10 && s[0] == '{' && (indexOf(s, `"t":"init"`) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
