import {
  BOARD_SIZE,
  BoardGrid,
  GridCell,
  BoardState,
  LineClearResult,
  ActivePiece,
  INITIAL_HP
} from '../shared/types.js';
import { PieceShape } from '../shared/pieces.js';
import { generatePieceSet } from './prng.js';
import { HandSolver } from './handSolver.js';

export class GameEngine {
  /**
   * Create an empty 8x8 grid
   */
  public static createEmptyGrid(): BoardGrid {
    const grid: BoardGrid = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      const row: (GridCell | null)[] = [];
      for (let x = 0; x < BOARD_SIZE; x++) {
        row.push(null);
      }
      grid.push(row);
    }
    return grid;
  }

  /**
   * Clone a grid deeply
   */
  public static cloneGrid(grid: BoardGrid): BoardGrid {
    return grid.map(row => row.map(cell => (cell ? { ...cell } : null)));
  }

  /**
   * Initialize a new player board state for a match
   */
  public static initPlayerBoard(playerId: string, seed: number): BoardState {
    const grid = this.createEmptyGrid();
    const initialPieces = HandSolver.generateSolvablePieceSet(grid, seed, 0, 0);
    const activePieces: (ActivePiece | null)[] = initialPieces.map((piece, index) => ({
      piece,
      index,
      placed: false
    }));

    return {
      playerId,
      grid,
      score: 0,
      comboStreak: 0,
      activePieces,
      isKnockedOut: false,
      lastClearedLines: 0,
      round: 0,
      hp: INITIAL_HP,
      maxHp: INITIAL_HP,
      lastDamageDealt: 0,
      lastDamageTaken: 0,
      incomingDamage: 0
    };
  }

  /**
   * Check if a piece can be placed at (x, y) on the grid
   */
  public static canPlacePiece(grid: BoardGrid, piece: PieceShape, targetX: number, targetY: number): boolean {
    const { matrix, width, height } = piece;

    // Boundary check
    if (targetX < 0 || targetY < 0 || targetX + width > BOARD_SIZE || targetY + height > BOARD_SIZE) {
      return false;
    }

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (matrix[r][c] === 1) {
          const gx = targetX + c;
          const gy = targetY + r;
          if (grid[gy][gx] !== null) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Check if a piece can fit ANYWHERE on the board
   */
  public static canPieceFitAnywhere(grid: BoardGrid, piece: PieceShape): boolean {
    for (let y = 0; y <= BOARD_SIZE - piece.height; y++) {
      for (let x = 0; x <= BOARD_SIZE - piece.width; x++) {
        if (this.canPlacePiece(grid, piece, x, y)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if player has any legal moves left with their unplaced active pieces
   */
  public static hasAnyValidMoves(grid: BoardGrid, activePieces: (ActivePiece | null)[]): boolean {
    const availablePieces = activePieces.filter((ap): ap is ActivePiece => ap !== null && !ap.placed);
    if (availablePieces.length === 0) return true; // Hand empty, next round will be generated

    for (const ap of availablePieces) {
      if (this.canPieceFitAnywhere(grid, ap.piece)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Place a piece, age garbage blocks, calculate line clears and points.
   * Authoritative validation: returns null if invalid placement.
   */
  public static applyMove(
    board: BoardState,
    pieceIndex: number,
    targetX: number,
    targetY: number,
    seed: number
  ): {
    success: boolean;
    error?: string;
    clearResult?: LineClearResult;
    garbageSentToOpponent: number;
    damageDealt: number;
    isCritical: boolean;
    newRoundStarted: boolean;
  } {
    // 1. Validate active piece slot
    const activePiece = board.activePieces[pieceIndex];
    if (!activePiece || activePiece.placed) {
      return { success: false, error: 'Piece is already placed or invalid slot', garbageSentToOpponent: 0, damageDealt: 0, isCritical: false, newRoundStarted: false };
    }

    const { piece } = activePiece;

    // 2. Validate grid placement
    if (!this.canPlacePiece(board.grid, piece, targetX, targetY)) {
      return { success: false, error: 'Illegal placement location', garbageSentToOpponent: 0, damageDealt: 0, isCritical: false, newRoundStarted: false };
    }

    // 3. Stamp piece onto board
    let blockCount = 0;
    for (let r = 0; r < piece.height; r++) {
      for (let c = 0; c < piece.width; c++) {
        if (piece.matrix[r][c] === 1) {
          board.grid[targetY + r][targetX + c] = {
            color: piece.color,
            glowColor: piece.glowColor,
            id: piece.id
          };
          blockCount++;
        }
      }
    }

    // Mark piece as placed
    activePiece.placed = true;
    board.score += blockCount;

    // 4. Age existing garbage blocks on this player's board (each turn ticks remaining timer)
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const cell = board.grid[y][x];
        if (cell && cell.isGarbage && typeof cell.turnsRemaining === 'number') {
          cell.turnsRemaining -= 1;
          if (cell.turnsRemaining <= 0) {
            // Turn stone into standard clearable neon slate block
            cell.isGarbage = false;
            cell.color = '#94a3b8';
            cell.glowColor = 'rgba(148, 163, 184, 0.4)';
          }
        }
      }
    }

    // 5. Detect and execute line clears
    const clearResult = this.evaluateAndClearLines(board.grid, board.comboStreak);
    board.score += clearResult.pointsEarned;
    board.comboStreak = clearResult.comboStreak;
    board.lastClearedLines = clearResult.totalLines;

    // 6. Check if all 3 pieces in active pool are placed -> replenish from deterministic PRNG
    const remainingUnplaced = board.activePieces.filter(ap => ap !== null && !ap.placed);
    let newRoundStarted = false;

    if (remainingUnplaced.length === 0) {
      board.round += 1;
      const nextPieces = HandSolver.generateSolvablePieceSet(board.grid, seed, board.round, board.comboStreak);
      board.activePieces = nextPieces.map((p, idx) => ({
        piece: p,
        index: idx,
        placed: false
      }));
      newRoundStarted = true;
    }

    // 7. Check Knockout (KO) condition: can any available piece fit?
    if (!this.hasAnyValidMoves(board.grid, board.activePieces)) {
      board.isKnockedOut = true;
    }

    board.lastDamageDealt = clearResult.damageDealt;

    return {
      success: true,
      clearResult,
      garbageSentToOpponent: clearResult.garbageSent,
      damageDealt: clearResult.damageDealt,
      isCritical: clearResult.isCritical,
      newRoundStarted
    };
  }

  /**
   * Apply direct combat damage to a board state
   */
  public static applyDamage(
    board: BoardState,
    incomingDamage: number
  ): { actualDamage: number; mitigated: number; remainingHp: number; isKnockedOut: boolean } {
    const actualDamage = Math.max(0, incomingDamage);
    board.hp = Math.max(0, board.hp - actualDamage);
    board.lastDamageTaken = actualDamage;

    if (board.hp <= 0) {
      board.isKnockedOut = true;
    }

    return {
      actualDamage,
      mitigated: 0,
      remainingHp: board.hp,
      isKnockedOut: board.isKnockedOut
    };
  }

  /**
   * Scan grid for full rows and columns, clear them, compute combo and attack values
   */
  public static evaluateAndClearLines(grid: BoardGrid, currentCombo: number): LineClearResult {
    const fullRows: number[] = [];
    const fullCols: number[] = [];

    // Find full rows
    for (let y = 0; y < BOARD_SIZE; y++) {
      let isFull = true;
      for (let x = 0; x < BOARD_SIZE; x++) {
        const cell = grid[y][x];
        // Active stone garbage blocks with turnsRemaining > 0 block the line clear!
        if (cell === null || (cell.isGarbage && (cell.turnsRemaining ?? 0) > 0)) {
          isFull = false;
          break;
        }
      }
      if (isFull) {
        fullRows.push(y);
      }
    }

    // Find full columns
    for (let x = 0; x < BOARD_SIZE; x++) {
      let isFull = true;
      for (let y = 0; y < BOARD_SIZE; y++) {
        const cell = grid[y][x];
        if (cell === null || (cell.isGarbage && (cell.turnsRemaining ?? 0) > 0)) {
          isFull = false;
          break;
        }
      }
      if (isFull) {
        fullCols.push(x);
      }
    }

    const totalLines = fullRows.length + fullCols.length;

    if (totalLines === 0) {
      return {
        rows: [],
        cols: [],
        totalLines: 0,
        pointsEarned: 0,
        comboStreak: 0,
        garbageSent: 0,
        isBoardCleared: false,
        damageDealt: 0,
        isCritical: false
      };
    }

    // Clear identified rows and cols
    for (const r of fullRows) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        grid[r][x] = null;
      }
    }
    for (const c of fullCols) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        grid[y][c] = null;
      }
    }

    // Check if whole board cleared
    let isBoardCleared = true;
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (grid[y][x] !== null) {
          isBoardCleared = false;
          break;
        }
      }
      if (!isBoardCleared) break;
    }

    // Score calculation
    const newCombo = currentCombo + 1;
    const comboMultiplier = 1 + (newCombo - 1) * 0.5;

    let basePoints = 0;
    if (totalLines === 1) basePoints = 100;
    else if (totalLines === 2) basePoints = 300;
    else if (totalLines === 3) basePoints = 600;
    else if (totalLines === 4) basePoints = 1000;
    else basePoints = 1500 + (totalLines - 5) * 500;

    let pointsEarned = Math.round(basePoints * comboMultiplier);
    if (isBoardCleared) {
      pointsEarned += 2000; // All-Clear Mega Bonus!
    }

    // Direct HP Combat Damage Calculation
    // Base damage: 1 line = 50, 2 lines = 140, 3 lines = 260, 4+ lines = 450
    let baseDamage = 0;
    if (totalLines === 1) baseDamage = 50;
    else if (totalLines === 2) baseDamage = 140;
    else if (totalLines === 3) baseDamage = 260;
    else if (totalLines >= 4) baseDamage = 450;

    if (isBoardCleared) {
      baseDamage += 300; // All-clear critical finisher
    }

    // Combo multiplier: x1: 1.0, x2: 1.3, x3: 1.7, x4: 2.1, x5+: 2.5
    let damageMultiplier = 1.0;
    if (newCombo === 2) damageMultiplier = 1.3;
    else if (newCombo === 3) damageMultiplier = 1.7;
    else if (newCombo === 4) damageMultiplier = 2.1;
    else if (newCombo >= 5) damageMultiplier = 2.5;

    const damageDealt = Math.round(baseDamage * damageMultiplier);
    const isCritical = newCombo >= 3 || totalLines >= 3 || isBoardCleared;

    // Attack calculation (Garbage lines/blocks sent to opponent)
    let garbageSent = 0;
    if (totalLines === 2) garbageSent += 1;
    else if (totalLines === 3) garbageSent += 2;
    else if (totalLines >= 4) garbageSent += 3;

    if (newCombo >= 2) {
      garbageSent += Math.min(newCombo - 1, 3);
    }

    return {
      rows: fullRows,
      cols: fullCols,
      totalLines,
      pointsEarned,
      comboStreak: newCombo,
      garbageSent,
      isBoardCleared,
      damageDealt,
      isCritical
    };
  }

  /**
   * Apply incoming garbage attack blocks onto target board
   */
  public static injectGarbage(grid: BoardGrid, count: number): { x: number; y: number }[] {
    const placedPositions: { x: number; y: number }[] = [];
    const emptyCells: { x: number; y: number }[] = [];

    // Find all empty cells
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (grid[y][x] === null) {
          emptyCells.push({ x, y });
        }
      }
    }

    // Shuffle and pick
    const toPlace = Math.min(count, emptyCells.length);
    for (let i = 0; i < toPlace; i++) {
      const randomIndex = Math.floor(Math.random() * emptyCells.length);
      const pos = emptyCells.splice(randomIndex, 1)[0];
      grid[pos.y][pos.x] = {
        color: '#475569', // Dark stone slate
        glowColor: 'rgba(71, 85, 105, 0.8)',
        isGarbage: true,
        turnsRemaining: 2
      };
      placedPositions.push(pos);
    }

    return placedPositions;
  }
}
