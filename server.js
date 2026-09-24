const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL Connection Settings using Render Environment Variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// GET: Fetch all registered vehicles with detailed error tracking
app.get('/api/vehicles', async (req, res) => {
  try {
    const result = await pool.query('SELECT plate, vin, make_model, engine_no, jmpd_ref, owner_phone, ref_code FROM impound_registry');
    res.json(result.rows);
  } catch (err) {
    console.error("Database Error:", err);
    res.status(500).json({ error: err.message || "Unknown database error", details: err.detail || err.code });
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
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`VTS API Server running on port ${PORT}`);
});
