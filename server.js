// Endpoint to calculate live dashboard analytics metrics
app.get('/api/analytics', async (req, res) => {
  try {
    const client = await pool.connect();
    
    // 1. Gather Yard Registry Stats
    const totalIntakeRes = await client.query('SELECT COUNT(*) FROM impound_registry');
    const releasedRes = await client.query('SELECT COUNT(*) FROM impound_checkouts');
    
    // 2. Gather Financial Revenue Collections
    const financeRes = await client.query(`
      SELECT 
        COALESCE(SUM(testing_fee), 0) as total_testing,
        COALESCE(SUM(storage_days * daily_rate), 0) as total_storage,
        COALESCE(SUM(total_payable), 0) as grand_total
      FROM impound_checkouts
    `);
    
    client.release();

    const totalIntake = parseInt(totalIntakeRes.rows[0].count);
    const gateReleased = parseInt(releasedRes.rows[0].count);
    const currentlyImpounded = totalIntake - gateReleased; // Math check for active yard cars

    const finance = financeRes.rows[0];
    const totalTesting = parseFloat(finance.total_testing);
    const totalStorage = parseFloat(finance.total_storage);
    const grandTotal = parseFloat(finance.grand_total);
    const totalVat = grandTotal - (totalTesting + totalStorage); // Isolates 15% VAT collections

    res.json({
      yard: {
        totalIntake,
        currentlyImpounded,
        enatisCleared: gateReleased, // Placeholder or link to passing SANS audits
        gateReleased
      },
      finance: {
        totalTesting,
        totalStorage,
        totalVat,
        grandTotal
      }
    });
  } catch (err) {
    console.error("Analytics Calculation Error:", err);
    res.status(500).json({ error: err.message });
  }
});
