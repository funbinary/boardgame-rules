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
