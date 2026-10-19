import mongoose from 'mongoose';

const unsoldPlayerSchema = new mongoose.Schema({
  Season:        Number,
  Player:        String,
  BasePriceCr:   Number,
  CareerMatches: Number,
  CareerImpact:  Number,
  LastIplSeason: Number,
}, { collection: 'unsold_players' });

export default mongoose.model('UnsoldPlayer', unsoldPlayerSchema);
