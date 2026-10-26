// 协议一致性金测试:把 Go 侧消息样本 marshal 后与 protocol.fixture.json 逐键比对,
// 防止 Go 结构演化与 TS 客户端(src/play/burgundy/src/net/protocol.ts)静默分叉。
// TS 侧断言见 src/play/burgundy/tests/net.test.ts —— 双方各读同一份 fixture。
package play

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/funbinary/boardgame-rules/server/internal/store"
)

func fixtureMap(t *testing.T) map[string]any {
	t.Helper()
	raw, err := os.ReadFile("protocol.fixture.json")
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatal(err)
	}
	return out
}

// assertWire: marshal 后与 fixture 键值(含嵌套)完全一致——多键/少键/改名/改类型都红。
func assertWire(t *testing.T, v any, want any) {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	var got any
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, want) {
		gotB, _ := json.MarshalIndent(got, "", "  ")
		wantB, _ := json.MarshalIndent(want, "", "  ")
		t.Fatalf("线上格式与 protocol.fixture.json 不一致\ngot:\n%s\nwant:\n%s", gotB, wantB)
	}
}

func sampleTime() time.Time { return time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC) }

func TestServerMsgWire(t *testing.T) {
	fx := fixtureMap(t)
	room := &store.PlayRoom{
		ID: "r01abc", GameKey: "burgundy", Modules: `["shields"]`,
		Seats: 3, TurnSeconds: 90, Status: "playing", Seed: 424242,
		HostUserID: 7, DataVersion: "dv-test-0001", CreatedAt: sampleTime(),
	}
	player := store.PlayPlayer{UserID: 7, Username: "host", Seat: 0, JoinedAt: sampleTime()}
	entry := store.PlayMoveEntry{Seq: 1, UserID: 7, Move: json.RawMessage(`{"t":"takeWorkers","die":0}`), Hash: "0123456789abcdef"}

	assertWire(t, room, fx["serverRoom"])
	assertWire(t, player, fx["serverPlayer"])
	assertWire(t, entry, fx["journalEntry"])
	assertWire(t, serverMsg{
		T: "init", Room: room, Players: []store.PlayPlayer{player},
		Journal: []store.PlayMoveEntry{entry}, Deadline: 1767131045000, Name: "host",
	}, fx["serverMsgInit"])
	assertWire(t, serverMsg{T: "move", Seq: 1, UserID: 7, Move: entry.Move, Hash: entry.Hash}, fx["serverMsgMove"])
	assertWire(t, serverMsg{T: "error", Code: "stale", Msg: "序号过期,请以 journal 为准重放"}, fx["serverMsgError"])
	assertWire(t, serverMsg{T: "presence", Presence: []map[string]any{
		{"userId": int64(7), "name": "host", "connected": true},
	}}, fx["serverMsgPresence"])
}

func TestClientMsgWire(t *testing.T) {
	fx := fixtureMap(t)
	b, err := json.Marshal(fx["clientMsgMove"])
	if err != nil {
		t.Fatal(err)
	}
	var cm clientMsg
	if err := json.Unmarshal(b, &cm); err != nil {
		t.Fatal(err)
	}
	if cm.T != "move" || cm.Seq != 2 || cm.Next != 1 || cm.Hash != "fedcba9876543210" {
		t.Fatalf("clientMsg 解析与 fixture 不符: %+v", cm)
	}
	var mv any
	if err := json.Unmarshal(cm.Move, &mv); err != nil {
		t.Fatal(err)
	}
	if want := map[string]any{"t": "sell", "die": float64(1), "color": float64(3)}; !reflect.DeepEqual(mv, want) {
		t.Fatalf("clientMsg.move 不符: %s", cm.Move)
	}
}
