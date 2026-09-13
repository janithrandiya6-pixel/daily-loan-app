// routes/loans.js - Updated Loan Management & Collection Routes
const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');

module.exports = (db) => {
  // Initialize Database Tables with all required columns
  db.execute(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      nic TEXT
    )
  `).catch(err => console.error("Customers table error:", err));

  db.execute(`
    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      guarantor TEXT,
      principal_amount REAL,
      interest_amount REAL,
      total_amount REAL NOT NULL,
      daily_installment REAL NOT NULL,
      duration_days INTEGER NOT NULL,
      balance REAL NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    )
  `).catch(err => console.error("Loans table error:", err));

  db.execute(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER,
      amount REAL NOT NULL,
      collected_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(loan_id) REFERENCES loans(id)
    )
  `).catch(err => console.error("Collections table error:", err));

  // Get all active loans & customer data
  router.get('/', verifyToken, async (req, res) => {
    try {
      const rs = await db.execute(`
        SELECT loans.*, customers.name as customer_name, customers.phone, customers.nic 
        FROM loans 
        JOIN customers ON loans.customer_id = customers.id
      `);
      res.json(rs.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create a new loan and customer
  router.post('/', verifyToken, async (req, res) => {
    const { 
      name, 
      phone, 
      address, 
      nic, 
      guarantor, 
      principal_amount, 
      interest_amount, 
      total_amount, 
      daily_installment, 
      duration_days 
    } = req.body;

    try {
      // 1. Calculate or assign values safely
      const principal = Number(principal_amount) || 0;
      const interest = Number(interest_amount) || 0;
      const calculatedTotal = total_amount ? Number(total_amount) : (principal + interest);
      const duration = Number(duration_days) || 100; // Default to 100 days if not provided
      const installment = daily_installment ? Number(daily_installment) : (calculatedTotal / duration);

      // 2. Insert customer
      const custResult = await db.execute({
        sql: 'INSERT INTO customers (name, phone, address, nic) VALUES (?, ?, ?, ?)',
        args: [name || 'Unknown', phone || '', address || '', nic || '']
      });
      const customerId = Number(custResult.lastInsertRowid);

      // 3. Create Loan
      await db.execute({
        sql: `INSERT INTO loans (
                customer_id, guarantor, principal_amount, interest_amount, 
                total_amount, daily_installment, duration_days, balance
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          customerId, 
          guarantor || '', 
          principal, 
          interest, 
          calculatedTotal, 
          installment, 
          duration, 
          calculatedTotal
        ]
      });

      res.status(201).json({ message: 'Loan created successfully' });
    } catch (err) {
      console.error("Loan creation error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Record a daily payment collection
  router.post('/:id/collect', verifyToken, async (req, res) => {
    const loanId = req.params.id;
    const { amount } = req.body;

    try {
      const loanRs = await db.execute({
        sql: 'SELECT * FROM loans WHERE id = ?',
        args: [loanId]
      });

      if (loanRs.rows.length === 0) {
        return res.status(404).json({ error: 'Loan not found' });
      }

      const loan = loanRs.rows[0];
      const newBalance = Math.max(0, loan.balance - Number(amount));
      const newStatus = newBalance === 0 ? 'COMPLETED' : 'ACTIVE';

      // Insert collection log
      await db.execute({
        sql: 'INSERT INTO collections (loan_id, amount) VALUES (?, ?)',
        args: [loanId, amount]
      });

      // Update loan balance & status
      await db.execute({
        sql: 'UPDATE loans SET balance = ?, status = ? WHERE id = ?',
        args: [newBalance, newStatus, loanId]
      });

      res.json({ message: 'Collection recorded successfully', newBalance, status: newStatus });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};