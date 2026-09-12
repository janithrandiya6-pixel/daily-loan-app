require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@libsql/client');
const path = require('path');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Turso Database Client Initialization
const tursoUrl = process.env.TURSO_DATABASE_URL || "libsql://loan-manager-db-janithrandiya6-pixel.aws-ap-south-1.turso.io";
const tursoToken = process.env.TURSO_AUTH_TOKEN || process.env.AUTH_TOKEN;

const db = createClient({
  url: tursoUrl,
  authToken: tursoToken
});

const executeQuery = async (sql, params = []) => {
  try {
    const result = await db.execute({ sql, args: params });
    return result.rows || [];
  } catch (err) {
    console.error("Database Query Error:", err.message, "SQL:", sql);
    throw err;
  }
};

async function initializeDatabase() {
  try {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'officer'
      )
    `);

    await executeQuery(`
      CREATE TABLE IF NOT EXISTS loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        nic TEXT,
        phone TEXT,
        guarantor_name TEXT,
        amount REAL NOT NULL,
        interest REAL DEFAULT 0,
        days INTEGER DEFAULT 65,
        start_date TEXT
      )
    `);

    await executeQuery(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        loan_id INTEGER NOT NULL,
        day_number INTEGER NOT NULL,
        amount_paid REAL NOT NULL,
        payment_date TEXT,
        FOREIGN KEY (loan_id) REFERENCES loans(id)
      )
    `);

    await executeQuery(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        expense_date TEXT
      )
    `);

    const adminCheck = await executeQuery("SELECT * FROM users WHERE username = 'admin'");
    if (adminCheck.length === 0) {
      await executeQuery("INSERT INTO users (username, password, role) VALUES ('admin', '1234', 'admin')");
    }

    console.log("Turso Database initialized successfully with all tables & features!");
  } catch (err) {
    console.error("Database Initialization Failed:", err);
  }
}

initializeDatabase();

// ==================== AUTH API ====================
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const users = await executeQuery("SELECT * FROM users WHERE username = ? AND password = ?", [username, password]);
    if (users.length > 0) {
      return res.json({ success: true, user: users[0] });
    }
    return res.status(401).json({ success: false, error: "Invalid username or password" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== LOANS API (Optimized) ====================
app.get('/api/loans', async (req, res) => {
  try {
    const [loans, payments] = await Promise.all([
      executeQuery('SELECT * FROM loans ORDER BY id DESC'),
      executeQuery('SELECT loan_id, SUM(amount_paid) as total_paid FROM payments GROUP BY loan_id')
    ]);

    const paidMap = {};
    if (Array.isArray(payments)) {
      payments.forEach(p => {
        if (p && p.loan_id !== undefined) {
          paidMap[p.loan_id] = parseFloat(p.total_paid || 0);
        }
      });
    }

    const formattedLoans = loans.map(loan => ({
      ...loan,
      paid_amount: paidMap[loan.id] || 0
    }));

    return res.json(formattedLoans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/loans/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const loans = await executeQuery('SELECT * FROM loans WHERE id = ?', [id]);
    if (loans.length === 0) return res.status(404).json({ error: "Loan not found" });

    const loan = loans[0];
    const payments = await executeQuery('SELECT * FROM payments WHERE loan_id = ? ORDER BY day_number ASC', [id]);
    
    const dayPaymentsMap = {};
    let totalPaid = 0;
    payments.forEach(p => {
      const dNum = parseInt(p.day_number, 10);
      const amt = parseFloat(p.amount_paid || 0);
      dayPaymentsMap[dNum] = (dayPaymentsMap[dNum] || 0) + amt;
      totalPaid += amt;
    });

    const totalDays = parseInt(loan.days || 65, 10);
    const loanAmount = parseFloat(loan.amount || 0);
    const loanInterest = parseFloat(loan.interest || (loanAmount * 0.30));
    const totalAmount = loanAmount + loanInterest;
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
      schedule.push({ dayNumber: i, amountPaid: amtPaid.toFixed(2), status });
    }

    return res.json({
      ...loan,
      interest: loanInterest,
      paid_amount: totalPaid,
      paid_days: paidDaysCount,
      payments,
      schedule
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/loans', async (req, res) => {
  const { name, nic, phone, guarantor_name, amount, interest, days, start_date } = req.body;
  try {
    const loanAmount = parseFloat(amount);
    const loanInterest = interest ? parseFloat(interest) : (loanAmount * 0.30);
    const totalDays = days ? parseInt(days, 10) : 65;
    const startDateVal = start_date || new Date().toISOString().split('T')[0];

    await executeQuery(
      `INSERT INTO loans (name, nic, phone, guarantor_name, amount, interest, days, start_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, nic || '', phone || '', guarantor_name || '', loanAmount, loanInterest, totalDays, startDateVal]
    );

    return res.json({ success: true, message: "Loan issued successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/loans/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await executeQuery('DELETE FROM payments WHERE loan_id = ?', [id]);
    await executeQuery('DELETE FROM loans WHERE id = ?', [id]);
    return res.json({ success: true, message: "Loan deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== PAYMENTS API ====================
app.post('/api/payments', async (req, res) => {
  const { loan_id, day_number, amount_paid } = req.body;
  try {
    const loanIdVal = parseInt(loan_id, 10);
    const dayNumVal = parseInt(day_number, 10);
    const amountVal = parseFloat(amount_paid);

    const existing = await executeQuery('SELECT * FROM payments WHERE loan_id = ? AND day_number = ?', [loanIdVal, dayNumVal]);

    if (existing.length > 0) {
      const newAmount = parseFloat(existing[0].amount_paid || 0) + amountVal;
      await executeQuery('UPDATE payments SET amount_paid = ? WHERE id = ?', [newAmount, existing[0].id]);
    } else {
      const paymentDate = new Date().toISOString().split('T')[0];
      await executeQuery('INSERT INTO payments (loan_id, day_number, amount_paid, payment_date) VALUES (?, ?, ?, ?)', [loanIdVal, dayNumVal, amountVal, paymentDate]);
    }

    return res.json({ success: true, message: "Payment recorded successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== EXPENSES API ====================
app.get('/api/expenses', async (req, res) => {
  try {
    const expenses = await executeQuery('SELECT * FROM expenses ORDER BY id DESC');
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/expenses', async (req, res) => {
  const { title, amount, expense_date } = req.body;
  try {
    const titleVal = title || 'General Expense';
    const amountVal = parseFloat(amount || 0);
    const dateVal = expense_date || new Date().toISOString().split('T')[0];
    
    await executeQuery(
      `INSERT INTO expenses (title, amount, expense_date) VALUES (?, ?, ?)`,
      [titleVal, amountVal, dateVal]
    );

    res.json({ success: true, message: "Expense added successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await executeQuery('DELETE FROM expenses WHERE id = ?', [id]);
    res.json({ success: true, message: "Expense deleted successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== DAILY COLLECTION SHEET API ====================
app.get('/api/daily-collection', async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    const collections = await executeQuery(`
      SELECT p.id, p.loan_id, p.day_number, p.amount_paid, p.payment_date, l.name as customer_name, l.phone
      FROM payments p
      JOIN loans l ON p.loan_id = l.id
      WHERE p.payment_date = ?
    `, [targetDate]);

    let totalCollectedToday = 0;
    collections.forEach(c => {
      totalCollectedToday += parseFloat(c.amount_paid || 0);
    });

    res.json({
      date: targetDate,
      totalCollectedToday,
      collections
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== PDF REPORT ====================
app.get('/api/loans/:id/pdf', async (req, res) => {
  const { id } = req.params;
  try {
    const loans = await executeQuery('SELECT * FROM loans WHERE id = ?', [id]);
    if (loans.length === 0) return res.status(404).send("Loan not found");
    const loan = loans[0];

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Loan_Report_${loan.id}.pdf`);
    doc.pipe(res);

    doc.fontSize(20).text('LoanPro - Customer Loan Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Customer Name: ${loan.name}`);
    doc.text(`NIC: ${loan.nic || 'N/A'}`);
    doc.text(`Phone: ${loan.phone || 'N/A'}`);
    doc.text(`Loan Capital: Rs. ${loan.amount}`);
    doc.text(`Interest: Rs. ${loan.interest}`);
    doc.text(`Start Date: ${loan.start_date}`);
    doc.end();
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ==================== ANALYTICS API (Optimized) ====================
app.get('/api/analytics', async (req, res) => {
  try {
    const [loans, payments, expenses] = await Promise.all([
      executeQuery('SELECT SUM(amount + interest) as total_expected FROM loans'),
      executeQuery('SELECT SUM(amount_paid) as total_collected FROM payments'),
      executeQuery('SELECT SUM(amount) as total_expenses FROM expenses')
    ]);

    res.json({
      totalExpected: loans[0]?.total_expected || 0,
      totalCollected: payments[0]?.total_collected || 0,
      totalExpenses: expenses[0]?.total_expenses || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running smoothly on http://localhost:${PORT}`);
});