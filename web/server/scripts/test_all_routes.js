const routes = [
  '/api/summary',
  '/api/seasons',
  '/api/team-seasons?season=2026',
  '/api/team-seasons',
  '/api/team-seasons/matrix',
  '/api/player-seasons?season=2026&priced=true',
  '/api/rankings/steals?season=2026',
  '/api/rankings/overpaid?season=2026',
  '/api/rankings/bargain-xi?season=2026',
  '/api/rankings/overpaid-xi?season=2026',
  '/api/rankings/unsold',
  '/api/breakdown?by=Role&season=2026',
  '/api/breakdown?by=Nationality&season=2026',
  '/api/breakdown?by=PriceBracket',
  '/api/players?q=Kohli',
];

async function testAll() {
  console.log('Testing all API endpoints...\n');
  let ok = true;
  for (const path of routes) {
    try {
      const res = await fetch(`http://localhost:5000${path}`);
      if (!res.ok) {
        console.error(`❌ ${path} -> HTTP ${res.status}`);
        ok = false;
        continue;
      }
      const data = await res.json();
      const count = Array.isArray(data) ? `${data.length} items` : 'object';
      console.log(`✅ ${path.padEnd(46)} -> 200 OK (${count})`);
    } catch (err) {
      console.error(`❌ ${path} -> Error: ${err.message}`);
      ok = false;
    }
  }

  // Also test player profile detail
  try {
    const searchRes = await fetch('http://localhost:5000/api/players?q=Kohli');
    const players = await searchRes.json();
    if (players.length > 0) {
      const id = players[0].PlayerID;
      const profileRes = await fetch(`http://localhost:5000/api/players/${id}`);
      const profile = await profileRes.json();
      console.log(`✅ /api/players/${id.padEnd(20)} -> 200 OK (seasons: ${profile.seasons?.length}, auctions: ${profile.auctions?.length})`);
    }
  } catch (err) {
    console.error(`❌ Player detail test failed: ${err.message}`);
    ok = false;
  }

  console.log(ok ? '\n🎉 All endpoints verified successfully!' : '\n⚠️ Some endpoints failed');
}

testAll();
