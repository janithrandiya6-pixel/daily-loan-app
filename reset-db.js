require('dotenv').config();
const { createClient } = require('@libsql/client');

// Direct Turso Connection using .env variables
const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "libsql://loan-manager-db-janithrandiya6-pixel.aws-ap-south-1.turso.io";
const tursoToken = process.env.TURSO_AUTH_TOKEN || process.env.AUTH_TOKEN;

const client = createClient({
  url: tursoUrl,
  authToken: tursoToken
});

async function resetTursoDatabase() {
  try {
    console.log("Resetting Turso Database Tables directly...");

    // Drop Old Tables
    await client.execute('DROP TABLE IF EXISTS payments;');
    await client.execute('DROP TABLE IF EXISTS loans;');

    // 1. Recreate Loans Table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        nic TEXT,
        phone TEXT,
        guarantor_name TEXT,
        amount REAL NOT NULL,
        interest REAL NOT NULL,
        days INTEGER DEFAULT 65,
        start_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Recreate Payments Table with strict day_number
    await client.execute(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        loan_id INTEGER NOT NULL,
        day_number INTEGER NOT NULL,
        amount_paid REAL NOT NULL,
        status TEXT DEFAULT 'Paid',
        payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
      );
    `);

    console.log("Success: Turso DB Tables Recreated & Reset Cleanly!");
    process.exit(0);
  } catch (err) {
    console.error("Database Reset Error:", err);
    process.exit(1);
  }
}

resetTursoDatabase();