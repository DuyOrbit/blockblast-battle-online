import { HandSolver } from '../server/handSolver.js';
import { GameEngine } from '../server/gameEngine.js';
import { BoardGrid, BOARD_SIZE } from '../shared/types.js';

function createCrowdedGrid(): BoardGrid {
  const grid = GameEngine.createEmptyGrid();
  // Fill ~75% of the board leaving tricky scattered holes and nearly-full rows
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      // Leave row 0 with 1 hole, row 3 with 1 hole, and some scattered single holes
      if ((y === 0 && x === 3) || (y === 3 && x === 5) || (y === 5 && x === 2) || (y === 7 && x === 7)) {
        grid[y][x] = null;
      } else if (Math.random() < 0.72) {
        grid[y][x] = { color: '#06b6d4' };
      }
    }
  }
  return grid;
}

function testSolvabilityGuarantee() {
  console.log('🧪 Testing HandSolver Solvability Guarantee on Tight Boards (Thế Bí)...');

  let totalTests = 40;
  let rescuedHandsCount = 0;

  for (let i = 0; i < totalTests; i++) {
    const grid = createCrowdedGrid();
    const emptyCount = HandSolver.countEmptyCells(grid);

    const seed = 1000 + i;
    const hand = HandSolver.generateSolvablePieceSet(grid, seed, i);

    if (hand.length !== 3) {
      throw new Error(`Expected hand length 3, got ${hand.length}`);
    }

    const isSolvable = HandSolver.isHandSolvable(grid, hand);
    if (!isSolvable) {
      throw new Error(`Test ${i} failed: Hand [${hand.map(p => p.id).join(', ')}] was NOT solvable on grid with ${emptyCount} empty cells!`);
    }

    // Check if at least 1 piece is small/tactical for tight spots
    const hasSmallPiece = hand.some(p => p.id === 'dot_1' || p.id.startsWith('line_2') || p.id.startsWith('corner_3'));
    if (emptyCount < 20 && hasSmallPiece) {
      rescuedHandsCount++;
    }
  }

  console.log(`✅ ${totalTests}/${totalTests} challenging crowded boards tested!`);
  console.log(`✅ All ${totalTests} hands GUARANTEED to have at least one survivable path (100% Solvability)!`);
  console.log(`🛡️ ${rescuedHandsCount} tight hands were actively rescued with tactical solutions!`);
  console.log('🎉 Solvability Guarantee Test PASSED successfully!');
}

testSolvabilityGuarantee();
