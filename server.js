const express = require("express");
const app = express();
const dotenv = require("dotenv");

// dotenv Configuration
dotenv.config();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Database Connection (Root එකේ ඉඳන් config/db එකට)
const db = require("./config/db");

// Routes Mount කිරීම (routes/ folder එකට යන නිසා ./routes කියල තියෙන්න ඕන)
app.use("/api/loans", require("./routes/loans"));
app.use("/api", require("./routes/expenses"));

// Root Route
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Analytics Tables Auto-Create Logic
async function initAnalyticsTables() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS capital (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        investor_name TEXT,
        amount REAL,
        description TEXT
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        category TEXT,
        amount REAL
      );
    `);

    console.log("✅ Analytics tables ready in Turso Database!");
  } catch (error) {
    console.error("❌ Error creating analytics tables:", error);
  }
}

// Server එක Start වෙද්දී Table Create කරන්න
initAnalyticsTables();

// Server Port Setup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});