const express = require("express");
const router = express.Router();
const db = require("../config/db"); // Config folder se DB path

// Database Tables Initialize karne ka function
async function initTables() {
  try {
    // Loans Table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        nic TEXT,
        phone TEXT,
        guarantor_name TEXT,
        amount REAL NOT NULL,
        interest REAL NOT NULL,
        paid_amount REAL DEFAULT 0,
        paid_days INTEGER DEFAULT 0,
        days INTEGER DEFAULT 65,
        start_date TEXT
      );
    `);

    // Loan Schedule Table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS loan_schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        loan_id INTEGER,
        day_number INTEGER,
        amount_paid REAL DEFAULT 0,
        status TEXT DEFAULT 'Pending',
        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
      );
    `);

    console.log("Turso Database tables successfully initialized!");
  } catch (error) {
    console.error("Table initialization error:", error);
  }
}

// Module load hote hi tables initialize honge
initTables();

// 1. Get All Active Loans
router.get("/", async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM loans ORDER BY id DESC");
    const loans = result.rows;

    for (let loan of loans) {
      const schedResult = await db.execute({
        sql: "SELECT * FROM loan_schedule WHERE loan_id = ? ORDER BY day_number ASC",
        args: [loan.id]
      });
      loan.schedule = schedResult.rows;
    }

    res.json(loans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Create New Loan (Optimized Batch Insert - Fast Output)
router.post("/", async (req, res) => {
  try {
    const { start_date, name, nic, phone, guarantor_name, amount, interest } = req.body;
    
    // Main Loan Insert
    const insertResult = await db.execute({
      sql: `INSERT INTO loans (name, nic, phone, guarantor_name, amount, interest, start_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [name, nic, phone, guarantor_name, parseFloat(amount), parseFloat(interest), start_date]
    });

    const loanId = insertResult.rows[0].id;

    // 65 Days ka Schedule Single Batch Query se insert karna (No Loop Delay)
    let values = [];
    let args = [];
    for (let day = 1; day <= 65; day++) {
      values.push("(?, ?, 0, 'Pending')");
      args.push(loanId, day);
    }

    const batchSql = `INSERT INTO loan_schedule (loan_id, day_number, amount_paid, status) VALUES ${values.join(", ")}`;
    await db.execute({ sql: batchSql, args: args });

    res.json({ success: true, loanId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get Single Loan Details
router.get("/:id", async (req, res) => {
  try {
    const loanResult = await db.execute({
      sql: "SELECT * FROM loans WHERE id = ?",
      args: [req.params.id]
    });

    if (loanResult.rows.length === 0) {
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanResult.rows[0];
    const schedResult = await db.execute({
      sql: "SELECT * FROM loan_schedule WHERE loan_id = ? ORDER BY day_number ASC",
      args: [req.params.id]
    });
    
    loan.schedule = schedResult.rows;
    res.json(loan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Delete Loan
router.delete("/:id", async (req, res) => {
  try {
    await db.execute({
      sql: "DELETE FROM loan_schedule WHERE loan_id = ?",
      args: [req.params.id]
    });
    await db.execute({
      sql: "DELETE FROM loans WHERE id = ?",
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;