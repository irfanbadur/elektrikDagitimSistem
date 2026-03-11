const router = require('express').Router();
const { getDb } = require('../db/database');
const { basarili, hata } = require('../utils/helpers');

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

// POST /eslestir - Malzeme adlarını katalogla eşleştir
router.post('/eslestir', (req, res) => {
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

    const sonuclar = kalemler.map(k => {
      const adi = k.malzeme_adi || k.malzeme_adi_belge || '';
      let eslesme = null;

      // 1) Malzeme kodu ile direkt eşleştir
      if (k.malzeme_kodu) {
        eslesme = kodStmt.get(k.malzeme_kodu);
      }

      // 2) Poz no ile eşleştir
      if (!eslesme && k.poz_no) {
        eslesme = pozStmt.get(k.poz_no);
      }

      // 3) İsim ile eşleştir
      if (!eslesme && adi) {
        // Önce tam arama
        eslesme = adStmt.get(`%${adi}%`, `%${adi}%`);

        // Kelimelere böl
        if (!eslesme) {
          const kelimeler = adi.split(/\s+/).filter(w => w.length > 2);
          // Kelimeleri birleştirerek ara
          if (kelimeler.length > 1) {
            for (let len = kelimeler.length; len >= 2 && !eslesme; len--) {
              const q = `%${kelimeler.slice(0, len).join('%')}%`;
              eslesme = adStmt.get(q, q);
            }
          }
          // Tek tek kelimelerle
          if (!eslesme && kelimeler.length > 0) {
            const enUzun = [...kelimeler].sort((a, b) => b.length - a.length)[0];
            if (enUzun.length >= 4) {
              eslesme = adStmt.get(`%${enUzun}%`, `%${enUzun}%`);
            }
          }
        }
      }

      return {
        malzeme_adi: adi,
        eslesme: eslesme ? {
          id: eslesme.id,
          malzeme_kodu: eslesme.malzeme_kodu,
          poz_birlesik: eslesme.poz_birlesik,
          malzeme_cinsi: eslesme.malzeme_cinsi,
          malzeme_tanimi_sap: eslesme.malzeme_tanimi_sap,
          olcu: eslesme.olcu,
        } : null
      };
    });

    basarili(res, sonuclar);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
