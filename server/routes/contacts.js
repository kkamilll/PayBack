const express = require('express');
const router = express.Router();
const db = require('../db');

function sanitize(str) {
  return typeof str === 'string' ? str.trim() : '';
}

// Pobierz wszystkie kontakty wraz z zagregowanym bilansem
router.get('/', (req, res) => {
  try {
    const contacts = db.queryAll('SELECT * FROM contacts ORDER BY name ASC');

    const result = contacts.map(c => {
      const contactName = c.name.toLowerCase();

      const theyOweMeRow = db.queryOne(`
        SELECT COALESCE(SUM(remaining_amount), 0) AS total
        FROM debts
        WHERE status != 'SETTLED'
          AND LOWER(debtor_name) = ?
          AND (LOWER(creditor_name) = 'ja' OR LOWER(creditor_name) = 'me')
      `, [contactName]);

      const iOweThemRow = db.queryOne(`
        SELECT COALESCE(SUM(remaining_amount), 0) AS total
        FROM debts
        WHERE status != 'SETTLED'
          AND LOWER(creditor_name) = ?
          AND (LOWER(debtor_name) = 'ja' OR LOWER(debtor_name) = 'me')
      `, [contactName]);

      const activeCountRow = db.queryOne(`
        SELECT COUNT(*) AS count
        FROM debts
        WHERE status != 'SETTLED'
          AND (LOWER(debtor_name) = ? OR LOWER(creditor_name) = ?)
      `, [contactName, contactName]);

      const allCountRow = db.queryOne(`
        SELECT COUNT(*) AS count
        FROM debts
        WHERE LOWER(debtor_name) = ? OR LOWER(creditor_name) = ?
      `, [contactName, contactName]);

      const totalTheyOwe = theyOweMeRow ? theyOweMeRow.total : 0;
      const totalIOwe = iOweThemRow ? iOweThemRow.total : 0;

      return {
        ...c,
        total_they_owe: Math.round(totalTheyOwe * 100) / 100,
        total_i_owe: Math.round(totalIOwe * 100) / 100,
        net_balance: Math.round((totalTheyOwe - totalIOwe) * 100) / 100,
        active_debts_count: activeCountRow ? activeCountRow.count : 0,
        all_debts_count: allCountRow ? allCountRow.count : 0
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Błąd pobierania kontaktów:', err);
    res.status(500).json({ error: 'Nie udało się pobrać listy kontaktów' });
  }
});

// Pobierz pojedynczy kontakt z historią rozliczeń
router.get('/:id', (req, res) => {
  try {
    const contactId = parseInt(req.params.id, 10);
    const contact = db.queryOne('SELECT * FROM contacts WHERE id = ?', [contactId]);
    if (!contact) {
      return res.status(404).json({ error: 'Nie znaleziono osoby' });
    }

    const contactName = contact.name.toLowerCase();
    const debts = db.queryAll(`
      SELECT * FROM debts 
      WHERE LOWER(debtor_name) = ? OR LOWER(creditor_name) = ?
      ORDER BY created_at DESC
    `, [contactName, contactName]);

    // Dołącz historię wpłat
    const debtsWithPayments = debts.map(debt => {
      const payments = db.queryAll('SELECT * FROM payments WHERE debt_id = ? ORDER BY payment_date DESC, created_at DESC', [debt.id]);
      return { ...debt, payments };
    });

    res.json({
      contact,
      debts: debtsWithPayments
    });
  } catch (err) {
    console.error('Błąd pobierania szczegółów kontaktu:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Dodaj nowy kontakt
router.post('/', (req, res) => {
  try {
    const name = sanitize(req.body.name);
    const phone = sanitize(req.body.phone);
    const email = sanitize(req.body.email);
    const notes = sanitize(req.body.notes);

    if (!name) {
      return res.status(400).json({ error: 'Nazwa osoby jest wymagana' });
    }

    if (name.length > 60) {
      return res.status(400).json({ error: 'Nazwa osoby może mieć maksymalnie 60 znaków' });
    }

    const existing = db.queryOne('SELECT id FROM contacts WHERE LOWER(name) = LOWER(?)', [name]);
    if (existing) {
      return res.status(400).json({ error: 'Osoba o takim imieniu już istnieje w kontaktach', contactId: existing.id });
    }

    const result = db.run(
      'INSERT INTO contacts (name, phone, email, notes) VALUES (?, ?, ?, ?)',
      [name, phone || null, email || null, notes || null]
    );

    db.logActivity('CONTACT_ADD', `Dodano nową osobę: ${name}`);

    const newContact = db.queryOne('SELECT * FROM contacts WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(newContact);
  } catch (err) {
    console.error('Błąd dodawania kontaktu:', err);
    res.status(500).json({ error: 'Nie udało się dodać osoby' });
  }
});

// Edytuj kontakt
router.put('/:id', (req, res) => {
  try {
    const contactId = parseInt(req.params.id, 10);
    const name = sanitize(req.body.name);
    const phone = sanitize(req.body.phone);
    const email = sanitize(req.body.email);
    const notes = sanitize(req.body.notes);

    if (!name) {
      return res.status(400).json({ error: 'Nazwa osoby jest wymagana' });
    }

    const existing = db.queryOne('SELECT id FROM contacts WHERE id = ?', [contactId]);
    if (!existing) {
      return res.status(404).json({ error: 'Nie znaleziono osoby' });
    }

    const nameCheck = db.queryOne('SELECT id FROM contacts WHERE LOWER(name) = LOWER(?) AND id != ?', [name, contactId]);
    if (nameCheck) {
      return res.status(400).json({ error: 'Inna osoba ma już taką nazwę' });
    }

    db.run(
      'UPDATE contacts SET name = ?, phone = ?, email = ?, notes = ? WHERE id = ?',
      [name, phone || null, email || null, notes || null, contactId]
    );

    db.logActivity('CONTACT_EDIT', `Zaktualizowano dane osoby: ${name}`);
    const updated = db.queryOne('SELECT * FROM contacts WHERE id = ?', [contactId]);
    res.json(updated);
  } catch (err) {
    console.error('Błąd edycji kontaktu:', err);
    res.status(500).json({ error: 'Nie udało się zaktualizować osoby' });
  }
});

// Usuń kontakt
router.delete('/:id', (req, res) => {
  try {
    const contactId = parseInt(req.params.id, 10);
    const contact = db.queryOne('SELECT * FROM contacts WHERE id = ?', [contactId]);
    if (!contact) {
      return res.status(404).json({ error: 'Nie znaleziono osoby' });
    }

    db.run('DELETE FROM contacts WHERE id = ?', [contactId]);
    db.logActivity('CONTACT_DELETE', `Usunięto osobę ${contact.name}`);

    res.json({ message: 'Osoba została usunięta' });
  } catch (err) {
    console.error('Błąd usuwania kontaktu:', err);
    res.status(500).json({ error: 'Nie udało się usunąć osoby' });
  }
});

module.exports = router;
