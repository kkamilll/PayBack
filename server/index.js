const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const contactsRouter = require('./routes/contacts');
const debtsRouter = require('./routes/debts');
const statsRouter = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serwowanie plików statycznych frontendu
app.use(express.static(path.join(__dirname, '..', 'public')));

// Trasy API
app.use('/api/contacts', contactsRouter);
app.use('/api/debts', debtsRouter);
app.use('/api/stats', statsRouter);

// Alias dla listy osób
app.get('/api/people', (req, res) => {
  try {
    const peopleRows = db.queryAll(`
      SELECT DISTINCT debtor_name AS name FROM debts
      UNION
      SELECT DISTINCT creditor_name AS name FROM debts
    `);
    const list = peopleRows.map(r => r.name).filter(Boolean);
    res.json(list);
  } catch (err) {
    res.json([]);
  }
});

// Fallback dla SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start serwera po inicjalizacji bazy danych
async function start() {
  try {
    await db.init();
    app.listen(PORT, () => {
      console.log(`=============================================`);
      console.log(`🚀 Aplikacja OddajTo działa na porcie: ${PORT}`);
      console.log(`🌐 Otwórz w przeglądarce: http://localhost:${PORT}`);
      console.log(`💾 Baza danych SQLite: ${db.getDbPath()}`);
      console.log(`=============================================`);
    });
  } catch (err) {
    console.error('Błąd podczas uruchamiania serwera:', err);
    process.exit(1);
  }
}

start();
