// REST 与 WS handler。
package play

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/coder/websocket"

	"github.com/funbinary/boardgame-rules/server/internal/auth"
	"github.com/funbinary/boardgame-rules/server/internal/store"
)

// 允许的对局:目前只有勃艮第。
var gameKeys = map[string]bool{"burgundy": true}

const (
	maxChatBytes = 500
	maxMoveBytes = 8 << 10
)

// Handler 挂载 /api/play/*。
type Handler struct {
	hub   *Hub
	store *store.Store
	// 由 api.Server 注入的会话解析(避免反向依赖)
	currentUser func(r *http.Request) *store.User
}

func NewHandler(s *store.Store, currentUser func(r *http.Request) *store.User) *Handler {
	return &Handler{hub: NewHub(s), store: s, currentUser: currentUser}
}

func (h *Handler) Routes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/play/rooms", h.handleCreateRoom)
	mux.HandleFunc("GET /api/play/rooms", h.handleListRooms)
	mux.HandleFunc("GET /api/play/rooms/{id}", h.handleGetRoom)
	mux.HandleFunc("POST /api/play/rooms/{id}/join", h.handleJoin)
	mux.HandleFunc("POST /api/play/rooms/{id}/start", h.handleStart)
	mux.HandleFunc("GET /api/play/ws", h.handleWS)
}

func (h *Handler) writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (h *Handler) fail(w http.ResponseWriter, status int, code, msg string) {
	h.writeJSON(w, status, map[string]string{"error": code, "msg": msg})
}

// ---------- REST ----------

type createRoomReq struct {
	GameKey     string   `json:"gameKey"`
	Seats       int      `json:"seats"`
	TurnSeconds int      `json:"turnSeconds"`
	Modules     []string `json:"modules"`
}

func (h *Handler) handleCreateRoom(w http.ResponseWriter, r *http.Request) {
	u := h.currentUser(r)
	if u == nil {
		h.fail(w, 401, "auth", "请先登录")
		return
	}
	var req createRoomReq
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&req); err != nil {
		h.fail(w, 400, "bad", "请求体不合法")
		return
	}
	if !gameKeys[req.GameKey] {
		h.fail(w, 400, "bad", "不支持的游戏")
		return
	}
	if req.Seats < 2 || req.Seats > 4 {
		req.Seats = 2
	}
	// UI 提供 60/90/180 三档;此处放宽到 1-600 以便测试自定义
	if req.TurnSeconds < 1 || req.TurnSeconds > 600 {
		req.TurnSeconds = 90
	}
	if len(req.Modules) > 12 {
		h.fail(w, 400, "bad", "模块过多")
		return
	}
	for _, m := range req.Modules {
		if len(m) > 16 {
			h.fail(w, 400, "bad", "非法模块")
			return
		}
	}
	modJSON, _ := json.Marshal(req.Modules)
	room, err := h.store.CreatePlayRoom(r.Context(), u.ID, store.PlayRoom{
		GameKey: req.GameKey, Modules: string(modJSON),
		Seats: req.Seats, TurnSeconds: req.TurnSeconds,
	})
	if err != nil {
		log.Printf("play: 建房失败: %v", err)
		h.fail(w, 500, "internal", "建房失败")
		return
	}
	h.writeJSON(w, 200, map[string]any{"room": room})
}

func (h *Handler) handleListRooms(w http.ResponseWriter, r *http.Request) {
	u := h.currentUser(r)
	if u == nil {
		h.fail(w, 401, "auth", "请先登录")
		return
	}
	rooms, err := h.store.ListPlayRoomsForUser(r.Context(), u.ID)
	if err != nil {
		h.fail(w, 500, "internal", "查询失败")
		return
	}
	h.writeJSON(w, 200, map[string]any{"rooms": rooms})
}

func (h *Handler) handleGetRoom(w http.ResponseWriter, r *http.Request) {
	u := h.currentUser(r)
	if u == nil {
		h.fail(w, 401, "auth", "请先登录")
		return
	}
	id := r.PathValue("id")
	room, err := h.store.GetPlayRoom(r.Context(), id)
	if errors.Is(err, store.ErrNotFound) {
		h.fail(w, 404, "notfound", "房间不存在")
		return
	}
	if err != nil {
		h.fail(w, 500, "internal", "查询失败")
		return
	}
	players, _ := h.store.PlayPlayers(r.Context(), id)
	journal, _ := h.store.PlayJournal(r.Context(), id)
	if journal == nil {
		journal = []store.PlayMoveEntry{}
	}
	if players == nil {
		players = []store.PlayPlayer{}
	}
	h.writeJSON(w, 200, map[string]any{"room": room, "players": players, "journal": journal})
}

