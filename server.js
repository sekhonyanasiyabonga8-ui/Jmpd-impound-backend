const express = require('express');
const { Pool } = require('pg');
const cors = require('cors'); //  FIXED: Corrected typo from 'cars' to 'cors'

const app = express();
app.use(cors());
app.use(express.json());

// Ensure the connection string forces SSL mode for Render external Postgres
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false // Required for secure cloud communication with Neon
  }
});

// Base endpoint to verify the service is running
app.get('/', (req, res) => {
  res.send('API is live');
});

// Endpoint to test connection stability between Render and Neon
app.get('/api/test-db', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    res.json({ status: 'connected', time: result.rows[0].now });
  } catch (err) {
    console.error("Database Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to fetch your JMPD impound registry data
app.get('/api/vehicles', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT plate, vin, make_model, engine_no, jmpd_ref, owner_phone, ref_code FROM impound_registry');
    client.release();
    res.json(result.rows);
  } catch (err) {
    console.error("Database Error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
