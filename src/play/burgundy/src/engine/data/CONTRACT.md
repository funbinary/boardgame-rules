# 数据勘定契约(v1)

所有 `*.json` 由勘定代理产出、复核代理校验。来源优先级:
1. 官方英文规则书 PDF 渲染图 `D:\project\rules\_cob\render\pNN.png`(220dpi,可用 pymupdf 对指定区域二次高倍渲染)
2. 中文规则书扫描 `D:\project\rules\assets\img\bga\castlesofburgundy\pNN.jpg`(1080px,与英文 PDF 同版式,pNN 对应 PDF 的 p(N) )
3. 规则书正文文字 `D:\project\rules\content\bga-zh\castlesofburgundy.html`
4. BGG/Gamefound 图片(标注来源 URL)

统一约定:
- 颜色代码:`yellow|blue|red|gray|green|brown|black`(yellow=修道院 blue=船 red=城堡 gray=银矿 green=牲畜 brown=建筑 black=黑色背面)
- 不确定的条目必须带 `"confidence": "low"` 与 `"note": "原因"`,禁止猜测后不标注。
- 每个文件顶层 `{"_meta": {"sources": [...], "verifiedBy": []}, "data": ...}`。

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
- 37 格/版图。`r` 行 0 起自上而下,`c` 列 0 起自左而右(尖顶六角,奇数行向右错半格)。
- 版图 23-30 的格加 `"outpost": 序号`。
- 无法勘定的版图仍要占位:`"cells": [], "confidence":"missing"`。

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
