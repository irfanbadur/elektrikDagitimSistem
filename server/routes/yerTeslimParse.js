const router = require('express').Router();
const multer = require('multer');
const config = require('../config');
const { basarili, hata } = require('../utils/helpers');
const yerTeslimPrompt = require('../services/ai-engine/prompts/yerTeslimPrompt');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// POST /api/yer-teslim/parse - Yer teslim tutanağı görselini AI ile parse et
router.post('/parse', upload.single('dosya'), async (req, res) => {
  try {
    if (!req.file) return hata(res, 'Dosya yüklenmedi');

    const imageBase64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';
    const prompt = yerTeslimPrompt.buildPrompt();

    // Önce katman3 (cloud) dene - görsel analiz için en iyi
    const provider = config.ai.katman3.provider();
    let result = null;

    if (provider === 'claude') {
      const apiKey = config.ai.katman3.claude.apiKey();
      if (!apiKey) return hata(res, 'Claude API anahtarı ayarlanmamış. Ayarlar > AI bölümünden ekleyin.', 400);

      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: config.ai.katman3.claude.model,
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
            { type: 'text', text: prompt }
          ]
        }]
      });
      const text = response.content[0].text;
      const cleaned = text.replace(/```json|```/g, '').trim();
      try {
        result = JSON.parse(cleaned);
      } catch {
        result = { raw_text: text, parse_error: true };
      }
    } else if (provider === 'gemini') {
      const { getDb } = require('../db/database');
      const db = getDb();
      const apiKey = db.prepare("SELECT deger FROM firma_ayarlari WHERE anahtar = 'gemini_api_key'").get()?.deger;
      if (!apiKey) return hata(res, 'Gemini API anahtarı ayarlanmamış. Ayarlar > AI bölümünden ekleyin.', 400);

      const model = 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: prompt }] },
          contents: [{ role: 'user', parts: [
            { text: 'Bu yer teslim tutanagi gorselini analiz et ve JSON olarak don.' },
            { inline_data: { mime_type: mimeType, data: imageBase64 } }
          ]}],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
        }),
        signal: AbortSignal.timeout(60000)
      });

      const data = await response.json();
      if (!response.ok) {
        const errMsg = data.error?.message || `HTTP ${response.status}`;
        return hata(res, `Gemini API hata: ${errMsg}`, 500);
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleaned = text.replace(/```json|```/g, '').trim();
      try {
        result = JSON.parse(cleaned);
      } catch {
        result = { raw_text: text, parse_error: true };
      }
    } else if (provider === 'openai') {
      const apiKey = config.ai.katman3.openai.apiKey();
      if (!apiKey) return hata(res, 'OpenAI API anahtarı ayarlanmamış.', 400);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: config.ai.katman3.openai.model,
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
              { type: 'text', text: prompt }
            ]
          }],
          max_tokens: 4000,
          response_format: { type: 'json_object' }
        })
      });
      const data = await response.json();
      result = JSON.parse(data.choices[0].message.content);
    } else {
      return hata(res, 'AI provider yapılandırılmamış', 400);
    }

    basarili(res, result);
  } catch (err) {
    console.error('Yer teslim parse hatası:', err);
    hata(res, err.message || 'AI analizi sırasında hata oluştu', 500);
  }
});

module.exports = router;
