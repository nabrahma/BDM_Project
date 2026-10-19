/**
 * playerSeasons.js — GET /api/player-seasons?season=&priced=true
 * Player Value Map page: scatter data with quadrant colouring.
 */
import { Router } from 'express';
import PlayerSeason from '../models/PlayerSeason.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { season, priced, team, role, nationality } = req.query;
    const filter = {};

    if (season) filter.Season = Number(season);
    if (priced === 'true') filter.PriceSource = 'Auction';
    if (team) filter.TeamKey = team;
    if (role) filter.Role = role;
    if (nationality) filter.Nationality = nationality;

    const rows = await PlayerSeason.find(filter)
      .sort({ ImpactPoints: -1 })
      .lean();

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
