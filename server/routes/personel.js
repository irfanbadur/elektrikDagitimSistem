const router = require('express').Router();
const { getDb } = require('../db/database');
const { aktiviteLogla, basarili, hata } = require('../utils/helpers');

// GET /api/personel - List all active personnel with ekip_adi
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const personeller = db.prepare(`SELECT p.*, e.ekip_adi FROM personel p LEFT JOIN ekipler e ON p.ekip_id = e.id WHERE p.aktif = 1 ORDER BY p.ad_soyad ASC`).all();
    basarili(res, personeller);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /:id - Personnel detail
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const kisi = db.prepare(`SELECT p.*, e.ekip_adi FROM personel p LEFT JOIN ekipler e ON p.ekip_id = e.id WHERE p.id = ?`).get(req.params.id);
    if (!kisi) return hata(res, 'Personel bulunamadı', 404);
    basarili(res, kisi);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST / - Create personnel
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { ad_soyad, telefon, email, rol, uzmanlik, ekip_id, notlar } = req.body;
    if (!ad_soyad) return hata(res, 'Ad soyad zorunludur');
    const result = db.prepare('INSERT INTO personel (ad_soyad, telefon, email, rol, uzmanlik, ekip_id, notlar) VALUES (?,?,?,?,?,?,?)').run(ad_soyad, telefon, email, rol || 'teknisyen', uzmanlik, ekip_id || null, notlar);
    const yeni = db.prepare('SELECT * FROM personel WHERE id = ?').get(result.lastInsertRowid);
    aktiviteLogla('personel', 'olusturma', yeni.id, `Yeni personel: ${ad_soyad}`);
    basarili(res, yeni, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PUT /:id - Update personnel
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { ad_soyad, telefon, email, rol, uzmanlik, ekip_id, notlar } = req.body;
    const mevcut = db.prepare('SELECT * FROM personel WHERE id = ?').get(req.params.id);
    if (!mevcut) return hata(res, 'Personel bulunamadı', 404);
    db.prepare('UPDATE personel SET ad_soyad=?, telefon=?, email=?, rol=?, uzmanlik=?, ekip_id=?, notlar=?, guncelleme_tarihi=CURRENT_TIMESTAMP WHERE id=?').run(ad_soyad, telefon, email, rol, uzmanlik, ekip_id || null, notlar, req.params.id);
    const guncellenen = db.prepare('SELECT * FROM personel WHERE id = ?').get(req.params.id);
    aktiviteLogla('personel', 'guncelleme', guncellenen.id, `Personel güncellendi: ${ad_soyad}`);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// DELETE /:id - Soft delete (aktif = 0)
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const kisi = db.prepare('SELECT * FROM personel WHERE id = ?').get(req.params.id);
    if (!kisi) return hata(res, 'Personel bulunamadı', 404);
    db.prepare('UPDATE personel SET aktif = 0, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
    aktiviteLogla('personel', 'silme', kisi.id, `Personel pasif yapıldı: ${kisi.ad_soyad}`);
    basarili(res, { message: 'Personel pasif yapıldı' });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PATCH /:id/ekip - Assign/unassign personnel to team (kullanicilar tablosu)
router.patch('/:id/ekip', (req, res) => {
  try {
    const db = getDb();
    const { ekip_id } = req.body;
    const kisi = db.prepare('SELECT * FROM kullanicilar WHERE id = ?').get(req.params.id);
    if (!kisi) return hata(res, 'Personel bulunamadı', 404);
    db.prepare('UPDATE kullanicilar SET ekip_id = ?, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?').run(ekip_id || null, req.params.id);
    const guncellenen = db.prepare(`SELECT k.*, e.ekip_adi FROM kullanicilar k LEFT JOIN ekipler e ON k.ekip_id = e.id WHERE k.id = ?`).get(req.params.id);
    const ekipAdi = guncellenen.ekip_adi || 'Atanmamış';
    aktiviteLogla('personel', 'ekip_atama', kisi.id, `${kisi.ad_soyad} → ${ekipAdi}`);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
