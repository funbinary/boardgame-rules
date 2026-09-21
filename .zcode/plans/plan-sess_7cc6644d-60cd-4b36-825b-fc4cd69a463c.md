# 勃艮第城堡(Castles of Burgundy)在线游戏本体 · 一期工程方案

## 0. 目标与范围

在现有纯静态规则书站(zhibinai.cn)内新增勃艮第可玩游戏本体,以站内《特别典藏版》中文规则书为实现基准,**基础玩法 + 全部 10 个扩展模块一并实现,建局/建房时可勾选启用哪些模块**。一期交付两种模式:

- **单机**:1 人对 1-3 个电脑(**官方自动机 Automa**,规则书自带,含难度档),**不限时**;亦可按规则书"单人游戏"变体冲目标分;
- **联机对战**:登录用户建房/加入(2-4 人,团队模块支持 2v2)+ 实时对战,**每回合限时**(60/90/180 秒可配,默认 90;超时由确定性代走器自动走子,对局不卡死)+ 断线重连 + 房间文字聊天。

典藏版模块清单(来自站内规则书,共 10 个):①额外公国版图 ②边境哨所 ③白色城堡 ④旅店 ⑤商路 ⑥团队游戏 ⑦单人游戏 ⑧盾徽 ⑨葡萄园扩展 ⑩自动机单人模式。

配套交付:纯 TS 引擎(可单测、可回放)+ 全自绘 SVG 扁平美术 + 站点接入(规则页"在线玩"入口、首页 featured、sitemap、README、burgundy 酒红主题)。

不在一期:匹配/天梯、观战、战绩、热座(架构预留)。

## 1. 总体架构

```
浏览器(SPA:模式选择/大厅/房间/对局)       生产服务器
┌──────────────────────────┐
│ ui/  DOM+SVG 渲染          │
│ controller/local|net 发招──┼──►  nginx /api/play/ws (补 Upgrade 头)
│ engine/ 纯TS规则引擎       │        │
│  · intent-only 走子        │   Go rules-api(本仓库 server/)
│  · 模块=GameState 内显式集合│    · 房间 hub(内存,含回合 deadline)+ journal(SQLite)
│  · 共享种子RNG(骰子/布袋)  │◄───  · 转发/广播/超时事件/断线补发
│  · 每步算状态哈希对账       │    · 复用现有 session cookie 鉴权
│ ai/  automa(官方单人AI)    │
│      autopilot(超时代走)   │  单机模式完全不经过后端
└──────────────────────────┘
```

联机一致性 = **意图走子 + 服务端中继 + 日志重放**:客户端只发意图,所有客户端用同一引擎+同一种子确定性推出相同结果;每步带状态哈希入 journal,不一致即标 desync;**超时代走**由服务端权威计时、广播 `timeout`,各客户端用同一份确定性代走器算出相同招式;重连 = 拉全量 journal 重放。Go 端不实现规则。

## 2. 工程结构(目录树)

