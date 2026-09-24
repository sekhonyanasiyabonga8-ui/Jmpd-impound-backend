const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

app.get('/', (req, res) => {
  res.send('JMPD Impound API is live and running!');
});

app.get('/api/vehicles', async (req, res) => {
  console.log("Received request for /api/vehicles");
  try {
    const result = await pool.query('SELECT plate, vin, make_model, engine_no, jmpd_ref, owner_phone, ref_code FROM impound_registry');
    res.json(result.rows);
  } catch (err) {
    console.error("Database Error Caught:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`VTS API Server running on port ${PORT}`);
});
