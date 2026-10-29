import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ClientMessage,
  ServerMessage,
  PlayerInfo,
  BoardState,
  OpponentBoardState,
  MATCH_DURATION_SECONDS
} from '../shared/types.js';
import { GameEngine } from './gameEngine.js';
import { Matchmaker, QueuedPlayer, MatchPairResult } from './matchmaker.js';
import { playerStore } from './store.js';
import { BotPlayer } from './botPlayer.js';
import { roomManager } from './roomManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

interface CustomWebSocket extends WebSocket {
  isAlive?: boolean;
}

app.use(express.json());

// Health check for Fly.io and container orchestrators
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Serve client dist in production or single-port mode
const distPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(distPath));

// API endpoints for leaderboards
app.get('/api/leaderboard', async (req, res) => {
  const top = await playerStore.getTopLeaderboard(10);
  res.json(top);
});

app.get('/api/leaderboard/pvp', async (req, res) => {
  const top = await playerStore.getTopLeaderboard(20);
  res.json(top);
});

app.get('/api/leaderboard/solo', async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const top = await playerStore.getSoloLeaderboard(limit);
  res.json(top);
});

app.post('/api/leaderboard/solo', async (req, res) => {
  const { name, score, maxCombo, linesCleared } = req.body;
  if (typeof score !== 'number' || score < 0) {
    return res.status(400).json({ error: 'Valid score is required' });
  }

  const entry = await playerStore.saveSoloScore({
    name: typeof name === 'string' && name.trim() ? name.trim() : 'Anonymous Runner',
    score,
    maxCombo: typeof maxCombo === 'number' ? maxCombo : 0,
    linesCleared: typeof linesCleared === 'number' ? linesCleared : 0
  });

  const updatedLeaderboard = await playerStore.getSoloLeaderboard(20);
  res.json({ success: true, entry, leaderboard: updatedLeaderboard });
});

