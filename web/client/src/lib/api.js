/**
 * api.js — Central API URL configuration.
 * In development, defaults to local Express server on http://localhost:5000/api.
 * In production, uses VITE_API_URL environment variable if set, or relative '/api'.
 */
export const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');
