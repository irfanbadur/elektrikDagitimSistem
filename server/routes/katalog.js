const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// GET /api/katalog
router.get('/', (req, res) => {
  const db = getDb();
  const { kategori, gerilim } = req.query;
  let sql = 'SELECT * FROM ekipman_katalogu WHERE aktif = 1';
  const params = [];
  if (kategori) { sql += ' AND kategori = ?'; params.push(kategori); }
  if (gerilim) { sql += ' AND gerilim_sinifi = ?'; params.push(gerilim); }
  sql += ' ORDER BY kategori, ekipman_adi';
  const data = db.prepare(sql).all(...params);
  res.json({ success: true, data });
});

// GET /api/katalog/kategoriler
router.get('/kategoriler', (req, res) => {
  const db = getDb();
  const data = db.prepare(`
    SELECT kategori, COUNT(*) as sayi, gerilim_sinifi
    FROM ekipman_katalogu WHERE aktif = 1
    GROUP BY kategori, gerilim_sinifi
    ORDER BY kategori
  `).all();
  res.json({ success: true, data });
});

// GET /api/katalog/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const ekipman = db.prepare('SELECT * FROM ekipman_katalogu WHERE id = ?').get(req.params.id);
  if (!ekipman) return res.status(404).json({ success: false, error: 'Ekipman bulunamadi' });
  ekipman.referans_fotolar = db.prepare('SELECT * FROM ekipman_referans_foto WHERE ekipman_id = ?').all(req.params.id);
  ekipman.ai_eslesmeler = db.prepare(`
    SELECT COUNT(*) as toplam,
      SUM(CASE WHEN onay_durumu = 'onaylandi' THEN 1 ELSE 0 END) as onaylanan
    FROM analiz_ekipman_eslesmesi WHERE ekipman_katalog_id = ?
  `).get(req.params.id);
  res.json({ success: true, data: ekipman });
});

// POST /api/katalog
router.post('/', (req, res) => {
  const db = getDb();
  const { kategori, ekipman_kodu, ekipman_adi, alt_kategori, marka, model, teknik_ozellikler, gorsel_ozellikler, gerilim_sinifi } = req.body;
  if (!kategori || !ekipman_adi) return res.status(400).json({ success: false, error: 'kategori ve ekipman_adi gerekli' });
  const result = db.prepare(`
    INSERT INTO ekipman_katalogu (kategori, ekipman_kodu, ekipman_adi, alt_kategori, marka, model, teknik_ozellikler, gorsel_ozellikler, gerilim_sinifi)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(kategori, ekipman_kodu, ekipman_adi, alt_kategori, marka, model,
    typeof teknik_ozellikler === 'object' ? JSON.stringify(teknik_ozellikler) : teknik_ozellikler,
    typeof gorsel_ozellikler === 'object' ? JSON.stringify(gorsel_ozellikler) : gorsel_ozellikler,
    gerilim_sinifi);
  const data = db.prepare('SELECT * FROM ekipman_katalogu WHERE id = ?').get(result.lastInsertRowid);
  res.json({ success: true, data });
});

// PUT /api/katalog/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const { kategori, ekipman_kodu, ekipman_adi, alt_kategori, marka, model, teknik_ozellikler, gorsel_ozellikler, gerilim_sinifi } = req.body;
  db.prepare(`
    UPDATE ekipman_katalogu SET
      kategori = COALESCE(?, kategori), ekipman_kodu = COALESCE(?, ekipman_kodu),
      ekipman_adi = COALESCE(?, ekipman_adi), alt_kategori = COALESCE(?, alt_kategori),
      marka = COALESCE(?, marka), model = COALESCE(?, model),
      teknik_ozellikler = COALESCE(?, teknik_ozellikler),
      gorsel_ozellikler = COALESCE(?, gorsel_ozellikler),
      gerilim_sinifi = COALESCE(?, gerilim_sinifi)
    WHERE id = ?
  `).run(kategori, ekipman_kodu, ekipman_adi, alt_kategori, marka, model,
    typeof teknik_ozellikler === 'object' ? JSON.stringify(teknik_ozellikler) : teknik_ozellikler,
    typeof gorsel_ozellikler === 'object' ? JSON.stringify(gorsel_ozellikler) : gorsel_ozellikler,
    gerilim_sinifi, req.params.id);
  const data = db.prepare('SELECT * FROM ekipman_katalogu WHERE id = ?').get(req.params.id);
  res.json({ success: true, data });
});

// DELETE /api/katalog/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE ekipman_katalogu SET aktif = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
