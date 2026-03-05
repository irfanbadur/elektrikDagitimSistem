const router = require('express').Router();
const { getDb } = require('../db/database');
const { aktiviteLogla, basarili, hata } = require('../utils/helpers');

// GET /api/bolgeler
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const bolgeler = db.prepare('SELECT * FROM bolgeler WHERE aktif = 1 ORDER BY sira, bolge_adi').all();
    basarili(res, bolgeler);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /api/bolgeler/matris
router.get('/matris', (req, res) => {
  try {
    const db = getDb();
    const bolgeler = db.prepare('SELECT id, bolge_adi, bolge_tipi FROM bolgeler WHERE aktif = 1 ORDER BY sira, bolge_adi').all();
    const isTipleri = db.prepare('SELECT id, kod, ad FROM is_tipleri WHERE aktif = 1 ORDER BY sira, ad').all();
    const ekipler = db.prepare(`
      SELECT id as ekip_id, ekip_adi, ekip_kodu, varsayilan_bolge_id, varsayilan_is_tipi_id
      FROM ekipler
      WHERE durum = 'aktif' AND varsayilan_bolge_id IS NOT NULL AND varsayilan_is_tipi_id IS NOT NULL
    `).all();

    const atamalar = {};
    for (const b of bolgeler) {
      for (const it of isTipleri) {
        atamalar[`${b.id}_${it.id}`] = [];
      }
    }
    for (const e of ekipler) {
      const key = `${e.varsayilan_bolge_id}_${e.varsayilan_is_tipi_id}`;
      if (atamalar[key]) {
        atamalar[key].push({ ekip_id: e.ekip_id, ekip_adi: e.ekip_adi, ekip_kodu: e.ekip_kodu });
      }
    }

    basarili(res, { bolgeler, isTipleri, atamalar });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /api/bolgeler/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const bolge = db.prepare('SELECT * FROM bolgeler WHERE id = ?').get(req.params.id);
    if (!bolge) return hata(res, 'Bölge bulunamadı', 404);
    basarili(res, bolge);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /api/bolgeler
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { bolge_adi, bolge_tipi, ust_bolge_id, sira } = req.body;
    if (!bolge_adi) return hata(res, 'Bölge adı zorunludur');
    const result = db.prepare('INSERT INTO bolgeler (bolge_adi, bolge_tipi, ust_bolge_id, sira) VALUES (?, ?, ?, ?)').run(bolge_adi, bolge_tipi || 'ilce', ust_bolge_id || null, sira || 0);
    const yeni = db.prepare('SELECT * FROM bolgeler WHERE id = ?').get(result.lastInsertRowid);
    aktiviteLogla('bolge', 'olusturma', yeni.id, `Yeni bölge: ${bolge_adi}`);
    basarili(res, yeni, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PUT /api/bolgeler/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { bolge_adi, bolge_tipi, ust_bolge_id, sira } = req.body;
    db.prepare('UPDATE bolgeler SET bolge_adi = ?, bolge_tipi = ?, ust_bolge_id = ?, sira = ? WHERE id = ?').run(bolge_adi, bolge_tipi, ust_bolge_id || null, sira || 0, req.params.id);
    const guncellenen = db.prepare('SELECT * FROM bolgeler WHERE id = ?').get(req.params.id);
    aktiviteLogla('bolge', 'guncelleme', guncellenen.id, `Bölge güncellendi: ${bolge_adi}`);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// DELETE /api/bolgeler/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const bolge = db.prepare('SELECT * FROM bolgeler WHERE id = ?').get(req.params.id);
    if (!bolge) return hata(res, 'Bölge bulunamadı', 404);
    // Check if has children or referenced records
    const altBolge = db.prepare('SELECT COUNT(*) as c FROM bolgeler WHERE ust_bolge_id = ?').get(req.params.id);
    if (altBolge.c > 0) return hata(res, 'Alt bölgeleri olan bölge silinemez');
    db.prepare('UPDATE bolgeler SET aktif = 0 WHERE id = ?').run(req.params.id);
    aktiviteLogla('bolge', 'silme', bolge.id, `Bölge silindi: ${bolge.bolge_adi}`);
    basarili(res, { message: 'Bölge silindi' });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
