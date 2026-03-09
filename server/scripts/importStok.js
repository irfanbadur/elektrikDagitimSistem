/**
 * stok.XLSX dosyasından sayım verilerini depo_malzeme_katalogu tablosuna aktarır.
 * SAYIM sütununu stok_miktar olarak kullanır.
 * Kullanım: node server/scripts/importStok.js
 */
const path = require('path');
const XLSX = require('xlsx');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '../../data/elektratrack.db');
const EXCEL_PATH = path.join(__dirname, '../../doc/malzeme/stok.XLSX');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Stok sütunları ekle (yoksa)
try { db.exec('ALTER TABLE depo_malzeme_katalogu ADD COLUMN stok_miktar REAL DEFAULT 0'); } catch(e) {}
try { db.exec('ALTER TABLE depo_malzeme_katalogu ADD COLUMN depo_yeri TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE depo_malzeme_katalogu ADD COLUMN depo_tanimi TEXT'); } catch(e) {}

// Excel oku
const wb = XLSX.readFile(EXCEL_PATH);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

// Headers: Depo yeri, Depo yeri tanımı, Malzeme, Malzeme kısa metni, Ölçü birimi, Stok, SAYIM, Fark

const updateStmt = db.prepare(`
  UPDATE depo_malzeme_katalogu
  SET stok_miktar = ?, depo_yeri = ?, depo_tanimi = ?
  WHERE malzeme_kodu = ?
`);

const insertStmt = db.prepare(`
  INSERT INTO depo_malzeme_katalogu
  (malzeme_kodu, malzeme_cinsi, olcu, stok_miktar, depo_yeri, depo_tanimi, is_category)
  VALUES (?, ?, ?, ?, ?, ?, 0)
`);

let guncellenen = 0;
let eklenen = 0;

const transaction = db.transaction(() => {
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const depoYeri = row[0] ? String(row[0]).trim() : null;
    const depoTanimi = row[1] ? String(row[1]).trim() : null;
    const malzemeKodu = row[2] != null ? String(row[2]) : null;
    const malzemeAdi = row[3] ? String(row[3]).trim() : null;
    const olcu = row[4] ? String(row[4]).trim() : null;
    const sayim = typeof row[6] === 'number' ? row[6] : 0;

    if (!malzemeKodu) continue;

    // Katalogda var mı?
    const mevcut = db.prepare('SELECT id FROM depo_malzeme_katalogu WHERE malzeme_kodu = ?').get(malzemeKodu);

    if (mevcut) {
      updateStmt.run(sayim, depoYeri, depoTanimi, malzemeKodu);
      guncellenen++;
    } else {
      // Katalogda yok, yeni kayıt ekle
      insertStmt.run(malzemeKodu, malzemeAdi, olcu, sayim, depoYeri, depoTanimi);
      eklenen++;
    }
  }
});

transaction();

// İstatistikler
const stoklu = db.prepare('SELECT COUNT(*) as c FROM depo_malzeme_katalogu WHERE stok_miktar > 0').get();
const toplamStok = db.prepare('SELECT SUM(stok_miktar) as t FROM depo_malzeme_katalogu WHERE stok_miktar > 0').get();

console.log(`Güncellenen: ${guncellenen}`);
console.log(`Yeni eklenen: ${eklenen}`);
console.log(`Stoklu malzeme: ${stoklu.c}`);
console.log(`Toplam stok miktarı: ${toplamStok.t}`);
console.log('\nImport tamamlandı!');

db.close();