func (h *Handler) handleJoin(w http.ResponseWriter, r *http.Request) {
	u := h.currentUser(r)
	if u == nil {
		h.fail(w, 401, "auth", "请先登录")
		return
	}
	id := r.PathValue("id")
	seat, err := h.store.JoinPlayRoom(r.Context(), id, u.ID)
	if errors.Is(err, store.ErrRoomFull) {
		h.fail(w, 409, "full", "房间已满")
		return
	}
	if err != nil {
		h.fail(w, 400, "bad", err.Error())
		return
	}
	// 房间若已在 hub 中,广播 presence
	if room, err := h.hub.getRoom(id); err == nil {
		b, _ := json.Marshal(serverMsg{T: "presence", Presence: room.presence()})
		room.broadcast(b)
	}
	h.writeJSON(w, 200, map[string]any{"seat": seat})
}

func (h *Handler) handleStart(w http.ResponseWriter, r *http.Request) {
	u := h.currentUser(r)
	if u == nil {
		h.fail(w, 401, "auth", "请先登录")
		return
	}
	id := r.PathValue("id")
	var seed int64
	if err := binary.Read(rand.Reader, binary.BigEndian, &seed); err != nil {
		seed = time.Now().UnixNano()
	}
	if err := h.store.StartPlayRoom(r.Context(), id, u.ID, seed); err != nil {
		h.fail(w, 400, "bad", err.Error())
		return
	}
	room, err := h.hub.getRoom(id)
	if err != nil {
		h.fail(w, 500, "internal", "房间加载失败")
		return
	}
	room.markStarted(seed)
	info, _ := h.store.GetPlayRoom(r.Context(), id)
	b, _ := json.Marshal(serverMsg{T: "started", Room: info})
	room.broadcast(b)
	h.writeJSON(w, 200, map[string]any{"seed": seed})
}

const maxBodyBytes = 4 << 10

// ---------- WS ----------

// clientMsg 客户端 → 服务端。
type clientMsg struct {
	T       string          `json:"t"`
	Seq     int64           `json:"seq,omitempty"`
	Move    json.RawMessage `json:"move,omitempty"`
	Hash    string          `json:"hash,omitempty"`
	Next    int             `json:"next,omitempty"`              // 走子后的行动者(客户端报告)
	Timeout bool            `json:"timeout,omitempty"`           // 超时代走产生(任何在座玩家可提交)
	Text    string          `json:"text,omitempty"`
}

// serverMsg 服务端 → 客户端。
type serverMsg struct {
	T           string           `json:"t"`
	Seq         int64            `json:"seq,omitempty"`
	UserID      int64            `json:"userId,omitempty"`
	Name        string           `json:"name,omitempty"`
	Move        json.RawMessage  `json:"move,omitempty"`
	Hash        string           `json:"hash,omitempty"`
	Deadline    int64            `json:"deadline,omitempty"` // unix 毫秒,0=无限时
	TurnSeconds int              `json:"turnSeconds,omitempty"`
	Room        *store.PlayRoom  `json:"room,omitempty"`
	Players     []store.PlayPlayer `json:"players,omitempty"`
	Journal     []store.PlayMoveEntry `json:"journal,omitempty"`
	Presence    []map[string]any `json:"presence,omitempty"`
	Text        string           `json:"text,omitempty"`
	Code        string           `json:"code,omitempty"`
	Msg         string           `json:"msg,omitempty"`
}

