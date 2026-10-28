import { WebSocket } from 'ws';
import {
  PlayerInfo,
  BoardState,
  ServerMessage,
  MATCH_DURATION_SECONDS
} from '../shared/types.js';
import { GameEngine } from './gameEngine.js';

export interface RoomParticipant {
  info: PlayerInfo;
  ws: WebSocket;
}

export interface CustomRoom {
  code: string;
  host: RoomParticipant;
  guest: RoomParticipant | null;
  spectators: Map<string, RoomParticipant>;
  status: 'LOBBY' | 'PLAYING' | 'FINISHED';
  matchId: string | null;
  seed: number;
  boardA: BoardState | null;
  boardB: BoardState | null;
  timeRemaining: number;
  timer: NodeJS.Timeout | null;
}

export class RoomManager {
  private rooms = new Map<string, CustomRoom>();
  private playerToRoom = new Map<string, string>(); // playerId -> roomCode

  private sendMessage(ws: WebSocket | undefined, msg: ServerMessage) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return this.rooms.has(code) ? this.generateCode() : code;
  }

  public getRoomByPlayer(playerId: string): CustomRoom | undefined {
    const code = this.playerToRoom.get(playerId);
    return code ? this.rooms.get(code) : undefined;
  }

  public createRoom(player: PlayerInfo, ws: WebSocket): CustomRoom {
    // Remove from existing room if any
    this.removePlayer(player.id);

    const code = this.generateCode();
    const room: CustomRoom = {
      code,
      host: { info: player, ws },
      guest: null,
      spectators: new Map(),
      status: 'LOBBY',
      matchId: null,
      seed: 0,
      boardA: null,
      boardB: null,
      timeRemaining: MATCH_DURATION_SECONDS,
      timer: null
    };

    this.rooms.set(code, room);
    this.playerToRoom.set(player.id, code);

    this.sendMessage(ws, {
      type: 'ROOM_CREATED',
      roomCode: code
    });

    this.broadcastRoomUpdate(room);
    return room;
  }

  public joinRoom(
    roomCode: string,
    player: PlayerInfo,
    ws: WebSocket,
    forceSpectator = false
  ): { success: boolean; error?: string; role?: 'PLAYER' | 'SPECTATOR' } {
    const normalizedCode = roomCode.trim().toUpperCase();
    const room = this.rooms.get(normalizedCode);

    if (!room) {
      return { success: false, error: 'Phòng không tồn tại hoặc đã bị đóng' };
    }

    this.removePlayer(player.id);
    this.playerToRoom.set(player.id, normalizedCode);

    // If room is already full or playing, or user requested spectator: join as Spectator
    const canJoinAsPlayer = !forceSpectator && room.guest === null && room.status === 'LOBBY';

    if (canJoinAsPlayer) {
      room.guest = { info: player, ws };
      this.broadcastRoomUpdate(room);
      return { success: true, role: 'PLAYER' };
    } else {
      room.spectators.set(player.id, { info: player, ws });
      this.broadcastRoomUpdate(room);

      // If already playing, immediately sync live spectator board state
      if (room.status === 'PLAYING' && room.boardA && room.boardB) {
        this.sendMessage(ws, {
          type: 'SPECTATOR_STATE_UPDATE',
          roomCode: room.code,
          playerABoard: room.boardA,
          playerBBoard: room.boardB,
          playerAInfo: room.host.info,
          playerBInfo: room.guest?.info || { id: 'unknown', name: 'Player 2', elo: 1000 },
          timeRemaining: room.timeRemaining,
          spectatorCount: room.spectators.size
        });
      }

      return { success: true, role: 'SPECTATOR' };
    }
  }

  public startRoomMatch(roomCode: string, playerId: string): { success: boolean; error?: string } {
    const room = this.rooms.get(roomCode);
    if (!room) return { success: false, error: 'Phòng không tồn tại' };

    if (room.host.info.id !== playerId) {
      return { success: false, error: 'Chỉ có Trưởng phòng (Host) mới có quyền bắt đầu trận đấu' };
    }

    if (!room.guest) {
      return { success: false, error: 'Cần đủ 2 người chơi để bắt đầu trận đấu' };
    }

    room.status = 'PLAYING';
    room.seed = Math.floor(Math.random() * 1000000);
    room.matchId = `room_match_${Date.now()}_${room.code}`;
    room.timeRemaining = MATCH_DURATION_SECONDS;

    room.boardA = GameEngine.initPlayerBoard(room.host.info.id, room.seed);
    room.boardB = GameEngine.initPlayerBoard(room.guest.info.id, room.seed);

    // Send MATCH_START to Host
    this.sendMessage(room.host.ws, {
      type: 'MATCH_START',
      matchId: room.matchId,
      opponent: room.guest.info,
      seed: room.seed,
      timeRemaining: MATCH_DURATION_SECONDS,
      yourPieces: room.boardA.activePieces.map(ap => ap!.piece)
    });

    // Send MATCH_START to Guest
    this.sendMessage(room.guest.ws, {
      type: 'MATCH_START',
      matchId: room.matchId,
      opponent: room.host.info,
      seed: room.seed,
      timeRemaining: MATCH_DURATION_SECONDS,
      yourPieces: room.boardB.activePieces.map(ap => ap!.piece)
    });

    // Start 1-second interval ticker
    room.timer = setInterval(() => {
      room.timeRemaining -= 1;
      if (room.timeRemaining <= 0) {
        this.finishRoomMatch(room, 'TIMEOUT');
      } else {
        this.broadcastLiveMatchState(room);
      }
    }, 1000);

    // Notify spectators
    this.broadcastLiveMatchState(room);
    this.broadcastRoomUpdate(room);

    return { success: true };
  }

  public handlePiecePlacement(
    room: CustomRoom,
    playerId: string,
    pieceIndex: number,
    x: number,
    y: number
  ) {
    if (room.status !== 'PLAYING' || !room.boardA || !room.boardB || !room.guest) return;

    const isHost = room.host.info.id === playerId;
    const currentSide = isHost ? room.host : room.guest;
    const opponentSide = isHost ? room.guest : room.host;
    const currentBoard = isHost ? room.boardA : room.boardB;
    const opponentBoard = isHost ? room.boardB : room.boardA;

    const moveResult = GameEngine.applyMove(
      currentBoard,
      pieceIndex,
      x,
      y,
      room.seed
    );

    if (!moveResult.success) {
      this.sendMessage(currentSide.ws, {
        type: 'ERROR',
        message: moveResult.error || 'Nước đi không hợp lệ'
      });
      return;
    }

    // Line clear broadcast to players and spectators
    if (moveResult.clearResult && moveResult.clearResult.totalLines > 0) {
      const clearMsg: ServerMessage = {
        type: 'LINE_CLEARED',
        playerId,
        rows: moveResult.clearResult.rows,
        cols: moveResult.clearResult.cols,
        count: moveResult.clearResult.totalLines,
        comboStreak: moveResult.clearResult.comboStreak,
        pointsEarned: moveResult.clearResult.pointsEarned
      };

      this.sendMessage(currentSide.ws, clearMsg);
      this.sendMessage(opponentSide.ws, clearMsg);
      for (const spec of room.spectators.values()) {
        this.sendMessage(spec.ws, clearMsg);
      }
    }

    // Garbage attack
    if (moveResult.garbageSentToOpponent > 0) {
      GameEngine.injectGarbage(opponentBoard.grid, moveResult.garbageSentToOpponent);
      const attackMsg: ServerMessage = {
        type: 'ATTACK_EVENT',
        fromPlayerId: playerId,
        toPlayerId: opponentSide.info.id,
        count: moveResult.garbageSentToOpponent,
        combo: moveResult.clearResult?.comboStreak || 1
      };
      this.sendMessage(currentSide.ws, attackMsg);
      this.sendMessage(opponentSide.ws, attackMsg);
      for (const spec of room.spectators.values()) {
        this.sendMessage(spec.ws, attackMsg);
      }
    }

    // Check KO
    if (currentBoard.isKnockedOut) {
      this.finishRoomMatch(room, 'KO', opponentSide.info.id);
      return;
    }

    this.broadcastLiveMatchState(room);
  }

  public finishRoomMatch(
    room: CustomRoom,
    reason: 'KO' | 'TIMEOUT' | 'SURRENDER',
    explicitWinnerId?: string
  ) {
    if (room.status === 'FINISHED') return;
    room.status = 'FINISHED';

    if (room.timer) {
      clearInterval(room.timer);
      room.timer = null;
    }

    if (!room.boardA || !room.boardB || !room.guest) return;

    let winnerId: string | null = explicitWinnerId || null;
    if (!winnerId) {
      if (room.boardA.score > room.boardB.score) winnerId = room.host.info.id;
      else if (room.boardB.score > room.boardA.score) winnerId = room.guest.info.id;
    }

    // Send MATCH_END to Host
    this.sendMessage(room.host.ws, {
      type: 'MATCH_END',
      winnerId,
      reason,
      yourScore: room.boardA.score,
      opponentScore: room.boardB.score,
      oldElo: room.host.info.elo,
      newElo: room.host.info.elo,
      eloDelta: 0 // Custom friend match does not alter ranked competitive Elo
    });

    // Send MATCH_END to Guest
    this.sendMessage(room.guest.ws, {
      type: 'MATCH_END',
      winnerId,
      reason,
      yourScore: room.boardB.score,
      opponentScore: room.boardA.score,
      oldElo: room.guest.info.elo,
      newElo: room.guest.info.elo,
      eloDelta: 0
    });

    // Notify spectators
    for (const spec of room.spectators.values()) {
      this.sendMessage(spec.ws, {
        type: 'MATCH_END',
        winnerId,
        reason,
        yourScore: room.boardA.score,
        opponentScore: room.boardB.score,
        oldElo: 1000,
        newElo: 1000,
        eloDelta: 0
      });
    }

    this.broadcastRoomUpdate(room);
  }

  public broadcastLiveMatchState(room: CustomRoom) {
    if (!room.boardA || !room.boardB || !room.guest) return;

    // Send state update to Host
    this.sendMessage(room.host.ws, {
      type: 'STATE_UPDATE',
      localBoard: room.boardA,
      opponentBoard: {
        playerId: room.guest.info.id,
        name: room.guest.info.name,
        elo: room.guest.info.elo,
        grid: room.boardB.grid,
        score: room.boardB.score,
        comboStreak: room.boardB.comboStreak,
        isKnockedOut: room.boardB.isKnockedOut,
        activePiecesCount: room.boardB.activePieces.filter(p => p !== null && !p.placed).length
      },
      timeRemaining: room.timeRemaining
    });

    // Send state update to Guest
    this.sendMessage(room.guest.ws, {
      type: 'STATE_UPDATE',
      localBoard: room.boardB,
      opponentBoard: {
        playerId: room.host.info.id,
        name: room.host.info.name,
        elo: room.host.info.elo,
        grid: room.boardA.grid,
        score: room.boardA.score,
        comboStreak: room.boardA.comboStreak,
        isKnockedOut: room.boardA.isKnockedOut,
        activePiecesCount: room.boardA.activePieces.filter(p => p !== null && !p.placed).length
      },
      timeRemaining: room.timeRemaining
    });

    // Broadcast spectator full dual-board view
    const spectatorMsg: ServerMessage = {
      type: 'SPECTATOR_STATE_UPDATE',
      roomCode: room.code,
      playerABoard: room.boardA,
      playerBBoard: room.boardB,
      playerAInfo: room.host.info,
      playerBInfo: room.guest.info,
      timeRemaining: room.timeRemaining,
      spectatorCount: room.spectators.size
    };

    for (const spec of room.spectators.values()) {
      this.sendMessage(spec.ws, spectatorMsg);
    }
  }

  public broadcastRoomUpdate(room: CustomRoom) {
    const spectatorsList = Array.from(room.spectators.values()).map(s => s.info);

    // Host
    this.sendMessage(room.host.ws, {
      type: 'ROOM_UPDATE',
      roomCode: room.code,
      host: room.host.info,
      guest: room.guest?.info || null,
      spectators: spectatorsList,
      status: room.status,
      isHost: true,
      myRole: 'PLAYER'
    });

    // Guest
    if (room.guest) {
      this.sendMessage(room.guest.ws, {
        type: 'ROOM_UPDATE',
        roomCode: room.code,
        host: room.host.info,
        guest: room.guest.info,
        spectators: spectatorsList,
        status: room.status,
        isHost: false,
        myRole: 'PLAYER'
      });
    }

    // Spectators
    for (const spec of room.spectators.values()) {
      this.sendMessage(spec.ws, {
        type: 'ROOM_UPDATE',
        roomCode: room.code,
        host: room.host.info,
        guest: room.guest?.info || null,
        spectators: spectatorsList,
        status: room.status,
        isHost: false,
        myRole: 'SPECTATOR'
      });
    }
  }

  public removePlayer(playerId: string) {
    const code = this.playerToRoom.get(playerId);
    if (!code) return;

    this.playerToRoom.delete(playerId);
    const room = this.rooms.get(code);
    if (!room) return;

    // Check if spectator
    if (room.spectators.has(playerId)) {
      room.spectators.delete(playerId);
      this.broadcastRoomUpdate(room);
      return;
    }

    // Check if guest
    if (room.guest?.info.id === playerId) {
      if (room.status === 'PLAYING') {
        this.finishRoomMatch(room, 'SURRENDER', room.host.info.id);
      }
      room.guest = null;
      this.broadcastRoomUpdate(room);
      return;
    }

    // Check if host
    if (room.host.info.id === playerId) {
      if (room.status === 'PLAYING' && room.guest) {
        this.finishRoomMatch(room, 'SURRENDER', room.guest.info.id);
      }

      if (room.timer) {
        clearInterval(room.timer);
      }

      // If guest exists, promote guest to host!
      if (room.guest) {
        room.host = room.guest;
        room.guest = null;
        room.status = 'LOBBY';
        this.broadcastRoomUpdate(room);
      } else {
        // Close room
        this.rooms.delete(code);
      }
    }
  }
}

export const roomManager = new RoomManager();
