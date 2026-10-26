/**
 * index.js — Start the API as a normal long-running server (local dev, Render, VPS).
 * On Vercel this file is not used; see ../../api/index.js.
 */
import app from './app.js';
import { connectDB } from './db.js';

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    console.log('🏏 Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`🚀 API server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
