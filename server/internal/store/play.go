// Package store — 对战房间与走子日志(联机勃艮第)。
package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base32"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

var (
	ErrRoomFull  = errors.New("房间已满")
	ErrNotHost   = errors.New("仅房主可操作")
	ErrStaleSeq  = errors.New("走子序号过期")
	ErrAlreadyIn = errors.New("已在房间中")
)

// PlayRoom 房间元信息。
type PlayRoom struct {
	ID          string
	GameKey     string // 如 burgundy
	Modules     string // JSON 数组,如 ["exp1","vineyard"]
	Seats       int
	TurnSeconds int
	Status      string // lobby | playing | ended
	Seed        int64
	HostUserID  int64
	// DataVersion 建房客户端的勘定数据指纹(P4 数据漂移防护;空串=历史房间)
	DataVersion string
	CreatedAt   time.Time
}

// PlayPlayer 房内玩家。
type PlayPlayer struct {
	UserID   int64
	Username string
	Seat     int
	JoinedAt time.Time
}

// PlayMoveEntry journal 条目。
type PlayMoveEntry struct {
	Seq    int64           `json:"seq"`
	UserID int64           `json:"userId"`
	Move   json.RawMessage `json:"move"` // 原始走子 JSON(对象,不双重编码)
	Hash   string          `json:"hash"`
}

func (s *Store) migratePlay(ctx context.Context) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS play_rooms (
			id           TEXT PRIMARY KEY,
			game_key     TEXT NOT NULL,
			modules      TEXT NOT NULL DEFAULT '[]',
			seats        INTEGER NOT NULL,
			turn_seconds INTEGER NOT NULL DEFAULT 90,
			status       TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby','playing','ended')),
			seed         INTEGER NOT NULL DEFAULT 0,
			host_user_id INTEGER NOT NULL,
			created_at   TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS play_room_players (
			room_id   TEXT NOT NULL,
			user_id   INTEGER NOT NULL,
			seat      INTEGER NOT NULL,
			joined_at TEXT NOT NULL,
			PRIMARY KEY (room_id, user_id)
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_play_room_seat ON play_room_players(room_id, seat)`,
		`CREATE TABLE IF NOT EXISTS play_moves (
			room_id    TEXT NOT NULL,
			seq        INTEGER NOT NULL,
			user_id    INTEGER NOT NULL,
			move       TEXT NOT NULL,
			state_hash TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL,
			PRIMARY KEY (room_id, seq)
		)`,
	}
	for _, q := range stmts {
		if _, err := s.db.ExecContext(ctx, q); err != nil {
			return fmt.Errorf("migrate play: %w", err)
		}
	}
	// P4 数据指纹列:老库补列(已存在时报 duplicate column,忽略)
	if _, err := s.db.ExecContext(ctx, `ALTER TABLE play_rooms ADD COLUMN data_version TEXT NOT NULL DEFAULT ''`); err != nil {
		if !strings.Contains(err.Error(), "duplicate column") {
			return fmt.Errorf("migrate play data_version: %w", err)
		}
	}
	return nil
}

// NewRoomID 生成 6 位短码(Crockford base32,去易混字符)。
func NewRoomID() string {
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("r%d", time.Now().UnixNano()%1e6)
	}
	return base32.NewEncoding("0123456789abcdefghjkmnpqrstvwxyz").WithPadding(base32.NoPadding).EncodeToString(b)[:6]
}

// CreatePlayRoom 建房(房主自动入座 0)。
func (s *Store) CreatePlayRoom(ctx context.Context, hostUserID int64, r PlayRoom) (*PlayRoom, error) {
	r.ID = NewRoomID()
	r.HostUserID = hostUserID
	r.Status = "lobby"
	r.CreatedAt = time.Now()
	if r.Modules == "" {
		r.Modules = "[]"
	}
	for attempt := 0; attempt < 5; attempt++ {
		_, err := s.db.ExecContext(ctx,
			`INSERT INTO play_rooms (id, game_key, modules, seats, turn_seconds, status, seed, host_user_id, created_at, data_version)
			 VALUES (?,?,?,?,?,?,?,?,?,?)`,
			r.ID, r.GameKey, r.Modules, r.Seats, r.TurnSeconds, r.Status, r.Seed, r.HostUserID, formatTime(r.CreatedAt), r.DataVersion)
		if err == nil {
			if err := s.joinSeat(ctx, r.ID, hostUserID, 0); err != nil {
				return nil, err
			}
			return &r, nil
		}
		if isUniqueViolation(err) {
			r.ID = NewRoomID()
			continue
		}
		return nil, fmt.Errorf("create play room: %w", err)
	}
	return nil, errors.New("房间号生成失败")
}

func (s *Store) GetPlayRoom(ctx context.Context, id string) (*PlayRoom, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT id, game_key, modules, seats, turn_seconds, status, seed, host_user_id, created_at, data_version
		 FROM play_rooms WHERE id = ?`, id)
	var r PlayRoom
	var created string
	if err := row.Scan(&r.ID, &r.GameKey, &r.Modules, &r.Seats, &r.TurnSeconds, &r.Status, &r.Seed, &r.HostUserID, &created, &r.DataVersion); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get play room: %w", err)
	}
	r.CreatedAt = parseTime(created)
	return &r, nil
}

