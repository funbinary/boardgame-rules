package store

import (
	"context"
	"path/filepath"
	"testing"

	_ "modernc.org/sqlite"
)

// TestShareColumnMigration 验证旧库（无 share_token 列）打开时自动补列。
func TestShareColumnMigration(t *testing.T) {
	path := filepath.Join(t.TempDir(), "old.db")

	// 第一次打开：建全 schema 后关闭
	st, err := Open(path)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	// 先删引用该列的索引，再删列（模拟上线前的旧库 schema）
	if _, err := st.db.Exec(`DROP INDEX idx_users_share_token`); err != nil {
		st.Close()
		t.Fatalf("drop index: %v", err)
	}
	if _, err := st.db.Exec(`ALTER TABLE users DROP COLUMN share_token`); err != nil {
		st.Close()
		t.Fatalf("drop column (模拟旧库): %v", err)
	}
	st.Close()

	// 重新打开：migrate 应补回 share_token
	st2, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	defer st2.Close()

	ctx := context.Background()
	u, err := st2.CreateUser(ctx, "migrant", "pw123456xx")
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := st2.SetShareToken(ctx, u.ID, "tok_migration_check_123456"); err != nil {
		t.Fatalf("set share token: %v", err)
	}
	got, err := st2.GetShareToken(ctx, u.ID)
	if err != nil || got != "tok_migration_check_123456" {
		t.Fatalf("get share token: %q %v", got, err)
	}
	u2, err := st2.UserByShareToken(ctx, "tok_migration_check_123456")
	if err != nil || u2.Username != "migrant" {
		t.Fatalf("user by share token: %v %+v", err, u2)
	}
	// 清除
	if err := st2.SetShareToken(ctx, u.ID, ""); err != nil {
		t.Fatalf("clear share token: %v", err)
	}
	if got, _ := st2.GetShareToken(ctx, u.ID); got != "" {
		t.Fatalf("cleared token should be empty, got %q", got)
	}
	if _, err := st2.UserByShareToken(ctx, "tok_migration_check_123456"); err != ErrNotFound {
		t.Fatalf("cleared token lookup should be ErrNotFound, got %v", err)
	}
}
