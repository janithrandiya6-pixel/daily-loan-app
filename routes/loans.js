const express = require('express');
const router = express.Router();
const db = require('../config/db');

const executeQuery = async (sql, params = []) => {
  if (typeof db.queryDB === 'function') {
    return await db.queryDB(sql, params);
  } else if (typeof db.execute === 'function') {
    return await db.execute(sql, params);
  } else {
    throw new Error("Database query function not available");
  }
};

// 1. Get All Active Loans
router.get('/', async (req, res) => {
  try {
    const loans = await executeQuery('SELECT * FROM loans ORDER BY id DESC');
    const payments = await executeQuery('SELECT loan_id, SUM(amount_paid) as total_paid FROM payments GROUP BY loan_id');

    const paidMap = {};
    if (Array.isArray(payments)) {
      payments.forEach(p => {
        paidMap[p.loan_id] = parseFloat(p.total_paid || 0);
      });
    }

    const formattedLoans = (Array.isArray(loans) ? loans : []).map(loan => ({
      ...loan,
      paid_amount: paidMap[loan.id] || 0
    }));

    return res.json(formattedLoans);
  } catch (err) {
    console.error("Get Loans Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// 2. Get Single Loan Details with Payments & Strictly Calculated Schedule
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const loans = await executeQuery('SELECT * FROM loans WHERE id = ?', [id]);
    if (!loans || loans.length === 0) {
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loans[0];
    const payments = await executeQuery('SELECT * FROM payments WHERE loan_id = ? ORDER BY day_number ASC', [id]);

    const dayPaymentsMap = {};
    let totalPaid = 0;

    if (Array.isArray(payments)) {
      payments.forEach(p => {
        if (p.day_number !== undefined && p.day_number !== null) {
          const dNum = parseInt(p.day_number, 10);
          const amt = parseFloat(p.amount_paid || 0);
          dayPaymentsMap[dNum] = (dayPaymentsMap[dNum] || 0) + amt;
        }
        totalPaid += parseFloat(p.amount_paid || 0);
      });
    }

    const totalDays = parseInt(loan.days || 65, 10);
    const totalAmount = parseFloat(loan.amount || 0) + parseFloat(loan.interest || 0);
    const dailyInstallment = totalAmount / totalDays;

    const schedule = [];
    let paidDaysCount = 0;

    for (let i = 1; i <= totalDays; i++) {
      const amtPaid = dayPaymentsMap[i] || 0;
      let status = 'Pending';
      if (amtPaid >= (dailyInstallment - 0.05)) {
        status = 'Paid';
        paidDaysCount++;
      } else if (amtPaid > 0) {
        status = 'Partial';
      }

      schedule.push({
        dayNumber: i,
        amountPaid: amtPaid.toFixed(2),
        status: status
      });
    }

    return res.json({
      ...loan,
      paid_amount: totalPaid,
      paid_days: paidDaysCount,
      payments: payments || [],
      schedule: schedule
    });
  } catch (err) {
    console.error("Get Single Loan Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// 3. Create New Loan
router.post('/', async (req, res) => {
  const { name, nic, phone, guarantor_name, amount, interest, days, start_date } = req.body;

  if (!name || !amount) {
    return res.status(400).json({ error: "Name and Amount are required" });
  }

  try {
    const loanAmount = parseFloat(amount);
    const loanInterest = interest !== undefined ? parseFloat(interest) : (loanAmount * 0.30);
    const totalDays = days ? parseInt(days, 10) : 65;
    const startDateVal = start_date || new Date().toISOString().split('T')[0];

    await executeQuery(
      `INSERT INTO loans (name, nic, phone, guarantor_name, amount, interest, days, start_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, nic || '', phone || '', guarantor_name || '', loanAmount, loanInterest, totalDays, startDateVal]
    );

    return res.json({ success: true, message: "Loan issued successfully!" });
  } catch (err) {
    console.error("Create Loan Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// 4. Delete Loan
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await executeQuery('DELETE FROM payments WHERE loan_id = ?', [id]);
    await executeQuery('DELETE FROM loans WHERE id = ?', [id]);
    return res.json({ success: true, message: "Loan deleted successfully" });
  } catch (err) {
    console.error("Delete Loan Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;