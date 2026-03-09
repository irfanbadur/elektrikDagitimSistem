const router = require('express').Router();
const { getDb } = require('../db/database');
const { aktiviteLogla, basarili, hata } = require('../utils/helpers');

// GET / - tüm depolar
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const depolar = db.prepare(`
      SELECT d.*,
        (SELECT COUNT(DISTINCT ds.malzeme_id) FROM depo_stok ds WHERE ds.depo_id = d.id AND ds.miktar > 0) as malzeme_cesidi,
        (SELECT COALESCE(SUM(ds.miktar), 0) FROM depo_stok ds WHERE ds.depo_id = d.id) as toplam_stok
      FROM depolar d
      WHERE d.aktif = 1
      ORDER BY d.depo_tipi = 'ana_depo' DESC, d.depo_adi
    `).all();
    basarili(res, depolar);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /:id - depo detay
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const depo = db.prepare('SELECT * FROM depolar WHERE id = ?').get(req.params.id);
    if (!depo) return hata(res, 'Depo bulunamadı', 404);
    basarili(res, depo);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /:id/stok - deponun stok listesi
router.get('/:id/stok', (req, res) => {
  try {
    const db = getDb();
    const { kategori } = req.query;
    let sql = `
      SELECT ds.*, m.malzeme_kodu, m.malzeme_adi, m.kategori, m.birim, m.birim_fiyat
      FROM depo_stok ds
      JOIN malzemeler m ON ds.malzeme_id = m.id
      WHERE ds.depo_id = ?
    `;
    const params = [req.params.id];
    if (kategori) {
      sql += ' AND m.kategori = ?';
      params.push(kategori);
    }
    sql += ' ORDER BY m.kategori, m.malzeme_adi';
    const stok = db.prepare(sql).all(...params);
    basarili(res, stok);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST / - yeni depo oluştur
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { depo_adi, depo_tipi, sorumlu, telefon, adres, notlar } = req.body;
    if (!depo_adi) return hata(res, 'Depo adı zorunludur');
    const result = db.prepare(
      'INSERT INTO depolar (depo_adi, depo_tipi, sorumlu, telefon, adres, notlar) VALUES (?,?,?,?,?,?)'
    ).run(depo_adi, depo_tipi || 'taseron', sorumlu, telefon, adres, notlar);
    const yeni = db.prepare('SELECT * FROM depolar WHERE id = ?').get(result.lastInsertRowid);
    aktiviteLogla('depo', 'olusturma', yeni.id, `Yeni depo: ${depo_adi}`);
    basarili(res, yeni, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PUT /:id - depo güncelle
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { depo_adi, depo_tipi, sorumlu, telefon, adres, aktif, notlar } = req.body;
    db.prepare(
      'UPDATE depolar SET depo_adi=?, depo_tipi=?, sorumlu=?, telefon=?, adres=?, aktif=?, notlar=? WHERE id=?'
    ).run(depo_adi, depo_tipi, sorumlu, telefon, adres, aktif ?? 1, notlar, req.params.id);
    const guncellenen = db.prepare('SELECT * FROM depolar WHERE id = ?').get(req.params.id);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
