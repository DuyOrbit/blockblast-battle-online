import { BOARD_SIZE, BoardGrid } from '../shared/types.js';
import { PieceShape, PIECE_CATALOG, getPieceById } from '../shared/pieces.js';
import { Mulberry32, generatePieceSet } from './prng.js';

export interface SolutionPath {
  solvable: boolean;
  firstClearStep: 1 | 2 | 3 | null; // Which placement step triggers the line clear
  order?: number[];
}

export class HandSolver {
  /**
   * Fast check if a piece fits at (targetX, targetY) on grid
   */
  public static canPlacePiece(grid: BoardGrid, piece: PieceShape, targetX: number, targetY: number): boolean {
    const { matrix, width, height } = piece;

    if (targetX < 0 || targetY < 0 || targetX + width > BOARD_SIZE || targetY + height > BOARD_SIZE) {
      return false;
    }

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (matrix[r][c] === 1) {
          if (grid[targetY + r][targetX + c] !== null) {
            return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * Check if piece can fit ANYWHERE on grid
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
   * Simulate placement of piece on grid, clearing any completed rows/columns.
   * Returns new cloned grid and number of lines cleared.
   */
  public static simulatePlacement(
    grid: BoardGrid,
    piece: PieceShape,
    targetX: number,
    targetY: number
  ): { grid: BoardGrid; linesCleared: number } {
    const newGrid: BoardGrid = grid.map(row => row.slice());

    // Stamp piece
    for (let r = 0; r < piece.height; r++) {
      for (let c = 0; c < piece.width; c++) {
        if (piece.matrix[r][c] === 1) {
          newGrid[targetY + r][targetX + c] = {
            color: piece.color,
            id: piece.id
          };
        }
      }
    }

    // Check full rows
    const fullRows: number[] = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      let isFull = true;
      for (let x = 0; x < BOARD_SIZE; x++) {
        const cell = newGrid[y][x];
        if (cell === null || (cell.isGarbage && (cell.turnsRemaining ?? 0) > 0)) {
          isFull = false;
          break;
        }
      }
      if (isFull) fullRows.push(y);
    }

    // Check full cols
    const fullCols: number[] = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
      let isFull = true;
      for (let y = 0; y < BOARD_SIZE; y++) {
        const cell = newGrid[y][x];
        if (cell === null || (cell.isGarbage && (cell.turnsRemaining ?? 0) > 0)) {
          isFull = false;
          break;
        }
      }
      if (isFull) fullCols.push(x);
    }

    // Clear full rows
    for (const r of fullRows) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        newGrid[r][x] = null;
      }
    }

