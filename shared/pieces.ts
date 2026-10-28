import type { Block, BoardMatrix } from './blockSpawner.js';
import { BLOCK_CATALOG, NEON_COLORS, BlockSpawner, Mulberry32 } from './blockSpawner.js';

export type PieceShape = Block;
export type { Block, BoardMatrix };
export { BLOCK_CATALOG, NEON_COLORS, BlockSpawner, Mulberry32 };

export const PIECE_CATALOG: PieceShape[] = BLOCK_CATALOG;

export function getPieceById(id: string): PieceShape | undefined {
  return PIECE_CATALOG.find(p => p.id === id);
}

export function getPiecesByCategory(category: PieceShape['category']): PieceShape[] {
  return PIECE_CATALOG.filter(p => p.category === category);
}
