const router = require('express').Router();
const { getDb } = require('../db/database');
const { aktiviteLogla, basarili, hata } = require('../utils/helpers');

// GET /:projeId - proje keşif listesi
router.get('/:projeId', (req, res) => {
  try {
    const db = getDb();
    const kesifler = db.prepare(`
      SELECT pk.*,
        (SELECT SUM(bk.miktar) FROM bono_kalemleri bk WHERE bk.proje_kesif_id = pk.id) as alinan_miktar
      FROM proje_kesif pk
      WHERE pk.proje_id = ?
      ORDER BY pk.id
    `).all(req.params.projeId);
    basarili(res, kesifler);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /:projeId/ozet - keşif özet istatistikleri
router.get('/:projeId/ozet', (req, res) => {
  try {
    const db = getDb();
    const ozet = db.prepare(`
      SELECT
        COUNT(*) as toplam_kalem,
        SUM(miktar) as toplam_miktar,
        SUM(miktar * birim_fiyat) as toplam_tutar,
        SUM(CASE WHEN durum = 'alindi' THEN 1 ELSE 0 END) as alinan_kalem,
        SUM(CASE WHEN durum = 'planli' THEN 1 ELSE 0 END) as planli_kalem,
        SUM(CASE WHEN durum = 'depoda_var' THEN 1 ELSE 0 END) as depoda_var_kalem
      FROM proje_kesif WHERE proje_id = ?
    `).get(req.params.projeId);
    basarili(res, ozet);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /:projeId - keşif kalemi ekle
router.post('/:projeId', (req, res) => {
  try {
    const db = getDb();
    const { malzeme_kodu, poz_no, malzeme_adi, birim, miktar, birim_fiyat, notlar } = req.body;
    if (!malzeme_adi) return hata(res, 'Malzeme adi zorunludur');

    const result = db.prepare(`
      INSERT INTO proje_kesif (proje_id, malzeme_kodu, poz_no, malzeme_adi, birim, miktar, birim_fiyat, notlar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.projeId, malzeme_kodu, poz_no, malzeme_adi, birim || 'Ad', miktar || 0, birim_fiyat || 0, notlar);

    const yeni = db.prepare('SELECT * FROM proje_kesif WHERE id = ?').get(result.lastInsertRowid);
    aktiviteLogla('proje_kesif', 'olusturma', yeni.id, `Kesif kalemi: ${malzeme_adi} (Proje: ${req.params.projeId})`);
    basarili(res, yeni, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /:projeId/toplu - katalogdan toplu ekleme
router.post('/:projeId/toplu', (req, res) => {
  try {
    const db = getDb();
    const { kalemler } = req.body;
    if (!kalemler || !kalemler.length) return hata(res, 'Kalem listesi bos');

    const stmt = db.prepare(`
      INSERT INTO proje_kesif (proje_id, malzeme_kodu, poz_no, malzeme_adi, birim, miktar, birim_fiyat)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      for (const k of kalemler) {
        stmt.run(req.params.projeId, k.malzeme_kodu, k.poz_no, k.malzeme_adi, k.birim || 'Ad', k.miktar || 0, k.birim_fiyat || 0);
      }
    });
    transaction();

    aktiviteLogla('proje_kesif', 'toplu_ekleme', req.params.projeId, `${kalemler.length} kalem eklendi`);
    basarili(res, { eklenen: kalemler.length }, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PUT /:projeId/:id - keşif kalemi güncelle
router.put('/:projeId/:id', (req, res) => {
  try {
    const db = getDb();
    const { malzeme_kodu, poz_no, malzeme_adi, birim, miktar, birim_fiyat, durum, notlar } = req.body;

    db.prepare(`
      UPDATE proje_kesif SET malzeme_kodu=?, poz_no=?, malzeme_adi=?, birim=?, miktar=?, birim_fiyat=?, durum=?, notlar=?, guncelleme_tarihi=CURRENT_TIMESTAMP
      WHERE id=? AND proje_id=?
    `).run(malzeme_kodu, poz_no, malzeme_adi, birim, miktar, birim_fiyat, durum, notlar, req.params.id, req.params.projeId);

    const guncellenen = db.prepare('SELECT * FROM proje_kesif WHERE id = ?').get(req.params.id);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// DELETE /:projeId/:id - keşif kalemi sil
router.delete('/:projeId/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM proje_kesif WHERE id = ? AND proje_id = ?').run(req.params.id, req.params.projeId);
    basarili(res, { silindi: true });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
