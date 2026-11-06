# 桌游规则书

桌游规则书查询网站 + Go 用户服务。独立规则页与站点框架是纯静态、无外部依赖（不用 CDN 字体/JS 库），把整个目录丢到任意静态服务器即可运行，支持手机浏览；`games/bga/`、`assets/js/bga-index.js`、`assets/js/bgg-ratings.js`、`assets/js/bga-bgg-board.js`、`assets/i18n/bga/` 为脚本生成的构建产物（日常使用无需重建，重建命令见下文）；`server/` 下的 rules-api 提供注册登录与游戏收藏（已有/想买/想玩）。全站页面支持中英文切换（见下文「中英文切换」）。

## 目录结构

```
rules/
├── index.html               # 首页（全部游戏统一目录 + 搜索）
├── bgg-ranking.html         # BGG 排行榜（Top 100 中英对照 + 总榜 + BGA 对照，数据 js 驱动的交互页）
├── account.html             # 我的收藏（登录/注册 + 三张清单）
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
│   ├── js/i18n.js           # 中英文切换（字典 + 正文片段按需 fetch，全站引用）
│   ├── js/account.js        # 登录态 + 收藏交互（全站引用）
│   ├── js/bga-index.js      # BGA 游戏索引（构建产物，首页搜索用）
│   ├── js/bgg-ratings.js    # BGG 评分数据（构建产物，游戏页 chip / 首页卡片）
│   ├── js/bga-bgg-board.js  # BGA 视图榜单数据（构建产物）
│   ├── js/bgg-full-board.js  # BGG 总榜数据（构建产物，页面懒加载）
│   ├── js/bgg-top100.js     # BGG Top 100 中英对照数据（构建产物，content/bgg-top100.json 生成）
│   ├── i18n/bga/            # 中文规则页的对侧英文正文片段（构建产物，切换语言时按需 fetch）
│   └── img/
│       ├── 7-wonders/ …     # 中文精选的规则书扫描图
│       └── bga/             # BGA 规则插图（本地化副本）
├── content/                 # 中文精选的 Markdown 源文本（维护用）
├── server/                  # rules-api：Go 用户与收藏服务（不进 webroot，rsync 已排除）
│   ├── cmd/rules-api/       # 入口
│   ├── internal/            # store(SQLite) / auth / api / static
│   └── deploy/              # systemd 单元 + 服务器一次性引导脚本
├── tools/
│   ├── fetch-bga.mjs        # 抓取 BGA wiki 全部规则页（_bga/raw/）
│   ├── fetch-bga-images.mjs # 下载规则插图到本地
│   ├── build-bga.mjs        # 从 _bga/raw/ 生成 games/bga/ 页面
│   ├── gen-bgg-data.mjs     # _bgg/results.jsonl → assets/js/bgg-ratings.js
│   ├── gen-bgg-board.mjs    # _bga/gamelist-*.json + results.jsonl → 榜单数据
│   ├── gen-bgg-top100.mjs   # content/bgg-top100.json → Top100 对照数据 + 回注中文名到总榜
│   ├── wire-i18n.mjs        # 给手写独立页 games/*.html 幂等接入中英切换（data 属性 + i18n.js）
│   └── wire-account.mjs     # 给游戏页幂等注入 data-game-key + account.js
└── _bga/                    # 抓取缓存（原始 JSON / 日志 / 映射表）
```

## 更新 BGA 规则（全量重建）

```bash
node tools/fetch-bga.mjs         # 抓取/增量更新规则页（约 1600 页，含重定向变体）
node tools/fetch-bga-images.mjs  # 下载插图到本地（并发 6，断点续传）
node tools/build-bga.mjs         # 生成 games/bga/ + assets/js/bga-index.js + assets/i18n/bga/*.en.html
node tools/wire-i18n.mjs         # 给手写独立页 games/*.html 接入中英切换（幂等，新增独立页后跑一次）
```

三个脚本都可重复执行：抓取脚本跳过已有文件，构建脚本全量重写。

## 中英文切换（全站）

`assets/js/i18n.js` 提供「中/EN」同页即时切换：顶栏按钮切换界面文案与规则正文，语言选择存 `localStorage`（键 `zrules-lang`），跨页/刷新保持；单 URL，不产生英文版独立页面，SEO 四件套（canonical/og/JSON-LD）保持中文默认。

- **界面文案**：页面元素带 `data-i18n="key"`（查 i18n.js 内字典）或 `data-zh`/`data-en`（每页不同的文案，如游戏名）属性，`data-i18n-aria`/`data-i18n-placeholder`/`data-title-*` 同理换 aria-label/placeholder/title；内含链接等子节点的整段文案（如首页/榜单页脚数据来源段）用成对的 `data-lang-only="zh|en"` 按语言显隐——textContent 替换会清掉子节点，不能走 data-zh。BGA 生成页由 build-bga.mjs 模板输出，独立页由 wire-i18n.mjs 幂等注入（英文名来自 `content/site-games.json` 的 en 字段），index/bgg-ranking/account/shared 四个根页面为手写。
- **游戏名单语言名**：首页目录卡、双榜单行、收藏/分享清单行只显示当前语言的一个名字（英文侧用 en 字段裁掉「· 官方中文规则书」类中文后缀，缺失时回退另一语言名；数据里没有中文名的榜行如 Brass: Birmingham 中文侧仍显示英文名）。双语名完整保留在卡片 `data-zh`/`data-en` 与清单行 `data-name`/`data-en` 上——收藏写库始终是「中文名+英文名」成对快照，不随当前显示语言改写。
- **规则正文**：`<article data-page-lang="zh|en" data-alt-body="片段URL">` 包裹 `<div class="rule-body">`；切换时 i18n.js 按需 fetch 对侧语言片段（sessionStorage 缓存）替换正文并派发 `zrules:langchange` 事件（main.js 重建目录、index/bgg-ranking/account/shared 重渲染列表）。中文规则页（content/bga-zh/ 有正文的 134 款）的对侧英文片段来自 `_bga/raw/` BGA wiki 原文，由 build-bga.mjs 产出在 `assets/i18n/bga/<id>.en.html`。
- **收藏/账户文案**：account.js 注入的顶栏登录链接、游戏页「已有/想买/想玩」收藏条、登录态首页卡片快捷按钮与 account/shared 两页全部文案走字典，`zrules:langchange` 后重刷；rules-api 返回的中文错误串由 i18n.js `tErr()` 在英文侧转译（已知串映射，未知串原样显示）。
- **缺失翻译**：约 1500 个 BGA 页正文是英文（无中文版）、32 个独立页正文是中文（无英文版）——切到缺失语言时正文保持原文，并在正文顶部显示「该规则暂无XX文翻译」提示条（`.i18n-notice`）。后续可用「BGA 规则翻译成中文」管线补齐，补齐即自动获得真双语。
- 例外：play/burgundy 在线玩子应用未纳入切换。

## BGG 排行榜（bgg-ranking.html）

首页 hero 标签可进入的三视图榜单页：

- **🏆 BGG 总榜**（默认视图）：BoardGameGeek 总排名完整榜单（约 3300 名内全部有排名桌游，**含未上架 BGA 的游戏**），含 Geek 评分/平均分/评分人数；每款标注 🎮 可否在 BGA 在线玩（正式/Beta）、「已下架」（曾上架 BGA、现已移除但本站保留规则书，如 Brass: Birmingham）、📚 本站有无中文规则书。数据抓自 BGG browse 榜单页（`_bgg/browse-raw*/`，33 页多版本装配，`_bgg/assemble-board.mjs` 去伪存真——web_reader 渲染伪影页需双版本一致性判真；个别名次存在快照时点差异）。
- **🀄 Top 100 中英对照**：BGG 总榜前 100 名的「中文名/英文名」并排对照表（两种语言同时显示，不随站内语言切换），含 Geek 评分；中文名优先官方中文版/本站译名（如 工业革命：伯明翰、重塑火星、仙境幽谷、寒霜迷城、星际探险队），有规则书的中文直达本站。单一事实源 `content/bgg-top100.json`（快照日期 + 人工核过的译名），更新榜单就改它再重跑生成脚本。
- **🎮 BGA 在架游戏**：BGA 当前在架全部 1400+ 款对照 BGG 评分/总排名，支持搜索、筛选（正式/Beta/付费/待补/无词条）与三种排序。

总榜/BGA 两视图支持搜索、筛选、排序与分批加载；总榜数据 271KB 懒加载（切到该视图才拉取）。数据重建：

```bash
node tools/gen-bgg-board.mjs   # ① _bga/gamelist-*.json + _bgg/results.jsonl → assets/js/bga-bgg-board.js（BGA 视图）
                                # ② _bgg/full-board.jsonl（browse 装配结果）+ 本站页面 → assets/js/bgg-full-board.js（总榜视图，含空槽注入）
node tools/gen-bgg-top100.mjs  # content/bgg-top100.json → assets/js/bgg-top100.js（对照视图），
                                # 并把核实中文名回注 bgg-full-board.js（只补空缺不覆盖；注意 gen-bgg-board 重建总榜会清掉回注，重建后需重跑本脚本）
```

