import { PieceShape } from './pieces.js';

export const BOARD_SIZE = 8;
export const MATCH_DURATION_SECONDS = 180; // 3 minutes
export const DEFAULT_ELO = 1000;
export const ELO_K_FACTOR = 32;

export interface GridCell {
  color: string;
  glowColor?: string;
  id?: string;
  isGarbage?: boolean;
  turnsRemaining?: number;
}

export type BoardGrid = (GridCell | null)[][];

export interface PlayerInfo {
  id: string;
  name: string;
  elo: number;
  isBot?: boolean;
}

export interface ActivePiece {
  piece: PieceShape;
  index: number;
  placed: boolean;
}

export const INITIAL_HP = 1000;

export interface BoardState {
  playerId: string;
  grid: BoardGrid;
  score: number;
  comboStreak: number;
  activePieces: (ActivePiece | null)[];
  isKnockedOut: boolean;
  lastClearedLines: number;
  round: number;
  hp: number;
  maxHp: number;
  lastDamageDealt?: number;
  lastDamageTaken?: number;
  incomingDamage?: number;
}

export interface OpponentBoardState {
  playerId: string;
  name: string;
  elo: number;
  grid: BoardGrid;
  score: number;
  comboStreak: number;
  isKnockedOut: boolean;
  activePiecesCount: number;
  hp: number;
  maxHp: number;
  lastDamageDealt?: number;
  lastDamageTaken?: number;
  incomingDamage?: number;
}

export interface LineClearResult {
  rows: number[];
  cols: number[];
  totalLines: number;
  pointsEarned: number;
  comboStreak: number;
  garbageSent: number;
  isBoardCleared: boolean;
  damageDealt: number;
  isCritical: boolean;
}

export interface SoloLeaderboardEntry {
  id: string;
  name: string;
  score: number;
  maxCombo: number;
  linesCleared: number;
  date: number;
}

// Client -> Server Action Payloads
export type ClientMessage =
  | { type: 'JOIN_QUEUE'; playerName: string }
  | { type: 'LEAVE_QUEUE' }
  | { type: 'PLACE_PIECE'; pieceIndex: number; x: number; y: number }
  | { type: 'EMOTE'; emoji: string }
  | { type: 'PING'; timestamp: number }
  | { type: 'CREATE_ROOM'; playerName: string }
  | { type: 'JOIN_ROOM'; roomCode: string; playerName: string; asSpectator?: boolean }
  | { type: 'START_ROOM_MATCH' }
  | { type: 'LEAVE_ROOM' };

// Server -> Client Action Payloads
export type ServerMessage =
  | {
      type: 'WELCOME';
      playerId: string;
      defaultName: string;
      elo: number;
    }
  | {
      type: 'QUEUE_STATUS';
      inQueue: boolean;
      queueTimeSeconds: number;
      searchRadius: number;
    }
  | {
      type: 'ROOM_CREATED';
      roomCode: string;
    }
  | {
      type: 'ROOM_UPDATE';
      roomCode: string;
      host: PlayerInfo;
      guest: PlayerInfo | null;
      spectators: PlayerInfo[];
      status: 'LOBBY' | 'PLAYING' | 'FINISHED';
      isHost: boolean;
      myRole: 'PLAYER' | 'SPECTATOR';
    }
  | {
      type: 'SPECTATOR_STATE_UPDATE';
      roomCode: string;
      playerABoard: BoardState;
      playerBBoard: BoardState;
      playerAInfo: PlayerInfo;
      playerBInfo: PlayerInfo;
      timeRemaining: number;
      spectatorCount: number;
    }
  | {
      type: 'MATCH_START';
      matchId: string;
      opponent: PlayerInfo;
      seed: number;
      timeRemaining: number;
      yourPieces: PieceShape[];
    }
  | {
      type: 'STATE_UPDATE';
      localBoard: BoardState;
      opponentBoard: OpponentBoardState;
      timeRemaining: number;
    }
  | {
      type: 'LINE_CLEARED';
      playerId: string;
      rows: number[];
      cols: number[];
      count: number;
      comboStreak: number;
      pointsEarned: number;
    }
  | {
      type: 'ATTACK_EVENT';
      fromPlayerId: string;
      toPlayerId: string;
      count: number;
      combo: number;
      damage: number;
      isCritical: boolean;
      targetRemainingHp: number;
    }
  | {
      type: 'COUNTER_EVENT';
      playerId: string;
      damageMitigated: number;
      counterDamage: number;
    }
  | {
      type: 'EMOTE_EVENT';
      fromPlayerId: string;
      emoji: string;
    }
  | {
      type: 'MATCH_END';
      winnerId: string | null;
      reason: 'KO' | 'TIMEOUT' | 'SURRENDER' | 'HP_ZERO' | 'DEADLOCK';
      yourScore: number;
      opponentScore: number;
      oldElo: number;
      newElo: number;
      eloDelta: number;
    }
  | {
      type: 'ERROR';
      message: string;
    }
  | {
      type: 'PONG';
      timestamp: number;
    };
