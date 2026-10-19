import mongoose from 'mongoose';

const auctionBuySchema = new mongoose.Schema({
  AuctionKey:        { type: String, required: true, unique: true },
  PlayerID:          { type: String, index: true },
  TeamKey:           String,
  Season:            { type: Number, index: true },
  AuctionName:       String,
  AuctionRole:       String,
  Capped:            String,
  BasePriceCr:       Number,
  PriceCr:           Number,
  PriceBracket:      String,
  PriceBracketOrder: Number,
  MatchPass:         String,
  IsMatched:         Boolean,
  PlayerName:        String,
}, { collection: 'auction_buys' });

export default mongoose.model('AuctionBuy', auctionBuySchema);
