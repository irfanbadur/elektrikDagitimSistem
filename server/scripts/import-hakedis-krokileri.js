/**
 * doc/hakediş/KROKİLER/ klasöründeki .dwg/.dxf dosyalarını ilgili projelerin
 * Hak Ediş fazındaki "Hak Ediş Krokisi" adımına kopyalar.
 *
 * Eşleşme: dosya adı (uzantı + "Metraj Krokisi" kuyruğu temizlendikten sonra)
 *          musteri_adi ile fuzzy match.
 *
 * Çalıştırma:
 *   node scripts/import-hakedis-krokileri.js          (uygula)
 *   node scripts/import-hakedis-krokileri.js --dry-run (sadece liste)
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.resolve(__dirname, '../../data/tenants/cakmakgrup/elektratrack.db');
const UPLOADS_ROOT = path.resolve(__dirname, '../../data/tenants/cakmakgrup/uploads');
const KROKI_DIR = path.resolve(__dirname, '../../doc/hakediş/KROKİLER');
const DRY_RUN = process.argv.includes('--dry-run');

const FAZ_KODU = 'hak_edis';
const ADIM_KODU = 'hak_edis_krokisi';
const ADIM_KLASOR = 'Hak_Edis_Krokisi';

function turkceNormalize(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ş/g, 'S')
    .replace(/I/g, 'I').replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/Ğ/g, 'g').replace(/Ü/g, 'u').replace(/Ş/g, 's')
    .replace(/İ/g, 'i').replace(/Ö/g, 'o').replace(/Ç/g, 'c')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

// "Abdulsamet Kalyoncu Metraj Krokisi.dwg" → "ABDULSAMET KALYONCU"
function isimIpucu(dosyaAdi) {
  const tabansiz = dosyaAdi.replace(/\.[^.]+$/, '');
  const norm = turkceNormalize(tabansiz);
  return norm
    .replace(/\b(METRAJ|KROKISI|KROKI|HAKEDIS|HAK EDIS|YB|KET|PROJESI|PROJE)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function eslestir(ipucu, projeler) {
  if (!ipucu) return null;
  const ipuParca = ipucu.split(' ').filter(p => p.length >= 2);
  if (ipuParca.length === 0) return null;

  // 1) Tam içerme: musteri_adi içinde tüm parçalar var mı?
  const tamEsle = projeler.filter(p => {
    const mn = turkceNormalize(p.musteri_adi || '').split(/\s+/);
    return ipuParca.every(parca => mn.includes(parca));
  });
  if (tamEsle.length === 1) return tamEsle[0];
  if (tamEsle.length > 1) {
    // En kısa müşteri adını seç (en spesifik)
    return tamEsle.sort((a, b) => (a.musteri_adi || '').length - (b.musteri_adi || '').length)[0];
  }

  // 2) En çok ortak parça (en az 2)
  const skorlu = projeler.map(p => {
    const mn = turkceNormalize(p.musteri_adi || '').split(/\s+/);
    const ortak = ipuParca.filter(x => mn.includes(x)).length;
    return { p, skor: ortak };
  }).filter(x => x.skor >= 2).sort((a, b) => b.skor - a.skor);

  if (skorlu.length === 1) return skorlu[0].p;
  if (skorlu.length > 1 && skorlu[0].skor > skorlu[1].skor) return skorlu[0].p;

  // 3) Tek parça eşleşen ama tek aday varsa
  const tekParca = projeler.filter(p => {
    const mn = turkceNormalize(p.musteri_adi || '').split(/\s+/);
    return ipuParca.some(x => mn.includes(x));
  });
  if (tekParca.length === 1) return tekParca[0];

  return null;
}

function uzantidanKategori(uzanti) {
  const u = uzanti.toLowerCase();
  if (['pdf', 'doc', 'docx', 'txt'].includes(u)) return 'belge';
  if (['xls', 'xlsx', 'csv'].includes(u)) return 'tablo';
  if (['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(u)) return 'fotograf';
  if (['dwg', 'dxf'].includes(u)) return 'cizim';
  return 'diger';
}

function mimeTipi(uzanti) {
  return ({
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    dwg: 'application/acad', dxf: 'application/dxf',
  })[uzanti.toLowerCase()] || 'application/octet-stream';
}

function isTipiKodu(projeNo) {
  if (projeNo.startsWith('YB-') || projeNo.includes('.YB.')) return 'YB';
  if (projeNo.startsWith('KET-') || projeNo.includes('.KET.')) return 'KET';
  return 'YB'; // varsayılan
}

function aktarUygula(db) {
  const istatistik = { aktarilan: 0, atlanmis: [] };

  if (!fs.existsSync(KROKI_DIR)) {
    console.error('Kroki klasörü bulunamadı:', KROKI_DIR);
    return;
  }

  const projeler = db.prepare(`
    SELECT p.id, p.proje_no, p.musteri_adi, it.kod
    FROM projeler p LEFT JOIN is_tipleri it ON p.is_tipi_id = it.id
  `).all();

  // Sadece DXF: .dwg önizlemede açılamadığı için artık DXF kullanıyoruz.
  // .dwl/.dwl2/.bak/.tmp — kilit ve yedek dosyalar, doğal olarak elenir.
  const dosyalar = fs.readdirSync(KROKI_DIR)
    .filter(d => fs.statSync(path.join(KROKI_DIR, d)).isFile())
    .filter(d => path.extname(d).slice(1).toLowerCase() === 'dxf')
    .filter(d => !d.startsWith('~') && !d.startsWith('.'));

  console.log(`\n========== Hak Ediş Krokileri (${dosyalar.length} dosya) ==========\n`);

  for (const dosyaAdi of dosyalar) {
    const ipucu = isimIpucu(dosyaAdi);
    const proje = eslestir(ipucu, projeler);

    if (!proje) {
      istatistik.atlanmis.push({ dosyaAdi, ipucu, sebep: 'proje-eslesemedi' });
      continue;
    }

    const adim = db.prepare(`
      SELECT id FROM proje_adimlari WHERE proje_id = ? AND faz_kodu = ? AND adim_kodu = ?
    `).get(proje.id, FAZ_KODU, ADIM_KODU);

    if (!adim) {
      istatistik.atlanmis.push({ dosyaAdi, ipucu, sebep: `adim-yok:${FAZ_KODU}/${ADIM_KODU}` });
      continue;
    }

    const uzanti = path.extname(dosyaAdi).slice(1) || 'bin';
    const tabansiz = path.basename(dosyaAdi, path.extname(dosyaAdi));
    const tip = proje.kod || isTipiKodu(proje.proje_no);
    const hedefAdi = `${proje.proje_no}_${slugify(tabansiz)}.${uzanti}`;
    const goreceliYol = `projeler/${tip}/${proje.proje_no}/${ADIM_KLASOR}/${hedefAdi}`;
    const tamHedef = path.join(UPLOADS_ROOT, goreceliYol);

    // Aynı orijinal dosya yüklenmiş mi?
    const mevcut = db.prepare(`
      SELECT id FROM dosyalar WHERE proje_adim_id = ? AND orijinal_adi = ? AND durum = 'aktif' LIMIT 1
    `).get(adim.id, dosyaAdi);
    if (mevcut) {
      istatistik.atlanmis.push({ dosyaAdi, ipucu, sebep: 'zaten-mevcut' });
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [DRY] ${proje.proje_no.padEnd(20)} ← ${dosyaAdi}  (musteri: ${proje.musteri_adi})`);
      istatistik.aktarilan++;
      continue;
    }

    try {
      fs.mkdirSync(path.dirname(tamHedef), { recursive: true });
      const buf = fs.readFileSync(path.join(KROKI_DIR, dosyaAdi));
      fs.writeFileSync(tamHedef, buf);

      db.prepare(`
        INSERT INTO dosyalar (
          dosya_adi, orijinal_adi, dosya_yolu, dosya_boyutu, mime_tipi, kategori,
          alan, alt_alan, proje_id, proje_adim_id, kaynak, durum
        ) VALUES (?, ?, ?, ?, ?, ?, 'proje', ?, ?, ?, 'doc-import', 'aktif')
      `).run(
        hedefAdi, dosyaAdi, goreceliYol, buf.length, mimeTipi(uzanti),
        uzantidanKategori(uzanti), `${tip}/${proje.proje_no}/${ADIM_KLASOR}`,
        proje.id, adim.id
      );

      console.log(`  ✓ ${proje.proje_no.padEnd(20)} ← ${dosyaAdi}  (${proje.musteri_adi})`);
      istatistik.aktarilan++;
    } catch (err) {
      console.error(`  ✗ HATA: ${dosyaAdi}: ${err.message}`);
      istatistik.atlanmis.push({ dosyaAdi, ipucu, sebep: 'kopyalama-hatasi:' + err.message });
    }
  }

  console.log(`\n========== ÖZET ==========`);
  console.log(`Aktarılan dosya: ${istatistik.aktarilan}`);
  console.log(`Atlanan: ${istatistik.atlanmis.length}`);
  for (const a of istatistik.atlanmis) {
    console.log(`  - [${a.sebep}] ${a.dosyaAdi}  (ipucu: "${a.ipucu}")`);
  }
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');
const tx = db.transaction(() => aktarUygula(db));
tx();
console.log(`\n${DRY_RUN ? '(DRY RUN — değişiklik yapılmadı)' : 'Tamamlandı.'}`);
