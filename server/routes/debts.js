const express = require('express');
const router = express.Router();
const db = require('../db');

const ALLOWED_CURRENCIES = ['PLN', 'EUR', 'USD', 'GBP', 'CHF', 'CZK', 'NOK'];

function sanitizeName(name) {
  if (typeof name !== 'string') return '';
  return name.trim().replace(/\s+/g, ' ');
}

function parseValidAmount(val) {
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  if (isNaN(num) || !isFinite(num)) return null;
  const rounded = Math.round(num * 100) / 100;
  if (rounded <= 0 || rounded > 1000000000) return null;
  return rounded;
}

function validateCurrency(curr) {
  if (!curr || typeof curr !== 'string') return 'PLN';
  const upper = curr.trim().toUpperCase();
  return ALLOWED_CURRENCIES.includes(upper) ? upper : 'PLN';
}

// Pobierz listę długów z filtrami
router.get('/', (req, res) => {
  try {
    const { status, search, person } = req.query;

    let sql = 'SELECT * FROM debts WHERE 1=1';
    const params = [];

    if (status) {
      if (status === 'UNSETTLED') {
        sql += " AND status IN ('ACTIVE', 'PARTIALLY_PAID')";
      } else if (status === 'SETTLED' || status === 'ACTIVE' || status === 'PARTIALLY_PAID') {
        sql += ' AND status = ?';
        params.push(status);
      }
    }

    if (person && typeof person === 'string' && person.trim() && person.trim().toUpperCase() !== 'ALL') {
      const p = person.trim();
      sql += ' AND (LOWER(debtor_name) = LOWER(?) OR LOWER(creditor_name) = LOWER(?))';
      params.push(p, p);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const s = `%${search.trim()}%`;
      sql += ' AND (title LIKE ? OR debtor_name LIKE ? OR creditor_name LIKE ?)';
      params.push(s, s, s);
    }

    sql += ' ORDER BY created_at DESC';

    const debts = db.queryAll(sql, params);

    // Dołącz historię wpłat
    const debtsWithPayments = debts.map(d => {
      const payments = db.queryAll(
        'SELECT * FROM payments WHERE debt_id = ? ORDER BY payment_date DESC, created_at DESC, id DESC',
        [d.id]
      );
      return {
        ...d,
        payments
      };
    });

    res.json(debtsWithPayments);
  } catch (err) {
    console.error('Błąd pobierania długów:', err);
    res.status(500).json({ error: 'Nie udało się pobrać listy długów.' });
  }
});

// Pobierz listę wszystkich unikalnych osób z bazy
router.get('/people', (req, res) => {
  try {
    const peopleRows = db.queryAll(`
      SELECT DISTINCT debtor_name AS name FROM debts
      UNION
      SELECT DISTINCT creditor_name AS name FROM debts
    `);
    const list = peopleRows.map(r => r.name).filter(Boolean);
    res.json(list);
  } catch (err) {
    console.error('Błąd pobierania listy osób:', err);
    res.status(500).json([]);
  }
});

