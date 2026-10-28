import { WebSocket } from 'ws';
import { ClientMessage, ServerMessage } from '../shared/types.js';

const WS_URL = 'ws://localhost:3001';

async function runRoomSpectatorTest() {
  console.log('🧪 Starting BlockBlast Arena Custom Room & Spectator Test...');

  let roomCode = '';
  let aliceStarted = false;
  let bobStarted = false;
  let carolSawMatchStart = false;
  let carolSawAliceMove = false;
  let testSuccess = false;

  const wsAlice = new WebSocket(`${WS_URL}?playerId=alice_room_test`);
  let wsBob: WebSocket | null = null;
  let wsCarol: WebSocket | null = null;

  function cleanup() {
    testSuccess = true;
    console.log('🎉 ALL ROOM & SPECTATOR CHECKS PASSED!');
    if (wsAlice.readyState === WebSocket.OPEN) wsAlice.close();
    if (wsBob && wsBob.readyState === WebSocket.OPEN) wsBob.close();
    if (wsCarol && wsCarol.readyState === WebSocket.OPEN) wsCarol.close();
  }

  // Timeout guard
  const timeoutId = setTimeout(() => {
    if (!testSuccess) {
      console.error('❌ Test timed out!');
      process.exit(1);
    }
  }, 12000);

  wsAlice.on('open', () => {
    console.log('1️⃣ Alice connected -> Creating Room');
    wsAlice.send(JSON.stringify({
      type: 'CREATE_ROOM',
      playerName: 'Alice_Host'
    } as ClientMessage));
  });

  wsAlice.on('message', (data) => {
    const msg: ServerMessage = JSON.parse(data.toString());

    if (msg.type === 'ROOM_CREATED') {
      roomCode = msg.roomCode;
      console.log(`2️⃣ Room created! Code: [${roomCode}]`);

      // Now Bob connects and joins
      wsBob = new WebSocket(`${WS_URL}?playerId=bob_room_test`);
      setupBob(wsBob, roomCode);
    } else if (msg.type === 'ROOM_UPDATE') {
      console.log(`🏠 Alice Room Update: Guest=${msg.guest?.name || 'none'}, Specs=${msg.spectators.length}`);
      if (msg.guest && !aliceStarted && wsCarol) {
        // Wait for Carol to be in spectators list before starting
        if (msg.spectators.some(s => s.name === 'Carol_Watcher')) {
          console.log(`5️⃣ Alice starting room match now!`);
          aliceStarted = true;
          wsAlice.send(JSON.stringify({
            type: 'START_ROOM_MATCH'
          } as ClientMessage));
        }
      }
    } else if (msg.type === 'MATCH_START') {
      console.log(`⚔️ Alice match started against: ${msg.opponent.name}`);
      // Place piece 0 at (0, 0)
      setTimeout(() => {
        console.log('6️⃣ Alice placing piece 0 at (0, 0)...');
        wsAlice.send(JSON.stringify({
          type: 'PLACE_PIECE',
          pieceIndex: 0,
          x: 0,
          y: 0
        } as ClientMessage));
      }, 500);
    }
  });

  function setupBob(ws: WebSocket, code: string) {
    ws.on('open', () => {
      console.log('3️⃣ Bob connected -> Joining Room as Player');
      ws.send(JSON.stringify({
        type: 'JOIN_ROOM',
        playerName: 'Bob_Player',
        roomCode: code,
        asSpectator: false
      } as ClientMessage));
    });

    ws.on('message', (data) => {
      const msg: ServerMessage = JSON.parse(data.toString());
      if (msg.type === 'ROOM_UPDATE') {
        console.log(`👤 Bob Room Update: Role=${msg.myRole}, Status=${msg.status}`);
        if (!wsCarol) {
          // Bob is in, now Carol joins as Spectator
          wsCarol = new WebSocket(`${WS_URL}?playerId=carol_spec_test`);
          setupCarol(wsCarol, code);
        }
      } else if (msg.type === 'MATCH_START') {
        bobStarted = true;
        console.log(`⚔️ Bob match started against: ${msg.opponent.name}`);
      }
    });
  }

  function setupCarol(ws: WebSocket, code: string) {
    ws.on('open', () => {
      console.log('4️⃣ Carol connected -> Joining Room as Spectator');
      ws.send(JSON.stringify({
        type: 'JOIN_ROOM',
        playerName: 'Carol_Watcher',
        roomCode: code,
        asSpectator: true
      } as ClientMessage));
    });

    ws.on('message', (data) => {
      const msg: ServerMessage = JSON.parse(data.toString());
      if (msg.type === 'ROOM_UPDATE') {
        console.log(`👁️ Carol Room Update: Role=${msg.myRole}, SpectatorCount=${msg.spectators.length}`);
      } else if (msg.type === 'SPECTATOR_STATE_UPDATE') {
        if (!carolSawMatchStart) {
          carolSawMatchStart = true;
          console.log(`📺 Carol received live SPECTATOR_STATE_UPDATE: Player A=${msg.playerAInfo.name}, Player B=${msg.playerBInfo.name}, Time=${msg.timeRemaining}s`);
        }

        // Check if Alice's board has piece 0 placed
        if (msg.playerABoard.activePieces[0]?.placed === true || msg.playerABoard.score > 0) {
          if (!carolSawAliceMove) {
            carolSawAliceMove = true;
            console.log(`📺 Carol observed Alice move! Player A Score=${msg.playerABoard.score}, Pieces remaining=${msg.playerABoard.activePieces.filter(p => !p.placed).length}`);
            clearTimeout(timeoutId);
            cleanup();
          }
        }
      }
    });
  }
}

runRoomSpectatorTest();
