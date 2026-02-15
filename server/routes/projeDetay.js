const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { dokumanUpload, cadUpload, fotoUpload } = require('../middleware/upload');
const path = require('path');
const fs = require('fs');

// ============================================
// DOKÜMANLAR
// ============================================

// GET /api/projeler/:projeId/dokumanlar
router.get('/:projeId/dokumanlar', (req, res) => {
  const db = getDb();
  const data = db.prepare(
    `SELECT * FROM proje_dokumanlari WHERE proje_id = ? AND kategori = 'dokuman' ORDER BY olusturma_tarihi DESC`
  ).all(req.params.projeId);
  res.json({ success: true, data });
});

// POST /api/projeler/:projeId/dokumanlar
router.post('/:projeId/dokumanlar', dokumanUpload.single('dosya'), (req, res) => {
  const db = getDb();
  const file = req.file;
  if (!file) return res.status(400).json({ success: false, error: 'Dosya gerekli' });

  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const result = db.prepare(`
    INSERT INTO proje_dokumanlari (proje_id, kategori, dosya_adi, orijinal_adi, dosya_yolu, dosya_tipi, mime_tipi, dosya_boyutu, aciklama, yukleyen)
    VALUES (?, 'dokuman', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.projeId,
    file.filename,
    file.originalname,
    file.path,
    ext,
    file.mimetype,
    file.size,
    req.body.aciklama || null,
    req.body.yukleyen || 'koordinator'
  );

  res.json({ success: true, data: { id: result.lastInsertRowid } });
});

// DELETE /api/projeler/:projeId/dokumanlar/:id
router.delete('/:projeId/dokumanlar/:id', (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM proje_dokumanlari WHERE id = ? AND proje_id = ?').get(req.params.id, req.params.projeId);
  if (!doc) return res.status(404).json({ success: false, error: 'Doküman bulunamadı' });

  try { if (doc.dosya_yolu && fs.existsSync(doc.dosya_yolu)) fs.unlinkSync(doc.dosya_yolu); } catch {}
  db.prepare('DELETE FROM proje_dokumanlari WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/projeler/:projeId/dokumanlar/:id/indir
router.get('/:projeId/dokumanlar/:id/indir', (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM proje_dokumanlari WHERE id = ? AND proje_id = ?').get(req.params.id, req.params.projeId);
  if (!doc || !fs.existsSync(doc.dosya_yolu)) {
    return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });
  }
  res.download(doc.dosya_yolu, doc.orijinal_adi || doc.dosya_adi);
});

// ============================================
// PROJE DOSYALARI (CAD)
// ============================================

// GET /api/projeler/:projeId/proje-dosyalari
router.get('/:projeId/proje-dosyalari', (req, res) => {
  const db = getDb();
  const data = db.prepare(
    `SELECT * FROM proje_dokumanlari WHERE proje_id = ? AND kategori = 'cad' ORDER BY olusturma_tarihi DESC`
  ).all(req.params.projeId);
  res.json({ success: true, data });
});

// POST /api/projeler/:projeId/proje-dosyalari
router.post('/:projeId/proje-dosyalari', cadUpload.single('dosya'), (req, res) => {
  const db = getDb();
  const file = req.file;
  if (!file) return res.status(400).json({ success: false, error: 'Dosya gerekli' });

  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const result = db.prepare(`
    INSERT INTO proje_dokumanlari (proje_id, kategori, dosya_adi, orijinal_adi, dosya_yolu, dosya_tipi, mime_tipi, dosya_boyutu, aciklama, yukleyen)
    VALUES (?, 'cad', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.projeId,
    file.filename,
    file.originalname,
    file.path,
    ext,
    file.mimetype,
    file.size,
    req.body.aciklama || null,
    req.body.yukleyen || 'koordinator'
  );

  res.json({ success: true, data: { id: result.lastInsertRowid } });
});

// DELETE /api/projeler/:projeId/proje-dosyalari/:id
router.delete('/:projeId/proje-dosyalari/:id', (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM proje_dokumanlari WHERE id = ? AND proje_id = ? AND kategori = ?').get(req.params.id, req.params.projeId, 'cad');
  if (!doc) return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });

  try { if (doc.dosya_yolu && fs.existsSync(doc.dosya_yolu)) fs.unlinkSync(doc.dosya_yolu); } catch {}
  db.prepare('DELETE FROM proje_dokumanlari WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/projeler/:projeId/proje-dosyalari/:id/indir
router.get('/:projeId/proje-dosyalari/:id/indir', (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM proje_dokumanlari WHERE id = ? AND proje_id = ? AND kategori = ?').get(req.params.id, req.params.projeId, 'cad');
  if (!doc || !fs.existsSync(doc.dosya_yolu)) {
    return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });
  }
  res.download(doc.dosya_yolu, doc.orijinal_adi || doc.dosya_adi);
});

