import { BlockSpawner, BLOCK_CATALOG, Block } from '../shared/blockSpawner.js';

function runBlockSpawnerTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ MODULE BLOCK SPAWNER / RNG ENGINE');
  console.log('🧪 ========================================================');

  // =========================================================================
  // TEST 1: KIỂM TRA ĐỊNH NGHĨA DỮ LIỆU KHỐI (SHAPE DEFINITIONS & METADATA)
  // =========================================================================
  console.log('\n--- [TEST 1] Kiểm tra 35 khối cố định & Metadata ---');
  if (BLOCK_CATALOG.length !== 35) {
    throw new Error(`❌ Mong đợi 35 khối nhưng nhận được: ${BLOCK_CATALOG.length}`);
  }

  const categoryCounts: Record<string, number> = {};
  for (const block of BLOCK_CATALOG) {
    categoryCounts[block.category] = (categoryCounts[block.category] || 0) + 1;

    // Kiểm tra ma trận nhị phân 2D (chỉ chứa 0 và 1)
    if (!Array.isArray(block.matrix) || block.matrix.length === 0) {
      throw new Error(`❌ Block ${block.id} ma trận không hợp lệ`);
    }

    let actualOnes = 0;
    for (let r = 0; r < block.matrix.length; r++) {
      for (let c = 0; c < block.matrix[r].length; c++) {
        const val = block.matrix[r][c];
        if (val !== 0 && val !== 1) {
          throw new Error(`❌ Block ${block.id} chứa giá trị ma trận không phải 0/1: ${val}`);
        }
        if (val === 1) actualOnes++;
      }
    }

    // Kiểm tra metadata: size, width, height
    if (block.size !== actualOnes) {
      throw new Error(`❌ Block ${block.id} metadata size (${block.size}) != số ô 1 (${actualOnes})`);
    }
    if (block.height !== block.matrix.length) {
      throw new Error(`❌ Block ${block.id} height (${block.height}) != matrix.length (${block.matrix.length})`);
    }
    if (block.width !== block.matrix[0].length) {
      throw new Error(`❌ Block ${block.id} width (${block.width}) != matrix[0].length (${block.matrix[0].length})`);
    }
  }

  console.log('✅ 35/35 khối có metadata size, width, height chính xác 100%!');
  console.log('📊 Số lượng từng nhóm khối:', categoryCounts);

  if (categoryCounts['dot'] !== 1) throw new Error('❌ Dot phải có đúng 1 khối');
  if (categoryCounts['line'] !== 8) throw new Error('❌ Lines phải có đúng 8 khối');
  if (categoryCounts['square'] !== 2) throw new Error('❌ Squares phải có đúng 2 khối');
  if (categoryCounts['corner_3'] !== 4) throw new Error('❌ Corner 3 ô phải có đúng 4 khối');
  if (categoryCounts['l_shape'] !== 12) throw new Error('❌ L-shapes phải có đúng 12 khối (8 L thường + 4 L lớn)');
  if (categoryCounts['t_shape'] !== 4) throw new Error('❌ T-shape phải có đúng 4 khối');
  if (categoryCounts['z_shape'] !== 4) throw new Error('❌ Z/S-shape phải có đúng 4 khối');
  console.log('✅ Cấu trúc 7 nhóm khối cốt lõi khớp chuẩn 100%!');

  // =========================================================================
  // TEST 2: KIỂM TRA HÀM canPlace(board, shape)
  // =========================================================================
  console.log('\n--- [TEST 2] Kiểm tra hàm canPlace(board, shape) ---');
  const emptyBoard: number[][] = Array.from({ length: 8 }, () => Array(8).fill(0));
  const fullBoard: number[][] = Array.from({ length: 8 }, () => Array(8).fill(1));

  // Bàn rỗng: tất cả 35 khối đều phải đặt được
  for (const block of BLOCK_CATALOG) {
    if (!BlockSpawner.canPlace(emptyBoard, block)) {
      throw new Error(`❌ Bàn rỗng nhưng canPlace báo false cho khối ${block.id}`);
    }
  }
  console.log('✅ Bàn cờ rỗng: 35/35 khối đều đặt được!');

  // Bàn đầy: tất cả 35 khối đều không thể đặt
  for (const block of BLOCK_CATALOG) {
    if (BlockSpawner.canPlace(fullBoard, block)) {
      throw new Error(`❌ Bàn đầy nhưng canPlace báo true cho khối ${block.id}`);
    }
  }
  console.log('✅ Bàn cờ kín 100%: 35/35 khối đều bị chặn chính xác!');

  // Bàn cờ chỉ còn đúng 1 ô trống duy nhất tại (3, 4)
  const singleSlotBoard = Array.from({ length: 8 }, () => Array(8).fill(1));
  singleSlotBoard[3][4] = 0;

  const dotBlock = BLOCK_CATALOG.find(b => b.id === 'dot_1')!;
  const square2x2 = BLOCK_CATALOG.find(b => b.id === 'square_2x2')!;
  const line5 = BLOCK_CATALOG.find(b => b.id === 'line_5_h')!;

  if (!BlockSpawner.canPlace(singleSlotBoard, dotBlock)) {
    throw new Error('❌ Khối 1x1 phải đặt được vào ô trống duy nhất!');
  }
  if (BlockSpawner.canPlace(singleSlotBoard, square2x2)) {
    throw new Error('❌ Khối 2x2 không được phép đặt vừa vào 1 ô trống!');
  }
  if (BlockSpawner.canPlace(singleSlotBoard, line5)) {
    throw new Error('❌ Khối thanh 5 không được phép đặt vừa vào 1 ô trống!');
  }
  console.log('✅ Bàn cờ 1 lỗ trống: Chỉ khối 1x1 lọt vừa, các khối khác bị chặn!');

  // =========================================================================
  // TEST 3: NGUYÊN TẮC SỐNG CÒN (SOLVABILITY GUARANTEE)
  // =========================================================================
  console.log('\n--- [TEST 3] Kiểm tra Nguyên tắc sống còn (Solvability Guarantee) ---');
  const spawner = new BlockSpawner();
  let solvedCount = 0;
  const tightBoardTests = 100;

  for (let i = 0; i < tightBoardTests; i++) {
    // Tạo bàn cờ thế bí: lấp kín 58 đến 63 ô (chỉ còn 1 đến 6 ô trống rải rác)
    const crowdedBoard = Array.from({ length: 8 }, () => Array(8).fill(1));
    const emptyCount = 1 + (i % 6); // 1 đến 6 ô trống
    for (let e = 0; e < emptyCount; e++) {
      const rx = (i * 7 + e * 11) % 8;
      const ry = (i * 13 + e * 5) % 8;
      crowdedBoard[ry][rx] = 0;
    }

    const batch = spawner.generateBlockBatch(crowdedBoard);
    if (batch.length !== 3) {
      throw new Error(`❌ Batch phải có đúng 3 khối, nhận được: ${batch.length}`);
    }

    // Kiểm tra: PHẢI có ít nhất 1 khối đặt vừa vào bàn cờ hiện tại
    const placeableBlocks = batch.filter(b => BlockSpawner.canPlace(crowdedBoard, b));
    if (placeableBlocks.length === 0) {
      throw new Error(`❌ Vi phạm nguyên tắc sống còn tại test #${i}: cả 3 khối đều không đặt được!`);
    }
    solvedCount++;
  }
  console.log(`✅ ${solvedCount}/${tightBoardTests} bàn cờ thế bí ngẫu nhiên: 100% CÓ ÍT NHẤT 1 KHỐI ĐI ĐƯỢC!`);

  // =========================================================================
  // TEST 4: THUẬT TOÁN CÂN BẰNG TRỌNG SỐ ĐỘNG (DYNAMIC WEIGHTED BALANCING)
  // =========================================================================
  console.log('\n--- [TEST 4] Kiểm tra Trọng số động theo số ô trống ---');

  // Case 4A: Bàn cờ trống nhiều (>= 40 ô trống)
  const wideOpenBoard = Array.from({ length: 8 }, () => Array(8).fill(0));
  let largePieceCount = 0;
  const batchRuns = 500;

  for (let i = 0; i < batchRuns; i++) {
    const batch = spawner.generateBlockBatch(wideOpenBoard);
    for (const b of batch) {
      if (b.id === 'square_3x3' || b.id.startsWith('line_5') || b.id.startsWith('corner_5')) {
        largePieceCount++;
      }
    }
  }
  const largePct = ((largePieceCount / (batchRuns * 3)) * 100).toFixed(1);
  console.log(`📊 Khi bàn cờ trống nhiều (64 ô): Tỷ lệ khối lớn xuất hiện = ${largePct}% (${largePieceCount} khối lớn)`);
  if (largePieceCount < 200) {
    throw new Error('❌ Khối lớn phải có tỷ lệ xuất hiện cao khi bàn cờ trống nhiều!');
  }

  // Case 4B: Bàn cờ nguy cấp (< 20 ô trống, ví dụ chỉ còn 12 ô trống)
  const dangerBoard = Array.from({ length: 8 }, () => Array(8).fill(1));
  for (let k = 0; k < 12; k++) {
    dangerBoard[Math.floor(k / 3)][k % 3] = 0;
  }

  let smallPieceCount = 0;
  let dangerLargePieceCount = 0;

  for (let i = 0; i < batchRuns; i++) {
    const batch = spawner.generateBlockBatch(dangerBoard);
    for (const b of batch) {
      if (b.id === 'dot_1' || b.id.startsWith('line_2') || b.id.startsWith('corner_3')) {
        smallPieceCount++;
      }
      if (b.id === 'square_3x3' || b.id.startsWith('line_5')) {
        dangerLargePieceCount++;
      }
    }
  }

  const smallPct = ((smallPieceCount / (batchRuns * 3)) * 100).toFixed(1);
  const dangerLargePct = ((dangerLargePieceCount / (batchRuns * 3)) * 100).toFixed(1);
  console.log(`📊 Khi bàn cờ nguy cấp (12 ô trống): Tỷ lệ khối nhỏ cứu cánh = ${smallPct}%, khối khổng lồ = ${dangerLargePct}%`);

  if (smallPieceCount < 600) {
    throw new Error('❌ Khối nhỏ (1x1, 1x2, corner 3) phải chiếm đa số áp đảo khi bàn cờ nguy cấp!');
  }
  if (dangerLargePieceCount > 100) {
    throw new Error('❌ Khối 3x3 và thanh 5 phải bị giảm về mức cực thấp khi bàn cờ nguy cấp!');
  }
  console.log('✅ Thuật toán Dynamic Weighted Balancing hoạt động chuẩn xác theo thiết kế!');

  // =========================================================================
  // TEST 5: HẠN CHẾ KHỐI TRÙNG LẶP (DUPLICATE RESTRICTION)
  // =========================================================================
  console.log('\n--- [TEST 5] Kiểm tra Hạn chế khối trùng lặp ---');
  let duplicate3x3Violations = 0;
  let duplicateLine5Violations = 0;
  const dupRuns = 1000;

  for (let i = 0; i < dupRuns; i++) {
    const batch = spawner.generateBlockBatch(wideOpenBoard);
    const count3x3 = batch.filter(b => b.id === 'square_3x3').length;
    const countLine5 = batch.filter(b => b.id.startsWith('line_5')).length;

    if (count3x3 > 1) duplicate3x3Violations++;
    if (countLine5 > 1) duplicateLine5Violations++;
  }

  console.log(`📊 Kiểm tra 1,000 đợt roll (${dupRuns * 3} khối):`);
  console.log(`   - Số lần trùng 2 khối 3x3: ${duplicate3x3Violations}`);
  console.log(`   - Số lần trùng 2 khối thanh 5: ${duplicateLine5Violations}`);

  if (duplicate3x3Violations > 0) {
    throw new Error('❌ Vi phạm: Xuất hiện 2 khối 3x3 trong cùng 1 bộ 3 khối!');
  }
  if (duplicateLine5Violations > 0) {
    throw new Error('❌ Vi phạm: Xuất hiện 2 khối thanh 5 trong cùng 1 bộ 3 khối!');
  }
  console.log('✅ Tuyệt đối không trùng lặp 2 khối 3x3 hoặc 2 khối thanh 5 trong 1 lượt!');

  console.log('\n🎉 ========================================================');
  console.log('🎉 TẤT CẢ 5 HẠNG MỤC KIỂM THỬ BLOCK SPAWNER ĐÃ PASS 100%!');
  console.log('🎉 ========================================================\n');
}

runBlockSpawnerTests();
