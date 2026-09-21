package play

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/coder/websocket"

	"github.com/funbinary/boardgame-rules/server/internal/store"
)

// 以 X-Test-User 头模拟登录(测试专用注入)。
func testAuth(s *store.Store) func(*http.Request) *store.User {
	return func(r *http.Request) *store.User {
		uid, err := strconv.ParseInt(r.Header.Get("X-Test-User"), 10, 64)
		if err != nil {
			return nil
		}
		u, err := s.GetUserByID(context.Background(), uid)
		if err != nil {
			return nil
		}
		return u
	}
}

func newTestServer(t *testing.T) (*httptest.Server, *store.Store) {
	t.Helper()
	s, err := store.Open(t.TempDir() + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	h := NewHandler(s, testAuth(s))
	mux := http.NewServeMux()
	h.Routes(mux)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv, s
}

func mkUser(t *testing.T, s *store.Store, name string) *store.User {
	t.Helper()
	u, err := s.CreateUser(context.Background(), name, "x")
	if err != nil {
		t.Fatal(err)
	}
	return u
}

func do(t *testing.T, method, url string, uid int64, body any) (*http.Response, map[string]any) {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req, _ := http.NewRequest(method, url, &buf)
	req.Header.Set("X-Test-User", strconv.FormatInt(uid, 10))
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]any
	_ = json.NewDecoder(res.Body).Decode(&out)
	res.Body.Close()
	return res, out
}

func TestRoomLifecycle(t *testing.T) {
	srv, s := newTestServer(t)
	alice := mkUser(t, s, "alice")
	bob := mkUser(t, s, "bob")

	// 未登录 401
	res, _ := do(t, "POST", srv.URL+"/api/play/rooms", 0, nil)
	if res.StatusCode != 401 {
		t.Fatalf("未登录应 401,got %d", res.StatusCode)
	}

	// 建房
	res, out := do(t, "POST", srv.URL+"/api/play/rooms", alice.ID, map[string]any{
		"gameKey": "burgundy", "seats": 2, "turnSeconds": 90, "modules": []string{"exp1"},
	})
	if res.StatusCode != 200 {
		t.Fatalf("建房失败:%v", out)
	}
	room := out["room"].(map[string]any)
	roomID := room["ID"].(string)
	if room["Seats"].(float64) != 2 || room["GameKey"] != "burgundy" {
		t.Fatalf("房间字段错误:%v", room)
	}

	// 未满员不能开局
	res, out = do(t, "POST", srv.URL+"/api/play/rooms/"+roomID+"/start", alice.ID, nil)
	if res.StatusCode == 200 {
		t.Fatalf("未满员不应开局:%v", out)
	}

	// bob 入座
	res, out = do(t, "POST", srv.URL+"/api/play/rooms/"+roomID+"/join", bob.ID, nil)
	if res.StatusCode != 200 || out["seat"].(float64) != 1 {
		t.Fatalf("入座失败:%v", out)
	}

	// 非房主开局被拒
	res, _ = do(t, "POST", srv.URL+"/api/play/rooms/"+roomID+"/start", bob.ID, nil)
	if res.StatusCode == 200 {
		t.Fatal("非房主不应能开局")
	}

	// 房主开局
	res, out = do(t, "POST", srv.URL+"/api/play/rooms/"+roomID+"/start", alice.ID, nil)
	if res.StatusCode != 200 {
		t.Fatalf("开局失败:%v", out)
	}
	if seed := out["seed"].(float64); seed == 0 {
		t.Fatal("seed 不应为 0")
	}

	// journal 查询(重连)
	res, out = do(t, "GET", srv.URL+"/api/play/rooms/"+roomID, alice.ID, nil)
	if res.StatusCode != 200 {
		t.Fatal("查询房间失败")
	}
	if out["journal"] == nil {
		t.Fatal("应返回 journal 字段")
	}
}

func dialWS(t *testing.T, srv *httptest.Server, roomID string, uid int64) *websocket.Conn {
	t.Helper()
	h := http.Header{}
	h.Set("X-Test-User", strconv.FormatInt(uid, 10))
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	ws, _, err := websocket.Dial(ctx, srv.URL+"/api/play/ws?room="+roomID, &websocket.DialOptions{HTTPHeader: h})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { ws.Close(websocket.StatusNormalClosure, "") })
	return ws
}

func readWS(t *testing.T, ws *websocket.Conn) map[string]any {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, data, err := ws.Read(ctx)
	if err != nil {
		t.Fatalf("read ws: %v", err)
	}
	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatal(err)
	}
	return m
}

func writeWS(t *testing.T, ws *websocket.Conn, v any) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	b, _ := json.Marshal(v)
	if err := ws.Write(ctx, websocket.MessageText, b); err != nil {
		t.Fatal(err)
	}
}

