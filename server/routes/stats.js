const express = require('express');
const router = express.Router();
const db = require('../db');

// Pobierz podsumowanie dla wielu osób
router.get('/summary', (req, res) => {
  try {
    const totalRow = db.queryOne(`
      SELECT 
        COALESCE(SUM(CASE WHEN status != 'SETTLED' THEN remaining_amount ELSE 0 END), 0) AS total_active_amount,
        COALESCE(SUM(CASE WHEN status = 'SETTLED' THEN amount ELSE (amount - remaining_amount) END), 0) AS total_settled_amount,
        COUNT(CASE WHEN status != 'SETTLED' THEN 1 END) AS active_debts_count,
        COUNT(CASE WHEN status = 'SETTLED' THEN 1 END) AS settled_debts_count
      FROM debts
    `);

    const myReceiveRow = db.queryOne(`
      SELECT COALESCE(SUM(remaining_amount), 0) as total 
      FROM debts 
      WHERE status != 'SETTLED' AND (LOWER(creditor_name) = 'ja' OR LOWER(creditor_name) = 'me')
    `);

    const myPayRow = db.queryOne(`
      SELECT COALESCE(SUM(remaining_amount), 0) as total 
      FROM debts 
      WHERE status != 'SETTLED' AND (LOWER(debtor_name) = 'ja' OR LOWER(debtor_name) = 'me')
    `);

    // Wylicz bilans per każda osoba
    const peopleRows = db.queryAll(`
      SELECT DISTINCT debtor_name AS name FROM debts
      UNION
      SELECT DISTINCT creditor_name AS name FROM debts
    `);

    const peopleBalances = peopleRows.map(p => {
      const name = p.name;
      const receiveRow = db.queryOne(`
        SELECT COALESCE(SUM(remaining_amount), 0) as total 
        FROM debts 
        WHERE status != 'SETTLED' AND LOWER(creditor_name) = LOWER(?)
      `, [name]);

      const payRow = db.queryOne(`
        SELECT COALESCE(SUM(remaining_amount), 0) as total 
        FROM debts 
        WHERE status != 'SETTLED' AND LOWER(debtor_name) = LOWER(?)
      `, [name]);

      const toReceive = receiveRow ? receiveRow.total : 0;
      const toPay = payRow ? payRow.total : 0;

      return {
        name,
        to_receive: Math.round(toReceive * 100) / 100,
        to_pay: Math.round(toPay * 100) / 100,
        net_balance: Math.round((toReceive - toPay) * 100) / 100
      };
    });

    res.json({
      total_active_amount: Math.round((totalRow ? totalRow.total_active_amount : 0) * 100) / 100,
      total_settled_amount: Math.round((totalRow ? totalRow.total_settled_amount : 0) * 100) / 100,
      active_debts_count: totalRow ? totalRow.active_debts_count : 0,
      settled_debts_count: totalRow ? totalRow.settled_debts_count : 0,
      my_to_receive: Math.round((myReceiveRow ? myReceiveRow.total : 0) * 100) / 100,
      my_to_pay: Math.round((myPayRow ? myPayRow.total : 0) * 100) / 100,
      people_balances: peopleBalances
    });
  } catch (err) {
    console.error('Błąd pobierania statystyk:', err);
    res.status(500).json({ error: 'Błąd pobierania statystyk' });
  }
});

// Historia aktywności
router.get('/activity', (req, res) => {
  try {
    const logs = db.queryAll('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 30');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Błąd pobierania historii' });
  }
});

module.exports = router;
