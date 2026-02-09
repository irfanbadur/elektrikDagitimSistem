const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// GET /api/veri-paketleri
router.get('/', (req, res) => {
  const db = getDb();
  const { proje_id, ekip_id, tip, durum, tarih, limit = 50, offset = 0 } = req.query;
  let sql = `
    SELECT vp.*, p.proje_no, e.ekip_adi, per.ad_soyad as personel_adi
    FROM veri_paketleri vp
    LEFT JOIN projeler p ON vp.proje_id = p.id
    LEFT JOIN ekipler e ON vp.ekip_id = e.id
    LEFT JOIN personel per ON vp.personel_id = per.id
    WHERE 1=1
  `;
  const params = [];
  if (proje_id) { sql += ' AND vp.proje_id = ?'; params.push(proje_id); }
  if (ekip_id) { sql += ' AND vp.ekip_id = ?'; params.push(ekip_id); }
  if (tip) { sql += ' AND vp.paket_tipi = ?'; params.push(tip); }
  if (durum) { sql += ' AND vp.durum = ?'; params.push(durum); }
  if (tarih) { sql += ' AND date(vp.olusturma_tarihi) = ?'; params.push(tarih); }
  sql += ' ORDER BY vp.olusturma_tarihi DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const data = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as c FROM veri_paketleri').get().c;
  res.json({ success: true, data, total });
});

// POST /api/veri-paketleri
router.post('/', (req, res) => {
  const db = getDb();
  const { paket_tipi, personel_id, ekip_id, proje_id, bolge_id, latitude, longitude, adres_metni, notlar } = req.body;
  if (!paket_tipi) return res.status(400).json({ success: false, error: 'paket_tipi gerekli' });

  const result = db.prepare(`
    INSERT INTO veri_paketleri
      (paket_tipi, personel_id, ekip_id, proje_id, bolge_id, latitude, longitude, adres_metni, notlar, durum)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'tamamlandi')
  `).run(paket_tipi, personel_id || null, ekip_id || null, proje_id || null, bolge_id || null, latitude || null, longitude || null, adres_metni || null, notlar || null);

  const created = db.prepare('SELECT * FROM veri_paketleri WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: created });
});

// GET /api/veri-paketleri/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const paket = db.prepare(`
    SELECT vp.*, p.proje_no, e.ekip_adi, per.ad_soyad as personel_adi
    FROM veri_paketleri vp
    LEFT JOIN projeler p ON vp.proje_id = p.id
    LEFT JOIN ekipler e ON vp.ekip_id = e.id
    LEFT JOIN personel per ON vp.personel_id = per.id
    WHERE vp.id = ?
  `).get(req.params.id);
  if (!paket) return res.status(404).json({ success: false, error: 'Paket bulunamadi' });

  paket.medyalar = db.prepare('SELECT * FROM medya WHERE veri_paketi_id = ? ORDER BY yukleme_tarihi').all(req.params.id);

  // Analizleri de getir
  paket.analizler = db.prepare(`
    SELECT fa.* FROM foto_analiz fa
    JOIN medya m ON fa.medya_id = m.id
    WHERE m.veri_paketi_id = ?
    ORDER BY fa.analiz_katmani
  `).all(req.params.id);

  res.json({ success: true, data: paket });
});

// PUT /api/veri-paketleri/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const { paket_tipi, proje_id, notlar, durum, latitude, longitude, adres_metni } = req.body;
  const existing = db.prepare('SELECT * FROM veri_paketleri WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: 'Paket bulunamadi' });

  db.prepare(`
    UPDATE veri_paketleri
    SET paket_tipi = COALESCE(?, paket_tipi),
        proje_id = COALESCE(?, proje_id),
        notlar = COALESCE(?, notlar),
        durum = COALESCE(?, durum),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        adres_metni = COALESCE(?, adres_metni)
    WHERE id = ?
  `).run(paket_tipi, proje_id, notlar, durum, latitude, longitude, adres_metni, req.params.id);

  const updated = db.prepare('SELECT * FROM veri_paketleri WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: updated });
});

// DELETE /api/veri-paketleri/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM veri_paketleri WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/veri-paketleri/:id/medya
router.get('/:id/medya', (req, res) => {
  const db = getDb();
  const data = db.prepare('SELECT * FROM medya WHERE veri_paketi_id = ? ORDER BY yukleme_tarihi').all(req.params.id);
  res.json({ success: true, data });
});

module.exports = router;
