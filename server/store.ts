import { DEFAULT_ELO, SoloLeaderboardEntry } from '../shared/types.js';

export interface StoredPlayer {
  id: string;
  name: string;
  elo: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  createdAt: number;
}

export interface IPlayerStore {
  getPlayer(id: string): Promise<StoredPlayer | null>;
  createOrUpdatePlayer(id: string, name: string, elo?: number): Promise<StoredPlayer>;
  updatePlayerStats(id: string, newElo: number, won: boolean): Promise<StoredPlayer>;
  getTopLeaderboard(limit?: number): Promise<StoredPlayer[]>;
}

/**
 * In-memory implementation of IPlayerStore with standard async signatures
 * allowing seamless future drop-in replacement with Prisma/PostgreSQL/Redis.
 */
export class InMemoryPlayerStore implements IPlayerStore {
  private players: Map<string, StoredPlayer> = new Map();

  constructor() {
    // Seed some initial high-rank bots/players for leaderboard visual flavor
    this.seedDefaults();
  }

  private seedDefaults() {
    const seeds = [
      { id: 'bot_alpha', name: 'CyberViper [AI]', elo: 1350, wins: 42, losses: 12 },
      { id: 'bot_beta', name: 'NeonSamurai [AI]', elo: 1220, wins: 28, losses: 14 },
      { id: 'bot_gamma', name: 'PulseBlade [AI]', elo: 1100, wins: 15, losses: 10 }
    ];

    for (const s of seeds) {
      this.players.set(s.id, {
        id: s.id,
        name: s.name,
        elo: s.elo,
        matchesPlayed: s.wins + s.losses,
        wins: s.wins,
        losses: s.losses,
        createdAt: Date.now() - 86400000
      });
    }
  }

  public async getPlayer(id: string): Promise<StoredPlayer | null> {
    return this.players.get(id) || null;
  }

  public async createOrUpdatePlayer(id: string, name: string, elo = DEFAULT_ELO): Promise<StoredPlayer> {
    let existing = this.players.get(id);
    if (!existing) {
      existing = {
        id,
        name: name || `CyberRunner_${id.slice(0, 4)}`,
        elo,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        createdAt: Date.now()
      };
      this.players.set(id, existing);
    } else if (name && name !== existing.name) {
      existing.name = name;
    }
    return existing;
  }

  public async updatePlayerStats(id: string, newElo: number, won: boolean): Promise<StoredPlayer> {
    const player = await this.createOrUpdatePlayer(id, `Player_${id.slice(0, 4)}`);
    player.elo = Math.max(100, Math.round(newElo));
    player.matchesPlayed += 1;
    if (won) {
      player.wins += 1;
    } else {
      player.losses += 1;
    }
    return player;
  }

  public async getTopLeaderboard(limit = 10): Promise<StoredPlayer[]> {
    return Array.from(this.players.values())
      .sort((a, b) => b.elo - a.elo)
      .slice(0, limit);
  }

  // --- Solo Classic Mode High Scores Leaderboard ---
  private soloLeaderboard: SoloLeaderboardEntry[] = [
    {
      id: 'solo_seed_1',
      name: 'DragonSlayer',
      score: 5480,
      maxCombo: 8,
      linesCleared: 42,
      date: Date.now() - 3600000 * 5
    },
    {
      id: 'solo_seed_2',
      name: 'CyberNinja',
      score: 4120,
      maxCombo: 6,
      linesCleared: 34,
      date: Date.now() - 3600000 * 12
    },
    {
      id: 'solo_seed_3',
      name: 'BlockMaster_VN',
      score: 3350,
      maxCombo: 5,
      linesCleared: 28,
      date: Date.now() - 3600000 * 24
    },
    {
      id: 'solo_seed_4',
      name: 'NeonPulse',
      score: 2800,
      maxCombo: 4,
      linesCleared: 22,
      date: Date.now() - 3600000 * 48
    }
  ];

  public async saveSoloScore(entry: {
    name: string;
    score: number;
    maxCombo: number;
    linesCleared: number;
  }): Promise<SoloLeaderboardEntry> {
    const newEntry: SoloLeaderboardEntry = {
      id: `solo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: entry.name.trim() || 'Anonymous',
      score: Math.max(0, Math.round(entry.score)),
      maxCombo: Math.max(0, Math.round(entry.maxCombo)),
      linesCleared: Math.max(0, Math.round(entry.linesCleared)),
      date: Date.now()
    };

    this.soloLeaderboard.push(newEntry);
    this.soloLeaderboard.sort((a, b) => b.score - a.score);

    // Keep top 100 entries
    if (this.soloLeaderboard.length > 100) {
      this.soloLeaderboard = this.soloLeaderboard.slice(0, 100);
    }

    return newEntry;
  }

  public async getSoloLeaderboard(limit = 10): Promise<SoloLeaderboardEntry[]> {
    return this.soloLeaderboard
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export const playerStore = new InMemoryPlayerStore();

