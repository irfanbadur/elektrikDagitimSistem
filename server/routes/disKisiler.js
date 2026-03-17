const router = require('express').Router();
const { getDb } = require('../db/database');
const { basarili, hata } = require('../utils/helpers');

// GET /api/dis-kisiler/ara?q=... (MUST be before /:id)
router.get('/ara', (req, res) => {
  try {
    const db = getDb();
    const q = (req.query.q || '').trim();
    if (!q) return basarili(res, []);
    const results = db.prepare(
      `SELECT * FROM dis_kisiler WHERE aktif = 1 AND ad_soyad LIKE ? ORDER BY ad_soyad LIMIT 10`
    ).all(`%${q}%`);
    basarili(res, results);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /api/dis-kisiler
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { kurum } = req.query;
    let sql = 'SELECT * FROM dis_kisiler WHERE aktif = 1';
    const params = [];
    if (kurum) { sql += ' AND kurum LIKE ?'; params.push(`%${kurum}%`); }
    sql += ' ORDER BY ad_soyad';
    basarili(res, db.prepare(sql).all(...params));
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /api/dis-kisiler/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const kisi = db.prepare('SELECT * FROM dis_kisiler WHERE id = ?').get(req.params.id);
    if (!kisi) return hata(res, 'Kisi bulunamadi', 404);
    basarili(res, kisi);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /api/dis-kisiler
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { ad_soyad, unvan, kurum, telefon, email, notlar } = req.body;
    if (!ad_soyad?.trim()) return hata(res, 'Ad soyad zorunludur');
    const result = db.prepare(
      'INSERT INTO dis_kisiler (ad_soyad, unvan, kurum, telefon, email, notlar) VALUES (?,?,?,?,?,?)'
    ).run(ad_soyad.trim(), unvan || null, kurum || null, telefon || null, email || null, notlar || null);
    const yeni = db.prepare('SELECT * FROM dis_kisiler WHERE id = ?').get(result.lastInsertRowid);
    basarili(res, yeni, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PUT /api/dis-kisiler/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { ad_soyad, unvan, kurum, telefon, email, notlar } = req.body;
    if (!ad_soyad?.trim()) return hata(res, 'Ad soyad zorunludur');
    db.prepare(
      'UPDATE dis_kisiler SET ad_soyad=?, unvan=?, kurum=?, telefon=?, email=?, notlar=?, guncelleme_tarihi=CURRENT_TIMESTAMP WHERE id=?'
    ).run(ad_soyad.trim(), unvan || null, kurum || null, telefon || null, email || null, notlar || null, req.params.id);
    const guncellenen = db.prepare('SELECT * FROM dis_kisiler WHERE id = ?').get(req.params.id);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// DELETE /api/dis-kisiler/:id (soft delete)
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE dis_kisiler SET aktif = 0, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
    basarili(res, { ok: true });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
