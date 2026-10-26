# Deployment Guide — IPL Auction Value Intelligence

This guide walks through deploying the **IPL Auction Valuation & Player Performance Intelligence** MERN application to production.

---

## 🏗️ Architecture Overview

| Component | Technology | Recommended Host | Free Tier Available? |
| :--- | :--- | :--- | :---: |
| **Database** | MongoDB (8 collections, 7,139 docs) | [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) | ✅ Yes (M0 Sandbox, 512 MB) |
| **Backend API** | Node.js + Express + Mongoose | Vercel serverless function (Option 1), or [Render](https://render.com) / [Railway](https://railway.app) | ✅ Yes |
| **Frontend Web** | React + Vite + Recharts | [Vercel](https://vercel.com) or [Netlify](https://netlify.com) | ✅ Yes |

---

## ⭐ Option 1: Everything on Vercel (recommended, free, one link)

One Vercel project serves the React site **and** the Express API: the API runs as a serverless function at `/api`, from the same code as local dev. You only need **MongoDB Atlas** + **Vercel**; no Render, no `VITE_API_URL`.

How it is wired (already in the repo):

| File | Role |
| :--- | :--- |
| `web/vercel.json` | Install + build commands, output folder `client/dist`, rewrites `/api/*` → the function and every other path → `index.html` |
| `web/package.json` | API dependencies for the function (keep in sync with `web/server/package.json`) |
| `web/api/index.js` | Serverless entry: exports the Express app from `web/server/src/app.js` |
| `web/server/src/db.js` | Cached MongoDB connection, reused across function calls |

### Step 1: MongoDB Atlas (database)
1. Create a free **M0** cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) (region e.g. Mumbai `ap-south-1`).
2. **Database Access** → add a user (e.g. `ipl_admin` + password).
3. **Network Access** → add `0.0.0.0/0` (Vercel functions have no fixed IP).
4. **Connect → Drivers** → copy the connection string and put the database name `ipl_auction` before the `?`:
   ```text
   mongodb+srv://ipl_admin:<password>@cluster0.xxxxx.mongodb.net/ipl_auction?retryWrites=true&w=majority
   ```
   If the password has special characters (`@ : / ? #`), URL-encode them.
5. **Seed it once** from your laptop (loads the 7,139 records from `data/processed/`):
   ```powershell
   cd web/server
   npm install
   $env:MONGODB_URI="mongodb+srv://ipl_admin:<password>@cluster0.xxxxx.mongodb.net/ipl_auction?retryWrites=true&w=majority"
   node scripts/seed.js
   ```
   (Git Bash / macOS: `MONGODB_URI="mongodb+srv://..." node scripts/seed.js`.) Expect `✅ PASS` for 2026: 77 buys, ₹215.45 Cr.

### Step 2: Vercel (site + API)
1. [vercel.com](https://vercel.com) → **Add New… → Project** → import `nabrahma/BDM_Project`.
2. **Root Directory** → click *Edit* → choose **`web`**. Leave Framework Preset as *Other*; build settings come from `web/vercel.json` (don't override them).
3. **Environment Variables** → add `MONGODB_URI` = the Atlas string from Step 1 (for Production and Preview). Do **not** set `VITE_API_URL`: the site calls `/api` on its own domain.
4. **Deploy**. When it finishes, open:
   - `https://<project>.vercel.app/api/health` → `"db":"connected"`, `"totalDocs":7139`
   - `https://<project>.vercel.app/` → the dashboard; try `/value-map`, `/steals`, `/squad-builder`.

Every push to `main` redeploys automatically. If `/api/health` says `disconnected`, re-check the `MONGODB_URI` value and Atlas Network Access, then **Redeploy**.

---

## 🚀 Option 2: Render API + Vercel frontend (two services)

### Step 1: Deploy MongoDB on MongoDB Atlas
1. Create a free account at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Create a new **M0 Free Tier Cluster** (choose AWS or GCP in your closest region, e.g., Mumbai `ap-south-1`).
3. Under **Security → Database Access**, create a database user:
   - Username: `ipl_admin`
   - Password: `<choose-a-strong-password>`
4. Under **Security → Network Access**, add IP address `0.0.0.0/0` (allow access from anywhere) so cloud servers can connect.
5. In **Database → Clusters**, click **Connect** → **Drivers (Node.js)** to copy your connection string:
   ```text
   mongodb+srv://ipl_admin:<password>@cluster0.abcde.mongodb.net/ipl_auction?retryWrites=true&w=majority
   ```
6. **Seed the database** with the 7,139 processed records:
   From your local terminal, run:
   ```bash
   cd web/server
   MONGODB_URI="mongodb+srv://ipl_admin:<password>@cluster0.abcde.mongodb.net/ipl_auction?retryWrites=true&w=majority" node scripts/seed.js
   ```
   *Expected output: All 8 collections seeded successfully with 7,139 documents.*

---

### Step 2: Deploy Backend API to Render.com
1. Push your repository to GitHub.
2. Sign up / log in to [Render.com](https://render.com) and click **New + → Web Service**.
3. Connect your GitHub repository.
4. Configure the service:
   - **Name**: `ipl-auction-api`
   - **Root Directory**: `web/server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Under **Environment Variables**, add:
   - `MONGODB_URI`: Your MongoDB Atlas connection string from Step 1.
   - `PORT`: `5000` (or leave default, Render sets `PORT` automatically).
   - `NODE_ENV`: `production`
6. Click **Deploy Web Service**.
7. Test the health endpoint once deployed:
   `https://ipl-auction-api.onrender.com/api/health`
   Should return: `{"status":"ok","db":"connected","totalDocs":7139}`.

---

### Step 3: Deploy Frontend to Vercel
1. Sign up / log in to [Vercel.com](https://vercel.com) and click **Add New… → Project**.
2. Import your GitHub repository.
3. Configure the project:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click edit and select `web/client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Under **Environment Variables**, add:
   - `VITE_API_URL`: `https://ipl-auction-api.onrender.com/api` (your Render backend URL with `/api`).
5. Click **Deploy**.
6. Your live web application will be accessible at `https://your-project.vercel.app`!

---

## 🐳 Option 3: Unified Docker / Single Server Deployment

If deploying to a single Linux VPS (DigitalOcean, AWS EC2, GCP Compute Engine):

### Docker Compose Configuration (`docker-compose.prod.yml`)
```yaml
version: '3.8'

services:
  mongo:
    image: mongo:latest
    restart: always
    volumes:
      - mongo-data:/data/db
    ports:
      - "27017:27017"

  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: always
    ports:
      - "80:5000"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/ipl_auction
      - PORT=5000
      - NODE_ENV=production
      - SERVE_STATIC=true
    depends_on:
      - mongo

volumes:
  mongo-data:
```

---

## 🔐 Environment Variables Reference

### Backend (`web/server/.env`)
| Variable | Description | Example |
| :--- | :--- | :--- |
| `MONGODB_URI` | MongoDB connection URI | `mongodb+srv://user:pass@cluster0.mongodb.net/ipl_auction` |
| `PORT` | HTTP port to listen on | `5000` |
| `SERVE_STATIC` | Serve Vite `dist/` bundle via Express | `true` (optional) |
| `NODE_ENV` | Runtime environment | `production` |

### Frontend (`web/client/.env`)
| Variable | Description | Example |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base URL of backend API | `https://ipl-auction-api.onrender.com/api` |

---

## 🧪 Post-Deployment Verification Checklist

1. **Health Check**: Open `https://<backend>/api/health` → Verify `db: "connected"` and `totalDocs: 7139`.
2. **Database Inspector**: Click the **`🟢 MongoDB (7,139 Docs)`** button in the navbar of the live frontend to confirm real-time collection counts.
3. **Core Pages**: Check `/market`, `/value-map`, `/steals`, `/players`, and `/squad-builder`.
4. **Squad Builder**: Test drafting players and verifying remaining purse and Playing XI rating calculation.
