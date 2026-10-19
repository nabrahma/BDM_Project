/**
 * valueIndex.js — MongoDB aggregation pipeline for Value Index.
 *
 * RULE: Never average ValueIndex values. Sum the impact and spend shares
 * per season, then divide. See HANDOFF.md §6 and data/README.md.
 *
 * ValueIndex(group) = Σ_season (ImpactPoints / LeaguePricedImpact)
 *                   ÷ Σ_season (PriceCr / LeagueSpendCr)
 */

/**
 * Build an aggregation pipeline that computes Value Index grouped by `key`.
 *
 * @param {string} key   — The field to group by: "Role", "Nationality", "PriceBracket", "TeamKey"
 * @param {object} match — Additional $match criteria (e.g. { Season: 2026 })
 * @returns {object[]}   — Mongo aggregation pipeline stages
 */
export function valueIndexPipeline(key, match = {}) {
  return [
    // Only priced (auction) rows
    { $match: { PriceSource: 'Auction', ...match } },

    // Group by (key, season) to get per-season totals
    {
      $group: {
        _id: { k: `$${key}`, s: '$Season' },
        imp:   { $sum: '$ImpactPoints' },
        spend: { $sum: '$PriceCr' },
        players: { $sum: 1 },
      },
    },

    // Look up league totals for each season
    {
      $lookup: {
        from: 'seasons',
        localField: '_id.s',
        foreignField: 'Season',
        as: 'L',
      },
    },
    { $unwind: '$L' },

    // Aggregate across seasons: sum the shares
    {
      $group: {
        _id: '$_id.k',
        impShare:   { $sum: { $divide: ['$imp',   '$L.LeaguePricedImpact'] } },
        spendShare: { $sum: { $divide: ['$spend', '$L.LeagueSpendCr'] } },
        spendCr:    { $sum: '$spend' },
        impactPts:  { $sum: '$imp' },
        players:    { $sum: '$players' },
      },
    },

    // Compute Value Index = impShare / spendShare
    {
      $project: {
        _id: 0,
        group: '$_id',
        spendCr: 1,
        impactPts: 1,
        players: 1,
        valueIndex: {
          $cond: [
            { $gt: ['$spendShare', 0] },
            { $round: [{ $divide: ['$impShare', '$spendShare'] }, 2] },
            null,
          ],
        },
      },
    },
    { $sort: { valueIndex: -1 } },
  ];
}

/**
 * Convenience: compute Value Index for a single season, grouped by key.
 */
export function valueIndexForSeason(key, season) {
  return valueIndexPipeline(key, { Season: Number(season) });
}
