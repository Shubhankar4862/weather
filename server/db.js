const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DB_CONNECTION_STRING,
  ssl: {
    rejectUnauthorized: true,
    ca: process.env.DB_CA_CERT || undefined
  }
})

async function initDB() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username VARCHAR(100) UNIQUE NOT NULL)`)
  await pool.query(`CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    zip VARCHAR(20),
    lat FLOAT,
    lon FLOAT
  )`)
}

module.exports = { pool, initDB }