```
D:\project\rules\
├─ src\play\burgundy\              # ★ 游戏源码(vite root,新增)
│  ├─ index.html                   # 单页入口:模式选择/大厅/房间/对局
│  └─ src\
│     ├─ engine\                   # 纯逻辑层,零 DOM/网络/AI 依赖
│     │  ├─ types.ts               # GameState(含 modules: ModuleId[])/ Move / TileKind...
│     │  ├─ rng.ts                 # mulberry32 种子随机,RNG 状态内嵌 GameState
│     │  ├─ setup.ts               # 建局:按模块集合装配布袋/主板/庄园板/附加件
│     │  ├─ moves.ts               # 合法动作生成 + 应用(纯函数)
│     │  ├─ effects.ts             # 板块效果链(基础+各模块效果注册表,按模块开关)
│     │  ├─ scoring.ts             # 阶段结算 + 终局计分(含团队计分变体)
│     │  ├─ modules.ts             # 模块元数据:互斥/人数约束/推荐组合(建局校验用)
│     │  └─ hash.ts                # 状态哈希(联机对账)
│     │  └─ data\                  # 规则数据(JSON,从规则书勘定,含模块内容)
│     │     ├─ tiles.json          # 布袋板块构成(按人数×模块)
│     │     ├─ boards.json         # 庄园板布局:标准板+额外公国变体板
│     │     ├─ central.json        # 中央主板(基础+边境哨所/商路等模块附加区)
│     │     ├─ knowledge.json      # 知识板块效果表
│     │     ├─ buildings.json      # 建筑效果表(含旅店等模块建筑)
│     │     ├─ modules/*.json      # 各模块专属数据(白色城堡/盾徽/葡萄园/自动机行动表等)
│     │     └─ schema.mjs          # 数据校验(npm script 跑,CI 前置)
│     ├─ ai\
│     │  ├─ automa.ts              # 官方自动机(按规则书行动表实现,难度档=规则书设定)
│     │  └─ autopilot.ts           # 联机超时代走(极简确定性:保底合法+贪心一步)
│     ├─ ui\
│     │  ├─ views\                 # mode-select(单机/联机+模块勾选)/lobby/room/board/
│     │  │                         # estate/hud/log/score/timer/module-setup
│     │  ├─ svg\                   # icons(自绘)/tiles/dice/boards 渲染
│     │  ├─ controller\            # local.ts(单机:人+自动机轮流)/net.ts(联机)
│     │  └─ theme.css              # 复用站点 CSS 变量体系
│     ├─ net\                      # client.ts(WS 重连退避)/protocol.ts
│     └─ main.ts
├─ play\burgundy\                  # ★ 构建产物(提交仓库):index.html + assets\
├─ server\                         # Go 后端扩展(现有)
│  ├─ internal\ws\                 # 极薄 WebSocket 封装
│  ├─ internal\play\               # 房间 hub(计时器/团队座位)+ journal + handler + 单测
│  └─ api\server.go                # 挂 /api/play/* 路由
├─ tools\
│  ├─ build-bga.mjs                # 小改:meta.json 加 play 字段→规则页"▶ 在线玩"横幅
│  └─ gen-sitemap.mjs              # 小改:收录 play/*/index.html
├─ assets\css\style.css            # 加 body[data-theme="burgundy"](酒红 #7a1f2b 系)
├─ package.json                    # 加 devDeps: vite/typescript/vitest + scripts
└─ index.html                      # featured 数组手工加 castlesofburgundy
```

构建产物提交进仓库(延续"脚本→提交成品"惯例),CI/deploy.yml **零改动**;本地 `npm run dev`,联机联调用 `SERVE_STATIC` 单进程复刻生产。

## 3. 技术选型与新增依赖

| 层 | 选型 | 理由 |
|---|---|---|
| 前端 | TypeScript + Vite,原生 DOM+SVG 模板函数 | 与站内 vanilla 风格一致;庄园板是网格,SVG 足够;产物纯静态 |
| 引擎 | 纯函数 reducer + JSON 可序列化状态 + 内嵌种子 RNG + 模块集合 | 可单测/回放;单机/联机/AI 同一引擎;模块即数据开关 |
| AI(单机) | **官方自动机**(规则书行动表) | 规则书自带完整规范,免调参、强确定、难度档官方定义;比自研启发式更可信 |
| AI(超时代走) | 极简确定性代走器 | 足够防卡死;与自动机分离(自动机仅适用单人局) |
| 联机 | 自研 WS 协议(intent/journal/哈希/超时) | 规则不进 Go;不引入 boardgame.io 的 Node 服务 |
| 后端 | 现有 rules-api 扩展 + `github.com/coder/websocket` | 唯一新 Go 依赖 |
| 测试 | vitest + go test + playwright→visual-judge | 复用站内验收管线 |

## 4. Go 后端改动(server/)

- 新表(单连接 WAL):`play_rooms(id, game_key, host_id, status, seats, teams, turn_seconds, modules_json, created_at)`、`play_room_players(room_id, user_id, seat, joined_at)`、`play_moves(room_id, seq, user_id, move_json, state_hash, created_at)`(append-only)。
- 路由:REST `POST /api/play/rooms`(含 turn_seconds、modules)、`join`、`GET rooms`、`start`;WS `/api/play/ws?room={id}`:座位心跳/在场、走子转发、聊天、断线按 seq 补发、**超时事件**(服务端权威 deadline,到期广播 timeout,客户端确定性代走)。
- 鉴权复用 session cookie(同源 WS 自动携带);建房/加入须登录。
- nginx 生产 `/api/` 手工补 `proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`(一次性,同步 bootstrap.sh/README)——**SSH 手工操作,列入上线检查单**。

