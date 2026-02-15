const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const aiSohbetService = require('../services/ai/aiSohbetService');

router.use(authMiddleware);

// POST /api/ai-sohbet/mesaj — Mesaj gönder
router.post('/mesaj', async (req, res) => {
  try {
    const { sohbet_id, mesaj, baglam } = req.body;
    if (!mesaj?.trim()) return res.status(400).json({ success: false, error: 'Mesaj boş olamaz' });

    const sonuc = await aiSohbetService.mesajGonder({
      sohbetId: sohbet_id || null,
      mesaj: mesaj.trim(),
      kullaniciId: req.kullanici.id,
      baglam: { ...baglam, kullaniciAdi: req.kullanici.ad_soyad },
    });
    res.json({ success: true, data: sonuc });
  } catch (error) {
    console.error('[AI Sohbet] Mesaj hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ai-sohbet/liste — Sohbet listesi
router.get('/liste', (req, res) => {
  try {
    const sohbetler = aiSohbetService.sohbetListele(req.kullanici.id, parseInt(req.query.limit) || 20);
    res.json({ success: true, data: sohbetler });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ai-sohbet/:id — Sohbet mesajları
router.get('/:id', (req, res) => {
  try {
    const data = aiSohbetService.mesajlariGetir(parseInt(req.params.id), req.kullanici.id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/ai-sohbet/:id — Sohbet sil
router.delete('/:id', (req, res) => {
  try {
    aiSohbetService.sohbetSil(parseInt(req.params.id), req.kullanici.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/ai-sohbet/:id/baslik — Başlık güncelle
router.put('/:id/baslik', (req, res) => {
  try {
    aiSohbetService.baslikGuncelle(parseInt(req.params.id), req.kullanici.id, req.body.baslik);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
