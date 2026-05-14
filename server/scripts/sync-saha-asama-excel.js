// doc/ilerleme-11.05.xlsx O sütunundaki "İŞ DURUMU" değerlerini DB'deki
// projeler.saha_asama kolonuna yansıtır.
//
// Eşleştirme anahtarı (öncelik sırası):
//   1) L sütunu (PROJE ADI) ↔ projeler.musteri_adi  — birincil anahtar
//   2) C sütunu (PYP no) ↔ projeler.proje_no       — fallback (L bulamazsa)
//      Excel format:  "26.BATI.YB.1.037"
//      DB format:     "26.YB.1.037"
//      → orta bölge segmentini strip ile eşleşir.
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
// Proje adı normalize — case + boşluk + Türkçe karakter sadeleştirme (ı/I/İ → i, vs.)
// "AKİF DUMAN", "Akif Duman", "AKİF  DUMAN " hepsi aynı anahtara düşer.
function normalizeAd(s) {
  if (!s) return '';
  return String(s).trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('tr')
    .replace(/[ıİiI]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .replace(/[^\w\s]/g, ''); // noktalama at
}

// I sütununda 7-8 haneli başvuru numarası — DB'deki musteri_adi içinde ara
function basvuruDan(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{6,9})/);
  return m ? m[1] : null;
}

function main() {
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // R6 başlık, R7'den itibaren veri.
  // C (idx 2) = PYP, L (idx 11) = PROJE ADI, O (idx 14) = İŞ DURUMU
  const istatistik = {
    dolu: 0, eslesemedi: 0, bilinmeyenDurum: new Map(),
    guncellenecek: [], degismeyecek: 0,
    adIleEslesen: 0, pypIleEslesen: 0, basvuruIleEslesen: 0,
  };
  const db = new Database(DB_PATH);
  const projeGetirNo = db.prepare('SELECT id, proje_no, musteri_adi, saha_asama FROM projeler WHERE proje_no = ?');
  // Proje adı eşleşmesi — case-insensitive, Türkçe karakter normalize
  const tumProjeler = db.prepare('SELECT id, proje_no, musteri_adi, saha_asama FROM projeler').all();
  // Aynı normalize anahtara düşen birden fazla proje olabilir (duplicate kayıtlar);
  // hepsini güncellemek için array tutuyoruz.
  const adIndex = new Map();
  const basvuruIndex = new Map();
  for (const p of tumProjeler) {
    const k = normalizeAd(p.musteri_adi);
    if (k) {
      if (!adIndex.has(k)) adIndex.set(k, [p]);
      else adIndex.get(k).push(p);
    }
    const bn = basvuruDan(p.musteri_adi);
    if (bn) {
      if (!basvuruIndex.has(bn)) basvuruIndex.set(bn, [p]);
      else basvuruIndex.get(bn).push(p);
    }
  }
  const guncelle = db.prepare('UPDATE projeler SET saha_asama = ?, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?');

  for (let i = 6; i < rows.length; i++) {
    const r = rows[i];
    const pypHam = String(r[2] || '').trim();
    const basvuruHam = String(r[8] || '').trim();
    const adHam = String(r[11] || '').trim();
    const durumHam = String(r[14] || '').trim();
    // Durum yoksa veya hiçbir anahtar yoksa atla
    if (!durumHam) continue;
    if (!pypHam && !adHam && !basvuruHam) continue;
    istatistik.dolu++;

    const yeniSaha = EXCEL_TO_SAHA[durumHam];
    if (!yeniSaha) {
      istatistik.bilinmeyenDurum.set(durumHam, (istatistik.bilinmeyenDurum.get(durumHam) || 0) + 1);
      continue;
    }

    // 1) Proje adı (L) — Türkçe karakter normalize
    let projeler = null;
    let yolu = '';
    if (adHam) {
      const bulunan = adIndex.get(normalizeAd(adHam));
      if (bulunan?.length) { projeler = bulunan; yolu = 'L'; istatistik.adIleEslesen++; }
    }
    // 2) PYP no (C) fallback
    if (!projeler && pypHam && pypHam !== '-') {
      const tek = projeGetirNo.get(normalizeProjeNo(pypHam));
      if (tek) { projeler = [tek]; yolu = 'C'; istatistik.pypIleEslesen++; }
    }
    // 3) Başvuru no (I) fallback
    if (!projeler) {
      const bn = basvuruDan(basvuruHam) || basvuruDan(adHam);
      if (bn) {
        const bulunan = basvuruIndex.get(bn);
        if (bulunan?.length) { projeler = bulunan; yolu = 'I'; istatistik.basvuruIleEslesen++; }
      }
    }

    if (!projeler) {
      istatistik.eslesemedi++;
      if (istatistik.eslesemedi <= 15) {
        console.warn(`  ! Eşleşmedi: PYP="${pypHam}" BASVURU="${basvuruHam}" AD="${adHam.slice(0,50)}"`);
      }
      continue;
    }
    // Aynı isimde birden fazla proje varsa hepsini güncelle
    for (const proje of projeler) {
      if (proje.saha_asama === yeniSaha) { istatistik.degismeyecek++; continue; }
      istatistik.guncellenecek.push({
        id: proje.id, proje_no: proje.proje_no, musteri_adi: proje.musteri_adi,
        eski: proje.saha_asama, yeni: yeniSaha, yolu,
      });
    }
  }

  console.log('\n=== Özet ===');
  console.log(`Excel'de durumu olan satır:        ${istatistik.dolu}`);
  console.log(`Proje adı (L) ile eşleşen:        ${istatistik.adIleEslesen}`);
  console.log(`PYP no (C) fallback ile eşleşen:  ${istatistik.pypIleEslesen}`);
  console.log(`Başvuru no (I) fallback eşleşen:  ${istatistik.basvuruIleEslesen}`);
  console.log(`DB ile eşleşmeyen:                ${istatistik.eslesemedi}`);
  console.log(`Aynı durum (atlanacak):           ${istatistik.degismeyecek}`);
  console.log(`Güncellenecek:                    ${istatistik.guncellenecek.length}`);
  if (istatistik.bilinmeyenDurum.size > 0) {
    console.log('Tanınmayan Excel durumları:');
    for (const [d, n] of istatistik.bilinmeyenDurum) console.log(`  [${d}] (${n} satır)`);
  }

  console.log('\nÖrnek güncellemeler (ilk 12):');
  istatistik.guncellenecek.slice(0, 12).forEach(g => {
    const adKisa = (g.musteri_adi || '').slice(0, 32);
    console.log(`  [${g.yolu}] ${g.proje_no.padEnd(20)} ${adKisa.padEnd(34)} ${String(g.eski || '∅').padEnd(22)} → ${g.yeni}`);
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
