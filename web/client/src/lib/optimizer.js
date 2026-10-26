/**
 * optimizer.js — Real IPL Franchise Squad Valuation, Retention Ladder & Knapsack Solver.
 *
 * Real IPL 2025/2026 Rules:
 * 1. Total Purse Cap: ₹120.0 Cr (Shared across Retentions + Auction Buys).
 * 2. Pre-Auction Retention Ladder:
 *    - Capped 1: ₹18.0 Cr
 *    - Capped 2: ₹14.0 Cr
 *    - Capped 3: ₹11.0 Cr
 *    - Capped 4: ₹18.0 Cr
 *    - Capped 5: ₹14.0 Cr
 *    - Uncapped Retentions: Flat ₹4.0 Cr
 *    - Max 6 total retentions (Max 5 capped).
 * 3. Auction Purse Left = ₹120.0 Cr - Total Retention Cost.
 * 4. Full Squad: Min 18, Max 25 players, Max 8 Overseas.
 * 5. Playing XI: Exactly 11 players, Max 4 Overseas on the field.
 */

export const IPL_RULES = {
  MIN_SQUAD_SIZE: 18,
  MAX_SQUAD_SIZE: 25,
  DEFAULT_SQUAD_TARGET: 20,
  MAX_OVERSEAS_SQUAD: 8,
  PLAYING_XI_SIZE: 11,
  MAX_OVERSEAS_XI: 4,
  MAX_RETENTIONS: 6,
  MAX_CAPPED_RETENTIONS: 5,
  CAPPED_RETENTION_LADDER: [18.0, 14.0, 11.0, 18.0, 14.0],
  UNCAPPED_RETENTION_PRICE: 4.0,
  XI_ROLES: {
    'Wicket-Keeper': 1,
    'Batter': 4,
    'All-Rounder': 2,
    'Bowler': 4,
  },
  SQUAD_MIN_ROLES: {
    'Wicket-Keeper': 2,
    'Batter': 5,
    'All-Rounder': 3,
    'Bowler': 6,
  },
};

/** Compute dynamic price for a player based on retention status and order */
export function getPlayerEffectivePrice(player, currentSquad = []) {
  if (!player.isRetained) {
    return player.priceCr; // Auction hammer price
  }

  // If uncapped, flat ₹4.0 Cr
  if (player.retentionType === 'Uncapped') {
    return IPL_RULES.UNCAPPED_RETENTION_PRICE;
  }

  // Capped retention: calculate rank among capped retained players in current squad
  const currentCappedCount = currentSquad.filter(
    p => p.isRetained && p.retentionType === 'Capped' && p.playerKey !== player.playerKey
  ).length;

  const slabIndex = Math.min(currentCappedCount, IPL_RULES.CAPPED_RETENTION_LADDER.length - 1);
  return IPL_RULES.CAPPED_RETENTION_LADDER[slabIndex];
}

