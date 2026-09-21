// Package play 提供联机对战:房间 hub(内存态+计时)+ WS 中继 + journal 持久化。
// 设计:服务端不实现规则,只做鉴权/座位/序号校验/中继/计时;各客户端用同一 TS 引擎
// 重放 journal 得到一致状态,超时由各端确定性代走器计算(先到先入 journal)。
package play

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/funbinary/boardgame-rules/server/internal/store"
)

// Hub 管理全部活跃房间的内存态。
type Hub struct {
	mu    sync.Mutex
	rooms map[string]*room
	store *store.Store
	done  chan struct{}
}

type room struct {
	id      string
	hub     *Hub
	info    store.PlayRoom
	mu      sync.Mutex
	conns   map[int64]*conn // userID → 连接(一人一连接)
	lastSeq int64
	// 客户端报告的当前行动者(用于展示;超时不依赖它,由各端本地判定)
	currentActor int
	deadline     time.Time // 零值=无限时;到点广播一次 timeout 后清零
}

type conn struct {
	hub    *Hub
	roomID string
	userID int64
	name   string
	send   chan []byte
	close  sync.Once
}

func NewHub(s *store.Store) *Hub {
	h := &Hub{rooms: map[string]*room{}, store: s, done: make(chan struct{})}
	go h.timerLoop()
	return h
}

func (h *Hub) Close() { close(h.done) }

// getRoom 取或从 DB 加载房间内存态。
func (h *Hub) getRoom(id string) (*room, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if r, ok := h.rooms[id]; ok {
		return r, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	info, err := h.store.GetPlayRoom(ctx, id)
	if err != nil {
		return nil, err
	}
	journal, err := h.store.PlayJournal(ctx, id)
	if err != nil {
		return nil, err
	}
	r := &room{id: id, hub: h, info: *info, conns: map[int64]*conn{}, lastSeq: int64(len(journal))}
	if info.Status == "playing" && info.TurnSeconds > 0 {
		r.deadline = time.Now().Add(time.Duration(info.TurnSeconds) * time.Second)
	}
	h.rooms[id] = r
	return r, nil
}

func (r *room) broadcast(b []byte) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, c := range r.conns {
		select {
		case c.send <- b:
		default: // 慢消费者:丢弃而非阻塞(对局状态以 journal 为准,可重连补齐)
		}
	}
}

func (r *room) presence() []map[string]any {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := []map[string]any{}
	for uid, c := range r.conns {
		out = append(out, map[string]any{"userId": uid, "name": c.name, "connected": true})
	}
	return out
}

// status 线程安全读取状态。
func (r *room) status() string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.info.Status
}

// timerLoop 每秒扫描超时房间。
func (h *Hub) timerLoop() {
	t := time.NewTicker(time.Second)
	defer t.Stop()
	for {
		select {
		case <-h.done:
			return
		case <-t.C:
			h.mu.Lock()
			ids := make([]string, 0, len(h.rooms))
			for id := range h.rooms {
				ids = append(ids, id)
			}
			h.mu.Unlock()
			for _, id := range ids {
				h.checkTimeout(id)
			}
		}
	}
}

func (h *Hub) checkTimeout(id string) {
	h.mu.Lock()
	r, ok := h.rooms[id]
	h.mu.Unlock()
	if !ok {
		return
	}
	r.mu.Lock()
	if r.deadline.IsZero() || time.Now().Before(r.deadline) || len(r.conns) == 0 {
		r.mu.Unlock()
		return
	}
	r.deadline = time.Time{} // 只广播一次,直到下一手重置
	dl := r.info.TurnSeconds
	r.mu.Unlock()
	msg, _ := json.Marshal(serverMsg{T: "timeout", TurnSeconds: dl})
	r.broadcast(msg)
	log.Printf("play: 房间 %s 超时广播", id)
}

// markStarted 开局:设置计时。
func (r *room) markStarted(seed int64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.info.Status = "playing"
	r.info.Seed = seed
	if r.info.TurnSeconds > 0 {
		r.deadline = time.Now().Add(time.Duration(r.info.TurnSeconds) * time.Second)
	}
}

// acceptMove 校验序号并落 journal、广播、重置计时;nextActor 由客户端报告。
func (r *room) acceptMove(userID int64, seq int64, move json.RawMessage, hash string, nextActor int) error {
	r.mu.Lock()
	if seq != r.lastSeq+1 {
		r.mu.Unlock()
		return store.ErrStaleSeq
	}
	r.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := r.hub.store.AppendPlayMove(ctx, r.id, seq, userID, string(move), hash); err != nil {
		return err
	}
	r.mu.Lock()
	r.lastSeq = seq
	r.currentActor = nextActor
	if r.info.TurnSeconds > 0 {
		r.deadline = time.Now().Add(time.Duration(r.info.TurnSeconds) * time.Second)
	}
	r.mu.Unlock()
	return nil
}
