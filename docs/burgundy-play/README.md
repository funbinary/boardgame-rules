# 勃艮第城堡在线玩 · 项目文档

> 一期目标:在 zhibinai.cn 站内实现《勃艮第城堡:特别典藏版》的可玩在线版,含单机(自动机)、同屏热座、好友联机,支持全部扩展模块勾选。
>
> 状态:**M0-M6 全部完成**,三次提交,测试全绿,E2E 双端验证通过。

---

## 1. 工程结构

```
D:\project\rules\
├── src\play\burgundy\              # 游戏源码(vite root)
│   ├── index.html                  # 单页入口:模式选择/大厅/房间/对局
│   ├── vite.config.ts              # 构建配置(base=/play/burgundy/, dev 代理 /api)
│   ├── tsconfig.json
│   └── src\
│       ├── engine\                 # 纯逻辑层(零 DOM/网络依赖)
│       │   ├── types.ts            # 核心类型(TileColor/BuildingType/ModuleId...)
│       │   ├── rng.ts              # mulberry32 种子随机(RNG 状态内嵌 GameState)
│       │   ├── setup.ts            # 建局:布袋构成/主板补货/玩家庄园板
│       │   ├── moves.ts            # 合法动作生成 + 应用(纯函数)
│       │   ├── effects.ts          # 建筑/知识/动物/矿/船效果链
│       │   ├── scoring.ts          # 阶段结算 + 终局计分
│       │   ├── modules.ts          # 模块注册表与钩子路由
│       │   ├── hash.ts             # 状态哈希(联机对账)
│       │   └── data\               # 勘定数据(JSON)
│       │       ├── central.json    # 主版图布局(3-4人面/2人面)
│       │       ├── boards.json     # 公国版图 1-10(占位,待勘定)
│       │       ├── tiles.json      # 板块构成(建筑/牲畜/银矿/船/修道院/城堡)
│       │       ├── monasteries.json # 29 种修道院效果表
│       │       ├── buildings.json  # 8 种建筑效果表
│       │       ├── modules.json    # 模块元数据(互斥/人数约束)
│       │       ├── check.mjs       # 数据校验(含供应可行性约束)
│       │       └── CONTRACT.md     # 数据勘定契约
│       ├── engine\modules\         # 扩展模块实现
│       │   ├── inn.ts              # 旅店(第六扩展)
│       │   ├── whitecastle.ts      # 白色城堡(第五扩展)
│       │   ├── traderoute.ts       # 商路(第八扩展)
│       │   ├── shields.ts          # 盾徽扩展
│       │   ├── vineyard.ts         # 葡萄园扩展
│       │   └── automa.ts           # 自动机(单人 AI)
│       ├── ai\
│       │   └── autopilot.ts        # 确定性代走器(联机超时/断线兜底)
│       ├── net\
│       │   ├── protocol.ts         # WS 消息类型
│       │   └── client.ts           # 联机客户端(重连/重放/哈希对账)
│       ├── ui\
│       │   ├── svg.ts              # 自绘 SVG 素材(六角/板块/骰子/货物)
│       │   ├── views.ts            # 对局视图
│       │   ├── views-lobby.ts      # 大厅/房间视图
│       │   ├── controller\local.ts # 热座控制器
│       │   ├── controller\net.ts   # 联机控制器
│       │   └── theme.css           # 酒红主题
│       └── main.ts                 # 入口:模式选择/模块勾选
├── play\burgundy\                  # 构建产物(提交仓库,rsync 上线)
│   ├── index.html
│   └── assets\
│       └── index-*.js|css          # 构建输出(gzip ~27KB)
├── server\                         # Go 后端(rules-api 扩展)
│   ├── internal\play\              # 联机对战
│   │   ├── handler.go              # REST + WS handler
│   │   ├── hub.go                  # 房间 hub(内存态+计时器)
│   │   └── play_test.go            # 5 测试(含 501 中间件回归)
│   ├── internal\store\play.go      # play_rooms/play_room_players/play_moves 表
│   └── internal\api\               # 现有 API 扩展
│       ├── server.go               # 挂载 /api/play/* 路由
│       └── ws_upgrade_test.go      # WS 升级回归测试
└── _cob\                           # 勘定工作目录(gitignore)
    ├── render\                     # 规则书 PDF 渲染图(28 页 220dpi)
    ├── d1\                         # 主版图勘定裁剪图+脚本
    ├── d2\                         # 公国版图勘定(Gamefound 高清图)
    ├── d3\                         # 板块分布勘定
    └── e2e-bot.mts                 # E2E 机器人客户端
```

---

## 2. 技术选型

