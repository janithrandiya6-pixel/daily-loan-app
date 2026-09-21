const express = require("express");
const router = express.Router();
const db = require("../config/db");

// 🚀 1. Get All Active Loans (Fixed Paid Amount & Speed Optimization)
router.get("/", async (req, res) => {
  try {
    const loansRes = await db.execute(`
      SELECT 
        l.id,
        l.name,
        l.nic,
        l.phone,
        l.guarantor_name,
        l.amount,
        l.interest,
        l.days,
        l.start_date,
        COALESCE(SUM(p.amount_paid), 0) AS paid_amount
      FROM loans l
      LEFT JOIN payments p ON l.id = p.loan_id
      GROUP BY l.id
      ORDER BY l.id DESC
    `);

    // Front-end එකට අවශ්‍ය Format එකට Mapping කිරීම
    const formattedLoans = (loansRes.rows || []).map(loan => ({
      ...loan,
      amount: parseFloat(loan.amount || 0),
      interest: parseFloat(loan.interest || 0),
      paid_amount: parseFloat(loan.paid_amount || 0)
    }));

    res.json(formattedLoans);
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

// 🚀 3. Get Single Loan Details with Schedule
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

// 🚀 4. Save Payment
router.post("/:id/pay", async (req, res) => {
  try {
    const loanId = req.params.id;
    const { day_number, amount_paid } = req.body;
    const today = new Date().toISOString().split("T")[0];

    const existing = await db.execute({
      sql: "SELECT * FROM payments WHERE loan_id = ? AND day_number = ?",
      args: [loanId, day_number]
    });

    if (existing.rows && existing.rows.length > 0) {
      await db.execute({
        sql: "UPDATE payments SET amount_paid = ?, paid_date = ? WHERE loan_id = ? AND day_number = ?",
        args: [parseFloat(amount_paid), today, loanId, day_number]
      });
    } else {
      await db.execute({
        sql: "INSERT INTO payments (loan_id, day_number, amount_paid, paid_date, status) VALUES (?, ?, ?, ?, 'Paid')",
        args: [loanId, day_number, parseFloat(amount_paid), today]
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