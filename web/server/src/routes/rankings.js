/**
 * rankings.js — Steals and Overpaid page
 *
 * GET /api/rankings/steals?season=    — Top 10 by ValueIndex (Matches ≥ 5)
 * GET /api/rankings/overpaid?season=  — Top 10 by OverpayCr  (Matches ≥ 5)
 * GET /api/rankings/bargain-xi?season= — Best XI by value
 * GET /api/rankings/overpaid-xi?season= — Worst XI by overpay
 */
import { Router } from 'express';
import PlayerSeason from '../models/PlayerSeason.js';
import UnsoldPlayer from '../models/UnsoldPlayer.js';

const router = Router();

// Minimum matches for rankings
const MIN_MATCHES = 5;

/** Top 10 steals — highest Value Index, priced, ≥ 5 matches */
router.get('/steals', async (req, res, next) => {
  try {
    const { season } = req.query;
    const filter = {
      PriceSource: 'Auction',
      Matches: { $gte: MIN_MATCHES },
      ValueIndex: { $ne: null },
    };
    if (season) filter.Season = Number(season);

    const rows = await PlayerSeason.find(filter)
      .sort({ ValueIndex: -1 })
      .limit(10)
      .lean();

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/** Top 10 overpaid — highest OverpayCr (most ₹ lost), priced, ≥ 5 matches */
router.get('/overpaid', async (req, res, next) => {
  try {
    const { season } = req.query;
    const filter = {
      PriceSource: 'Auction',
      Matches: { $gte: MIN_MATCHES },
      OverpayCr: { $ne: null },
    };
    if (season) filter.Season = Number(season);

    const rows = await PlayerSeason.find(filter)
      .sort({ OverpayCr: -1 })
      .limit(10)
      .lean();

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * Best XI — pick the best player by ValueIndex for each role.
 * Roles: 2 All-Rounders, 4 Batters, 4 Bowlers, 1 Wicket-Keeper
 */
const XI_SHAPE = [
  { role: 'All-Rounder', count: 2 },
  { role: 'Batter', count: 4 },
  { role: 'Bowler', count: 4 },
  { role: 'Wicket-Keeper', count: 1 },
];

router.get('/bargain-xi', async (req, res, next) => {
  try {
    const { season } = req.query;
    const baseFilter = {
      PriceSource: 'Auction',
      Matches: { $gte: MIN_MATCHES },
      ValueIndex: { $ne: null },
    };
    if (season) baseFilter.Season = Number(season);

    const xi = [];
    for (const { role, count } of XI_SHAPE) {
      const picks = await PlayerSeason.find({ ...baseFilter, Role: role })
        .sort({ ValueIndex: -1 })
        .limit(count)
        .lean();
      xi.push(...picks);
    }

    res.json(xi.sort((a, b) => {
      const roleOrder = { 'All-Rounder': 0, 'Batter': 1, 'Bowler': 2, 'Wicket-Keeper': 3 };
      return (roleOrder[a.Role] ?? 4) - (roleOrder[b.Role] ?? 4);
    }));
  } catch (err) {
    next(err);
  }
});

router.get('/overpaid-xi', async (req, res, next) => {
  try {
    const { season } = req.query;
    const baseFilter = {
      PriceSource: 'Auction',
      Matches: { $gte: MIN_MATCHES },
      OverpayCr: { $ne: null },
    };
    if (season) baseFilter.Season = Number(season);

    const xi = [];
    for (const { role, count } of XI_SHAPE) {
      const picks = await PlayerSeason.find({ ...baseFilter, Role: role })
        .sort({ OverpayCr: -1 })
        .limit(count)
        .lean();
      xi.push(...picks);
    }

    res.json(xi.sort((a, b) => {
      const roleOrder = { 'All-Rounder': 0, 'Batter': 1, 'Bowler': 2, 'Wicket-Keeper': 3 };
      return (roleOrder[a.Role] ?? 4) - (roleOrder[b.Role] ?? 4);
    }));
  } catch (err) {
    next(err);
  }
});

/** Unsold players */
router.get('/unsold', async (_req, res, next) => {
  try {
    const rows = await UnsoldPlayer.find()
      .sort({ CareerImpact: -1 })
      .lean();
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