// ListPlayRoomsForUser 我参与且未结束的房间。
func (s *Store) ListPlayRoomsForUser(ctx context.Context, userID int64) ([]PlayRoom, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT r.id, r.game_key, r.modules, r.seats, r.turn_seconds, r.status, r.seed, r.host_user_id, r.created_at, r.data_version
		 FROM play_rooms r JOIN play_room_players p ON p.room_id = r.id
		 WHERE p.user_id = ? AND r.status != 'ended'
		 ORDER BY r.created_at DESC LIMIT 50`, userID)
	if err != nil {
		return nil, fmt.Errorf("list play rooms: %w", err)
	}
	defer rows.Close()
	var out []PlayRoom
	for rows.Next() {
		var r PlayRoom
		var created string
		if err := rows.Scan(&r.ID, &r.GameKey, &r.Modules, &r.Seats, &r.TurnSeconds, &r.Status, &r.Seed, &r.HostUserID, &created, &r.DataVersion); err != nil {
			return nil, err
		}
		r.CreatedAt = parseTime(created)
		out = append(out, r)
	}
	return out, rows.Err()
}

// PlayPlayers 房内玩家(按座位排序)。
func (s *Store) PlayPlayers(ctx context.Context, roomID string) ([]PlayPlayer, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT p.user_id, u.username, p.seat, p.joined_at
		 FROM play_room_players p JOIN users u ON u.id = p.user_id
		 WHERE p.room_id = ? ORDER BY p.seat`, roomID)
	if err != nil {
		return nil, fmt.Errorf("play players: %w", err)
	}
	defer rows.Close()
	var out []PlayPlayer
	for rows.Next() {
		var p PlayPlayer
		var joined string
		if err := rows.Scan(&p.UserID, &p.Username, &p.Seat, &joined); err != nil {
			return nil, err
		}
		p.JoinedAt = parseTime(joined)
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) joinSeat(ctx context.Context, roomID string, userID int64, seat int) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO play_room_players (room_id, user_id, seat, joined_at) VALUES (?,?,?,?)`,
		roomID, userID, seat, formatTime(time.Now()))
	if err != nil && isUniqueViolation(err) {
		if seat == 0 {
			return ErrAlreadyIn
		}
		return ErrRoomFull
	}
	return err
}

// JoinPlayRoom 入座下一个空位。
func (s *Store) JoinPlayRoom(ctx context.Context, roomID string, userID int64) (int, error) {
	players, err := s.PlayPlayers(ctx, roomID)
	if err != nil {
		return -1, err
	}
	for _, p := range players {
		if p.UserID == userID {
			return p.Seat, nil // 幂等
		}
	}
	room, err := s.GetPlayRoom(ctx, roomID)
	if err != nil {
		return -1, err
	}
	if room.Status != "lobby" {
		return -1, errors.New("对局已开始")
	}
	if len(players) >= room.Seats {
		return -1, ErrRoomFull
	}
	seat := len(players)
	if err := s.joinSeat(ctx, roomID, userID, seat); err != nil {
		return -1, err
	}
	return seat, nil
}

// StartPlayRoom 房主开局,写入种子。
func (s *Store) StartPlayRoom(ctx context.Context, roomID string, userID, seed int64) error {
	room, err := s.GetPlayRoom(ctx, roomID)
	if err != nil {
		return err
	}
	if room.HostUserID != userID {
		return ErrNotHost
	}
	if room.Status != "lobby" {
		return errors.New("对局已在进行")
	}
	players, err := s.PlayPlayers(ctx, roomID)
	if err != nil {
		return err
	}
	if len(players) != room.Seats {
		return fmt.Errorf("座位未满(%d/%d)", len(players), room.Seats)
	}
	res, err := s.db.ExecContext(ctx, `UPDATE play_rooms SET status='playing', seed=? WHERE id=? AND status='lobby'`, seed, roomID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return errors.New("对局已在进行")
	}
	return nil
}

// AppendPlayMove 追加走子(seq 必须恰好为 last+1)。
func (s *Store) AppendPlayMove(ctx context.Context, roomID string, seq int64, userID int64, move, hash string) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO play_moves (room_id, seq, user_id, move, state_hash, created_at) VALUES (?,?,?,?,?,?)`,
		roomID, seq, userID, move, hash, formatTime(time.Now()))
	if err != nil && isUniqueViolation(err) {
		return ErrStaleSeq
	}
	return err
}

// PlayJournal 全量走子日志。
func (s *Store) PlayJournal(ctx context.Context, roomID string) ([]PlayMoveEntry, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT seq, user_id, move, state_hash FROM play_moves WHERE room_id=? ORDER BY seq`, roomID)
	if err != nil {
		return nil, fmt.Errorf("play journal: %w", err)
	}
	defer rows.Close()
	var out []PlayMoveEntry
	for rows.Next() {
		var e PlayMoveEntry
		var mv string // modernc/sqlite 驱动回读为 string,中转后再转 RawMessage
		if err := rows.Scan(&e.Seq, &e.UserID, &mv, &e.Hash); err != nil {
			return nil, err
		}
		e.Move = json.RawMessage(mv)
		out = append(out, e)
	}
	return out, rows.Err()
}