    // Clear full cols
    for (const c of fullCols) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        newGrid[y][c] = null;
      }
    }

    return {
      grid: newGrid,
      linesCleared: fullRows.length + fullCols.length
    };
  }

  /**
   * Find candidate valid placements for a piece.
   * Provides both setup moves (non-clearing) and clearing moves so solutions
   * at Step 1, Step 2, and Step 3 can all be discovered!
   */
  public static findCandidatePlacements(
    grid: BoardGrid,
    piece: PieceShape,
    maxCandidates = 8
  ): { x: number; y: number; clearsLines: boolean }[] {
    const clearingPlacements: { x: number; y: number; clearsLines: boolean }[] = [];
    const regularPlacements: { x: number; y: number; clearsLines: boolean }[] = [];

    for (let y = 0; y <= BOARD_SIZE - piece.height; y++) {
      for (let x = 0; x <= BOARD_SIZE - piece.width; x++) {
        if (this.canPlacePiece(grid, piece, x, y)) {
          let clearsLine = false;

          // Check impacted rows
          for (let r = 0; r < piece.height; r++) {
            const gy = y + r;
            let full = true;
            for (let gx = 0; gx < BOARD_SIZE; gx++) {
              const isFilled = (gx >= x && gx < x + piece.width && piece.matrix[r][gx - x] === 1) || grid[gy][gx] !== null;
              if (!isFilled) {
                full = false;
                break;
              }
            }
            if (full) {
              clearsLine = true;
              break;
            }
          }

          // Check impacted cols
          if (!clearsLine) {
            for (let c = 0; c < piece.width; c++) {
              const gx = x + c;
              let full = true;
              for (let gy = 0; gy < BOARD_SIZE; gy++) {
                const isFilled = (gy >= y && gy < y + piece.height && piece.matrix[gy - y][c] === 1) || grid[gy][gx] !== null;
                if (!isFilled) {
                  full = false;
                  break;
                }
              }
              if (full) {
                clearsLine = true;
                break;
              }
            }
          }

          if (clearsLine) {
            clearingPlacements.push({ x, y, clearsLines: true });
          } else {
            regularPlacements.push({ x, y, clearsLines: false });
          }
        }
      }
    }

    // Interleave clearing and regular placements so step-2 and step-3 clear solutions are found
    const candidates: { x: number; y: number; clearsLines: boolean }[] = [];

    // Prioritize a mix of regular (setup) placements and clearing placements
    const regCount = Math.min(regularPlacements.length, 4);
    const clrCount = Math.min(clearingPlacements.length, 4);

    for (let i = 0; i < Math.max(regCount, clrCount); i++) {
      if (i < regCount) candidates.push(regularPlacements[i]);
      if (i < clrCount) candidates.push(clearingPlacements[i]);
    }

    return candidates.length > 0 ? candidates.slice(0, maxCandidates) : regularPlacements.slice(0, maxCandidates);
  }

  /**
   * Evaluates if a hand is solvable, and identifies at which step the line clear occurs:
   * - Step 1: Clears immediately on piece 1 (Emergency clutch)
   * - Step 2: Piece 1 is a setup move, piece 2 triggers the clear! (Challenging puzzle)
   * - Step 3: Piece 1 & 2 fit on existing space, piece 3 triggers the clear (Strategic)
   * - null: All 3 pieces fit naturally without requiring line clears
   */
  public static findSolutionPath(grid: BoardGrid, pieces: PieceShape[]): SolutionPath {
    if (pieces.length === 0) return { solvable: true, firstClearStep: null };
    if (pieces.length === 1) {
      const canFit = this.canPieceFitAnywhere(grid, pieces[0]);
      return { solvable: canFit, firstClearStep: null };
    }

    // Fast check: At least one piece must fit on the current board
    if (!pieces.some(p => this.canPieceFitAnywhere(grid, p))) {
      return { solvable: false, firstClearStep: null };
    }

    const permutations = pieces.length === 3
      ? [
          [0, 1, 2],
          [0, 2, 1],
          [1, 0, 2],
          [1, 2, 0],
          [2, 0, 1],
          [2, 1, 0]
        ]
      : [[0, 1], [1, 0]];

    let fallbackSolution: SolutionPath | null = null;

    for (const [iA, iB, iC] of permutations) {
      const pA = pieces[iA];
      const candA = this.findCandidatePlacements(grid, pA);
      if (candA.length === 0) continue;

      for (const posA of candA) {
        const resA = this.simulatePlacement(grid, pA, posA.x, posA.y);

        if (pieces.length === 2) {
          const pB = pieces[iB];
          if (this.canPieceFitAnywhere(resA.grid, pB)) {
            const firstClearStep = resA.linesCleared > 0 ? 1 : 2;
            return { solvable: true, firstClearStep, order: [iA, iB] };
          }
          continue;
        }

        const pB = pieces[iB];
        const candB = this.findCandidatePlacements(resA.grid, pB);
        if (candB.length === 0) continue;

        for (const posB of candB) {
          const resB = this.simulatePlacement(resA.grid, pB, posB.x, posB.y);

          const pC = pieces[iC!];
          const candC = this.findCandidatePlacements(resB.grid, pC, 2);
          if (candC.length > 0) {
            // Valid 3-piece survival sequence found!
            const resC = this.simulatePlacement(resB.grid, pC, candC[0].x, candC[0].y);

            let firstClearStep: 1 | 2 | 3 | null = null;
            if (resA.linesCleared > 0) firstClearStep = 1;
            else if (resB.linesCleared > 0) firstClearStep = 2;
            else if (resC.linesCleared > 0) firstClearStep = 3;

            const solution: SolutionPath = {
              solvable: true,
              firstClearStep,
              order: [iA, iB, iC!]
            };

            // If this is a Step 2 or Step 3 clear (more challenging setup), prefer returning it!
            if (firstClearStep === 2 || firstClearStep === 3) {
              return solution;
            }

            if (!fallbackSolution) {
              fallbackSolution = solution;
            }
          }
        }
      }
    }

    return fallbackSolution || { solvable: false, firstClearStep: null };
  }

  /**
   * Check if there exists ANY valid permutation of [p0, p1, p2] that can all be legally placed on grid.
   */
  public static isHandSolvable(grid: BoardGrid, pieces: PieceShape[]): boolean {
    return this.findSolutionPath(grid, pieces).solvable;
  }

  /**
   * Counts empty cells on the grid
   */
  public static countEmptyCells(grid: BoardGrid): number {
    let count = 0;
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (grid[y][x] === null) count++;
      }
    }
    return count;
  }

  /**
   * Generates a 3-piece hand GUARANTEED to have at least 1 survivable path on the given grid.
   *
   * DIFFICULTY DESIGN:
   * - Allows line clearing to occur at Step 1, Step 2, or Step 3!
   * - When the board permits, allows Step 2 clear puzzles (Piece 1 is a setup move, Piece 2 clears lines)
   *   raising intellectual challenge while guaranteeing 100% survivability!
   * - When in critical deadlock (< 10 cells), allows Step 1 emergency clears.
   */
  public static generateSolvablePieceSet(
    grid: BoardGrid,
    seed: number,
    roundIndex: number,
    comboStreak: number = 0
  ): PieceShape[] {
    const emptyCells = this.countEmptyCells(grid);
    if (emptyCells === 0) {
      return generatePieceSet(seed, roundIndex, undefined, comboStreak);
    }

    // 1. First, roll standard balanced pieces from BlockSpawner with dynamic weighted balancing & combo catalyst bias
    let hand = generatePieceSet(seed, roundIndex, grid, comboStreak);

    // 2. Test if the natural roll is already solvable (could be Step 1, Step 2, Step 3, or natural fit)
    const initialPath = this.findSolutionPath(grid, hand);
    if (initialPath.solvable) {
      return hand;
    }

    // 3. The player is in a tight spot (thế bí)!
    const roundSeed = (seed ^ Math.imul(roundIndex + 7, 0x85ebca6b)) >>> 0;
    const rng = new Mulberry32(roundSeed);

    const tacticalPieces = PIECE_CATALOG.filter(p =>
      p.id === 'dot_1' ||
      p.id.startsWith('line_2') ||
      p.id.startsWith('corner_3') ||
      p.id.startsWith('line_3') ||
      p.id === 'square_2x2' ||
      p.id.startsWith('t_4') ||
      p.id.startsWith('z_4') ||
      p.id.startsWith('s_4')
    );

    let bestCandidate: PieceShape[] | null = null;
    let preferredStep2Or3Candidate: PieceShape[] | null = null;

    // Try finding solvable combinations that offer a rewarding setup (Step 2 or Step 3 clear)
    for (let attempt = 0; attempt < 25; attempt++) {
      const candidate = [...hand];

      let worstIndex = 0;
      let maxBlocks = 0;
      for (let i = 0; i < candidate.length; i++) {
        const blocks = candidate[i].matrix.flat().filter(v => v === 1).length;
        if (!this.canPieceFitAnywhere(grid, candidate[i]) || blocks > maxBlocks) {
          maxBlocks = blocks;
          worstIndex = i;
        }
      }

      // Replace with tactical piece
      const rescuePiece = tacticalPieces[rng.nextRange(0, tacticalPieces.length)];
      candidate[worstIndex] = rescuePiece;

      const path = this.findSolutionPath(grid, candidate);
      if (path.solvable) {
        // If it requires Step 2 or Step 3 clear (more challenging setup), favor it!
        if (path.firstClearStep === 2 || path.firstClearStep === 3) {
          preferredStep2Or3Candidate = candidate;
          break;
        }

        if (!bestCandidate) {
          bestCandidate = candidate;
        }
      }

      hand = candidate;
    }

    // Return the more challenging Step 2/3 setup if found, otherwise return the Step 1 solution
    if (preferredStep2Or3Candidate) {
      return preferredStep2Or3Candidate;
    }
    if (bestCandidate) {
      return bestCandidate;
    }

    // 4. Critical emergency fallback for near-full boards
    const dot1 = getPieceById('dot_1') || PIECE_CATALOG[0];
    const line2h = getPieceById('line_2_h') || PIECE_CATALOG[1];
    const line2v = getPieceById('line_2_v') || PIECE_CATALOG[2];

    const emergencyCandidates: PieceShape[][] = [
      [dot1, line2h, line2v],
      [dot1, dot1, line2h],
      [dot1, dot1, dot1]
    ];

    for (const emergencyHand of emergencyCandidates) {
      if (this.isHandSolvable(grid, emergencyHand)) {
        return emergencyHand;
      }
    }

    return [dot1, dot1, dot1];
  }
}
