const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'oddaj.sqlite');

let sqlDb = null;
let SQL = null;

function saveDatabase() {
  if (!sqlDb) return;
  try {
    const data = sqlDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (err) {
    console.error('Błąd zapisu bazy danych na dysk:', err);
  }
}

async function initDatabase() {
  if (sqlDb) return sqlDb;

  SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
  }

  // Włączenie kluczy obcych i utworzenie tabel z obsługą dłużnik -> wierzyciel
  sqlDb.run(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      phone TEXT,
      email TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debtor_name TEXT NOT NULL,
      creditor_name TEXT NOT NULL,
      title TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount > 0),
      remaining_amount REAL NOT NULL CHECK (remaining_amount >= 0),
      currency TEXT NOT NULL DEFAULT 'PLN',
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PARTIALLY_PAID', 'SETTLED')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debt_id INTEGER NOT NULL,
      amount REAL NOT NULL CHECK (amount > 0),
      payment_date TEXT NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migracja tabeli debts w celu usunięcia starych ograniczeń NOT NULL (contact_id, type, category)
  try {
    const tableInfo = sqlDb.exec("PRAGMA table_info(debts);");
    const columns = tableInfo[0]?.values?.map(row => row[1]) || [];
    
    if (columns.includes('contact_id')) {
      console.log('Przeprowadzanie pełnej migracji tabeli debts do nowego schematu...');
      sqlDb.run(`PRAGMA foreign_keys = OFF;`);

      sqlDb.run(`
        CREATE TABLE IF NOT EXISTS debts_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          debtor_name TEXT NOT NULL,
          creditor_name TEXT NOT NULL,
          title TEXT NOT NULL,
          amount REAL NOT NULL CHECK (amount > 0),
          remaining_amount REAL NOT NULL CHECK (remaining_amount >= 0),
          currency TEXT NOT NULL DEFAULT 'PLN',
          status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PARTIALLY_PAID', 'SETTLED')),
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      sqlDb.run(`
        INSERT INTO debts_v2 (id, debtor_name, creditor_name, title, amount, remaining_amount, currency, status, notes, created_at, updated_at)
        SELECT 
          id, 
          COALESCE(debtor_name, CASE WHEN type = 'I_OWE' THEN 'Ja' ELSE 'Znajomy' END),
          COALESCE(creditor_name, CASE WHEN type = 'THEY_OWE' THEN 'Ja' ELSE 'Znajomy' END),
          COALESCE(title, 'Rozliczenie'),
          amount,
          remaining_amount,
          COALESCE(currency, 'PLN'),
          COALESCE(status, 'ACTIVE'),
          notes,
          COALESCE(created_at, CURRENT_TIMESTAMP),
          COALESCE(updated_at, CURRENT_TIMESTAMP)
        FROM debts;
      `);

      sqlDb.run(`DROP TABLE debts;`);
      sqlDb.run(`ALTER TABLE debts_v2 RENAME TO debts;`);
      sqlDb.run(`PRAGMA foreign_keys = ON;`);
      saveDatabase();
      console.log('Migracja tabeli debts zakończona sukcesem!');
    }
  } catch (e) {
    console.error('Błąd migracji tabeli debts:', e);
  }

  // Jeśli baza jest pusta - dodaj przykładowe dane pokazujące relacje między różnymi osobami
  const countStmt = sqlDb.prepare('SELECT COUNT(*) as count FROM debts');
  countStmt.step();
  const debtsCount = countStmt.getAsObject().count;
  countStmt.free();

  if (debtsCount === 0) {
    console.log('Inicjalizacja startowych danych z relacjami między wieloma osobami...');
    sqlDb.run(`
      INSERT INTO debts (debtor_name, creditor_name, title, amount, remaining_amount, currency, status) VALUES
        ('Marek', 'Ja', 'Pizza ze znajomymi', 45.00, 45.00, 'PLN', 'ACTIVE'),
        ('Ja', 'Piotrek', 'Paliwo za wyjazd', 60.00, 60.00, 'PLN', 'ACTIVE'),
        ('Ania', 'Tomek', 'Bilety do kina', 70.00, 35.00, 'PLN', 'PARTIALLY_PAID'),
        ('Krzysiek', 'Marek', 'Zrzutka na prezent', 50.00, 50.00, 'PLN', 'ACTIVE');
    `);

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    sqlDb.run(`
      INSERT INTO payments (debt_id, amount, payment_date, note) VALUES
        (3, 35.00, '${yesterday}', 'Część oddana');
    `);
  }

  saveDatabase();
  return sqlDb;
}

const dbHelper = {
  async init() {
    return await initDatabase();
  },

  queryAll(sql, params = []) {
    const stmt = sqlDb.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },

  queryOne(sql, params = []) {
    const list = this.queryAll(sql, params);
    return list.length > 0 ? list[0] : null;
  },

  run(sql, params = []) {
    sqlDb.run(sql, params);

    let lastInsertRowid = 0;
    let changes = 0;
    try {
      const lastIdRes = sqlDb.exec('SELECT last_insert_rowid() as id');
      if (lastIdRes.length > 0 && lastIdRes[0].values.length > 0) {
        lastInsertRowid = lastIdRes[0].values[0][0];
      }
      const changesRes = sqlDb.exec('SELECT changes() as changes');
      if (changesRes.length > 0 && changesRes[0].values.length > 0) {
        changes = changesRes[0].values[0][0];
      }
    } catch (e) {}

    saveDatabase();

    return {
      lastInsertRowid,
      changes
    };
  },

  logActivity(actionType, description) {
    try {
      this.run('INSERT INTO activity_logs (action_type, description) VALUES (?, ?)', [actionType, description]);
    } catch (e) {
      console.error('Błąd logowania aktywności:', e);
    }
  },

  getDbPath() {
    return dbPath;
  }
};

module.exports = dbHelper;