## 5. 需要的素材

**A. 规则规范——已有,零成本**:`content/bga-zh/castlesofburgundy.html`(典藏版中文全文,含全部 10 模块)+ `assets/img/bga/castlesofburgundy/` 30 张扫描图,实现期逐条对照;BGG chip 数据已有(8.5/权重 2.91/15551 评)。

**B. 规则数据表——工作量大头(随模块变重),从规则书人工勘定为 JSON**:布袋构成(按人数×模块)、庄园板布局(标准+额外公国变体板)、中央主板(基础+各模块附加区)、知识板块表、建筑效果表(含旅店)、白色城堡/盾徽/葡萄园/边境哨所/商路专属数据、自动机行动表、动物计分表、每阶段轮数、终局/团队计分。→ M0 勘定步骤延续站内"转录+复核"双代理文化;模块元数据(互斥/人数约束)一并落表。

**C. 自绘 SVG(约 40 个小图,扁平风)**:4 动物、6 建筑+旅店、城堡、矿、知识、船、5 货物、工人、银币、骰面 1-6、玩家色徽、区域色图例、计时器/难度图标、盾徽/葡萄园等模块图标。板面由 JSON 驱动渲染,非图片;总体积 <100KB。

**D. 一期不做**:音效、插画级美术。

## 6. 里程碑与验收

- **M0 数据勘定+脚手架**:全部规则 JSON(基础+10 模块)落盘复核;vite/ts/vitest 跑通。验收:数据过 schema 校验;模块互斥规则成表。
- **M1 引擎核心(基础)**:回合流/掷骰/四类动作/拿取放置结算。验收:单测覆盖核心走子。
- **M2 完整基础规则**:全部板块效果链、阶段结算、终局计分。验收:固定种子整局 golden 回放;状态哈希稳定。
- **M2b 扩展模块接入**(按三类推进):纯数据类(额外公国版图)→ 效果类(边境哨所/白色城堡/旅店/商路/盾徽/葡萄园)→ 模式类(团队 2v2/单人变体/自动机)。验收:每模块单独开一局 golden 回放 + 全开的组合回放通过。
- **M3 对局 UI + 单机**:模块勾选界面/SVG 板面/高亮合法动作/日志/计分板/自动机三档难度。验收:visual-judge 通过;单机(含 2-3 个模块同开)能完整打完一局。
- **M4 联机后端**:WS+房间+journal+限时+超时代走+重连+团队座位;go test 通过。
- **M5 联机前端+站点接入**:大厅/房间(含模块勾选)/聊天/倒计时/断线恢复;规则页横幅、featured、sitemap、README、主题;check-seo 通过。验收:本地双窗口双人局(开 2 个模块)跑通。
- **M6 真机验收**:生产 nginx 改造上线;真实双人局+四人 2v2 局+一次超时代走验证。

## 7. 风险与对策

- **规则+模块细节量翻倍**(M0 是关键路径):数据先行勘定复核;效果注册表按模块开关,避免 if 散落;模块组合测试用"每模块单独+全开+官方推荐组合"控制组合爆炸。
- **自动机严格确定性**:行动表驱动、共享 RNG 破平局;固定种子单测锁定行为。
- **联机一致性**:intent-only + 共享 RNG + 哈希对账;版本号不匹配拒绝入房;反作弊非一期目标。
- **SQLite 单连接写**:每步小 insert 足够;不足二期改批量/队列。
- **版权**:玩法不受版权保护;美术全自绘,页面标注商标归 Ravensburger、致敬设计师 Stefan Feld。

## 8. 二期展望(不在本计划内)

观战、战绩统计、匹配、热座(本地控制器已在)、自动机难度强化、第二款游戏复用整套 play/ 框架。