// ============================================
// NOTLAR
// ============================================

// GET /api/projeler/:projeId/notlar
router.get('/:projeId/notlar', (req, res) => {
  const db = getDb();
  const data = db.prepare(
    'SELECT * FROM proje_notlari WHERE proje_id = ? ORDER BY olusturma_tarihi DESC'
  ).all(req.params.projeId);
  res.json({ success: true, data });
});

// POST /api/projeler/:projeId/notlar
router.post('/:projeId/notlar', (req, res) => {
  const db = getDb();
  const { baslik, icerik, yazar } = req.body;
  if (!icerik) return res.status(400).json({ success: false, error: 'İçerik gerekli' });

  const result = db.prepare(`
    INSERT INTO proje_notlari (proje_id, baslik, icerik, yazar)
    VALUES (?, ?, ?, ?)
  `).run(req.params.projeId, baslik || null, icerik, yazar || 'koordinator');

  res.json({ success: true, data: { id: result.lastInsertRowid } });
});

// PUT /api/projeler/:projeId/notlar/:id
router.put('/:projeId/notlar/:id', (req, res) => {
  const db = getDb();
  const { baslik, icerik } = req.body;
  if (!icerik) return res.status(400).json({ success: false, error: 'İçerik gerekli' });

  const existing = db.prepare('SELECT * FROM proje_notlari WHERE id = ? AND proje_id = ?').get(req.params.id, req.params.projeId);
  if (!existing) return res.status(404).json({ success: false, error: 'Not bulunamadı' });

  db.prepare(`
    UPDATE proje_notlari SET baslik = ?, icerik = ?, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?
  `).run(baslik || null, icerik, req.params.id);

  res.json({ success: true });
});

