require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Pool } = require('pg');
const serverless = require('serverless-http');

const app = express();

app.use(express.json());
app.use(cors());

// Database setup
const pool = new Pool({
  connectionString: process.env.DB_CONNECTION_STRING,
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: true,
    ca: process.env.DB_CA_CERT || undefined,
  } : false,
});

// Initialize DB schema
async function initDB() {
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
}

// Utility to build OpenWeatherMap forecast URL
const API_KEY = process.env.OPEN_WEATHER_API_KEY;
function buildForecastUrl({ zip, lat, lon }) {
  if (lat && lon) {
    return `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
  }
  if (zip) {
    // If zip does not include country, default to US
    const zipCode = zip.includes(',') ? zip : `${zip},us`;
    return `https://api.openweathermap.org/data/2.5/forecast?zip=${zipCode}&appid=${API_KEY}&units=metric`;
  }
  throw new Error('Invalid location');
}

// ROUTES

// Create user (POST JSON { username })
app.post('/user', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });

  try {
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

// Get all locations for a user (GET with query ?username=)
app.get('/locations', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'username required' });

  try {
    const userRes = await pool.query(`SELECT id FROM users WHERE username=$1`, [username]);
    if (!userRes.rows.length) return res.status(404).json({ error: 'user not found' });

    const locRes = await pool.query(`SELECT * FROM locations WHERE user_id=$1`, [userRes.rows[0].id]);
    res.json(locRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// Add location (POST JSON { username, zip OR lat, lon })
app.post('/location', async (req, res) => {
  const { username, zip, lat, lon } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });
  if (!zip && !(lat && lon)) return res.status(400).json({ error: 'Either zip or lat/lon required' });
  if (zip && (lat || lon)) return res.status(400).json({ error: 'Provide only zip or lat/lon, not both' });

  try {
    const userRes = await pool.query(`SELECT id FROM users WHERE username=$1`, [username]);
    if (!userRes.rows.length) return res.status(404).json({ error: 'user not found' });

    const countRes = await pool.query(`SELECT COUNT(*) FROM locations WHERE user_id=$1`, [userRes.rows[0].id]);
    if (parseInt(countRes.rows[0].count) >= 5) return res.status(400).json({ error: 'max 5 locations' });

    await pool.query(
      `INSERT INTO locations (user_id, zip, lat, lon) VALUES ($1, $2, $3, $4)`,
      [userRes.rows[0].id, zip || null, lat || null, lon || null]
    );
    res.json({ message: 'location added' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// Update location (PUT JSON { zip OR lat, lon })
app.put('/location/:id', async (req, res) => {
  const { zip, lat, lon } = req.body;
  if (!zip && !(lat && lon)) return res.status(400).json({ error: 'Either zip or lat/lon required' });
  if (zip && (lat || lon)) return res.status(400).json({ error: 'Provide only zip or lat/lon, not both' });

  try {
    await pool.query(
      `UPDATE locations SET zip=$1, lat=$2, lon=$3 WHERE id=$4`,
      [zip || null, lat || null, lon || null, req.params.id]
    );
    res.json({ message: 'location updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// Delete location
app.delete('/location/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM locations WHERE id=$1`, [req.params.id]);
    res.json({ message: 'location deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// Get weather forecast for all user locations (GET with ?username=)
app.get('/weather', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'username required' });

  try {
    const userRes = await pool.query(`SELECT id FROM users WHERE username=$1`, [username]);
    if (!userRes.rows.length) return res.status(404).json({ error: 'user not found' });

    const locRes = await pool.query(`SELECT zip, lat, lon FROM locations WHERE user_id=$1`, [userRes.rows[0].id]);

    const data = [];
    for (const loc of locRes.rows) {
      try {
        const response = await axios.get(buildForecastUrl(loc));
        const cityName = response.data.city?.name || null;
        const country = response.data.city?.country || null;
        data.push({
          location: loc,
          place: `${cityName}${country ? ', ' + country : ''}`,
          forecast: response.data,
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

// Initialize DB then listen (except for serverless)
(async () => {
  try {
    await initDB();
    if (!process.env.VERCEL && !process.env.LAMBDA_TASK_ROOT) {
      const PORT = process.env.PORT || 3001;
      app.listen(PORT, () => {
        console.log(`✅ Server running on port ${PORT}`);
      });
    }
  } catch (err) {
    console.error('DB init error:', err);
    process.exit(1);
  }
})();

module.exports = app;
