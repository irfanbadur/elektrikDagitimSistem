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

// GET /api/dashboard/ihale-ozet — Tüm ihalelerin KPI özeti (çoklu ihale)
router.get('/ihale-ozet', (req, res) => {
  try {
    const db = getDb();
    const liste = db.prepare(`
      SELECT
        i.id, i.ihale_adi, i.is_adi, i.sozlesme_no, i.yuklenici, i.durum, i.sozlesme_bedeli,
        (SELECT GROUP_CONCAT(it.kod, ',')
           FROM ihale_is_tipleri iit JOIN is_tipleri it ON it.id = iit.is_tipi_id
          WHERE iit.ihale_id = i.id) AS is_tipi_kodlari,
        (SELECT COUNT(*) FROM projeler p WHERE p.ihale_id = i.id) AS proje_sayisi,
        (SELECT COALESCE(SUM(CAST(p.kesif_tutari AS REAL)), 0)
           FROM projeler p WHERE p.ihale_id = i.id) AS toplam_kesif,
        (SELECT COALESCE(SUM(CAST(p.ilerleme_miktari AS REAL)), 0)
           FROM projeler p WHERE p.ihale_id = i.id) AS toplam_ilerleme,
        (SELECT COALESCE(SUM(CAST(p.sozlesme_kesfi AS REAL)), 0)
           FROM projeler p WHERE p.ihale_id = i.id) AS toplam_sozlesme
      FROM ihaleler i
      ORDER BY i.durum = 'aktif' DESC, i.id DESC
    `).all();

    const ihaleler = liste.map(i => {
      const tutar = Number(i.sozlesme_bedeli) || 0;
      return {
        ...i,
        is_tipi_kodlari: (i.is_tipi_kodlari || '').split(',').filter(Boolean),
        kesif_yuzdesi: tutar > 0 ? (i.toplam_kesif / tutar) * 100 : 0,
        ilerleme_yuzdesi: tutar > 0 ? (i.toplam_ilerleme / tutar) * 100 : 0,
        kalan_tutar: Math.max(0, tutar - i.toplam_ilerleme),
      };
    });

    // Toplamlar (tüm aktif ihalelerin)
    const aktifler = ihaleler.filter(i => i.durum === 'aktif');
    const toplam = {
      ihale_sayisi: ihaleler.length,
      aktif_ihale: aktifler.length,
      toplam_bedel: aktifler.reduce((s, i) => s + (Number(i.sozlesme_bedeli) || 0), 0),
      toplam_kesif: aktifler.reduce((s, i) => s + (Number(i.toplam_kesif) || 0), 0),
      toplam_ilerleme: aktifler.reduce((s, i) => s + (Number(i.toplam_ilerleme) || 0), 0),
    };

    basarili(res, { ihaleler, toplam });
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