// DELETE /api/projeler/:projeId/notlar/:id
router.delete('/:projeId/notlar/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM proje_notlari WHERE id = ? AND proje_id = ?').get(req.params.id, req.params.projeId);
  if (!existing) return res.status(404).json({ success: false, error: 'Not bulunamadı' });

  db.prepare('DELETE FROM proje_notlari WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ============================================
// FOTOĞRAFLAR
// ============================================

// GET /api/projeler/:projeId/fotograflar
router.get('/:projeId/fotograflar', (req, res) => {
  const db = getDb();
  const data = db.prepare(`
    SELECT m.*, per.ad_soyad as yukleyen_adi
    FROM medya m
    LEFT JOIN personel per ON m.yukleyen_personel_id = per.id
    WHERE m.proje_id = ? AND m.dosya_tipi = 'photo'
    ORDER BY m.yukleme_tarihi DESC
  `).all(req.params.projeId);
  res.json({ success: true, data });
});

// POST /api/projeler/:projeId/fotograflar
router.post('/:projeId/fotograflar', fotoUpload.single('dosya'), (req, res) => {
  const db = getDb();
  const file = req.file;
  if (!file) return res.status(400).json({ success: false, error: 'Fotoğraf gerekli' });

  const result = db.prepare(`
    INSERT INTO medya (dosya_adi, orijinal_adi, dosya_yolu, dosya_tipi, mime_tipi, dosya_boyutu, proje_id, aciklama)
    VALUES (?, ?, ?, 'photo', ?, ?, ?, ?)
  `).run(
    file.filename,
    file.originalname,
    file.path,
    file.mimetype,
    file.size,
    req.params.projeId,
    req.body.aciklama || null
  );

  res.json({ success: true, data: { id: result.lastInsertRowid } });
});

// DELETE /api/projeler/:projeId/fotograflar/:id
router.delete('/:projeId/fotograflar/:id', (req, res) => {
  const db = getDb();
  const medya = db.prepare('SELECT * FROM medya WHERE id = ? AND proje_id = ?').get(req.params.id, req.params.projeId);
  if (!medya) return res.status(404).json({ success: false, error: 'Fotoğraf bulunamadı' });

  try { if (medya.dosya_yolu && fs.existsSync(medya.dosya_yolu)) fs.unlinkSync(medya.dosya_yolu); } catch {}
  try { if (medya.thumbnail_yolu && fs.existsSync(medya.thumbnail_yolu)) fs.unlinkSync(medya.thumbnail_yolu); } catch {}

  db.prepare('DELETE FROM medya WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ============================================
// KEŞİFLER
// ============================================

// GET /api/projeler/:projeId/kesifler
router.get('/:projeId/kesifler', (req, res) => {
  const db = getDb();
  const data = db.prepare(
    'SELECT * FROM proje_kesifler WHERE proje_id = ? ORDER BY kesif_tarihi DESC'
  ).all(req.params.projeId);

  // Her keşif için fotoğraf sayısını ekle
  for (const kesif of data) {
    kesif.foto_sayisi = db.prepare('SELECT COUNT(*) as c FROM medya WHERE kesif_id = ?').get(kesif.id).c;
  }

  res.json({ success: true, data });
});

// POST /api/projeler/:projeId/kesifler
router.post('/:projeId/kesifler', (req, res) => {
  const db = getDb();
  const { kesif_tarihi, kesif_yapan, bulgular, notlar, konum_bilgisi, durum } = req.body;

  const result = db.prepare(`
    INSERT INTO proje_kesifler (proje_id, kesif_tarihi, kesif_yapan, bulgular, notlar, konum_bilgisi, durum)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.projeId,
    kesif_tarihi || null,
    kesif_yapan || null,
    bulgular || null,
    notlar || null,
    konum_bilgisi || null,
    durum || 'taslak'
  );

  res.json({ success: true, data: { id: result.lastInsertRowid } });
});

// GET /api/projeler/:projeId/kesifler/:id
router.get('/:projeId/kesifler/:id', (req, res) => {
  const db = getDb();
  const kesif = db.prepare('SELECT * FROM proje_kesifler WHERE id = ? AND proje_id = ?').get(req.params.id, req.params.projeId);
  if (!kesif) return res.status(404).json({ success: false, error: 'Keşif bulunamadı' });

  // Keşife ait fotoğraflar
  kesif.fotograflar = db.prepare('SELECT * FROM medya WHERE kesif_id = ? ORDER BY yukleme_tarihi DESC').all(kesif.id);

  res.json({ success: true, data: kesif });
});

// PUT /api/projeler/:projeId/kesifler/:id
router.put('/:projeId/kesifler/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM proje_kesifler WHERE id = ? AND proje_id = ?').get(req.params.id, req.params.projeId);
  if (!existing) return res.status(404).json({ success: false, error: 'Keşif bulunamadı' });

  const { kesif_tarihi, kesif_yapan, bulgular, notlar, konum_bilgisi, durum } = req.body;
  db.prepare(`
    UPDATE proje_kesifler
    SET kesif_tarihi = ?, kesif_yapan = ?, bulgular = ?, notlar = ?, konum_bilgisi = ?, durum = ?, guncelleme_tarihi = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    kesif_tarihi || existing.kesif_tarihi,
    kesif_yapan || existing.kesif_yapan,
    bulgular !== undefined ? bulgular : existing.bulgular,
    notlar !== undefined ? notlar : existing.notlar,
    konum_bilgisi || existing.konum_bilgisi,
    durum || existing.durum,
    req.params.id
  );

  res.json({ success: true });
});

// DELETE /api/projeler/:projeId/kesifler/:id
router.delete('/:projeId/kesifler/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM proje_kesifler WHERE id = ? AND proje_id = ?').get(req.params.id, req.params.projeId);
  if (!existing) return res.status(404).json({ success: false, error: 'Keşif bulunamadı' });

  // Keşife ait fotoğrafları sil
  const fotograflar = db.prepare('SELECT * FROM medya WHERE kesif_id = ?').all(req.params.id);
  for (const foto of fotograflar) {
    try { if (foto.dosya_yolu && fs.existsSync(foto.dosya_yolu)) fs.unlinkSync(foto.dosya_yolu); } catch {}
    try { if (foto.thumbnail_yolu && fs.existsSync(foto.thumbnail_yolu)) fs.unlinkSync(foto.thumbnail_yolu); } catch {}
  }
  db.prepare('DELETE FROM medya WHERE kesif_id = ?').run(req.params.id);
  db.prepare('DELETE FROM proje_kesifler WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/projeler/:projeId/kesifler/:id/fotograflar
router.post('/:projeId/kesifler/:id/fotograflar', fotoUpload.single('dosya'), (req, res) => {
  const db = getDb();
  const kesif = db.prepare('SELECT * FROM proje_kesifler WHERE id = ? AND proje_id = ?').get(req.params.id, req.params.projeId);
  if (!kesif) return res.status(404).json({ success: false, error: 'Keşif bulunamadı' });

  const file = req.file;
  if (!file) return res.status(400).json({ success: false, error: 'Fotoğraf gerekli' });

  const result = db.prepare(`
    INSERT INTO medya (dosya_adi, orijinal_adi, dosya_yolu, dosya_tipi, mime_tipi, dosya_boyutu, proje_id, kesif_id, aciklama)
    VALUES (?, ?, ?, 'photo', ?, ?, ?, ?, ?)
  `).run(
    file.filename,
    file.originalname,
    file.path,
    file.mimetype,
    file.size,
    req.params.projeId,
    req.params.id,
    req.body.aciklama || null
  );

  res.json({ success: true, data: { id: result.lastInsertRowid } });
});

module.exports = router;
