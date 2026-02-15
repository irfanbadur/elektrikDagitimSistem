const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const aiOperasyonService = require('../services/ai/aiOperasyonService');
const aksiyonRegistry = require('../services/ai/aksiyonRegistry');
const providerManager = require('../services/ai/providerManager');

router.use(authMiddleware);

// POST /api/ai-op/islem — Yeni AI islem baslat (parse + plan)
router.post('/islem', async (req, res) => {
  try {
    const { metin, gorseller, belgeler, proje_id, ekip_id, veri_paketi_id } = req.body;
    const sonuc = await aiOperasyonService.mesajIsle({
      metin, gorseller: gorseller || [], belgeler: belgeler || [],
      kullaniciId: req.kullanici.id, projeId: proje_id,
      ekipId: ekip_id || req.kullanici.ekip_id, veriPaketiId: veri_paketi_id,
    });
    res.json({ success: true, data: sonuc });
  } catch (error) {
    console.error('[AI-OP] islem hatasi:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/ai-op/islem/:id/onayla
router.put('/islem/:id/onayla', async (req, res) => {
  try {
    const sonuc = await aiOperasyonService.onayla(parseInt(req.params.id), req.kullanici.id, req.body.duzeltmeler);
    res.json({ success: true, data: sonuc });
  } catch (error) {
    console.error('[AI-OP] onay hatasi:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/ai-op/islem/:id/reddet
router.put('/islem/:id/reddet', (req, res) => {
  try {
    aiOperasyonService.reddet(parseInt(req.params.id), req.kullanici.id, req.body.sebep);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/ai-op/islem/:id/geri-al
router.put('/islem/:id/geri-al', async (req, res) => {
  try {
    const sonuc = await aiOperasyonService.geriAl(parseInt(req.params.id), req.kullanici.id);
    res.json({ success: true, data: sonuc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ai-op/islemler — Islem gecmisi
router.get('/islemler', (req, res) => {
  try {
    const db = require('../db/database').getDb();
    const { durum, limit = 20, offset = 0 } = req.query;
    let where = ['1=1'], params = [];
    if (durum) { where.push('durum = ?'); params.push(durum); }

    const islemler = db.prepare(`
      SELECT ai.*, k.ad_soyad as kullanici_adi FROM ai_islemler ai
      LEFT JOIN kullanicilar k ON ai.kullanici_id = k.id
      WHERE ${where.join(' AND ')} ORDER BY ai.olusturma_tarihi DESC LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), parseInt(offset));
    res.json({ success: true, data: islemler });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ai-op/aksiyonlar — Mevcut aksiyon tipleri
router.get('/aksiyonlar', (req, res) => {
  res.json({ success: true, data: aksiyonRegistry.tumunu() });
});

// GET /api/ai-op/durum — AI saglayici durumlari
router.get('/durum', async (req, res) => {
  try {
    const durum = await providerManager.durumKontrol();
    const istatistik = providerManager.istatistikGetir();
    res.json({ success: true, data: {
      aktifProvider: process.env.AI_PROVIDER || 'ollama',
      fallbackSirasi: (process.env.AI_FALLBACK_ORDER || 'ollama,groq,gemini').split(','),
      providers: durum, istatistik,
    }});
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/ai-op/test — Baglanti testi
router.post('/test', async (req, res) => {
  try {
    const { metin, provider } = req.body;
    const testMesaj = metin || 'Merhaba, test. "test": true JSON dondur.';

    if (provider && providerManager.providers[provider]) {
      const p = providerManager.providers[provider];
      const saglikli = await p.saglikKontrol();
      if (!saglikli) return res.json({ success: false, error: `${provider} erisilemez` });
      const baslangic = Date.now();
      const sonuc = await p.metinGonder('Kisa yanit ver.', testMesaj);
      return res.json({ success: true, provider, sure: Date.now() - baslangic, data: sonuc });
    }

    // Tum provider'lari test et
    const sonuclar = {};
    for (const [isim, p] of Object.entries(providerManager.providers)) {
      try {
        const saglikli = await p.saglikKontrol();
        if (saglikli) {
          const bas = Date.now();
          const sonuc = await p.metinGonder('Kisa yanit ver.', testMesaj);
          sonuclar[isim] = { aktif: true, sure: Date.now() - bas, yanitUzunluk: sonuc.metin.length };
        } else {
          sonuclar[isim] = { aktif: false, sebep: 'Saglik kontrolu basarisiz' };
        }
      } catch (err) {
        sonuclar[isim] = { aktif: false, sebep: err.message };
      }
    }
    res.json({ success: true, data: sonuclar });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
