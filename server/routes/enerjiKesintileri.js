const router = require('express').Router();
const { getDb } = require('../db/database');
const { basarili, hata } = require('../utils/helpers');

// GET / - tüm kesinti planları
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { durum } = req.query;
    let sql = `SELECT ek.*, p.proje_no, p.musteri_adi, b.bolge_adi
      FROM enerji_kesintileri ek
      LEFT JOIN projeler p ON ek.proje_id = p.id
      LEFT JOIN bolgeler b ON ek.bolge_id = b.id
      WHERE 1=1`;
    const params = [];
    if (durum) { sql += ' AND ek.durum = ?'; params.push(durum); }
    sql += ' ORDER BY ek.basla_tarih ASC, ek.basla_saat ASC';
    const kesintiler = db.prepare(sql).all(...params);
    basarili(res, kesintiler);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST / - yeni kesinti planı oluştur
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { proje_id, bolge_id, basla_tarih, basla_saat, bitis_tarih, bitis_saat, etkilenen_alan, aciklama, olusturan } = req.body;
    if (!basla_tarih) return hata(res, 'Başlangıç tarihi zorunludur', 400);
    const result = db.prepare(`
      INSERT INTO enerji_kesintileri (proje_id, bolge_id, basla_tarih, basla_saat, bitis_tarih, bitis_saat, etkilenen_alan, aciklama, olusturan)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(proje_id || null, bolge_id || null, basla_tarih, basla_saat || null, bitis_tarih || null, bitis_saat || null, etkilenen_alan || null, aciklama || null, olusturan || null);
    const yeni = db.prepare(`SELECT ek.*, p.proje_no, b.bolge_adi FROM enerji_kesintileri ek LEFT JOIN projeler p ON ek.proje_id = p.id LEFT JOIN bolgeler b ON ek.bolge_id = b.id WHERE ek.id = ?`).get(result.lastInsertRowid);
    basarili(res, yeni, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PATCH /:id/durum - durum değiştir
router.patch('/:id/durum', (req, res) => {
  try {
    const db = getDb();
    const { durum } = req.body;
    if (!durum) return hata(res, 'Durum zorunludur', 400);
    db.prepare('UPDATE enerji_kesintileri SET durum = ?, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?').run(durum, req.params.id);
    const guncellenen = db.prepare(`SELECT ek.*, p.proje_no, b.bolge_adi FROM enerji_kesintileri ek LEFT JOIN projeler p ON ek.proje_id = p.id LEFT JOIN bolgeler b ON ek.bolge_id = b.id WHERE ek.id = ?`).get(req.params.id);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// DELETE /:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM enerji_kesintileri WHERE id = ?').run(req.params.id);
    basarili(res, { silindi: true });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
