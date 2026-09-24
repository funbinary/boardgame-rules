// 联机控制器:大厅 → 房间 → 对局。走子经 PlayClient 提交,状态由服务器广播驱动重放。
import { autopilotPick } from '../../ai/autopilot';
import { dataVersion } from '../../engine/dataVersion';
import { actorOf, legalMoves } from '../../engine/moves';
import type { GameState, Move } from '../../engine/state';
import { PlayClient, type NetStatus } from '../../net/client';
import type { ServerMsg, ServerPlayer, ServerRoom } from '../../net/protocol';
import { renderGame, type UiSelection } from '../views';
import { renderLobby, renderRoom } from '../views-lobby';
import { escapeHtml } from '../svg';

interface Me { id: number; username: string }

export class OnlineFlow {
  private client: PlayClient | null = null;
  sel: UiSelection = { die: null, storage: null };
  me: Me | null = null;
  room: ServerRoom | null = null;
  players: ServerPlayer[] = [];
  connected: { userId: number }[] = [];
  mySeat = -1;
  deadline = 0;
  private timerInt: number | null = null;

  constructor(private root: HTMLElement) {
    root.addEventListener('click', (e) => this.onRootClick(e));
  }

  /** 对局区点击委托:选骰/选储存格本地处理,其余匹配走子提交 */
  private onRootClick(e: Event) {
    const el = (e.target as HTMLElement).closest(
      '[data-die],[data-storage],[data-r],[data-depot],[data-cell],[data-moddie],[data-sellcolor],[data-shipdepot],[data-takeshield],[data-takeshieldfree],[data-skipshieldfree],[data-setdie],[data-shield5],[data-shield6],[data-freeplace],[data-skipfreeplace],[data-freeblack],[data-freetwin],[data-vinebonus],[data-vslot],[data-vspace],[data-shopcell],[id],.black-tile,.depot-goods,.goods',
    ) as HTMLElement | null;
    if (!el) return;
    const g = this.client?.state;
    if (!g || !this.room || this.room.Status !== 'playing') return;
    const d = el.dataset;
    if (d.die !== undefined && el.classList.contains('die')) {
      this.sel.die = +d.die! as 0 | 1;
      this.onState(g);
      return;
    }
    if (d.storage !== undefined) {
      this.sel.storage = +d.storage!;
      this.onState(g);
      return;
    }
    this.handleUIClick(el);
  }

  async start() {
    this.me = await fetchMe();
    this.renderLobby();
  }

