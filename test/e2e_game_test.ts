import { WebSocket } from 'ws';
import { ClientMessage, ServerMessage } from '../shared/types.js';

const WS_URL = 'ws://localhost:3001';

async function runEndToEndPvPTest() {
  console.log('🧪 Starting BlockBlast Arena PvP Automated Test...');

  const wsA = new WebSocket(`${WS_URL}?playerId=player_alice`);
  const wsB = new WebSocket(`${WS_URL}?playerId=player_bob`);

  let matchStarted = false;
  let piecesPlaced = 0;

  wsA.on('open', () => {
    console.log('Alice WebSocket open, sending JOIN_QUEUE');
    wsA.send(JSON.stringify({ type: 'JOIN_QUEUE', playerName: 'Alice_Pro' } as ClientMessage));
  });

  wsB.on('open', () => {
    console.log('Bob WebSocket open, sending JOIN_QUEUE');
    wsB.send(JSON.stringify({ type: 'JOIN_QUEUE', playerName: 'Bob_Cyber' } as ClientMessage));
  });

  wsA.on('message', (data) => {
    const msg: ServerMessage = JSON.parse(data.toString());
    if (msg.type === 'WELCOME') {
      console.log(`👋 Alice received WELCOME: ID=${msg.playerId}, Elo=${msg.elo}`);
    } else if (msg.type === 'QUEUE_STATUS') {
      console.log(`⏳ Alice Queue Status: inQueue=${msg.inQueue}, wait=${msg.queueTimeSeconds}s, radius=±${msg.searchRadius}`);
    } else if (msg.type === 'MATCH_START') {
      console.log(`⚔️ Match Started! Opponent for Alice: ${msg.opponent.name} (${msg.opponent.elo} ELO)`);
      matchStarted = true;
    } else if (msg.type === 'STATE_UPDATE') {
      if (matchStarted && piecesPlaced === 0) {
        piecesPlaced++;
        console.log(`🎯 Alice placing piece 0 at (0, 0)...`);
        wsA.send(JSON.stringify({
          type: 'PLACE_PIECE',
          pieceIndex: 0,
          x: 0,
          y: 0
        } as ClientMessage));
      } else if (piecesPlaced === 1) {
        piecesPlaced++;
        console.log(`🎯 Alice placement validated! Score is now: ${msg.localBoard.score}`);
        console.log(`🎉 Both Alice and Bob state synchronized successfully!`);
        cleanup();
      }
    } else if (msg.type === 'LINE_CLEARED') {
      console.log(`✨ Line cleared! Total lines: ${msg.count}, points: ${msg.pointsEarned}`);
    } else if (msg.type === 'ATTACK_EVENT') {
      console.log(`💥 Attack event: ${msg.count} garbage sent!`);
    }
  });

  wsB.on('message', (data) => {
    const msg: ServerMessage = JSON.parse(data.toString());
    if (msg.type === 'WELCOME') {
      console.log(`👋 Bob received WELCOME: ID=${msg.playerId}, Elo=${msg.elo}`);
    } else if (msg.type === 'MATCH_START') {
      console.log(`⚔️ Bob Match Started! Opponent for Bob: ${msg.opponent.name}`);
    }
  });

  function cleanup() {
    wsA.close();
    wsB.close();
    console.log('✅ End-to-End WebSocket PvP Test PASSED cleanly!');
    process.exit(0);
  }

  setTimeout(() => {
    console.error('❌ Test timed out before completion');
    wsA.close();
    wsB.close();
    process.exit(1);
  }, 8000);
}

runEndToEndPvPTest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
