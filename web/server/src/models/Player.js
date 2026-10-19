import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema({
  PlayerID:            { type: String, required: true, unique: true, index: true },
  PlayerName:          String,
  CricsheetName:       String,
  Role:                String,
  RoleSource:          String,
  Nationality:         String,
  LatestTeamKey:       String,
  FirstSeason:         Number,
  LastSeason:          Number,
  HasCricsheetID:      Boolean,
  EverAuctioned:       Boolean,
  SeasonsPlayed:       Number,
  CareerMatches:       Number,
  CareerRuns:          Number,
  CareerWickets:       Number,
  CareerCatches:       Number,
  CareerImpactPoints:  Number,
  AuctionBuys:         Number,
  TotalAuctionSpendCr: Number,
  CareerSpendCr:       Number,
  CareerFairValueCr:   Number,
  CareerOverpayCr:     Number,
  CareerValueIndex:    Number,
}, { collection: 'players' });

playerSchema.index({ PlayerName: 'text' });

export default mongoose.model('Player', playerSchema);
