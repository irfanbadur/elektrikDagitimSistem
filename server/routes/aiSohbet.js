const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authMiddleware } = require('../middleware/auth');
const aiSohbetService = require('../services/ai/aiSohbetService');

router.use(authMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const izinli = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    cb(null, izinli.includes(file.mimetype));
  },
});

// POST /api/ai-sohbet/mesaj — Mesaj gönder (dosya + konum destekli)
router.post('/mesaj', upload.array('dosyalar', 10), async (req, res) => {
  try {
    const { sohbet_id, mesaj, baglam: baglamStr, konum: konumStr } = req.body;
    if (!mesaj?.trim() && !req.files?.length) {
      return res.status(400).json({ success: false, error: 'Mesaj veya dosya gerekli' });
    }

    const baglam = baglamStr ? JSON.parse(baglamStr) : {};
    const konum = konumStr ? JSON.parse(konumStr) : null;

    const dosyalar = (req.files || []).map(f => ({
      buffer: f.buffer,
      mimeType: f.mimetype,
      orijinalAdi: f.originalname,
    }));

    const sonuc = await aiSohbetService.mesajGonder({
      sohbetId: sohbet_id ? parseInt(sohbet_id) : null,
      mesaj: mesaj?.trim() || '(medya gönderildi)',
      kullaniciId: req.kullanici.id,
      baglam: { ...baglam, kullaniciAdi: req.kullanici.ad_soyad },
      dosyalar,
      konum,
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
