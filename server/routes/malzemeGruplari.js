const router = require('express').Router();
const { getDb } = require('../db/database');

// GET / — tüm gruplar (kalem sayısı ile)
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { arama } = req.query;
    let where = '', params = [];
    if (arama) { where = 'WHERE g.kisa_ad LIKE ? OR g.aciklama LIKE ?'; params = [`%${arama}%`, `%${arama}%`]; }
    const gruplar = db.prepare(`
      SELECT g.*, COUNT(k.id) AS kalem_sayisi
      FROM malzeme_gruplari g
      LEFT JOIN malzeme_grup_kalemleri k ON k.grup_id = g.id
      ${where}
      GROUP BY g.id
      ORDER BY g.kisa_ad COLLATE NOCASE
    `).all(...params);
    res.json({ success: true, data: gruplar });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /:id — tek grup + kalemleri
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const grup = db.prepare('SELECT * FROM malzeme_gruplari WHERE id = ?').get(req.params.id);
    if (!grup) return res.status(404).json({ success: false, error: 'Grup bulunamadı' });
    const kalemler = db.prepare(`
      SELECT k.*, c.malzeme_cinsi AS katalog_cinsi, c.malzeme_tanimi_sap AS katalog_sap, c.olcu AS katalog_olcu
      FROM malzeme_grup_kalemleri k
      LEFT JOIN depo_malzeme_katalogu c ON c.id = k.katalog_id
      WHERE k.grup_id = ?
      ORDER BY k.sira, k.id
    `).all(req.params.id);
    res.json({ success: true, data: { ...grup, kalemler } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /by-kisa-ad/:ad — Hakediş'ten tetiklenecek — kısa ada göre grup bul
router.get('/by-kisa-ad/:ad', (req, res) => {
  try {
    const db = getDb();
    const ad = (req.params.ad || '').trim().toLowerCase();
    if (!ad) return res.json({ success: true, data: null });
    const grup = db.prepare('SELECT * FROM malzeme_gruplari WHERE LOWER(kisa_ad) = ?').get(ad);
    if (!grup) return res.json({ success: true, data: null });
    const kalemler = db.prepare(`
      SELECT k.*, c.malzeme_cinsi AS katalog_cinsi, c.malzeme_tanimi_sap AS katalog_sap
      FROM malzeme_grup_kalemleri k
      LEFT JOIN depo_malzeme_katalogu c ON c.id = k.katalog_id
      WHERE k.grup_id = ?
      ORDER BY k.sira, k.id
    `).all(grup.id);
    res.json({ success: true, data: { ...grup, kalemler } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST / — yeni grup + kalemleri
router.post('/', (req, res) => {
  const db = getDb();
  const { kisa_ad, aciklama, kalemler = [] } = req.body;
  if (!kisa_ad?.trim()) return res.status(400).json({ success: false, error: 'Kısa ad zorunlu' });
  try {
    const tx = db.transaction(() => {
      const r = db.prepare('INSERT INTO malzeme_gruplari (kisa_ad, aciklama) VALUES (?, ?)').run(kisa_ad.trim(), aciklama || null);
      const grupId = r.lastInsertRowid;
      const stmt = db.prepare('INSERT INTO malzeme_grup_kalemleri (grup_id, katalog_id, malzeme_adi, malzeme_kodu, miktar, birim, kisa_isim, sira) VALUES (?,?,?,?,?,?,?,?)');
      kalemler.forEach((k, i) => stmt.run(grupId, k.katalog_id || null, k.malzeme_adi, k.malzeme_kodu || null, k.miktar || 1, k.birim || 'Ad', k.kisa_isim || null, k.sira ?? i));
      return grupId;
    });
    const yeniId = tx();
    res.json({ success: true, data: { id: yeniId } });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ success: false, error: 'Bu kısa ad zaten var' });
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /:id — grup güncelle + kalemleri tümden yenile
router.put('/:id', (req, res) => {
  const db = getDb();
  const { kisa_ad, aciklama, kalemler = [] } = req.body;
  if (!kisa_ad?.trim()) return res.status(400).json({ success: false, error: 'Kısa ad zorunlu' });
  try {
    const tx = db.transaction(() => {
      db.prepare('UPDATE malzeme_gruplari SET kisa_ad = ?, aciklama = ?, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?')
        .run(kisa_ad.trim(), aciklama || null, req.params.id);
      db.prepare('DELETE FROM malzeme_grup_kalemleri WHERE grup_id = ?').run(req.params.id);
      const stmt = db.prepare('INSERT INTO malzeme_grup_kalemleri (grup_id, katalog_id, malzeme_adi, malzeme_kodu, miktar, birim, kisa_isim, sira) VALUES (?,?,?,?,?,?,?,?)');
      kalemler.forEach((k, i) => stmt.run(req.params.id, k.katalog_id || null, k.malzeme_adi, k.malzeme_kodu || null, k.miktar || 1, k.birim || 'Ad', k.kisa_isim || null, k.sira ?? i));
    });
    tx();
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ success: false, error: 'Bu kısa ad zaten var' });
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM malzeme_gruplari WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
