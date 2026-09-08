# 桌游规则书

纯静态桌游规则查询网站。无构建步骤、无外部依赖（不用 CDN 字体/JS 库），把整个目录丢到任意静态服务器即可运行，支持手机浏览。

## 目录结构

```
rules/
├── index.html               # 首页（全部游戏统一目录 + 搜索）
├── games/
│   ├── 7-wonders.html       # 中文精选（人工整理）
│   ├── brass-birmingham.html
│   ├── vale-of-eternity.html
│   ├── wingspan.html
│   └── bga/                 # BGA 全量官方规则（脚本生成）
│       └── <game>.html      # 每个游戏一页
├── assets/
│   ├── css/style.css
│   ├── js/main.js           # 自动目录 / 滚动高亮 / 抽屉侧边栏
│   ├── js/bga-index.js      # BGA 游戏索引（构建产物，首页搜索用）
│   └── img/
│       ├── 7-wonders/ …     # 中文精选的规则书扫描图
│       └── bga/             # BGA 规则插图（本地化副本）
├── content/                 # 中文精选的 Markdown 源文本（维护用）
├── tools/
│   ├── fetch-bga.mjs        # 抓取 BGA wiki 全部规则页（_bga/raw/）
│   ├── fetch-bga-images.mjs # 下载规则插图到本地
│   └── build-bga.mjs        # 从 _bga/raw/ 生成 games/bga/ 页面
└── _bga/                    # 抓取缓存（原始 JSON / 日志 / 映射表）
```

## 更新 BGA 规则（全量重建）

```bash
node tools/fetch-bga.mjs         # 抓取/增量更新规则页（约 1600 页，含重定向变体）
node tools/fetch-bga-images.mjs  # 下载插图到本地（并发 6，断点续传）
node tools/build-bga.mjs         # 生成 games/bga/ + assets/js/bga-index.js
```

三个脚本都可重复执行：抓取脚本跳过已有文件，构建脚本全量重写。

## BGA 规则翻译成中文

页面框架已是中文；规则正文默认英文。中文版放在 `content/bga-zh/<游戏id>.html`（存在即优先生效），目前收录 **131 个游戏**：8 个经典游戏人工整理，其余为热门游戏机翻（机翻质量以模型为准）。其中勃艮第城堡为《特别典藏版》官方中文规则书全文转录（`content/bga-zh/castlesofburgundy.html`，扫描图在 `assets/img/bga/castlesofburgundy/`，页头标签经 `<游戏id>.meta.json` 覆盖）；瘟疫危机为官方中文规则书全文转录（`content/bga-zh/pandemic.html`，扫描图在 `assets/img/bga/pandemic/`，整理自哔哩哔哩「BGA桌游规则」文集动态）；农场主（Agricola）为官方中文规则书全文转录（`content/bga-zh/agricola.html`，扫描图在 `assets/img/bga/agricola/`，Zeranix 翻译版，整理自哔哩哔哩「BGA桌游规则」专栏）。领国者（Hegemony）为官方中文规则书全文转录（`content/bga-zh/hegemony.html`，扫描图在 `assets/img/bga/hegemony/`，整理自哔哩哔哩「客厅猫桌游研究会」上/下篇动态）。

游戏名的中文译名在 `content/bga-names-zh.json`（135 个，主要取自 BGA 中文站的官方译名，如卡坦岛、重塑火星、森森不息），未收录的游戏名保留英文原名，直接在 JSON 里补一行即可。

### 热门 Top 100 游戏的中文正文

BGA 中文站热门榜（gamelist?isPopular，按官方 weight 排名前 100）里的游戏规则正文已全部翻译为中文（`_bga/popular-top100.json` 是名单快照；其中 Paladins of the West Kingdom 在 BGA wiki 无规则页，故实际 99 个）。翻译用智谱 GLM 完成，相关脚本：

```bash
node tools/prep-mt-jobs.mjs      # 生成待翻译分块（950 字符/块，必应单次上限约 1000）
node tools/mt-server.mjs         # 本地辅助服务器（18081：发任务/收结果）
node tools/collect-mt.mjs        # 收集译文写入 content/bga-zh/
node tools/build-bga.mjs         # 重建页面
```

机翻流程：浏览器打开 cn.bing.com/translator，页面内脚本自动调用其翻译接口（需保持页面打开）。新增中文译名后重跑上述脚本即可。

