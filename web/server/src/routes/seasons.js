/**
 * seasons.js — GET /api/seasons
 * Auction Market page: all seasons with spend, avg price, top buy, mega auction flag.
 */
import { Router } from 'express';
import Season from '../models/Season.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const seasons = await Season.find().sort({ Season: 1 }).lean();
    res.json(seasons);
  } catch (err) {
    next(err);
  }
});

export default router;
