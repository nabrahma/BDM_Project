import mongoose from 'mongoose';

const seasonSchema = new mongoose.Schema({
  Season:                  { type: Number, required: true, unique: true },
  SeasonLabel:             String,
  IsMegaAuction:           Boolean,
  AuctionType:             String,
  Matches:                 Number,
  PlayersBought:           Number,
  AuctionSpendCr:          Number,
  AvgPriceCr:              Number,
  MedianPriceCr:           Number,
  TopBuyPlayer:            String,
  TopBuyPriceCr:           Number,
  TopRunScorer:            String,
  TopRunScorerRuns:        Number,
  TopWicketTaker:          String,
  TopWicketTakerWickets:   Number,
  LeagueSpendCr:           Number,
  LeaguePricedImpact:      Number,
  LakhPerPoint:            Number,
  LeagueValueIndex:        Number,
}, { collection: 'seasons' });

export default mongoose.model('Season', seasonSchema);
