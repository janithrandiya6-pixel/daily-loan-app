const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Safe database execution helper
const executeQuery = async (sql, params = []) => {
  if (typeof db.queryDB === 'function') {
    return await db.queryDB(sql, params);
  } else if (typeof db.execute === 'function') {
    return await db.execute(sql, params);
  } else {
    throw new Error("Database query function not available");
  }
};

// 1. Get all payments or payments by loan_id
router.get('/', async (req, res) => {
  try {
    const { loan_id } = req.query;
    let sql = 'SELECT * FROM payments';
    let params = [];

    if (loan_id) {
      sql += ' WHERE loan_id = ?';
      params.push(loan_id);
    }

    sql += ' ORDER BY id DESC';
    const payments = await executeQuery(sql, params);
    return res.json(Array.isArray(payments) ? payments : []);
  } catch (err) {
    console.error("Get Payments Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// 2. Record a New Payment (Day Payment)
router.post('/', async (req, res) => {
  const { loan_id, day_number, amount_paid } = req.body;

  if (!loan_id || day_number === undefined || amount_paid === undefined) {
    return res.status(400).json({ error: "loan_id, day_number, and amount_paid are required" });
  }

  try {
    const loanIdVal = parseInt(loan_id, 10);
    const dayNumVal = parseInt(day_number, 10);
    const amountVal = parseFloat(amount_paid);

    // Check if a payment for this day already exists
    const existingPayments = await executeQuery(
      'SELECT * FROM payments WHERE loan_id = ? AND day_number = ?',
      [loanIdVal, dayNumVal]
    );

    const rows = Array.isArray(existingPayments) ? existingPayments : [];

    if (rows.length > 0) {
      // Update existing payment for the day
      const existing = rows[0];
      const newAmount = parseFloat(existing.amount_paid || 0) + amountVal;

      await executeQuery(
        'UPDATE payments SET amount_paid = ? WHERE id = ?',
        [newAmount, existing.id]
      );
    } else {
      // Insert new payment record
      const paymentDate = new Date().toISOString().split('T')[0];
      await executeQuery(
        'INSERT INTO payments (loan_id, day_number, amount_paid, payment_date) VALUES (?, ?, ?, ?)',
        [loanIdVal, dayNumVal, amountVal, paymentDate]
      );
    }

    return res.json({ success: true, message: "Payment recorded successfully" });
  } catch (err) {
    console.error("Schedule Error:", err); // Matches your terminal log catch
    return res.status(500).json({ error: err.message });
  }
});

// 3. Delete a Payment
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await executeQuery('DELETE FROM payments WHERE id = ?', [id]);
    return res.json({ success: true, message: "Payment deleted successfully" });
  } catch (err) {
    console.error("Delete Payment Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;