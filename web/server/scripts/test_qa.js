import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Season from '../src/models/Season.js';
import PlayerSeason from '../src/models/PlayerSeason.js';
import Player from '../src/models/Player.js';
import { valueIndexPipeline } from '../src/lib/valueIndex.js';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ipl_auction';

async function runQA() {
  await mongoose.connect(uri);
  console.log('🏏 Connected to MongoDB for QA test\n');

  let passed = 0;
  let failed = 0;

  function assert(title, condition, details) {
    if (condition) {
      console.log(`✅ PASS: ${title}`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${title}`);
      console.log(`   Details:`, details);
      failed++;
    }
  }

  // 1. Season 2026
  const s2026 = await Season.findOne({ Season: 2026 });
  assert(
    'Season 2026 has 77 buys, ₹215.45 Cr spend',
    s2026?.PlayersBought === 77 && s2026?.AuctionSpendCr === 215.45,
    { PlayersBought: s2026?.PlayersBought, AuctionSpendCr: s2026?.AuctionSpendCr }
  );

  // 2. Top steal 2026: Kartik Tyagi (KKR, ₹0.3 Cr), VI=33.95
  const topSteal = await PlayerSeason.find({
    Season: 2026,
    PriceSource: 'Auction',
    Matches: { $gte: 5 },
    ValueIndex: { $ne: null },
  }).sort({ ValueIndex: -1 }).limit(1).lean();
  assert(
    'Top steal 2026 is Kartik Tyagi with VI ≈ 33.95',
    topSteal[0]?.PlayerName?.includes('Tyagi') && Math.abs(topSteal[0]?.ValueIndex - 33.95) < 0.1,
    topSteal[0]
  );

  // 3. Most overpaid 2026: Rishabh Pant ₹19.55 Cr
  const topOverpaid = await PlayerSeason.find({
    Season: 2026,
    PriceSource: 'Auction',
    Matches: { $gte: 5 },
    OverpayCr: { $ne: null },
  }).sort({ OverpayCr: -1 }).limit(3).lean();
  assert(
    'Top overpaid 2026 is Rishabh Pant with OverpayCr ≈ 19.55 Cr',
    topOverpaid[0]?.PlayerName?.includes('Pant') && Math.abs(topOverpaid[0]?.OverpayCr - 19.55) < 0.2,
    topOverpaid[0]
  );

  // 4. Quadrant counts 2026: Star 57, Steal 24, Overpaid 8, Passenger 6, Too few 76
  const quadrants = await PlayerSeason.aggregate([
    { $match: { Season: 2026 } },
    { $group: { _id: '$ValueQuadrant', count: { $sum: 1 } } }
  ]);
  const qMap = Object.fromEntries(quadrants.map(q => [q._id, q.count]));
  assert(
    'Quadrant counts 2026 match: Star 57, Steal 24, Overpaid 8, Passenger 6, Too few 76',
    qMap['Star'] === 57 && qMap['Steal'] === 24 && qMap['Overpaid'] === 8 && qMap['Passenger'] === 6 && qMap['Too few matches'] === 76,
    qMap
  );

  // 5. Value Index by bracket (all seasons): Base price buy=4.11, 10 Cr+=0.49
  const brackets = await PlayerSeason.aggregate(valueIndexPipeline('PriceBracket'));
  const bMap = Object.fromEntries(brackets.map(b => [b.group, b.valueIndex]));
  assert(
    'Value Index by bracket: Base price buy ≈ 4.11, 10 Cr+ ≈ 0.49',
    Math.abs((bMap['Base price buy'] || 0) - 4.11) < 0.1 && Math.abs((bMap['10 Cr and above'] || 0) - 0.49) < 0.1,
    bMap
  );

  // 6. V Kohli 2016: 973 runs, 1187 Impact Points, Unpriced
  const vk2016 = await PlayerSeason.findOne({
    PlayerName: { $regex: /Kohli/i },
    Season: 2016,
  }).lean();
  assert(
    'V Kohli 2016: 973 runs, 1187 Impact Points, Unpriced',
    vk2016?.Runs === 973 && vk2016?.ImpactPoints === 1187 && vk2016?.PriceSource === 'Unpriced',
    vk2016
  );

  console.log(`\nQA Summary: ${passed} passed, ${failed} failed\n`);
  await mongoose.disconnect();
}

runQA().catch(err => {
  console.error('QA test error:', err);
  process.exit(1);
});
