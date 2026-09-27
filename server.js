const express = require('express');
const { Pool } = require('pg');
const cors = require('cors'); //  Fixed typo from 'cars' to 'cors'

const app = express();
app.use(cors());
app.use(express.json());

const connectionString = process.env.DATABASE_URL;

//  Dynamic SSL config: Required for cloud Neon/Render, disabled for local offline testing
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

app.get('/', (req, res) => {
  res.send('API is live');
});

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
