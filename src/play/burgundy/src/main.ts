import './ui/theme.css';
import { LocalGame } from './ui/controller/local';
import { OnlineFlow } from './ui/controller/net';
import { validateModules } from './engine/modules';

interface ModuleDef { id: string; name: string; desc: string; minPlayers?: number; maxPlayers?: number; incompatible?: string[] }

export const MODULES: ModuleDef[] = [
  { id: 'exp1', name: '额外公国版图(11-18)', desc: '变体公国版图,含"与城堡相连"可选规则' },
  { id: 'exp2', name: '额外六角片', desc: '27/28 号修道院 + 吊车 + 鹅' },
  { id: 'exp3_7', name: '德国冠军赛版图(19-20)', desc: '两张特殊公国版图' },
  { id: 'exp4', name: '边境哨所(第四扩展)', desc: '团队/个人版图 23-30 印 3 个哨所徽章;2 哨所连通按阶段得分(10-2),3 哨所全连通领奖励板块(首位 5/6/7,次位 2/3/4)' },
  { id: 'exp5', name: '白色城堡', desc: '9 个白堡板块,按白骰点数行动' },
  { id: 'exp6', name: '旅店', desc: '旅店提升区域规模' },
  { id: 'exp8', name: '商路', desc: '出售货物上商路格领奖' },
  { id: 'exp9', name: '团队游戏(第九扩展)', desc: '4 人 2v2:共享工人/银币/货物/公国,2 私人+2 共享储存格;团队版图 31/32', minPlayers: 4, maxPlayers: 4 },
  { id: 'exp10', name: '单人游戏', desc: '单人冲目标分变体', minPlayers: 1 },
  { id: 'shields', name: '盾徽', desc: '对子骰拿盾徽,持续效果+纳贡' },
  { id: 'vineyard', name: '葡萄园', desc: '双生六角片与葡萄藤计分' },
  { id: 'automa', name: '自动机', desc: '官方单人 AI 对手(追加虚拟玩家)', minPlayers: 1 },
];

const app = document.getElementById('app')!;

const done = new Set<string>(['exp1', 'exp2', 'exp3_7', 'exp4', 'exp5', 'exp6', 'exp8', 'exp9', 'exp10', 'shields', 'vineyard', 'automa']);
// 引擎已支持:基础 + 第二扩展额外六角片(27/28/29 修道院/吊车/鹅) + 白堡/旅店/商路/盾徽/葡萄园骨架
const implemented = new Set<string>(['exp2', 'exp4', 'exp5', 'exp6', 'exp8', 'exp9', 'shields', 'vineyard', 'automa']);

function home() {
  app.innerHTML = `
  <div class="home">
    <h1>勃艮第城堡 <small>The Castles of Burgundy · 特别典藏版</small></h1>
    <p class="sub">规则书全文见 <a href="/games/bga/castlesofburgundy.html" target="_blank">本站规则页</a> · 玩法实现以该规则书为准</p>
    <div class="modes">
      <button data-mode="solo">🎮 单机(对战自动机)</button>
      <button data-mode="hotseat">👥 同屏热座(2-4 人)</button>
      <button data-mode="online">🌐 好友联机(建房/加入)</button>
    </div>
    <section class="modules">
      <h2>扩展模块${implemented.size ? '' : '<span class="todo">(引擎接入中,勾选暂未生效)</span>'}</h2>
      ${MODULES.map((m) => `
        <label class="module ${done.has(m.id) && !implemented.has(m.id) ? 'wip' : ''}">
          <input type="checkbox" value="${m.id}" ${implemented.has(m.id) ? '' : 'disabled'}>
          <b>${m.name}</b><span>${m.desc}</span>
        </label>`).join('')}
    </section>
    <footer>致敬设计师 Stefan Feld · 特别典藏版由 Awaken Realms 出品 · 本页为原创实现的非官方网页版</footer>
  </div>`;

  app.querySelector('.modes')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button[data-mode]');
    if (!btn) return;
    const mode = (btn as HTMLElement).dataset.mode!;
    const mods = selectedModules();
    if (mode === 'hotseat') setupHotseat(mods);
    else if (mode === 'solo') setupSolo(mods);
    else if (mode === 'online') {
      const flow = new OnlineFlow(app);
      void flow.start();
      (window as unknown as { __cobFlow: OnlineFlow }).__cobFlow = flow;
    }
  });
}

