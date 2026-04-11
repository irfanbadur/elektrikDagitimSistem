/**
 * Excel'den proje import scripti
 * Kullanım: node server/scripts/importProjeler.js
 */
const path = require('path');
const ExcelJS = require('exceljs');

// database.js'yi yükle — initDatabase migration'ları çalıştırır
const { getDb, initDatabase } = require('../db/database');
initDatabase();
const db = getDb();

async function run() {
  console.log('=== Proje Import ===\n');

  // 1. Sadece proje verilerini temizle (ekip, personel, depo korunur)
  console.log('1. Proje verileri siliniyor...');
  db.pragma('foreign_keys = OFF');
  db.exec(`
    DELETE FROM bono_kalemleri;
    DELETE FROM bonolar;
    DELETE FROM proje_kesif;
    DELETE FROM dosyalar WHERE alan = 'proje';
    DELETE FROM veri_paketleri WHERE proje_id IS NOT NULL;
    DELETE FROM proje_adimlari;
    DELETE FROM proje_durum_gecmisi;
    DELETE FROM projeler;
  `);
  db.pragma('foreign_keys = ON');
  console.log('   Tüm projeler, adımlar, dosyalar ve keşifler silindi.\n');

  // 2. Upload klasörlerini temizle
  const fs = require('fs');
  const uploadsDir = path.join(__dirname, '../../uploads/projeler');
  if (fs.existsSync(uploadsDir)) {
    fs.rmSync(uploadsDir, { recursive: true, force: true });
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('   Upload klasörleri temizlendi.\n');
  }

  // 3. Excel'i oku
  console.log('2. Excel dosyası okunuyor...');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(__dirname, '../../doc/projeler/proje listesi-1.xlsx'));
  const ws = wb.worksheets[0];

  const cellVal = (row, col) => {
    let v = ws.getRow(row).getCell(col).value;
    if (v && typeof v === 'object' && v.richText) v = v.richText.map(t => t.text).join('');
    if (v && typeof v === 'object' && v.result !== undefined) v = v.result;
    if (v instanceof Date) v = v.toISOString().split('T')[0];
    return v;
  };

  const numVal = (row, col) => {
    let v = cellVal(row, col);
    if (v && typeof v === 'object') v = v.result || v;
    if (typeof v === 'string') v = parseFloat(v.replace(/[^\d.,\-]/g, '').replace(',', '.'));
    return (typeof v === 'number' && !isNaN(v)) ? v : null;
  };

  // 4. Bölge lookup/oluştur
  const bolgeMap = {};
  const bolgeBul = (ad) => {
    if (!ad) return null;
    if (bolgeMap[ad]) return bolgeMap[ad];
    let bolge = db.prepare('SELECT id FROM bolgeler WHERE bolge_adi = ?').get(ad);
    if (!bolge) {
      const r = db.prepare('INSERT INTO bolgeler (bolge_adi) VALUES (?)').run(ad);
      bolge = { id: r.lastInsertRowid };
    }
    bolgeMap[ad] = bolge.id;
    return bolge.id;
  };

  // 5. İş tipi lookup
  const isTipi = db.prepare('SELECT id FROM is_tipleri WHERE UPPER(kod) = ? AND aktif = 1 LIMIT 1');

  // 6. Fazları oluşturan servis
  const fazService = require('../services/fazService');

  // 7. Projeleri ekle
  console.log('3. Projeler ekleniyor...\n');
  const insertProje = db.prepare(`
    INSERT INTO projeler (
      proje_no, proje_tipi, musteri_adi, bolge_id, il, ilce,
      basvuru_no, teslim_tarihi, baslama_tarihi, bitis_tarihi, notlar,
      durum, oncelik, is_tipi_id,
      yil, ihale_no, ihale_adi, yuklenici, tur, cbs_id, cbs_durum,
      is_durumu, demontaj_teslim_durumu, sozlesme_kesfi, kesif_tutari,
      hakedis_miktari, hakedis_yuzdesi, ilerleme_miktari, ilerleme_yuzdesi,
      proje_onay_durumu, is_grubu, proje_baslangic_tarihi, enerjilenme_tarihi, pyp
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `);

  let eklenen = 0, atlanan = 0;

  const MAX_PROJE = 75; // Sadece ilk 75 proje (satır 7-81)
  for (let r = 7; r <= ws.rowCount; r++) {
    if (eklenen >= MAX_PROJE) break;
    const sira = cellVal(r, 1);
    if (!sira || typeof sira !== 'number') continue;

    const pyp = String(cellVal(r, 3) || '').trim();
    const projeAdiRaw = String(cellVal(r, 12) || '').trim();
    if (!pyp && !projeAdiRaw) { atlanan++; continue; }

    // Proje numarası: PYP varsa kullan, yoksa sıra ile oluştur
    let projeNo = (pyp && pyp !== '-') ? pyp : `KET-BEKLEYEN-${String(sira).padStart(3, '0')}`;
    // Duplikat kontrolü — aynı PYP varsa sıra ekle
    const mevcutProje = db.prepare('SELECT id FROM projeler WHERE proje_no = ?').get(projeNo);
    if (mevcutProje) projeNo = `${projeNo}-${sira}`;
    const yil = numVal(r, 2);
    const ihaleNo = String(cellVal(r, 4) || '').trim();
    const ihaleAdi = String(cellVal(r, 5) || '').trim();
    const bolgeAdi = String(cellVal(r, 6) || '').trim();
    const yuklenici = String(cellVal(r, 7) || '').trim();
    const tur = String(cellVal(r, 8) || '').trim();
    const basvuruNo = String(cellVal(r, 9) || '').trim();
    const il = String(cellVal(r, 10) || '').trim();
    const ilce = String(cellVal(r, 11) || '').trim();
    const projeAdi = String(cellVal(r, 12) || '').trim();
    const cbsId = String(cellVal(r, 13) || '').trim();
    const cbsDurum = String(cellVal(r, 14) || '').trim();
    const isDurumu = String(cellVal(r, 15) || '').trim();
    const demontajDurum = String(cellVal(r, 16) || '').trim();
    const sozlesmeKesfi = numVal(r, 17);
    const kesifTutari = numVal(r, 18);
    const hakedisMiktari = numVal(r, 19);
    const hakedisYuzdesi = numVal(r, 20);
    const ilerlemeM = numVal(r, 21);
    const ilerlemeY = numVal(r, 22);
    const projeOnay = String(cellVal(r, 23) || '').trim();
    const isGrubu = String(cellVal(r, 24) || '').trim();
    const yerTeslimTarihi = cellVal(r, 25) || null;
    const isBaslangic = cellVal(r, 26) || null;
    const isBitis = cellVal(r, 27) || null;
    const projeBaslangic = cellVal(r, 28) || null;
    const enerjilenme = cellVal(r, 29) || null;
    const aciklamalar = String(cellVal(r, 30) || '').trim();

    // Proje tipi: TÜR sütunundan çıkar → KET
    const projeTipi = 'KET';
    const bolgeId = bolgeBul(bolgeAdi || null);
    const isTipiRow = isTipi.get(projeTipi);
    const isTipiId = isTipiRow?.id || null;

    // Durum mapping
    let durum = 'baslama';
    if (isDurumu.includes('TAMAMLAN') || isDurumu.includes('BİTTİ')) durum = 'tamamlandi';
    else if (isDurumu.includes('DEVAM')) durum = 'devam_ediyor';
    else if (isDurumu.includes('YER TESLİMİ YAPILDI')) durum = 'baslama';

    try {
      const result = insertProje.run(
        projeNo, projeTipi, projeAdi, bolgeId, il || 'SAMSUN', ilce,
        basvuruNo || null, yerTeslimTarihi, isBaslangic, isBitis, aciklamalar || null,
        durum, 'normal', isTipiId,
        yil, ihaleNo || null, ihaleAdi || null, yuklenici || null, tur || null,
        cbsId || null, cbsDurum || null,
        isDurumu || null, demontajDurum || null, sozlesmeKesfi, kesifTutari,
        hakedisMiktari, hakedisYuzdesi, ilerlemeM, ilerlemeY,
        projeOnay || null, isGrubu || null, projeBaslangic, enerjilenme, pyp
      );
      const projeId = result.lastInsertRowid;

      // Yaşam döngüsü adımlarını oluştur
      if (isTipiId) {
        fazService.projeAdimAta(projeId, isTipiId);
      }

      eklenen++;
      if (eklenen % 50 === 0) console.log(`   ${eklenen} proje eklendi...`);
    } catch (err) {
      console.error(`   HATA (satır ${r}, ${projeNo}):`, err.message);
      atlanan++;
    }
  }

  console.log(`\n=== Tamamlandı ===`);
  console.log(`Eklenen: ${eklenen}`);
  console.log(`Atlanan: ${atlanan}`);
  console.log(`Toplam proje: ${db.prepare('SELECT COUNT(*) as c FROM projeler').get().c}`);
}

run().catch(err => { console.error('FATAL:', err); process.exit(1); });
