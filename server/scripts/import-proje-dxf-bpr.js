/**
 * doc/KET/<müsteri>/ ve doc/YB/<müsteri>/ klasörlerinden DXF + BPR dosyalarını
 * ilgili projelerin teknik hazırlık fazındaki adımlarına kopyalar:
 *
 *   <KLASÖR>/MEVCUT DURUM/...         → mevcut_durum_proje
 *   <KLASÖR>/YENİ DURUM/...           → yeni_durum_proje
 *   <KLASÖR>/CBS*.dxf, draws-*.dxf    → cbs_altlik
 *
 * Eşleşme: klasör adı (Türkçe normalize) ile proje müsteri_adi/proje_no fuzzy match.
 *
 * Çalıştırma:
 *   node scripts/import-proje-dxf-bpr.js          (uygula)
 *   node scripts/import-proje-dxf-bpr.js --dry-run (sadece liste)
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.resolve(__dirname, '../../data/tenants/cakmakgrup/elektratrack.db');
const UPLOADS_ROOT = path.resolve(__dirname, '../../data/tenants/cakmakgrup/uploads');
const DOC_ROOT = path.resolve(__dirname, '../../doc');
const DRY_RUN = process.argv.includes('--dry-run');

const KAYNAKLAR = [
  { tip: 'YB',  klasor: 'YB' },
  { tip: 'KET', klasor: 'KET' },
];

// Dosyanın hangi adıma gideceğini belirle
const MEVCUT_RE = /MEVCUT\s*DURUM/i;
const YENI_RE   = /YEN[İI]\s*DURUM/i;
const CBS_RE    = /\bCBS\b|^draws-\d+/i;
const KABUL_EDILEN_UZANTI = new Set(['dxf', 'bpr']);

const ADIM_KLASOR = {
  cbs_altlik: 'CBS_altlik',
  mevcut_durum_proje: 'Mevcut_Durum_Proje',
  yeni_durum_proje: 'Yeni_Durum_Proje',
};

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

// Klasör adından proje arama ipucunu çıkart
function isimIpucu(text) {
  return turkceNormalize(text)
    .replace(/\b(YAPIM|ISI|PROJESI|PROJE|KET|YB|MEVCUT|DURUM|YENI|MAH|MAHALLESI|CAD|CADDESI|SOK|SOKAK|TR|YANI|SEHIR|ILAVE|TRAFO)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function eslestir(ipucu, projeler) {
  if (!ipucu) return null;
  const ipuParca = ipucu.split(' ').filter(p => p.length >= 2);
  if (!ipuParca.length) return null;

  // 1) Tam içerme
  const tam = projeler.filter(p => {
    const mn = turkceNormalize(p.musteri_adi || '').split(/\s+/);
    return ipuParca.every(parca => mn.includes(parca));
  });
  if (tam.length === 1) return tam[0];
  if (tam.length > 1) {
    return tam.sort((a, b) => (a.musteri_adi || '').length - (b.musteri_adi || '').length)[0];
  }

  // 2) En çok ortak parça (≥2)
  const skorlu = projeler.map(p => {
    const mn = turkceNormalize(p.musteri_adi || '').split(/\s+/);
    const ortak = ipuParca.filter(x => mn.includes(x)).length;
    return { p, skor: ortak };
  }).filter(x => x.skor >= 2).sort((a, b) => b.skor - a.skor);
  if (skorlu.length === 1) return skorlu[0].p;
  if (skorlu.length > 1 && skorlu[0].skor > skorlu[1].skor) return skorlu[0].p;

  // 3) Tek parça eşleşip tek aday
  const tek = projeler.filter(p => {
    const mn = turkceNormalize(p.musteri_adi || '').split(/\s+/);
    return ipuParca.some(x => mn.includes(x));
  });
  if (tek.length === 1) return tek[0];

  return null;
}

function uzantidanKategori(uzanti) {
  const u = uzanti.toLowerCase();
  if (['pdf', 'doc', 'docx', 'txt'].includes(u)) return 'belge';
  if (['xls', 'xlsx', 'csv'].includes(u)) return 'tablo';
  if (['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(u)) return 'fotograf';
  if (['dwg', 'dxf'].includes(u)) return 'cizim';
  if (['bpr'].includes(u)) return 'cizim';
  return 'diger';
}

function mimeTipi(uzanti) {
  return ({
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    dxf: 'application/dxf',
    dwg: 'application/acad',
    bpr: 'application/octet-stream',
  })[uzanti.toLowerCase()] || 'application/octet-stream';
}

function adimKoduTespit(goreceliYol, dosyaAdi) {
  const tumYol = (goreceliYol + '/' + dosyaAdi).replace(/\\/g, '/');
  if (MEVCUT_RE.test(tumYol)) return 'mevcut_durum_proje';
  if (YENI_RE.test(tumYol)) return 'yeni_durum_proje';
  if (CBS_RE.test(dosyaAdi)) return 'cbs_altlik';
  return null;
}

// Klasör altındaki tüm dosyaları (alt klasörler dahil) topla
function* dosyalariGez(klasor, ust = '') {
  for (const giris of fs.readdirSync(klasor, { withFileTypes: true })) {
    const tam = path.join(klasor, giris.name);
    const goreceli = path.posix.join(ust, giris.name);
    if (giris.isDirectory()) {
      yield* dosyalariGez(tam, goreceli);
    } else if (giris.isFile()) {
      yield { tam_yol: tam, dosya_adi: giris.name, goreceli_yol: ust };
    }
  }
}

function aktarUygula(db) {
  const istatistik = { aktarilan: 0, atlanmis: [], proje_eslemeyen_klasorler: new Set() };

  for (const kaynak of KAYNAKLAR) {
    console.log(`\n========== ${kaynak.tip} (doc/${kaynak.klasor}) ==========`);
    const projeler = db.prepare(`
      SELECT p.id, p.proje_no, p.musteri_adi, it.kod
      FROM projeler p JOIN is_tipleri it ON p.is_tipi_id = it.id
      WHERE it.kod = ?
    `).all(kaynak.tip);

    const kaynakDir = path.join(DOC_ROOT, kaynak.klasor);
    if (!fs.existsSync(kaynakDir)) continue;

    for (const giris of fs.readdirSync(kaynakDir, { withFileTypes: true })) {
      if (!giris.isDirectory()) continue;
      const projeKlasor = path.join(kaynakDir, giris.name);
      const ipucu = isimIpucu(giris.name);
      const proje = eslestir(ipucu, projeler);
      if (!proje) {
        istatistik.proje_eslemeyen_klasorler.add(`${kaynak.klasor}/${giris.name}  (ipucu: "${ipucu}")`);
        continue;
      }

      // Bu projedeki tüm dosyaları gez
      for (const d of dosyalariGez(projeKlasor)) {
        const uzanti = path.extname(d.dosya_adi).slice(1).toLowerCase();
        if (!KABUL_EDILEN_UZANTI.has(uzanti)) continue;

        const adimKodu = adimKoduTespit(d.goreceli_yol, d.dosya_adi);
        if (!adimKodu) {
          istatistik.atlanmis.push({ ...d, proje_no: proje.proje_no, sebep: 'adim-tespit-edilemedi' });
          continue;
        }

        const adim = db.prepare(`
          SELECT id FROM proje_adimlari WHERE proje_id = ? AND faz_kodu = 'teknik_hazirlik' AND adim_kodu = ?
        `).get(proje.id, adimKodu);
        if (!adim) {
          istatistik.atlanmis.push({ ...d, proje_no: proje.proje_no, sebep: `adim-yok:${adimKodu}` });
          continue;
        }

        const tabansiz = path.basename(d.dosya_adi, path.extname(d.dosya_adi));
        const adimKlasor = ADIM_KLASOR[adimKodu];
        // Alt klasör (VektorDiyagrami gibi) varsa hedef adına ekle
        const altKlasorAdi = d.goreceli_yol.split('/').filter(p =>
          !MEVCUT_RE.test(p) && !YENI_RE.test(p)
        ).filter(Boolean).join('-');
        const onek = altKlasorAdi ? `${slugify(altKlasorAdi)}-` : '';
        const hedefAdi = `${proje.proje_no}_${adimKlasor}_${onek}${slugify(tabansiz)}.${uzanti}`;
        const goreceliYol = `projeler/${kaynak.tip}/${proje.proje_no}/${adimKlasor}/${hedefAdi}`;
        const tamHedef = path.join(UPLOADS_ROOT, goreceliYol);

        // Aynı orijinal dosya yüklenmiş mi?
        const mevcut = db.prepare(`
          SELECT id FROM dosyalar WHERE proje_adim_id = ? AND orijinal_adi = ? AND durum = 'aktif' LIMIT 1
        `).get(adim.id, d.dosya_adi);
        if (mevcut) {
          istatistik.atlanmis.push({ ...d, proje_no: proje.proje_no, sebep: 'zaten-mevcut' });
          continue;
        }

        if (DRY_RUN) {
          console.log(`  [DRY] ${proje.proje_no.padEnd(18)} ${adimKodu.padEnd(20)} ← ${d.goreceli_yol || '(kök)'}/${d.dosya_adi}`);
          istatistik.aktarilan++;
          continue;
        }

        try {
          fs.mkdirSync(path.dirname(tamHedef), { recursive: true });
          const buf = fs.readFileSync(d.tam_yol);
          fs.writeFileSync(tamHedef, buf);

          db.prepare(`
            INSERT INTO dosyalar (
              dosya_adi, orijinal_adi, dosya_yolu, dosya_boyutu, mime_tipi, kategori,
              alan, alt_alan, proje_id, proje_adim_id, kaynak, durum
            ) VALUES (?, ?, ?, ?, ?, ?, 'proje', ?, ?, ?, 'doc-import', 'aktif')
          `).run(
            hedefAdi, d.dosya_adi, goreceliYol, buf.length, mimeTipi(uzanti),
            uzantidanKategori(uzanti), `${kaynak.tip}/${proje.proje_no}/${adimKlasor}`,
            proje.id, adim.id
          );

          console.log(`  ✓ ${proje.proje_no.padEnd(18)} ${adimKodu.padEnd(20)} ← ${d.goreceli_yol || '(kök)'}/${d.dosya_adi}`);
          istatistik.aktarilan++;
        } catch (err) {
          console.error(`  ✗ HATA: ${d.dosya_adi}: ${err.message}`);
          istatistik.atlanmis.push({ ...d, proje_no: proje.proje_no, sebep: 'kopyalama-hatasi:' + err.message });
        }
      }
    }
  }

  console.log(`\n========== ÖZET ==========`);
  console.log(`Aktarılan: ${istatistik.aktarilan}`);
  const sebepler = {};
  for (const a of istatistik.atlanmis) {
    sebepler[a.sebep] = (sebepler[a.sebep] || 0) + 1;
  }
  console.log(`Atlanan toplam: ${istatistik.atlanmis.length}`);
  for (const [s, c] of Object.entries(sebepler)) console.log(`  - ${s}: ${c}`);

  if (istatistik.proje_eslemeyen_klasorler.size > 0) {
    console.log(`\n  Eşleşmeyen klasörler (${istatistik.proje_eslemeyen_klasorler.size}):`);
    for (const k of istatistik.proje_eslemeyen_klasorler) console.log(`    - ${k}`);
  }
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');
const tx = db.transaction(() => aktarUygula(db));
tx();
console.log(`\n${DRY_RUN ? '(DRY RUN — değişiklik yapılmadı)' : 'Tamamlandı.'}`);
