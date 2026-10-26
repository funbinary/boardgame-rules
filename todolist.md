# 架构优化任务清单

> 来源：2026-10-16 架构评审（三个子系统走查：tools/ 构建管线、src/play/burgundy 在线玩、站点 chrome 与内容层）。
> 报告：`%TEMP%\architecture-review-20261016.html`（一次性产物）。
> 术语：module / interface / seam / deep / shallow / locality / leverage 沿用评审口径。
> 用法：完成一项勾一项；每项附「验收」，全过才算 Done。

---

## P0 · 止损与一行修（无依赖，随时可做，合计约半天）

- [x] **T0.1 `_cob/` 移出 git 索引** — 3.3GB、472 个已跟踪文件（截图/扫描件/smoke 脚本）不该进仓库。
  `git rm -r --cached _cob` + `.gitignore` 与 `.zcodeignore` 补 `/_cob/`。✅ 2026-10-26 完成：472 文件出库、磁盘 1973 文件保留。
  验收：`git ls-files _cob` 为空；`git status` 不再出现 69 个 untracked 噪音。
- [x] **T0.2 约定单一暂存目录 `_work/`** — `.gitignore` 加一行 `/_work/`；存量根目录 scratch（`_aoi/_ark/_clank/_fcm2/_pg/_spk/_tmp/_wx` 等 11 个）逐步迁入，停止「逐项目打地鼠」。
  验收：新开一个游戏项目时根目录不再新增 `_<slug>/`。
- [x] **T0.3 `verify-zh-html.mjs:8` 改为 import `repair-zh-html.mjs` 的标签正则** — repair 已 export 却被复制，一行修复。✅ 2026-10-26 完成：repair 导出 `TAG_RE` 供 verify 复用，并给 repair 的 CLI 主流程加 import 守卫（原先 import 即触发全量修复——translate-bga 也一直带着这个潜伏副作用）；verify 现为无副作用校验。
  验收：两文件只剩一处正则定义；机翻校验行为不变。
- [x] **T0.4 修正 README.md:3「静态部分无构建步骤」的契约错位** — games/bga、bga-index.js、bgg-ratings.js 均为构建产物。先如实改写；候选 3 落地后再更新为「一条构建链」的最终表述。
  验收：README 与实际产物来源一致。

## P1 · 站点游戏注册表（⭐ 首推；评审候选 1；约一周；P2/P3 的前置）

- [ ] **T1.1 建 `content/site-games.json` 单一事实源** — 字段：`slug / zh / en / players / emoji / theme / href / sidebarOrder / featured / expansions / source{url,label}`。以当前最新 canonical（wire-white-castle-sidebar.mjs:9-41 的 31 条）为基线盘点，补齐各冻结快照的差集。
- [ ] **T1.2 写 `tools/sync-sidebar.mjs`（幂等重写全部 `games/*.html` 侧边栏到 canonical 状态）** — 替换 12 个 wire 脚本（9 个插入式 + 3 个重写式），消灭「最后执行者获胜」与顺序依赖；扩展互链（wire-setisa-sidebar.mjs:64-76）改为注册表 `expansions` 派生。
- [ ] **T1.3 index.html featured 数组与「37 款」类计数改为派生** — 构建期注入或生成，消除 index.html:162-209（featured 46 条）与 og:description/JSON-LD/FAQ 六处手写计数（index.html:19,30,51,59,120,124）的失账；README 收录计数同步派生。
- [ ] **T1.4 删除 12 个 wire-*-sidebar.mjs 与 12 份 assemble 内嵌 SIDEBAR 数组** — assemble 改从注册表取自身条目。
- [ ] **T1.5 `tools/add-bgg-chips-manual.mjs` 退役** — chip 渲染抽 `tools/lib/bgg-chip.mjs`（与 build-bga.mjs:289-305 合一），pages 清单由注册表派生（现在是硬编码 24 个 slug，add-bgg-chips-manual.mjs:31-37）。
- 验收：①「本站有哪些游戏」在仓库里只有一份定义；②乱序重跑 `sync-sidebar.mjs` 两次，`git diff` 为空（幂等）；③刻意把注册表删一条重跑，全部页面侧边栏同步收敛；④`node tools/check-seo.mjs` 全绿；⑤收录一款新游戏的清单触点从 11 处降到「转录稿 + 注册表 1 条」。

