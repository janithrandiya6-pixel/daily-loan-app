import express from 'express';
import cors from 'cors';
import { createClient } from '@libsql/client';
import 'dotenv/config';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Turso Database Client Setup
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Database Initialization (Tables creation)
async function initializeDatabase() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer TEXT NOT NULL,
        nic TEXT,
        phone TEXT,
        guarantor TEXT,
        principal REAL NOT NULL,
        interest REAL NOT NULL,
        date TEXT
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS capitals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        investor TEXT,
        amount REAL,
        note TEXT
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        category TEXT,
        amount REAL
      )
    `);

    console.log("Database tables initialized successfully!");
  } catch (error) {
    console.error("Database Initialization Failed:", error);
  }
}

initializeDatabase();

// Test API Route
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running and connected to Turso!' });
});

// Save Capital Route
app.post('/api/capital', async (req, res) => {
  try {
    const { date, investor, amount, note } = req.body;
    await db.execute({
      sql: `INSERT INTO capitals (date, investor, amount, note) VALUES (?, ?, ?, ?)`,
      args: [date, investor, amount, note]
    });
    res.json({ success: true, message: 'Capital added successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save Expense Route
app.post('/api/expenses', async (req, res) => {
  try {
    const { date, category, amount }  = req.body;
    await db.execute({
      sql: `INSERT INTO expenses (date, category, amount) VALUES (?, ?, ?)`,
      args: [date, category, amount]
    });
    res.json({ success: true, message: 'Expense added successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Analytics Data Route
app.get('/api/analytics', async (req, res) => {
  try {
    const capitalRes = await db.execute(`SELECT SUM(amount) as total FROM capitals`);
    const expenseRes = await db.execute(`SELECT SUM(amount) as total FROM expenses`);
    
    res.json({
      totalCapital: capitalRes.rows[0]?.total || 0,
      totalExpenses: expenseRes.rows[0]?.total || 0,
      netCashFlow: (capitalRes.rows[0]?.total || 0) - (expenseRes.rows[0]?.total || 0),
      todaysCollection: 0,
      totalCollected: 0,
      totalInterest: 11999.12
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running smoothly on http://localhost:${PORT}`);
  });
}

export default app;