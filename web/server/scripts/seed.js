/**
 * seed.js — Load all processed JSON files into MongoDB.
 *
 * Usage:  node scripts/seed.js
 *
 * Reads from ../../data/processed/*.json (relative to web/server/).
 * Drops each collection before inserting so the script is idempotent.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Models — importing them registers the schemas with Mongoose
import Player from '../src/models/Player.js';
import Team from '../src/models/Team.js';
import Season from '../src/models/Season.js';
import TeamSeason from '../src/models/TeamSeason.js';
import PlayerSeason from '../src/models/PlayerSeason.js';
import AuctionBuy from '../src/models/AuctionBuy.js';
import TeamMatch from '../src/models/TeamMatch.js';
import UnsoldPlayer from '../src/models/UnsoldPlayer.js';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', '..', 'data', 'processed');

const COLLECTIONS = [
  { model: Player,       file: 'players.json' },
  { model: Team,         file: 'teams.json' },
  { model: Season,       file: 'seasons.json' },
  { model: TeamSeason,   file: 'team_seasons.json' },
  { model: PlayerSeason, file: 'player_seasons.json' },
  { model: AuctionBuy,   file: 'auction_buys.json' },
  { model: TeamMatch,    file: 'team_matches.json' },
  { model: UnsoldPlayer, file: 'unsold_players.json' },
];

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ipl_auction';
  console.log(`\n🏏 Connecting to ${uri} …`);
  await mongoose.connect(uri);
  console.log('   Connected.\n');

  for (const { model, file } of COLLECTIONS) {
    const path = join(DATA_DIR, file);
    const data = JSON.parse(readFileSync(path, 'utf-8'));

    // Drop existing data
    await model.collection.drop().catch(() => {}); // ignore if not exists

    // Insert
    const result = await model.insertMany(data, { ordered: false });
    console.log(`   ✅ ${model.collection.name}: ${result.length} docs from ${file}`);
  }

  // Ensure indexes (Mongoose auto-creates from schema definitions)
  await Promise.all(COLLECTIONS.map(({ model }) => model.ensureIndexes()));
  console.log('\n   📇 Indexes created.');

  // Quick sanity check
  const s2026 = await Season.findOne({ Season: 2026 });
  if (s2026) {
    console.log(`\n   🔍 Sanity check — 2026: ${s2026.PlayersBought} buys, ₹${s2026.AuctionSpendCr} Cr spend`);
    console.log(`      Expected:               77 buys, ₹215.45 Cr spend`);
    const ok = s2026.PlayersBought === 77 && s2026.AuctionSpendCr === 215.45;
    console.log(`      ${ok ? '✅ PASS' : '❌ MISMATCH — check data/processed/seasons.json'}`);
  }

  await mongoose.disconnect();
  console.log('\n🏁 Seed complete.\n');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