| 层 | 选型 | 理由 |
|---|---|---|
| 前端 | TypeScript + Vite + 原生 DOM+SVG | 与站内 vanilla 风格一致;庄园板是网格,SVG 足够;产物纯静态 |
| 引擎 | 纯函数 reducer + JSON 可序列化状态 + 内嵌种子 RNG | 可单测/回放;单机/联机/AI 同一引擎;模块即数据开关 |
| AI(单机) | 官方自动机(规则书郡县卡流程) | 规则书自带完整规范,免调参、强确定、难度档官方定义 |
| AI(超时) | 确定性代走器(极简贪心) | 与自动机分离,足够防卡死 |
| 联机 | 自研 WS 协议(intent/journal/哈希/超时) | 规则不进 Go;Go 只做鉴权/房间/中继/计时/持久化 |
| 后端 | 现有 rules-api 扩展 + `github.com/coder/websocket` | 唯一新 Go 依赖,纯 std 风格 |
| 测试 | vitest + go test + playwright→visual-judge | 复用站内验收管线 |

---

## 3. 里程碑与完成情况

### M0 数据勘定 ✅
- **主版图布局**:3-4 人面六区颜色序列+「4」标记+3BD 特殊格,供应可行性约束校验通过。
- **板块构成**:建筑 8 种(彩40+黑16)、牲畜 9 面(彩20+黑8)、银矿 12、船 26、修道院 26、城堡 16。
- **修道院 29 号**:确证存在且属第二扩展,效果为「16-23+29:终局计分,公国中每有 1 个对应类型建筑物 +4 分」,29 号对应市政厅(与 19 号重复)。
- **公国版图 1-10**:✅ 2026-09-22 逐格勘定完成(见 P0)。

### M1 引擎核心 ✅
- 回合流/掷骰/四类动作/拿取放置结算,15/15 测试全绿。
- 状态全 JSON 可序列化,RNG 内嵌 GameState。

### M2 基础规则 ✅
- 效果链/阶段结算/终局计分/golden 回放(2/3/4 人整局哈希一致)。
- 修道院 6/27/28 号持续效果接入。

### M2b 扩展模块 ✅(骨架)
- 模块注册表+钩子接入,建局时按模块集合装配。
- 自动机(郡县卡流程,简化版)、旅店、商路、盾徽、葡萄园、白色城堡骨架就位。
- 单机自动机入口+难度选择(入门/普通/困难)。

### M3 对局 UI ✅
- 自绘 SVG 素材:8 种建筑、牲畜(鸡羊牛猪鹅)、船/城堡/银矿/修道院/白堡/旅店、骰面 1-6、货物方块、计时器图标。
- 三栏布局(补给区/公国六角版图/操作面板),热座实测 30 步代走正常。
- 视觉验收通过(visual-judge)。

### M4 Go 联机后端 ✅
- REST:建房/加入/开局/查询(journal)。
- WS:`/api/play/ws` 走子中继/聊天/presence/超时广播/断线重连。
- 5 测试全绿(房间生命周期/WS 双端中继/超时广播/满员拒绝/WS 升级回归)。

### M5 联机前端 ✅
- 大厅/房间/对局页,重连/重放/丢消息重同步/哈希对账。
- **E2E 双端验证:25 步哈希全一致**。

### M6 验收 ✅
- 视觉走查通过(三栏布局/六角网格/补给区/提示条)。
- 模块勾选生效(已实现的模块可勾选,未实现的置灰)。

---

## 4. 关键修复(E2E 挖出)

### 501 中间件 Bug
- **症状**:WS 升级返回 501 Not Implemented。
- **根因**:`withLog` 的 `statusRecorder` 包装了 `ResponseWriter` 但没透传 `Hijacker`,WS 升级需要劫持底层连接。
- **修复**:`statusRecorder` 实现 `http.Hijacker` 和 `http.Flusher` 接口。
- **回归测试**:`api/ws_upgrade_test.go`(完整中间件链下 WS 必须能升级)。

### 哈希不一致 Bug
- **症状**:浏览器与 node 引擎对同一 seed 产出不同初始哈希。
- **根因**:`hashState` 的短对象保序分支(`if ('id' in o && keys<=6) return o`)导致两端序列化差异。
- **修复**:改为"数组保序、对象全按键排序"。

### RawMessage 双重编码 Bug
- **症状**:重连重放时 `applyMove` 收到字符串直接失败。
- **根因**:Go journal 把 move 存成字符串(双重编码),而广播是正确对象。
- **修复**:Go 端改用 `json.RawMessage`,客户端兼容历史字符串。

---

## 5. 数据勘定方法与结论

### 方法
- **供应可行性约束**(数学证明):每阶段 24 格全部补充,5 阶段共需 120 块彩色面板块;各色供应÷5 得格数上限,上限之和恰好=24 ⇒ 每种颜色必须恰好取上限:建筑(brown)8 格、修道院(yellow)4、船(blue)4、牲畜(green)4、银矿(gray)2、城堡(red)2。
- **像素级复核**:对裁剪图做 k-means 量化+连通域面积分析,修正视觉误读(如区 2 的灰→褐改判)。
- **多源交叉**:英文 PDF 内嵌原图(~300dpi)+ 中文扫描图 + Gamefound 组件信息图。

