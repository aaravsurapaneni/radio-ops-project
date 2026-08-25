// Radio Ops / Emergency Supply Dashboard — backend server
//
// Purpose: replace the dashboard's browser-only localStorage with a real,
// shared database so multiple people (SOC, DC employees) see the same
// live data instead of each getting their own private copy.
//
// Run locally:
//   npm install
//   npm start
// Server listens on http://localhost:3001 by default (set PORT to change).

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, 'data.json');

// Access key: only requests that include this exact key are allowed through.
// The URL itself is still technically public (anyone with the link can reach
// it), but without this key, every real request gets rejected — so simply
// knowing or guessing the URL isn't enough to read or change any data.
const API_KEY = process.env.API_KEY || null;

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Health check stays open with no key required — it only confirms the server
// is running, it doesn't expose any real data, so there's nothing to protect here.
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

// Everything below this line requires the correct key.
app.use('/api', (req, res, next) => {
  if (!API_KEY) {
    return res.status(500).json({ error: 'Server is missing its API_KEY configuration.' });
  }
  const provided = req.header('X-API-Key');
  if (provided !== API_KEY) {
    return res.status(401).json({ error: 'Missing or incorrect API key.' });
  }
  next();
});

function readStore() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    console.error('Failed to read data file:', err);
    return null;
  }
}

function writeStore(record) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(record), 'utf8');
}

app.get('/api/state', (req, res) => {
  try {
    const record = readStore();
    if (!record) {
      return res.json({ state: null, updatedAt: null });
    }
    res.json({ state: record.data, updatedAt: record.updatedAt });
  } catch (err) {
    console.error('GET /api/state failed:', err);
    res.status(500).json({ error: 'Failed to read state' });
  }
});

app.put('/api/state', (req, res) => {
  try {
    const state = req.body;
    if (!state || typeof state !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }
    const now = Date.now();
    writeStore({ data: state, updatedAt: now });
    res.json({ ok: true, updatedAt: now });
  } catch (err) {
    console.error('PUT /api/state failed:', err);
    res.status(500).json({ error: 'Failed to save state' });
  }
});

app.listen(PORT, () => {
  console.log(`Radio Ops backend listening on http://localhost:${PORT}`);
  console.log(`Data file: ${DATA_PATH}`);
});