// Dodaj pojedynczy wpis: Kto wisi -> Komu wisi
router.post('/', (req, res) => {
  try {
    const debtor = sanitizeName(req.body.debtor_name);
    const creditor = sanitizeName(req.body.creditor_name);
    const parsedAmount = parseValidAmount(req.body.amount);
    const curr = validateCurrency(req.body.currency);
    const rawTitle = req.body.title;
    const titleText = typeof rawTitle === 'string' && rawTitle.trim() 
      ? rawTitle.trim().substring(0, 150) 
      : 'Rozliczenie';

    if (!debtor) {
      return res.status(400).json({ error: 'Podaj imię lub pseudonim dłużnika (kto oddaje).' });
    }
    if (debtor.length > 60) {
      return res.status(400).json({ error: 'Imię dłużnika może mieć maksymalnie 60 znaków.' });
    }

    if (!creditor) {
      return res.status(400).json({ error: 'Podaj imię lub pseudonim wierzyciela (komu oddaje).' });
    }
    if (creditor.length > 60) {
      return res.status(400).json({ error: 'Imię wierzyciela może mieć maksymalnie 60 znaków.' });
    }

    if (debtor.toLowerCase() === creditor.toLowerCase()) {
      return res.status(400).json({ error: 'Dłużnik i wierzyciel nie mogą być tą samą osobą.' });
    }

    if (!parsedAmount) {
      return res.status(400).json({ error: 'Kwota musi być liczbą dodatnią większą od zera (np. 45.50).' });
    }

    const result = db.run(`
      INSERT INTO debts (debtor_name, creditor_name, title, amount, remaining_amount, currency, status)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
    `, [debtor, creditor, titleText, parsedAmount, parsedAmount, curr]);

    db.logActivity('DEBT_ADD', `Dodano wpis: ${debtor} ➔ ${creditor}: ${parsedAmount.toFixed(2)} ${curr} (${titleText})`);

    const newDebt = db.queryOne('SELECT * FROM debts WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ ...newDebt, payments: [] });
  } catch (err) {
    console.error('Błąd dodawania długu:', err);
    res.status(500).json({ error: 'Wystąpił błąd podczas dodawania wpisu.' });
  }
});

// Podziel rachunek / Zrzutka na kilka osób (Split Bill)
router.post('/split', (req, res) => {
  try {
    const payer = sanitizeName(req.body.payer_name);
    const parsedTotal = parseValidAmount(req.body.total_amount);
    const curr = validateCurrency(req.body.currency);
    const rawTitle = req.body.title;
    const titleText = typeof rawTitle === 'string' && rawTitle.trim() 
      ? rawTitle.trim().substring(0, 150) 
      : 'Podział rachunku';
    const includePayer = Boolean(req.body.include_payer);

    if (!payer) {
      return res.status(400).json({ error: 'Podaj osobę, która wyłożyła kwotę (płacący).' });
    }
    if (payer.length > 60) {
      return res.status(400).json({ error: 'Nazwa płacącego może mieć maksymalnie 60 znaków.' });
    }

    if (!parsedTotal) {
      return res.status(400).json({ error: 'Całkowita kwota rachunku musi być większa od zera.' });
    }

    let rawPeople = req.body.people;
    let participants = [];

    if (Array.isArray(rawPeople)) {
      participants = rawPeople.map(sanitizeName).filter(Boolean);
    } else if (typeof rawPeople === 'string') {
      participants = rawPeople.split(',').map(sanitizeName).filter(Boolean);
    }

    // Unikalne osoby bez płacącego
    const uniqueMap = new Map();
    participants.forEach(p => {
      const lower = p.toLowerCase();
      if (lower !== payer.toLowerCase() && !uniqueMap.has(lower)) {
        uniqueMap.set(lower, p);
      }
    });

    const cleanParticipants = Array.from(uniqueMap.values());

    if (cleanParticipants.length === 0) {
      return res.status(400).json({ error: 'Wybierz lub wpisz co najmniej jedną inną osobę biorącą udział w zrzutce.' });
    }

    const divisor = includePayer ? (cleanParticipants.length + 1) : cleanParticipants.length;
    const amountPerPerson = Math.round((parsedTotal / divisor) * 100) / 100;

    if (amountPerPerson <= 0) {
      return res.status(400).json({ error: 'Kwota przypadająca na osobę po podziale jest zbyt mała (mniejsza niż 0.01).' });
    }

    const createdDebts = [];
    for (const debtor of cleanParticipants) {
      const itemTitle = `${titleText} (udział: ${amountPerPerson.toFixed(2)} ${curr})`;
      const result = db.run(`
        INSERT INTO debts (debtor_name, creditor_name, title, amount, remaining_amount, currency, status)
        VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
      `, [debtor, payer, itemTitle, amountPerPerson, amountPerPerson, curr]);

      createdDebts.push(db.queryOne('SELECT * FROM debts WHERE id = ?', [result.lastInsertRowid]));
    }

    db.logActivity('SPLIT_BILL', `Podzielono rachunek "${titleText}" (${parsedTotal.toFixed(2)} ${curr}) zapłacony przez ${payer} na ${cleanParticipants.length} osób (po ${amountPerPerson.toFixed(2)} ${curr})`);

    res.status(201).json({
      message: `Podzielono rachunek na ${cleanParticipants.length} osób (po ${amountPerPerson.toFixed(2)} ${curr})`,
      amountPerPerson,
      currency: curr,
      debts: createdDebts
    });
  } catch (err) {
    console.error('Błąd podziału rachunku:', err);
    res.status(500).json({ error: 'Błąd podczas podziału rachunku.' });
  }
});

// Spłać część
router.post('/:id/pay', (req, res) => {
  try {
    const debtId = parseInt(req.params.id, 10);
    if (!debtId || isNaN(debtId)) {
      return res.status(400).json({ error: 'Nieprawidłowy identyfikator rozliczenia.' });
    }

    const debt = db.queryOne('SELECT * FROM debts WHERE id = ?', [debtId]);
    if (!debt) {
      return res.status(404).json({ error: 'Nie znaleziono takiego rozliczenia.' });
    }

    if (debt.status === 'SETTLED' || debt.remaining_amount <= 0.001) {
      return res.status(400).json({ error: 'To rozliczenie zostało już całkowicie spłacone.' });
    }

    const payAmount = parseValidAmount(req.body.amount);
    if (!payAmount) {
      return res.status(400).json({ error: 'Wprowadź prawidłową kwotę wpłaty (np. 25.00).' });
    }

    if (payAmount > debt.remaining_amount + 0.005) {
      return res.status(400).json({
        error: `Kwota wpłaty (${payAmount.toFixed(2)}) nie może być większa niż pozostały dług (${debt.remaining_amount.toFixed(2)} ${debt.currency || 'PLN'}).`
      });
    }

    const payDate = new Date().toISOString().split('T')[0];
    const rawNote = req.body.note;
    const noteText = typeof rawNote === 'string' && rawNote.trim() ? rawNote.trim().substring(0, 100) : 'Spłata';

    db.run(
      'INSERT INTO payments (debt_id, amount, payment_date, note) VALUES (?, ?, ?, ?)',
      [debtId, payAmount, payDate, noteText]
    );

    const newRemaining = Math.max(0, Math.round((debt.remaining_amount - payAmount) * 100) / 100);
    const newStatus = newRemaining <= 0.005 ? 'SETTLED' : 'PARTIALLY_PAID';

    db.run(
      'UPDATE debts SET remaining_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newRemaining, newStatus, debtId]
    );

    db.logActivity('PAYMENT', `Spłacono ${payAmount.toFixed(2)} ${debt.currency || 'PLN'} dla: ${debt.debtor_name} ➔ ${debt.creditor_name}`);

    res.json({
      message: 'Zarejestrowano spłatę',
      newRemaining,
      newStatus,
      amountPaid: payAmount
    });
  } catch (err) {
    console.error('Błąd rejestracji wpłaty:', err);
    res.status(500).json({ error: 'Błąd podczas rejestracji wpłaty.' });
  }
});

// Całkowite oddanie / spłata
router.post('/:id/settle', (req, res) => {
  try {
    const debtId = parseInt(req.params.id, 10);
    if (!debtId || isNaN(debtId)) {
      return res.status(400).json({ error: 'Nieprawidłowy identyfikator rozliczenia.' });
    }

    const debt = db.queryOne('SELECT * FROM debts WHERE id = ?', [debtId]);
    if (!debt) {
      return res.status(404).json({ error: 'Nie znaleziono takiego rozliczenia.' });
    }

    if (debt.status === 'SETTLED' && debt.remaining_amount <= 0.001) {
      return res.json({ message: 'Rozliczenie było już wcześniej zamknięte.' });
    }

    const remaining = Math.round(debt.remaining_amount * 100) / 100;
    if (remaining > 0) {
      const payDate = new Date().toISOString().split('T')[0];
      db.run(
        'INSERT INTO payments (debt_id, amount, payment_date, note) VALUES (?, ?, ?, ?)',
        [debtId, remaining, payDate, 'Oddano całość']
      );
    }

    db.run(
      "UPDATE debts SET remaining_amount = 0, status = 'SETTLED', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [debtId]
    );

    db.logActivity('PAYMENT_SETTLE', `Oddano całość: ${debt.debtor_name} ➔ ${debt.creditor_name} (${debt.amount.toFixed(2)} ${debt.currency || 'PLN'})`);

    res.json({ message: 'Rozliczone w całości' });
  } catch (err) {
    console.error('Błąd zamykania długu:', err);
    res.status(500).json({ error: 'Błąd podczas rozliczania.' });
  }
});

// Cofnij wpłatę z historii
router.delete('/payments/:paymentId', (req, res) => {
  try {
    const paymentId = parseInt(req.params.paymentId, 10);
    if (!paymentId || isNaN(paymentId)) {
      return res.status(400).json({ error: 'Nieprawidłowy identyfikator wpłaty.' });
    }

    const payment = db.queryOne('SELECT * FROM payments WHERE id = ?', [paymentId]);
    if (!payment) {
      return res.status(404).json({ error: 'Nie znaleziono takiej wpłaty w historii.' });
    }

    const debt = db.queryOne('SELECT * FROM debts WHERE id = ?', [payment.debt_id]);
    if (!debt) {
      return res.status(404).json({ error: 'Rozliczenie powiązane z tą wpłatą nie istnieje.' });
    }

    db.run('DELETE FROM payments WHERE id = ?', [paymentId]);

    const remainingPayments = db.queryAll('SELECT amount FROM payments WHERE debt_id = ?', [debt.id]);
    const totalPaid = remainingPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
    const newRemaining = Math.max(0, Math.round((debt.amount - totalPaid) * 100) / 100);

    let newStatus = 'ACTIVE';
    if (newRemaining <= 0.005) {
      newStatus = 'SETTLED';
    } else if (totalPaid > 0.005) {
      newStatus = 'PARTIALLY_PAID';
    }

    db.run(
      'UPDATE debts SET remaining_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newRemaining, newStatus, debt.id]
    );

    db.logActivity('PAYMENT_UNDO', `Cofnięto wpłatę ${payment.amount.toFixed(2)} zł dla rozliczenia #${debt.id}`);

    res.json({ message: 'Usunięto wpłatę z historii.', newRemaining, newStatus });
  } catch (err) {
    console.error('Błąd usuwania wpłaty:', err);
    res.status(500).json({ error: 'Błąd serwera podczas usuwania wpłaty.' });
  }
});

// Usuń dług
router.delete('/:id', (req, res) => {
  try {
    const debtId = parseInt(req.params.id, 10);
    if (!debtId || isNaN(debtId)) {
      return res.status(400).json({ error: 'Nieprawidłowy identyfikator rozliczenia.' });
    }

    const debt = db.queryOne('SELECT * FROM debts WHERE id = ?', [debtId]);
    if (!debt) {
      return res.status(404).json({ error: 'Nie znaleziono rozliczenia do usunięcia.' });
    }

    db.run('DELETE FROM payments WHERE debt_id = ?', [debtId]);
    db.run('DELETE FROM debts WHERE id = ?', [debtId]);

    db.logActivity('DEBT_DELETE', `Usunięto rozliczenie: ${debt.debtor_name} ➔ ${debt.creditor_name} (${debt.amount.toFixed(2)} ${debt.currency || 'PLN'})`);

    res.json({ message: 'Rozliczenie zostało pomyślnie usunięte.' });
  } catch (err) {
    console.error('Błąd usuwania:', err);
    res.status(500).json({ error: 'Błąd podczas usuwania rozliczenia.' });
  }
});

module.exports = router;
