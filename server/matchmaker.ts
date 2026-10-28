import { WebSocket } from 'ws';
import { ELO_K_FACTOR } from '../shared/types.js';

export interface QueuedPlayer {
  playerId: string;
  playerName: string;
  elo: number;
  ws: WebSocket;
  enqueuedAt: number;
}

export interface MatchPairResult {
  playerA: QueuedPlayer;
  playerB: QueuedPlayer;
  isBotMatch: boolean;
}

export class Matchmaker {
  private queue: QueuedPlayer[] = [];
  private loopInterval: NodeJS.Timeout | null = null;
  private onMatchFound: (pair: MatchPairResult) => void;

  constructor(onMatchFound: (pair: MatchPairResult) => void) {
    this.onMatchFound = onMatchFound;
    this.startLoop();
  }

  public enqueue(player: QueuedPlayer): void {
    // Check if already in queue
    this.removeFromQueue(player.playerId);
    this.queue.push(player);
  }

  public removeFromQueue(playerId: string): void {
    this.queue = this.queue.filter(p => p.playerId !== playerId);
  }

  public isInQueue(playerId: string): boolean {
    return this.queue.some(p => p.playerId === playerId);
  }

  public getQueueStats(playerId: string): { inQueue: boolean; queueTimeSeconds: number; searchRadius: number } {
    const player = this.queue.find(p => p.playerId === playerId);
    if (!player) {
      return { inQueue: false, queueTimeSeconds: 0, searchRadius: 150 };
    }
    const waitSeconds = Math.floor((Date.now() - player.enqueuedAt) / 1000);
    const searchRadius = 150 + Math.floor(waitSeconds / 5) * 50;
    return { inQueue: true, queueTimeSeconds: waitSeconds, searchRadius };
  }

  private startLoop(): void {
    this.loopInterval = setInterval(() => {
      this.tick();
    }, 1000);
  }

  public stop(): void {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
  }

  /**
   * Periodic queue scan:
   * 1. Check pairs of human players with compatible expanding Elo radius.
   * 2. If a player waits >= 15 seconds, pair with an intelligent CyberBot.
   */
  private tick(): void {
    const now = Date.now();
    const matchedPlayerIds = new Set<string>();

    // 1. Try human vs human pairing
    for (let i = 0; i < this.queue.length; i++) {
      const p1 = this.queue[i];
      if (matchedPlayerIds.has(p1.playerId) || p1.ws.readyState !== WebSocket.OPEN) continue;

      const p1WaitSec = Math.floor((now - p1.enqueuedAt) / 1000);
      const p1Radius = 150 + Math.floor(p1WaitSec / 5) * 50;

      for (let j = i + 1; j < this.queue.length; j++) {
        const p2 = this.queue[j];
        if (matchedPlayerIds.has(p2.playerId) || p2.ws.readyState !== WebSocket.OPEN) continue;

        const p2WaitSec = Math.floor((now - p2.enqueuedAt) / 1000);
        const p2Radius = 150 + Math.floor(p2WaitSec / 5) * 50;

        const eloDiff = Math.abs(p1.elo - p2.elo);
        const maxAllowedDiff = Math.max(p1Radius, p2Radius);

        if (eloDiff <= maxAllowedDiff) {
          matchedPlayerIds.add(p1.playerId);
          matchedPlayerIds.add(p2.playerId);

          this.onMatchFound({
            playerA: p1,
            playerB: p2,
            isBotMatch: false
          });
          break;
        }
      }
    }

    // 2. Check for bot fallback after 15 seconds
    for (let i = 0; i < this.queue.length; i++) {
      const p = this.queue[i];
      if (matchedPlayerIds.has(p.playerId) || p.ws.readyState !== WebSocket.OPEN) continue;

      const waitSec = Math.floor((now - p.enqueuedAt) / 1000);
      if (waitSec >= 15) {
        matchedPlayerIds.add(p.playerId);

        // Generate Bot opponent with comparable Elo (+/- 40)
        const botElo = Math.max(800, p.elo + (Math.floor(Math.random() * 80) - 40));
        const botNames = ['CyberViper', 'NeonPulse', 'GridPhantom', 'CircuitBreaker', 'ZeroCool'];
        const randomName = botNames[Math.floor(Math.random() * botNames.length)];
        const botPlayer: QueuedPlayer = {
          playerId: `bot_${Date.now().toString(36)}`,
          playerName: `${randomName} [AI]`,
          elo: botElo,
          ws: null as any,
          enqueuedAt: now
        };

        this.onMatchFound({
          playerA: p,
          playerB: botPlayer,
          isBotMatch: true
        });
      }
    }

    // Remove matched players or closed sockets from queue
    this.queue = this.queue.filter(
      p => !matchedPlayerIds.has(p.playerId) && p.ws.readyState === WebSocket.OPEN
    );
  }

  /**
   * Calculate Elo updates for match results
   */
  public static calculateEloDelta(
    eloA: number,
    eloB: number,
    scoreA: 1 | 0.5 | 0 // 1 = Win, 0.5 = Tie, 0 = Loss
  ): { deltaA: number; deltaB: number } {
    const expectedA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
    const scoreB = (1 - scoreA) as 1 | 0.5 | 0;
    const expectedB = 1 / (1 + Math.pow(10, (eloA - eloB) / 400));

    const deltaA = Math.round(ELO_K_FACTOR * (scoreA - expectedA));
    const deltaB = Math.round(ELO_K_FACTOR * (scoreB - expectedB));

    return { deltaA, deltaB };
  }
}
