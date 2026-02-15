const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { parseMesaj, parseVeKaydet } = require('../services/mesajParseService');

// ─────────────────────────────────────────────────────────
// POST /api/mesaj/gonder — Mesaj gönder + AI parse + kaydet
// ─────────────────────────────────────────────────────────
router.post('/gonder', async (req, res) => {
  try {
    const { mesaj, personel_id, kaynak } = req.body;

    if (!mesaj || mesaj.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Mesaj boş olamaz'
      });
    }

    const sonuc = await parseVeKaydet(mesaj.trim(), {
      personel_id: personel_id || null,
      kaynak: kaynak || 'mobil'
    });

    res.json({
      success: true,
      data: {
        parse: sonuc.parse,
        kaydedilenler: sonuc.kaydedilenler,
        meta: sonuc.meta
      }
    });
  } catch (error) {
    console.error('Mesaj gönderme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/mesaj/test-parse — Sadece parse et, kaydetme
// ─────────────────────────────────────────────────────────
router.post('/test-parse', async (req, res) => {
  try {
    const { mesaj } = req.body;

    if (!mesaj) {
      return res.status(400).json({ success: false, error: 'Mesaj gerekli' });
    }

    const sonuc = await parseMesaj(mesaj.trim());
    res.json(sonuc);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/mesaj/gecmis — Mesaj geçmişi (mobil UI için)
// ─────────────────────────────────────────────────────────
router.get('/gecmis', (req, res) => {
  try {
    const db = getDb();
    const { personel_id, limit, offset } = req.query;

    let where = [];
    let params = [];

    if (personel_id) {
      where.push('sm.gonderen_id = ?');
      params.push(personel_id);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const mesajlar = db.prepare(`
      SELECT
        sm.id,
        sm.ham_mesaj,
        sm.islem_tipi,
        sm.islem_detay,
        sm.konum,
        sm.proje_no,
        sm.guven_skoru,
        sm.durum,
        sm.kaynak,
        sm.olusturma_tarihi,
        p.ad_soyad AS gonderen_adi
      FROM saha_mesajlari sm
      LEFT JOIN personel p ON sm.gonderen_id = p.id
      ${whereClause}
      ORDER BY sm.olusturma_tarihi DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit) || 50, parseInt(offset) || 0);

    res.json({ success: true, data: mesajlar });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────
// PUT /api/mesaj/:id/onayla — Koordinatör mesaj onayı
// ─────────────────────────────────────────────────────────
router.put('/:id/onayla', (req, res) => {
  try {
    const db = getDb();
    const { durum, duzeltme_notu, onaylayan_id } = req.body;

    db.prepare(`
      UPDATE saha_mesajlari SET
        durum = ?,
        onaylayan_id = ?,
        onay_tarihi = datetime('now'),
        duzeltme_notu = ?
      WHERE id = ?
    `).run(
      durum || 'onaylandi',
      onaylayan_id || null,
      duzeltme_notu || null,
      req.params.id
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
