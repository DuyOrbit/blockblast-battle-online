import { PIECE_CATALOG } from '../shared/pieces.js';
import { generatePieceSet } from '../server/prng.js';

function testClassicPieces() {
  console.log('🧪 Verifying Classic Block Blast 7 Core Piece Groups...');

  const expectedCategories = ['dot', 'line', 'square', 'corner_3', 'l_shape', 't_shape', 'z_shape'];

  // 1. Verify all pieces belong strictly to the 7 core categories
  for (const piece of PIECE_CATALOG) {
    if (!expectedCategories.includes(piece.category)) {
      throw new Error(`Invalid category found: ${piece.category} in piece ${piece.id}`);
    }
  }

  // 2. Count pieces in each category
  const counts: Record<string, number> = {};
  for (const p of PIECE_CATALOG) {
    counts[p.category] = (counts[p.category] || 0) + 1;
  }

  console.log('📊 Piece Counts per Category:', counts);

  if (counts['dot'] !== 1) throw new Error(`Expected 1 dot piece, got ${counts['dot']}`);
  if (counts['line'] !== 8) throw new Error(`Expected 8 line pieces (2,3,4,5 h/v), got ${counts['line']}`);
  if (counts['square'] !== 2) throw new Error(`Expected 2 square pieces (2x2, 3x3), got ${counts['square']}`);
  if (counts['corner_3'] !== 4) throw new Error(`Expected 4 corner 3-block pieces, got ${counts['corner_3']}`);
  if (counts['l_shape'] !== 12) throw new Error(`Expected 12 L-shapes (8 L-4 and 4 L-5), got ${counts['l_shape']}`);
  if (counts['t_shape'] !== 4) throw new Error(`Expected 4 T-shapes, got ${counts['t_shape']}`);
  if (counts['z_shape'] !== 4) throw new Error(`Expected 4 Z/S shapes (2 h, 2 v), got ${counts['z_shape']}`);

  const total = PIECE_CATALOG.length;
  if (total !== 35) throw new Error(`Expected total 35 classic shapes, got ${total}`);

  console.log(`✅ Total pieces: ${total} - all strictly match the 7 core classic groups!`);

  // 3. Test generatePieceSet balancing
  for (let seed = 1; seed <= 50; seed++) {
    const hand = generatePieceSet(seed, 0);
    if (hand.length !== 3) throw new Error('Expected hand size of 3');

    // Count giant pieces in hand
    const giantCount = hand.filter(p => p.id === 'square_3x3' || p.id.startsWith('line_5')).length;
    if (giantCount > 1) {
      throw new Error(`Hand has ${giantCount} giant pieces, which should be capped at 1 for balance!`);
    }
  }

  console.log('✅ Hand balancing verified across 50 random match seeds (never >1 giant piece per hand)!');
  console.log('🎉 Classic Block Blast Piece Rules PASSED 100%!');
}

testClassicPieces();
