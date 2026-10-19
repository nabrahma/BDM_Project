import { autoDraftFullSquad, selectBestXIFromSquad, computeSquadMetrics, IPL_RULES } from '../../client/src/lib/optimizer.js';

async function testFullSquadBuilder() {
  console.log('Testing Real IPL 18-25 Franchise Squad Builder...\n');

  const res = await fetch('http://localhost:5000/api/squad-builder/pool?season=2026');
  const data = await res.json();
  const pool = data.auctionPool || data.pool || [];

  console.log(`Pool loaded: ${pool.length} auction players, ${data.retainedPool?.length || 0} retained players available.`);

  // 1. Test auto-drafting a 20-player full squad
  const { squad, playingXIKeys } = autoDraftFullSquad(pool, [], 120, 20);
  console.log(`\nDrafted Full Squad Size: ${squad.length} players.`);
  console.log(`Playing XI Starters Selected: ${playingXIKeys.size} players.`);

  const metrics = computeSquadMetrics(squad, playingXIKeys, data.leagueSpendCr, data.leaguePricedImpact, 120);

  console.log('\n--- MATCHDAY PLAYING XI (11) ---');
  let i = 1;
  squad.filter(p => playingXIKeys.has(p.playerKey)).forEach(p => {
    console.log(`${i++}. [${p.role.padEnd(13)}] ${p.name.padEnd(22)} (${p.nationality.padEnd(8)}) | ₹${p.priceCr.toFixed(2).padStart(5)} Cr | Impact: ${p.impactPoints.toString().padStart(4)} | VI: ${p.valueIndex?.toFixed(2) || 'N/A'}`);
  });

  console.log('\n--- BENCH / RESERVES (9) ---');
  let b = 1;
  squad.filter(p => !playingXIKeys.has(p.playerKey)).forEach(p => {
    console.log(`B${b++}. [${p.role.padEnd(13)}] ${p.name.padEnd(22)} (${p.nationality.padEnd(8)}) | ₹${p.priceCr.toFixed(2).padStart(5)} Cr | Impact: ${p.impactPoints.toString().padStart(4)} | VI: ${p.valueIndex?.toFixed(2) || 'N/A'}`);
  });

  console.log('\n--- SQUAD & XI METRICS ---');
  console.log(`Total Squad Spend:    ₹${metrics.totalSpend} Cr / ₹120.0 Cr (Purse Left: ₹${metrics.purseRemaining} Cr)`);
  console.log(`Playing XI Spend:     ₹${metrics.xiSpend} Cr`);
  console.log(`Playing XI Impact:    ${metrics.xiImpact} pts`);
  console.log(`Total Squad Impact:   ${metrics.totalSquadImpact} pts`);
  console.log(`Playing XI VI:        ${metrics.xiValueIndex}x`);
  console.log(`Squad Rating:         ${metrics.ratingScore}/100 (${metrics.tier} - ${metrics.tierLabel})`);
  console.log(`Squad Size Rule:      ${squad.length >= IPL_RULES.MIN_SQUAD_SIZE && squad.length <= IPL_RULES.MAX_SQUAD_SIZE ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Squad Overseas Rule:  ${metrics.squadCounts.Overseas <= IPL_RULES.MAX_OVERSEAS_SQUAD ? `✅ PASS (${metrics.squadCounts.Overseas}/8)` : '❌ FAIL'}`);
  console.log(`Playing XI Overseas:  ${metrics.xiCounts.Overseas <= IPL_RULES.MAX_OVERSEAS_XI ? `✅ PASS (${metrics.xiCounts.Overseas}/4)` : '❌ FAIL'}`);
  console.log(`Playing XI Valid:     ${metrics.isPlayingXIValid ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Full Squad Valid:     ${metrics.isFullSquadValid ? '✅ PASS' : '❌ FAIL'}`);

  if (metrics.isFullSquadValid && metrics.isPlayingXIValid) {
    console.log('\n🎉 ALL REAL IPL SQUAD BUILDER CONSTRAINTS PASSED FOR BLANK SLATE!');
  } else {
    console.error('\n❌ VALIDATION ERROR');
    process.exit(1);
  }

  // 2. Test Franchise Template with Retentions (e.g. MI)
  console.log('\n======================================================');
  console.log('Testing Franchise Template with Pre-Auction Retentions (MI)...');
  const miTmpl = data.franchiseTemplates.MI;
  const targetIds = new Set(miTmpl.retainedPlayerIds);
  const miRetained = data.retainedPool.filter(p => targetIds.has(p.id) || targetIds.has(p.playerKey));
  
  let cappedCount = 0;
  const miRetainedPriced = miRetained.map(p => {
    let price = IPL_RULES.UNCAPPED_RETENTION_PRICE;
    if (p.retentionType === 'Capped') {
      const slabIdx = Math.min(cappedCount, IPL_RULES.CAPPED_RETENTION_LADDER.length - 1);
      price = IPL_RULES.CAPPED_RETENTION_LADDER[slabIdx];
      cappedCount++;
    }
    return { ...p, effectivePrice: price };
  });

  const { squad: miSquad, playingXIKeys: miXIKeys } = autoDraftFullSquad(pool, miRetainedPriced, 120, 20);
  const miMetrics = computeSquadMetrics(miSquad, miXIKeys, data.leagueSpendCr, data.leaguePricedImpact, 120);

  console.log(`MI Retained Count:    ${miRetainedPriced.length} players`);
  console.log(`MI Retention Spend:   ₹${miMetrics.retentionSpend} Cr`);
  console.log(`MI Auction Spend:     ₹${miMetrics.auctionSpend} Cr`);
  console.log(`MI Total Spend:       ₹${miMetrics.totalSpend} Cr / ₹120.0 Cr`);
  console.log(`MI Purse Remaining:   ₹${miMetrics.purseRemaining} Cr`);
  console.log(`MI Full Squad Size:   ${miSquad.length} players`);
  console.log(`MI Playing XI Size:   ${miXIKeys.size} players`);
  console.log(`MI Squad Overseas:    ${miMetrics.squadCounts.Overseas}/8`);
  console.log(`MI XI Overseas:       ${miMetrics.xiCounts.Overseas}/4`);
  console.log(`MI Squad Valid:       ${miMetrics.isFullSquadValid ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`MI Playing XI Valid:  ${miMetrics.isPlayingXIValid ? '✅ PASS' : '❌ FAIL'}`);

  if (miMetrics.isFullSquadValid && miMetrics.isPlayingXIValid) {
    console.log('\n🎉 ALL REAL IPL SQUAD BUILDER CONSTRAINTS PASSED FOR FRANCHISE RETENTIONS (MI)!');
  } else {
    console.error('\n❌ VALIDATION ERROR ON MI SQUAD');
    process.exit(1);
  }
}

testFullSquadBuilder().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
