// doc/ilerleme-11.05.xlsx O sütunundaki "İŞ DURUMU" değerlerini DB'deki
// projeler.saha_asama kolonuna yansıtır.
//
// Eşleştirme anahtarı: Excel C sütunu (PYP no) → DB proje_no
//   Excel format:  "26.BATI.YB.1.037"
//   DB format:     "26.YB.1.037"
//   → "BATI." (ya da bölge adı) strip ile eşleşir.
//
// Excel değerleri → saha kodu:
//   'YER TESLİMİ YAPILMADI' → yer_teslimi_yapilmadi
//   'YER TESLİMİ YAPILDI'   → yer_teslimi_yapildi
//   'DEVAM EDİYOR'          → devam_ediyor
//   'TAMAMLANDI'            → tamamlandi
//
// Kullanım:
//   node server/scripts/sync-saha-asama-excel.js          (dry-run)
//   node server/scripts/sync-saha-asama-excel.js --apply  (uygula)

const path = require('path');
const XLSX = require('xlsx');
const Database = require('better-sqlite3');

const ROOT = path.resolve(__dirname, '../../');
const XLSX_PATH = path.join(ROOT, 'doc/ilerleme-11.05.xlsx');
const DB_PATH = path.join(ROOT, 'data/tenants/cakmakgrup/elektratrack.db');
const APPLY = process.argv.includes('--apply');

const EXCEL_TO_SAHA = {
  'YER TESLİMİ YAPILMADI': 'yer_teslimi_yapilmadi',
  'YER TESLİMİ YAPILDI':   'yer_teslimi_yapildi',
  'DEVAM EDİYOR':          'devam_ediyor',
  'TAMAMLANDI':            'tamamlandi',
};

// "26.BATI.YB.1.037" → "26.YB.1.037" (orta segment bölge adı: BATI/DOĞU/MERKEZ vs.)
function normalizeProjeNo(s) {
  if (!s) return '';
  return String(s).trim().replace(/^(\d+)\.[A-ZÇĞİÖŞÜ]+\.(YB|KET|BAKIM)\./i, '$1.$2.');
}

function main() {
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // R6 başlık, R7'den itibaren veri. C (idx 2) = PYP, O (idx 14) = İŞ DURUMU
  const istatistik = { dolu: 0, eslesemedi: 0, bilinmeyenDurum: new Map(), guncellenecek: [], degismeyecek: 0 };
  const db = new Database(DB_PATH);
  const projeGetir = db.prepare('SELECT id, proje_no, saha_asama FROM projeler WHERE proje_no = ?');
  const guncelle  = db.prepare('UPDATE projeler SET saha_asama = ?, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?');

  for (let i = 6; i < rows.length; i++) {
    const r = rows[i];
    const pypHam = String(r[2] || '').trim();
    const durumHam = String(r[14] || '').trim();
    if (!pypHam || !durumHam || pypHam === '-') continue;
    istatistik.dolu++;

    const yeniSaha = EXCEL_TO_SAHA[durumHam];
    if (!yeniSaha) {
      istatistik.bilinmeyenDurum.set(durumHam, (istatistik.bilinmeyenDurum.get(durumHam) || 0) + 1);
      continue;
    }

    const normPyp = normalizeProjeNo(pypHam);
    const proje = projeGetir.get(normPyp);
    if (!proje) {
      istatistik.eslesemedi++;
      if (istatistik.eslesemedi <= 5) console.warn(`  ! Eşleşmedi: ${pypHam} (→ ${normPyp})`);
      continue;
    }
    if (proje.saha_asama === yeniSaha) {
      istatistik.degismeyecek++;
      continue;
    }
    istatistik.guncellenecek.push({ id: proje.id, proje_no: proje.proje_no, eski: proje.saha_asama, yeni: yeniSaha });
  }

  console.log('\n=== Özet ===');
  console.log(`Excel'de durumu olan satır: ${istatistik.dolu}`);
  console.log(`DB ile eşleşmeyen:          ${istatistik.eslesemedi}`);
  console.log(`Aynı durum (atlanacak):     ${istatistik.degismeyecek}`);
  console.log(`Güncellenecek:              ${istatistik.guncellenecek.length}`);
  if (istatistik.bilinmeyenDurum.size > 0) {
    console.log('Tanınmayan Excel durumları:');
    for (const [d, n] of istatistik.bilinmeyenDurum) console.log(`  [${d}] (${n} satır)`);
  }

  console.log('\nÖrnek güncellemeler (ilk 10):');
  istatistik.guncellenecek.slice(0, 10).forEach(g => {
    console.log(`  ${g.proje_no.padEnd(20)} ${String(g.eski || '∅').padEnd(20)} → ${g.yeni}`);
  });

  if (!APPLY) {
    console.log('\n[DRY-RUN] --apply ile çalıştırarak uygulayın.');
    db.close();
    return;
  }

  const tx = db.transaction(() => {
    for (const g of istatistik.guncellenecek) guncelle.run(g.yeni, g.id);
  });
  tx();
  console.log(`\n✓ ${istatistik.guncellenecek.length} proje güncellendi.`);
  db.close();
}

main();
