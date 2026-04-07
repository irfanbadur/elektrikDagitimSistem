const router = require('express').Router();
const { getDb } = require('../db/database');
const { basarili, hata } = require('../utils/helpers');
const { metinTabanliAI } = require('../services/aiParseService');

// Teknik malzeme adını normalize et (kablo boyutları, birimler, marka bilgisi temizleme)
function normalizeAd(ad) {
  if (!ad) return '';
  return ad
    .toUpperCase()
    .replace(/[xX×]/g, 'X')           // çarpı işareti
    .replace(/mm\^?2/gi, 'MM2')       // mm2, mm^2
    .replace(/\(.*?\)/g, '')           // parantez içi (Kg/Mt, marka vb.) kaldır
    .replace(/\b\d+[.,]\d+\s*KG\s*\/\s*M[Tt]\.?\b/gi, '') // "0.620 Kg/Mt." kaldır
    .replace(/\b(ALPEK|PRYSMIAN|NEXANS|TR|KABLO|ILETKEN|OZGUVEN|NKT)\b/gi, '') // marka adları
    .replace(/[\/\\]/g, ' ')           // slash → boşluk
    .replace(/\s+/g, ' ')
    .trim();
}

// Teknik boyut pattern çıkar: "3 X 35 + 50 MM2" → "3X35+50"
function boyutCikar(ad) {
  const norm = normalizeAd(ad);
  // Sayı X Sayı kalıplarını yakala
  const parcalar = norm.match(/\d+\s*X\s*\d+|\d+\s*\+\s*\d+|\d+\s*MM2?/gi);
  if (!parcalar) return '';
  return parcalar.join(' ').replace(/\s+/g, '').toUpperCase();
}

// Kullanıcı eşleştirme hafızası için normalize (Türkçe karakter desteği dahil)
function normalizeForMatch(ad) {
  if (!ad) return '';
  return ad
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C')
    .toUpperCase()
    .replace(/\(.*?\)/g, '')        // parantez içini kaldır (205kg, Kg/Mt vb.)
    .replace(/[^A-Z0-9\s]/g, ' ')  // sadece alfanümerik
    .replace(/\s+/g, ' ')
    .trim();
}

// İki normalize edilmiş isim arasında kelime örtüşme skoru (0–1)
function kelimeOrtusme(a, b) {
  const wa = new Set(a.split(' ').filter(w => w.length > 2));
  const wb = new Set(b.split(' ').filter(w => w.length > 2));
  if (wa.size === 0 || wb.size === 0) return 0;
  let ortak = 0;
  for (const w of wa) if (wb.has(w)) ortak++;
  return ortak / Math.min(wa.size, wb.size);
}

