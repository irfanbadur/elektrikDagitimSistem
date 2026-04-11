/**
 * Samsun_Bati_Ket.xlsx'ten malzeme kataloğunu import et
 * Kullanım: node --max-old-space-size=2048 server/scripts/importMalzemeKatalog.js
 */
const path = require('path');
const XLSX = require('xlsx');
const { getDb, initDatabase } = require('../db/database');

initDatabase();
const db = getDb();

console.log('=== Malzeme Katalog Import ===\n');

// 1. Mevcut kataloğu temizle
console.log('1. Mevcut katalog temizleniyor...');
db.exec('DELETE FROM depo_malzeme_katalogu');
console.log('   Temizlendi.\n');

// 2. Excel'i oku
console.log('2. Excel dosyası okunuyor (40MB, biraz sürebilir)...');
const wb = XLSX.readFile(path.join(__dirname, '../../doc/malzeme/Samsun_Bati_Ket.xlsx'));
const ws = wb.Sheets[wb.SheetNames[0]];
const range = XLSX.utils.decode_range(ws['!ref']);
console.log(`   Sheet: ${wb.SheetNames[0]}, Satırlar: ${range.e.r + 1}\n`);

// 3. Malzemeleri ekle
console.log('3. Malzemeler ekleniyor...');

const cell = (r, c) => ws[XLSX.utils.encode_cell({ r, c })]?.v || null;
const numCell = (r, c) => {
  const v = cell(r, c);
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

const insert = db.prepare(`
  INSERT INTO depo_malzeme_katalogu (
    poz_birlesik, eski_poz, malzeme_kodu, termin, malzeme_cinsi,
    olcu, agirlik, malzeme_birim_fiyat, montaj_birim_fiyat, demontaj_birim_fiyat, demontajdan_montaj_fiyat, malzeme_sap_fiyat,
    filtre, kategori, is_category
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let eklenen = 0, atlanan = 0;
let sonKategori = '';

const insertAll = db.transaction(() => {
  // Header row 4 (index 3), data starts row 5 (index 4)
  for (let r = 4; r <= range.e.r; r++) {
    const pozBirlesik = cell(r, 1); // B
    const malzemeCinsi = cell(r, 5); // F

    if (!malzemeCinsi && !pozBirlesik) { atlanan++; continue; }

    const eskiPoz = cell(r, 2) ? String(cell(r, 2)) : null; // C
    const malzemeKodu = cell(r, 3) ? String(cell(r, 3)) : null; // D
    const malzemeTermini = cell(r, 4) ? String(cell(r, 4)) : null; // E
    const cinsi = malzemeCinsi ? String(malzemeCinsi) : '';
    const olcu = cell(r, 6) ? String(cell(r, 6)) : null; // G
    const agirlik = numCell(r, 7); // H
    const malzemeFiyat = numCell(r, 8); // I
    const montajFiyat = numCell(r, 9); // J
    const demontajFiyat = numCell(r, 10); // K
    const demontajdanMontajFiyat = numCell(r, 11); // L
    const sapFiyat = numCell(r, 18); // S
    const filtre = cell(r, 0) ? String(cell(r, 0)) : null; // A

    // Kategori tespiti: birim yoksa ve alt satırları olan başlık satırı
    const isKategori = pozBirlesik && cinsi && !olcu && malzemeFiyat === 0 && montajFiyat === 0;
    if (isKategori) sonKategori = cinsi;

    try {
      insert.run(
        pozBirlesik ? String(pozBirlesik) : null,
        eskiPoz, malzemeKodu, malzemeTermini, cinsi || sonKategori,
        olcu, agirlik || null, malzemeFiyat, montajFiyat, demontajFiyat, demontajdanMontajFiyat, sapFiyat,
        filtre, sonKategori, isKategori ? 1 : 0
      );
      eklenen++;
      if (eklenen % 1000 === 0) console.log(`   ${eklenen} malzeme eklendi...`);
    } catch (err) {
      atlanan++;
    }
  }
});

insertAll();

console.log(`\n=== Tamamlandı ===`);
console.log(`Eklenen: ${eklenen}`);
console.log(`Atlanan: ${atlanan}`);
console.log(`Toplam katalog: ${db.prepare('SELECT COUNT(*) as c FROM depo_malzeme_katalogu').get().c}`);
console.log(`Fiyatlı: ${db.prepare('SELECT COUNT(*) as c FROM depo_malzeme_katalogu WHERE malzeme_birim_fiyat > 0 OR montaj_birim_fiyat > 0 OR malzeme_sap_fiyat > 0').get().c}`);
