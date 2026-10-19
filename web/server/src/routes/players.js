/**
 * players.js — Player Profile page
 *
 * GET /api/players?q=kohli    — Search players by name
 * GET /api/players/:id        — Full player profile with per-season stats and auction history
 */
import { Router } from 'express';
import Player from '../models/Player.js';
import PlayerSeason from '../models/PlayerSeason.js';
import AuctionBuy from '../models/AuctionBuy.js';

const router = Router();

/** Search or list top players — text search if query given, else top players by career impact */
router.get('/', async (req, res, next) => {
  try {
    const { q, role, team, sort = 'impact', limit = 50 } = req.query;

    const filter = {};
    if (role && role !== 'All') filter.Role = role;
    if (team && team !== 'All') filter.LatestTeamKey = team;

    // If query provided, perform text / regex search
    if (q && q.trim().length >= 2) {
      const trimmed = q.trim();
      let results = [];
      try {
        results = await Player.find(
          { ...filter, $text: { $search: trimmed } },
          { score: { $meta: 'textScore' } }
        )
          .sort({ score: { $meta: 'textScore' } })
          .limit(Number(limit))
          .lean();
      } catch {
        results = [];
      }

      if (results.length === 0) {
        const regex = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        results = await Player.find({ ...filter, PlayerName: regex })
          .sort({ CareerImpactPoints: -1 })
          .limit(Number(limit))
          .lean();
      }

      return res.json(results);
    }

    // No search query: return top players by requested sort field
    const sortField = sort === 'vi' ? { CareerValueIndex: -1 }
      : sort === 'runs' ? { CareerRuns: -1 }
      : sort === 'wickets' ? { CareerWickets: -1 }
      : sort === 'spend' ? { TotalAuctionSpendCr: -1 }
      : { CareerImpactPoints: -1 };

    const players = await Player.find(filter)
      .sort(sortField)
      .limit(Number(limit))
      .lean();

    res.json(players);
  } catch (err) {
    next(err);
  }
});

/** Player profile — career info, season-by-season stats, auction history */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const [player, seasons, auctions] = await Promise.all([
      Player.findOne({ PlayerID: id }).lean(),
      PlayerSeason.find({ PlayerID: id }).sort({ Season: 1 }).lean(),
      AuctionBuy.find({ PlayerID: id }).sort({ Season: 1 }).lean(),
    ]);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({ player, seasons, auctions });
  } catch (err) {
    next(err);
  }
});

export default router;
