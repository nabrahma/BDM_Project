/**
 * db.js — One shared MongoDB connection.
 *
 * Serverless functions (Vercel) are re-invoked many times in the same container,
 * so the connection promise is cached on globalThis and reused instead of
 * opening a new connection per request.
 */
import mongoose from 'mongoose';

export function getMongoUri() {
  return process.env.MONGODB_URI || 'mongodb://localhost:27017/ipl_auction';
}

const cache = globalThis.__iplMongo || (globalThis.__iplMongo = { promise: null });

export async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!cache.promise) {
    cache.promise = mongoose
      .connect(getMongoUri(), { serverSelectionTimeoutMS: 10000 })
      .catch(err => {
        cache.promise = null; // allow a retry on the next request
        throw err;
      });
  }
  return cache.promise;
}
