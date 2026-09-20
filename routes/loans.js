const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Database Tables Initialize කරන Function එක
async function initTables() {
  try {
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

    // Column Migration Checks
    try { await db.execute(`ALTER TABLE loans ADD COLUMN paid_amount REAL DEFAULT 0;`); } catch (e) {}
    try { await db.execute(`ALTER TABLE loans ADD COLUMN paid_days INTEGER DEFAULT 0;`); } catch (e) {}

    await db.execute(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        loan_id INTEGER,
        day_number INTEGER,
        amount_paid REAL DEFAULT 0,
        status TEXT DEFAULT 'Pending',
        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
      );
    `);

    console.log("Turso Database tables successfully initialized & fixed!");
  } catch (error) {
    console.error("Table initialization error:", error);
  }
}

initTables();

// 🚀 1. Get All Active Loans (Calculates exact paid amounts dynamically)
router.get("/", async (req, res) => {
  try {
    const loansRes = await db.execute("SELECT * FROM loans ORDER BY id DESC");
    const loans = loansRes.rows || [];

    for (let loan of loans) {
      const paymentsRes = await db.execute({
        sql: "SELECT * FROM payments WHERE loan_id = ?",
        args: [loan.id]
      });

      let totalPaid = 0;
      let completedDays = 0;
      const totalDays = loan.days || 65;
      const totalAmount = parseFloat(loan.amount || 0) + parseFloat(loan.interest || 0);
      const dailyInstallment = totalDays > 0 ? totalAmount / totalDays : 0;

      if (paymentsRes.rows) {
        paymentsRes.rows.forEach(p => {
          const amt = parseFloat(p.amount_paid || 0);
          totalPaid += amt;
          if (amt >= (dailyInstallment - 0.01) && dailyInstallment > 0) {
            completedDays++;
          }
        });
      }

      loan.paid_amount = totalPaid;
      loan.paid_days = completedDays;
    }

    res.json(loans);
  } catch (err) {
    console.error("Error fetching loans:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🚀 2. Create New Loan
router.post("/", async (req, res) => {
  try {
    const { start_date, name, nic, phone, guarantor_name, amount, interest } = req.body;

    if (!name || !amount) {
      return res.status(400).json({ error: "නම සහ මූලික මුදල ඇතුළත් කිරීම අනිවාර්ය වේ." });
    }

    const startDateVal = start_date && start_date.trim() !== "" 
      ? start_date 
      : new Date().toISOString().split("T")[0];

    const insertResult = await db.execute({
      sql: `INSERT INTO loans (name, nic, phone, guarantor_name, amount, interest, start_date, days, paid_amount, paid_days) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 65, 0, 0)`,
      args: [
        String(name),
        String(nic || ""),
        String(phone || ""),
        String(guarantor_name || ""),
        parseFloat(amount || 0),
        parseFloat(interest || 0),
        startDateVal
      ]
    });

    const loanId = Number(insertResult.lastInsertRowid);
    res.json({ success: true, loanId: loanId, message: "Loan එක සාර්ථකව නිර්මාණය විය!" });
  } catch (err) {
    console.error("Error creating loan:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🚀 3. Get Single Loan Details with 65-day Schedule
router.get("/:id", async (req, res) => {
  try {
    const loanId = req.params.id;
    const loanResult = await db.execute({
      sql: "SELECT * FROM loans WHERE id = ?",
      args: [loanId]
    });

    if (!loanResult.rows || loanResult.rows.length === 0) {
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanResult.rows[0];
    const paymentsRes = await db.execute({
      sql: "SELECT * FROM payments WHERE loan_id = ?",
      args: [loanId]
    });

    let totalPaid = 0;
    let completedDaysCount = 0;
    const paymentMap = {};

    if (paymentsRes.rows) {
      paymentsRes.rows.forEach((p) => {
        const dayNum = p.day_number;
        const amt = parseFloat(p.amount_paid || 0);
        paymentMap[dayNum] = amt;
        totalPaid += amt;
      });
    }

    const totalDays = loan.days || 65;
    const totalAmount = parseFloat(loan.amount || 0) + parseFloat(loan.interest || 0);
    const dailyInstallment = totalDays > 0 ? totalAmount / totalDays : 0;

    loan.schedule = [];
    for (let i = 1; i <= totalDays; i++) {
      const paidVal = paymentMap[i] || 0;
      const isPaid = paidVal >= (dailyInstallment - 0.01) && dailyInstallment > 0;
      
      if (isPaid) completedDaysCount++;

      loan.schedule.push({
        dayNumber: i,
        day_number: i,
        amountPaid: paidVal,
        amount_paid: paidVal,
        status: isPaid ? "Paid" : "Pending"
      });
    }

    loan.paid_amount = totalPaid;
    loan.paid_days = completedDaysCount;
    res.json(loan);
  } catch (err) {
    console.error("Error fetching single loan:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🚀 4. Save Payment for a Day
router.post("/:id/pay", async (req, res) => {
  try {
    const loanId = req.params.id;
    const { day_number, amount_paid } = req.body;

    // Existing payment check
    const existing = await db.execute({
      sql: "SELECT * FROM payments WHERE loan_id = ? AND day_number = ?",
      args: [loanId, day_number]
    });

    if (existing.rows && existing.rows.length > 0) {
      await db.execute({
        sql: "UPDATE payments SET amount_paid = ? WHERE loan_id = ? AND day_number = ?",
        args: [parseFloat(amount_paid), loanId, day_number]
      });
    } else {
      await db.execute({
        sql: "INSERT INTO payments (loan_id, day_number, amount_paid, status) VALUES (?, ?, ?, 'Paid')",
        args: [loanId, day_number, parseFloat(amount_paid)]
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error saving payment:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🚀 5. Delete Loan
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await db.execute({ sql: "DELETE FROM payments WHERE loan_id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM loans WHERE id = ?", args: [id] });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting loan:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;