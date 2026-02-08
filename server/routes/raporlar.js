const router = require('express').Router();
const { getDb } = require('../db/database');
const { basarili, hata } = require('../utils/helpers');

// GET /gunluk-ozet
router.get('/gunluk-ozet', (req, res) => {
  try {
    const db = getDb();
    const tarih = req.query.tarih || new Date().toISOString().slice(0, 10);
    const raporlar = db.prepare(`
      SELECT gr.*, e.ekip_adi, e.ekip_kodu, p.proje_no, p.musteri_adi, b.bolge_adi
      FROM gunluk_rapor gr
      LEFT JOIN ekipler e ON gr.ekip_id = e.id
      LEFT JOIN projeler p ON gr.proje_id = p.id
      LEFT JOIN bolgeler b ON gr.bolge_id = b.id
      WHERE gr.tarih = ?
      ORDER BY e.ekip_adi
    `).all(tarih);
    const ozet = {
      tarih,
      toplam_ekip: new Set(raporlar.map(r => r.ekip_id)).size,
      toplam_kisi: raporlar.reduce((s, r) => s + (r.kisi_sayisi || 0), 0),
      raporlar
    };
    basarili(res, ozet);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /haftalik
router.get('/haftalik', (req, res) => {
  try {
    const db = getDb();
    const baslangic = req.query.hafta_baslangic;
    if (!baslangic) return hata(res, 'hafta_baslangic parametresi gerekli');
    const raporlar = db.prepare(`
      SELECT gr.tarih, e.ekip_adi, gr.kisi_sayisi, gr.yapilan_is, gr.is_kategorisi, p.proje_no
      FROM gunluk_rapor gr
      LEFT JOIN ekipler e ON gr.ekip_id = e.id
      LEFT JOIN projeler p ON gr.proje_id = p.id
      WHERE gr.tarih BETWEEN ? AND date(?, '+6 days')
      ORDER BY gr.tarih, e.ekip_adi
    `).all(baslangic, baslangic);
    basarili(res, raporlar);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /malzeme-kullanim
router.get('/malzeme-kullanim', (req, res) => {
  try {
    const db = getDb();
    const ay = req.query.ay; // "2025-06"
    if (!ay) return hata(res, 'ay parametresi gerekli');
    const hareketler = db.prepare(`
      SELECT m.malzeme_kodu, m.malzeme_adi, m.birim, mh.hareket_tipi, SUM(mh.miktar) as toplam,
        e.ekip_adi
      FROM malzeme_hareketleri mh
      LEFT JOIN malzemeler m ON mh.malzeme_id = m.id
      LEFT JOIN ekipler e ON mh.ekip_id = e.id
      WHERE mh.tarih LIKE ?
      GROUP BY mh.malzeme_id, mh.hareket_tipi, mh.ekip_id
      ORDER BY m.malzeme_adi, mh.hareket_tipi
    `).all(ay + '%');
    basarili(res, hareketler);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /proje-durumu
router.get('/proje-durumu', (req, res) => {
  try {
    const db = getDb();
    const projeler = db.prepare(`
      SELECT p.proje_no, p.proje_tipi, p.musteri_adi, p.durum, p.oncelik,
        p.tamamlanma_yuzdesi, p.baslama_tarihi, p.teslim_tarihi,
        b.bolge_adi, e.ekip_adi
      FROM projeler p
      LEFT JOIN bolgeler b ON p.bolge_id = b.id
      LEFT JOIN ekipler e ON p.ekip_id = e.id
      ORDER BY p.proje_tipi, p.proje_no
    `).all();
    basarili(res, projeler);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /ekip-performans
router.get('/ekip-performans', (req, res) => {
  try {
    const db = getDb();
    const ay = req.query.ay;
    if (!ay) return hata(res, 'ay parametresi gerekli');
    const performans = db.prepare(`
      SELECT e.ekip_adi, e.ekip_kodu,
        COUNT(DISTINCT gr.tarih) as calisma_gunu,
        SUM(gr.kisi_sayisi) as toplam_adam_gun,
        (SELECT COUNT(*) FROM projeler p WHERE p.ekip_id = e.id AND p.durum = 'tamamlandi' AND p.gerceklesen_bitis LIKE ?) as tamamlanan_proje
      FROM ekipler e
      LEFT JOIN gunluk_rapor gr ON gr.ekip_id = e.id AND gr.tarih LIKE ?
      WHERE e.durum = 'aktif'
      GROUP BY e.id
      ORDER BY e.ekip_adi
    `).all(ay + '%', ay + '%');
    basarili(res, performans);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

module.exports = router;
