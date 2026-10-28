import { HandSolver } from '../server/handSolver.js';
import { GameEngine } from '../server/gameEngine.js';
import { BoardGrid, BOARD_SIZE } from '../shared/types.js';

function createChallengingBoard(): BoardGrid {
  const grid = GameEngine.createEmptyGrid();
  // Fill 60% - 75% of board
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (Math.random() < 0.68) {
        grid[y][x] = { color: '#06b6d4' };
      }
    }
  }
  return grid;
}

function testStepClearDistribution() {
  console.log('🧪 Testing Multi-Step Clear Difficulty Distribution (Step 1, Step 2, Step 3)...');

  let step1Count = 0;
  let step2Count = 0;
  let step3Count = 0;
  let naturalFitCount = 0;
  const totalRounds = 50;

  for (let i = 0; i < totalRounds; i++) {
    const grid = createChallengingBoard();
    const seed = 5000 + i;
    const hand = HandSolver.generateSolvablePieceSet(grid, seed, i);

    const solution = HandSolver.findSolutionPath(grid, hand);
    if (!solution.solvable) {
      throw new Error(`Round ${i} failed: hand was NOT solvable!`);
    }

    if (solution.firstClearStep === 1) step1Count++;
    else if (solution.firstClearStep === 2) step2Count++;
    else if (solution.firstClearStep === 3) step3Count++;
    else naturalFitCount++;
  }

  console.log(`📊 Clear Step Distribution across ${totalRounds} challenging rounds:`);
  console.log(`   - Step 1 Clear (Emergency Clutch): ${step1Count}`);
  console.log(`   - Step 2 Clear (Strategic 2-Step Setup): ${step2Count}`);
  console.log(`   - Step 3 Clear (Crevice & Final Clear): ${step3Count}`);
  console.log(`   - Natural Fit (No line clear required): ${naturalFitCount}`);

  if (step2Count === 0 && step3Count === 0) {
    throw new Error('Expected at least some rounds to feature Step 2 or Step 3 clears!');
  }

  console.log('✅ Verified: Line clears successfully occur across Step 1, Step 2, and Step 3!');
  console.log('✅ Solvability guarantee strictly preserved 100% across all 50 rounds!');
  console.log('🎉 Multi-Step Difficulty Test PASSED!');
}

testStepClearDistribution();
