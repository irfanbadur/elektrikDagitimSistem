const router = require('express').Router();
const { getDb } = require('../db/database');
const { basarili, hata } = require('../utils/helpers');

// GET /:projeId - Proje direk listesi
router.get('/:projeId', (req, res) => {
  try {
    const db = getDb();
    const direkler = db.prepare(`
      SELECT * FROM proje_direkler WHERE proje_id = ? ORDER BY sira, id
    `).all(req.params.projeId);
    basarili(res, direkler);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /:projeId/toplu - Toplu direk ekle
router.post('/:projeId/toplu', (req, res) => {
  try {
    const db = getDb();
    const { kalemler } = req.body;
    if (!kalemler || !kalemler.length) return hata(res, 'Kalemler listesi bos');

    // Onceki direkleri sil ve yeniden yaz
    db.prepare('DELETE FROM proje_direkler WHERE proje_id = ?').run(req.params.projeId);

    const stmt = db.prepare(`
      INSERT INTO proje_direkler (proje_id, kisa_adi, tipi, arasi_kablo, notlar, katalog_adi, malzeme_kodu, sira)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const eklenen = db.transaction(() => {
      return kalemler.map((k, i) => {
        const r = stmt.run(
          req.params.projeId,
          k.kisa_adi || '',
          k.tipi || 'direk',
          k.arasi_kablo || null,
          k.notlar || null,
          k.katalog_adi || null,
          k.malzeme_kodu || null,
          i
        );
        return r.lastInsertRowid;
      });
    })();

    basarili(res, { eklenen_sayi: eklenen.length }, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PUT /:projeId/:id - Tek direk guncelle
router.put('/:projeId/:id', (req, res) => {
  try {
    const db = getDb();
    const { kisa_adi, tipi, arasi_kablo, notlar, katalog_adi, malzeme_kodu } = req.body;

    db.prepare(`
      UPDATE proje_direkler SET kisa_adi=?, tipi=?, arasi_kablo=?, notlar=?, katalog_adi=?, malzeme_kodu=?, guncelleme_tarihi=CURRENT_TIMESTAMP
      WHERE id=? AND proje_id=?
    `).run(kisa_adi, tipi, arasi_kablo, notlar, katalog_adi, malzeme_kodu, req.params.id, req.params.projeId);

    const guncellenen = db.prepare('SELECT * FROM proje_direkler WHERE id = ?').get(req.params.id);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// DELETE /:projeId/:id - Tek direk sil
router.delete('/:projeId/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM proje_direkler WHERE id = ? AND proje_id = ?').run(req.params.id, req.params.projeId);
    basarili(res, { message: 'Silindi' });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