func (h *Handler) handleWS(w http.ResponseWriter, r *http.Request) {
	u := h.currentUser(r)
	if u == nil {
		// 程序化客户端兜底:?token=<会话令牌>(浏览器继续走 Cookie)
		if tok := r.URL.Query().Get("token"); tok != "" {
			if usr, _, err := h.store.UserBySession(r.Context(), auth.HashToken(tok)); err == nil {
				u = usr
			}
		}
	}
	if u == nil {
		h.fail(w, 401, "auth", "请先登录")
		return
	}
	id := r.URL.Query().Get("room")
	room, err := h.hub.getRoom(id)
	if err != nil {
		h.fail(w, 404, "notfound", "房间不存在")
		return
	}
	// 在座校验
	players, err := h.store.PlayPlayers(r.Context(), id)
	if err != nil {
		h.fail(w, 500, "internal", "查询失败")
		return
	}
	seated := false
	for _, p := range players {
		if p.UserID == u.ID {
			seated = true
			break
		}
	}
	if !seated {
		h.fail(w, 403, "forbidden", "不在本房间")
		return
	}

	ws, err := websocket.Accept(w, r, nil) // 默认同源校验:页面与 API 同域,跨源拒绝
	if err != nil {
		return
	}
	c := &conn{hub: h.hub, roomID: id, userID: u.ID, name: u.Username, send: make(chan []byte, 64)}

	room.mu.Lock()
	// 一人一连接:踢掉旧连接
	if old, ok := room.conns[u.ID]; ok {
		old.close.Do(func() { close(old.send) })
	}
	room.conns[u.ID] = c
	room.mu.Unlock()

	// init:房间+journal+presence
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	journal, _ := h.store.PlayJournal(ctx, id)
	if journal == nil {
		journal = []store.PlayMoveEntry{}
	}
	info, _ := h.store.GetPlayRoom(ctx, id)
	cancel()
	init := serverMsg{T: "init", Room: info, Players: players, Journal: journal, Name: u.Username}
	room.mu.Lock()
	if !room.deadline.IsZero() {
		init.Deadline = room.deadline.UnixMilli()
	}
	room.mu.Unlock()
	if b, err := json.Marshal(init); err == nil {
		c.send <- b
	}
	if b, err := json.Marshal(serverMsg{T: "presence", Presence: room.presence()}); err == nil {
		room.broadcast(b)
	}

	writeDone := make(chan struct{})
	go func() {
		defer close(writeDone)
		for msg := range c.send {
			wctx, wcancel := context.WithTimeout(context.Background(), 10*time.Second)
			err := ws.Write(wctx, websocket.MessageText, msg)
			wcancel()
			if err != nil {
				return
			}
		}
	}()
	defer func() {
		c.close.Do(func() { close(c.send) })
		<-writeDone
		ws.Close(websocket.StatusNormalClosure, "")
		room.mu.Lock()
		if room.conns[u.ID] == c {
			delete(room.conns, u.ID)
		}
		room.mu.Unlock()
		if b, err := json.Marshal(serverMsg{T: "presence", Presence: room.presence()}); err == nil {
			room.broadcast(b)
		}
	}()

	for {
		rctx, rcancel := context.WithTimeout(context.Background(), 10*time.Minute)
		mt, data, err := ws.Read(rctx)
		rcancel()
		if err != nil {
			return
		}
		if mt != websocket.MessageText {
			continue
		}
		if len(data) > maxMoveBytes+maxChatBytes {
			continue
		}
		var cm clientMsg
		if err := json.Unmarshal(data, &cm); err != nil {
			continue
		}
		switch cm.T {
		case "ping":
			c.safeSend([]byte(`{"t":"pong"}`))
		case "chat":
			if len(cm.Text) == 0 || len(cm.Text) > maxChatBytes {
				continue
			}
			b, _ := json.Marshal(serverMsg{T: "chat", UserID: u.ID, Name: u.Username, Text: cm.Text})
			room.broadcast(b)
		case "move":
			if room.status() != "playing" {
				c.safeSend([]byte(`{"t":"error","code":"notplaying","msg":"对局未开始或已结束"}`))
				continue
			}
			if len(cm.Move) == 0 {
				continue
			}
			if err := room.acceptMove(u.ID, cm.Seq, cm.Move, cm.Hash, cm.Next); err != nil {
				if errors.Is(err, store.ErrStaleSeq) {
					c.safeSend([]byte(`{"t":"error","code":"stale","msg":"序号过期,请以 journal 为准重放"}`))
				} else {
					log.Printf("play: 走子落库失败 room=%s: %v", id, err)
					c.safeSend([]byte(`{"t":"error","code":"internal","msg":"落库失败"}`))
				}
				continue
			}
			b, _ := json.Marshal(serverMsg{T: "move", Seq: cm.Seq, UserID: u.ID, Move: cm.Move, Hash: cm.Hash})
			room.broadcast(b)
			room.mu.Lock()
			dl := room.deadline
			room.mu.Unlock()
			if !dl.IsZero() {
				b2, _ := json.Marshal(serverMsg{T: "deadline", Deadline: dl.UnixMilli()})
				room.broadcast(b2)
			}
		default:
			continue
		}
	}
}

func (c *conn) safeSend(b []byte) {
	select {
	case c.send <- b:
	default:
	}
}
