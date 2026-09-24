# 数据勘定契约(v1)

所有 `*.json` 由勘定代理产出、复核代理校验。来源优先级:
1. 官方英文规则书 PDF 渲染图 `D:\project\rules\_cob\render\pNN.png`(220dpi,可用 pymupdf 对指定区域二次高倍渲染;`_cob/d4/pNN_600.png` 为 600dpi 版)
2. 中文规则书扫描 `D:\project\rules\assets\img\bga\castlesofburgundy\pNN.jpg`(1080px,与英文 PDF 同版式,pNN 对应 PDF 的 p(N) )
3. 规则书正文文字 `D:\project\rules\content\bga-zh\castlesofburgundy.html`
4. BGG/Gamefound 图片(标注来源 URL)

统一约定:
- 颜色代码:`yellow|blue|red|gray|green|brown|black`(yellow=修道院 blue=船 red=城堡 gray=银矿 green=牲畜 brown=建筑 black=黑色背面)
- 不确定的条目必须带 `"confidence": "low"` 与 `"note": "原因"`,禁止猜测后不标注。
- 每个文件顶层 `{"_meta": {"sources": [...], "verifiedBy": []}, "data": ...}`。

## 团队游戏(第九扩展)引擎约定(2026-09-23 实现)
- 4 人 2v2:座位 0,2 → A 队;1,3 → B 队。共享资源(工人/银币/货物/已售/奖励板块/公国 placed/修道院6号/初始城堡/版图号)全部挂在**队锚点(members[0],即座位 0/1)玩家的对应字段**上,引擎经 `engine/modules/team.ts` 的 `resP()` 路由。
- 储存格统一索引 0-3:0-1 私人(每人)、2-3 共享(每队);非团队模式仍为 0-2。
- 首轮流次 A1,B1,A2,B2;起始玩家所在队 3 工人,另一队 5 工人;各队 2 银币、3 随机货物;每队 1 座初始城堡(仅锚点有待决)。
- 船只 >6:放置船只时若标记已在轨道最后一格,移到该格最顶(`flow.advanceTrack`)。
- 终局:两队队员分数相加;平手时公国剩余空格少的队胜(`scoring.endgameScore`)。
- 模块互斥(exp9 ↔ exp1/exp3_7/exp4/exp5/exp6/exp8/exp10/shields/vineyard/automa):官方未定义这些组合的团队语义,首期不开放(modules.json);仅基础+exp2 可组合。

## central.json
```jsonc
{
  "_meta": {...},
  "data": {
    "front": { "depots": [ { "n":1, "cells":[...], "goods":true } ], "blackDepotCells": 6 },
    "back":  { "depots": [ { "n":1, "cells":[...] } ], "blackDepotCells": 4 }
  }
}
```
- `cells`:顺时针自顶格开始的颜色序列;仅 4 人补的格写 `{"color":"x","only4":true}`;3BD 格写 `{"color":"x","threeBD":true}`(3人B/D阶段补银矿,否则城堡)。
- 已知约束(文字):3-4人面每区 4 彩色格;2人面格数不同(待勘);黑区 3-4 人与 2 人也不同(待勘)。

## boards.json
```jsonc
{ "_meta": {...}, "data": { "boards": [ { "id":1, "cells":[{"r":0,"c":3,"color":"red","n":6}...] } ] } }
```
- 37 格/版图。`r` 行 0 起自上而下,`c` 列 0 起自左而右(尖顶六角,奇数行向右错半格);行起始列 c0=[0,-1,-1,-2,-1,-1,0]。
- 版图 23-30(边境哨所)的格加 `"outpost": 序号`。
- 无法勘定的版图仍要占位:`"cells": [], "confidence":"missing"`。

### 版图 23-30 哨所位(2026-09-23 勘定决策)
- **物理事实**(规则书 p14 高清样例,23 号版图):哨所不在六角格内,而是印在版图**角点**的圆形徽章(共 3 个),徽章与其相触的格连通。23 号实测:①右上角格(0,3) ②左角格(3,-2) ③底边中点豁口(同时接触 (6,1) 与 (6,2) 两格)。
- **数据模型**:引擎 `outpost` 仍记在格上(同一哨所序号可标在多格上,连通判定经任一标记格即达)。23 号:outpost1→(0,3);outpost2→(3,-2);outpost3→(6,1)+(6,2)。
- **24-30 号**:图例表(BGG pic7621703)不印哨所徽章,无法核各版哨所位;采用与 23 号一致的默认角点位,`confidence:low` 并在 `_meta` 标注。若后续获得官方组件照,只需改 boards.json 的 outpost 字段。
- 23-30 逐格颜色/骰点来源:BGG pic7621703 图例表 8x 放大双读转写(`_cob/d4/` 工具:grid_outpost_boards.py 生成 z/oXX_overlay.png);颜色配比 12/6/6/6/4/3 为 1-10 号约束,**23-30 允许偏离**(如 24 号 4 红),仅作软校验。

