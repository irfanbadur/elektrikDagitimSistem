const router = require('express').Router();
const { getDb } = require('../db/database');
const { aktiviteLogla, basarili, hata } = require('../utils/helpers');

// GET /api/ekipler - List all teams with details
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const ekipler = db.prepare(`
      SELECT e.*, b.bolge_adi,
        p.ad_soyad as ekip_basi_adi,
        (SELECT COUNT(*) FROM personel per WHERE per.ekip_id = e.id AND per.aktif = 1) as personel_sayisi
      FROM ekipler e
      LEFT JOIN bolgeler b ON e.varsayilan_bolge_id = b.id
      LEFT JOIN personel p ON e.ekip_basi_id = p.id
      WHERE e.durum != 'pasif'
      ORDER BY e.ekip_adi
    `).all();
    basarili(res, ekipler);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /api/ekipler/:id - Team detail with personnel
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const ekip = db.prepare(`
      SELECT e.*, b.bolge_adi, p.ad_soyad as ekip_basi_adi
      FROM ekipler e
      LEFT JOIN bolgeler b ON e.varsayilan_bolge_id = b.id
      LEFT JOIN personel p ON e.ekip_basi_id = p.id
      WHERE e.id = ?
    `).get(req.params.id);
    if (!ekip) return hata(res, 'Ekip bulunamadı', 404);
    ekip.personeller = db.prepare('SELECT * FROM personel WHERE ekip_id = ? AND aktif = 1').all(req.params.id);
    basarili(res, ekip);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /api/ekipler - Create team
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { ekip_adi, ekip_kodu, ekip_basi_id, varsayilan_bolge_id, arac_plaka, notlar } = req.body;
    if (!ekip_adi) return hata(res, 'Ekip adı zorunludur');
    const result = db.prepare('INSERT INTO ekipler (ekip_adi, ekip_kodu, ekip_basi_id, varsayilan_bolge_id, arac_plaka, notlar) VALUES (?, ?, ?, ?, ?, ?)').run(ekip_adi, ekip_kodu, ekip_basi_id || null, varsayilan_bolge_id || null, arac_plaka, notlar);
    const yeni = db.prepare('SELECT * FROM ekipler WHERE id = ?').get(result.lastInsertRowid);
    aktiviteLogla('ekip', 'olusturma', yeni.id, `Yeni ekip: ${ekip_adi}`);
    basarili(res, yeni, 201);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return hata(res, 'Bu ekip kodu zaten kullanımda');
    hata(res, err.message, 500);
  }
});

// PUT /api/ekipler/:id - Update team
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { ekip_adi, ekip_kodu, ekip_basi_id, varsayilan_bolge_id, arac_plaka, durum, notlar } = req.body;
    db.prepare('UPDATE ekipler SET ekip_adi=?, ekip_kodu=?, ekip_basi_id=?, varsayilan_bolge_id=?, arac_plaka=?, durum=?, notlar=?, guncelleme_tarihi=CURRENT_TIMESTAMP WHERE id=?').run(ekip_adi, ekip_kodu, ekip_basi_id || null, varsayilan_bolge_id || null, arac_plaka, durum || 'aktif', notlar, req.params.id);
    const guncellenen = db.prepare('SELECT * FROM ekipler WHERE id = ?').get(req.params.id);
    aktiviteLogla('ekip', 'guncelleme', guncellenen.id, `Ekip güncellendi: ${ekip_adi}`);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// DELETE /api/ekipler/:id - Soft delete team
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const ekip = db.prepare('SELECT * FROM ekipler WHERE id = ?').get(req.params.id);
    if (!ekip) return hata(res, 'Ekip bulunamadı', 404);
    db.prepare("UPDATE ekipler SET durum = 'pasif', guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
    aktiviteLogla('ekip', 'silme', ekip.id, `Ekip pasife alındı: ${ekip.ekip_adi}`);
    basarili(res, { message: 'Ekip silindi' });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /api/ekipler/:id/raporlar - Team's daily reports
router.get('/:id/raporlar', (req, res) => {
  try {
    const db = getDb();
    const raporlar = db.prepare(`
      SELECT gr.*, p.proje_no, b.bolge_adi
      FROM gunluk_rapor gr
      LEFT JOIN projeler p ON gr.proje_id = p.id
      LEFT JOIN bolgeler b ON gr.bolge_id = b.id
      WHERE gr.ekip_id = ?
      ORDER BY gr.tarih DESC LIMIT 50
    `).all(req.params.id);
    basarili(res, raporlar);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /api/ekipler/:id/projeler - Team's assigned projects
router.get('/:id/projeler', (req, res) => {
  try {
    const db = getDb();
    const projeler = db.prepare(`
      SELECT p.*, b.bolge_adi FROM projeler p
      LEFT JOIN bolgeler b ON p.bolge_id = b.id
      WHERE p.ekip_id = ? AND p.durum != 'tamamlandi'
      ORDER BY p.oncelik, p.proje_no
    `).all(req.params.id);
    basarili(res, projeler);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
