const express = require('express');
const router = express.Router();
const { queryDB } = require('../config/db');
const authenticateToken = require('../middleware/auth');

// Get all customers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const customers = await queryDB("SELECT * FROM customers ORDER BY id DESC");
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new customer
router.post('/', authenticateToken, async (req, res) => {
  const { name, phone, nic, address } = req.body;
  try {
    await queryDB(
      "INSERT INTO customers (name, phone, nic, address) VALUES (?, ?, ?, ?)",
      [name, phone, nic, address]
    );
    res.json({ message: "Customer added successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;