### 版图 31/32(团队,占位)
- 官方为每队 1 张双面团队版图(31a+31b 标准 / 32a+32b 进阶),两半拼成一个完整公国;标准面城堡固定中央红格,进阶面 6 红格任选。
- 当前**占位**:复用版图 1 几何;31 = 中央 (3,2) 唯一红格(城堡固定,引擎 initialCastle 只会给这一个选项);32 = 4 红格(任选)。待官方组件图勘定后逐格替换(检索代理产出见 `_cob/d4/out/`)。

## tiles.json
```jsonc
{ "_meta": {...}, "data": {
  "buildings": [ {"type":"market","count":5,"blackCount":2} ... ],   // 8 种,合计彩色 40 黑 16
  "livestock": [ {"kind":"sheep","animals":3,"count":2} ... ],       // 合计彩色 20 黑 8(黑面鹅 1)
  "mines": {"colored":10,"black":2}, "ships": {"colored":20,"black":6},
  "monasteries": {"colored":20,"black":6}, "castles": {"colored":14,"black":2},
  "goods": {"colors":6,"perColor":7,"valuesPerColor":[1,1,2,2,3,4,5,6]},
  "whitecastle": {"total":9,"byColor":{...}}, "inns": 5, "crane": {"black":1}, "goose": {"black":1}
} }
```
- 牲畜按 物种×只数 细分(共 20 彩色:勘定每物种每种只数的张数)。
- 货物每色 7 个,点数分布需从图勘定(上例为占位,勿照抄)。

## monasteries.json
```jsonc
{ "_meta": {...}, "data": [ {"n":1,"when":"ongoing","effect":"...","text":"规则书原文简述"} ... ] }
```
- 1-26 基础 + 27/28/29(第二扩展)。**29 号的归属必须从帮助表扫描图(p30)确证**。

## buildings.json
8 种建筑效果表(文案取自帮助表速览),字段 `{type, text}`。