## P2 · assemble-core 引擎（依赖 P1；评审候选 2）

- [ ] **T2.1 抽 `tools/lib/assemble-core.mjs`（~300 行）** — 合并 readFrag / strip 片头 / demote / 标点归一（normalizePunct，现存 4 份实现）/ mdToHtml 三代并集（seti:103-181、setisa:77-155、powergrid:69-117）/ figure 嵌图 / chrome 调用（P3 后接 page-template）。
- [ ] **T2.2 20 个 `assemble-<game>.mjs` 退化为 ~80 行声明式 config** — 只留真实游戏知识：CAPTIONS、来源 blockquote、meta、`out:"page"|"fragment"`（arknova 的 fragment 输出契约由隐变显）。
- [ ] **T2.3 一次性 fix 脚本清理** — `fix-seti-stray-h1.mjs`（注释自证一次性）、`check-seti-punct.mjs` / `fix-seti-punct.mjs`（其 STRIP_HEAD 正则又复制进 check-seti-punct.mjs:13）归档到 `_work/` 或删除。
- 验收：①tools/assemble-*.mjs 总行数 4,498 → <1,000；②五款最新游戏（setisa/seti/white-castle/powergrid/arknova）用新引擎重建，产物与现库逐字节 diff 为零；③改一处表格渲染只需动 assemble-core 一个文件；④为 mdToHtml 建立第一个渲染回归测试面。

## P3 · 全站 page chrome builder（依赖 P1；评审候选 3）

- [ ] **T3.1 抽 `tools/lib/page-template.mjs` 单点模板** — 输入 `{slug,title,desc,theme,gameKey,sidebar,jsonld,bodyHtml}`；`build-bga.mjs` 的 renderPage（build-bga.mjs:110）改为调用它，JSON-LD 双实现（build-bga.mjs:134-163 ≈ wire-seo.mjs:32-62）合并。
- [ ] **T3.2 独立页正文源落库** — 31 个 `games/*.html` 的正文 `<article>` 提取到 `content/pages/<slug>.md|html`（3 页已漂移到 108 行 chrome 的：arnak-expedition-leaders / gwt-new-zealand / the-message 顺手归位）。
- [ ] **T3.3 独立页改由构建生成** — chrome 全部来自 page-template；`wire-seo.mjs` 退役为纯校验；`esc()` 五份副本（index.html:217 / shared.html:57 / account.js:34 / main.js:81 / build-bga.mjs）收进一个 util。
- [ ] **T3.4 小件归一** — ICP 备案双机制合一（main.js:421-433 运行时注入 vs index.html:148 静态写死）；lightbox 拆出 `assets/js/lightbox.js` 并由 builder 按需写入（现 433 行 main.js 被 1,600 个 bga 页全量加载，lightbox 占 210 行）。
- 验收：①删除 31 页 chrome 后重跑构建，除正文外逐字节还原（deletion test）；②3 页漂移消失；③SEO 规则改动只落 page-template 一个文件；④check-seo 全绿。

## P4 · 勃艮第在线玩（独立轨道，可与 P1–P3 并行）

- [ ] **T4.1 点击→Move 合并为单一匹配 module（⭐ 子系统内首推，一个下午；评审候选 4）** — `renderGame` 给 `legalMoves[i]` 盖 `data-move-idx`，点击层 `moves[i]` 直取；删除 local.ts:67-254 的 onClick if 链与 net.ts:327-427 的 matchMove 手抄（~290 行），LocalGame/OnlineFlow 各剩 ~20 行薄 adapter；落地 views.ts:471-475 的 matchers() 废弃桩。
  验收：新增一种 Move 类型只改引擎+渲染两处；热座与联机走同一路匹配；测试 59 绿。
- [ ] **T4.2 TS⇄Go 协议共同 fixture（一个下午；评审候选 6）** — 提交 `protocol.fixture.json`，TS（net.test.ts）与 Go（play_test.go）各自解析同一文件断言字段/类型；给 `store.PlayRoom`（store/play.go:24-36，现无 json tag）补 tag。
  验收：改协议任一侧字段，两套测试至少一套变红。
- [ ] **T4.3 联机模块接线（解锁断头 seam）** — net.ts:76 建房硬编码 `modules: []`、net.ts:139 丢弃 `_mods`：大厅勾选模块（validateModules + engine/data/modules.json 现成）→ 透传 modules；自动机座位由任一客户端确定性代提交（超时代走路径已验证，client.ts:96-101）。
  验收：联机可开带扩展（旅店/商路/盾徽/葡萄园）与自动机的对局，双方哈希对账一致。