补抓 BGG 评分后（见 `rules-bgg-ratings` skill）重跑本脚本，页面数据即自动更新。

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
- **用户与收藏**：注册登录后，任意游戏页一键标记 已有 / 想买 / 想玩；`account.html` 集中管理三张清单（见下文「用户与收藏服务 rules-api」）

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

**本地调试用户服务**（一个进程同时托管静态页 + /api，复刻生产路径形态）：

```bash
cd server
ADDR=127.0.0.1:18090 COOKIE_SECURE=0 SERVE_STATIC=.. go run ./cmd/rules-api
```

（Windows PowerShell 下用 `$env:ADDR='127.0.0.1:18090'` 等逐条设置环境变量。）

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
4. 在 `index.html` 的 `featured` 数组加一条（会置顶显示在首页目录里，并与同名的 BGA wiki 条目自动去重）；
5. 给新页面挂收藏能力：`<body …>` 加 `data-game-key="<slug>"`，`main.js` 引用后追加 `assets/js/account.js`（或直接跑 `node tools/wire-account.mjs` 幂等补齐全站）。

## 用户与收藏服务 rules-api

Go 1.26 编写的用户/收藏后端，位于 `server/`（不进 webroot，部署时 rsync 已排除）。零 Web 框架，依赖仅 `modernc.org/sqlite`（纯 Go SQLite 驱动，CGO_ENABLED=0 可交叉编译）与 `x/crypto/bcrypt`。

