import { BoardState, BOARD_SIZE, LineClearResult, PlayerInfo } from '../shared/types.js';
import { GameEngine } from './gameEngine.js';

export interface BotMoveCallback {
  onMoveApplied: (botId: string, clearResult?: LineClearResult, garbageSent?: number) => void;
  onKnockout: (botId: string) => void;
}

export class BotPlayer {
  public info: PlayerInfo;
  public board: BoardState;
  private matchSeed: number;
  private timer: NodeJS.Timeout | null = null;
  private isDestroyed = false;
  private callbacks: BotMoveCallback;

  constructor(id: string, name: string, elo: number, matchSeed: number, callbacks: BotMoveCallback) {
    this.info = {
      id,
      name,
      elo,
      isBot: true
    };
    this.matchSeed = matchSeed;
    this.callbacks = callbacks;
    this.board = GameEngine.initPlayerBoard(id, matchSeed);
  }

  public startPlaying() {
    this.scheduleNextMove();
  }

  public stop() {
    this.isDestroyed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNextMove() {
    if (this.isDestroyed || this.board.isKnockedOut) return;

    // Simulate human-like reaction time (1200ms - 2200ms)
    const delay = Math.floor(Math.random() * 1000) + 1200;
    this.timer = setTimeout(() => {
      this.makeMove();
    }, delay);
  }

  private makeMove() {
    if (this.isDestroyed || this.board.isKnockedOut) return;

    // Find all valid candidate moves for all remaining unplaced pieces
    const candidateMoves: {
      pieceIndex: number;
      x: number;
      y: number;
      score: number;
    }[] = [];

    const availablePieces = this.board.activePieces.filter((ap): ap is NonNullable<typeof ap> => ap !== null && !ap.placed);

    if (availablePieces.length === 0) {
      // Board might be waiting for round refresh
      this.scheduleNextMove();
      return;
    }

    for (const ap of availablePieces) {
      const piece = ap.piece;
      for (let y = 0; y <= BOARD_SIZE - piece.height; y++) {
        for (let x = 0; x <= BOARD_SIZE - piece.width; x++) {
          if (GameEngine.canPlacePiece(this.board.grid, piece, x, y)) {
            // Evaluate heuristic quality of this placement
            const score = this.evaluatePlacement(piece, x, y);
            candidateMoves.push({
              pieceIndex: ap.index,
              x,
              y,
              score
            });
          }
        }
      }
    }

    if (candidateMoves.length === 0) {
      // No legal moves available -> Bot Knockout!
      this.board.isKnockedOut = true;
      this.callbacks.onKnockout(this.info.id);
      return;
    }

    // Sort moves descending by heuristic score, with slight randomness for realistic feel
    candidateMoves.sort((a, b) => b.score - a.score + (Math.random() * 8 - 4));
    const chosenMove = candidateMoves[0];

    // Apply the chosen move through authoritative GameEngine
    const result = GameEngine.applyMove(
      this.board,
      chosenMove.pieceIndex,
      chosenMove.x,
      chosenMove.y,
      this.matchSeed
    );

    if (result.success) {
      this.callbacks.onMoveApplied(this.info.id, result.clearResult, result.garbageSentToOpponent);
    }

    if (this.board.isKnockedOut) {
      this.callbacks.onKnockout(this.info.id);
      return;
    }

    // Schedule next bot placement
    this.scheduleNextMove();
  }

  /**
   * Heuristic evaluation of placing a piece at (targetX, targetY)
   */
  private evaluatePlacement(piece: any, targetX: number, targetY: number): number {
    let score = piece.matrix.flat().filter((b: number) => b === 1).length * 2;

    // Simulate grid after placement
    const simulatedGrid = GameEngine.cloneGrid(this.board.grid);
    for (let r = 0; r < piece.height; r++) {
      for (let c = 0; c < piece.width; c++) {
        if (piece.matrix[r][c] === 1) {
          simulatedGrid[targetY + r][targetX + c] = {
            color: piece.color,
            id: piece.id
          };
        }
      }
    }

    // Test how many lines this clears
    let simulatedFullLines = 0;
    for (let y = 0; y < BOARD_SIZE; y++) {
      if (simulatedGrid[y].every(cell => cell !== null && !cell.isGarbage)) {
        simulatedFullLines++;
      }
    }
    for (let x = 0; x < BOARD_SIZE; x++) {
      let full = true;
      for (let y = 0; y < BOARD_SIZE; y++) {
        const cell = simulatedGrid[y][x];
        if (cell === null || cell.isGarbage) {
          full = false;
          break;
        }
      }
      if (full) simulatedFullLines++;
    }

    score += simulatedFullLines * 120;

    // Prefer keeping center free: bonus for edges and corners
    const distFromCenter = Math.abs(targetX + piece.width / 2 - 4) + Math.abs(targetY + piece.height / 2 - 4);
    score += distFromCenter * 3;

    return score;
  }
}
