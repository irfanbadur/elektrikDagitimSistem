const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const path = require('path');
const fs = require('fs');

// GET /api/medya - Tüm medya listesi
router.get('/', (req, res) => {
  const db = getDb();
  const { proje_id, ekip_id, tarih, veri_paketi_id, limit = 50, offset = 0 } = req.query;
  let sql = `
    SELECT m.*, p.proje_no, e.ekip_adi, per.ad_soyad as yukleyen_adi
    FROM medya m
    LEFT JOIN projeler p ON m.proje_id = p.id
    LEFT JOIN ekipler e ON m.ekip_id = e.id
    LEFT JOIN personel per ON m.yukleyen_personel_id = per.id
    WHERE 1=1
  `;
  const params = [];
  if (proje_id) { sql += ' AND m.proje_id = ?'; params.push(proje_id); }
  if (ekip_id) { sql += ' AND m.ekip_id = ?'; params.push(ekip_id); }
  if (tarih) { sql += ' AND date(m.yukleme_tarihi) = ?'; params.push(tarih); }
  if (veri_paketi_id) { sql += ' AND m.veri_paketi_id = ?'; params.push(veri_paketi_id); }
  sql += ' ORDER BY m.yukleme_tarihi DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const data = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as c FROM medya').get().c;
  res.json({ success: true, data, total });
});

// GET /api/medya/harita - Konumlu medyalar
router.get('/harita', (req, res) => {
  const db = getDb();
  const data = db.prepare(`
    SELECT id, dosya_adi, latitude, longitude, yukleme_tarihi, aciklama, proje_id, veri_paketi_id
    FROM medya
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    ORDER BY yukleme_tarihi DESC
    LIMIT 500
  `).all();
  res.json({ success: true, data });
});

// GET /api/medya/:id - Medya detay
router.get('/:id', (req, res) => {
  const db = getDb();
  const medya = db.prepare(`
    SELECT m.*, p.proje_no, e.ekip_adi, per.ad_soyad as yukleyen_adi
    FROM medya m
    LEFT JOIN projeler p ON m.proje_id = p.id
    LEFT JOIN ekipler e ON m.ekip_id = e.id
    LEFT JOIN personel per ON m.yukleyen_personel_id = per.id
    WHERE m.id = ?
  `).get(req.params.id);
  if (!medya) return res.status(404).json({ success: false, error: 'Medya bulunamadi' });

  // Analizleri de getir
  medya.analizler = db.prepare('SELECT * FROM foto_analiz WHERE medya_id = ? ORDER BY analiz_katmani').all(req.params.id);
  res.json({ success: true, data: medya });
});

// GET /api/medya/:id/dosya - Fotoğraf dosyasını sun
router.get('/:id/dosya', (req, res) => {
  const db = getDb();
  const medya = db.prepare('SELECT dosya_yolu, mime_tipi FROM medya WHERE id = ?').get(req.params.id);
  if (!medya || !fs.existsSync(medya.dosya_yolu)) {
    return res.status(404).json({ success: false, error: 'Dosya bulunamadi' });
  }
  res.setHeader('Content-Type', medya.mime_tipi || 'image/jpeg');
  res.sendFile(path.resolve(medya.dosya_yolu));
});

// GET /api/medya/:id/thumbnail - Thumbnail sun
router.get('/:id/thumbnail', (req, res) => {
  const db = getDb();
  const medya = db.prepare('SELECT thumbnail_yolu FROM medya WHERE id = ?').get(req.params.id);
  if (!medya || !medya.thumbnail_yolu || !fs.existsSync(medya.thumbnail_yolu)) {
    return res.status(404).json({ success: false, error: 'Thumbnail bulunamadi' });
  }
  res.setHeader('Content-Type', 'image/jpeg');
  res.sendFile(path.resolve(medya.thumbnail_yolu));
});

// DELETE /api/medya/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const medya = db.prepare('SELECT * FROM medya WHERE id = ?').get(req.params.id);
  if (!medya) return res.status(404).json({ success: false, error: 'Medya bulunamadi' });

  // Dosyaları sil
  try { if (medya.dosya_yolu && fs.existsSync(medya.dosya_yolu)) fs.unlinkSync(medya.dosya_yolu); } catch {}
  try { if (medya.thumbnail_yolu && fs.existsSync(medya.thumbnail_yolu)) fs.unlinkSync(medya.thumbnail_yolu); } catch {}

  db.prepare('DELETE FROM medya WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
