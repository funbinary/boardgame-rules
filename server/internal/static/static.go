// Package static 提供本地开发用的静态文件托管。
// 生产环境由 nginx 直接服务静态文件，此包仅在 SERVE_STATIC 指向站点目录时启用，
// 用于一个进程复刻「静态 + /api」的生产路径形态。
package static

import (
	"net/http"
)

func Handler(dir string) http.Handler {
	// http.FileServer 对目录路径会自动回退到 index.html；
	// 不要显式改写路径，否则触发它对 /index.html 的 301 规整
	return http.FileServer(http.Dir(dir))
}
