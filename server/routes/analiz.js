const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// GET /api/analiz
router.get('/', (req, res) => {
  const db = getDb();
  const { katman, tip, onay, limit = 50, offset = 0 } = req.query;
  let sql = `
    SELECT fa.*, m.dosya_adi, m.thumbnail_yolu, vp.paket_no
    FROM foto_analiz fa
    LEFT JOIN medya m ON fa.medya_id = m.id
    LEFT JOIN veri_paketleri vp ON fa.veri_paketi_id = vp.id
    WHERE 1=1
  `;
  const params = [];
  if (katman) { sql += ' AND fa.analiz_katmani = ?'; params.push(katman); }
  if (tip) { sql += ' AND fa.analiz_tipi = ?'; params.push(tip); }
  if (onay) { sql += ' AND fa.onay_durumu = ?'; params.push(onay); }
  sql += ' ORDER BY fa.olusturma_tarihi DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  const data = db.prepare(sql).all(...params);
  res.json({ success: true, data });
});

// GET /api/analiz/istatistik
router.get('/istatistik', (req, res) => {
  const db = getDb();
  const stats = db.prepare(`
    SELECT analiz_katmani, COUNT(*) as toplam,
      SUM(CASE WHEN onay_durumu = 'onaylandi' THEN 1 ELSE 0 END) as onaylanan,
      SUM(CASE WHEN onay_durumu = 'duzeltildi' THEN 1 ELSE 0 END) as duzeltilen,
      ROUND(AVG(guven_skoru), 2) as ort_guven
    FROM foto_analiz
    WHERE onay_durumu != 'beklemede'
    GROUP BY analiz_katmani
  `).all();
  res.json({ success: true, data: stats });
});

// GET /api/analiz/medya/:medyaId
router.get('/medya/:medyaId', (req, res) => {
  const db = getDb();
  const data = db.prepare(`
    SELECT fa.*, (SELECT COUNT(*) FROM analiz_ekipman_eslesmesi WHERE foto_analiz_id = fa.id) as eslesmis_ekipman_sayisi
    FROM foto_analiz fa WHERE fa.medya_id = ?
    ORDER BY fa.analiz_katmani
  `).all(req.params.medyaId);
  res.json({ success: true, data });
});

// GET /api/analiz/paket/:paketId
router.get('/paket/:paketId', (req, res) => {
  const db = getDb();
  const data = db.prepare(`
    SELECT fa.*, m.dosya_adi
    FROM foto_analiz fa
    JOIN medya m ON fa.medya_id = m.id
    WHERE m.veri_paketi_id = ?
    ORDER BY fa.analiz_katmani
  `).all(req.params.paketId);
  res.json({ success: true, data });
});

// GET /api/analiz/malzeme-ozet/:projeId
router.get('/malzeme-ozet/:projeId', (req, res) => {
  const db = getDb();
  const data = db.prepare(`
    SELECT ae.nesne_tipi, ae.tespit_detay, SUM(ae.miktar) as toplam_miktar,
      ROUND(AVG(ae.guven_skoru), 2) as ort_guven, ek.ekipman_kodu, ek.ekipman_adi
    FROM analiz_ekipman_eslesmesi ae
    JOIN foto_analiz fa ON ae.foto_analiz_id = fa.id
    JOIN medya m ON fa.medya_id = m.id
    LEFT JOIN ekipman_katalogu ek ON ae.ekipman_katalog_id = ek.id
    WHERE m.proje_id = ?
    GROUP BY ae.nesne_tipi, ae.tespit_detay, ae.ekipman_katalog_id
    ORDER BY toplam_miktar DESC
  `).all(req.params.projeId);
  res.json({ success: true, data });
});

// GET /api/analiz/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const analiz = db.prepare('SELECT * FROM foto_analiz WHERE id = ?').get(req.params.id);
  if (!analiz) return res.status(404).json({ success: false, error: 'Analiz bulunamadi' });
  analiz.ekipman_eslesmeleri = db.prepare(`
    SELECT ae.*, ek.ekipman_kodu, ek.ekipman_adi, ek.kategori as katalog_kategori
    FROM analiz_ekipman_eslesmesi ae
    LEFT JOIN ekipman_katalogu ek ON ae.ekipman_katalog_id = ek.id
    WHERE ae.foto_analiz_id = ?
  `).all(req.params.id);
  res.json({ success: true, data: analiz });
});

// POST /api/analiz/baslat
router.post('/baslat', async (req, res) => {
  try {
    const { medya_id, katman } = req.body;
    if (!medya_id) return res.status(400).json({ success: false, error: 'medya_id gerekli' });
    const db = getDb();
    const medya = db.prepare('SELECT * FROM medya WHERE id = ?').get(medya_id);
    if (!medya) return res.status(404).json({ success: false, error: 'Medya bulunamadi' });

    const fs = require('fs');
    const aiManager = require('../services/ai-engine/aiManager');
    const imageBuffer = fs.readFileSync(medya.dosya_yolu);
    const results = await aiManager.processPhotoAnalysis(medya_id, imageBuffer, katman || 2);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/analiz/:id/onayla
router.put('/:id/onayla', (req, res) => {
  const db = getDb();
  const { durum, duzeltme_notlari } = req.body;
  db.prepare(`
    UPDATE foto_analiz
    SET onay_durumu = ?, onay_tarihi = CURRENT_TIMESTAMP, duzeltme_notlari = ?
    WHERE id = ?
  `).run(durum || 'onaylandi', duzeltme_notlari || null, req.params.id);
  const data = db.prepare('SELECT * FROM foto_analiz WHERE id = ?').get(req.params.id);
  res.json({ success: true, data });
});

// PUT /api/analiz/eslesmeler/:id
router.put('/eslesmeler/:id', (req, res) => {
  const db = getDb();
  const { duzeltme_notu, dogru_katalog_id } = req.body;
  db.prepare(`
    UPDATE analiz_ekipman_eslesmesi
    SET onay_durumu = 'duzeltildi', duzeltme_notu = ?,
        ekipman_katalog_id = COALESCE(?, ekipman_katalog_id)
    WHERE id = ?
  `).run(duzeltme_notu, dogru_katalog_id, req.params.id);
  res.json({ success: true });
});

module.exports = router;
