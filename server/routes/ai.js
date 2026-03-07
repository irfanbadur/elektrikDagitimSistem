const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// GET /api/ai/durum
router.get('/durum', async (req, res) => {
  try {
    const aiManager = require('../services/ai-engine/aiManager');
    const status = await aiManager.healthCheck();
    res.json({ success: true, data: status });
  } catch (error) {
    res.json({ success: true, data: { katman1: false, katman2: false, katman3: false, error: error.message } });
  }
});

// GET /api/ai/ayarlar
router.get('/ayarlar', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT anahtar, deger, aciklama FROM firma_ayarlari
    WHERE anahtar IN ('ai_aktif_katmanlar', 'ollama_base_url', 'ollama_text_model', 'ollama_vision_model',
      'cloud_ai_provider', 'claude_api_key', 'openai_api_key', 'foto_oto_analiz_seviyesi')
  `).all();
  const data = {};
  rows.forEach(r => {
    if (r.anahtar.includes('api_key') && r.deger) {
      data[r.anahtar] = r.deger ? '***' + r.deger.slice(-4) : '';
    } else {
      data[r.anahtar] = r.deger;
    }
  });
  res.json({ success: true, data });
});

// PUT /api/ai/ayarlar
router.put('/ayarlar', (req, res) => {
  const db = getDb();
  const ayarlar = req.body;
  const stmt = db.prepare('UPDATE firma_ayarlari SET deger = ? WHERE anahtar = ?');
  for (const [key, value] of Object.entries(ayarlar)) {
    if (value !== undefined && value !== '***') {
      stmt.run(String(value), key);
    }
  }
  res.json({ success: true });
});

// GET /api/ai/ollama/modeller
router.get('/ollama/modeller', async (req, res) => {
  try {
    const config = require('../config');
    const baseUrl = config.ai.katman1.baseUrl();
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) throw new Error('Ollama baglantisi basarisiz');
    const data = await response.json();
    res.json({ success: true, data: data.models || [] });
  } catch (error) {
    res.json({ success: true, data: [], error: error.message });
  }
});

// POST /api/ai/ollama/model-indir
router.post('/ollama/model-indir', async (req, res) => {
  try {
    const { model_adi } = req.body;
    if (!model_adi) return res.status(400).json({ success: false, error: 'model_adi gerekli' });
    const config = require('../config');
    const baseUrl = config.ai.katman1.baseUrl();
    const response = await fetch(`${baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model_adi, stream: false })
    });
    const data = await response.json();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
