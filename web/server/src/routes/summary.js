/**
 * summary.js — GET /api/summary
 * Home page KPIs: total spend, buys, avg price, seasons covered, match %.
 */
import { Router } from 'express';
import Season from '../models/Season.js';
import Player from '../models/Player.js';
import AuctionBuy from '../models/AuctionBuy.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const [seasons, totalPlayers, totalBuys, spendAgg] = await Promise.all([
      Season.find().sort({ Season: 1 }).lean(),
      Player.countDocuments(),
      AuctionBuy.countDocuments(),
      AuctionBuy.aggregate([
        { $group: { _id: null, total: { $sum: '$PriceCr' }, matched: { $sum: { $cond: ['$IsMatched', '$PriceCr', 0] } } } },
      ]),
    ]);

    const totalSpendCr = seasons.reduce((s, r) => s + (r.AuctionSpendCr || 0), 0);
    const avgPriceCr = totalBuys > 0 ? +(totalSpendCr / totalBuys).toFixed(2) : 0;
    const firstSeason = seasons[0]?.Season;
    const lastSeason = seasons[seasons.length - 1]?.Season;
    // Share of auction SPEND (not of buys) matched to ball-by-ball data — same as the Power BI "Spend Matched %"
    const spend = spendAgg[0];
    const matchPct = spend?.total ? +((spend.matched / spend.total) * 100).toFixed(1) : 0;

    // Price inflation: average price at the latest mega auction (2025) vs the first season (2013)
    const earliest = seasons[0];
    const latestMega = [...seasons].reverse().find(s => s.IsMegaAuction) || seasons[seasons.length - 1];
    const priceInflation = earliest?.AvgPriceCr
      ? +(latestMega.AvgPriceCr / earliest.AvgPriceCr).toFixed(1)
      : null;

    res.json({
      totalSpendCr: +totalSpendCr.toFixed(1),
      totalBuys,
      avgPriceCr,
      totalPlayers,
      firstSeason,
      lastSeason,
      matchPct,
      priceInflation,
      priceInflationSeason: latestMega?.Season,
      seasons,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
