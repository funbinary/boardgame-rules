package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

type User struct {
	ID        int64     `json:"id"`
	Username  string    `json:"username"`
	CreatedAt time.Time `json:"created_at"`
}

// CreateUser 写入新用户；用户名冲突返回 ErrUsernameTaken。
func (s *Store) CreateUser(ctx context.Context, username, pwHash string) (*User, error) {
	now := time.Now().UTC()
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO users (username, pw_hash, created_at) VALUES (?, ?, ?)`,
		username, pwHash, formatTime(now))
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrUsernameTaken
		}
		return nil, fmt.Errorf("create user: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	return &User{ID: id, Username: username, CreatedAt: now}, nil
}

// GetUserByUsername 返回用户与其密码哈希（供登录校验）。
func (s *Store) GetUserByUsername(ctx context.Context, username string) (*User, string, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT id, username, pw_hash, created_at FROM users WHERE username = ?`, username)
	var u User
	var createdAt, pwHash string
	if err := row.Scan(&u.ID, &u.Username, &pwHash, &createdAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, "", ErrNotFound
		}
		return nil, "", fmt.Errorf("get user: %w", err)
	}
	u.CreatedAt = parseTime(createdAt)
	return &u, pwHash, nil
}

func (s *Store) GetUserByID(ctx context.Context, id int64) (*User, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT id, username, created_at FROM users WHERE id = ?`, id)
	var u User
	var createdAt string
	if err := row.Scan(&u.ID, &u.Username, &createdAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get user by id: %w", err)
	}
	u.CreatedAt = parseTime(createdAt)
	return &u, nil
}

// CountUsers 返回用户总数（运维/监控用）。
func (s *Store) CountUsers(ctx context.Context) (int, error) {
	var n int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users`).Scan(&n); err != nil {
		return 0, err
	}
	return n, nil
}

// GetShareToken 返回用户分享 token，未开启返回 ""。
func (s *Store) GetShareToken(ctx context.Context, userID int64) (string, error) {
	var tok sql.NullString
	err := s.db.QueryRowContext(ctx,
		`SELECT share_token FROM users WHERE id = ?`, userID).Scan(&tok)
	if err != nil {
		return "", fmt.Errorf("get share token: %w", err)
	}
	if !tok.Valid {
		return "", nil
	}
	return tok.String, nil
}

// SetShareToken 设置用户分享 token；空串即关闭分享。
func (s *Store) SetShareToken(ctx context.Context, userID int64, token string) error {
	var v any
	if token != "" {
		v = token
	}
	_, err := s.db.ExecContext(ctx,
		`UPDATE users SET share_token = ? WHERE id = ?`, v, userID)
	if err != nil {
		return fmt.Errorf("set share token: %w", err)
	}
	return nil
}

// UserByShareToken 按分享 token 查用户（公开只读视图入口）。
func (s *Store) UserByShareToken(ctx context.Context, token string) (*User, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT id, username, created_at FROM users WHERE share_token = ?`, token)
	var u User
	var createdAt string
	if err := row.Scan(&u.ID, &u.Username, &createdAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("user by share token: %w", err)
	}
	u.CreatedAt = parseTime(createdAt)
	return &u, nil
}