// Fallback to index.html for SPA client
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.resolve(distPath, 'index.html'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

interface MatchSession {
  matchId: string;
  seed: number;
  playerA: { info: PlayerInfo; ws?: WebSocket; board: BoardState };
  playerB: { info: PlayerInfo; ws?: WebSocket; board: BoardState };
  timeRemaining: number;
  status: 'PLAYING' | 'FINISHED';
  timer: NodeJS.Timeout | null;
  bot?: BotPlayer;
}

const activeMatches = new Map<string, MatchSession>();
const playerToMatchMap = new Map<string, string>(); // playerId -> matchId
const clientSockets = new Map<string, WebSocket>(); // playerId -> ws

// Send typed message helper
function sendMessage(ws: WebSocket | undefined, message: ServerMessage): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// Convert BoardState to OpponentBoardState for secure spectator view
function toOpponentState(board: BoardState, info: PlayerInfo): OpponentBoardState {
  return {
    playerId: info.id,
    name: info.name,
    elo: info.elo,
    grid: board.grid,
    score: board.score,
    comboStreak: board.comboStreak,
    isKnockedOut: board.isKnockedOut,
    activePiecesCount: board.activePieces.filter(p => p !== null && !p.placed).length,
    hp: board.hp,
    maxHp: board.maxHp,
    lastDamageDealt: board.lastDamageDealt,
    lastDamageTaken: board.lastDamageTaken,
    incomingDamage: board.incomingDamage
  };
}

// Broadcast state update to both players in a match
function broadcastMatchState(match: MatchSession): void {
  if (match.status !== 'PLAYING') return;

  // For Player A
  sendMessage(match.playerA.ws, {
    type: 'STATE_UPDATE',
    localBoard: match.playerA.board,
    opponentBoard: toOpponentState(match.playerB.board, match.playerB.info),
    timeRemaining: match.timeRemaining
  });

  // For Player B (if human)
  if (match.playerB.ws) {
    sendMessage(match.playerB.ws, {
      type: 'STATE_UPDATE',
      localBoard: match.playerB.board,
      opponentBoard: toOpponentState(match.playerA.board, match.playerA.info),
      timeRemaining: match.timeRemaining
    });
  }
}

// End match and calculate Elo
async function finishMatch(
  match: MatchSession,
  winnerId: string | null,
  reason: 'KO' | 'TIMEOUT' | 'SURRENDER' | 'HP_ZERO' | 'DEADLOCK'
): Promise<void> {
  if (match.status === 'FINISHED') return;
  match.status = 'FINISHED';

  if (match.timer) {
    clearInterval(match.timer);
    match.timer = null;
  }
  if (match.bot) {
    match.bot.stop();
  }

  const pA = match.playerA;
  const pB = match.playerB;

  // Determine score outcome for Elo
  let scoreA: 1 | 0.5 | 0 = 0.5;
  if (winnerId === pA.info.id) scoreA = 1;
  else if (winnerId === pB.info.id) scoreA = 0;
  else if (pA.board.score > pB.board.score) scoreA = 1;
  else if (pB.board.score > pA.board.score) scoreA = 0;

  const { deltaA, deltaB } = Matchmaker.calculateEloDelta(pA.info.elo, pB.info.elo, scoreA);

  const oldEloA = pA.info.elo;
  const oldEloB = pB.info.elo;
  const newEloA = Math.max(100, oldEloA + deltaA);
  const newEloB = Math.max(100, oldEloB + deltaB);

  // Update DB/Store
  await playerStore.updatePlayerStats(pA.info.id, newEloA, scoreA === 1);
  if (!pB.info.isBot) {
    await playerStore.updatePlayerStats(pB.info.id, newEloB, scoreA === 0);
  }

  // Notify Player A
  sendMessage(pA.ws, {
    type: 'MATCH_END',
    winnerId,
    reason,
    yourScore: pA.board.score,
    opponentScore: pB.board.score,
    oldElo: oldEloA,
    newElo: newEloA,
    eloDelta: deltaA
  });

  // Notify Player B
  if (pB.ws) {
    sendMessage(pB.ws, {
      type: 'MATCH_END',
      winnerId,
      reason,
      yourScore: pB.board.score,
      opponentScore: pA.board.score,
      oldElo: oldEloB,
      newElo: newEloB,
      eloDelta: deltaB
    });
  }

  // Cleanup mappings
  playerToMatchMap.delete(pA.info.id);
  playerToMatchMap.delete(pB.info.id);
  activeMatches.delete(match.matchId);
}

// Start a new match session between two players
function startMatch(pair: MatchPairResult): void {
  const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const seed = Math.floor(Math.random() * 1000000);

  const boardA = GameEngine.initPlayerBoard(pair.playerA.playerId, seed);
  const boardB = GameEngine.initPlayerBoard(pair.playerB.playerId, seed);

  const matchSession: MatchSession = {
    matchId,
    seed,
    playerA: {
      info: { id: pair.playerA.playerId, name: pair.playerA.playerName, elo: pair.playerA.elo },
      ws: pair.playerA.ws,
      board: boardA
    },
    playerB: {
      info: { id: pair.playerB.playerId, name: pair.playerB.playerName, elo: pair.playerB.elo, isBot: pair.isBotMatch },
      ws: pair.isBotMatch ? undefined : pair.playerB.ws,
      board: boardB
    },
    timeRemaining: MATCH_DURATION_SECONDS,
    status: 'PLAYING',
    timer: null
  };

  activeMatches.set(matchId, matchSession);
  playerToMatchMap.set(pair.playerA.playerId, matchId);
  playerToMatchMap.set(pair.playerB.playerId, matchId);

  // If Bot match, instantiate the bot logic
  if (pair.isBotMatch) {
    const bot = new BotPlayer(
      pair.playerB.playerId,
      pair.playerB.playerName,
      pair.playerB.elo,
      seed,
      {
        onMoveApplied: (botId, clearResult, garbageSent) => {
          if (clearResult && clearResult.totalLines > 0) {
            const damage = clearResult.damageDealt;
            const isCritical = clearResult.isCritical;
            const dmgRes = GameEngine.applyDamage(matchSession.playerA.board, damage);

            sendMessage(matchSession.playerA.ws, {
              type: 'LINE_CLEARED',
              playerId: botId,
              rows: clearResult.rows,
              cols: clearResult.cols,
              count: clearResult.totalLines,
              comboStreak: clearResult.comboStreak,
              pointsEarned: clearResult.pointsEarned
            });

            sendMessage(matchSession.playerA.ws, {
              type: 'ATTACK_EVENT',
              fromPlayerId: botId,
              toPlayerId: matchSession.playerA.info.id,
              count: garbageSent || 0,
              combo: clearResult.comboStreak,
              damage,
              isCritical,
              targetRemainingHp: dmgRes.remainingHp
            });

            if (dmgRes.isKnockedOut) {
              finishMatch(matchSession, botId, 'HP_ZERO');
              return;
            }
          }

          if (garbageSent && garbageSent > 0) {
            GameEngine.injectGarbage(matchSession.playerA.board.grid, garbageSent);
          }

          broadcastMatchState(matchSession);
        },
        onKnockout: (botId) => {
          finishMatch(matchSession, matchSession.playerA.info.id, 'KO');
        }
      }
    );
    matchSession.bot = bot;
    bot.board = boardB; // Share board reference
    bot.startPlaying();
  }

  // Send MATCH_START to Player A
  sendMessage(pair.playerA.ws, {
    type: 'MATCH_START',
    matchId,
    opponent: matchSession.playerB.info,
    seed,
    timeRemaining: MATCH_DURATION_SECONDS,
    yourPieces: boardA.activePieces.map(ap => ap!.piece)
  });

  // Send MATCH_START to Player B (if human)
  if (!pair.isBotMatch && pair.playerB.ws) {
    sendMessage(pair.playerB.ws, {
      type: 'MATCH_START',
      matchId,
      opponent: matchSession.playerA.info,
      seed,
      timeRemaining: MATCH_DURATION_SECONDS,
      yourPieces: boardB.activePieces.map(ap => ap!.piece)
    });
  }

  // 1-second interval match ticker
  matchSession.timer = setInterval(() => {
    matchSession.timeRemaining -= 1;

    if (matchSession.timeRemaining <= 0) {
      // Time is up! Higher score wins
      let winnerId: string | null = null;
      if (matchSession.playerA.board.score > matchSession.playerB.board.score) {
        winnerId = matchSession.playerA.info.id;
      } else if (matchSession.playerB.board.score > matchSession.playerA.board.score) {
        winnerId = matchSession.playerB.info.id;
      }
      finishMatch(matchSession, winnerId, 'TIMEOUT');
    } else {
      broadcastMatchState(matchSession);
    }
  }, 1000);

  // Initial state broadcast
  broadcastMatchState(matchSession);
}

// Instantiate Matchmaker with match handler
const matchmaker = new Matchmaker((pair: MatchPairResult) => {
  startMatch(pair);
});

// Periodic queue status broadcast
setInterval(() => {
  for (const [playerId, ws] of clientSockets.entries()) {
    if (matchmaker.isInQueue(playerId)) {
      const stats = matchmaker.getQueueStats(playerId);
      sendMessage(ws, {
        type: 'QUEUE_STATUS',
        inQueue: stats.inQueue,
        queueTimeSeconds: stats.queueTimeSeconds,
        searchRadius: stats.searchRadius
      });
    }
  }
}, 1000);

// 30s Heartbeat to detect dead sockets, terminate zombie TCP connections and clean RAM
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((client) => {
    const ws = client as CustomWebSocket;
    if (ws.isAlive === false) {
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });

  // Stale active matches sweep
  for (const [matchId, match] of activeMatches.entries()) {
    if (match.timeRemaining <= -10 || match.status === 'FINISHED') {
      if (match.timer) clearInterval(match.timer);
      activeMatches.delete(matchId);
      playerToMatchMap.delete(match.playerA.info.id);
      playerToMatchMap.delete(match.playerB.info.id);
    }
  }
}, 30000);

