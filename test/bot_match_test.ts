import { WebSocket } from 'ws';
import { ClientMessage, ServerMessage } from '../shared/types.js';

const WS_URL = 'ws://localhost:3001';

async function testBotMatchmaking() {
  console.log('🤖 Testing Bot Fallback Matchmaking & Bot Gameplay...');

  const ws = new WebSocket(`${WS_URL}?playerId=player_solo`);

  let botMatched = false;
  let botMovesSeen = 0;

  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'JOIN_QUEUE', playerName: 'SoloFighter' } as ClientMessage));
  });

  ws.on('message', (data) => {
    const msg: ServerMessage = JSON.parse(data.toString());

    if (msg.type === 'QUEUE_STATUS') {
      console.log(`⏳ Solo Player Waiting... ${msg.queueTimeSeconds}s / 15s (Radius: ±${msg.searchRadius})`);
    } else if (msg.type === 'MATCH_START') {
      console.log(`⚔️ Matched with Opponent: ${msg.opponent.name} (isBot: ${msg.opponent.isBot}, Elo: ${msg.opponent.elo})`);
      if (msg.opponent.isBot) {
        botMatched = true;
      }
    } else if (msg.type === 'STATE_UPDATE') {
      if (botMatched && msg.opponentBoard.score > 0) {
        botMovesSeen++;
        console.log(`🤖 Bot made a move! Opponent score is now: ${msg.opponentBoard.score}`);
        console.log('✅ Bot AI placement and state broadcast verified!');
        ws.close();
        process.exit(0);
      }
    }
  });

  // Timeout safety
  setTimeout(() => {
    console.log('Timed out waiting for bot');
    ws.close();
    process.exit(1);
  }, 22000);
}

testBotMatchmaking().catch(err => {
  console.error(err);
  process.exit(1);
});