// skipUntil 读取直到出现指定类型消息(跳过 presence/pong 等)。
func skipUntil(t *testing.T, ws *websocket.Conn, typ string) map[string]any {
	t.Helper()
	for i := 0; i < 20; i++ {
		m := readWS(t, ws)
		if m["t"] == typ {
			return m
		}
	}
	t.Fatalf("未等到 %s 消息", typ)
	return nil
}

func TestWSRelayAndJournal(t *testing.T) {
	srv, s := newTestServer(t)
	alice := mkUser(t, s, "alice")
	bob := mkUser(t, s, "bob")
	_, out := do(t, "POST", srv.URL+"/api/play/rooms", alice.ID, map[string]any{
		"gameKey": "burgundy", "seats": 2, "turnSeconds": 90,
	})
	roomID := out["room"].(map[string]any)["ID"].(string)
	do(t, "POST", srv.URL+"/api/play/rooms/"+roomID+"/join", bob.ID, nil)
	do(t, "POST", srv.URL+"/api/play/rooms/"+roomID+"/start", alice.ID, nil)

	wsA := dialWS(t, srv, roomID, alice.ID)
	init := skipUntil(t, wsA, "init")
	if init["room"].(map[string]any)["Status"] != "playing" {
		t.Fatalf("init 房间状态错误:%v", init["room"])
	}

	wsB := dialWS(t, srv, roomID, bob.ID)
	skipUntil(t, wsB, "init")

	// alice 走子 seq=1
	writeWS(t, wsA, map[string]any{"t": "move", "seq": 1, "move": map[string]any{"t": "takeWorkers", "die": 0}, "hash": "aaaa", "next": 1})
	m := skipUntil(t, wsB, "move")
	if m["seq"].(float64) != 1 || m["hash"] != "aaaa" {
		t.Fatalf("bob 未收到正确走子:%v", m)
	}

	// 重复 seq 拒绝
	writeWS(t, wsA, map[string]any{"t": "move", "seq": 1, "move": map[string]any{"t": "x"}, "hash": "b"})
	em := skipUntil(t, wsA, "error")
	if em["code"] != "stale" {
		t.Fatalf("应返回 stale:%v", em)
	}

	// chat
	writeWS(t, wsB, map[string]any{"t": "chat", "text": "你好"})
	cm := skipUntil(t, wsA, "chat")
	if cm["text"] != "你好" || cm["name"] != "bob" {
		t.Fatalf("聊天中继错误:%v", cm)
	}

	// 重连:init 的 journal 含 seq=1
	wsA2 := dialWS(t, srv, roomID, alice.ID)
	init2 := skipUntil(t, wsA2, "init")
	jr := init2["journal"].([]any)
	if len(jr) != 1 {
		t.Fatalf("journal 应有 1 条,got %d", len(jr))
	}
}

func TestTimeoutBroadcast(t *testing.T) {
	srv, s := newTestServer(t)
	alice := mkUser(t, s, "alice")
	bob := mkUser(t, s, "bob")
	_, out := do(t, "POST", srv.URL+"/api/play/rooms", alice.ID, map[string]any{
		"gameKey": "burgundy", "seats": 2, "turnSeconds": 1,
	})
	roomID := out["room"].(map[string]any)["ID"].(string)
	do(t, "POST", srv.URL+"/api/play/rooms/"+roomID+"/join", bob.ID, nil)
	do(t, "POST", srv.URL+"/api/play/rooms/"+roomID+"/start", alice.ID, nil)

	wsA := dialWS(t, srv, roomID, alice.ID)
	skipUntil(t, wsA, "init")

	// 1 秒限时,等超时广播(计时循环 1s 粒度,给足余量)
	m := skipUntil(t, wsA, "timeout")
	if m["turnSeconds"].(float64) != 1 {
		t.Fatalf("timeout 消息错误:%v", m)
	}

	// 超时后任一在座玩家可提交代走(timeout 标记)
	writeWS(t, wsA, map[string]any{"t": "move", "seq": 1, "timeout": true,
		"move": map[string]any{"t": "takeWorkers", "die": 0}, "hash": "auto", "next": 1})
	skipUntil(t, wsA, "move")
}

func TestThirdPartyJoinRejected(t *testing.T) {
	srv, s := newTestServer(t)
	alice := mkUser(t, s, "alice")
	bob := mkUser(t, s, "bob")
	carol := mkUser(t, s, "carol")
	_, out := do(t, "POST", srv.URL+"/api/play/rooms", alice.ID, map[string]any{
		"gameKey": "burgundy", "seats": 2, "turnSeconds": 90,
	})
	roomID := out["room"].(map[string]any)["ID"].(string)
	do(t, "POST", srv.URL+"/api/play/rooms/"+roomID+"/join", bob.ID, nil)
	// carol 满员
	res, _ := do(t, "POST", srv.URL+"/api/play/rooms/"+roomID+"/join", carol.ID, nil)
	if res.StatusCode != 409 {
		t.Fatalf("满员应 409,got %d", res.StatusCode)
	}
}
