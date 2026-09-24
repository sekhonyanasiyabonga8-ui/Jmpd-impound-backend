const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL Connection Settings optimized for Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 10000, // Timeout after 10 seconds if connection fails
  idleTimeoutMillis: 30000 // Close idle clients after 30 seconds
});

// Handle unexpected errors on idle clients
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

// Root homepage route
app.get('/', (req, res) => {
  res.send('JMPD Impound API is live and running!');
});

// GET: Fetch all registered vehicles with live logs
app.get('/api/vehicles', async (req, res) => {
  console.log("Received request for /api/vehicles");
  try {
    console.log("Attempting database query...");
    const result = await pool.query('SELECT plate, vin, make_model, engine_no, jmpd_ref, owner_phone, ref_code FROM impound_registry');
    console.log("Query successful, rows found:", result.rows.length);
    res.json(result.rows);
  } catch (err) {
    console.error("Database Error Caught:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Register a new impounded vehicle
app.post('/api/vehicles', async (req, res) => {
  const { plate, vin, makeModel, engineNo, jmpdRef, ownerPhone, refCode } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO impound_registry
      (plate, vin, make_model, engine_no, jmpd_ref, owner_phone, ref_code)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [plate, vin, makeModel, engineNo, jmpdRef, ownerPhone, refCode]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Insert Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// PUT: Update vehicle status (Passed / Released)
app.put('/api/vehicles/:plate/status', async (req, res) => {
  const { plate } = req.params;
  const { status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE impound_registry SET status = $1 WHERE plate = $2 RETURNING *`,
      [status, plate]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update Error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`VTS API Server running on port ${PORT}`);
});
