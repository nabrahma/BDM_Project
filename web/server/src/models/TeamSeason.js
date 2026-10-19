import mongoose from 'mongoose';

const teamSeasonSchema = new mongoose.Schema({
  TeamSeasonKey:   { type: String, required: true, unique: true },
  TeamSeasonLabel: String,
  TeamKey:         { type: String, index: true },
  Season:          { type: Number, index: true },
  TeamColour:      String,
  Played:          Number,
  Results:         Number,
  Wins:            Number,
  WinPct:          Number,
  SpendCr:         Number,
  PricedPlayers:   Number,
  ImpactPoints:    Number,
  PricedImpact:    Number,
  FairValueCr:     Number,
  OverpayCr:       Number,
  ValueIndex:      Number,
}, { collection: 'team_seasons' });

export default mongoose.model('TeamSeason', teamSeasonSchema);
