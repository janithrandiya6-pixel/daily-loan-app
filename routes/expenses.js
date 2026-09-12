const express = require('express');
const router = express.Router();
const { queryDB } = require('../config/db');
const authenticateToken = require('../middleware/auth');

// Get all expenses
router.get('/', authenticateToken, async (req, res) => {
  try {
    const expenses = await queryDB("SELECT * FROM expenses ORDER BY id DESC");
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new expense
router.post('/', authenticateToken, async (req, res) => {
  const { title, amount, expense_date, date, note } = req.body;

  if (!title || amount === undefined || amount === null) {
    return res.status(400).json({ error: "Title and Amount are required" });
  }

  const selectedDate = expense_date || date || new Date().toISOString().split('T')[0];

  try {
    await queryDB(
      "INSERT INTO expenses (title, amount, date, expense_date, note) VALUES (?, ?, ?, ?, ?)",
      [title, Number(amount), selectedDate, selectedDate, note || '']
    );
    res.json({ message: "Expense added successfully" });
  } catch (err) {
    console.error("Expense Save Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete expense
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await queryDB("DELETE FROM expenses WHERE id = ?", [req.params.id]);
    res.json({ message: "Expense deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;