/** Validate both full squad and selected Playing XI */
export function validateSquad(squad, playingXIKeys = new Set(), purseCap = 120) {
  const squadCounts = {
    'Wicket-Keeper': 0,
    'Batter': 0,
    'All-Rounder': 0,
    'Bowler': 0,
    'Overseas': 0,
    'Indian': 0,
    'Retained': 0,
    'Auction': 0,
    'CappedRetained': 0,
    'UncappedRetained': 0,
  };

  let totalSpend = 0;
  let retentionSpend = 0;
  let auctionSpend = 0;

  for (const p of squad) {
    const effectivePrice = p.effectivePrice ?? getPlayerEffectivePrice(p, squad);
    totalSpend += effectivePrice;

    if (p.isRetained) {
      retentionSpend += effectivePrice;
      squadCounts.Retained++;
      if (p.retentionType === 'Capped') squadCounts.CappedRetained++;
      else squadCounts.UncappedRetained++;
    } else {
      auctionSpend += effectivePrice;
      squadCounts.Auction++;
    }

    if (squadCounts[p.role] !== undefined) squadCounts[p.role]++;
    if (p.nationality === 'Overseas') squadCounts.Overseas++;
    else squadCounts.Indian++;
  }

  totalSpend = +totalSpend.toFixed(2);
  retentionSpend = +retentionSpend.toFixed(2);
  auctionSpend = +auctionSpend.toFixed(2);
  const auctionPurseAvailable = +(purseCap - retentionSpend).toFixed(2);
  const purseRemaining = +(purseCap - totalSpend).toFixed(2);
  const isOverBudget = purseRemaining < 0;

  // Playing XI counts
  const playingXI = squad.filter(p => playingXIKeys.has(p.playerKey));
  const xiCounts = {
    'Wicket-Keeper': 0,
    'Batter': 0,
    'All-Rounder': 0,
    'Bowler': 0,
    'Overseas': 0,
    'Indian': 0,
  };

  for (const p of playingXI) {
    if (xiCounts[p.role] !== undefined) xiCounts[p.role]++;
    if (p.nationality === 'Overseas') xiCounts.Overseas++;
    else xiCounts.Indian++;
  }

  const squadChecks = {
    minSize: squad.length >= IPL_RULES.MIN_SQUAD_SIZE,
    maxSize: squad.length <= IPL_RULES.MAX_SQUAD_SIZE,
    overseas: squadCounts.Overseas <= IPL_RULES.MAX_OVERSEAS_SQUAD,
    budget: !isOverBudget,
    retentions: squadCounts.Retained <= IPL_RULES.MAX_RETENTIONS,
    cappedRetentions: squadCounts.CappedRetained <= IPL_RULES.MAX_CAPPED_RETENTIONS,
  };

  const xiChecks = {
    size: playingXI.length === IPL_RULES.PLAYING_XI_SIZE,
    overseas: xiCounts.Overseas <= IPL_RULES.MAX_OVERSEAS_XI,
    wk: xiCounts['Wicket-Keeper'] >= IPL_RULES.XI_ROLES['Wicket-Keeper'],
    bat: xiCounts['Batter'] >= IPL_RULES.XI_ROLES['Batter'],
    ar: xiCounts['All-Rounder'] >= IPL_RULES.XI_ROLES['All-Rounder'],
    bowl: xiCounts['Bowler'] >= IPL_RULES.XI_ROLES['Bowler'],
  };

  const isFullSquadValid = squadChecks.minSize && squadChecks.maxSize && squadChecks.overseas && squadChecks.budget && squadChecks.retentions;
  const isPlayingXIValid = xiChecks.size && xiChecks.overseas && xiChecks.wk && xiChecks.bat && xiChecks.ar && xiChecks.bowl;

  return {
    squadCounts,
    xiCounts,
    totalSpend,
    retentionSpend,
    auctionSpend,
    auctionPurseAvailable,
    purseRemaining,
    isOverBudget,
    squadChecks,
    xiChecks,
    isFullSquadValid,
    isPlayingXIValid,
    playingXI,
    bench: squad.filter(p => !playingXIKeys.has(p.playerKey)),
  };
}

