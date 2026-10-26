/**
 * app.js — Express app for IPL Auction Value Intelligence.
 *
 * Mounts all API routes. It does not listen on a port itself, so the same app runs:
 *   - locally / on Render:  src/index.js connects to MongoDB and calls app.listen()
 *   - on Vercel:            ../../api/index.js exports it as a serverless function
 * Every /api request first makes sure the (cached) MongoDB connection is open.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDB, getMongoUri } from './db.js';
import summaryRoutes from './routes/summary.js';
import seasonsRoutes from './routes/seasons.js';
import teamSeasonsRoutes from './routes/teamSeasons.js';
import playerSeasonsRoutes from './routes/playerSeasons.js';
import rankingsRoutes from './routes/rankings.js';
import breakdownRoutes from './routes/breakdown.js';
import playersRoutes from './routes/players.js';
import squadBuilderRoutes from './routes/squadBuilder.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check with live MongoDB stats (reports "disconnected" instead of failing)
app.get('/api/health', async (_req, res) => {
  try { await connectDB(); } catch (err) { console.error('MongoDB connection failed:', err.message); }
  const isConnected = mongoose.connection.readyState === 1;
  const start = Date.now();
  let collections = [];
  let totalDocs = 0;

  try {
    if (isConnected && mongoose.connection.db) {
      const cols = await mongoose.connection.db.listCollections().toArray();
      for (const c of cols) {
        const count = await mongoose.connection.db.collection(c.name).countDocuments();
        collections.push({ name: c.name, count });
        totalDocs += count;
      }
      collections.sort((a, b) => b.count - a.count);
    }
  } catch (err) {
    console.error('Failed to get DB stats:', err);
  }

  const maskedUri = getMongoUri().replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
  const latencyMs = Date.now() - start;
  res.json({
    status: 'ok',
    db: isConnected ? 'connected' : 'disconnected',
    database: mongoose.connection.name || 'ipl_auction',
    uri: maskedUri,
    totalDocs,
    collections,
    latencyMs,
  });
});

// Every other API call needs the database
app.use('/api', async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// Routes
app.use('/api/summary', summaryRoutes);
app.use('/api/seasons', seasonsRoutes);
app.use('/api/team-seasons', teamSeasonsRoutes);
app.use('/api/player-seasons', playerSeasonsRoutes);
app.use('/api/rankings', rankingsRoutes);
app.use('/api/breakdown', breakdownRoutes);
app.use('/api/players', playersRoutes);
app.use('/api/squad-builder', squadBuilderRoutes);

// Production on a single server (Render / VPS): serve the Vite build if present.
// On Vercel the static files are served by Vercel itself, so this is skipped.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');
if (!process.env.VERCEL && (process.env.SERVE_STATIC === 'true' || process.env.NODE_ENV === 'production')) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'), err => {
      if (err) next();
    });
  });
}

// Error handler
app.use((err, _req, res, _next) => {
  console.error('API Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

export default app;