### 用 GLM 翻译任意游戏

翻译其余 1600+ 页需要智谱 API Key，两种 key 均可：

- `ZHIPUAI_API_KEY`（open.bigmodel.cn，默认模型 glm-4-flash）
- `Z_AI_API_KEY`（api.z.ai，默认模型 glm-4.5-air；可用 `ZAI_BUSINESS_BASE_URL` 改地址）

```bash
# Windows (CMD)
set Z_AI_API_KEY=你的key
node tools/translate-bga.mjs        # 全量翻译，可随时中断，重跑自动续传
node tools/translate-bga.mjs catan azul   # 只翻指定游戏
```

可选环境变量：`GLM_MODEL`（覆盖默认模型）、`TRANSLATE_CONCURRENCY`（并发，默认 4）、`TRANSLATE_TIMEOUT`（单请求超时毫秒，默认 180000）。翻译完成后脚本会自动重新构建页面。分块译文缓存在 `_bga/translate-cache.json`。

## 功能

- 每个游戏页面有**侧边栏目录**：由正文 `h2/h3` 自动生成（`main.js` 里的 `buildToc()`），滚动时自动高亮当前章节
- **手机适配**（≤900px）：侧边栏变为抽屉，顶栏出现 ☰ 按钮开关
- 顶部阅读进度条、返回顶部按钮
- 每个游戏独立主题色（`body[data-theme="..."]` 控制）

## 本地预览

```bash
cd rules
npm install   # 首次运行装依赖（serve）
npm start     # http://localhost:18080
```

`serve.json` 已关闭 cleanUrls，本地预览的 URL 行为与 nginx 部署一致（`/games/wingspan.html` 直接 200，不重定向）。

没有 Node 环境时的替代方案：

```bash
python -m http.server 18080
```

## 部署到服务器

整个目录就是静态文件，任选一种方式：

**nginx**（示例）：

```nginx
server {
    listen 80;
    server_name  rules.example.com;
    root  /var/www/rules;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

**Docker（一次性）**：

```bash
docker run -d -p 8080:80 -v $(pwd):/usr/share/nginx/html:ro nginx:alpine
```

**GitHub Pages / Netlify / Vercel**：直接连仓库部署即可，无需构建命令。

## 新增一个游戏

1. `content/` 里整理规则的 Markdown 源文本；
2. 复制任意 `games/*.html` 为新页面，替换正文与 `data-theme`；
3. 扫描图放 `assets/img/<game>/`，附录里 `<img loading="lazy">` 引用；
4. 在 `index.html` 的 `featured` 数组加一条（会置顶显示在首页目录里，并与同名的 BGA wiki 条目自动去重）。

## 内容来源

- [七大奇迹](https://www.bilibili.com/opus/1031116154839498768/) · BGA桌游中文规则书
- [永恒之谷](https://www.bilibili.com/opus/890774653861101571)
- [展翅翱翔](https://www.bilibili.com/opus/1030122149069717511/) · BGA桌游中文规则书
- [农场主](https://www.bilibili.com/opus/1030775993404489735/) · BGA桌游规则（官方中文规则书全文转录）
- [工业革命：伯明翰](https://mp.weixin.qq.com/s/9p9dLk-auv57EnYaqD8pHA) · 微信公众号（Roxley 官方繁中规则书转录为简体）
- [勃艮第城堡：特别典藏版](https://mp.weixin.qq.com/s/Q5LgHCoXpvZGdYITuS2H2w) · 微信公众号「乐智源桌游工作室」（官方中文规则书全文转录，见 `games/bga/castlesofburgundy.html`）
- [领国者](https://www.bilibili.com/opus/1244101530062159880)（[下篇](https://www.bilibili.com/opus/1244102552250744886)） · B站「客厅猫桌游研究会」（官方中文规则书全文转录，见 `games/bga/hegemony.html`）
- [阿纳克遗迹](https://www.bilibili.com/opus/1030775946166140930/) · BGA桌游规则（官方中文规则书全文转录，见 `games/bga/arnak.html`）
- [巴塞罗那](https://mp.weixin.qq.com/s/vp7R0FbF9FMj8nFBpGHyCw) · 微信公众号「桌游怎么玩」（官方中文规则书全文转录，见 `games/barcelona.html`）

规则内容版权归原作者所有，本站仅作个人学习查阅。
