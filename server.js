const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import routes
const loanRoutes = require('./routes/loans');
const expenseRoutes = require('./routes/expenses');
const customerRoutes = require('./routes/customer');
const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payments');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Use API Routes
app.use('/api/loans', loanRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);

// Test API Route
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running successfully!' });
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running smoothly on http://localhost:${PORT}`);
  });
}

module.exports = app;