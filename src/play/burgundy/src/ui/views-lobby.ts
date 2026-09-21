// 联机大厅与房间等待页视图。
import type { ServerPlayer, ServerRoom } from '../net/protocol';
import { escapeHtml } from './svg';

export function renderLobby(me: { id: number; username: string } | null): string {
  if (!me) {
    return `<div class="setup">
      <h1>好友联机</h1>
      <p>联机对战需要登录(免费注册,与站内收藏共用账号)。</p>
      <form id="login-form">
        <label>用户名 <input name="u" required maxlength="24"></label>
        <label>密码 <input name="p" type="password" required minlength="8" maxlength="72" placeholder="8位以上,含字母和数字"></label>
        <div class="btns">
          <button type="submit" id="do-login">登录</button>
          <button type="button" id="do-register">注册</button>
        </div>
        <p id="login-err" class="err"></p>
      </form>
      <button id="back">返回</button>
    </div>`;
  }
  return `<div class="setup">
    <h1>好友联机 <small>你好,${escapeHtml(me.username)}</small></h1>
    <form id="create-form">
      <h2>建房</h2>
      <label>人数 <select name="seats">
        <option value="2">2 人</option><option value="3">3 人</option><option value="4">4 人</option>
      </select></label>
      <label>每回合限时
        <select name="turnSeconds">
          <option value="60">60 秒</option>
          <option value="90" selected>90 秒</option>
          <option value="180">180 秒</option>
        </select>
      </label>
      <button type="submit">创建房间</button>
    </form>
    <form id="join-form">
      <h2>加入</h2>
      <label>房间码 <input name="room" required maxlength="8" placeholder="如 7k3p9x" style="text-transform:uppercase"></label>
      <button type="submit">加入房间</button>
    </form>
    <div id="my-rooms"></div>
    <p id="lobby-err" class="err"></p>
    <button id="back">返回</button>
  </div>`;
}

export function renderRoom(room: ServerRoom, players: ServerPlayer[], myUserId: number, connected: { userId: number }[]): string {
  const isHost = room.HostUserID === myUserId;
  const seats = Array.from({ length: room.Seats }, (_, i) => {
    const p = players.find((x) => x.Seat === i);
    const online = p && connected.some((c) => c.userId === p.UserID);
    return `<div class="seat ${p ? '' : 'empty'}">
      <b>座位 ${i + 1}</b>
      ${p ? `${escapeHtml(p.Username)} ${online ? '<span class="online">在线</span>' : '<span class="offline">离线</span>'}${p.UserID === room.HostUserID ? ' 👑' : ''}` : '空位'}
    </div>`;
  }).join('');
  const modules = JSON.parse(room.Modules || '[]') as string[];
  return `<div class="setup room-page">
    <h1>房间 <code class="room-code">${room.ID}</code></h1>
    <p>把房间码发给好友,在联机大厅输入即可加入。</p>
    <div class="seats">${seats}</div>
    <p class="meta">限时 ${room.TurnSeconds} 秒/回合 · ${modules.length ? `模块:${modules.join('、')}` : '基础玩法'} · ${room.Status === 'playing' ? '对局进行中' : '等待开始'}</p>
    ${isHost && room.Status === 'lobby' ? `<button id="room-start" ${players.length === room.Seats ? '' : 'disabled'}>开始对局${players.length < room.Seats ? `(${players.length}/${room.Seats})` : ''}</button>` : ''}
    ${room.Status === 'playing' ? '<p>对局已开始,正在进入…</p>' : ''}
    <div id="room-chat" class="room-chat"></div>
    <form id="chat-form"><input name="text" maxlength="200" placeholder="聊天…"><button type="submit">发送</button></form>
    <p id="room-err" class="err"></p>
  </div>`;
}