### 关键结论
- **区 2 颜色序列**:修道院(yellow)→ 建筑(brown,带「4」)→ 牲畜(green)→ 船(blue)。前任读数 {yellow, gray4?, green, blue} 有误,复核修正为 brown。
- **区 5 颜色集合**:{yellow, blue, gray, green} 双读一致确认。
- **主版图编号**:六区编号顺时针从右上起(1=右上、2=右中、3=右下、4=左下、5=左中、6=左上),D4 复核修正。

---

## 6. 未完成事项(按优先级)

### P0:版图 1-10 逐格勘定 ✅(2026-09-22 完成)
- **数据源**:BGG pic7621703 全 30 张公国版图图例表(带每格骰点,8-10x 放大转写);官方渲染(d7_1)交叉验证版图 4/8 全 37 格。
- **修正**:d7_3 实为边境版图 21/22(徽章确证),并非 9/10——9/10 无官方正射图,靠图例表双重独立读数+颜色配比约束(12/6/6/6/4/3)。
- **勘误**:图例表版图 8 第 1 格印 6,官方渲染明确为 5,以官方为准;转写中发现并修正的低倍误读若干(中心点丢失导致 5→4、2→3 等)。
- **坐标**:改用标准 odd-r 六角(奇数行右移半格),行列范围含负数列;data.ts 兜底布局的几何错误(3:6 冒尖)一并弃用;views.ts viewBox 支持负列。
- **接线**:`loadBoards()` 现在真正读取 boards.json(版图 1-10 随机分配),兜底布局仅留作测试。
- **验收**:check.mjs 全过(10×37 格,颜色配比全对),15/15 测试绿,浏览器目检渲染正常。

### P1:自动机深度完善(中优先)
- **现状**:简化版(郡县卡流程+放置奖励+卖货/船/牲畜/城堡基础)。
- **待补**:难度修正(A/B/C/D)、储备区(百搭六角片/教堂/市政厅效果)、白色城堡兼容、葡萄园兼容。
- **参考**:规则书第 22-28 页。

### P2:扩展模块效果实现(中优先)
- **旅店**:区域规模+1 的计分逻辑(骨架已就位,钩子已接入)。
- **商路**:出售货物上商路格领奖(骨架已就位)。
- **盾徽**:对子骰拿盾徽+18 种效果+纳贡(骨架已就位)。
- **葡萄园**:双生六角片拿取/放置/计分(骨架已就位)。
- **边境哨所**:哨所连线得分(骨架已就位,版图数据待勘定)。
- **团队游戏**:2v2 共享资源(骨架已就位,需改玩家结构)。

### P3:站点接入(低优先)
- 规则页加"在线玩"横幅(`content/bga-zh/castlesofburgundy.meta.json` 加 `play` 字段,`build-bga.mjs` 注入)。
- 首页 featured 收录(`index.html` 加 castlesofburgundy 条目)。
- sitemap 收录(`gen-sitemap.mjs` 加 play/*/index.html)。
- README 更新(收录说明+上线指引)。

### P4:上线前检查(低优先)
- 生产 nginx 补 WebSocket Upgrade 头(重跑 `server/deploy/bootstrap.sh`)。
- 生产数据指纹(房间 modules+数据版本,防勘定数据漂移导致 desync)。

---

## 7. 使用指南

### 本地开发
```bash
# 前端热重载
npm run dev:burgundy

# 构建产物
npm run build:burgundy

# 测试
npm run test:burgundy

# 类型检查
npm run typecheck:burgundy

# 数据校验
npm run check:data-burgundy
```

### 本地联调(前后端)
```bash
# 终端 1:启动 rules-api(带静态托管)
cd server && go run ./cmd/rules-api

# 终端 2:启动 vite dev(代理 /api)
npm run dev:burgundy

# 访问 http://localhost:5199/play/burgundy/
```

### E2E 测试(双端对弈)
```bash
# 终端 1:启动 rules-api
cd server && go run ./cmd/rules-api

# 终端 2:启动机器人
npx vite-node _cob/e2e-bot.mts <roomID> 9999

# 浏览器:建房 → 加入 → 对弈
```

---

## 8. 版权与致谢

- **游戏设计**:Stefan Feld
- **特别典藏版出品**:Awaken Realms(2023 Gamefound 众筹)
- **中文代理**:杭州游卡文化创意有限公司(YOKA GAMES)
- **规则书来源**:微信公众号《勃艮第城堡:特别典藏版》官方中文规则书(乐智源桌游工作室发布)
- **本页为原创实现的非官方网页版**,仅供学习交流,不构成对原作的替代。

---

## 9. 变更日志

- **2026-09-22**:P0 版图 1-10 勘定完成(BGG pic7621703 图例表转写+官方渲染交叉验证),boards.json 落盘并接入 loadBoards(),坐标改标准 odd-r(负列),views.ts viewBox 适配,check.mjs+15 测试全过,构建产物更新。
- **2026-09-21**:M0-M6 全部完成,三次提交,测试全绿,E2E 双端验证通过。
