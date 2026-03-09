const router = require('express').Router();
const { getDb } = require('../db/database');
const { basarili, hata } = require('../utils/helpers');

// GET /:projeId - Proje demontaj listesi
router.get('/:projeId', (req, res) => {
  try {
    const db = getDb();
    const demontajlar = db.prepare(`
      SELECT * FROM proje_demontaj WHERE proje_id = ? ORDER BY id
    `).all(req.params.projeId);
    basarili(res, demontajlar);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /:projeId/ozet - Demontaj özeti
router.get('/:projeId/ozet', (req, res) => {
  try {
    const db = getDb();
    const ozet = db.prepare(`
      SELECT
        COUNT(*) as toplam_kalem,
        SUM(CASE WHEN durum = 'tamamlandi' THEN 1 ELSE 0 END) as tamamlanan_kalem,
        SUM(CASE WHEN durum = 'planli' THEN 1 ELSE 0 END) as bekleyen_kalem,
        SUM(CASE WHEN durum = 'devam_ediyor' THEN 1 ELSE 0 END) as devam_eden_kalem
      FROM proje_demontaj WHERE proje_id = ?
    `).get(req.params.projeId);
    basarili(res, ozet);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /:projeId - Tekli demontaj ekle
router.post('/:projeId', (req, res) => {
  try {
    const db = getDb();
    const { malzeme_kodu, poz_no, malzeme_adi, birim, miktar, notlar } = req.body;
    if (!malzeme_adi) return hata(res, 'Malzeme adı zorunlu');

    const result = db.prepare(`
      INSERT INTO proje_demontaj (proje_id, malzeme_kodu, poz_no, malzeme_adi, birim, miktar, notlar)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.projeId, malzeme_kodu, poz_no, malzeme_adi, birim || 'Ad', miktar || 0, notlar);

    const yeni = db.prepare('SELECT * FROM proje_demontaj WHERE id = ?').get(result.lastInsertRowid);
    basarili(res, yeni, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /:projeId/toplu - Toplu demontaj ekle
router.post('/:projeId/toplu', (req, res) => {
  try {
    const db = getDb();
    const { kalemler } = req.body;
    if (!kalemler || !kalemler.length) return hata(res, 'Kalemler listesi boş');

    const stmt = db.prepare(`
      INSERT INTO proje_demontaj (proje_id, malzeme_kodu, poz_no, malzeme_adi, birim, miktar, notlar)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const eklenen = db.transaction(() => {
      return kalemler.map(k => {
        const r = stmt.run(req.params.projeId, k.malzeme_kodu || null, k.poz_no || null, k.malzeme_adi, k.birim || 'Ad', k.miktar || 0, k.notlar || null);
        return r.lastInsertRowid;
      });
    })();

    basarili(res, { eklenen_sayi: eklenen.length }, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PUT /:projeId/:id - Demontaj güncelle
router.put('/:projeId/:id', (req, res) => {
  try {
    const db = getDb();
    const { malzeme_kodu, poz_no, malzeme_adi, birim, miktar, durum, notlar } = req.body;

    db.prepare(`
      UPDATE proje_demontaj SET malzeme_kodu=?, poz_no=?, malzeme_adi=?, birim=?, miktar=?, durum=?, notlar=?, guncelleme_tarihi=CURRENT_TIMESTAMP
      WHERE id=? AND proje_id=?
    `).run(malzeme_kodu, poz_no, malzeme_adi, birim, miktar, durum, notlar, req.params.id, req.params.projeId);

    const guncellenen = db.prepare('SELECT * FROM proje_demontaj WHERE id = ?').get(req.params.id);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// DELETE /:projeId/:id - Demontaj sil
router.delete('/:projeId/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM proje_demontaj WHERE id = ? AND proje_id = ?').run(req.params.id, req.params.projeId);
    basarili(res, { message: 'Silindi' });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
