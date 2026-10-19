/**
 * squadBuilder.js — Routes for the Interactive Squad Builder & Cap Simulator.
 *
 * Supports:
 * - 171 Auction-hammer buys (with actual auction prices)
 * - 67 Retained Superstars (Capped with Dynamic Retention Ladder vs Uncapped ₹4 Cr)
 * - 10 Official Franchise Retention Presets (RCB, MI, CSK, SRH, PBKS, KKR, RR, GT, DC, LSG)
 */
import { Router } from 'express';
import PlayerSeason from '../models/PlayerSeason.js';
import Season from '../models/Season.js';

const router = Router();

// Uncapped players identified by real BCCI IPL 2025/2026 rules (flat ₹4.0 Cr)
const UNCAPPED_NAMES = new Set([
  'Sandeep Sharma', 'Shashank Singh', 'Prabhsimran Singh', 'Yash Dayal',
  'Mohsin Khan', 'Ayush Badoni', 'Arjun Tendulkar', 'A Mhatre',
  'Harsh Dubey', 'Urvil Patel', 'Ramandeep Singh', 'Harshit Rana',
  'Krish Bhagat', 'Mayank Yadav', 'R Smaran', 'SR Dubey', 'Raghu Sharma',
]);

// Official franchise retention templates (pre-auction retentions and deducted purse)
const FRANCHISE_TEMPLATES = {
  'RCB': {
    name: 'Royal Challengers Bengaluru',
    retainedPlayerIds: ['ba607b88', 'c740ea83'], // V Kohli, Rajat Patidar
    retentionSpendCr: 37.0, // Kohli (21 Cr), Patidar (11 Cr), Dayal (5 Cr)
    notes: 'Retained V Kohli & Rajat Patidar. Purse Left: ₹83.0 Cr',
  },
  'MI': {
    name: 'Mumbai Indians',
    retainedPlayerIds: ['462411b3', '271f83cd', 'dbe50b21', '740742ef', 'b0482a1d'], // Bumrah, Surya, Hardik, Rohit, Tilak
    retentionSpendCr: 75.0, // 18 + 18 + 14 + 14 + 11
    notes: 'Retained 5 core superstars. Purse Left: ₹45.0 Cr',
  },
  'CSK': {
    name: 'Chennai Super Kings',
    retainedPlayerIds: ['45a43fe2', 'fe93fd9d', 'a4e37e47'], // Ruturaj, Jadeja, Dube
    retentionSpendCr: 65.0,
    notes: 'Retained Ruturaj Gaikwad, Jadeja, Shivam Dube. Purse Left: ₹55.0 Cr',
  },
  'SRH': {
    name: 'Sunrisers Hyderabad',
    retainedPlayerIds: ['235c2bb6', 'ded9240e', 'f29185a1', '12b610c2', 'aad0c365'], // Klaasen, Cummins, Abhishek, Head, Nitish
    retentionSpendCr: 75.0,
    notes: 'Retained explosive batting core & Pat Cummins. Purse Left: ₹45.0 Cr',
  },
  'PBKS': {
    name: 'Punjab Kings',
    retainedPlayerIds: ['26989d80', '9418198b'], // Shashank Singh, Prabhsimran Singh
    retentionSpendCr: 9.5,
    notes: 'Retained 2 uncapped match-winners. Massive Auction Purse Left: ₹110.5 Cr',
  },
  'KKR': {
    name: 'Kolkata Knight Riders',
    retainedPlayerIds: ['0a509d6b', '5b7ab5a9', '9d430b40', 'be24ead0'], // Rinku, Varun, Narine, Ramandeep
    retentionSpendCr: 57.0,
    notes: 'Retained spin-duo Narine & Varun, Rinku Singh. Purse Left: ₹63.0 Cr',
  },
  'RR': {
    name: 'Rajasthan Royals',
    retainedPlayerIds: ['a4cc73aa', '6c19c6e5', '04a418e8', 'bcf325d2', 'ce820073'], // Samson, Jaiswal, Parag, Jurel, Sandeep
    retentionSpendCr: 79.0,
    notes: 'Retained 6 players including Sandeep Sharma (Uncapped). Purse Left: ₹41.0 Cr',
  },
  'GT': {
    name: 'Gujarat Titans',
    retainedPlayerIds: ['5f547c8b', 'b4b99816', 'd5130a30', '39a2dfa8', '7dcb9bc9'], // Rashid, Gill, Sudharsan, Tewatia, Shahrukh
    retentionSpendCr: 51.0,
    notes: 'Retained Shubman Gill, Rashid Khan, Sai Sudharsan. Purse Left: ₹69.0 Cr',
  },
  'DC': {
    name: 'Delhi Capitals',
    retainedPlayerIds: ['2e171977', '8d2c70ad', '85b3fab2', 'ad3b6e95'], // Axar, Kuldeep, Stubbs, Porel
    retentionSpendCr: 43.75,
    notes: 'Retained Axar Patel, Kuldeep Yadav, Tristan Stubbs. Purse Left: ₹76.25 Cr',
  },
  'LSG': {
    name: 'Lucknow Super Giants',
    retainedPlayerIds: ['3241e3fd', 'b1ad996b', '872b03f7', 'c33d8116'], // Pooran, Mayank Yadav, Badoni, Mohsin
    retentionSpendCr: 48.0,
    notes: 'Retained Nicholas Pooran & express pacer Mayank Yadav. Purse Left: ₹72.0 Cr',
  },
};

