/**
 * app.js — Express server for IPL Auction Value Intelligence.
 *
 * Mounts all API routes and connects to MongoDB via Mongoose.
 */
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import summaryRoutes from './routes/summary.js';
import seasonsRoutes from './routes/seasons.js';
import teamSeasonsRoutes from './routes/teamSeasons.js';
import playerSeasonsRoutes from './routes/playerSeasons.js';
import rankingsRoutes from './routes/rankings.js';
import breakdownRoutes from './routes/breakdown.js';
import playersRoutes from './routes/players.js';
import squadBuilderRoutes from './routes/squadBuilder.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ipl_auction';

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/summary', summaryRoutes);
app.use('/api/seasons', seasonsRoutes);
app.use('/api/team-seasons', teamSeasonsRoutes);
app.use('/api/player-seasons', playerSeasonsRoutes);
app.use('/api/rankings', rankingsRoutes);
app.use('/api/breakdown', breakdownRoutes);
app.use('/api/players', playersRoutes);
app.use('/api/squad-builder', squadBuilderRoutes);

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '../../client/dist');

// Health check with live MongoDB stats
app.get('/api/health', async (_req, res) => {
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

  const maskedUri = MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
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

// Production: serve Vite build if present
if (process.env.SERVE_STATIC === 'true' || process.env.NODE_ENV === 'production') {
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

// Connect to MongoDB and start server
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('🏏 Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`🚀 API server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });

export default app;
