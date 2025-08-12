require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { initDB } = require('./db')
const routes = require('./routes')

const app = express()

app.use(express.json())
app.use(cors())
app.use('/', routes)

initDB().catch(err => {
  console.error('DB init error:', err)
  process.exit(1)
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`running on ${PORT}`))
