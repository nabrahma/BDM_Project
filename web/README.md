# IPL Auction Value Intelligence — MERN Web Application

Interactive MERN stack application for **IPL Auction Valuation & Player Performance Intelligence** (BDM Semester 7). Built with MongoDB, Express.js, React (Vite), and Node.js to mirror the Power BI dashboard aesthetics and deliver interactive features such as the **Salary Cap Simulator & Squad Builder**.

---

## 📁 Architecture

```text
web/
├── client/                      # React + Vite frontend
│   ├── src/
│   │   ├── pages/               # 10 Dashboard Pages (Home, Market, Franchises, Value Map,
│   │   │                        # Steals, Roles, Brackets, Players, Squad Builder, Methodology)
│   │   ├── components/          # Reusable UI (NavBar with MongoDB Inspector, KPI cards, etc.)
│   │   ├── lib/                 # formatters, IPL rules, Squad Builder optimizer & knapsack math
│   │   └── hooks/               # useApi data fetcher
│   └── package.json
│
└── server/                      # Express + Node.js + MongoDB API
    ├── src/
    │   ├── models/              # Mongoose schemas for 8 MongoDB collections
    │   ├── routes/              # 8 REST API route handlers
    │   └── app.js               # Server entry point, health monitor, static serving
    ├── scripts/
    │   ├── seed.js              # Idempotent database seeder (7,139 JSON docs)
    │   └── test_*.js            # QA and endpoint validation test suites
    └── package.json
```

---

## ⚡ Quick Start (Local Development)

### 1. MongoDB Database
Ensure MongoDB is running locally (port 27017) or via Docker:
```bash
docker run -d --name ipl-mongo -p 27017:27017 mongo:latest
```

Seed the database with all 7,139 processed documents:
```bash
cd web/server
node scripts/seed.js
```

### 2. Start Backend API
```bash
cd web/server
npm install
npm run dev
# Running on http://localhost:5000
```

### 3. Start Frontend Client
```bash
cd web/client
npm install
npm run dev
# Running on http://localhost:5173
```

---

## 🚀 Deployment

For production deployment instructions to MongoDB Atlas, Render, and Vercel, please see **[../DEPLOYMENT.md](../DEPLOYMENT.md)**.
