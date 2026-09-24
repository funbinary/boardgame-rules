// 联机协议:与 server/internal/play/handler.go 的 serverMsg/clientMsg 对应。
// WS 地址:/api/play/ws?room=xxx(同源,cookie 自动携带)。

export interface ServerRoom {
  ID: string;
  GameKey: string;
  Modules: string;
  Seats: number;
  TurnSeconds: number;
  Status: 'lobby' | 'playing' | 'ended';
  Seed: number;
  HostUserID: number;
  /** 建房客户端的勘定数据指纹(空串=历史房间,跳过校验) */
  DataVersion: string;
}

export interface ServerPlayer { UserID: number; Username: string; Seat: number }

export interface JournalEntry { seq: number; userId: number; move: unknown; hash: string }

export type ServerMsg =
  | { t: 'init'; room: ServerRoom; players: ServerPlayer[]; journal: JournalEntry[]; deadline?: number; name: string }
  | { t: 'started'; room: ServerRoom }
  | { t: 'move'; seq: number; userId: number; move: unknown; hash: string }
  | { t: 'deadline'; deadline: number }
  | { t: 'chat'; userId: number; name: string; text: string }
  | { t: 'presence'; presence: { userId: number; name: string; connected: boolean }[] }
  | { t: 'timeout'; turnSeconds: number }
  | { t: 'pong' }
  | { t: 'error'; code: string; msg: string };

export interface ClientMsg {
  t: 'move' | 'chat' | 'ping';
  seq?: number;
  move?: unknown;
  hash?: string;
  /** 走子后的行动者(客户端报告,用于展示;超时判定不依赖它) */
  next?: number;
  /** 超时代走产生(任何在座玩家可提交,服务器先到先得) */
  timeout?: boolean;
  text?: string;
}
