/**
 * breakdown.js — GET /api/breakdown?by=Role|Nationality|PriceBracket&season=
 * Pages 5 (Role & Nationality) and 6 (Price Brackets).
 *
 * Uses the share-sum Value Index formula from HANDOFF §6.
 */
import { Router } from 'express';
import PlayerSeason from '../models/PlayerSeason.js';
import { valueIndexPipeline, valueIndexForSeason } from '../lib/valueIndex.js';

const router = Router();

const ALLOWED_KEYS = ['Role', 'Nationality', 'PriceBracket'];

router.get('/', async (req, res, next) => {
  try {
    const { by, season } = req.query;

    if (!by || !ALLOWED_KEYS.includes(by)) {
      return res.status(400).json({
        error: `'by' must be one of: ${ALLOWED_KEYS.join(', ')}`,
      });
    }

    const pipeline = season
      ? valueIndexForSeason(by, season)
      : valueIndexPipeline(by);

    const rows = await PlayerSeason.aggregate(pipeline);

    // For PriceBracket, sort by bracket order instead of VI
    if (by === 'PriceBracket') {
      const bracketOrder = {
        'Base price buy': 1,
        'Under 2 Cr': 2,
        '2 to 5 Cr': 3,
        '5 to 10 Cr': 4,
        '10 Cr and above': 5,
      };
      rows.sort((a, b) => (bracketOrder[a.group] || 99) - (bracketOrder[b.group] || 99));
    }

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
