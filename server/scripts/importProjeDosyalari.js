/**
 * Doc/KET klasöründeki proje dosyalarını yaşam döngüsü adımlarına aktar
 * Kullanım: node server/scripts/importProjeDosyalari.js
 *
 * Yapı:
 *   ana dizin/*.dxf       → Teknik Hazırlık > CBS altlık
 *   ana dizin/*Image*.jp*  → Başlama > Yer Teslim Tutanağı
 *   ana dizin/*.jpeg/png   → Başlama > Yer Teslim Tutanağı
 *   MEVCUT DURUM/*.dxf    → Teknik Hazırlık > Mevcut Durum Proje
 *   MEVCUT DURUM/*        → Teknik Hazırlık > Mevcut Durum Proje
 *   YENİ DURUM/*.dxf      → Teknik Hazırlık > Yeni Durum Proje
 *   YENİ DURUM/*          → Teknik Hazırlık > Yeni Durum Proje
 */
const path = require('path');
const fs = require('fs');
const { getDb, initDatabase } = require('../db/database');

initDatabase();
const db = getDb();

const DOC_KET = path.join(__dirname, '../../doc/KET');
const UPLOADS = path.join(__dirname, '../../uploads/projeler');

console.log('=== Proje Dosyaları Import ===\n');

// Dosya tipi tespiti
function kategoriTespit(adi) {
  const ext = adi.split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return 'fotograf';
  if (['dxf', 'dwg'].includes(ext)) return 'cizim';
  if (['pdf', 'doc', 'docx'].includes(ext)) return 'belge';
  if (['xls', 'xlsx'].includes(ext)) return 'tablo';
  if (['kmz', 'kml'].includes(ext)) return 'harita';
  return 'diger';
}

function mimeTespit(adi) {
  const ext = adi.split('.').pop().toLowerCase();
  const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', dxf: 'application/dxf', dwg: 'application/dwg', pdf: 'application/pdf', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kmz: 'application/vnd.google-earth.kmz' };
  return map[ext] || 'application/octet-stream';
}

// DB projeleri yükle
const dbProjeler = db.prepare('SELECT id, proje_no, musteri_adi, proje_tipi FROM projeler').all();
// Elle eşleştirme tablosu (fuzzy eşleşmeyen projeler için)
const ELLE_ESLESTIRME = {
  'Geyikkoşan KET': '26.BATI.KET.1.073',
  'Habib Semiz': '26.BATI.KET.1.081',
  'Metin Hancı': '26.BATI.KET.1.026-33',
  'Metin Değirmenci': 'KET-BEKLEYEN-070',
  'Metin Hancı': '26.BATI.KET.1.026-33',
  'Teiaş Riskli Lokasyon KET': 'KET-BEKLEYEN-075',
  'Ömer Demir': 'KET-BEKLEYEN-074',
  'Ömer Ulusoy': 'KET-BEKLEYEN-060',
};

const kullanilan = new Set();

function projeEslestir(klasorAdi) {
  // Önce elle eşleştirme
  if (ELLE_ESLESTIRME[klasorAdi]) {
    const p = dbProjeler.find(p => p.proje_no === ELLE_ESLESTIRME[klasorAdi]);
    if (p && !kullanilan.has(p.id)) { kullanilan.add(p.id); return p; }
  }

  const norm = klasorAdi.toUpperCase().replace(/KET\s*/gi, '').replace(/\s+/g, ' ').trim();
  const kelimeler = norm.split(' ').filter(w => w.length >= 3);
  if (kelimeler.length === 0) return null;

  let enIyi = null, enIyiSkor = 0;
  for (const p of dbProjeler) {
    if (kullanilan.has(p.id)) continue;
    if (!p.musteri_adi) continue;
    const dbNorm = p.musteri_adi.toUpperCase().replace(/KET\s*PROJE(Sİ)?/gi, '').replace(/CAD\.\s*/gi, '').replace(/\s+/g, ' ').trim();
    const skor = kelimeler.filter(w => dbNorm.includes(w)).length;
    if (skor > enIyiSkor && skor >= Math.ceil(kelimeler.length * 0.5)) {
      enIyi = p;
      enIyiSkor = skor;
    }
  }
  if (enIyi) { kullanilan.add(enIyi.id); return enIyi; }
  return null;
}

