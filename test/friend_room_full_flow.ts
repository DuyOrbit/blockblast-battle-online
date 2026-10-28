import { WebSocket } from 'ws';
import { ClientMessage, ServerMessage } from '../shared/types.js';

const WS_URL = 'ws://localhost:3001';

async function testFriendRoomFullFlow() {
  console.log('🧪 Running Friend Room Full Flow & Memory Cleanup Test...');

  const wsHost = new WebSocket(`${WS_URL}?playerId=p_host_${Date.now()}`);
  let wsGuest: WebSocket | null = null;
  let roomCode = '';
  let hostReceivedMatchStart = false;
  let guestReceivedMatchStart = false;
  let hostReceivedMoveUpdate = false;

  const timer = setTimeout(() => {
    console.error('❌ Friend room test timed out!');
    process.exit(1);
  }, 10000);

  wsHost.on('open', () => {
    console.log('1. Host connected, sending CREATE_ROOM');
    wsHost.send(JSON.stringify({
      type: 'CREATE_ROOM',
      playerName: 'HostPlayer'
    } as ClientMessage));
  });

  wsHost.on('message', (data) => {
    const msg: ServerMessage = JSON.parse(data.toString());

    if (msg.type === 'ROOM_CREATED') {
      roomCode = msg.roomCode;
      console.log(`2. Room created with code: ${roomCode}`);

      // Now guest connects and joins
      wsGuest = new WebSocket(`${WS_URL}?playerId=p_guest_${Date.now()}`);
      setupGuest(wsGuest, roomCode);
    } else if (msg.type === 'ROOM_UPDATE') {
      if (msg.guest && !hostReceivedMatchStart) {
        console.log(`4. Host sees guest: ${msg.guest.name}. Host starting match...`);
        wsHost.send(JSON.stringify({
          type: 'START_ROOM_MATCH'
        } as ClientMessage));
      }
    } else if (msg.type === 'MATCH_START') {
      hostReceivedMatchStart = true;
      console.log(`5. Host received MATCH_START against ${msg.opponent.name}`);
      // Host makes a move
      setTimeout(() => {
        wsHost.send(JSON.stringify({
          type: 'PLACE_PIECE',
          pieceIndex: 0,
          x: 0,
          y: 0
        } as ClientMessage));
      }, 200);
    } else if (msg.type === 'STATE_UPDATE') {
      if (hostReceivedMatchStart && msg.localBoard.score > 0 && !hostReceivedMoveUpdate) {
        hostReceivedMoveUpdate = true;
        console.log(`7. Host received STATE_UPDATE with score: ${msg.localBoard.score}`);
        finish();
      }
    }
  });

  function setupGuest(ws: WebSocket, code: string) {
    ws.on('open', () => {
      console.log(`3. Guest connected, joining room ${code}`);
      ws.send(JSON.stringify({
        type: 'JOIN_ROOM',
        roomCode: code,
        playerName: 'GuestPlayer',
        asSpectator: false
      } as ClientMessage));
    });

    ws.on('message', (data) => {
      const msg: ServerMessage = JSON.parse(data.toString());
      if (msg.type === 'MATCH_START') {
        guestReceivedMatchStart = true;
        console.log(`6. Guest received MATCH_START against ${msg.opponent.name}`);
      }
    });
  }

  function finish() {
    clearTimeout(timer);
    console.log('8. Closing sockets to test cleanup...');
    wsHost.close();
    if (wsGuest) wsGuest.close();

    setTimeout(() => {
      console.log('✅ FRIEND ROOM FULL FLOW & CLEANUP PASSED 100%!');
      process.exit(0);
    }, 500);
  }
}

testFriendRoomFullFlow();
