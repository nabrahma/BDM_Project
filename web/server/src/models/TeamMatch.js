import mongoose from 'mongoose';

const teamMatchSchema = new mongoose.Schema({
  TeamMatchKey: { type: String, required: true, unique: true },
  MatchID:      String,
  MatchDate:    String,
  Venue:        String,
  TeamKey:      String,
  Season:       Number,
  Won:          Number,
  NoResult:     Number,
}, { collection: 'team_matches' });

export default mongoose.model('TeamMatch', teamMatchSchema);
