const router = require('express').Router();
const { getDb } = require('../db/database');
const { aktiviteLogla, basarili, hata } = require('../utils/helpers');

// GET /api/ekipler - List all teams with details
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const ekipler = db.prepare(`
      SELECT e.*, b.bolge_adi,
        k.ad_soyad as ekip_basi_adi,
        it.ad as varsayilan_is_tipi_adi,
        (SELECT COUNT(*) FROM kullanicilar ku WHERE ku.ekip_id = e.id AND ku.durum = 'aktif') as personel_sayisi
      FROM ekipler e
      LEFT JOIN bolgeler b ON e.varsayilan_bolge_id = b.id
      LEFT JOIN kullanicilar k ON e.ekip_basi_id = k.id
      LEFT JOIN is_tipleri it ON e.varsayilan_is_tipi_id = it.id
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
      SELECT e.*, b.bolge_adi, k.ad_soyad as ekip_basi_adi, it.ad as varsayilan_is_tipi_adi
      FROM ekipler e
      LEFT JOIN bolgeler b ON e.varsayilan_bolge_id = b.id
      LEFT JOIN kullanicilar k ON e.ekip_basi_id = k.id
      LEFT JOIN is_tipleri it ON e.varsayilan_is_tipi_id = it.id
      WHERE e.id = ?
    `).get(req.params.id);
    if (!ekip) return hata(res, 'Ekip bulunamadı', 404);
    ekip.personeller = db.prepare(`
      SELECT ku.id, ku.ad_soyad, ku.telefon, ku.email, ku.ekip_id, ku.durum,
        r.rol_adi as pozisyon_adi
      FROM kullanicilar ku
      LEFT JOIN kullanici_rolleri kr ON kr.kullanici_id = ku.id
      LEFT JOIN roller r ON kr.rol_id = r.id
      WHERE ku.ekip_id = ? AND ku.durum = 'aktif'
      ORDER BY ku.ad_soyad
    `).all(req.params.id);
    basarili(res, ekip);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /api/ekipler - Create team
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { ekip_adi, ekip_kodu, ekip_basi_id, varsayilan_bolge_id, varsayilan_is_tipi_id, arac_plaka, notlar } = req.body;
    if (!ekip_adi) return hata(res, 'Ekip adı zorunludur');
    db.pragma('foreign_keys = OFF');
    const result = db.prepare('INSERT INTO ekipler (ekip_adi, ekip_kodu, ekip_basi_id, varsayilan_bolge_id, varsayilan_is_tipi_id, arac_plaka, notlar) VALUES (?, ?, ?, ?, ?, ?, ?)').run(ekip_adi, ekip_kodu, ekip_basi_id || null, varsayilan_bolge_id || null, varsayilan_is_tipi_id || null, arac_plaka, notlar);
    db.pragma('foreign_keys = ON');
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
    const { ekip_adi, ekip_kodu, ekip_basi_id, varsayilan_bolge_id, varsayilan_is_tipi_id, arac_plaka, durum, notlar } = req.body;
    // ekip_basi_id kullanicilar tablosundan seçilir
    const basiId = ekip_basi_id ? parseInt(ekip_basi_id) : null;
    if (basiId) {
      const kullaniciVar = db.prepare('SELECT id FROM kullanicilar WHERE id = ?').get(basiId);
      if (!kullaniciVar) return hata(res, `Kullanıcı ID ${basiId} bulunamadı.`, 400);
    }
    const bolgeId = varsayilan_bolge_id ? parseInt(varsayilan_bolge_id) : null;
    const isTipiId = varsayilan_is_tipi_id ? parseInt(varsayilan_is_tipi_id) : null;
    // FK constraint personel tablosuna referans veriyor ama gerçek veriler kullanicilar tablosunda — FK'yı geçici devre dışı bırak
    db.pragma('foreign_keys = OFF');
    db.prepare('UPDATE ekipler SET ekip_adi=?, ekip_kodu=?, ekip_basi_id=?, varsayilan_bolge_id=?, varsayilan_is_tipi_id=?, arac_plaka=?, durum=?, notlar=?, guncelleme_tarihi=CURRENT_TIMESTAMP WHERE id=?').run(ekip_adi, ekip_kodu, basiId, bolgeId, isTipiId, arac_plaka, durum || 'aktif', notlar, req.params.id);
    db.pragma('foreign_keys = ON');
    const guncellenen = db.prepare('SELECT * FROM ekipler WHERE id = ?').get(req.params.id);
    aktiviteLogla('ekip', 'guncelleme', guncellenen.id, `Ekip güncellendi: ${ekip_adi}`);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PATCH /api/ekipler/:id/atama - Update team's bolge+is_tipi assignment
router.patch('/:id/atama', (req, res) => {
  try {
    const db = getDb();
    const ekip = db.prepare('SELECT * FROM ekipler WHERE id = ?').get(req.params.id);
    if (!ekip) return hata(res, 'Ekip bulunamadı', 404);
    const { varsayilan_bolge_id, varsayilan_is_tipi_id } = req.body;
    db.prepare('UPDATE ekipler SET varsayilan_bolge_id = ?, varsayilan_is_tipi_id = ?, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?')
      .run(varsayilan_bolge_id || null, varsayilan_is_tipi_id || null, req.params.id);
    const guncellenen = db.prepare('SELECT * FROM ekipler WHERE id = ?').get(req.params.id);
    aktiviteLogla('ekip', 'guncelleme', guncellenen.id, `Ekip atama güncellendi: ${ekip.ekip_adi}`);
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
