const express = require('express')
const axios = require('axios')

const router = express.Router()
const { pool } = require('./db')
const { buildForecastUrl } = require('./weather')

router.post('/user', async (req, res) => {
  const { username } = req.body
  if (!username) return res.status(400).json({ error: 'username required' })
  await pool.query(`INSERT INTO users (username) VALUES ($1) ON CONFLICT (username) DO NOTHING`, [username])
  res.json({ message: 'user created or exists' })
})

router.get('/locations', async (req, res) => {
  const { username } = req.query
  if (!username) return res.status(400).json({ error: 'username required' })
  const u = await pool.query(`SELECT id FROM users WHERE username=$1`, [username])
  if (!u.rows.length) return res.status(404).json({ error: 'user not found' })
  const locs = await pool.query(`SELECT * FROM locations WHERE user_id=$1`, [u.rows[0].id])
  res.json(locs.rows)
})

router.post('/location', async (req, res) => {
  const { username, zip, lat, lon } = req.body
  if (!username) return res.status(400).json({ error: 'username required' })
  if (!zip && !(lat && lon)) return res.status(400).json({ error: 'Either zip or lat/lon required' })
  if (zip && (lat || lon)) return res.status(400).json({ error: 'Provide only zip or lat/lon, not both' })
  const u = await pool.query(`SELECT id FROM users WHERE username=$1`, [username])
  if (!u.rows.length) return res.status(404).json({ error: 'user not found' })
  const count = await pool.query(`SELECT COUNT(*) FROM locations WHERE user_id=$1`, [u.rows[0].id])
  if (parseInt(count.rows[0].count) >= 5) return res.status(400).json({ error: 'max 5 locations' })
  await pool.query(`INSERT INTO locations (user_id,zip,lat,lon) VALUES ($1,$2,$3,$4)`,
    [u.rows[0].id, zip || null, lat || null, lon || null])
  res.json({ message: 'location added' })
})

router.put('/location/:id', async (req, res) => {
  const { zip, lat, lon } = req.body
  if (!zip && !(lat && lon)) return res.status(400).json({ error: 'Either zip or lat/lon required' })
  if (zip && (lat || lon)) return res.status(400).json({ error: 'Provide only zip or lat/lon, not both' })
  await pool.query(`UPDATE locations SET zip=$1, lat=$2, lon=$3 WHERE id=$4`, [zip || null, lat || null, lon || null, req.params.id])
  res.json({ message: 'location updated' })
})

router.delete('/location/:id', async (req, res) => {
  await pool.query(`DELETE FROM locations WHERE id=$1`, [req.params.id])
  res.json({ message: 'location deleted' })
})

router.get('/weather', async (req, res) => {
  const { username } = req.query
  if (!username) return res.status(400).json({ error: 'username required' })
  const u = await pool.query(`SELECT id FROM users WHERE username=$1`, [username])
  if (!u.rows.length) return res.status(404).json({ error: 'user not found' })
  const locs = await pool.query(`SELECT zip, lat, lon FROM locations WHERE user_id=$1`, [u.rows[0].id])
  const data = []
  for (const loc of locs.rows) {
    try {
      const r = await axios.get(buildForecastUrl(loc))
      const cityName = r.data.city?.name || null
      const country = r.data.city?.country || null
      data.push({ location: loc, place: `${cityName}${country ? ', ' + country : ''}`, forecast: r.data })
    } catch (err) {
      data.push({ location: loc, error: err.message })
    }
  }
  res.json(data)
})

module.exports = router
