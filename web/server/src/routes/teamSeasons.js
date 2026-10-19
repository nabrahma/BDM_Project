/**
 * teamSeasons.js — GET /api/team-seasons?season=
 * Franchise Efficiency page: Value Index by team, spend vs win %, team × season matrix.
 */
import { Router } from 'express';
import TeamSeason from '../models/TeamSeason.js';
import Team from '../models/Team.js';
import PlayerSeason from '../models/PlayerSeason.js';
import { valueIndexPipeline } from '../lib/valueIndex.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { season } = req.query;
    const filter = season ? { Season: Number(season) } : {};

    // Single-season: use the precomputed team_seasons values
    if (season) {
      const rows = await TeamSeason.find(filter).sort({ ValueIndex: -1 }).lean();
      return res.json(rows);
    }

    // All seasons: aggregate Value Index using the share-sum formula
    const pipeline = valueIndexPipeline('TeamKey');
    const viRows = await PlayerSeason.aggregate(pipeline);

    // Merge with team metadata
    const teams = await Team.find().lean();
    const teamMap = Object.fromEntries(teams.map(t => [t.TeamKey, t]));

    // Also get overall spend and win stats per team
    const teamStats = await TeamSeason.aggregate([
      {
        $group: {
          _id: '$TeamKey',
          totalSpendCr: { $sum: '$SpendCr' },
          totalWins: { $sum: '$Wins' },
          totalResults: { $sum: '$Results' },
          seasons: { $sum: 1 },
        },
      },
    ]);
    const statsMap = Object.fromEntries(teamStats.map(s => [s._id, s]));

    const result = viRows.map(row => ({
      ...row,
      teamName: teamMap[row.group]?.TeamName || row.group,
      teamColour: teamMap[row.group]?.TeamColour,
      isActive: teamMap[row.group]?.IsActive,
      totalWins: statsMap[row.group]?.totalWins || 0,
      totalResults: statsMap[row.group]?.totalResults || 0,
      winPct: statsMap[row.group]?.totalResults
        ? +(statsMap[row.group].totalWins / statsMap[row.group].totalResults).toFixed(4)
        : 0,
      seasons: statsMap[row.group]?.seasons || 0,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/team-seasons/matrix — all team × season data for heatmap
router.get('/matrix', async (_req, res, next) => {
  try {
    const rows = await TeamSeason.find().sort({ Season: 1, TeamKey: 1 }).lean();
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
