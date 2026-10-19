import mongoose from 'mongoose';

const playerSeasonSchema = new mongoose.Schema({
  PlayerSeasonKey:     { type: String, required: true, unique: true },
  PlayerID:            { type: String, index: true },
  PlayerName:          String,
  Season:              { type: Number, index: true },
  TeamKey:             { type: String, index: true },
  TeamSeasonKey:       String,
  Role:                String,
  Nationality:         String,
  Matches:             Number,
  Runs:                Number,
  BallsFaced:          Number,
  Fours:               Number,
  Sixes:               Number,
  Outs:                Number,
  Wickets:             Number,
  LegalBalls:          Number,
  RunsConceded:        Number,
  DotBalls:            Number,
  Catches:             Number,
  Stumpings:           Number,
  RunOuts:             Number,
  ImpactPoints:        Number,
  PriceSource:         String,
  AuctionSeason:       Number,
  PriceCr:             Number,
  BasePriceCr:         Number,
  PriceBracket:        String,
  PriceBracketOrder:   Number,
  SeasonMedianPriceCr: Number,
  SeasonMedianImpact:  Number,
  ValueQuadrant:       String,
  FairValueCr:         Number,
  OverpayCr:           Number,
  ValueIndex:          Number,
}, { collection: 'player_seasons' });

// Compound index for team-season lookups
playerSeasonSchema.index({ TeamKey: 1, Season: 1 });

export default mongoose.model('PlayerSeason', playerSeasonSchema);