  // ---------- 大厅 ----------
  renderLobby() {
    this.root.innerHTML = renderLobby(this.me);
    const back = this.root.querySelector('#back');
    back?.addEventListener('click', () => { location.hash = ''; location.reload(); });
    if (!this.me) {
      const form = this.root.querySelector('#login-form') as HTMLFormElement;
      const errEl = this.root.querySelector('#login-err') as HTMLElement;
      form.addEventListener('submit', (e) => { e.preventDefault(); void this.auth('login', form, errEl); });
      this.root.querySelector('#do-register')?.addEventListener('click', () => void this.auth('register', form, errEl));
      return;
    }
    const createForm = this.root.querySelector('#create-form') as HTMLFormElement;
    createForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(createForm);
      void this.api('POST', '/api/play/rooms', {
        gameKey: 'burgundy',
        seats: +(fd.get('seats') || 2),
        turnSeconds: +(fd.get('turnSeconds') || 90),
        modules: [],
        dataVersion: dataVersion(),
      }).then((out) => {
        const room = out?.room as ServerRoom | undefined;
        if (room?.ID) this.enterRoom(room.ID);
      });
    });
    const joinForm = this.root.querySelector('#join-form') as HTMLFormElement;
    joinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = String(new FormData(joinForm).get('room') || '').trim().toLowerCase();
      if (!code) return;
      void this.api('POST', `/api/play/rooms/${encodeURIComponent(code)}/join`).then(() => this.enterRoom(code));
    });
    void this.loadMyRooms();
  }

  private async loadMyRooms() {
    const out = await this.api('GET', '/api/play/rooms');
    const rooms = (out?.rooms as ServerRoom[] | undefined) ?? [];
    const box = this.root.querySelector('#my-rooms');
    if (box && rooms.length) {
      box.innerHTML = `<h2>我的房间</h2>` + rooms.map((r) =>
        `<div class="myroom"><code>${r.ID}</code> ${r.Status === 'lobby' ? '等待中' : '进行中'} · ${r.Seats} 人 · ${r.TurnSeconds}s <button data-room="${r.ID}">进入</button></div>`).join('');
      box.querySelectorAll('button[data-room]').forEach((b) => b.addEventListener('click', () => this.enterRoom((b as HTMLElement).dataset.room!)));
    }
  }

  private async auth(kind: 'login' | 'register', form: HTMLFormElement, errEl: HTMLElement) {
    const fd = new FormData(form);
    const out = await this.api('POST', `/api/${kind}`, { username: fd.get('u'), password: fd.get('p') });
    if (out?.ok || out?.user || out?.username) {
      this.me = await fetchMe();
      this.renderLobby();
    } else {
      errEl.textContent = String(out?.msg ?? out?.error ?? '失败(注册密码需 8 位以上且含字母和数字)');
    }
  }

  private async api(method: string, url: string, body?: unknown): Promise<Record<string, unknown> | null> {
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const out = await res.json().catch(() => null);
      if (!res.ok && out) {
        const errEl = this.root.querySelector('#lobby-err,#room-err');
        if (errEl) errEl.textContent = String(out.msg || out.error || res.status);
        return out;
      }
      return out as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  // ---------- 房间 ----------
  enterRoom(roomID: string) {
    this.cleanup();
    this.client = new PlayClient(
      roomID,
      (seed, _mods, seats) => makeState(seed, seats),
      {
        onStatus: (s) => this.onNetStatus(s),
        onMsg: (m) => void this.onMsg(m),
        onState: (g) => this.onState(g),
        onDesync: (e, got) => this.flash(`状态不一致(期望 ${e.slice(0, 6)} 实得 ${got.slice(0, 6)}),已自动重同步`),
        onVersionMismatch: (rv, lv) => this.showVersionMismatch(rv, lv),
      },
    );
    this.client.connect();
  }

  private renderRoomPage() {
    if (!this.room) return;
    this.root.innerHTML = renderRoom(this.room, this.players, this.me?.id ?? 0, this.connected);
    this.root.querySelector('#room-start')?.addEventListener('click', () => {
      void this.api('POST', `/api/play/rooms/${this.room!.ID}/start`);
    });
    const chatForm = this.root.querySelector('#chat-form') as HTMLFormElement | null;
    chatForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = String(new FormData(chatForm).get('text') || '').trim();
      if (text) this.client?.send({ t: 'chat', text });
      chatForm.reset();
    });
    const back = this.root.querySelector('#back');
    back?.addEventListener('click', () => { location.hash = ''; location.reload(); });
  }

  /** 房间信息补拉(座位/状态),完成后若已开局则重渲染对局 */
  private async refreshRoomInfo() {
    if (!this.client) return;
    const out = await this.api('GET', `/api/play/rooms/${this.client.roomID}`);
    if (!out) return;
    this.room = out.room as ServerRoom;
    this.players = (out.players as ServerPlayer[]) ?? [];
    if (this.room?.Status === 'playing' && this.client.state) {
      this.onState(this.client.state);
    }
  }

  private onNetStatus(s: NetStatus) {
    const el = this.root.querySelector('.net-status');
    if (el) el.textContent = s === 'open' ? '已连接' : s === 'reconnecting' ? '重连中…' : s === 'connecting' ? '连接中…' : '已断开';
  }

  private async onMsg(m: ServerMsg) {
    if (m.t === 'chat') {
      const box = this.root.querySelector('#room-chat') ?? this.root.querySelector('#game-chat');
      if (box) {
        const div = document.createElement('div');
        div.innerHTML = `<b>${escapeHtml(m.name)}</b> ${escapeHtml(m.text)}`;
        box.appendChild(div);
        box.scrollTop = box.scrollHeight;
      }
    } else if (m.t === 'init' || m.t === 'started') {
      // 刷新房间页(人数/状态可能变化)
      const out = await this.api('GET', `/api/play/rooms/${this.client!.roomID}`);
      if (out) {
        this.room = out.room as ServerRoom;
        this.players = (out.players as ServerPlayer[]) ?? [];
      }
      if (m.t === 'started' && this.room) this.room.Status = 'playing';
      if (this.room && this.room.Status !== 'playing') {
        this.renderRoomPage();
        const statusEl = document.createElement('div');
        statusEl.className = 'net-status';
        this.root.querySelector('.room-page')?.appendChild(statusEl);
      }
    } else if (m.t === 'presence') {
      this.connected = m.presence;
      if (this.room && this.room.Status !== 'playing') this.renderRoomPage();
    }
  }

  // ---------- 对局 ----------
  private onState(g: GameState | null) {
    if (!g) return;
    // 以客户端协议层为准同步房间副本(started 消息先于 REST 刷新到达是常态)
    if (this.client?.room) this.room = this.client.room;
    if (!this.room || this.room.Status !== 'playing') return;
    // 我的座位(引擎玩家序号 = 座位号);players 未就绪时先补拉
    const me = this.players.find((p) => p.UserID === this.me?.id);
    this.mySeat = me ? me.Seat : -1;
    if (this.mySeat < 0) {
      void this.refreshRoomInfo();
      return;
    }
    const actor = actorOf(g);
    const myMove = actor === this.mySeat;
    if (this.sel.die != null && g.turn.used[this.sel.die] && g.turn.player !== this.mySeat) this.sel.die = null;
    if (this.sel.die == null && myMove && !g.turn.used[0] && g.turn.used[1]) this.sel.die = 0;
    if (this.sel.die == null && myMove && g.turn.used[0] && !g.turn.used[1]) this.sel.die = 1;

    const gameHtml = renderGame(g, this.sel);
    const wrap = document.createElement('div');
    wrap.innerHTML = gameHtml;
    // 对局容器替换(聊天/状态条保留在 wrap 外层)
    this.root.innerHTML = '';
    const status = document.createElement('div');
    status.className = 'net-bar';
    status.innerHTML = `<span class="net-status">已连接</span> · 房间 <code>${this.room.ID}</code>
      <span class="turninfo">${myMove ? '<b>轮到你了</b>' : `等待 ${escapeHtml(g.players[actor].name)}…`}</span>
      <span class="countdown"></span>`;
    const chat = document.createElement('div');
    chat.className = 'game-chat-wrap';
    chat.innerHTML = `<div class="game-chat" id="game-chat"></div>
      <form id="chat-form"><input name="text" maxlength="200" placeholder="聊天…"><button type="submit">发</button></form>`;
    this.root.appendChild(status);
    this.root.appendChild(wrap.firstElementChild!);
    this.root.appendChild(chat);
    const chatForm = this.root.querySelector('#chat-form') as HTMLFormElement;
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = String(new FormData(chatForm).get('text') || '').trim();
      if (text) this.client?.send({ t: 'chat', text });
      chatForm.reset();
    });
    if (!myMove) {
      // 非我回合:遮罩点击
      (this.root.querySelector('.game-grid') as HTMLElement)?.classList.add('not-my-turn');
    }
    this.startCountdown();
  }

  private startCountdown() {
    if (this.timerInt) clearInterval(this.timerInt);
    this.timerInt = window.setInterval(() => {
      const el = this.root.querySelector('.countdown');
      if (!el || !this.client?.deadlineMs) { if (el) el.textContent = ''; return; }
      const left = Math.max(0, Math.ceil((this.client.deadlineMs - Date.now()) / 1000));
      el.textContent = left > 0 ? `⏱ ${left}s` : '';
    }, 500);
  }

  /** UI 点击 → 匹配合法走子 → 提交(与热座同一套匹配逻辑) */
  handleUIClick(target: HTMLElement): boolean {
    const g = this.client?.state;
    if (!g || !this.room || this.room.Status !== 'playing') return false;
    const actor = actorOf(g);
    if (actor !== this.mySeat) { this.flash('还没轮到你'); return true; }
    const move = matchMove(g, this.sel, target);
    if (move) {
      this.client!.submitMove(g, move);
      this.sel = { die: this.sel.die, storage: null };
      return true;
    }
    return false;
  }

  setSel(s: UiSelection) { this.sel = s; }
  getSel(): UiSelection { return this.sel; }
  getState(): GameState | null { return this.client?.state ?? null; }
  getClient(): PlayClient | null { return this.client; }

  /** 模块清单(联机用,与房间 modules_json 一致) */
  getModules(): string[] {
    if (!this.room) return [];
    try { return JSON.parse(this.room.Modules || '[]') as string[]; } catch { return []; }
  }

  private flash(text: string) {
    const bar = document.createElement('div');
    bar.className = 'flash';
    bar.textContent = text;
    document.body.appendChild(bar);
    setTimeout(() => bar.remove(), 1600);
  }

  /** 数据指纹不一致:同种子重放会分叉,整页拦截(站点更新后进旧房间的典型场景) */
  private showVersionMismatch(roomV: string, localV: string) {
    this.client?.close();
    this.root.innerHTML = `<div class="setup"><div class="panel">
      <h2>数据版本不一致</h2>
      <p>该房间由旧版本勘定数据创建,与当前数据不兼容;继续对局会导致状态分叉。</p>
      <p class="err">房间 <code>${escapeHtml(roomV)}</code> · 本地 <code>${escapeHtml(localV)}</code></p>
      <p>请返回大厅重建房间;若站点刚更新,请让所有玩家刷新页面后再进。</p>
      <button id="vm-back">返回大厅</button>
    </div></div>`;
    this.root.querySelector('#vm-back')?.addEventListener('click', () => { location.hash = ''; location.reload(); });
  }

  cleanup() {
    this.client?.close();
    if (this.timerInt) clearInterval(this.timerInt);
  }
}

