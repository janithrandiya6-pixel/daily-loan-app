const express = require("express");
const app = express();
const dotenv = require("dotenv");
const path = require("path");

// dotenv Configuration
dotenv.config();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public")); // public folder static files

// Database Connection
const db = require("./config/db");

// Routes Mount
app.use("/api/loans", require("./routes/loans"));
app.use("/api", require("./routes/expenses"));

// Root Route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Analytics Route
app.get("/analytics.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "analytics.html"));
});

// ---------------- 65-DAY CARD PAYMENT SAVE API ----------------
app.post("/api/payments", async (req, res) => {
  try {
    const { loan_id, day_number, amount_paid } = req.body;
    const today = new Date().toISOString().split("T")[0];

    const existing = await db.execute({
      sql: "SELECT * FROM payments WHERE loan_id = ? AND day_number = ?",
      args: [loan_id, day_number]
    });

    if (existing.rows.length > 0) {
      await db.execute({
        sql: "UPDATE payments SET amount_paid = ?, paid_date = ? WHERE loan_id = ? AND day_number = ?",
        args: [parseFloat(amount_paid), today, loan_id, day_number]
      });
    } else {
      await db.execute({
        sql: "INSERT INTO payments (loan_id, day_number, amount_paid, paid_date) VALUES (?, ?, ?, ?)",
        args: [loan_id, day_number, parseFloat(amount_paid), today]
      });
    }

    res.json({ success: true, message: "Payment saved successfully" });
  } catch (err) {
    console.error("Payment API Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Database Auto-Create & Migration Logic
async function initAnalyticsTables() {
  try {
    // 1. Loans Table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_date TEXT,
        name TEXT,
        nic TEXT,
        phone TEXT,
        guarantor_name TEXT,
        amount REAL,
        interest REAL,
        paid_amount REAL DEFAULT 0,
        days INTEGER DEFAULT 65
      );
    `);

    // 2. Payments Table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        loan_id INTEGER,
        day_number INTEGER,
        amount_paid REAL,
        paid_date TEXT,
        FOREIGN KEY (loan_id) REFERENCES loans(id)
      );
    `);

    // Schema Migration: paid_date column illaiyentral auto-add pannum
    try {
      await db.execute(`ALTER TABLE payments ADD COLUMN paid_date TEXT;`);
      console.log("✅ 'paid_date' column added to payments table!");
    } catch (colErr) {
      // Column munnadiye irundhal error-ai ignore pannum
    }

    // 3. Capital Table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS capital (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        investor_name TEXT,
        amount REAL,
        description TEXT
      );
    `);

    // 4. Expenses Table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        category TEXT,
        amount REAL
      );
    `);

    console.log("✅ All Database Tables & Columns are Ready!");
  } catch (error) {
    console.error("❌ Error initializing database tables:", error);
  }
}

// Init Database Tables
initAnalyticsTables();

// Server Setup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});