package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// CreateSession 写入会话（token 哈希为主键，明文 token 只存在 Cookie 里）。
func (s *Store) CreateSession(ctx context.Context, tokenHash string, userID int64, expiresAt time.Time) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
		tokenHash, userID, formatTime(expiresAt), formatTime(time.Now()))
	if err != nil {
		return fmt.Errorf("create session: %w", err)
	}
	return nil
}

// UserBySession 按会话查用户；过期会话顺手删除。
func (s *Store) UserBySession(ctx context.Context, tokenHash string) (*User, time.Time, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT u.id, u.username, u.created_at, s.expires_at
		FROM sessions s JOIN users u ON u.id = s.user_id
		WHERE s.token_hash = ?`, tokenHash)
	var u User
	var userCreated, expiresAt string
	if err := row.Scan(&u.ID, &u.Username, &userCreated, &expiresAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, time.Time{}, ErrNotFound
		}
		return nil, time.Time{}, fmt.Errorf("get session: %w", err)
	}
	exp := parseTime(expiresAt)
	if !exp.IsZero() && exp.Before(time.Now()) {
		s.DeleteSession(ctx, tokenHash)
		return nil, time.Time{}, ErrNotFound
	}
	u.CreatedAt = parseTime(userCreated)
	return &u, exp, nil
}

func (s *Store) DeleteSession(ctx context.Context, tokenHash string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE token_hash = ?`, tokenHash)
	if err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	return nil
}

// PurgeExpiredSessions 清理过期会话，供后台定时任务调用。
func (s *Store) PurgeExpiredSessions(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE expires_at < ?`, formatTime(time.Now()))
	if err != nil {
		return fmt.Errorf("purge sessions: %w", err)
	}
	return nil
}
