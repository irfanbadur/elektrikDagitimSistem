const router = require('express').Router();
const multer = require('multer');
const config = require('../config');
const { getDb } = require('../db/database');
const { aktiviteLogla, basarili, hata } = require('../utils/helpers');
const bonoParsePrompt = require('../services/ai-engine/prompts/bonoParsePrompt');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// GET / - tüm bonolar
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const bonolar = db.prepare(`
      SELECT b.*,
        COUNT(bk.id) as kalem_sayisi,
        SUM(bk.miktar) as toplam_miktar,
        COUNT(DISTINCT bk.proje_id) as proje_sayisi
      FROM bonolar b
      LEFT JOIN bono_kalemleri bk ON bk.bono_id = b.id
      GROUP BY b.id
      ORDER BY b.bono_tarihi DESC
    `).all();
    basarili(res, bonolar);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// GET /:id - bono detay (kalemler dahil)
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const bono = db.prepare('SELECT * FROM bonolar WHERE id = ?').get(req.params.id);
    if (!bono) return hata(res, 'Bono bulunamadi', 404);

    bono.kalemler = db.prepare(`
      SELECT bk.*, p.proje_no
      FROM bono_kalemleri bk
      LEFT JOIN projeler p ON bk.proje_id = p.id
      ORDER BY bk.id
    `).all();

    basarili(res, bono);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST / - yeni bono oluştur (kalemlerle birlikte)
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { bono_no, bono_tarihi, kurum, teslim_alan, aciklama, kalemler } = req.body;
    if (!bono_no) return hata(res, 'Bono no zorunludur');
    if (!bono_tarihi) return hata(res, 'Bono tarihi zorunludur');

    const transaction = db.transaction(() => {
      // Bono oluştur
      const result = db.prepare(`
        INSERT INTO bonolar (bono_no, bono_tarihi, kurum, teslim_alan, aciklama)
        VALUES (?, ?, ?, ?, ?)
      `).run(bono_no, bono_tarihi, kurum || 'EDAS', teslim_alan, aciklama);

      const bonoId = result.lastInsertRowid;

      // Kalemleri ekle
      if (kalemler && kalemler.length > 0) {
        const kalemStmt = db.prepare(`
          INSERT INTO bono_kalemleri (bono_id, malzeme_kodu, poz_no, malzeme_adi, birim, miktar, proje_id, proje_kesif_id, notlar)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const k of kalemler) {
          kalemStmt.run(bonoId, k.malzeme_kodu, k.poz_no, k.malzeme_adi, k.birim || 'Ad', k.miktar || 0, k.proje_id || null, k.proje_kesif_id || null, k.notlar);

          // Ana Depo stoğuna ekle
          if (k.miktar > 0) {
            const malzeme = db.prepare('SELECT id FROM malzemeler WHERE malzeme_kodu = ?').get(k.malzeme_kodu);
            if (malzeme) {
              const anaDepo = db.prepare("SELECT id FROM depolar WHERE depo_tipi = 'ana_depo' LIMIT 1").get();
              if (anaDepo) {
                const mevcutStok = db.prepare('SELECT miktar FROM depo_stok WHERE depo_id = ? AND malzeme_id = ?').get(anaDepo.id, malzeme.id);
                if (mevcutStok) {
                  db.prepare('UPDATE depo_stok SET miktar = miktar + ?, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE depo_id = ? AND malzeme_id = ?').run(k.miktar, anaDepo.id, malzeme.id);
                } else {
                  db.prepare('INSERT INTO depo_stok (depo_id, malzeme_id, miktar) VALUES (?, ?, ?)').run(anaDepo.id, malzeme.id, k.miktar);
                }
                // malzemeler tablosundaki stok da güncelle
                db.prepare('UPDATE malzemeler SET stok_miktari = stok_miktari + ? WHERE id = ?').run(k.miktar, malzeme.id);
              }
            }
          }

          // Proje keşif durumunu güncelle
          if (k.proje_kesif_id) {
            db.prepare("UPDATE proje_kesif SET durum = 'alindi', guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?").run(k.proje_kesif_id);
          }
        }
      }

      const bono = db.prepare('SELECT * FROM bonolar WHERE id = ?').get(bonoId);
      aktiviteLogla('bono', 'olusturma', bonoId, `Bono: ${bono_no} - ${kalemler?.length || 0} kalem`);
      return bono;
    });

    const bono = transaction();
    basarili(res, bono, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// PUT /:id - bono güncelle
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { bono_no, bono_tarihi, kurum, teslim_alan, aciklama } = req.body;

    db.prepare(`
      UPDATE bonolar SET bono_no=?, bono_tarihi=?, kurum=?, teslim_alan=?, aciklama=?, guncelleme_tarihi=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(bono_no, bono_tarihi, kurum, teslim_alan, aciklama, req.params.id);

    const guncellenen = db.prepare('SELECT * FROM bonolar WHERE id = ?').get(req.params.id);
    basarili(res, guncellenen);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /:id/kalem - bonoya kalem ekle
router.post('/:id/kalem', (req, res) => {
  try {
    const db = getDb();
    const { malzeme_kodu, poz_no, malzeme_adi, birim, miktar, proje_id, proje_kesif_id, notlar } = req.body;
    if (!malzeme_adi) return hata(res, 'Malzeme adi zorunludur');

    const result = db.prepare(`
      INSERT INTO bono_kalemleri (bono_id, malzeme_kodu, poz_no, malzeme_adi, birim, miktar, proje_id, proje_kesif_id, notlar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, malzeme_kodu, poz_no, malzeme_adi, birim || 'Ad', miktar || 0, proje_id || null, proje_kesif_id || null, notlar);

    const yeni = db.prepare('SELECT * FROM bono_kalemleri WHERE id = ?').get(result.lastInsertRowid);
    basarili(res, yeni, 201);
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// DELETE /:id/kalem/:kalemId - bono kalemi sil
router.delete('/:id/kalem/:kalemId', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM bono_kalemleri WHERE id = ? AND bono_id = ?').run(req.params.kalemId, req.params.id);
    basarili(res, { silindi: true });
  } catch (err) {
    hata(res, err.message, 500);
  }
});

// POST /parse - Bono görselini AI ile parse et
router.post('/parse', upload.single('dosya'), async (req, res) => {
  try {
    if (!req.file) return hata(res, 'Dosya yüklenmedi');

    const imageBase64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';
    const prompt = bonoParsePrompt.buildPrompt();

    const provider = config.ai.katman3.provider();
    let result = null;

    if (provider === 'claude') {
      const apiKey = config.ai.katman3.claude.apiKey();
      if (!apiKey) return hata(res, 'Claude API anahtarı ayarlanmamış.', 400);

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
      try { result = JSON.parse(cleaned); } catch { result = { raw_text: text, parse_error: true }; }
    } else if (provider === 'gemini') {
      const db = getDb();
      const apiKey = db.prepare("SELECT deger FROM firma_ayarlari WHERE anahtar = 'gemini_api_key'").get()?.deger;
      if (!apiKey) return hata(res, 'Gemini API anahtarı ayarlanmamış.', 400);

      const model = 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const body = JSON.stringify({
        system_instruction: { parts: [{ text: prompt }] },
        contents: [{ role: 'user', parts: [
          { text: 'Bu bono belgesini analiz et ve JSON olarak don.' },
          { inline_data: { mime_type: mimeType, data: imageBase64 } }
        ]}],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
      });

      let response, data;
      for (let attempt = 1; attempt <= 3; attempt++) {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: AbortSignal.timeout(60000)
        });
        data = await response.json();
        if (response.status === 429 && attempt < 3) {
          const retryMatch = (data.error?.message || '').match(/retry in ([\d.]+)s/i);
          const beklemeSn = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 1 : 30;
          await new Promise(r => setTimeout(r, beklemeSn * 1000));
          continue;
        }
        break;
      }
      if (!response.ok) return hata(res, `Gemini API hata: ${data.error?.message || response.status}`, 500);

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleaned = text.replace(/```json|```/g, '').trim();
      try { result = JSON.parse(cleaned); } catch { result = { raw_text: text, parse_error: true }; }
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
    console.error('Bono parse hatası:', err);
    hata(res, err.message || 'AI analizi sırasında hata oluştu', 500);
  }
});

module.exports = router;
