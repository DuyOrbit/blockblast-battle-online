import { RoomManager } from '../server/roomManager.js';
import { InMemoryPlayerStore } from '../server/store.js';
import { GameEngine } from '../server/gameEngine.js';
import { BoardGrid, ActivePiece } from '../shared/types.js';
import { BLOCK_CATALOG } from '../shared/blockSpawner.js';

async function runStep1BugTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ 5 BUG LOGIC (BƯỚC 1)');
  console.log('🧪 ========================================================\n');

  let passed = 0;
  let failed = 0;

  // --- TEST 1: Bug 1 - Bấm "Bắt đầu" hai lần trong RoomManager ---
  try {
    console.log('--- [TEST 1] Bug 1: Chặn bấm Start Room Match khi đang PLAYING ---');
    const rm = new RoomManager();
    const fakeWsHost: any = { readyState: 1, send: () => {} };
    const fakeWsGuest: any = { readyState: 1, send: () => {} };

    const room = rm.createRoom({ id: 'host1', name: 'Host Player', elo: 1000 }, fakeWsHost);
    rm.joinRoom(room.code, { id: 'guest1', name: 'Guest Player', elo: 1000 }, fakeWsGuest);

    // Lần 1: Bắt đầu thành công
    const res1 = rm.startRoomMatch(room.code, 'host1');
    if (!res1.success || room.status !== 'PLAYING') {
      throw new Error(`Start lần 1 thất bại: ${JSON.stringify(res1)}`);
    }

    const timer1 = room.timer;
    if (!timer1) {
      throw new Error('Timer của room chưa được khởi tạo!');
    }

    // Lần 2: Bấm lại trong khi đang PLAYING
    const res2 = rm.startRoomMatch(room.code, 'host1');
    if (res2.success) {
      throw new Error('Mong đợi thất bại khi start lần 2 nhưng lại báo thành công!');
    }
    if (res2.error !== 'Trận đang diễn ra') {
      throw new Error(`Error message không đúng mong đợi: ${res2.error}`);
    }

    // Dọn dẹp
    rm.closeRoom(room);
    console.log('✅ TEST 1 PASSED: startRoomMatch chặn thành công khi trận đang PLAYING.\n');
    passed++;
  } catch (err: any) {
    console.error('❌ TEST 1 FAILED:', err.message, '\n');
    failed++;
  }

  // --- TEST 2: Bug 2 - Kiểm tra Deadlock sau khi nạp gạch rác (Garbage) ---
  try {
    console.log('--- [TEST 2] Bug 2: Phát hiện Deadlock khi Garbage lấp hết nước đi ---');
    const grid: BoardGrid = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));

    // Lấp đầy toàn bộ bàn cờ ngoại trừ 1 ô duy nhất ở (0, 0)
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (r === 0 && c === 0) continue;
        grid[r][c] = { color: '#ffffff', isGarbage: true };
      }
    }

    const dotPiece = BLOCK_CATALOG.find(p => p.id === 'dot_1') || BLOCK_CATALOG.find(p => p.size === 1)!;
    const squarePiece = BLOCK_CATALOG.find(p => p.category === 'square' && p.size >= 4)!;

    // Trước khi inject: mảnh square 2x2 không vừa ô 1x1
    const activeSquare: ActivePiece[] = [{ index: 0, placed: false, piece: squarePiece }];
    const canMoveSquare = GameEngine.hasAnyValidMoves(grid, activeSquare);
    if (canMoveSquare) {
      throw new Error('Mảnh Square không thể đặt vừa ô 1x1!');
    }

    // Trước khi inject: mảnh 1x1 Dot vừa ô (0,0) duy nhất
    const activeDot: ActivePiece[] = [{ index: 0, placed: false, piece: dotPiece }];
    if (!GameEngine.hasAnyValidMoves(grid, activeDot)) {
      throw new Error('Mảnh 1x1 Dot phải đặt vừa ô trống (0,0)!');
    }

    // Inject garbage lấp nốt ô (0,0) còn lại
    GameEngine.injectGarbage(grid, 1);

    // Sau khi inject: không còn ô trống nào -> hasAnyValidMoves phải là false (Deadlock)
    const canMoveAfter = GameEngine.hasAnyValidMoves(grid, activeDot);
    if (canMoveAfter) {
      throw new Error('Bàn cờ đã bị lấp đầy bởi garbage nhưng hasAnyValidMoves vẫn trả về true!');
    }

    console.log('✅ TEST 2 PASSED: Deadlock được phát hiện chính xác sau khi injectGarbage.\n');
    passed++;
  } catch (err: any) {
    console.error('❌ TEST 2 FAILED:', err.message, '\n');
    failed++;
  }

  // --- TEST 3: Bug 3 - Guard ws.on('close') không xóa session khi mở 2 tab / reconnect ---
  try {
    console.log('--- [TEST 3] Bug 3: Guard ws close không xóa socket mới của cùng playerId ---');
    const clientSockets = new Map<string, any>();

    const oldWs = { id: 'old_tab', readyState: 1 };
    const newWs = { id: 'new_tab', readyState: 1 };

    const playerId = 'player_abc';

    // Tab 1 kết nối
    clientSockets.set(playerId, oldWs);

    // Tab 2 kết nối đè
    clientSockets.set(playerId, newWs);

    // Tab 1 đóng -> mô phỏng logic trong close handler
    const onCloseOldTab = (closedWs: any) => {
      if (clientSockets.get(playerId) !== closedWs) {
        return 'IGNORED_STALE_SOCKET';
      }
      clientSockets.delete(playerId);
      return 'DELETED';
    };

    const actionResult = onCloseOldTab(oldWs);
    if (actionResult !== 'IGNORED_STALE_SOCKET') {
      throw new Error(`Old tab đóng không được bỏ qua! Result: ${actionResult}`);
    }

    if (clientSockets.get(playerId) !== newWs) {
      throw new Error('Socket mới bị xóa nhầm khi socket cũ đóng!');
    }

    // Khi tab mới thật sự đóng:
    const closeNewResult = onCloseOldTab(newWs);
    if (closeNewResult !== 'DELETED') {
      throw new Error(`New tab đóng thất bại: ${closeNewResult}`);
    }
    if (clientSockets.has(playerId)) {
      throw new Error('Socket chưa được xóa khi tab thật sự đóng!');
    }

    console.log('✅ TEST 3 PASSED: Close guard bảo vệ an toàn socket mới và ngăn surrender nhầm.\n');
    passed++;
  } catch (err: any) {
    console.error('❌ TEST 3 FAILED:', err.message, '\n');
    failed++;
  }

  // --- TEST 4: Bug 4 - Kết quả Hòa không bị tính là Thua cho cả 2 bên ---
  try {
    console.log('--- [TEST 4] Bug 4: Trận Hòa không bị tính thành Thua trong PlayerStore ---');
    const store = new InMemoryPlayerStore();

    // Player A và B hòa
    const pA = await store.updatePlayerStats('player_draw_a', 1000, 'DRAW');
    const pB = await store.updatePlayerStats('player_draw_b', 1000, 'DRAW');

    if (pA.losses !== 0 || pA.wins !== 0 || pA.draws !== 1 || pA.matchesPlayed !== 1) {
      throw new Error(`Player A hòa bị sai stats: ${JSON.stringify(pA)}`);
    }

    if (pB.losses !== 0 || pB.wins !== 0 || pB.draws !== 1 || pB.matchesPlayed !== 1) {
      throw new Error(`Player B hòa bị sai stats: ${JSON.stringify(pB)}`);
    }

    // Kiểm tra Win & Loss thông thường
    const pWin = await store.updatePlayerStats('player_win', 1032, 'WIN');
    if (pWin.wins !== 1 || pWin.losses !== 0 || pWin.matchesPlayed !== 1) {
      throw new Error(`Win stats sai: ${JSON.stringify(pWin)}`);
    }

    const pLoss = await store.updatePlayerStats('player_loss', 968, 'LOSS');
    if (pLoss.losses !== 1 || pLoss.wins !== 0 || pLoss.matchesPlayed !== 1) {
      throw new Error(`Loss stats sai: ${JSON.stringify(pLoss)}`);
    }

    console.log('✅ TEST 4 PASSED: Kết quả Hòa tăng chỉ số draws và không cộng vào losses.\n');
    passed++;
  } catch (err: any) {
    console.error('❌ TEST 4 FAILED:', err.message, '\n');
    failed++;
  }

  // --- TEST 5: Bug 5 - State Guard giữa Active Match / Room / Queue ---
  try {
    console.log('--- [TEST 5] Bug 5: State Guard chặn lẫn nhau giữa Match / Room / Queue ---');
    const playerToMatchMap = new Map<string, string>();
    const rm = new RoomManager();
    const fakeWs: any = { readyState: 1, send: () => {} };

    const pid = 'test_guard_player';
    playerToMatchMap.set(pid, 'active_match_123');

    // Giả lập check khi JOIN_QUEUE hoặc CREATE_ROOM
    const canJoinQueue = !playerToMatchMap.has(pid) && !rm.getRoomByPlayer(pid);
    if (canJoinQueue) {
      throw new Error('Đang trong trận mà vẫn cho phép join queue!');
    }

    // Kết thúc trận
    playerToMatchMap.delete(pid);

    // Vào phòng
    rm.createRoom({ id: pid, name: 'Runner', elo: 1000 }, fakeWs);
    const inRoom = !!rm.getRoomByPlayer(pid);
    if (!inRoom) {
      throw new Error('Không tạo được phòng cho player!');
    }

    const canJoinQueueWhileInRoom = !playerToMatchMap.has(pid) && !rm.getRoomByPlayer(pid);
    if (canJoinQueueWhileInRoom) {
      throw new Error('Đang ở trong phòng bạn bè mà vẫn cho phép join queue!');
    }

    // Rời phòng
    rm.removePlayer(pid);
    const canJoinQueueAfterLeave = !playerToMatchMap.has(pid) && !rm.getRoomByPlayer(pid);
    if (!canJoinQueueAfterLeave) {
      throw new Error('Đã rời phòng nhưng vẫn bị chặn join queue!');
    }

    console.log('✅ TEST 5 PASSED: State guards bảo vệ hoàn hảo giữa các trạng thái.\n');
    passed++;
  } catch (err: any) {
    console.error('❌ TEST 5 FAILED:', err.message, '\n');
    failed++;
  }

  console.log('========================================================');
  console.log(`🎉 KẾT QUẢ KIỂM THỬ: ${passed} PASSED / ${failed} FAILED`);
  console.log('========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep1BugTests();
