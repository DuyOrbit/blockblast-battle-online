import { GameEngine } from '../server/gameEngine.js';
import { INITIAL_HP } from '../shared/types.js';

console.log('🧪 Testing 1v1 PvP HP Combat System...');

// 1. Check Initial Board HP
const boardA = GameEngine.initPlayerBoard('pA', 12345);
const boardB = GameEngine.initPlayerBoard('pB', 12345);

if (boardA.hp !== INITIAL_HP || boardB.hp !== INITIAL_HP) {
  throw new Error(`Board HP not initialized correctly! Expected ${INITIAL_HP}, got ${boardA.hp}`);
}
console.log(`✅ Both boards initialized with ${INITIAL_HP} HP`);

// 2. Test evaluateAndClearLines damage calculation
// Fill 2 rows completely on boardA, and leave 1 cell on row 7 so it's not All-Clear
for (let c = 0; c < 8; c++) {
  boardA.grid[0][c] = { color: '#ff3366' };
  boardA.grid[1][c] = { color: '#ff3366' };
}
boardA.grid[7][7] = { color: '#38bdf8' }; // Prevent All-Clear

const clearRes = GameEngine.evaluateAndClearLines(boardA.grid, 1); // combo 1 -> newCombo = 2
console.log(`✅ 2 rows cleared: damageDealt = ${clearRes.damageDealt}, points = ${clearRes.pointsEarned}, combo = ${clearRes.comboStreak}`);

// Base for 2 rows is 140, multiplier for combo 2 is 1.3 => 140 * 1.3 = 182
if (clearRes.damageDealt !== 182) {
  throw new Error(`Damage calculation mismatch: expected 182, got ${clearRes.damageDealt}`);
}

// 3. Test applyDamage to Board B
const dmgRes = GameEngine.applyDamage(boardB, clearRes.damageDealt);
console.log(`✅ Board B received ${dmgRes.actualDamage} damage. Remaining HP: ${dmgRes.remainingHp} / ${boardB.maxHp}`);

if (boardB.hp !== INITIAL_HP - 182) {
  throw new Error(`HP deduction failed! Expected ${INITIAL_HP - 182}, got ${boardB.hp}`);
}

// 4. Test K.O upon fatal damage
const fatalRes = GameEngine.applyDamage(boardB, 900);
console.log(`✅ Fatal hit applied: Remaining HP = ${fatalRes.remainingHp}, Knocked Out = ${fatalRes.isKnockedOut}`);

if (!fatalRes.isKnockedOut || boardB.hp !== 0) {
  throw new Error(`Fatal hit should knock out player and clamp HP at 0!`);
}

console.log('🎉 1v1 PvP HP Combat System test PASSED 100%!');
