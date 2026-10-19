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
    const [seasons, totalPlayers, totalBuys, matchedBuys] = await Promise.all([
      Season.find().sort({ Season: 1 }).lean(),
      Player.countDocuments(),
      AuctionBuy.countDocuments(),
      AuctionBuy.countDocuments({ IsMatched: true }),
    ]);

    const totalSpendCr = seasons.reduce((s, r) => s + (r.AuctionSpendCr || 0), 0);
    const avgPriceCr = totalBuys > 0 ? +(totalSpendCr / totalBuys).toFixed(2) : 0;
    const firstSeason = seasons[0]?.Season;
    const lastSeason = seasons[seasons.length - 1]?.Season;
    const matchPct = totalBuys > 0 ? +((matchedBuys / totalBuys) * 100).toFixed(1) : 0;

    // Price inflation: latest avg / earliest avg
    const earliest = seasons[0];
    const latest = seasons[seasons.length - 1];
    const priceInflation = earliest?.AvgPriceCr
      ? +(latest.AvgPriceCr / earliest.AvgPriceCr).toFixed(1)
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
      seasons,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
