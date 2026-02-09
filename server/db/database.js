const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/elektratrack.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const SEED_PATH = path.join(__dirname, 'seed.sql');

let db;

function getDb() {
  if (!db) {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function addColumnIfNotExists(database, table, column, type) {
  const columns = database.pragma(`table_info(${table})`);
  const exists = columns.some(c => c.name === column);
  if (!exists) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    console.log(`✅ ${table}.${column} sütunu eklendi`);
  }
}

function runMigrations(database) {
  // Ekipler tablosuna konum alanları
  addColumnIfNotExists(database, 'ekipler', 'son_latitude', 'REAL');
  addColumnIfNotExists(database, 'ekipler', 'son_longitude', 'REAL');
  addColumnIfNotExists(database, 'ekipler', 'son_konum_zamani', 'DATETIME');
  addColumnIfNotExists(database, 'ekipler', 'son_konum_kaynagi', 'TEXT');
}

function initDatabase() {
  const database = getDb();
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  database.exec(schema);

  runMigrations(database);

  const count = database.prepare('SELECT COUNT(*) as c FROM personel').get();
  if (count.c === 0) {
    const seed = fs.readFileSync(SEED_PATH, 'utf8');
    database.exec(seed);
    console.log('Örnek veri yüklendi.');
  }
}

module.exports = { getDb, initDatabase };
