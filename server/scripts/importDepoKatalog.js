/**
 * depo.xlsx dosyasından malzeme kataloğunu veritabanına aktarır.
 * Kullanım: node server/scripts/importDepoKatalog.js
 */
const path = require('path');
const XLSX = require('xlsx');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '../../data/elektratrack.db');
const EXCEL_PATH = path.join(__dirname, '../../doc/malzeme/depo.xlsx');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Tablo oluştur (eğer yoksa)
db.exec(`
  CREATE TABLE IF NOT EXISTS depo_malzeme_katalogu (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    malzeme_kodu TEXT,
    poz_birlesik TEXT,
    malzeme_tanimi_sap TEXT,
    malzeme_cinsi TEXT NOT NULL,
    olcu TEXT,
    termin TEXT,
    ihale_kesfi REAL DEFAULT 0,
    toplam_talep REAL DEFAULT 0,
    kategori TEXT,
    alt_kategori TEXT,
    is_category INTEGER DEFAULT 0,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Mevcut verileri temizle
db.exec('DELETE FROM depo_malzeme_katalogu');

// Excel oku
const wb = XLSX.readFile(EXCEL_PATH);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

const insert = db.prepare(`
  INSERT INTO depo_malzeme_katalogu
  (malzeme_kodu, poz_birlesik, malzeme_tanimi_sap, malzeme_cinsi, olcu, termin, ihale_kesfi, toplam_talep, kategori, alt_kategori, is_category)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let currentKategori = null;
let currentAltKategori = null;
let inserted = 0;
let skipped = 0;

const transaction = db.transaction(() => {
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const malzemeKodu = row[0] != null ? String(row[0]) : null;
    const pozBirlesik = row[1] != null ? String(row[1]).trim() : null;
    const malzemeTanimiSap = row[2] != null ? String(row[2]).trim() : null;
    const malzemeCinsi = row[3] != null ? String(row[3]).trim() : null;
    const olcu = row[4] != null ? String(row[4]).trim() : null;
    const termin = row[5] != null ? String(row[5]).trim() : null;
    const ihaleKesfi = typeof row[6] === 'number' ? row[6] : 0;
    const toplamTalep = typeof row[8] === 'number' ? row[8] : 0;

    // Boş satırları atla
    if (!malzemeCinsi && !pozBirlesik) {
      skipped++;
      continue;
    }

    // Kategori tespiti: ölçü birimi yok + malzeme kodu yok + ALL CAPS isim
    const isCategory = !malzemeKodu && !olcu && malzemeCinsi && malzemeCinsi === malzemeCinsi.toUpperCase();
    // Alt-kategori: ölçü birimi yok + malzeme kodu yok ama ALL CAPS değil
    const isSubCategory = !malzemeKodu && !olcu && malzemeCinsi && malzemeCinsi !== malzemeCinsi.toUpperCase();

    if (isCategory) {
      currentKategori = malzemeCinsi;
      currentAltKategori = null;
    } else if (isSubCategory) {
      currentAltKategori = malzemeCinsi;
    }

    insert.run(
      malzemeKodu,
      pozBirlesik,
      malzemeTanimiSap,
      malzemeCinsi,
      olcu,
      termin,
      ihaleKesfi,
      toplamTalep,
      currentKategori,
      isCategory ? null : (isSubCategory ? null : currentAltKategori),
      isCategory || isSubCategory ? 1 : 0
    );
    inserted++;
  }
});

transaction();

console.log(`Toplam satır: ${rows.length - 1}`);
console.log(`Eklenen: ${inserted}`);
console.log(`Atlanan (boş): ${skipped}`);

// İstatistikler
const stats = db.prepare('SELECT COUNT(*) as toplam, COUNT(DISTINCT kategori) as kategori_sayisi, COUNT(DISTINCT olcu) as olcu_sayisi FROM depo_malzeme_katalogu WHERE is_category = 0').get();
console.log(`\nKatalog istatistikleri:`);
console.log(`  Toplam malzeme: ${stats.toplam}`);
console.log(`  Kategori sayısı: ${stats.kategori_sayisi}`);
console.log(`  Ölçü birimi çeşidi: ${stats.olcu_sayisi}`);

db.close();
console.log('\nImport tamamlandı!');
