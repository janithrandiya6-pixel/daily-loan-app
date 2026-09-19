const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Database Tables & Columns auto-repair
async function setupAnalytics() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS capital (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        name TEXT,
        investor_name TEXT,
        amount REAL,
        description TEXT
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        category TEXT,
        title TEXT,
        amount REAL
      );
    `);

    // Ensure capital columns exist
    try { await db.execute("ALTER TABLE capital ADD COLUMN investor_name TEXT;"); } catch (e) {}
    try { await db.execute("ALTER TABLE capital ADD COLUMN name TEXT;"); } catch (e) {}

    // Ensure expenses columns exist (category and title both)
    try { await db.execute("ALTER TABLE expenses ADD COLUMN category TEXT;"); } catch (e) {}
    try { await db.execute("ALTER TABLE expenses ADD COLUMN title TEXT;"); } catch (e) {}

    console.log("✅ Analytics Tables & Expense Columns Ready!");
  } catch (err) {
    console.error("❌ DB Setup Error:", err);
  }
}

setupAnalytics();

// 1. Capital / Investment Save
router.post('/capital', async (req, res) => {
  try {
    const { date, name, amount, note } = req.body;
    const valAmount = parseFloat(amount) || 0;
    const valName = name || "";
    const valDate = date || "";
    const valNote = note || "";

    await db.execute({
      sql: "INSERT INTO capital (date, name, investor_name, amount, description) VALUES (?, ?, ?, ?, ?)",
      args: [valDate, valName, valName, valAmount, valNote]
    });

    res.json({ success: true, message: "Capital saved successfully" });
  } catch (err) {
    console.error("Capital Save Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Expense Save (Saves to both category and title columns safely)
router.post('/expense', async (req, res) => {
  try {
    const { date, category, amount } = req.body;
    const valAmount = parseFloat(amount) || 0;
    const valCategory = category || "";
    const valDate = date || "";

    await db.execute({
      sql: "INSERT INTO expenses (date, category, title, amount) VALUES (?, ?, ?, ?)",
      args: [valDate, valCategory, valCategory, valAmount]
    });

    res.json({ success: true, message: "Expense saved successfully" });
  } catch (err) {
    console.error("Expense Save Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Capital List
router.get('/capital', async (req, res) => {
  try {
    const result = await db.execute("SELECT id, date, COALESCE(investor_name, name) AS name, amount, description AS note FROM capital ORDER BY id DESC");
    res.json(result.rows || []);
  } catch (err) {
    console.error("Get Capital Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Expense List
router.get('/expenses', async (req, res) => {
  try {
    const result = await db.execute("SELECT id, date, COALESCE(category, title) AS title, amount FROM expenses ORDER BY id DESC");
    res.json(result.rows || []);
  } catch (err) {
    console.error("Get Expenses Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Summary Totals
router.get('/summary', async (req, res) => {
  try {
    const capRes = await db.execute("SELECT SUM(amount) as total FROM capital");
    const expRes = await db.execute("SELECT SUM(amount) as total FROM expenses");

    const totalCapital = capRes.rows[0]?.total || 0;
    const totalExpenses = expRes.rows[0]?.total || 0;

    res.json({
      totalCapital,
      totalExpenses,
      netCashFlow: totalCapital - totalExpenses
    });
  } catch (err) {
    console.error("Summary Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Delete Capital
router.delete('/capital/:id', async (req, res) => {
  try {
    await db.execute({
      sql: "DELETE FROM capital WHERE id = ?",
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Delete Expense
router.delete('/expense/:id', async (req, res) => {
  try {
    await db.execute({
      sql: "DELETE FROM expenses WHERE id = ?",
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;