function selectedModules(): string[] {
  return [...app.querySelectorAll('input:checked:not([disabled])')].map((i) => (i as HTMLInputElement).value);
}

function setupHotseat(modules: string[]) {
  const zhNames = (ids: string[]) => ids.map((id) => MODULES.find((m) => m.id === id)?.name ?? id).join(', ');
  app.innerHTML = `
  <div class="setup">
    <h1>同屏热座</h1>
    <label>玩家人数
      <select id="pc">
        <option value="2">2 人</option><option value="3">3 人</option><option value="4" selected>4 人</option>
      </select>
    </label>
    <label>随机种子(留空随机)
      <input id="seed" type="number" placeholder="如 42">
    </label>
    <p class="modnote">已选模块:${modules.length ? zhNames(modules) : '(无,基础玩法)'}</p>
    <div class="btns"><button id="go">开始对局</button> <button id="back">返回</button></div>
  </div>`;
  app.querySelector('#back')!.addEventListener('click', home);
  app.querySelector('#go')!.addEventListener('click', () => {
    const pc = +(app.querySelector('#pc') as HTMLSelectElement).value;
    const bad = validateModules(modules as never, pc);
    if (bad) {
      (app.querySelector('.modnote') as HTMLElement).innerHTML = `<b class="ended">${bad}</b>`;
      return;
    }
    const seedStr = (app.querySelector('#seed') as HTMLInputElement).value.trim();
    const seed = seedStr ? Math.abs(+seedStr | 0) || 42 : Math.floor(Math.random() * 2 ** 31);
    const game = new LocalGame(app, {
      playerCount: pc, seed,
      names: Array.from({ length: pc }, (_, i) => `玩家${i + 1}`),
      modules,
    });
    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'h') game.hint();
    });
  });
}

function setupSolo(modules: string[]) {
  if (!modules.includes('automa')) modules = [...modules, 'automa'];
  app.innerHTML = `
  <div class="setup">
    <h1>单机(对战自动机)</h1>
    <p class="modnote">自动机作为末位玩家加入,按官方规则书郡县卡流程行动(规则书第 22-28 页)。</p>
    <label>难度等级(郡县卡填充得分:入门4/普通5/困难6)
      <select id="difficulty">
        <option value="easy">入门</option>
        <option value="normal" selected>普通</option>
        <option value="hard">困难</option>
      </select>
    </label>
    <fieldset class="modsel">
      <legend>难度修正(入门0项 · 普通1项 · 困难≥2项;可自由搭配)</legend>
      <label><input type="checkbox" value="A"> A · 36号版图预置黑片(少5格,更难拿奖励板块)</label>
      <label><input type="checkbox" value="B"> B · 36号版图预置明片含银矿(少3格+每阶段产银)</label>
      <label><input type="checkbox" value="C"> C · 自动机第一轮先手</label>
      <label><input type="checkbox" value="D"> D · 36号版图「额外回合」格(迁移触发额外行动)</label>
    </fieldset>
    <div class="btns"><button id="go">开始对局</button> <button id="back">返回</button></div>
  </div>`;
  app.querySelector('#back')!.addEventListener('click', home);
  app.querySelector('#go')!.addEventListener('click', () => {
    const difficulty = (app.querySelector('#difficulty') as HTMLSelectElement).value as 'easy' | 'normal' | 'hard';
    const modifiers = [...app.querySelectorAll('.modsel input:checked')].map((i) => (i as HTMLInputElement).value);
    const game = new LocalGame(app, {
      playerCount: 2,
      seed: Math.floor(Math.random() * 2 ** 31),
      names: ['你', '自动机'],
      modules,
      automa: { difficulty, modifiers },
    });
    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'h') game.hint();
    });
  });
}

home();
