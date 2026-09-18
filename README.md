# 桌游规则书

纯静态桌游规则查询网站 + Go 用户服务。静态部分无构建步骤、无外部依赖（不用 CDN 字体/JS 库），把整个目录丢到任意静态服务器即可运行，支持手机浏览；`server/` 下的 rules-api 提供注册登录与游戏收藏（已有/想买/想玩）。

## 目录结构

```
rules/
├── index.html               # 首页（全部游戏统一目录 + 搜索）
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
│   ├── js/account.js        # 登录态 + 收藏交互（全站引用）
│   ├── js/bga-index.js      # BGA 游戏索引（构建产物，首页搜索用）
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
│   └── wire-account.mjs     # 给游戏页幂等注入 data-game-key + account.js
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
- **生产部署**（腾讯云服务器）：二进制 `/opt/rules-api/rules-api`，数据 `/opt/rules-api/data/rules.db`，systemd 单元 `rules-api.service`（仅监听 127.0.0.1:8787）；nginx `/etc/nginx/conf.d/rule.conf` 的 443 块将 `location /api/` 反代至该端口。一次性引导见 `server/deploy/bootstrap.sh`（幂等）。
- **日常发版**：`deploy.yml` 全自动——交叉编译 → rsync 静态（排除 `server/`）→ scp 二进制 → 重启服务 → 验证 `https://zhibinai.cn/api/health`。
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
- [方舟动物园（Ark Nova）](https://mp.weixin.qq.com/s/F_CRdbW-HPnsSNYDQm8vhw) · 微信公众号「桌游怎么玩」（游人码头官方中文规则书全文转录，覆盖原 BGA wiki 机翻页，见 `games/bga/arknova.html`）
- [方舟动物园：海洋世界（Ark Nova: Marine Worlds）](https://mp.weixin.qq.com/s/CEQf5aa0KbUTwRtjAgg_QA) · 微信公众号「桌游怎么玩」（扩展官方中文规则书+随书术语表/图标概览全文转录，见 `games/ark-nova-marine-worlds.html`）
- [大创造时代（Age of Innovation）](https://mp.weixin.qq.com/s/g4Hbz6PNH9wXF1KnnIwqfQ) · 微信公众号「桌游怎么玩」（神秘大地系列，陈斌华非官方简体中文规则书全文转录，覆盖原 BGA wiki 机翻页，见 `games/bga/ageofinnovation.html`）
- [地下酒吧（Speakeasy）](https://mp.weixin.qq.com/s/rd8TwTQ70XzUmEGOD9h1Lg) · 微信公众号「桌游怎么玩」（Vital Lacerda 作品，陈斌华中文规则书全文转录，见 `games/speakeasy.html`）
- [电力公司（Power Grid）](https://mp.weixin.qq.com/s/BIVeveLX6kIYAHX9qqZntw) · 微信公众号「白马公子」（中文规则书全文转录，附中国/韩国地图扩展规则与资源表，见 `games/power-grid.html`）
- [SETI：寻找外星人（SETI: Search for Extraterrestrial Intelligence）](https://mp.weixin.qq.com/s/GhvVuSu4sZ7t4qG1jQfHhA) · 微信公众号「桌游怎么玩」（[上篇 1–14](https://mp.weixin.qq.com/s/GhvVuSu4sZ7t4qG1jQfHhA) / [下篇 15–28](https://mp.weixin.qq.com/s/dsypcaYiXezRAdvcCrifjQ)，CGE 作品，陈斌华中文规则书全文转录，含单人游戏规则与 FAQ，见 `games/seti.html`）
- [奋进号：深海（Endeavor: Deep Sea）](https://mp.weixin.qq.com/s/wsGWL0IV3MMCTjv9A2xTvQ) · 微信公众号「张憬泽」（Burnt Island Games / Grand Gamers Guild 作品，张憬泽中文翻译&排版，16 页扫描图全文转录，含合作/单人模式，见 `games/endeavor-deep-sea.html`）
- [卡坦岛（Catan）](https://mp.weixin.qq.com/s/NZg9R3WGyv07Y4ATOtsBRw) · 微信公众号「无忧桌游」（KOSMOS《卡坦：基礎》官方中文规则书全文转录，遊戲說明單張＋遊戲規則冊（繁体）＋玩家手冊（简体），覆盖原 BGA wiki 机翻页，见 `games/bga/catan.html`）
- [埃多拉的德鲁伊（The Druids of Edora）](games/druids-of-edora.html) · 玩家社群流传扫描件（Stefan Feld 作品，alea / Ravensburger 出版，陈斌华中文翻译&排版，现收录前 8 页全文转录，第 9 页起待补充，见 `games/druids-of-edora.html`）

规则内容版权归原作者所有，本站仅作个人学习查阅。