## automa.json(P1 新增;当前为占位数据)
```jsonc
{ "_meta": {...}, "data": {
  "countyCards": [ { "id":1, "cells":[{"color":"blue"},{"color":"blue","sell":true}...],
                     "scores":{"easy":4,"normal":5,"hard":6} } ... ],   // 基础 9 张(1-9)
  "vineyardCountyCards": [ ... ],                                      // 葡萄园 8 张(10-17,含 twin 格)
  "twinScores": [1,3,6,...,91],          // 双生片数量→分(1..13+),规则书 p28 表格,已确证
  "shieldScores": [0,8,15,25,40],        // 盾徽 1/2/3/4+ 张,规则书 p27,已确证
  "reserveTypeOrder": ["brown","yellow","blue","green","gray","red"]   // 储备区类型序(占位)
} }
```
- 卡面格字段:`sell`(出售货物符号)/`twin`(双生六角片符号)/`castle`(城堡格);数组顺序=读序(自上而下逐行自左而右)。
- **待勘定**:逐卡格色布局、出售货物符号位置、各难度填充得分、储备区类型序。硬约束(规则书文字):牌库=1-9 或 1+10-17;至少一张含城堡格;填充得分三档印于卡顶。
- 计分表(twinScores/shieldScores)来源为规则书正文表格,confidence=high。
- **2026-09-23 检索情报**(未解,素材已备):正确 BGG id=363622(api.geekdo.com 可枚举 554 图+50 文件);关键素材已下载到 `_cob/d4/out/dl/`(orig_7688823/7688824.jpg=对局中的郡县卡,互有遮挡;orig_8648884.jpg=35/36 号对局照);部分观察(medium):卡5=14/18/22 分、面 黄(sell)/米褐/绿/黄;三档完成分多卡共享同一三联,不能作唯一键;卡左上角有小色块标记。
- **2026-09-23 SoloRef_v1.3 到手结论(重要)**:人工浏览器已下载 `dl/SoloRef_v1.3.pdf`(4 页,渲染件 `_cob/d4/out/soloref/`)。**该 PDF 是纯文字规则速览,不含任何郡县卡卡面布局图**——此前"下载后即可补齐 17 卡"的预期不成立。其价值在规则澄清,已逐条与引擎对照:白骰选槽/取牌兜底链/城堡白骰奖励(活动卡→未满卡→卖货)/卖货(最多色→最左→跳过)/终局口径(修道院4/未售货1/银币1/储备片1/卡上片-2,须严格多于自动机才胜)全部一致 ✓;难度修正 A-D 与官方英文规则书 p26 逐字核对一致 ✓;储备区银矿不产银 ✓(flow.ts 本就只数公国+卡上格);盾徽2 建局移除 ✓、盾徽6 不含储备区(卡面可复制)✓、自动机盾徽不纳贡 ✓;起重机片=城堡奖励行动 ✓;鹅匹配 ✓;白堡取货类型序 ✓;旅店不兼容自动机 ✓;商路+1/次 ✓;双生片拿取(白骰槽向右环绕)/黑区购买优先双生片(1-2左/3-4中/5-6右,商店空回退黑区)✓。**唯一修正**:葡萄园藤奖励板块只发给真实玩家(p27 "The Châteauma does not use vine bonus tiles"),原实现发给全体——已改 vineyard.ts 并加受控测试。
- **郡县卡卡面后续图源**(按优先级):① BGG filepage **262788「Duchies List: All Duchy Details and Rules (Reference List)」**(可能含 35/36 版图+卡面,同样有 Cloudflare 墙,需人工下载);② 作者 Spin 的 geeklist **324812**(程序 xmlapi 拉取为空,需人工浏览找配套 visual aid);③ filepage 261975「Chateauma FULL Game Rules Summary」;④ **实物卡拍摄**(最权威,若用户有特别典藏版:17 张郡县卡正上方拍摄,含格色/出售符号/卡顶三档分/左上小色块/边境哨所与盾徽符号)。
- **2026-09-23 内置浏览器实测(更新上述预期)**:Cloudflare 验证内置浏览器可自动通过;但 BGG 文件下载链接带 `ggloginbutton` 属性,**下载必须登录 BGG 账号**(匿名仅可浏览页面)——这就是历次程序下载失败的根因。①「Duchies List」实为 **1-30 号版图纯文字清单(30 块为止,不含 31+;无版图网格、无郡县卡)**,其第 1 页谱系截图已消化(见上「版图谱系」);②geeklist 324812 中勃艮第相关仅 SoloRef 一条,无卡面图源。**结论:社区文件路线已穷尽,郡县卡卡面与 35/36 网格的唯一剩余权威来源=实物拍摄**(或日后出现的官方组件照/数字版截图)。若需登录下载冗余文件,可在内置浏览器登录后由代理继续。
- **2026-09-23 用户登录后经内置浏览器完成下载**(S3 签名直链 120s 时效,shell 直连 s3 不通,经"页面内触发→同源 fetch→base64 回传"落盘):
  - `dl/CoB_SE_2013_Board_List_v2.pdf`(178KB,仅 1 页=谱系截图原文,无新增情报;text 副本 `CoB_SE_Board_List_text.txt`)。
  - `dl/Lens_Summary_v3_Chateauma.pdf`(103KB,2 页纯文字速览,内页题头写 v2;text 副本 `Lens_Summary_v3_text.txt`,150dpi 渲染 `dl/lens/`)。**全部条目与引擎逐条核对一致**:建局(自动机货物每色1/1银/总末位顺位,修正C先手;初始牌库=洗混取含城堡卡置左槽+城堡片预置其城堡格,余牌洗混顶牌置右槽)/3BD 格(3人 B/D 阶段放银矿其余放城堡)/售货官方原文(规则书p10:与骰点匹配颜色全卖+恰好1银+每枚2/3/4分)/起始工人按顺位1/2/3/4(规则书p5原文,团队3/5另计)/自动机取牌兜底链/城堡奖励链/船(取货最多堆,平手自白骰顺时针)/八种建筑奖励/牲畜全卡+公国同一大牧场。**本轮零引擎改动**。

## boards.json 35/36 号(P1 新增,占位)
- 自动机公国版图 35(无标记)/36(修正标记格)。当前复用已勘定几何,颜色配比 brown10/yellow6/blue7/green5/gray5/red4 为占位。
- 36 号 `mark` 字段:`A`(黑面预填格,须恰 5:建筑2+牲畜1+船1+修道院1)/`B`(明置预填格,恰 3:建筑1+银矿1+城堡1)/`D`(额外回合标记,数量待勘)。
- **待勘定**:35/36 逐格真实布局与骰点。
- **2026-09-23 实拍情报**:p22 右上照片=35 号实拍(斜视角仅右半,格面**无骰点印刷**,底部有白骰槽与六色条纹图标);orig_8648884.jpg=35/36 对局照(满置+斜角)。均不足以 37 格转写,维持占位。规则书 p26 文字确认修正 A/B/D 全部发生在 36 号(35 的背面)。