// Adım kodlarını bul
function adimBul(projeId, fazKodu, adimKodu) {
  return db.prepare('SELECT id FROM proje_adimlari WHERE proje_id = ? AND faz_kodu = ? AND adim_kodu = ?').get(projeId, fazKodu, adimKodu);
}

// Dosya kopyala ve DB kaydı oluştur
const insertDosya = db.prepare(`
  INSERT INTO dosyalar (dosya_adi, orijinal_adi, dosya_yolu, dosya_boyutu, mime_tipi, kategori,
    alan, alt_alan, proje_id, proje_adim_id, durum, olusturma_tarihi)
  VALUES (?, ?, ?, ?, ?, ?, 'proje', ?, ?, ?, 'aktif', datetime('now'))
`);

function dosyaAktar(kaynakYol, projeNo, projeId, adimId, adimAdi) {
  const orijinalAdi = path.basename(kaynakYol);
  // .bak dosyalarını atla
  if (orijinalAdi.endsWith('.bak') || orijinalAdi === 'desktop.ini') return false;

  const dosyaAdi = `${projeNo}_${adimAdi.replace(/\s+/g, '-')}_${orijinalAdi}`.replace(/[^a-zA-Z0-9._\-öüşığçÖÜŞİĞÇ]/g, '_');
  const goreceliYol = `KET/${projeNo}/${adimAdi.replace(/\s+/g, '_')}/${dosyaAdi}`;
  const hedefYol = path.join(UPLOADS, goreceliYol);

  try {
    fs.mkdirSync(path.dirname(hedefYol), { recursive: true });
    fs.copyFileSync(kaynakYol, hedefYol);
    const boyut = fs.statSync(kaynakYol).size;

    insertDosya.run(
      dosyaAdi, orijinalAdi, `projeler/${goreceliYol}`, boyut,
      mimeTespit(orijinalAdi), kategoriTespit(orijinalAdi),
      `KET/${projeNo}/${adimAdi}`, projeId, adimId
    );
    return true;
  } catch (err) {
    console.error(`     Hata: ${orijinalAdi}: ${err.message}`);
    return false;
  }
}

// Ana işlem
const klasorler = fs.readdirSync(DOC_KET).filter(f => {
  try { return fs.statSync(path.join(DOC_KET, f)).isDirectory(); } catch { return false; }
});

console.log(`${klasorler.length} proje klasörü bulundu.\n`);

let toplamDosya = 0, eslesenProje = 0;

