import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

// Import routes (routes ෆෝල්ඩර් එකේ තියෙන ෆයිල්ස් මෙතෙන්ට ඉම්පෝර්ට් කරන්න)
import loanRoutes from './routes/loans.js';
import expenseRoutes from './routes/expenses.js';
import customerRoutes from './routes/customer.js';
import authRoutes from './routes/auth.js';
import paymentRoutes from './routes/payments.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export default app;