## 版图谱系(Duchy List p1 截图,2026-09-23;BGG filepage 262788,完整 PDF 待人工存入 dl/)
- 1-10 基础(2011/2019/2023);2011 版的 2 号=今日 10 号,现行 2 号是 2019 新手版图,**4/8 号在 2023 SE 被 Awaken Realms 重平衡**(勘定以 SE 图例表为准,无影响;若引旧资料须注意版本)。
- 11-18 新手版图(第一扩展,Spielbox 2011,未实现未收录):可选规则=新放板块须连通城堡(直/间接);可弃 5 分+两骰行动从弃堆换回城堡片(含黑堡)。
- 19/20 德国冠军赛版图(2013/2016);21/22 Feld 为 2023 SE 新设计(官方渲染 d7_3 已确证徽章,逐格待勘);23-30 边境哨所 ✓。
- **31/32 团队;33/34「单人游戏」(第十扩展)**;35/36=自动机公国(35 背面=36)。SoloRef「Solo Game boards not supported」指 33/34,非 35/36——与团队/单人扩展和自动机互斥的既有实现一致。
- 边境哨所「直线5块相连」是 2019+ 通用变体(哨所印在版图上时用于任意版图);SE 规则书 p14 口径为「按版图所示路径相连」,与引擎连通分量实现一致,不改。
- boards.json 现覆盖 1-10/23-30(勘定)+31/32/35/36(占位);11-20/21/22/33/34 未收录(当前玩法范围不需要)。

## boards.json 31/32 号(团队,占位)
- 官方为每队 1 张双面团队版图(31a+31b 标准 / 32a+32b 进阶)。当前占位复用版图 1 几何。
- 2026-09-23 检索:Gamefound/BGG 未找到 31/32 正射组件图;维持占位,待官方图。

## traderoute.json(2026-09-23 更新:tile1-3 high / tile4-12 占位 low)
```jsonc
{ "data": { "tiles": [ { "id": 1, "spaces": [ { "n": 2, "reward": "takeBuilding" }, ... ] } ] } }   // 12 块 × 3 格
```
- `reward` 词表:`workers4|workers2|silver2|silver1|vp4|vp2|takeBuilding|takeShipLivestock|takeMineMonasteryCastle|takeAny`。
- **tile1-3(high,规则书 p14 右栏示例 40x 复核)**:tile1 = 2→takeBuilding / 4→takeMineMonasteryCastle / 1→workers4;tile2 = 6→vp4 / 3→silver2 / 4→takeBuilding;tile3 = **4→takeAny(六色条纹钥匙格,词表外新增,引擎已实现:补给区任拿 1 块)** / 3→takeMineMonasteryCastle / 2→workers4。
- **勘误**:P2 时期「tile3 含 1→workers4」系 12x 误读,40x 下骰面为 2 点(对角两点无中心);已在 notes 标注冲突与裁决依据。
- **待勘定**:tile4-12 在规则书与 Gamefound 全部可用图源中均不可见(代理 B 逐张排查),维持占位;仅 p14 组件堆 3D 图榨出 2 块未知编号板块的部分格(存 `_cob/d4/out/traderoute_tiles.json` partials)。

## vineyard.json(2026-09-23 更新:布袋构成 high / 版图底层 high / 其余占位)
```jsonc
{ "data": {
  "board": { "layers": 4, "spacesPerLayer": 4, "spaces": [ {"layer":0,"slot":0,"n":1,"bonuses":["takeBuilding"]}, ... ] },
  "bagComposition": { "pureColors": ["red","white","yellow","green","blue","purple"], "pureEach": 1, "mixedEach": 3 }
} }
```
- **51 片构成(high,算术+图像双验证)**:6 纯色片各 1 + 15 两两混色各 3 = 51;每色恰出现 16 块,与规则书「3 人局移除 1 色=16 块 / 2 人局移除 2 色=29 块」数字互锁。片上**不印奖励**(奖励印在版图格,规则书 p20「结算其所覆盖的两个奖励行动」)。
- **版图形态(high)**:阶梯式六角网格,空间=双格占位,底层恰 2 位骰点 1/4(p20 官方示例逐字确证;底层 4 位 = takeShipLivestock+workers4)。奖励图标按骰点部分可读:1/2/5=拿建筑,3=拿船/牲畜,4=拿矿/修道院/城堡+4工人,6=未读出(留空,low)。
- **引擎适配**:奖励结算改为 space.bonuses 优先(版图格),片上 bonus 仅作测试/兜底回退;VineBonus 词表新增 workers4。
- **待勘定**:13 个放置位的完整分层(占位 2+3+4+4,官方约 5-6 排阶梯)、4 张版图的逐张差异(官方「four different styles」)、2-3 人局补给区骰点配对、takeAny 之外的新图标(黑仓库拿取/藤奖励板+1 银/改骰)未接引擎。