// ---------- 走子匹配(与 LocalGame.onClick 同源逻辑,抽出共用) ----------
export function matchMove(g: GameState, sel: UiSelection, el: HTMLElement): Move | null {
  const moves = legalMoves(g);
  const d = (s: string) => el.dataset[s];
  const pick = (pred: (m: Move) => boolean): Move | null => moves.find(pred) ?? null;
  const unusedDie = (): 0 | 1 | 'bonus' => {
    const t = g.turn;
    if (!t.used[0]) return 0;
    if (!t.used[1]) return 1;
    return 'bonus';
  };

  if (el.id === 'btn-workers') {
    const die = sel.die ?? unusedDie();
    return pick((mv) => mv.t === 'takeWorkers' && mv.die === die);
  }
  if (el.id === 'btn-undo') return null; // 联机不支持撤销
  if (el.id === 'btn-buyinn') return pick((mv) => mv.t === 'buyInn');
  if (d('moddie') != null) {
    const die = +(d('moddie')!) as 0 | 1;
    const delta = +(d('delta')!) as 1 | -1;
    return pick((mv) => mv.t === 'modDie' && mv.die === die && mv.delta === delta);
  }
  if (d('shipdepot') != null) {
    return pick((mv) => mv.t === 'answerShipGoods' && mv.depot === +d('shipdepot')!);
  }
  if (d('sellcolor') != null && !el.classList.contains('goods')) {
    return pick((mv) => mv.t === 'answerWarehouseSell' && mv.color === +d('sellcolor')!);
  }
  if (d('die') != null && el.classList.contains('die')) return 'SEL_DIE' as unknown as Move; // 选骰由调用方处理
  if (d('storage') != null) return 'SEL_STORAGE' as unknown as Move;
  if (d('r') != null && d('c') != null) {
    const r = +d('r')!, c = +d('c')!;
    const top = g.pending[g.pending.length - 1];
    if (top?.kind === 'initialCastle') return pick((mv) => mv.t === 'placeCastle' && mv.r === r && mv.c === c);
    if (top?.kind === 'freePlace') return pick((mv) => mv.t === 'answerFreePlace' && mv.r === r && mv.c === c);
    if (sel.storage != null) {
      const die = sel.die ?? unusedDie();
      return pick((mv) => mv.t === 'place' && mv.r === r && mv.c === c && mv.storage === sel.storage && (mv.die === die || mv.die === 'bonus'))
        ?? pick((mv) => mv.t === 'place' && mv.r === r && mv.c === c);
    }
    const m = pick((mv) => mv.t === 'place' && mv.r === r && mv.c === c) as Extract<Move, { t: 'place' }> | null;
    if (m && m.die === 'bonus') return m;
    return null;
  }
  // ---- P2 扩展(与 LocalGame.onClick 同源) ----
  if (d('takeshield') != null) {
    const [depot, idx] = d('takeshield')!.split(':').map(Number);
    return pick((mv) => mv.t === 'takeShield' && mv.depot === depot && mv.idx === idx);
  }
  if (d('takeshieldfree') != null) {
    const [depot, idx] = d('takeshieldfree')!.split(':').map(Number);
    return pick((mv) => mv.t === 'takeShieldFree' && mv.depot === depot && mv.idx === idx);
  }
  if (d('skipshieldfree') != null) return pick((mv) => mv.t === 'skipShieldFree');
  if (d('setdie') != null) {
    const [die, value] = d('setdie')!.split(':').map(Number);
    return pick((mv) => mv.t === 'setDie' && mv.die === die && mv.value === value);
  }
  if (d('shield5') != null) return pick((mv) => mv.t === 'answerShield5' && mv.color === +d('shield5')!);
  if (d('shield6') != null) return pick((mv) => mv.t === 'answerShield6' && mv.player === +d('shield6')!);
  if (d('freeplace') != null) return moves.filter((mv) => mv.t === 'answerFreePlace')[+d('freeplace')!] ?? null;
  if (d('skipfreeplace') != null) return pick((mv) => mv.t === 'skipFreePlace');
  if (d('freeblack') != null) {
    const [source, cell] = d('freeblack')!.split(':');
    return pick((mv) => mv.t === 'answerFreeBlack' && mv.source === source && mv.cell === +cell);
  }
  if (d('freetwin') != null) return pick((mv) => mv.t === 'answerFreeTwin' && mv.slot === +d('freetwin')!);
  if (d('vinebonus') != null) return pick((mv) => mv.t === 'takeVineBonus' && mv.type === d('vinebonus'));
  if (d('vslot') != null) {
    const die = sel.die ?? unusedDie();
    return pick((mv) => mv.t === 'takeTwin' && mv.slot === +d('vslot')! && (mv.die === die || mv.die === 'bonus'));
  }
  if (d('vspace') != null) {
    const storage = sel.storage ?? g.players[g.turn.player].storage.findIndex((s) => s?.twin);
    const rot = (+d('vrot')!) as 0 | 1;
    return pick((mv) => mv.t === 'placeTwin' && mv.space === d('vspace') && mv.rot === rot && mv.storage === storage)
      ?? pick((mv) => mv.t === 'placeTwin' && mv.space === d('vspace') && mv.rot === rot);
  }
  if (d('shopcell') != null) return pick((mv) => mv.t === 'buyBlack' && mv.shop === true && mv.cell === +d('shopcell')!);
  const depot = d('depot');
  const cell = d('cell');
  if (depot != null && cell != null) {
    const dep = +depot, ce = +cell;
    const answer = pick((mv) => mv.t === 'answerTake' && mv.depot === dep && mv.cell === ce);
    if (answer) return answer;
    const die = sel.die ?? unusedDie();
    return pick((mv) => mv.t === 'take' && mv.depot === dep && mv.cell === ce && (mv.die === die || mv.die === 'bonus'));
  }
  if (el.classList.contains('black-tile') && cell != null) {
    return pick((mv) => mv.t === 'buyBlack' && mv.cell === +cell!);
  }
  if (el.classList.contains('depot-goods') && depot != null) {
    return pick((mv) => mv.t === 'answerShipGoods' && mv.depot === +depot);
  }
  if (el.classList.contains('goods') && d('sellcolor') != null) {
    const die = sel.die ?? unusedDie();
    return pick((mv) => mv.t === 'sell' && mv.die === die);
  }
  return null;
}

// ---------- 工具 ----------
async function fetchMe(): Promise<Me | null> {
  try {
    const res = await fetch('/api/me');
    const out = await res.json();
    // /api/me 直接返回 {id, username, ...} 或 {error}
    if (out && typeof out.id === 'number' && typeof out.username === 'string') {
      return { id: out.id, username: out.username };
    }
    return null;
  } catch { return null; }
}

// 延迟装载引擎建局(与热座一致;模块接入后这里读房间 Modules)
import { createGame } from '../../engine/setup';
function makeState(seed: number, seats: number): GameState | null {
  try {
    return createGame({ seed, playerCount: seats });
  } catch { return null; }
}