- **API**（前缀 `/api`，JSON）：`POST register/login/logout`、`GET me/health`、`GET collection`（三张清单+计数）、`GET|PUT collection/{game_key}`（status 为 `owned/wishlist/play`，空串即移除）。`game_key` 为精选页 slug（`seti`）或 `bga/<id>`（`bga/catan`）。分享：`GET|POST|DELETE share`（查询/生成重生成/关闭，token 随机 256 位）+ `GET shared/{token}`（公开只读视图，`shared.html?t=<token>` 渲染，限流 120/分/IP）。
- **认证**：bcrypt 密码哈希；密码规则 8-72 位且同时含字母和数字、常见弱密码黑名单（仅注册校验，存量登录不受影响）；会话 token 随机 32 字节、库中只存 sha256；Cookie `rules_session`（HttpOnly + Secure + SameSite=Lax，30 天）。限流：注册 5/时/IP、登录 15/5 分/IP、收藏写 120/分/IP（内存固定窗口）。
- **联机对战**（`/api/play`，游戏页 `play/burgundy/`）：REST `POST rooms`（建房：游戏/人数 2-4/每回合限时秒/模块勾选）、`GET rooms`、`GET rooms/{id}`（含全量走子 journal，断线重连重放）、`POST rooms/{id}/join|start`；WS `GET play/ws?room={id}` 走子中继/聊天/presence/超时广播。服务端不实现规则——各客户端用同一 TS 引擎重放 journal，每步带状态哈希对账，超时由各端确定性代走器计算（先到先入 journal）。表：`play_rooms`/`play_room_players`/`play_moves`（append-only）。
- **生产部署**（腾讯云服务器）：二进制 `/opt/rules-api/rules-api`，数据 `/opt/rules-api/data/rules.db`，systemd 单元 `rules-api.service`（仅监听 127.0.0.1:8787）；nginx `/etc/nginx/conf.d/rule.conf` 的 443 块将 `location /api/` 反代至该端口。一次性引导见 `server/deploy/bootstrap.sh`（幂等；含 `/api/play/ws` 所需的 WebSocket Upgrade 头——**老部署需重跑一次 bootstrap.sh 或手工补 Upgrade/Connection 头**，否则联机 WS 无法握手）。
- **日常发版**：`deploy.yml` 全自动——交叉编译 → rsync 静态（排除 `server/`）→ scp 二进制 → 重启服务 → 验证 `https://rule.zhibinai.cn/api/health`。
- **数据维护**：用户/会话/收藏都在单个 SQLite 文件，备份即拷贝（建议停服务或用 `sqlite3 .backup`）；手动改数据可在服务器上用 `python3`（自带 sqlite3 模块）。
- 收藏清单当前仅本人可见；表结构已预留分享扩展（后续可加随机只读链接）。

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
- [沙丘：帝国](https://iyingdi.com/tz/post/2355507) · 旅法师营地（官方中文规则书 v3 + 单人规则 + 地区说明全文转录，见 `games/dune-imperium.html`）
- [沙丘：帝国起义](https://bghub.org/r/duneimperiumuprising.pdf) · Dire Wolf 官方英文规则书全文翻译（2023，页面图采用官方繁体中文版 PDF，见 `games/dune-imperium-uprising.html`）
- [创升纪元（Ascension）第四版 + 史诗传奇](https://mp.weixin.qq.com/s/VJ53bUNrsGhUCj_h8XIggA) · 微信公众号「悠叶游YOUYEYOU」（中文版玩法全录转录，见 `games/ascension.html`）
- [图拉真（Trajan）](https://mp.weixin.qq.com/s/y-vw5nrlDctHDrmVdrAHyA) · 微信公众号「无忧桌游」（官方中文规则书全文转录，见 `games/trajan.html`）
- [郁金香泡沫（Tulip Bubble）](https://mp.weixin.qq.com/s/Q91sRYhdjiCmH73IEPsWbQ) · 微信公众号「桌游怎么玩」（官方中文规则书全文转录，见 `games/tulip-bubble.html`）
- [伽利略：伽利莱（Galileo Galilei）](https://mp.weixin.qq.com/s/YX-JRKKMtpBPOqVz5YGqeg) · 微信公众号「桌游怎么玩」（Pink Troubadour 官方中文规则书全文转录，见 `games/galileo-galilei.html`）
- [铁路环游（Ticket to Ride）](https://www.bilibili.com/opus/1042253511813758996) · 哔哩哔哩「BGA小助手」（Days of Wonder 官方中文规则书全文转录，见 `games/bga/tickettoride.html`）
- [大西部之路 第二版（Great Western Trail 2E）](https://www.bilibili.com/opus/1031877777069965321) · 哔哩哔哩「BGA小助手」（2021 第二版中文规则书全文转录，翻译陈斌华，见 `games/bga/greatwesterntrail.html`）
- [奥丁的盛宴（A Feast for Odin）](https://www.bilibili.com/opus/1032623318990061570) · 哔哩哔哩「BGA小助手」（游人码头繁体中文版规则书+附录全文转录、转简体，见 `games/bga/feastforodin.html`）
- [奥洛伊：布拉格天文钟（Orloj: The Prague Astronomical Clock）](https://mp.weixin.qq.com/s/hZMk4x7_qZPONjyyrdQLYg) · 微信公众号「桌游怎么玩」（Perro Loko Games 官方中文规则书全文转录，翻译陈斌华，见 `games/orloj.html`）
- [殖民火星/重塑火星（Terraforming Mars）](https://www.bilibili.com/opus/1030063174843367432) · 哔哩哔哩「BGA小助手」（繁体中文版规则书全文转录、转简体，覆盖原 BGA wiki 机翻页，见 `games/bga/terraformingmars.html`）
- [快餐连锁大亨（Food Chain Magnate）](https://mp.weixin.qq.com/s/Dy8X0sICGQ19fZjrZCUdNw) · 微信公众号「桌游怎么玩」（一刻馆官方中文版规则书全文转录，取代此前收录的焦无耻排印译本（[旧源](https://mp.weixin.qq.com/s/0xN6ZDRIY_2Wv1UvQ2Mkjw)，旧版见 Git 历史 1a76ebc），见 `games/food-chain-magnate.html`）
- [CLANK! 地下墓穴（Clank!: Catacombs）](https://mp.weixin.qq.com/s/eFYIoamsySitThPcMxRVjQ) · 微信公众号「无忧桌游」（Dire Wolf 官方中文规则书全文转录，含 5–6 人派对扩展规则，见 `games/clank-catacombs.html`）
- [方舟动物园（Ark Nova）](https://mp.weixin.qq.com/s/F_CRdbW-HPnsSNYDQm8vhw) · 微信公众号「桌游怎么玩」（游人码头官方中文规则书全文转录+新手规则思维导图，并附[集石官方FAQ](https://www.gstonegames.com/game/doc-4785.html)（Feuerland v1.0·2021-12，2024-03 更新：基础版图标概览/术语表/动物能力详解/赞助商卡牌 201–272 逐张澄清/地图 6·7·8 详解）与[集石官方勘误及FAQ](https://www.gstonegames.com/game/doc-5360.html)（勘误1.0/1.1）逐字转录，覆盖原 BGA wiki 机翻页，见 `games/bga/arknova.html`）
- [方舟动物园：海洋世界（Ark Nova: Marine Worlds）](https://mp.weixin.qq.com/s/CEQf5aa0KbUTwRtjAgg_QA) · 微信公众号「桌游怎么玩」（扩展官方中文规则书+随书术语表/图标概览全文转录，见 `games/ark-nova-marine-worlds.html`）
- [大创造时代（Age of Innovation）](https://mp.weixin.qq.com/s/g4Hbz6PNH9wXF1KnnIwqfQ) · 微信公众号「桌游怎么玩」（神秘大地系列，陈斌华非官方简体中文规则书全文转录，覆盖原 BGA wiki 机翻页，见 `games/bga/ageofinnovation.html`）
- [地下酒吧（Speakeasy）](https://mp.weixin.qq.com/s/rd8TwTQ70XzUmEGOD9h1Lg) · 微信公众号「桌游怎么玩」（Vital Lacerda 作品，陈斌华中文规则书全文转录，见 `games/speakeasy.html`）
- [电力公司（Power Grid）](https://mp.weixin.qq.com/s/BIVeveLX6kIYAHX9qqZntw) · 微信公众号「白马公子」（中文规则书全文转录，附中国/韩国地图扩展规则与资源表，见 `games/power-grid.html`）
- [SETI：寻找外星人（SETI: Search for Extraterrestrial Intelligence）](https://mp.weixin.qq.com/s/GhvVuSu4sZ7t4qG1jQfHhA) · 微信公众号「桌游怎么玩」（[上篇 1–14](https://mp.weixin.qq.com/s/GhvVuSu4sZ7t4qG1jQfHhA) / [下篇 15–28](https://mp.weixin.qq.com/s/dsypcaYiXezRAdvcCrifjQ)，CGE 作品，陈斌华中文规则书全文转录，含单人游戏规则与 FAQ，见 `games/seti.html`）
- [地外文明：太空机构（SETI: Space Agencies）](https://mp.weixin.qq.com/s/bOqAtW6UeCSGyJqAyBPm4Q) · 微信公众号「乐智源桌游工作室」（SETI 官方中文版《地外文明》的扩展规则书全文转录，封面+8 页，11 个非对称机构/快速启动牌/42 张新项目牌/3 个新外星物种/信号指示物/单人长期目标/Promo 卡牌与 FAQ，见 `games/seti-space-agencies.html`）
- [姬路城（The White Castle）](https://mp.weixin.qq.com/s/7Az5TS7gdIokcO6RNyON_w) · 微信公众号「宁小方510」（Sheila Santos & Israel Cendrero 设计，Devir Games 出版，「圣瓦西里大教堂」系列第二作，官方中文规则书全文转录，18 张扫描图（封面+介绍+印页 4–20），桥梁骰子放置/城堡三层/三大行动/大名家纹与灯笼/时间流逝轨/单人模式「德川家族的到访」/终局计分示例/附录图标总表，见 `games/white-castle.html`）
- [姬路城：茶道（The White Castle: Matcha）](https://boardgamegeek.com/filepage/285723/rulebook) · BGG 文件区 Devir 官方英文规则书（2024 扩展，官方英文规则书全文翻译，16 页扫描图随文嵌入：绿色桥梁与绿骰/茶田·姬路城郊外两新地点/个人领地绿色行与仪式板块/艺伎与茶筅/茶之路·茶室三房间·池畔眺台/每轮 4 回合新节奏/茶园艺伎终局计分/单人模式扩展图标/附录仪式板块 20 效与抹茶图标，术语与本体官译对齐，见 `games/white-castle-matcha.html`）
- [盖亚计划（Gaia Project）](https://mp.weixin.qq.com/s?__biz=MzIwMjg2MzMyNg==&mid=2247535908&idx=4&sn=23ba98ef27e198c6c0c74a53965b69d1) · 微信公众号「桌游怎么玩」（Feuerland Spiele 作品，Helge Ostertag & Jens Drogemüller 设计，繁体中文版由游人码头发行，19 张扫描图（印页 1–19）全文转录，覆盖原 BGA wiki 机翻页：游戏配件/游戏设置（星域板块·开发面板·计分面板·种族挑选·回合助推板块·中立玩家）/目标与流程/能量循环/六回合四阶段/十大行动（建造矿产基地·盖亚计划·升级建筑·建立联邦·提升研究·能量与量子智能方块行动·特殊行动·放弃·吸取能量·快速行动）/终局计分/进阶设置（可变版图·可变行动顺序），原书附录与单人智脑规则未随篇收录，见 `games/bga/gaiaproject.html`）
- [盖亚计划：失落的舰队（Gaia Project: The Lost Fleet）](https://mp.weixin.qq.com/s?__biz=MzIwMjg2MzMyNg==&mid=2247533486&idx=1&sn=fff7450bf520206615d74be6d5a0cef1) · 微信公众号「桌游怎么玩」（规则来源：斯虹，Feuerland Spiele 2024 官方扩展，中文翻译：周天易，16 张扫描图全文转录：深空星域与星际板块·可变版图 2/3/4 人布局·四艘失落舰队飞船（黄昏号/反叛号/重塑火星号/日蚀号）·新行动探索与调查圣器·小行星/原行星新星球类型·4 个新种族（焊修智械/莫维兹星人/太空巨人/暗黑星人）·新回合助推器/计分板块/科技/联邦标记·智脑单人规则变更与难度等级·十八个种族概览，见 `games/gaiaproject-lost-fleet.html`）
- [灵迹岛（Spirit Island）](https://boardgamegeek.com/boardgame/162886/spirit-island) · [BoardGameGeek](https://boardgamegeek.com/boardgame/162886/spirit-island)（R. Eric Reuss 设计，Greater Than Games 出版，BGG 总榜排名 #11，官方英文规则书 VER 23.08 全文翻译，32 页原书页面图随文嵌入：扮演自然之灵与达罕人对抗殖民入侵者·灵阶段成长/获得能量/打出力量牌·迅捷与迟缓力量·入侵者肆虐/建造/探索三行动·恐惧与恐怖等级三段胜利条件·枯萎级联·临在与圣域·元素阈值·聚拢与推离·三对手（勃兰登堡-普鲁士/英格兰/瑞典）与四情景·单人模式·主题地图·背景故事·设计笔记·术语表与图标参考，见 `games/spirit-island.html`）
- [自然和弦（Harmonies）](https://boardgamegeek.com/filepage/276502/official-harmonies-rulebook) · BGG 文件区 Libellud 官方英文规则书（Johan Benvenuto 设计，BGG 总榜排名 #52，官方英文规则书全文翻译，7 页 PDF（小册子 12 页）原书页面图随文嵌入：放置彩色板块构建景观与栖息地·回合三行动（拿放板块/拿动物卡/放动物方块）·叠放规则与朝向组合·六类景观计分（树/山/田野/建筑/河流 A 面/岛屿 B 面，计分表逐值转录）·动物卡计分·自然之灵卡·单人模式太阳换算表·封底玩家帮助，见 `games/harmonies.html`）
- [仙女座边境（Andromeda's Edge）](https://mp.weixin.qq.com/s?__biz=MzIwMjg2MzMyNg==&mid=2247532963&idx=1&sn=294872d62ccf6545e14767a3505f5d60) · 微信公众号「桌游怎么玩」（[上篇 1–14](https://mp.weixin.qq.com/s?__biz=MzIwMjg2MzMyNg==&mid=2247532963&idx=2&sn=e2e1f1d5135ab71cf52eb73f45a1d9c5) / [下篇 15–28](https://mp.weixin.qq.com/s?__biz=MzIwMjg2MzMyNg==&mid=2247532963&idx=1&sn=294872d62ccf6545e14767a3505f5d60)，Cardboard Alchemy 作品，Luke Laurie 设计，陈斌华中文翻译&排版，28 张扫描图全文转录，覆盖原 BGA wiki 机翻页：发射回合四步骤/联盟基地/海盗袭击与战斗六步/模块与卫星插槽/开发项目计分/五条进度轨道/事件轨道/护盾与修理/最终计分/可选规则（特殊地区/命运卡/2v2）/图标总表，见 `games/bga/andromedasedge.html`）
- [奋进号：深海（Endeavor: Deep Sea）](https://mp.weixin.qq.com/s/wsGWL0IV3MMCTjv9A2xTvQ) · 微信公众号「张憬泽」（Burnt Island Games / Grand Gamers Guild 作品，张憬泽中文翻译&排版，16 页扫描图全文转录，含合作/单人模式，见 `games/endeavor-deep-sea.html`）
- [卡坦岛（Catan）](https://mp.weixin.qq.com/s/NZg9R3WGyv07Y4ATOtsBRw) · 微信公众号「无忧桌游」（KOSMOS《卡坦：基礎》官方中文规则书全文转录，遊戲說明單張＋遊戲規則冊（繁体）＋玩家手冊（简体），覆盖原 BGA wiki 机翻页，见 `games/bga/catan.html`）
- [埃多拉的德鲁伊（The Druids of Edora）](games/druids-of-edora.html) · 玩家社群流传扫描件（Stefan Feld 作品，alea / Ravensburger 出版，陈斌华中文翻译&排版，全书 12 页+双面规则参考表（魔法药剂/石碑）全文转录，见 `games/druids-of-edora.html`）
- [巫师飞塔（Wandering Towers）](https://mp.weixin.qq.com/s/bS7rGuj0lXQ2RFGmt3Mc3g) · 微信公众号「无忧桌游」（Kramer & Kiesling 作品，ABACUSSPIELE 出版/游卡代理，官方中文规则书全文转录，含单人/合作/大乱斗/团队变体与咒语速查，覆盖原 BGA wiki 机翻页，见 `games/bga/wanderingtowers.html`）
- [马拉开波（Maracaibo）](https://shop.capstone.hk/products/maracaibo-chi-ver) · Capstone 香港商品页提供的[线上规则说明书 PDF](https://www.gokids.com.tw/tsaiss/gokids/rules/%E9%A6%AC%E6%8B%89%E9%96%8B%E6%B3%A2_%E6%B0%B4%E5%8D%B0.pdf)（Alexander Pfister 作品，官方繁体中文版（艾賜魔袋台灣翻译排版）全文转录并转写为简体，覆盖原 BGA wiki 机翻页，见 `games/bga/maracaibo.html`）

- [奥地利大饭店（Grand Austria Hotel）](https://mp.weixin.qq.com/s/H9Pp2T7TXpO7J9HbjFZM5w) · 微信公众号「无忧桌游」（Luciani & Gigli 作品，Lookout Spiele 出版，中文规则书全文转录，含满房奖励/政治卡/49 名员工与符号速查，见 `games/grand-austria-hotel.html`）

- [阿勒农场（Fields of Arle）](https://mp.weixin.qq.com/s/mDfNCFGvtqiurBd7QKP31A) · 微信公众号「无忧桌游」（Uwe Rosenberg 作品，Feuerland 出版/游人码头中文大盒版，繁体中文规则书全文转录，含《茶與貿易》擴展与建筑/旅行目的地/工具索引，见 `games/fields-of-arle.html`）

- [奶酪（Fromage）](https://mp.weixin.qq.com/s/LDXk77QOFWEvtBf71OHiVg) · 微信公众号「无忧桌游」（2024 年同时工人放置转盘游戏，游卡中文版，中文规则书全文转录，含单人模式与组装说明，覆盖原 BGA wiki 机翻页，见 `games/bga/fromage.html`）

- [风声再临（The Message）](https://www.gstonegames.com/game/doc-859.html) · 集石词条所载中文规则书（来源标注：出版商，Tobey Ho 设计/千骐动漫出版，3–7 人谍战阵营推理，中文规则书全文转录，含 25 名角色技能与游戏用语概念说明，见 `games/the-message.html`）

- [璀璨宝石（Splendor）](https://www.gstonegames.com/game/doc-517.html) · 集石词条所载官方中文规则书（Marc André 设计，SPACE Cowboys 出版/Gokids 玩樂小子翻譯排版，2–4 人珠宝商贸，繁体规则书全文转录，含 2/3 人变体与贵族规则，覆盖原 BGA wiki 机翻页，见 `games/bga/splendor.html`）

- [大西部开拓者：新西兰开拓史（Great Western Trail: New Zealand）](https://www.gstonegames.com/game/doc-4984.html) · 集石词条所载非官方规则书（Alexander Pfister 设计，eggertspiele 出版/本长文化发行，1–4 人含单人模式，繁体规则书全文转录，一盒四册按各册页码重排，见 `games/gwt-new-zealand.html`）

- [阿纳克遗迹：探险队长（Lost Ruins of Arnak: Expedition Leaders）](https://mp.weixin.qq.com/s/nEGzfRTol5gFHuc16sETPA) · 微信公众号「桌游怎么玩」所载官方简体中文规则书（Mín & Elwen 设计，CGE 出版/一刻馆代理发行，1–4 人扩展含单人变体，简体规则书全文转录，封面+页2–23+衬页按印刷页码重排，见 `games/arnak-expedition-leaders.html`）

- [CLANK! 地下墓穴：地下世界（Clank! Catacombs: Underworld）](https://mp.weixin.qq.com/s/rev2XGxuP-gsbYloNm-8bw) · 微信公众号「无忧桌游」所载官方简体中文规则书（Paul Dennen 设计，Dire Wolf 出品，2025 年《Clank! Catacombs》第二弹扩展，冥界守卫/命运牌/恶魔助手/鹰身女妖等新元素与固定空间、宽恕变体，简体规则书 4 页全文转录，页 29–32，前两页页脚均印「30」系原书排印如此，见 `games/clank-catacombs-underworld.html`）

- [CLANK! 冒险队（Clank!: Adventuring Party）](https://mp.weixin.qq.com/s/rev2XGxuP-gsbYloNm-8bw) · 微信公众号「无忧桌游」所载官方简体中文规则书（Paul Dennen 设计，Dire Wolf 出品，《CLANK!》5–6 人扩展，两种新玩家颜色、背包/王冠/万能钥匙与「反应(REACT)」「到达选择」新术语及专属角色，简体规则书 6 页全文转录（封底+页 34–38，角色录得四位，原帖未及其余角色页），见 `games/clank-adventuring-party.html`）

规则内容版权归原作者所有，本站仅作个人学习查阅。

<!-- BGG Top100 补全批次（官方英文规则书 AI 辅助全文翻译） -->
  - [瘟疫危机：传承·第一季（Pandemic Legacy: Season 1）](http://images-cdn.zmangames.com/us-east-1/filer_public/26/94/2694b3fb-c718-4f87-9bdd-bbea0fdadcbe/zm7172_pandemic_legacys1_red_rules.pdf) · 官方英文规则书全文 AI 辅助翻译（Z-Man Games (Asmodee)，见 `games/pandemic-legacy-season-1.html`）
  - [魔戒圣战（War of the Ring: Second Edition）](https://www.aresgames.eu/download/20980/) · 官方英文规则书全文 AI 辅助翻译（Ares Games，见 `games/war-of-the-ring.html`）
  - [星球大战：叛乱（Star Wars: Rebellion）](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/sw03_learn_to_play_web.pdf) · 官方英文规则书全文 AI 辅助翻译（Fantasy Flight Games (Asmodee)，见 `games/star-wars-rebellion.html`）
  - [杀戮尖塔：版图游戏（Slay the Spire: The Board Game）](https://contentiongames.com/_images/STS_KS_Rulebook.pdf) · 官方英文规则书全文 AI 辅助翻译（Contention Games，见 `games/slay-the-spire-bg.html`）
  - [冷战热斗（Twilight Struggle）](https://gmtwebsiteassets.s3.us-west-2.amazonaws.com/Twilight+Struggle+20th+Anniversary+HOF+Edition/Twilight+Struggle+20th+Ann_Rule+Book_WEB.pdf) · 官方英文规则书全文 AI 辅助翻译（GMT Games，见 `games/twilight-struggle.html`）
  - [魔戒：中土对决（The Lord of the Rings: Duel for Middle-earth）](https://cdn.svc.asmodee.net/production-rprod/storage/games/7-wonders-LOTR/rules/7dume-en01-rules-1725540544zdnes.pdf) · 官方英文规则书全文 AI 辅助翻译（Space Balloon Games (Ares Games 英文版)，见 `games/lotr-duel-for-middle-earth.html`）
  - [复仇女神号（Nemesis）](https://awakenrealms.com/images/download/Nemesis/ENG/RULEBOOK_280x280mm_bleed3mm_28pages_PRINT.pdf) · 官方英文规则书全文 AI 辅助翻译（Awaken Realms，见 `games/nemesis.html`）
  - [咔嚓！传承：收购公司（Clank! Legacy: Acquisitions Incorporated）](https://boardgamegeek.com/filepage/187231/clank-legacy-rulebook) · 官方英文规则书全文 AI 辅助翻译（Renegade Game Studios / Dire Wolf Digital，见 `games/clank-legacy.html`）
  - [诡镇奇谈：卡牌版（Arkham Horror: The Card Game）](https://images-cdn.fantasyflightgames.com/filer_public/0e/d0/0ed09507-1705-47ed-a630-cd15885cabb0/ahc100_rulebook-web.pdf) · 官方英文规则书全文 AI 辅助翻译（Fantasy Flight Games，见 `games/arkham-horror-lcg.html`）
  - [茂林源记（Root）](https://cdn.shopify.com/s/files/1/0106/0162/7706/files/Root_Base_Law_Oct_2025.pdf?v=1774903756) · 官方英文规则书全文 AI 辅助翻译（Leder Games，见 `games/root.html`）
  - [太多骨头（Too Many Bones）](https://www.dropbox.com/scl/fi/mwe9nv6bb68gtkkhgx04o/TMB-Rulebook.pdf?rlkey=1y2zxkqw7mpi98aljmaoipjzq&dl=1) · 官方英文规则书全文 AI 辅助翻译（Chip Theory Games，见 `games/too-many-bones.html`）
  - [魔骑士（Mage Knight Board Game）](https://eadn-wc03-13179282.nxedge.io/posters/repository/wizkids/MKUE%20Rulebook%20BOOKLET.pdf) · 官方英文规则书全文 AI 辅助翻译（WizKids，见 `games/mage-knight.html`）
  - [看板：电动汽车版（Kanban EV）](https://gamers-hq.de/media/pdf/73/e9/d6/Kanban-EV-Rules-v12-Preview.pdf) · 官方英文规则书全文 AI 辅助翻译（Eagle-Gryphon Games，见 `games/kanban-ev.html`）
  - [葡萄酒庄园（核心版）（Viticulture Essential Edition）](https://www.dropbox.com/sh/bpe1a3sfu73i34d/AABgk4UQuOSVnn1g4XmAPml_a?dl=0) · 官方英文规则书全文 AI 辅助翻译（Stonemaier Games，见 `games/viticulture.html`）
  - [弹指棋（Crokinole）](https://nationalcrokinoleassociation.com/wp-content/uploads/2026/05/NCA-Official-Rules-of-Crokinole.docx.pdf) · 官方英文规则书全文 AI 辅助翻译（NCA（无传统出版社），见 `games/crokinole.html`）
  - [仙境幽谷（Everdell）](https://boardgamegeek.com/filepage/176746/everdell-revised-2nd-printing-rulebook) · 官方英文规则书全文 AI 辅助翻译（Starling Games / Asmodee，见 `games/everdell.html`）
  - [车票之旅：传承·西部传奇（Ticket to Ride Legacy: Legends of the West）](https://cdn.svc.asmodee.net/staging-daysofwonder/uploads/2024/07/720036-T2RL-Rules-210x285-EN-compressed.pdf) · 官方英文规则书全文 AI 辅助翻译（Days of Wonder / Asmodee，见 `games/ticket-to-ride-legacy.html`）
  - [漫威群英传：卡牌版（Marvel Champions: The Card Game）](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mvc01_learn_to_play_eng-compressed.pdf) · 官方英文规则书全文 AI 辅助翻译（Fantasy Flight Games，见 `games/marvel-champions.html`）
  - [水下城市（Underwater Cities）](https://deliciousgames.org/image/catalog/rules/UnderwaterCities-rules-ENG-web.pdf) · 官方英文规则书全文 AI 辅助翻译（Delicious Games，见 `games/underwater-cities.html`）
  - [克苏鲁：死亡可能会死（Cthulhu: Death May Die）](https://resources.cmon.com/DMD_Rulebook_web.pdf) · 官方英文规则书全文 AI 辅助翻译（CMON，见 `games/cthulhu-death-may-die.html`）
  - [火星之上（On Mars）](https://drive.google.com/file/d/1FOlaSoODRpO15pNKkcmCbXx11Sl-Lq6L/view) · 官方英文规则书全文 AI 辅助翻译（Eagle-Gryphon Games，见 `games/on-mars.html`）
  - [瘟疫危机：传承·第0季（Pandemic Legacy: Season 0）](https://cdn.svc.asmodee.net/production-zman/uploads/2024/09/Legacy-Season-0-Rulebook.pdf) · 官方英文规则书全文 AI 辅助翻译（Z-Man Games (Asmodee)，见 `games/pandemic-legacy-season-0.html`）
  - [卡斯卡迪亚（Cascadia）](https://www.alderac.com/wp-content/uploads/2021/08/Cascadia-Rules.pdf) · 官方英文规则书全文 AI 辅助翻译（Flatout Games / Alderac Entertainment Group (AEG)，见 `games/cascadia.html`）
  - [血染钟楼（Blood on the Clocktower）](https://botclinks.page/MainRulebook) · 官方英文规则书全文 AI 辅助翻译（The Pandemonium Institute，见 `games/blood-on-the-clocktower.html`）
  - [守誓者：深入密林（Oathsworn: Into the Deepwood）](https://drive.google.com/file/d/1eUmHux5TOpkzpGDTyn1epZWFoK2jM-8m/view) · 官方英文规则书全文 AI 辅助翻译（Shadowborne Games，见 `games/oathsworn.html`）
  - [里斯本（Lisboa）](https://www.tlamagames.com/user/documents/upload/Lisboa/Lisboa%20rulebook%20v3.pdf) · 官方英文规则书全文 AI 辅助翻译（Eagle-Gryphon Games，见 `games/lisboa.html`）
  - [瘟疫危机：传承·第二季（Pandemic Legacy: Season 2）](https://cdn.svc.asmodee.net/production-zman/uploads/2024/09/pandemic_legacy_season_2_rules.pdf) · 官方英文规则书全文 AI 辅助翻译（Z-Man Games (Asmodee)，见 `games/pandemic-legacy-season-2.html`）
  - [卓尔金历：玛雅历法（Tzolk'in: The Mayan Calendar）](https://filemanager.czechgames.com/storage/files/tzolkin-the-mayan-calendar/rules/TZ_rules_EN_13.pdf) · 官方英文规则书全文 AI 辅助翻译（Czech Games Edition (CGE)，见 `games/tzolkin.html`）
  - [疯狂诡宅（第二版）（Mansions of Madness: Second Edition）](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mansions_of_madness_second_edition_learn_to_play.pdf) · 官方英文规则书全文 AI 辅助翻译（Fantasy Flight Games (Asmodee)，见 `games/mansions-of-madness-2e.html`）
  - [奎德林堡的江湖郎中（Quacks）](https://www.schmidtspiele.de/files/Retail/72dpi_PNG/88220_Quack_rules_english_2024.pdf) · 官方英文规则书全文 AI 辅助翻译（Schmidt Spiele，见 `games/quacks.html`）
  - [西王国的圣骑士（Paladins of the West Kingdom）](https://cdn.shopify.com/s/files/1/0713/4622/5238/files/PaladinsRulebook.pdf) · 官方英文规则书全文 AI 辅助翻译（Garphill Games，见 `games/paladins-of-the-west-kingdom.html`）
  - [勒阿弗尔（Le Havre）](https://www.lookout-spiele.de/upload/en_lehavre.html_Rules_LeHavre-2016_EN.pdf) · 官方英文规则书全文 AI 辅助翻译（Lookout Games，见 `games/le-havre.html`）
  - [安卓：潜袭（Android: Netrunner）](https://images-cdn.fantasyflightgames.com/ffg_content/android-netrunner/support/android-netrunner-core-rules.pdf) · 官方英文规则书全文 AI 辅助翻译（Fantasy Flight Games，见 `games/android-netrunner.html`）
  - [画商（The Gallerist）](http://www.skellig-rules.de/rules/0073-0001/The_Gallerist_rulebook_English%2072dpi.pdf) · 官方英文规则书全文 AI 辅助翻译（Eagle-Gryphon Games，见 `games/the-gallerist.html`）
  - [拆弹小队（Bomb Busters）](https://content.cmpl.org/bg/BombBusters.pdf) · 官方英文规则书全文 AI 辅助翻译（iello，见 `games/bomb-busters.html`）
  - [农场主（修订版）（Agricola (Revised Edition)）](https://www.lookout-spiele.de/upload/en_agricolare.html_Rules_Agricola-RE_EN.pdf) · 官方英文规则书全文 AI 辅助翻译（Lookout Games，见 `games/agricola-revised.html`）
  - [星球大战：帝国突击（Star Wars: Imperial Assault）](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/swi01_learn_to_play_v17.pdf) · 官方英文规则书全文 AI 辅助翻译（Fantasy Flight Games，见 `games/star-wars-imperial-assault.html`）
  - [展翅翱翔：亚洲（Wingspan Asia）](https://stonemaiergames.com/games/wingspan/rules/) · 官方英文规则书全文 AI 辅助翻译（Stonemaier Games，见 `games/wingspan-asia.html`）
  - [机甲大战小兵（Mechs vs. Minions）](https://boardgamegeek.com/filepage/143267/english-rulebook-for-wave-2) · 官方英文规则书全文 AI 辅助翻译（Riot Games，见 `games/mechs-vs-minions.html`）
  - [最终女孩（Final Girl）](https://cdn.shopify.com/s/files/1/0593/6984/8897/files/FinalGirl_Rules_ff324b01-6f74-43e0-90e2-1685594703d5.pdf) · 官方英文规则书全文 AI 辅助翻译（Van Ryder Games，见 `games/final-girl.html`）
  - [星际探险队：第九行星（The Crew: The Quest for Planet Nine）](https://cdn.shopify.com/s/files/1/0104/6331/3977/files/691868_Crew_Manual.pdf) · 官方英文规则书全文 AI 辅助翻译（Thames & Kosmos，见 `games/the-crew-planet-nine.html`）
  - [五大部落（Five Tribes: The Djinns of Naqala）](https://cdn.svc.asmodee.net/production-daysofwonder/uploads/2024/07/8401-FT-Rules-EN.pdf) · 官方英文规则书全文 AI 辅助翻译（Days of Wonder，见 `games/five-tribes.html`）

<!-- BGG Top100 补全批次（官方英文规则书 AI 辅助全文翻译） -->
  - [瘟疫危机：传承·第一季（Pandemic Legacy: Season 1）](http://images-cdn.zmangames.com/us-east-1/filer_public/26/94/2694b3fb-c718-4f87-9bdd-bbea0fdadcbe/zm7172_pandemic_legacys1_red_rules.pdf) · 官方英文规则书全文 AI 辅助翻译（Z-Man Games (Asmodee)，见 `games/pandemic-legacy-season-1.html`）
  - [魔戒圣战（War of the Ring: Second Edition）](https://www.aresgames.eu/download/20980/) · 官方英文规则书全文 AI 辅助翻译（Ares Games，见 `games/war-of-the-ring.html`）
  - [星球大战：叛乱（Star Wars: Rebellion）](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/sw03_learn_to_play_web.pdf) · 官方英文规则书全文 AI 辅助翻译（Fantasy Flight Games (Asmodee)，见 `games/star-wars-rebellion.html`）
  - [杀戮尖塔：版图游戏（Slay the Spire: The Board Game）](https://contentiongames.com/_images/STS_KS_Rulebook.pdf) · 官方英文规则书全文 AI 辅助翻译（Contention Games，见 `games/slay-the-spire-bg.html`）
  - [冷战热斗（Twilight Struggle）](https://gmtwebsiteassets.s3.us-west-2.amazonaws.com/Twilight+Struggle+20th+Anniversary+HOF+Edition/Twilight+Struggle+20th+Ann_Rule+Book_WEB.pdf) · 官方英文规则书全文 AI 辅助翻译（GMT Games，见 `games/twilight-struggle.html`）
  - [魔戒：中土对决（The Lord of the Rings: Duel for Middle-earth）](https://cdn.svc.asmodee.net/production-rprod/storage/games/7-wonders-LOTR/rules/7dume-en01-rules-1725540544zdnes.pdf) · 官方英文规则书全文 AI 辅助翻译（Space Balloon Games (Ares Games 英文版)，见 `games/lotr-duel-for-middle-earth.html`）
  - [星蚀：银河二次黎明（Eclipse: Second Dawn for the Galaxy）](https://cdn.1j1ju.com/medias/bb/af/07-eclipse-second-dawn-for-the-galaxy-rulebook.pdf) · 官方英文规则书全文 AI 辅助翻译（Lautapelit.fi，见 `games/eclipse-second-dawn.html`）
  - [复仇女神号（Nemesis）](https://awakenrealms.com/images/download/Nemesis/ENG/RULEBOOK_280x280mm_bleed3mm_28pages_PRINT.pdf) · 官方英文规则书全文 AI 辅助翻译（Awaken Realms，见 `games/nemesis.html`）
  - [咔嚓！传承：收购公司（Clank! Legacy: Acquisitions Incorporated）](https://boardgamegeek.com/filepage/187231/clank-legacy-rulebook) · 官方英文规则书全文 AI 辅助翻译（Renegade Game Studios / Dire Wolf Digital，见 `games/clank-legacy.html`）
  - [诡镇奇谈：卡牌版（Arkham Horror: The Card Game）](https://images-cdn.fantasyflightgames.com/filer_public/0e/d0/0ed09507-1705-47ed-a630-cd15885cabb0/ahc100_rulebook-web.pdf) · 官方英文规则书全文 AI 辅助翻译（Fantasy Flight Games，见 `games/arkham-horror-lcg.html`）
  - [茂林源记（Root）](https://cdn.shopify.com/s/files/1/0106/0162/7706/files/Root_Base_Law_Oct_2025.pdf?v=1774903756) · 官方英文规则书全文 AI 辅助翻译（Leder Games，见 `games/root.html`）
  - [太多骨头（Too Many Bones）](https://www.dropbox.com/scl/fi/mwe9nv6bb68gtkkhgx04o/TMB-Rulebook.pdf?rlkey=1y2zxkqw7mpi98aljmaoipjzq&dl=1) · 官方英文规则书全文 AI 辅助翻译（Chip Theory Games，见 `games/too-many-bones.html`）
  - [魔骑士（Mage Knight Board Game）](https://eadn-wc03-13179282.nxedge.io/posters/repository/wizkids/MKUE%20Rulebook%20BOOKLET.pdf) · 官方英文规则书全文 AI 辅助翻译（WizKids，见 `games/mage-knight.html`）
  - [看板：电动汽车版（Kanban EV）](https://gamers-hq.de/media/pdf/73/e9/d6/Kanban-EV-Rules-v12-Preview.pdf) · 官方英文规则书全文 AI 辅助翻译（Eagle-Gryphon Games，见 `games/kanban-ev.html`）
  - [葡萄酒庄园（核心版）（Viticulture Essential Edition）](https://www.dropbox.com/sh/bpe1a3sfu73i34d/AABgk4UQuOSVnn1g4XmAPml_a?dl=0) · 官方英文规则书全文 AI 辅助翻译（Stonemaier Games，见 `games/viticulture.html`）
  - [弹指棋（Crokinole）](https://nationalcrokinoleassociation.com/wp-content/uploads/2026/05/NCA-Official-Rules-of-Crokinole.docx.pdf) · 官方英文规则书全文 AI 辅助翻译（NCA（无传统出版社），见 `games/crokinole.html`）
  - [仙境幽谷（Everdell）](https://boardgamegeek.com/filepage/176746/everdell-revised-2nd-printing-rulebook) · 官方英文规则书全文 AI 辅助翻译（Starling Games / Asmodee，见 `games/everdell.html`）
  - [车票之旅：传承·西部传奇（Ticket to Ride Legacy: Legends of the West）](https://cdn.svc.asmodee.net/staging-daysofwonder/uploads/2024/07/720036-T2RL-Rules-210x285-EN-compressed.pdf) · 官方英文规则书全文 AI 辅助翻译（Days of Wonder / Asmodee，见 `games/ticket-to-ride-legacy.html`）
  - [漫威群英传：卡牌版（Marvel Champions: The Card Game）](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mvc01_learn_to_play_eng-compressed.pdf) · 官方英文规则书全文 AI 辅助翻译（Fantasy Flight Games，见 `games/marvel-champions.html`）
  - [水下城市（Underwater Cities）](https://deliciousgames.org/image/catalog/rules/UnderwaterCities-rules-ENG-web.pdf) · 官方英文规则书全文 AI 辅助翻译（Delicious Games，见 `games/underwater-cities.html`）
  - [克苏鲁：死亡可能会死（Cthulhu: Death May Die）](https://resources.cmon.com/DMD_Rulebook_web.pdf) · 官方英文规则书全文 AI 辅助翻译（CMON，见 `games/cthulhu-death-may-die.html`）
  - [火星之上（On Mars）](https://drive.google.com/file/d/1FOlaSoODRpO15pNKkcmCbXx11Sl-Lq6L/view) · 官方英文规则书全文 AI 辅助翻译（Eagle-Gryphon Games，见 `games/on-mars.html`）
  - [瘟疫危机：传承·第0季（Pandemic Legacy: Season 0）](https://cdn.svc.asmodee.net/production-zman/uploads/2024/09/Legacy-Season-0-Rulebook.pdf) · 官方英文规则书全文 AI 辅助翻译（Z-Man Games (Asmodee)，见 `games/pandemic-legacy-season-0.html`）
  - [卡斯卡迪亚（Cascadia）](https://www.alderac.com/wp-content/uploads/2021/08/Cascadia-Rules.pdf) · 官方英文规则书全文 AI 辅助翻译（Flatout Games / Alderac Entertainment Group (AEG)，见 `games/cascadia.html`）
  - [血染钟楼（Blood on the Clocktower）](https://botclinks.page/MainRulebook) · 官方英文规则书全文 AI 辅助翻译（The Pandemonium Institute，见 `games/blood-on-the-clocktower.html`）
  - [守誓者：深入密林（Oathsworn: Into the Deepwood）](https://drive.google.com/file/d/1eUmHux5TOpkzpGDTyn1epZWFoK2jM-8m/view) · 官方英文规则书全文 AI 辅助翻译（Shadowborne Games，见 `games/oathsworn.html`）
  - [里斯本（Lisboa）](https://www.tlamagames.com/user/documents/upload/Lisboa/Lisboa%20rulebook%20v3.pdf) · 官方英文规则书全文 AI 辅助翻译（Eagle-Gryphon Games，见 `games/lisboa.html`）
  - [瘟疫危机：传承·第二季（Pandemic Legacy: Season 2）](https://cdn.svc.asmodee.net/production-zman/uploads/2024/09/pandemic_legacy_season_2_rules.pdf) · 官方英文规则书全文 AI 辅助翻译（Z-Man Games (Asmodee)，见 `games/pandemic-legacy-season-2.html`）
  - [沉睡之神（Sleeping Gods）](https://www.dropbox.com/scl/fi/uznxgogk2ccpscosd37xh/Sleeping-Gods-Rulebook_updated.pdf?rlkey=9umbfocntldl0vqzsm0rr3hut&dl=1) · 官方英文规则书全文 AI 辅助翻译（Red Raven Games，见 `games/sleeping-gods.html`）
  - [卓尔金历：玛雅历法（Tzolk'in: The Mayan Calendar）](https://filemanager.czechgames.com/storage/files/tzolkin-the-mayan-calendar/rules/TZ_rules_EN_13.pdf) · 官方英文规则书全文 AI 辅助翻译（Czech Games Edition (CGE)，见 `games/tzolkin.html`）
  - [疯狂诡宅（第二版）（Mansions of Madness: Second Edition）](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mansions_of_madness_second_edition_learn_to_play.pdf) · 官方英文规则书全文 AI 辅助翻译（Fantasy Flight Games (Asmodee)，见 `games/mansions-of-madness-2e.html`）
  - [虚空坠落（Voidfall）](https://mindclashgames.com/wp-content/uploads/2023/03/VOIDFALL-Rulebook-websafe.pdf) · 官方英文规则书全文 AI 辅助翻译（Mindclash Games，见 `games/voidfall.html`）
  - [奎德林堡的江湖郎中（Quacks）](https://www.schmidtspiele.de/files/Retail/72dpi_PNG/88220_Quack_rules_english_2024.pdf) · 官方英文规则书全文 AI 辅助翻译（Schmidt Spiele，见 `games/quacks.html`）
  - [西王国的圣骑士（Paladins of the West Kingdom）](https://cdn.shopify.com/s/files/1/0713/4622/5238/files/PaladinsRulebook.pdf) · 官方英文规则书全文 AI 辅助翻译（Garphill Games，见 `games/paladins-of-the-west-kingdom.html`）
  - [勒阿弗尔（Le Havre）](https://www.lookout-spiele.de/upload/en_lehavre.html_Rules_LeHavre-2016_EN.pdf) · 官方英文规则书全文 AI 辅助翻译（Lookout Games，见 `games/le-havre.html`）
  - [安卓：潜袭（Android: Netrunner）](https://images-cdn.fantasyflightgames.com/ffg_content/android-netrunner/support/android-netrunner-core-rules.pdf) · 官方英文规则书全文 AI 辅助翻译（Fantasy Flight Games，见 `games/android-netrunner.html`）
  - [画商（The Gallerist）](http://www.skellig-rules.de/rules/0073-0001/The_Gallerist_rulebook_English%2072dpi.pdf) · 官方英文规则书全文 AI 辅助翻译（Eagle-Gryphon Games，见 `games/the-gallerist.html`）
  - [拆弹小队（Bomb Busters）](https://content.cmpl.org/bg/BombBusters.pdf) · 官方英文规则书全文 AI 辅助翻译（iello，见 `games/bomb-busters.html`）
  - [农场主（修订版）（Agricola (Revised Edition)）](https://www.lookout-spiele.de/upload/en_agricolare.html_Rules_Agricola-RE_EN.pdf) · 官方英文规则书全文 AI 辅助翻译（Lookout Games，见 `games/agricola-revised.html`）
  - [星球大战：帝国突击（Star Wars: Imperial Assault）](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/swi01_learn_to_play_v17.pdf) · 官方英文规则书全文 AI 辅助翻译（Fantasy Flight Games，见 `games/star-wars-imperial-assault.html`）
  - [展翅翱翔：亚洲（Wingspan Asia）](https://stonemaiergames.com/games/wingspan/rules/) · 官方英文规则书全文 AI 辅助翻译（Stonemaier Games，见 `games/wingspan-asia.html`）
  - [机甲大战小兵（Mechs vs. Minions）](https://boardgamegeek.com/filepage/143267/english-rulebook-for-wave-2) · 官方英文规则书全文 AI 辅助翻译（Riot Games，见 `games/mechs-vs-minions.html`）
  - [最终女孩（Final Girl）](https://cdn.shopify.com/s/files/1/0593/6984/8897/files/FinalGirl_Rules_ff324b01-6f74-43e0-90e2-1685594703d5.pdf) · 官方英文规则书全文 AI 辅助翻译（Van Ryder Games，见 `games/final-girl.html`）
  - [星际探险队：第九行星（The Crew: The Quest for Planet Nine）](https://cdn.shopify.com/s/files/1/0104/6331/3977/files/691868_Crew_Manual.pdf) · 官方英文规则书全文 AI 辅助翻译（Thames & Kosmos，见 `games/the-crew-planet-nine.html`）
  - [五大部落（Five Tribes: The Djinns of Naqala）](https://cdn.svc.asmodee.net/production-daysofwonder/uploads/2024/07/8401-FT-Rules-EN.pdf) · 官方英文规则书全文 AI 辅助翻译（Days of Wonder，见 `games/five-tribes.html`）

<!-- BGG Top100 补全批次（官方英文规则书 AI 辅助全文翻译） -->
  - [瘟疫危机：传承·第一季（Pandemic Legacy: Season 1）](http://images-cdn.zmangames.com/us-east-1/filer_public/26/94/2694b3fb-c718-4f87-9bdd-bbea0fdadcbe/zm7172_pandemic_legacys1_red_rules.pdf) · 官方英文规则书全文 AI 辅助翻译（Z-Man Games (Asmodee)，见 `games/pandemic-legacy-season-1.html`）
  - [幽港迷城（Gloomhaven）](https://drive.google.com/file/d/16TmmCKa6zVVObj2qM-vIj9RcEAC3nfMT/view) · 官方英文规则书全文 AI 辅助翻译（Cephalofair Games，见 `games/gloomhaven.html`）
  - [魔戒圣战（War of the Ring: Second Edition）](https://www.aresgames.eu/download/20980/) · 官方英文规则书全文 AI 辅助翻译（Ares Games，见 `games/war-of-the-ring.html`）
  - [星球大战：叛乱（Star Wars: Rebellion）](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/sw03_learn_to_play_web.pdf) · 官方英文规则书全文 AI 辅助翻译（Fantasy Flight Games (Asmodee)，见 `games/star-wars-rebellion.html`）
  - [幽港迷城：雄狮之颚（Gloomhaven: Jaws of the Lion）](https://cdn.1j1ju.com/medias/c1/6f/d7-gloomhaven-jaws-of-the-lion-rulebook.pdf) · 官方英文规则书全文 AI 辅助翻译（Cephalofair Games，见 `games/gloomhaven-jaws-of-the-lion.html`）
  - [杀戮尖塔：版图游戏（Slay the Spire: The Board Game）](https://contentiongames.com/_images/STS_KS_Rulebook.pdf) · 官方英文规则书全文 AI 辅助翻译（Contention Games，见 `games/slay-the-spire-bg.html`）
  - [冷战热斗（Twilight Struggle）](https://gmtwebsiteassets.s3.us-west-2.amazonaws.com/Twilight+Struggle+20th+Anniversary+HOF+Edition/Twilight+Struggle+20th+Ann_Rule+Book_WEB.pdf) · 官方英文规则书全文 AI 辅助翻译（GMT Games，见 `games/twilight-struggle.html`）
  - [魔戒：中土对决（The Lord of the Rings: Duel for Middle-earth）](https://cdn.svc.asmodee.net/production-rprod/storage/games/7-wonders-LOTR/rules/7dume-en01-rules-1725540544zdnes.pdf) · 官方英文规则书全文 AI 辅助翻译（Space Balloon Games (Ares Games 英文版)，见 `games/lotr-duel-for-middle-earth.html`）
  - [寒霜迷城（Frosthaven）](https://gusandco.net/wp-content/uploads/2023/06/fh-rule-book.pdf) · 官方英文规则书全文 AI 辅助翻译（Cephalofair Games，见 `games/frosthaven.html`）
  - [星蚀：银河二次黎明（Eclipse: Second Dawn for the Galaxy）](https://cdn.1j1ju.com/medias/bb/af/07-eclipse-second-dawn-for-the-galaxy-rulebook.pdf) · 官方英文规则书全文 AI 辅助翻译（Lautapelit.fi，见 `games/eclipse-second-dawn.html`）
  - [复仇女神号（Nemesis）](https://awakenrealms.com/images/download/Nemesis/ENG/RULEBOOK_280x280mm_bleed3mm_28pages_PRINT.pdf) · 官方英文规则书全文 AI 辅助翻译（Awaken Realms，见 `games/nemesis.html`）
  - [咔嚓！传承：收购公司（Clank! Legacy: Acquisitions Incorporated）](https://boardgamegeek.com/filepage/187231/clank-legacy-rulebook) · 官方英文规则书全文 AI 辅助翻译（Renegade Game Studios / Dire Wolf Digital，见 `games/clank-legacy.html`）
  - [诡镇奇谈：卡牌版（Arkham Horror: The Card Game）](https://images-cdn.fantasyflightgames.com/filer_public/0e/d0/0ed09507-1705-47ed-a630-cd15885cabb0/ahc100_rulebook-web.pdf) · 官方英文规则书全文 AI 辅助翻译（Fantasy Flight Games，见 `games/arkham-horror-lcg.html`）
  - [茂林源记（Root）](https://cdn.shopify.com/s/files/1/0106/0162/7706/files/Root_Base_Law_Oct_2025.pdf?v=1774903756) · 官方英文规则书全文 AI 辅助翻译（Leder Games，见 `games/root.html`）
  - [太多骨头（Too Many Bones）](https://www.dropbox.com/scl/fi/mwe9nv6bb68gtkkhgx04o/TMB-Rulebook.pdf?rlkey=1y2zxkqw7mpi98aljmaoipjzq&dl=1) · 官方英文规则书全文 AI 辅助翻译（Chip Theory Games，见 `games/too-many-bones.html`）
  - [魔骑士（Mage Knight Board Game）](https://eadn-wc03-13179282.nxedge.io/posters/repository/wizkids/MKUE%20Rulebook%20BOOKLET.pdf) · 官方英文规则书全文 AI 辅助翻译（WizKids，见 `games/mage-knight.html`）
  - [看板：电动汽车版（Kanban EV）](https://gamers-hq.de/media/pdf/73/e9/d6/Kanban-EV-Rules-v12-Preview.pdf) · 官方英文规则书全文 AI 辅助翻译（Eagle-Gryphon Games，见 `games/kanban-ev.html`）
  - [葡萄酒庄园（核心版）（Viticulture Essential Edition）](https://www.dropbox.com/sh/bpe1a3sfu73i34d/AABgk4UQuOSVnn1g4XmAPml_a?dl=0) · 官方英文规则书全文 AI 辅助翻译（Stonemaier Games，见 `games/viticulture.html`）
  - [弹指棋（Crokinole）](https://nationalcrokinoleassociation.com/wp-content/uploads/2026/05/NCA-Official-Rules-of-Crokinole.docx.pdf) · 官方英文规则书全文 AI 辅助翻译（NCA（无传统出版社），见 `games/crokinole.html`）
  - [仙境幽谷（Everdell）](https://boardgamegeek.com/filepage/176746/everdell-revised-2nd-printing-rulebook) · 官方英文规则书全文 AI 辅助翻译（Starling Games / Asmodee，见 `games/everdell.html`）
  - [车票之旅：传承·西部传奇（Ticket to Ride Legacy: Legends of the West）](https://cdn.svc.asmodee.net/staging-daysofwonder/uploads/2024/07/720036-T2RL-Rules-210x285-EN-compressed.pdf) · 官方英文规则书全文 AI 辅助翻译（Days of Wonder / Asmodee，见 `games/ticket-to-ride-legacy.html`）
  - [漫威群英传：卡牌版（Marvel Champions: The Card Game）](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mvc01_learn_to_play_eng-compressed.pdf) · 官方英文规则书全文 AI 辅助翻译（Fantasy Flight Games，见 `games/marvel-champions.html`）
  - [水下城市（Underwater Cities）](https://deliciousgames.org/image/catalog/rules/UnderwaterCities-rules-ENG-web.pdf) · 官方英文规则书全文 AI 辅助翻译（Delicious Games，见 `games/underwater-cities.html`）
  - [克苏鲁：死亡可能会死（Cthulhu: Death May Die）](https://resources.cmon.com/DMD_Rulebook_web.pdf) · 官方英文规则书全文 AI 辅助翻译（CMON，见 `games/cthulhu-death-may-die.html`）
  - [火星之上（On Mars）](https://drive.google.com/file/d/1FOlaSoODRpO15pNKkcmCbXx11Sl-Lq6L/view) · 官方英文规则书全文 AI 辅助翻译（Eagle-Gryphon Games，见 `games/on-mars.html`）
  - [瘟疫危机：传承·第0季（Pandemic Legacy: Season 0）](https://cdn.svc.asmodee.net/production-zman/uploads/2024/09/Legacy-Season-0-Rulebook.pdf) · 官方英文规则书全文 AI 辅助翻译（Z-Man Games (Asmodee)，见 `games/pandemic-legacy-season-0.html`）
  - [卡斯卡迪亚（Cascadia）](https://www.alderac.com/wp-content/uploads/2021/08/Cascadia-Rules.pdf) · 官方英文规则书全文 AI 辅助翻译（Flatout Games / Alderac Entertainment Group (AEG)，见 `games/cascadia.html`）
  - [血染钟楼（Blood on the Clocktower）](https://botclinks.page/MainRulebook) · 官方英文规则书全文 AI 辅助翻译（The Pandemonium Institute，见 `games/blood-on-the-clocktower.html`）
  - [守誓者：深入密林（Oathsworn: Into the Deepwood）](https://drive.google.com/file/d/1eUmHux5TOpkzpGDTyn1epZWFoK2jM-8m/view) · 官方英文规则书全文 AI 辅助翻译（Shadowborne Games，见 `games/oathsworn.html`）
  - [里斯本（Lisboa）](https://www.tlamagames.com/user/documents/upload/Lisboa/Lisboa%20rulebook%20v3.pdf) · 官方英文规则书全文 AI 辅助翻译（Eagle-Gryphon Games，见 `games/lisboa.html`）
  - [瘟疫危机：传承·第二季（Pandemic Legacy: Season 2）](https://cdn.svc.asmodee.net/production-zman/uploads/2024/09/pandemic_legacy_season_2_rules.pdf) · 官方英文规则书全文 AI 辅助翻译（Z-Man Games (Asmodee)，见 `games/pandemic-legacy-season-2.html`）
  - [沉睡之神（Sleeping Gods）](https://www.dropbox.com/scl/fi/uznxgogk2ccpscosd37xh/Sleeping-Gods-Rulebook_updated.pdf?rlkey=9umbfocntldl0vqzsm0rr3hut&dl=1) · 官方英文规则书全文 AI 辅助翻译（Red Raven Games，见 `games/sleeping-gods.html`）
  - [卓尔金历：玛雅历法（Tzolk'in: The Mayan Calendar）](https://filemanager.czechgames.com/storage/files/tzolkin-the-mayan-calendar/rules/TZ_rules_EN_13.pdf) · 官方英文规则书全文 AI 辅助翻译（Czech Games Edition (CGE)，见 `games/tzolkin.html`）
  - [疯狂诡宅（第二版）（Mansions of Madness: Second Edition）](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mansions_of_madness_second_edition_learn_to_play.pdf) · 官方英文规则书全文 AI 辅助翻译（Fantasy Flight Games (Asmodee)，见 `games/mansions-of-madness-2e.html`）
  - [虚空坠落（Voidfall）](https://mindclashgames.com/wp-content/uploads/2023/03/VOIDFALL-Rulebook-websafe.pdf) · 官方英文规则书全文 AI 辅助翻译（Mindclash Games，见 `games/voidfall.html`）
  - [奎德林堡的江湖郎中（Quacks）](https://www.schmidtspiele.de/files/Retail/72dpi_PNG/88220_Quack_rules_english_2024.pdf) · 官方英文规则书全文 AI 辅助翻译（Schmidt Spiele，见 `games/quacks.html`）
  - [西王国的圣骑士（Paladins of the West Kingdom）](https://cdn.shopify.com/s/files/1/0713/4622/5238/files/PaladinsRulebook.pdf) · 官方英文规则书全文 AI 辅助翻译（Garphill Games，见 `games/paladins-of-the-west-kingdom.html`）
  - [勒阿弗尔（Le Havre）](https://www.lookout-spiele.de/upload/en_lehavre.html_Rules_LeHavre-2016_EN.pdf) · 官方英文规则书全文 AI 辅助翻译（Lookout Games，见 `games/le-havre.html`）
  - [安卓：潜袭（Android: Netrunner）](https://images-cdn.fantasyflightgames.com/ffg_content/android-netrunner/support/android-netrunner-core-rules.pdf) · 官方英文规则书全文 AI 辅助翻译（Fantasy Flight Games，见 `games/android-netrunner.html`）
  - [画商（The Gallerist）](http://www.skellig-rules.de/rules/0073-0001/The_Gallerist_rulebook_English%2072dpi.pdf) · 官方英文规则书全文 AI 辅助翻译（Eagle-Gryphon Games，见 `games/the-gallerist.html`）
  - [拆弹小队（Bomb Busters）](https://content.cmpl.org/bg/BombBusters.pdf) · 官方英文规则书全文 AI 辅助翻译（iello，见 `games/bomb-busters.html`）
  - [农场主（修订版）（Agricola (Revised Edition)）](https://www.lookout-spiele.de/upload/en_agricolare.html_Rules_Agricola-RE_EN.pdf) · 官方英文规则书全文 AI 辅助翻译（Lookout Games，见 `games/agricola-revised.html`）
  - [星球大战：帝国突击（Star Wars: Imperial Assault）](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/swi01_learn_to_play_v17.pdf) · 官方英文规则书全文 AI 辅助翻译（Fantasy Flight Games，见 `games/star-wars-imperial-assault.html`）
  - [展翅翱翔：亚洲（Wingspan Asia）](https://stonemaiergames.com/games/wingspan/rules/) · 官方英文规则书全文 AI 辅助翻译（Stonemaier Games，见 `games/wingspan-asia.html`）
  - [机甲大战小兵（Mechs vs. Minions）](https://boardgamegeek.com/filepage/143267/english-rulebook-for-wave-2) · 官方英文规则书全文 AI 辅助翻译（Riot Games，见 `games/mechs-vs-minions.html`）
  - [最终女孩（Final Girl）](https://cdn.shopify.com/s/files/1/0593/6984/8897/files/FinalGirl_Rules_ff324b01-6f74-43e0-90e2-1685594703d5.pdf) · 官方英文规则书全文 AI 辅助翻译（Van Ryder Games，见 `games/final-girl.html`）
  - [星际探险队：第九行星（The Crew: The Quest for Planet Nine）](https://cdn.shopify.com/s/files/1/0104/6331/3977/files/691868_Crew_Manual.pdf) · 官方英文规则书全文 AI 辅助翻译（Thames & Kosmos，见 `games/the-crew-planet-nine.html`）
  - [五大部落（Five Tribes: The Djinns of Naqala）](https://cdn.svc.asmodee.net/production-daysofwonder/uploads/2024/07/8401-FT-Rules-EN.pdf) · 官方英文规则书全文 AI 辅助翻译（Days of Wonder，见 `games/five-tribes.html`）
