const router = require('express').Router();
const { getDb } = require('../db/database');
const { basarili, hata } = require('../utils/helpers');

// GET /api/ayarlar - Tüm ayarları getir
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const ayarlar = db.prepare('SELECT * FROM firma_ayarlari').all();
    basarili(res, ayarlar);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PUT /api/ayarlar - Ayarları toplu güncelle
router.put('/', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('UPDATE firma_ayarlari SET deger = ? WHERE anahtar = ?');
    const updateMany = db.transaction((ayarlar) => {
      for (const [anahtar, deger] of Object.entries(ayarlar)) {
        stmt.run(deger, anahtar);
      }
    });
    updateMany(req.body);
    const guncel = db.prepare('SELECT * FROM firma_ayarlari').all();
    basarili(res, guncel);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
