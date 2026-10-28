import { PieceShape } from '../shared/pieces.js';
import { BlockSpawner, BoardMatrix } from '../shared/blockSpawner.js';

export { Mulberry32 } from '../shared/blockSpawner.js';

/**
 * Sinh bộ 3 khối (Batch Generation of 3 Blocks) chuẩn BlockSpawner:
 * - Đồng bộ hạt giống (deterministic seed) theo từng round cho trận đấu PvP công bằng.
 * - Cân bằng trọng số động theo số ô trống trên bàn cờ 8x8.
 * - Áp dụng luật hạn chế trùng lặp (không quá 1 khối 3x3 hoặc 1 khối thanh 5).
 * - Đảm bảo nguyên tắc sống còn (Solvability Guarantee) ít nhất 1 khối đặt vừa ngay lập tức.
 */
export function generatePieceSet(
  seed: number,
  roundIndex: number,
  board?: BoardMatrix
): PieceShape[] {
  const roundSeed = (seed ^ Math.imul(roundIndex + 1, 0x9e3779b9)) >>> 0;
  const spawner = new BlockSpawner(roundSeed);

  if (board) {
    return spawner.generateBlockBatch(board);
  }

  // Bàn cờ rỗng 8x8 mặc định
  const emptyBoard: number[][] = Array.from({ length: 8 }, () => Array(8).fill(0));
  return spawner.generateBlockBatch(emptyBoard);
}