/** Compute live squad valuation, bench depth, and matchday rating */
export function computeSquadMetrics(squad, playingXIKeys = new Set(), leagueSpendCr = 215.45, leaguePricedImpact = 48000, purseCap = 120) {
  const val = validateSquad(squad, playingXIKeys, purseCap);

  let totalSquadImpact = 0;
  for (const p of squad) totalSquadImpact += p.impactPoints || 0;

  let xiImpact = 0;
  let xiSpend = 0;
  let xiRuns = 0;
  let xiWickets = 0;

  for (const p of val.playingXI) {
    xiImpact += p.impactPoints || 0;
    const price = p.effectivePrice ?? getPlayerEffectivePrice(p, squad);
    xiSpend += price;
    xiRuns += p.runs || 0;
    xiWickets += p.wickets || 0;
  }
  xiSpend = +xiSpend.toFixed(2);

  // Playing XI Value Index
  let xiValueIndex = 0;
  if (xiSpend > 0 && leagueSpendCr > 0 && leaguePricedImpact > 0) {
    const impShare = xiImpact / leaguePricedImpact;
    const spendShare = xiSpend / leagueSpendCr;
    xiValueIndex = spendShare > 0 ? +(impShare / spendShare).toFixed(2) : 0;
  }

  // Full Squad Value Index
  let squadValueIndex = 0;
  if (val.totalSpend > 0 && leagueSpendCr > 0 && leaguePricedImpact > 0) {
    const impShare = totalSquadImpact / leaguePricedImpact;
    const spendShare = val.totalSpend / leagueSpendCr;
    squadValueIndex = spendShare > 0 ? +(impShare / spendShare).toFixed(2) : 0;
  }

  // Rating score (0-100 scale)
  const xiScore = Math.min(40, (xiImpact / 5800) * 40);
  const effScore = Math.min(30, (squadValueIndex / 2.0) * 30);
  const squadSizeRatio = Math.min(1, squad.length / IPL_RULES.MIN_SQUAD_SIZE);
  const depthScore = Math.round(squadSizeRatio * 20 + (val.isPlayingXIValid ? 10 : 0));

  let ratingScore = Math.round(xiScore + effScore + depthScore);
  if (val.isOverBudget) ratingScore = Math.max(0, ratingScore - 40);

  let tier = 'Drafting';
  let tierLabel = `${squad.length}/${IPL_RULES.MIN_SQUAD_SIZE} Min Squad`;
  let tierColor = 'var(--muted)';

  if (val.isOverBudget) {
    tier = 'Over Budget';
    tierLabel = 'Cap Exceeded';
    tierColor = '#B8165A';
  } else if (val.isFullSquadValid && val.isPlayingXIValid) {
    if (ratingScore >= 88 && squadValueIndex >= 1.8) {
      tier = 'S Tier';
      tierLabel = 'Elite Championship Squad';
      tierColor = '#2BAF66';
    } else if (ratingScore >= 75) {
      tier = 'A Tier';
      tierLabel = 'Playoff Contender';
      tierColor = '#F5821F';
    } else {
      tier = 'B Tier';
      tierLabel = 'Balanced Squad';
      tierColor = '#3366FF';
    }
  } else if (val.isPlayingXIValid) {
    tier = 'XI Ready';
    tierLabel = `Need ${IPL_RULES.MIN_SQUAD_SIZE - squad.length} more squad players`;
    tierColor = '#F5821F';
  }

  return {
    ...val,
    totalSquadImpact,
    xiImpact,
    xiSpend,
    xiRuns,
    xiWickets,
    xiValueIndex,
    squadValueIndex,
    ratingScore,
    tier,
    tierLabel,
    tierColor,
  };
}

