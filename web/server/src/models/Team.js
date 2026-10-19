import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema({
  TeamKey:    { type: String, required: true, unique: true },
  TeamName:   String,
  ShortCode:  String,
  TeamColour: String,
  IsActive:   Boolean,
}, { collection: 'teams' });

export default mongoose.model('Team', teamSchema);
