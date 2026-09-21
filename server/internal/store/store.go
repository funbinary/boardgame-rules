// Package store 提供 SQLite 持久化：用户、会话、收藏。
package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

var (
	ErrUsernameTaken = errors.New("用户名已被注册")
	ErrNotFound      = errors.New("记录不存在")
)

// Store 封装全部数据库访问。modernc/sqlite 为进程内单写模型，
// 限制单连接即可避免锁竞争，站点流量规模下足够。
type Store struct {
	db *sql.DB
}

func Open(path string) (*Store, error) {
	dsn := fmt.Sprintf("file:%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)&_pragma=synchronous(NORMAL)", path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	db.SetMaxOpenConns(1)
	s := &Store{db: db}
	if err := s.migrate(context.Background()); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) migrate(ctx context.Context) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			username   TEXT NOT NULL UNIQUE COLLATE NOCASE,
			pw_hash    TEXT NOT NULL,
			created_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS sessions (
			token_hash TEXT PRIMARY KEY,
			user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			expires_at TEXT NOT NULL,
			created_at TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at)`,
		`CREATE TABLE IF NOT EXISTS collections (
			user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			game_key   TEXT NOT NULL,
			status     TEXT NOT NULL CHECK (status IN ('owned','wishlist','play')),
			name       TEXT NOT NULL,
			en         TEXT NOT NULL DEFAULT '',
			updated_at TEXT NOT NULL,
			PRIMARY KEY (user_id, game_key)
		)`,
	}
	for _, q := range stmts {
		if _, err := s.db.ExecContext(ctx, q); err != nil {
			return fmt.Errorf("migrate: %w", err)
		}
	}

	// v2：users.share_token（明文存，便于再次展示分享链接；仅授予只读收藏视图）。
	// 建表语句不含此列，新旧库统一在此补加，保证 schema 一致。
	rows, err := s.db.QueryContext(ctx, `PRAGMA table_info(users)`)
	if err != nil {
		return fmt.Errorf("migrate table_info: %w", err)
	}
	hasShare := false
	for rows.Next() {
		var cid, notnull, pk int
		var name, ctype string
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			rows.Close()
			return fmt.Errorf("migrate scan: %w", err)
		}
		if name == "share_token" {
			hasShare = true
		}
	}
	rows.Close()
	if !hasShare {
		if _, err := s.db.ExecContext(ctx, `ALTER TABLE users ADD COLUMN share_token TEXT`); err != nil {
			return fmt.Errorf("migrate add share_token: %w", err)
		}
	}
	if _, err := s.db.ExecContext(ctx,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_share_token ON users(share_token) WHERE share_token IS NOT NULL`); err != nil {
		return fmt.Errorf("migrate share index: %w", err)
	}
	// v3:联机对战房间与走子日志。
	if err := s.migratePlay(ctx); err != nil {
		return err
	}
	return nil
}

func isUniqueViolation(err error) bool {
	return err != nil && strings.Contains(err.Error(), "UNIQUE constraint failed")
}

func formatTime(t time.Time) string { return t.UTC().Format(time.RFC3339) }

func parseTime(s string) time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return time.Time{}
	}
	return t
}
