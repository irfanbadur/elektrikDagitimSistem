/**
 * doc/1-YB ve doc/2-KET klasörlerindeki dosyaları ilgili projelerin
 * Kabul fazı adımlarına (BHP / Geçici Kabul / EVP) taşır.
 *
 * - "...ENERJİ PROTOKOL.docx" → EVP (eksik_giderim)
 * - "...GEÇİCİ PROTOKOL.docx" / "...GEÇİCİ KABUL.docx" → Geçici Kabul (gecici_kabul)
 * - "...BHP-Model.pdf" / "...BHP.pdf" → BHP (kabul_tutanaklar) — sadece YB
 *
 * Eşleşme: klasör adı (veya gevşek dosya prefix'i) musteri_adi ile fuzzy match.
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.resolve(__dirname, '../../data/tenants/cakmakgrup/elektratrack.db');
const UPLOADS_ROOT = path.resolve(__dirname, '../../data/tenants/cakmakgrup/uploads');
const DOC_ROOT = path.resolve(__dirname, '../../doc');
const DRY_RUN = process.argv.includes('--dry-run');

const KAYNAKLAR = [
  { tip: 'YB',  klasor: '1-YB' },
  { tip: 'KET', klasor: '2-KET' },
];

// adim_kodu → klasör adı (slug)
const ADIM_KLASOR = {
  kabul_tutanaklar: 'BHP',
  gecici_kabul: 'Gecici_Kabul',
  eksik_giderim: 'EVP',
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

function dosyaTipiTespit(dosyaAdi) {
  const norm = turkceNormalize(dosyaAdi);
  // BHP'yi GEÇİCİ/EVP'den önce kontrol et — örn. "X BHP-Model.pdf" gibi dosyalar
  if (/\bBHP\b/.test(norm)) return 'kabul_tutanaklar';
  if (/GECICI/.test(norm)) return 'gecici_kabul';
  if (/ENERJI/.test(norm)) return 'eksik_giderim';
  return null;
}

// Klasör/dosya adından "müşteri" ipucunu çıkar (BHP/GEÇİCİ/ENERJİ/PROTOKOL/PDF/-Model gibi
// ekleri at — geriye sade isim kalsın)
function isimIpucu(text) {
  const norm = turkceNormalize(text);
  return norm
    .replace(/\b(BHP|MODEL|GECICI|ENERJI|PROTOKOL|KABUL|PDF|DOCX|DOC|PROJESI|PROJE)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function eslestir(ipucu, projeler) {
  if (!ipucu) return null;
  const ipuParca = ipucu.split(' ').filter(p => p.length >= 2);

  // 1) Tam içerme: musteri_adi içinde tüm parçalar geçiyor mu?
  const tamEsle = projeler.filter(p => {
    const mn = turkceNormalize(p.musteri_adi || '');
    return ipuParca.every(parca => mn.split(/\s+/).includes(parca));
  });
  if (tamEsle.length === 1) return tamEsle[0];

  // 2) En az 2 parça eşleşen ve uzunluğu yakın olan
  const skorlu = projeler.map(p => {
    const mn = turkceNormalize(p.musteri_adi || '').split(/\s+/);
    const ortak = ipuParca.filter(x => mn.includes(x)).length;
    return { p, skor: ortak };
  }).filter(x => x.skor >= 2).sort((a, b) => b.skor - a.skor);

  if (skorlu.length > 0 && (skorlu.length === 1 || skorlu[0].skor > skorlu[1].skor)) {
    return skorlu[0].p;
  }

  // 3) Tek parça eşleşen ama tek aday varsa kabul et
  const tekParca = projeler.filter(p => {
    const mn = turkceNormalize(p.musteri_adi || '').split(/\s+/);
    return ipuParca.some(x => mn.includes(x));
  });
  if (tekParca.length === 1) return tekParca[0];

  return null;
}

function dosyaTara(kaynakKlasor) {
  const sonuc = []; // { tam_yol, dosya_adi, ipucu, kaynak_klasor }
  if (!fs.existsSync(kaynakKlasor)) return sonuc;
  for (const giriş of fs.readdirSync(kaynakKlasor, { withFileTypes: true })) {
    const tam = path.join(kaynakKlasor, giriş.name);
    if (giriş.isDirectory()) {
      const ipucu = isimIpucu(giriş.name);
      for (const dosya of fs.readdirSync(tam)) {
        if (fs.statSync(path.join(tam, dosya)).isFile()) {
          sonuc.push({ tam_yol: path.join(tam, dosya), dosya_adi: dosya, ipucu, kaynak_klasor: giriş.name });
        }
      }
    } else if (giriş.isFile()) {
      sonuc.push({ tam_yol: tam, dosya_adi: giriş.name, ipucu: isimIpucu(giriş.name), kaynak_klasor: '(root)' });
    }
  }
  return sonuc;
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
  })[uzanti.toLowerCase()] || 'application/octet-stream';
}

function aktarUygula(db) {
  const istatistik = { aktarilan: 0, atlanmis: [], dosya_yok: 0 };

  for (const kaynak of KAYNAKLAR) {
    console.log(`\n========== ${kaynak.tip} (${kaynak.klasor}) ==========`);

    // 1) İlgili tipteki tüm projeleri çek
    const projeler = db.prepare(`
      SELECT p.id, p.proje_no, p.musteri_adi, it.kod
      FROM projeler p JOIN is_tipleri it ON p.is_tipi_id = it.id
      WHERE it.kod = ?
    `).all(kaynak.tip);

    // 2) Klasördeki dosyaları tara
    const dosyalar = dosyaTara(path.join(DOC_ROOT, kaynak.klasor));
    if (dosyalar.length === 0) { console.log('  (kaynak klasör boş)'); continue; }

    for (const d of dosyalar) {
      const adimKodu = dosyaTipiTespit(d.dosya_adi);
      if (!adimKodu) {
        istatistik.atlanmis.push({ ...d, sebep: 'tip-tespit-edilemedi' });
        continue;
      }
      // KET'te BHP yok
      if (kaynak.tip === 'KET' && adimKodu === 'kabul_tutanaklar') {
        istatistik.atlanmis.push({ ...d, sebep: 'KET-BHP-yok' });
        continue;
      }

      const proje = eslestir(d.ipucu, projeler);
      if (!proje) {
        istatistik.atlanmis.push({ ...d, sebep: 'proje-eslesemedi' });
        continue;
      }

      // Hedef adım
      const adim = db.prepare(`
        SELECT id FROM proje_adimlari WHERE proje_id = ? AND faz_kodu = 'kabul' AND adim_kodu = ?
      `).get(proje.id, adimKodu);
      if (!adim) {
        istatistik.atlanmis.push({ ...d, sebep: `adim-bulunamadi:${adimKodu}` });
        continue;
      }

      // Hedef yol
      const uzanti = path.extname(d.dosya_adi).slice(1) || 'bin';
      const aciklama = path.basename(d.dosya_adi, path.extname(d.dosya_adi));
      const adimKlasor = ADIM_KLASOR[adimKodu];
      const hedefAdi = `${proje.proje_no}_${slugify(aciklama)}.${uzanti}`;
      const goreceliYol = `projeler/${kaynak.tip}/${proje.proje_no}/${adimKlasor}/${hedefAdi}`;
      const tamHedef = path.join(UPLOADS_ROOT, goreceliYol);

      // Aynı dosya zaten yüklenmiş mi? (proje_adim_id + orijinal_adi eşleşmesi)
      const mevcut = db.prepare(`
        SELECT id FROM dosyalar WHERE proje_adim_id = ? AND orijinal_adi = ? AND durum = 'aktif' LIMIT 1
      `).get(adim.id, d.dosya_adi);
      if (mevcut) {
        istatistik.atlanmis.push({ ...d, sebep: 'zaten-mevcut' });
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [DRY] ${proje.proje_no.padEnd(20)} ${adimKodu.padEnd(20)} ← ${d.kaynak_klasor}/${d.dosya_adi}`);
        istatistik.aktarilan++;
        continue;
      }

      // Fiziksel kopya
      try {
        fs.mkdirSync(path.dirname(tamHedef), { recursive: true });
        const buf = fs.readFileSync(d.tam_yol);
        fs.writeFileSync(tamHedef, buf);

        const kategori = uzantidanKategori(uzanti);
        const altAlan = `${kaynak.tip}/${proje.proje_no}/${adimKlasor}`;

        db.prepare(`
          INSERT INTO dosyalar (
            dosya_adi, orijinal_adi, dosya_yolu, dosya_boyutu, mime_tipi, kategori,
            alan, alt_alan, proje_id, proje_adim_id, kaynak, durum
          ) VALUES (?, ?, ?, ?, ?, ?, 'proje', ?, ?, ?, 'doc-import', 'aktif')
        `).run(
          hedefAdi, d.dosya_adi, goreceliYol, buf.length, mimeTipi(uzanti), kategori,
          altAlan, proje.id, adim.id
        );

        console.log(`  ✓ ${proje.proje_no.padEnd(20)} ${adimKodu.padEnd(20)} ← ${d.dosya_adi}`);
        istatistik.aktarilan++;
      } catch (err) {
        console.error(`  ✗ HATA: ${d.dosya_adi}:`, err.message);
        istatistik.atlanmis.push({ ...d, sebep: 'kopyalama-hatasi:' + err.message });
      }
    }
  }

  console.log(`\n========== ÖZET ==========`);
  console.log(`Aktarılan dosya: ${istatistik.aktarilan}`);
  console.log(`Atlanan: ${istatistik.atlanmis.length}`);
  for (const a of istatistik.atlanmis) {
    console.log(`  - [${a.sebep}] ${a.kaynak_klasor}/${a.dosya_adi}  (ipucu: "${a.ipucu}")`);
  }
}

// =====
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');
const tx = db.transaction(() => aktarUygula(db));
tx();
console.log('\nTamamlandı.');