// WebSocket connection management
wss.on('connection', async (rawWs: WebSocket, req) => {
  const ws = rawWs as CustomWebSocket;
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Generate random session player ID or parse from query
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const requestedId = url.searchParams.get('playerId');
  const playerId = requestedId || `p_${Math.random().toString(36).substring(2, 9)}`;

  ws.on('error', (err) => {
    console.warn(`[WebSocket] Socket error for ${playerId}:`, err.message);
  });

  clientSockets.set(playerId, ws);

  const storedPlayer = await playerStore.createOrUpdatePlayer(playerId, `Runner_${playerId.slice(0, 4)}`);

  // Send welcome
  sendMessage(ws, {
    type: 'WELCOME',
    playerId: storedPlayer.id,
    defaultName: storedPlayer.name,
    elo: storedPlayer.elo
  });

  ws.on('message', async (data: string) => {
    try {
      const packet: ClientMessage = JSON.parse(data.toString());

      switch (packet.type) {
        case 'JOIN_QUEUE': {
          const p = await playerStore.createOrUpdatePlayer(playerId, packet.playerName);
          matchmaker.enqueue({
            playerId: p.id,
            playerName: p.name,
            elo: p.elo,
            ws,
            enqueuedAt: Date.now()
          });
          sendMessage(ws, {
            type: 'QUEUE_STATUS',
            inQueue: true,
            queueTimeSeconds: 0,
            searchRadius: 150
          });
          break;
        }

        case 'LEAVE_QUEUE': {
          matchmaker.removeFromQueue(playerId);
          sendMessage(ws, {
            type: 'QUEUE_STATUS',
            inQueue: false,
            queueTimeSeconds: 0,
            searchRadius: 150
          });
          break;
        }

        case 'CREATE_ROOM': {
          const p = await playerStore.createOrUpdatePlayer(playerId, packet.playerName);
          roomManager.createRoom({ id: p.id, name: p.name, elo: p.elo }, ws);
          break;
        }

        case 'JOIN_ROOM': {
          const p = await playerStore.createOrUpdatePlayer(playerId, packet.playerName);
          const res = roomManager.joinRoom(packet.roomCode, { id: p.id, name: p.name, elo: p.elo }, ws, packet.asSpectator);
          if (!res.success) {
            sendMessage(ws, {
              type: 'ERROR',
              message: res.error || 'Không thể tham gia phòng'
            });
          }
          break;
        }

        case 'START_ROOM_MATCH': {
          const room = roomManager.getRoomByPlayer(playerId);
          if (room) {
            const res = roomManager.startRoomMatch(room.code, playerId);
            if (!res.success) {
              sendMessage(ws, {
                type: 'ERROR',
                message: res.error || 'Không thể bắt đầu trận đấu'
              });
            }
          }
          break;
        }

        case 'LEAVE_ROOM': {
          roomManager.removePlayer(playerId);
          break;
        }

        case 'PLACE_PIECE': {
          const room = roomManager.getRoomByPlayer(playerId);
          if (room) {
            roomManager.handlePiecePlacement(room, playerId, packet.pieceIndex, packet.x, packet.y);
            break;
          }

          const matchId = playerToMatchMap.get(playerId);
          if (!matchId) return;

          const match = activeMatches.get(matchId);
          if (!match || match.status !== 'PLAYING') return;

          const isPlayerA = match.playerA.info.id === playerId;
          const currentSide = isPlayerA ? match.playerA : match.playerB;
          const opponentSide = isPlayerA ? match.playerB : match.playerA;

          // Apply move through authoritative GameEngine
          const moveResult = GameEngine.applyMove(
            currentSide.board,
            packet.pieceIndex,
            packet.x,
            packet.y,
            match.seed
          );

          if (!moveResult.success) {
            sendMessage(ws, {
              type: 'ERROR',
              message: moveResult.error || 'Invalid move'
            });
            return;
          }

          // If lines cleared, notify and apply combat damage
          if (moveResult.clearResult && moveResult.clearResult.totalLines > 0) {
            const damage = moveResult.clearResult.damageDealt;
            const isCritical = moveResult.clearResult.isCritical;
            const dmgRes = GameEngine.applyDamage(opponentSide.board, damage);

            sendMessage(currentSide.ws, {
              type: 'LINE_CLEARED',
              playerId,
              rows: moveResult.clearResult.rows,
              cols: moveResult.clearResult.cols,
              count: moveResult.clearResult.totalLines,
              comboStreak: moveResult.clearResult.comboStreak,
              pointsEarned: moveResult.clearResult.pointsEarned
            });
            if (opponentSide.ws) {
              sendMessage(opponentSide.ws, {
                type: 'LINE_CLEARED',
                playerId,
                rows: moveResult.clearResult.rows,
                cols: moveResult.clearResult.cols,
                count: moveResult.clearResult.totalLines,
                comboStreak: moveResult.clearResult.comboStreak,
                pointsEarned: moveResult.clearResult.pointsEarned
              });
            }

            const attackMsg: ServerMessage = {
              type: 'ATTACK_EVENT',
              fromPlayerId: playerId,
              toPlayerId: opponentSide.info.id,
              count: moveResult.garbageSentToOpponent,
              combo: moveResult.clearResult.comboStreak,
              damage,
              isCritical,
              targetRemainingHp: dmgRes.remainingHp
            };
            sendMessage(currentSide.ws, attackMsg);
            if (opponentSide.ws) {
              sendMessage(opponentSide.ws, attackMsg);
            }

            // Check if opponent was Knocked Out by dropping to 0 HP
            if (dmgRes.isKnockedOut) {
              finishMatch(match, playerId, 'HP_ZERO');
              return;
            }
          }

          // If garbage attacks triggered, inject onto opponent
          if (moveResult.garbageSentToOpponent > 0) {
            GameEngine.injectGarbage(opponentSide.board.grid, moveResult.garbageSentToOpponent);
          }

          // Check Knockout (KO) due to board deadlock
          if (currentSide.board.isKnockedOut) {
            finishMatch(match, opponentSide.info.id, 'DEADLOCK');
            return;
          }

          // Update both sides with fresh authoritative state
          broadcastMatchState(match);
          break;
        }

        case 'EMOTE': {
          const matchId = playerToMatchMap.get(playerId);
          if (!matchId) return;

          const match = activeMatches.get(matchId);
          if (!match || match.status !== 'PLAYING') return;

          const isPlayerA = match.playerA.info.id === playerId;
          const opponentSide = isPlayerA ? match.playerB : match.playerA;

          if (opponentSide.ws) {
            sendMessage(opponentSide.ws, {
              type: 'EMOTE_EVENT',
              fromPlayerId: playerId,
              emoji: packet.emoji
            });
          }
          break;
        }

        case 'PING': {
          sendMessage(ws, {
            type: 'PONG',
            timestamp: packet.timestamp
          });
          break;
        }
      }
    } catch (err: any) {
      console.error('WebSocket message handling error:', err);
    }
  });

  ws.on('close', () => {
    clientSockets.delete(playerId);
    matchmaker.removeFromQueue(playerId);
    roomManager.removePlayer(playerId);

    const matchId = playerToMatchMap.get(playerId);
    if (matchId) {
      const match = activeMatches.get(matchId);
      if (match && match.status === 'PLAYING') {
        const isPlayerA = match.playerA.info.id === playerId;
        const opponentId = isPlayerA ? match.playerB.info.id : match.playerA.info.id;
        finishMatch(match, opponentId, 'SURRENDER');
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[BlockBlast Arena] Server running on http://0.0.0.0:${PORT}`);
});
