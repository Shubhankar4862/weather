require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Pool } = require('pg');
// const serverless = require('serverless-http');

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
  connectionString: process.env.DB_CONNECTION_STRING,
  ssl: {
    rejectUnauthorized: true,
    ca: process.env.DB_CA_CERT || undefined,
  },
});

let dbInitialized = false;
async function initDB() {
  if (dbInitialized) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    zip VARCHAR(20),
    lat FLOAT,
    lon FLOAT
  )`);
  dbInitialized = true;
}

const API_KEY = process.env.OPEN_WEATHER_API_KEY;
function buildForecastUrl({ zip, lat, lon }) {
  if (lat && lon) {
    return `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
  }
  if (zip) {
    const zipCode = zip.includes(',') ? zip : `${zip},us`;
    return `https://api.openweathermap.org/data/2.5/forecast?zip=${zipCode}&appid=${API_KEY}&units=metric`;
  }
  throw new Error('Invalid location');
}

// ========== ROUTES ==========

// Hello test route
app.get('/api/hello', (req, res) => res.json({ msg: 'Hi from serverless Express!' }));

// 1. Create user
// GET /api/user/create/:username
app.get('/api/user/create/:username', async (req, res) => {
  const { username } = req.params;
  try {
    await initDB();
    await pool.query(
      `INSERT INTO users (username) VALUES ($1) ON CONFLICT (username) DO NOTHING`,
      [username]
    );
    res.json({ message: 'user created or exists' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// 2. List locations
// GET /api/location/list/:username
app.get('/api/location/list/:username', async (req, res) => {
  const { username } = req.params;
  try {
    await initDB();
    const user = await pool.query(`SELECT id FROM users WHERE username=$1`, [username]);
    if (!user.rows.length) return res.status(404).json({ error: 'user not found' });

    const locs = await pool.query(`SELECT * FROM locations WHERE user_id=$1`, [user.rows[0].id]);
    res.json(locs.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// 3. Add location by ZIP
// GET /api/location/add/:username/zip/:zip
app.get('/api/location/add/:username/zip/:zip', async (req, res) => {
  const { username, zip } = req.params;
  try {
    await initDB();
    const user = await pool.query(`SELECT id FROM users WHERE username=$1`, [username]);
    if (!user.rows.length) return res.status(404).json({ error: 'user not found' });

    const count = await pool.query(`SELECT COUNT(*) FROM locations WHERE user_id=$1`, [user.rows[0].id]);
    if (parseInt(count.rows[0].count) >= 5)
      return res.status(400).json({ error: 'max 5 locations' });

    await pool.query(
      `INSERT INTO locations (user_id, zip) VALUES ($1, $2)`,
      [user.rows[0].id, zip]
    );
    res.json({ message: 'location added' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// 4. Add location by lat/lon
// GET /api/location/add/:username/lat/:lat/lon/:lon
app.get('/api/location/add/:username/lat/:lat/lon/:lon', async (req, res) => {
  const { username, lat, lon } = req.params;
  try {
    await initDB();
    const user = await pool.query(`SELECT id FROM users WHERE username=$1`, [username]);
    if (!user.rows.length) return res.status(404).json({ error: 'user not found' });

    const count = await pool.query(`SELECT COUNT(*) FROM locations WHERE user_id=$1`, [user.rows[0].id]);
    if (parseInt(count.rows[0].count) >= 5)
      return res.status(400).json({ error: 'max 5 locations' });

    await pool.query(
      `INSERT INTO locations (user_id, lat, lon) VALUES ($1, $2, $3)`,
      [user.rows[0].id, lat, lon]
    );
    res.json({ message: 'location added' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// 5. Update location by ID with ZIP
// GET /api/location/update/:id/zip/:zip
app.get('/api/location/update/:id/zip/:zip', async (req, res) => {
  const { id, zip } = req.params;
  try {
    await initDB();
    await pool.query(
      `UPDATE locations SET zip=$1, lat=NULL, lon=NULL WHERE id=$2`,
      [zip, id]
    );
    res.json({ message: 'location updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// 6. Update location by ID with lat/lon
// GET /api/location/update/:id/lat/:lat/lon/:lon
app.get('/api/location/update/:id/lat/:lat/lon/:lon', async (req, res) => {
  const { id, lat, lon } = req.params;
  try {
    await initDB();
    await pool.query(
      `UPDATE locations SET lat=$1, lon=$2, zip=NULL WHERE id=$3`,
      [lat, lon, id]
    );
    res.json({ message: 'location updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// 7. Delete location
// GET /api/location/delete/:id
app.get('/api/location/delete/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await initDB();
    await pool.query(`DELETE FROM locations WHERE id=$1`, [id]);
    res.json({ message: 'location deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// 8. Get weather
// GET /api/weather/:username
app.get('/api/weather/:username', async (req, res) => {
  const { username } = req.params;
  try {
    await initDB();
    const user = await pool.query(`SELECT id FROM users WHERE username=$1`, [username]);
    if (!user.rows.length) return res.status(404).json({ error: 'user not found' });

    const locs = await pool.query(`SELECT zip, lat, lon FROM locations WHERE user_id=$1`, [user.rows[0].id]);
    const data = [];

    for (const loc of locs.rows) {
      try {
        const r = await axios.get(buildForecastUrl(loc));
        const cityName = r.data.city?.name || null;
        const country = r.data.city?.country || null;
        data.push({
          location: loc,
          place: `${cityName}${country ? ', ' + country : ''}`,
          forecast: r.data,
        });
      } catch (err) {
        data.push({ location: loc, error: err.message });
      }
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// Export for serverless
// module.exports = serverless(app);