// GET / - tüm katalog (filtreleme destekli)
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { arama, kategori, olcu, termin, sadece_malzeme } = req.query;

    let where = [];
    let params = [];

    // Varsayılan: sadece gerçek malzemeleri göster (kategori başlıklarını hariç tut)
    if (sadece_malzeme !== '0') {
      where.push('is_category = 0');
    }

    if (arama) {
      where.push('(malzeme_cinsi LIKE ? OR malzeme_tanimi_sap LIKE ? OR poz_birlesik LIKE ? OR malzeme_kodu LIKE ?)');
      const q = `%${arama}%`;
      params.push(q, q, q, q);
    }

    if (kategori) {
      where.push('kategori = ?');
      params.push(kategori);
    }

    if (olcu) {
      where.push('olcu = ?');
      params.push(olcu);
    }

    if (termin) {
      where.push('termin = ?');
      params.push(termin);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const malzemeler = db.prepare(`
      SELECT * FROM depo_malzeme_katalogu ${whereClause} ORDER BY id
    `).all(...params);

    basarili(res, malzemeler);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /kategoriler - benzersiz kategoriler
router.get('/kategoriler', (req, res) => {
  try {
    const db = getDb();
    const kategoriler = db.prepare(`
      SELECT DISTINCT kategori FROM depo_malzeme_katalogu
      WHERE kategori IS NOT NULL AND is_category = 0
      ORDER BY kategori
    `).all().map(r => r.kategori);
    basarili(res, kategoriler);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /filtreler - benzersiz filtre değerleri
router.get('/filtreler', (req, res) => {
  try {
    const db = getDb();
    const kategoriler = db.prepare(`
      SELECT DISTINCT kategori FROM depo_malzeme_katalogu
      WHERE kategori IS NOT NULL AND is_category = 0
      ORDER BY kategori
    `).all().map(r => r.kategori);

    const olculer = db.prepare(`
      SELECT DISTINCT olcu FROM depo_malzeme_katalogu
      WHERE olcu IS NOT NULL AND is_category = 0
      ORDER BY olcu
    `).all().map(r => r.olcu);

    const terminler = db.prepare(`
      SELECT DISTINCT termin FROM depo_malzeme_katalogu
      WHERE termin IS NOT NULL AND termin != '' AND is_category = 0
      ORDER BY termin
    `).all().map(r => r.termin.trim());

    basarili(res, { kategoriler, olculer, terminler: [...new Set(terminler)] });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /istatistikler
router.get('/istatistikler', (req, res) => {
  try {
    const db = getDb();
    const stats = db.prepare(`
      SELECT
        COUNT(*) as toplam,
        COUNT(DISTINCT kategori) as kategori_sayisi,
        COUNT(malzeme_kodu) as kodlu_malzeme,
        COUNT(DISTINCT olcu) as olcu_sayisi,
        SUM(ihale_kesfi) as toplam_ihale_kesfi,
        SUM(toplam_talep) as toplam_talep
      FROM depo_malzeme_katalogu WHERE is_category = 0
    `).get();
    basarili(res, stats);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /kullanici-eslesme - Kullanıcının manuel seçtiği eşleştirmeyi hafızaya kaydet
router.post('/kullanici-eslesme', (req, res) => {
  try {
    const db = getDb();
    const { excel_adi, katalog } = req.body;
    if (!excel_adi || !katalog) return hata(res, 'excel_adi ve katalog zorunludur', 400);

    const norm = normalizeForMatch(excel_adi);
    const mevcut = db.prepare('SELECT id FROM kullanici_eslestirme WHERE excel_adi_norm = ?').get(norm);

    if (mevcut) {
      db.prepare(`
        UPDATE kullanici_eslestirme SET
          excel_adi = ?, katalog_id = ?, malzeme_kodu = ?, poz_birlesik = ?,
          malzeme_cinsi = ?, malzeme_tanimi_sap = ?, olcu = ?,
          kullanim_sayisi = kullanim_sayisi + 1,
          guncelleme_tarihi = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        excel_adi, katalog.id || null, katalog.malzeme_kodu || null,
        katalog.poz_birlesik || null, katalog.malzeme_cinsi || null,
        katalog.malzeme_tanimi_sap || null, katalog.olcu || null,
        mevcut.id
      );
    } else {
      db.prepare(`
        INSERT INTO kullanici_eslestirme
          (excel_adi, excel_adi_norm, katalog_id, malzeme_kodu, poz_birlesik, malzeme_cinsi, malzeme_tanimi_sap, olcu)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        excel_adi, norm, katalog.id || null, katalog.malzeme_kodu || null,
        katalog.poz_birlesik || null, katalog.malzeme_cinsi || null,
        katalog.malzeme_tanimi_sap || null, katalog.olcu || null
      );
    }

    basarili(res, { kaydedildi: true });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /eslestir - Malzeme adlarını katalogla eşleştir
router.post('/eslestir', async (req, res) => {
  try {
    const db = getDb();
    const { kalemler } = req.body;
    if (!kalemler?.length) return hata(res, 'Kalemler listesi boş');

    // Malzeme kodu ile direkt eşleştir (en güvenilir)
    const kodStmt = db.prepare(`
      SELECT id, malzeme_kodu, poz_birlesik, malzeme_cinsi, malzeme_tanimi_sap, olcu
      FROM depo_malzeme_katalogu
      WHERE is_category = 0 AND malzeme_kodu = ?
      LIMIT 1
    `);

    // Poz no ile eşleştir
    const pozStmt = db.prepare(`
      SELECT id, malzeme_kodu, poz_birlesik, malzeme_cinsi, malzeme_tanimi_sap, olcu
      FROM depo_malzeme_katalogu
      WHERE is_category = 0 AND poz_birlesik = ?
      LIMIT 1
    `);

    // İsim ile eşleştir
    const adStmt = db.prepare(`
      SELECT id, malzeme_kodu, poz_birlesik, malzeme_cinsi, malzeme_tanimi_sap, olcu
      FROM depo_malzeme_katalogu
      WHERE is_category = 0 AND (malzeme_cinsi LIKE ? OR malzeme_tanimi_sap LIKE ?)
      LIMIT 1
    `);

    // Tüm katalog verilerini bir kez çek (boyut eşleştirme için)
    const tumKatalog = db.prepare(`
      SELECT id, malzeme_kodu, poz_birlesik, malzeme_cinsi, malzeme_tanimi_sap, olcu
      FROM depo_malzeme_katalogu WHERE is_category = 0
    `).all();

    // Kullanıcı hafızasını yükle
    let tumKullanici = [];
    try {
      tumKullanici = db.prepare('SELECT * FROM kullanici_eslestirme ORDER BY kullanim_sayisi DESC').all();
    } catch { /* tablo henüz yoksa atla */ }

    const kullaniciKatalogStmt = db.prepare(`
      SELECT id, malzeme_kodu, poz_birlesik, malzeme_cinsi, malzeme_tanimi_sap, olcu
      FROM depo_malzeme_katalogu WHERE id = ?
    `);

    const eslesmeYap = (k) => {
      const adi = k.malzeme_adi || k.malzeme_adi_belge || '';
      let eslesme = null;

      // 0) Kullanıcı hafızasından eşleştir (en yüksek öncelik)
      if (adi && tumKullanici.length > 0) {
        const norm = normalizeForMatch(adi);
        let enIyiKullanici = null, enIyiSkor = 0;
        for (const u of tumKullanici) {
          if (u.excel_adi_norm === norm) { enIyiKullanici = u; break; }
          const skor = kelimeOrtusme(norm, u.excel_adi_norm);
          if (skor > enIyiSkor && skor >= 0.7) { enIyiSkor = skor; enIyiKullanici = u; }
        }
        if (enIyiKullanici?.katalog_id) {
          eslesme = kullaniciKatalogStmt.get(enIyiKullanici.katalog_id) || null;
        }
      }

      // 1) Malzeme kodu ile direkt eşleştir
      if (k.malzeme_kodu) {
        eslesme = kodStmt.get(k.malzeme_kodu);
      }

      // 2) Poz no ile eşleştir
      if (!eslesme && k.poz_no) {
        eslesme = pozStmt.get(k.poz_no);
      }

      // 3) İsim ile tam LIKE eşleştir
      if (!eslesme && adi) {
        eslesme = adStmt.get(`%${adi}%`, `%${adi}%`);
      }

      // 4) Normalize edilmiş isim ile LIKE arama
      if (!eslesme && adi) {
        const norm = normalizeAd(adi);
        const kelimeler = norm.split(/\s+/).filter(w => w.length > 2);
        if (kelimeler.length > 1) {
          for (let len = kelimeler.length; len >= 2 && !eslesme; len--) {
            const q = `%${kelimeler.slice(0, len).join('%')}%`;
            eslesme = adStmt.get(q, q);
          }
        }
        if (!eslesme && kelimeler.length > 0) {
          const enUzun = [...kelimeler].sort((a, b) => b.length - a.length)[0];
          if (enUzun.length >= 4) {
            eslesme = adStmt.get(`%${enUzun}%`, `%${enUzun}%`);
          }
        }
      }

      // 5) Boyut pattern eşleştirme (kablo kesitleri için)
      if (!eslesme && adi) {
        const kayBoyut = boyutCikar(adi);
        if (kayBoyut.length >= 3) {
          for (const kat of tumKatalog) {
            const katBoyut = boyutCikar(kat.malzeme_cinsi || kat.malzeme_tanimi_sap || '');
            if (katBoyut && katBoyut === kayBoyut) {
              eslesme = kat;
              break;
            }
          }
        }
      }

      return { malzeme_adi: adi, eslesme: eslesme ? { id: eslesme.id, malzeme_kodu: eslesme.malzeme_kodu, poz_birlesik: eslesme.poz_birlesik, malzeme_cinsi: eslesme.malzeme_cinsi, malzeme_tanimi_sap: eslesme.malzeme_tanimi_sap, olcu: eslesme.olcu } : null };
    };

    let sonuclar = kalemler.map(eslesmeYap);

    // 6) AI fallback: eşleşemeyen kalemler için toplu AI eşleştirme
    const eslesemeyenler = sonuclar.filter(s => !s.eslesme).map(s => s.malzeme_adi);
    if (eslesemeyenler.length > 0 && eslesemeyenler.length <= 30) {
      try {
        const katalogListesi = tumKatalog.slice(0, 500).map(k =>
          `[${k.malzeme_kodu || ''}] ${k.malzeme_cinsi || k.malzeme_tanimi_sap || ''}`
        ).join('\n');

        const aiSonuc = await metinTabanliAI(
          `Sen elektrik dağıtım malzemeleri uzmanısın. Aşağıdaki malzeme adlarını katalog listesiyle eşleştir.
Her malzeme için katalogdaki en uygun eşleşmeyi bul. Kablo kesit boyutları, direk tipleri, trafo güçleri gibi teknik değerleri dikkate al.
Marka adlarını, parantez içi bilgileri (Kg/Mt, üretici) görmezden gel, sadece teknik özelliklere odaklan.
JSON döndür: { "eslesmeler": { "malzeme_adi": "eslesmeKodu veya null" } }
SADECE JSON döndür.`,
          `ESLESECEK MALZEMELER:\n${eslesemeyenler.join('\n')}\n\nKATALOG:\n${katalogListesi}`
        );

        if (aiSonuc && !aiSonuc.parse_error && aiSonuc.eslesmeler) {
          const kodMap = {};
          tumKatalog.forEach(k => { if (k.malzeme_kodu) kodMap[k.malzeme_kodu] = k; });

          sonuclar = sonuclar.map(s => {
            if (s.eslesme) return s;
            const aiKod = aiSonuc.eslesmeler[s.malzeme_adi];
            if (aiKod && kodMap[aiKod]) {
              const kat = kodMap[aiKod];
              return { ...s, eslesme: { id: kat.id, malzeme_kodu: kat.malzeme_kodu, poz_birlesik: kat.poz_birlesik, malzeme_cinsi: kat.malzeme_cinsi, malzeme_tanimi_sap: kat.malzeme_tanimi_sap, olcu: kat.olcu } };
            }
            return s;
          });
        }
      } catch (aiErr) {
        console.error('AI katalog eşleştirme hatası:', aiErr.message);
      }
    }

    basarili(res, sonuclar);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /stoklu-ara — Katalog araması + ana depo stok bilgileri
router.get('/stoklu-ara', (req, res) => {
  try {
    const db = getDb();
    const { arama, veren_tipi } = req.query;
    if (!arama || arama.length < 2) return basarili(res, []);

    const q = `%${arama}%`;
    const katalog = db.prepare(`
      SELECT * FROM depo_malzeme_katalogu
      WHERE is_category = 0 AND (malzeme_cinsi LIKE ? OR malzeme_tanimi_sap LIKE ? OR poz_birlesik LIKE ? OR malzeme_kodu LIKE ?)
      ORDER BY malzeme_cinsi LIMIT 30
    `).all(q, q, q, q);

    // Ana depo stok bilgilerini ekle
    if (veren_tipi === 'ana_depo' || !veren_tipi) {
      const anaDepolar = db.prepare("SELECT id, depo_adi FROM depolar WHERE depo_tipi = 'ana_depo' AND aktif = 1").all();

      const sonuc = katalog.map(k => {
        // Bu malzeme kodu ile tüm ana depolardaki stokları bul
        const stoklar = [];
        if (k.malzeme_kodu) {
          for (const depo of anaDepolar) {
            const stok = db.prepare(`
              SELECT ds.miktar FROM depo_stok ds
              JOIN malzemeler m ON m.id = ds.malzeme_id
              WHERE ds.depo_id = ? AND m.malzeme_kodu = ? AND ds.miktar > 0
            `).get(depo.id, k.malzeme_kodu);
            if (stok) {
              stoklar.push({ depo_id: depo.id, depo_adi: depo.depo_adi, miktar: stok.miktar });
            }
          }
        }
        return { ...k, depo_stoklar: stoklar, toplam_stok: stoklar.reduce((t, s) => t + s.miktar, 0) };
      });

      return basarili(res, sonuc);
    }

    basarili(res, katalog.map(k => ({ ...k, depo_stoklar: [], toplam_stok: 0 })));
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
