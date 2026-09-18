package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// 收藏状态三档：已有 / 想买 / 想玩。
const (
	StatusOwned    = "owned"
	StatusWishlist = "wishlist"
	StatusPlay     = "play"
)

var ValidStatuses = map[string]bool{StatusOwned: true, StatusWishlist: true, StatusPlay: true}

type CollectionItem struct {
	GameKey   string `json:"game_key"`
	Status    string `json:"status"`
	Name      string `json:"name"`
	En        string `json:"en"`
	UpdatedAt string `json:"updated_at"`
}

// UpsertCollection 设置/移动收藏（name/en 为前端快照，便于清单页离线渲染）。
func (s *Store) UpsertCollection(ctx context.Context, userID int64, item CollectionItem) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO collections (user_id, game_key, status, name, en, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT (user_id, game_key) DO UPDATE SET
			status = excluded.status,
			name = excluded.name,
			en = excluded.en,
			updated_at = excluded.updated_at`,
		userID, item.GameKey, item.Status, item.Name, item.En, formatTime(time.Now()))
	if err != nil {
		return fmt.Errorf("upsert collection: %w", err)
	}
	return nil
}

// CollectionStatus 返回某游戏的收藏状态，未收藏返回 ""。
func (s *Store) CollectionStatus(ctx context.Context, userID int64, gameKey string) (string, error) {
	var status string
	err := s.db.QueryRowContext(ctx,
		`SELECT status FROM collections WHERE user_id = ? AND game_key = ?`,
		userID, gameKey).Scan(&status)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("collection status: %w", err)
	}
	return status, nil
}

func (s *Store) DeleteCollection(ctx context.Context, userID int64, gameKey string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM collections WHERE user_id = ? AND game_key = ?`, userID, gameKey)
	if err != nil {
		return fmt.Errorf("delete collection: %w", err)
	}
	return nil
}

// ListCollection 返回用户全部收藏，按更新时间倒序。
func (s *Store) ListCollection(ctx context.Context, userID int64) ([]CollectionItem, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT game_key, status, name, en, updated_at
		FROM collections WHERE user_id = ?
		ORDER BY updated_at DESC`, userID)
	if err != nil {
		return nil, fmt.Errorf("list collection: %w", err)
	}
	defer rows.Close()
	items := []CollectionItem{}
	for rows.Next() {
		var it CollectionItem
		if err := rows.Scan(&it.GameKey, &it.Status, &it.Name, &it.En, &it.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, rows.Err()
}
