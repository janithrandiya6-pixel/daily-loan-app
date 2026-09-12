const express = require('express');
const router = express.Router();
const { queryDB } = require('../config/db');
const authenticateToken = require('../middleware/auth');

router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const totalIssuedRes = await queryDB("SELECT SUM(amount) as total FROM loans");
    const totalCollectedRes = await queryDB("SELECT SUM(amount) as total FROM payments");
    const activeLoansRes = await queryDB("SELECT COUNT(*) as count FROM loans");
    const totalExpensesRes = await queryDB("SELECT SUM(amount) as total FROM expenses");

    const totalIssued = totalIssuedRes[0]?.total || 0;
    const totalCollected = totalCollectedRes[0]?.total || 0;
    const totalExpenses = totalExpensesRes[0]?.total || 0;
    const expectedProfit = totalIssued * 0.30;
    const netProfit = expectedProfit - totalExpenses;

    res.json({
      totalIssued,
      totalCollected,
      totalExpenses,
      expectedProfit,
      netProfit,
      activeLoans: activeLoansRes[0]?.count || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;