- [ ] **T4.4 modules.ts 深化为效果解释器（评审候选 5；大改动，建议在 T4.1–T4.3 之后）** — 钩子从「只能返回 VP」升级为返回 `{pending?, vp, log, legalMoves?}` 效果列表，按 pending-kind 注册应答/自愈/枚举器；消除 moves.ts 17 处 `modules.includes` 开关与 state.ts 字段直挂；以 team.ts 的 `resP()` 资源路由为接口样板。
  验收：新增一个扩展只动 1 个模块文件 + 注册表条目（现状 3–6 个核心文件）；moves.ts 开始瘦身。
- [ ] **T4.5 确定性护栏** — `setup.ts:78-81` 模块级 `nextTileId` 全局计数器并入 GameState（或由 rng 序列派生）；给 `src/engine/**` 加 no-Math.random / no-Date lint；golden 测试把 journal+终局哈希钉进提交的 fixture（replay.test 现为自演自证）。
  验收：同进程双 GameState 互不污染；lint 违例即 CI 红；golden fixture 能查出「本该如此」级回归。
- [ ] **T4.6 play 死代码清理** — state.ts:153 `answerBonusDie`（legalMoves 不产生、applyMove 不处理）、autopilot.ts:73-85 `autopilotTurn`（无调用）、net.ts:295 `getModules()`（无调用）。
  验收：全库 grep 无引用后删除，测试全绿。
- [ ] **T4.7 Go 小件** — `writeJSON` 双份（play/handler.go:49-53、api/handlers.go:20-24）与 `maxBodyBytes` 两处（server.go:23、handler.go:212）收拢；room 状态机（status/seq/deadline/conns，散在 handler/hub/store 三层）收拢为一个类型，为第二个游戏复用「纯中继+journal」seam 铺路。
  验收：deadline 初始化只有一处；Go 测试全绿。
- [ ] **T4.8 account.js 惰性探测** — 每页无条件 `GET /api/me`（account.js:237）改为仅存在收藏条/网格的页面发起；shared.html:47 复用 `RulesAccount` 而非自带一份渲染。
  验收：纯静态托管（无后端）下不再产生全站固有 404。

## P5 · 工程化编排（P1–P3 落定后收口；评审候选 7 的编排半边）

- [ ] **T5.1 `npm run build` 一键链** — sync-sidebar → build-bga → gen-bgg-data → gen-sitemap → check-seo（守门），任一步失败即停。
- [ ] **T5.2 全线失败即停** — 消灭静默 exit 0：wire-seti-sidebar.mjs:22（「未找到锚点行！」后 continue）、wire-white-castle-sidebar.mjs:60-62、build-bga.mjs:253（坏 JSON 跳过）等；统一「失败即 `process.exit(1)`」约定（现仅 4 处脚本非零退出）。
- [ ] **T5.3 `tools/new-game.mjs` 脚手架** — 按注册表生成 assemble config 骨架 + 打印剩余人工步骤（转录稿/BGG 查证/README 来源行），取代 README:144-151 只写 5 步、实测 11 处触点的部落记忆。
- [ ] **T5.4 `tools/lib/seo.mjs`（若未随 P3 完成）** — canonical/OG/JSON-LD 单实现，build-bga 与全站 wire 共用。
- 验收：CI/本地一键构建全绿可发布；故意弄坏一处输入，链路在坏点红停而不是带病出页。

---

## 建议节奏

1. **本周**：P0 全部（半天止损）+ T4.1（一个下午，性价比最高）+ T4.2（一个下午）。
2. **下一个整周**：P1 注册表（首推根因，P2/P3 的前置）。
3. **其后**：P2 与 P3 可并行推进；P4.3/T4.4 按在线玩的功能诉求插入；P5 收口。
4. 每完成一个 P 段跑一次全量验收：`node tools/check-seo.mjs` 全绿 + burgundy 测试 59 绿 + Playwright 冒烟。

## 否决记录（防评审重提）

- （暂无。若某项被否决且理由载重——例如「刻意保留独立页手改能力，不上全站构建」——在此登记一句话，作为本仓库的非正式 ADR。）
