/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // 站内部署路径:仓库根的 play/burgundy/ 整目录随 rsync 上线
  base: '/play/burgundy/',
  build: {
    outDir: '../../../play/burgundy',
    emptyOutDir: true,
    target: 'es2022',
  },
  server: {
    proxy: {
      // 本地联调:API 与 WS 都转发到本地 rules-api。
      // 不开 changeOrigin,保持 Host 与页面同源,WS 同源校验才能通过。
      '/api': { target: 'http://127.0.0.1:8787', ws: true },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
