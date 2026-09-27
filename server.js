const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false // Strictly required for secure cloud communication with Neon
  }
});

// Base endpoint to verify the service is running
app.get('/', (req, res) => {
  res.send('API is live');
});

// GET: Fetch all active vehicles from registry
app.get('/api/vehicles', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT plate, vin, make_model, engine_no, jmpd_ref, owner_phone, ref_code, status FROM impound_registry ORDER BY id DESC');
    client.release();
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Register a new vehicle intake
app.post('/api/vehicles', async (req, res) => {
  const { plate, vin, make_model, engine_no, jmpd_ref, owner_phone, ref_code, status } = req.body;
  try {
    const client = await pool.connect();
    const queryText = `
      INSERT INTO impound_registry (plate, vin, make_model, engine_no, jmpd_ref, owner_phone, ref_code, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;
    `;
    const result = await client.query(queryText, [plate, vin, make_model, engine_no, jmpd_ref, owner_phone, ref_code, status || 'Impounded']);
    client.release();
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Insert Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// PUT: Update vehicle status (For Bay Audit and Checkout workflows)
app.put('/api/vehicles/:plate/status', async (req, res) => {
  const { plate } = req.params;
  const { status } = req.body;
  try {
    const client = await pool.connect();
    const result = await client.query(
      'UPDATE impound_registry SET status = \$1 WHERE plate = \$2 RETURNING *',
      [status, plate]
    );
    client.release();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Vehicle not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update Status Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Settle payment and process vehicle gate checkout records
app.post('/api/checkout', async (req, res) => {
  const { plate, testing_fee, storage_days, daily_rate, total_payable } = req.body;
  try {
    const client = await pool.connect();
    
    // 1. Log checkout entry details into history
    const logCheckoutQuery = `
      INSERT INTO impound_checkouts (plate, testing_fee, storage_days, daily_rate, total_payable)
      VALUES ($1, $2, $3, $4, $5) RETURNING *;
    `;
    const checkoutResult = await client.query(logCheckoutQuery, [plate, testing_fee, storage_days, daily_rate, total_payable]);
    
    // 2. Set active status update on registry table to 'Released' automatically
    await client.query('UPDATE impound_registry SET status = \'Released\' WHERE plate = \$1', [plate]);
    
    client.release();
    res.status(201).json({ success: true, entry: checkoutResult.rows[0] });
  } catch (err) {
    console.error("Checkout Processing Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET: Calculate and aggregate live dashboard metrics from Neon database
app.get('/api/analytics', async (req, res) => {
  try {
    const client = await pool.connect();
    
    // Count different vehicle metrics based on statuses
    const intakeCountRes = await client.query('SELECT COUNT(*) FROM impound_registry');
    const impoundedCountRes = await client.query('SELECT COUNT(*) FROM impound_registry WHERE status = \'Impounded\'');
    const clearedCountRes = await client.query('SELECT COUNT(*) FROM impound_registry WHERE status LIKE \'%Passed%\'');
    const releasedCountRes = await client.query('SELECT COUNT(*) FROM impound_registry WHERE status = \'Released\'');
    
    // Sum financials safely using aggregation rules
    const financeSummaryRes = await client.query(`
      SELECT 
        COALESCE(SUM(testing_fee), 0) as total_testing,
        COALESCE(SUM(storage_days * daily_rate), 0) as total_storage,
        COALESCE(SUM(total_payable), 0) as grand_total
      FROM impound_checkouts
    `);
    
    client.release();

    const totalIntake = parseInt(intakeCountRes.rows[0].count) || 0;
    const currentlyImpounded = parseInt(impoundedCountRes.rows[0].count) || 0;
    const enatisCleared = parseInt(clearedCountRes.rows[0].count) || 0;
    const gateReleased = parseInt(releasedCountRes.rows[0].count) || 0;

    const finance = financeSummaryRes.rows[0];
    const totalTesting = parseFloat(finance.total_testing) || 0;
    const totalStorage = parseFloat(finance.total_storage) || 0;
    const grandTotal = parseFloat(finance.grand_total) || 0;
    const totalVat = grandTotal - (totalTesting + totalStorage); // Isolates the 15% VAT component

    res.json({
      yard: { totalIntake, currentlyImpounded, enatisCleared, gateReleased },
      finance: { totalTesting, totalStorage, totalVat, grandTotal }
    });
  } catch (err) {
    console.error("Analytics Pipeline Failure:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
