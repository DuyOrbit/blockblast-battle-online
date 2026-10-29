import { BlockSpawner, BLOCK_CATALOG } from '../shared/blockSpawner.js';

console.log('🧪 Testing Dopamine Heuristic Combo Spawner...');

// Test 1: Board has row 3 filled with 7 cells, missing column 4 (empty at r=3, c=4)
const testBoard: number[][] = Array.from({ length: 8 }, () => Array(8).fill(0));
for (let c = 0; c < 8; c++) {
  if (c !== 4) testBoard[3][c] = 1; // row 3 is 7/8 filled
}

const catalysts = BlockSpawner.findCatalystBlocks(testBoard);
console.log(`✅ Catalyst pieces found for 7/8 row: ${catalysts.length} shapes`);
const hasDot1 = catalysts.some(b => b.id === 'dot_1');
console.log(`✅ Contains dot_1 (1x1 block)? ${hasDot1 ? 'YES' : 'NO'}`);

if (!hasDot1 || catalysts.length === 0) {
  throw new Error('Catalyst detection failed to identify key pieces for 7/8 row!');
}

// Test 2: Generate 100 batches with comboStreak = 2, verify catalyst injection rate is high (>= 60%)
let catalystCount = 0;
const trials = 100;
for (let i = 0; i < trials; i++) {
  const batch = BlockSpawner.generateBlockBatch(testBoard, i * 997, 2);
  const containsCatalyst = batch.some(b => catalysts.some(c => c.id === b.id));
  if (containsCatalyst) catalystCount++;
}

console.log(`📊 Dopamine Combo Catalyst Injection Rate: ${catalystCount}/${trials} (${(catalystCount / trials * 100).toFixed(1)}%)`);
if (catalystCount < 60) {
  throw new Error(`Catalyst injection rate too low: ${catalystCount}% (expected >= 60%)`);
}

console.log('🎉 Dopamine Combo Spawner test PASSED 100%!');