/** Automatically select the best 11-player lineup from whatever players are currently in the squad */
export function selectBestXIFromSquad(squad) {
  if (!squad || squad.length === 0) return new Set();

  const byRole = {
    'Wicket-Keeper': [],
    'Batter': [],
    'All-Rounder': [],
    'Bowler': [],
  };

  for (const p of squad) {
    if (byRole[p.role]) byRole[p.role].push(p);
    else byRole['Batter'].push(p);
  }

  for (const r of Object.keys(byRole)) {
    byRole[r].sort((a, b) => (b.impactPoints || 0) - (a.impactPoints || 0));
  }

  const selected = [];
  let overseasCount = 0;

  function pick(role, count) {
    const list = byRole[role];
    let picked = 0;
    for (const p of list) {
      if (picked >= count) break;
      if (selected.some(s => s.playerKey === p.playerKey)) continue;

      const isOverseas = p.nationality === 'Overseas';
      if (isOverseas && overseasCount >= IPL_RULES.MAX_OVERSEAS_XI) continue;

      selected.push(p);
      if (isOverseas) overseasCount++;
      picked++;
    }
  }

  // Core roles: 1 WK, 4 Batters, 2 All-Rounders, 4 Bowlers
  pick('Wicket-Keeper', IPL_RULES.XI_ROLES['Wicket-Keeper']);
  pick('All-Rounder', IPL_RULES.XI_ROLES['All-Rounder']);
  pick('Bowler', IPL_RULES.XI_ROLES['Bowler']);
  pick('Batter', IPL_RULES.XI_ROLES['Batter']);

  // If still under 11, fill with best remaining
  if (selected.length < IPL_RULES.PLAYING_XI_SIZE) {
    const remaining = squad
      .filter(p => !selected.some(s => s.playerKey === p.playerKey))
      .sort((a, b) => (b.impactPoints || 0) - (a.impactPoints || 0));

    for (const p of remaining) {
      if (selected.length >= IPL_RULES.PLAYING_XI_SIZE) break;
      const isOverseas = p.nationality === 'Overseas';
      if (isOverseas && overseasCount >= IPL_RULES.MAX_OVERSEAS_XI) continue;

      selected.push(p);
      if (isOverseas) overseasCount++;
    }
  }

  return new Set(selected.map(p => p.playerKey));
}

/**
 * Auto-draft an entire realistic 20-player IPL Franchise Squad under the purse cap!
 * Retains existing retained core (if any), then buys remaining spots from auction pool.
 */
export function autoDraftFullSquad(pool, initialSquad = [], purseCap = 120, targetSize = IPL_RULES.DEFAULT_SQUAD_TARGET) {
  const squad = [...initialSquad];
  const retainedKeys = new Set(squad.map(p => p.playerKey));

  let currentSpend = squad.reduce((sum, p) => sum + (p.effectivePrice ?? p.priceCr), 0);
  let overseasCount = squad.filter(p => p.nationality === 'Overseas').length;

  // Separate auction pool by roles and sort by value index
  const byRole = {
    'Wicket-Keeper': [],
    'Batter': [],
    'All-Rounder': [],
    'Bowler': [],
  };

  for (const p of pool) {
    if (retainedKeys.has(p.playerKey)) continue;
    if (byRole[p.role]) byRole[p.role].push(p);
    else byRole['Batter'].push(p);
  }

  for (const r of Object.keys(byRole)) {
    byRole[r].sort((a, b) => (b.valueIndex || 0) - (a.valueIndex || 0) || (b.impactPoints || 0) - (a.impactPoints || 0));
  }

  function tryAdd(p) {
    if (squad.some(s => s.playerKey === p.playerKey)) return false;
    const isOverseas = p.nationality === 'Overseas';
    if (isOverseas && overseasCount >= IPL_RULES.MAX_OVERSEAS_SQUAD) return false;

    const remainingSlots = targetSize - (squad.length + 1);
    const minReserveNeeded = remainingSlots * 0.3;
    if (currentSpend + p.priceCr + minReserveNeeded > purseCap) return false;

    squad.push({ ...p, effectivePrice: p.priceCr });
    currentSpend += p.priceCr;
    if (isOverseas) overseasCount++;
    return true;
  }

  // Ensure balance across roles
  const targets = {
    'Wicket-Keeper': 2,
    'All-Rounder': 4,
    'Bowler': 8,
    'Batter': 6,
  };

  for (const [r, target] of Object.entries(targets)) {
    for (const p of byRole[r]) {
      if (squad.filter(s => s.role === r).length >= target) break;
      tryAdd(p);
    }
  }

  // Fill up to targetSize
  const allRemaining = [...pool]
    .filter(p => !squad.some(s => s.playerKey === p.playerKey))
    .sort((a, b) => (b.valueIndex || 0) - (a.valueIndex || 0) || a.priceCr - b.priceCr);

  for (const p of allRemaining) {
    if (squad.length >= targetSize) break;
    tryAdd(p);
  }

  const playingXIKeys = selectBestXIFromSquad(squad);
  return { squad, playingXIKeys };
}
