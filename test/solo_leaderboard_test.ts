async function testSoloLeaderboard() {
  console.log('🧪 Testing Solo Leaderboard API endpoints...');

  // 1. Test GET /api/leaderboard/solo
  const getRes = await fetch('http://localhost:3001/api/leaderboard/solo');
  if (!getRes.ok) throw new Error(`GET failed: ${getRes.status}`);
  const initialList = await getRes.json();
  console.log(`✅ GET /api/leaderboard/solo returned ${initialList.length} initial entries`);
  console.log(`   Top 1: ${initialList[0].name} with ${initialList[0].score} pts`);

  // 2. Test POST /api/leaderboard/solo
  const testScore = {
    name: 'MasterYoda_VN',
    score: 6200,
    maxCombo: 9,
    linesCleared: 55
  };

  const postRes = await fetch('http://localhost:3001/api/leaderboard/solo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testScore)
  });

  if (!postRes.ok) throw new Error(`POST failed: ${postRes.status}`);
  const postResult = await postRes.json();
  console.log('✅ POST /api/leaderboard/solo succeeded:');
  console.log(`   Inserted entry: ${postResult.entry.name} - ${postResult.entry.score} pts (ID: ${postResult.entry.id})`);

  // 3. Verify rank 1 update
  const updatedGetRes = await fetch('http://localhost:3001/api/leaderboard/solo');
  const updatedList = await updatedGetRes.json();
  if (updatedList[0].name !== 'MasterYoda_VN') {
    throw new Error(`Expected MasterYoda_VN to be rank 1, but found ${updatedList[0].name}`);
  }
  console.log(`✅ Verified MasterYoda_VN is now #1 on the leaderboard with ${updatedList[0].score} points!`);

  console.log('🎉 Solo Leaderboard API test PASSED completely!');
}

testSoloLeaderboard().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