router.get('/pool', async (req, res, next) => {
  try {
    const seasonQuery = req.query.season ? Number(req.query.season) : 2026;

    // Fetch league baseline for this season
    const seasonDoc = await Season.findOne({ Season: seasonQuery }).lean();
    const leagueSpendCr = seasonDoc?.LeagueSpendCr || seasonDoc?.AuctionSpendCr || 215.45;
    const leaguePricedImpact = seasonDoc?.LeaguePricedImpact || 48000;

    // Fetch all players for that season (both Auction and Retained/Unpriced)
    const allSeasonPlayers = await PlayerSeason.find({
      Season: seasonQuery,
    })
      .select({
        PlayerSeasonKey: 1,
        PlayerID: 1,
        PlayerName: 1,
        Season: 1,
        TeamKey: 1,
        Role: 1,
        Nationality: 1,
        Matches: 1,
        Runs: 1,
        Wickets: 1,
        ImpactPoints: 1,
        PriceSource: 1,
        PriceCr: 1,
        ValueIndex: 1,
        ValueQuadrant: 1,
        OverpayCr: 1,
      })
      .sort({ ImpactPoints: -1 })
      .lean();

    const auctionPool = [];
    const retainedPool = [];

    for (const p of allSeasonPlayers) {
      const isAuction = p.PriceSource === 'Auction' && p.PriceCr > 0;
      const isUncapped = UNCAPPED_NAMES.has(p.PlayerName);

      const formatted = {
        id: p.PlayerID || p.PlayerSeasonKey,
        playerKey: p.PlayerSeasonKey,
        name: p.PlayerName,
        role: p.Role || 'Batter',
        nationality: p.Nationality || (p.TeamKey === 'Overseas' ? 'Overseas' : 'Indian'),
        team: p.TeamKey || '—',
        isRetained: !isAuction,
        retentionType: !isAuction ? (isUncapped ? 'Uncapped' : 'Capped') : null,
        // For auction buys, priceCr is fixed; for retained, base retention price
        priceCr: isAuction ? p.PriceCr : (isUncapped ? 4.0 : 18.0),
        impactPoints: p.ImpactPoints || 0,
        valueIndex: p.ValueIndex ?? null,
        matches: p.Matches || 0,
        runs: p.Runs || 0,
        wickets: p.Wickets || 0,
        quadrant: p.ValueQuadrant || 'Unclassified',
      };

      if (isAuction) {
        auctionPool.push(formatted);
      } else {
        retainedPool.push(formatted);
      }
    }

    res.json({
      season: seasonQuery,
      leagueSpendCr,
      leaguePricedImpact,
      totalAuction: auctionPool.length,
      totalRetained: retainedPool.length,
      totalPlayers: auctionPool.length + retainedPool.length,
      auctionPool,
      retainedPool,
      allPlayers: [...retainedPool, ...auctionPool],
      franchiseTemplates: FRANCHISE_TEMPLATES,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
