const router = require('express').Router();
const { getDb } = require('../db/database');
const { basarili, hata } = require('../utils/helpers');

// GET /api/dashboard/ozet
router.get('/ozet', (req, res) => {
  try {
    const db = getDb();
    const aktifProje = db.prepare("SELECT COUNT(*) as c FROM projeler WHERE durum NOT IN ('tamamlandi', 'askida')").get().c;
    const sahadaKisi = db.prepare(`
      SELECT COALESCE(SUM(gr.kisi_sayisi), 0) as c FROM gunluk_rapor gr
      WHERE gr.tarih = date('now')
    `).get().c;
    const bekleyenTalep = db.prepare("SELECT COUNT(*) as c FROM talepler WHERE durum = 'beklemede'").get().c;
    const kritikStok = db.prepare('SELECT COUNT(*) as c FROM malzemeler WHERE stok_miktari <= kritik_seviye').get().c;
    const bugunTamamlanan = db.prepare("SELECT COUNT(*) as c FROM projeler WHERE durum = 'tamamlandi' AND date(guncelleme_tarihi) = date('now')").get().c;

    const raporDurumu = db.prepare(`
      SELECT e.id as ekip_id, e.ekip_adi,
        CASE WHEN EXISTS(SELECT 1 FROM gunluk_rapor gr WHERE gr.ekip_id = e.id AND gr.tarih = date('now')) THEN 1 ELSE 0 END as rapor_geldi
      FROM ekipler e WHERE e.durum = 'aktif'
    `).all();

    basarili(res, {
      aktif_proje: aktifProje,
      sahada_kisi: sahadaKisi,
      bekleyen_talep: bekleyenTalep,
      kritik_stok_sayisi: kritikStok,
      bugun_tamamlanan: bugunTamamlanan,
      gunluk_rapor_durumu: raporDurumu
    });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /api/dashboard/aktiviteler
router.get('/aktiviteler', (req, res) => {
  try {
    const db = getDb();
    const limit = parseInt(req.query.limit) || 20;
    const aktiviteler = db.prepare('SELECT * FROM aktivite_log ORDER BY tarih DESC LIMIT ?').all(limit);
    basarili(res, aktiviteler);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /api/dashboard/ekip-durumlari
router.get('/ekip-durumlari', (req, res) => {
  try {
    const db = getDb();
    const ekipler = db.prepare(`
      SELECT e.id as ekip_id, e.ekip_adi, e.durum, b.bolge_adi,
        (SELECT COUNT(*) FROM personel p WHERE p.ekip_id = e.id AND p.aktif = 1) as kisi_sayisi,
        (SELECT p2.proje_no FROM projeler p2 WHERE p2.ekip_id = e.id AND p2.durum = 'sahada' LIMIT 1) as aktif_proje,
        CASE WHEN EXISTS(SELECT 1 FROM gunluk_rapor gr WHERE gr.ekip_id = e.id AND gr.tarih = date('now')) THEN 1 ELSE 0 END as rapor_geldi
      FROM ekipler e
      LEFT JOIN bolgeler b ON e.varsayilan_bolge_id = b.id
      WHERE e.durum != 'pasif'
      ORDER BY e.ekip_adi
    `).all();
    basarili(res, ekipler);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