const importAll = db.transaction(() => {
  for (const klasor of klasorler) {
    const proje = projeEslestir(klasor);
    if (!proje) {
      console.log(`❌ Eşleşmedi: ${klasor}`);
      continue;
    }
    eslesenProje++;
    console.log(`✅ ${klasor} → ${proje.proje_no} (${proje.musteri_adi?.substring(0, 25)})`);

    const dir = path.join(DOC_KET, klasor);
    const anaDosyalar = fs.readdirSync(dir).filter(f => {
      try { return fs.statSync(path.join(dir, f)).isFile(); } catch { return false; }
    });

    // 1. Ana dizindeki DXF → CBS altlık
    const cbsAdim = adimBul(proje.id, 'teknik_hazirlik', 'cbs_altlik');
    if (cbsAdim) {
      for (const d of anaDosyalar) {
        if (d.toLowerCase().endsWith('.dxf')) {
          if (dosyaAktar(path.join(dir, d), proje.proje_no, proje.id, cbsAdim.id, 'CBS_altlik')) toplamDosya++;
        }
      }
    }

    // 2. Ana dizindeki resimler → Yer Teslim Tutanağı
    const yerTeslimAdim = adimBul(proje.id, 'baslama', 'yer_teslim_tutanagi');
    if (yerTeslimAdim) {
      for (const d of anaDosyalar) {
        const ext = d.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
          if (dosyaAktar(path.join(dir, d), proje.proje_no, proje.id, yerTeslimAdim.id, 'Yer_Teslim_Tutanagi')) toplamDosya++;
        }
      }
    }

    // 3. Ana dizindeki KMZ → CBS altlık
    if (cbsAdim) {
      for (const d of anaDosyalar) {
        if (d.toLowerCase().endsWith('.kmz') || d.toLowerCase().endsWith('.kml')) {
          if (dosyaAktar(path.join(dir, d), proje.proje_no, proje.id, cbsAdim.id, 'CBS_altlik')) toplamDosya++;
        }
      }
    }

    // 4. MEVCUT DURUM klasörü → Mevcut Durum Proje
    const mevcutDurumAdim = adimBul(proje.id, 'teknik_hazirlik', 'mevcut_durum_proje');
    const mevcutDir = ['MEVCUT DURUM', 'Mevcut Durum', 'mevcut durum'].map(n => path.join(dir, n)).find(p => fs.existsSync(p));
    if (mevcutDurumAdim && mevcutDir) {
      const dosyalar = fs.readdirSync(mevcutDir).filter(f => {
        try { return fs.statSync(path.join(mevcutDir, f)).isFile(); } catch { return false; }
      });
      for (const d of dosyalar) {
        if (dosyaAktar(path.join(mevcutDir, d), proje.proje_no, proje.id, mevcutDurumAdim.id, 'Mevcut_Durum_Proje')) toplamDosya++;
      }
    }

    // 5. YENİ DURUM klasörü → Yeni Durum Proje
    const yeniDurumAdim = adimBul(proje.id, 'teknik_hazirlik', 'yeni_durum_proje');
    const yeniDir = ['YENİ DURUM', 'Yeni Durum', 'yeni durum', 'YENI DURUM'].map(n => path.join(dir, n)).find(p => fs.existsSync(p));
    if (yeniDurumAdim && yeniDir) {
      const dosyalar = fs.readdirSync(yeniDir).filter(f => {
        try { return fs.statSync(path.join(yeniDir, f)).isFile(); } catch { return false; }
      });
      for (const d of dosyalar) {
        if (dosyaAktar(path.join(yeniDir, d), proje.proje_no, proje.id, yeniDurumAdim.id, 'Yeni_Durum_Proje')) toplamDosya++;
      }
    }

    // 6. YENİ DURUM alt klasörleri → Yeni Durum Proje (alt dosyalar da aktarılır)
    if (yeniDurumAdim && yeniDir) {
      const altDizinler = fs.readdirSync(yeniDir).filter(f => {
        try { return fs.statSync(path.join(yeniDir, f)).isDirectory(); } catch { return false; }
      });
      for (const altDir of altDizinler) {
        const altYol = path.join(yeniDir, altDir);
        const altDosyalar = fs.readdirSync(altYol).filter(f => {
          try { return fs.statSync(path.join(altYol, f)).isFile(); } catch { return false; }
        });
        for (const d of altDosyalar) {
          if (dosyaAktar(path.join(altYol, d), proje.proje_no, proje.id, yeniDurumAdim.id, 'Yeni_Durum_Proje')) toplamDosya++;
        }
      }
    }

    // 7. MEVCUT DURUM alt klasörleri
    if (mevcutDurumAdim && mevcutDir) {
      const altDizinler = fs.readdirSync(mevcutDir).filter(f => {
        try { return fs.statSync(path.join(mevcutDir, f)).isDirectory(); } catch { return false; }
      });
      for (const altDir of altDizinler) {
        const altYol = path.join(mevcutDir, altDir);
        const altDosyalar = fs.readdirSync(altYol).filter(f => {
          try { return fs.statSync(path.join(altYol, f)).isFile(); } catch { return false; }
        });
        for (const d of altDosyalar) {
          if (dosyaAktar(path.join(altYol, d), proje.proje_no, proje.id, mevcutDurumAdim.id, 'Mevcut_Durum_Proje')) toplamDosya++;
        }
      }
    }
  }
});

importAll();

console.log(`\n=== Tamamlandı ===`);
console.log(`Eşleşen proje: ${eslesenProje}/${klasorler.length}`);
console.log(`Aktarılan dosya: ${toplamDosya}`);
console.log(`DB dosya toplam: ${db.prepare("SELECT COUNT(*) as c FROM dosyalar WHERE durum = 'aktif'").get().c}`);
