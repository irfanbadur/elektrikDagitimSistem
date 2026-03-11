const router = require('express').Router();
const multer = require('multer');
const config = require('../config');
const { getDb } = require('../db/database');
const { aktiviteLogla, basarili, hata } = require('../utils/helpers');
const bonoParsePrompt = require('../services/ai-engine/prompts/bonoParsePrompt');
const irsaliyeParsePrompt = require('../services/ai-engine/prompts/irsaliyeParsePrompt');
const evrakParsePrompt = require('../services/ai-engine/prompts/evrakParsePrompt');
const dosyaService = require('../services/dosyaService');

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

// Ortak gorsel parse fonksiyonu (tek dosya, req/res wrapper)
async function gorselParseEt(req, res, prompt, userMessage) {
  if (!req.file) return hata(res, 'Dosya yüklenmedi');
  const result = await tekGorselParseEt(req.file.buffer, req.file.mimetype || 'image/jpeg', prompt, userMessage);
  basarili(res, result);
}

// POST /parse - Bono görselini AI ile parse et
router.post('/parse', upload.single('dosya'), async (req, res) => {
  try {
    await gorselParseEt(req, res, bonoParsePrompt.buildPrompt(), 'Bu bono belgesini analiz et ve JSON olarak don.');
  } catch (err) {
    console.error('Bono parse hatası:', err);
    hata(res, err.message || 'AI analizi sırasında hata oluştu', 500);
  }
});

// POST /parse-irsaliye - İrsaliye görselini AI ile parse et
router.post('/parse-irsaliye', upload.single('dosya'), async (req, res) => {
  try {
    await gorselParseEt(req, res, irsaliyeParsePrompt.buildPrompt(), 'Bu irsaliye/fatura belgesini analiz et ve JSON olarak don.');
  } catch (err) {
    console.error('İrsaliye parse hatası:', err);
    hata(res, err.message || 'AI analizi sırasında hata oluştu', 500);
  }
});

// Tek bir görseli AI ile parse et (buffer + mimeType alır, sonucu döner)
async function tekGorselParseEt(buffer, mimeType, prompt, userMessage) {
  const imageBase64 = buffer.toString('base64');
  const provider = config.ai.katman3.provider();
  let result = null;

  if (provider === 'claude') {
    const apiKey = config.ai.katman3.claude.apiKey();
    if (!apiKey) throw new Error('Claude API anahtarı ayarlanmamış.');
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: config.ai.katman3.claude.model,
      max_tokens: 4000,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
        { type: 'text', text: prompt }
      ]}]
    });
    const text = response.content[0].text;
    const cleaned = text.replace(/```json|```/g, '').trim();
    try { result = JSON.parse(cleaned); } catch { result = { raw_text: text, parse_error: true }; }

  } else if (provider === 'gemini') {
    const db = getDb();
    const apiKey = db.prepare("SELECT deger FROM firma_ayarlari WHERE anahtar = 'gemini_api_key'").get()?.deger;
    if (!apiKey) throw new Error('Gemini API anahtarı ayarlanmamış.');
    const modeller = ['gemini-2.5-flash', 'gemini-2.0-flash'];
    let response, data;
    for (const model of modeller) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const body = JSON.stringify({
        system_instruction: { parts: [{ text: prompt }] },
        contents: [{ role: 'user', parts: [
          { text: userMessage },
          { inline_data: { mime_type: mimeType, data: imageBase64 } }
        ]}],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
      });
      let modelBasarili = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        response = await fetch(url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body, signal: AbortSignal.timeout(60000)
        });
        data = await response.json();
        if ((response.status === 429 || response.status === 503) && attempt < 3) {
          const retryMatch = (data.error?.message || '').match(/retry in ([\d.]+)s/i);
          const beklemeSn = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 1 : 15;
          await new Promise(r => setTimeout(r, beklemeSn * 1000));
          continue;
        }
        if (response.ok) { modelBasarili = true; }
        break;
      }
      if (modelBasarili) break;
      // İlk model başarısız, sonraki modele geç
      if (model !== modeller[modeller.length - 1]) {
        console.log(`Gemini ${model} başarısız (${response.status}), ${modeller[modeller.indexOf(model) + 1]} deneniyor...`);
      }
    }
    if (!response.ok) throw new Error(`Gemini API hata: ${data.error?.message || response.status}`);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    try { result = JSON.parse(cleaned); } catch { result = { raw_text: text, parse_error: true }; }

  } else if (provider === 'openai') {
    const apiKey = config.ai.katman3.openai.apiKey();
    if (!apiKey) throw new Error('OpenAI API anahtarı ayarlanmamış.');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: config.ai.katman3.openai.model,
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          { type: 'text', text: prompt }
        ]}],
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      })
    });
    const data = await response.json();
    result = JSON.parse(data.choices[0].message.content);
  } else {
    throw new Error('AI provider yapılandırılmamış');
  }
  return result;
}

// Metin tabanlı AI çağrısı (görsel yok, sadece text → text)
async function metinTabanliAI(systemMsg, userMsg) {
  const provider = config.ai.katman3.provider();
  let result = null;

  if (provider === 'claude') {
    const apiKey = config.ai.katman3.claude.apiKey();
    if (!apiKey) throw new Error('Claude API anahtarı ayarlanmamış.');
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: config.ai.katman3.claude.model,
      max_tokens: 8000,
      system: systemMsg,
      messages: [{ role: 'user', content: userMsg }]
    });
    const text = response.content[0].text;
    const cleaned = text.replace(/```json|```/g, '').trim();
    try { result = JSON.parse(cleaned); } catch { result = { raw_text: text, parse_error: true }; }

  } else if (provider === 'gemini') {
    const db = getDb();
    const apiKey = db.prepare("SELECT deger FROM firma_ayarlari WHERE anahtar = 'gemini_api_key'").get()?.deger;
    if (!apiKey) throw new Error('Gemini API anahtarı ayarlanmamış.');
    const modeller = ['gemini-2.5-flash', 'gemini-2.0-flash'];
    let response, data;
    for (const model of modeller) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const body = JSON.stringify({
        system_instruction: { parts: [{ text: systemMsg }] },
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
      });
      let modelBasarili = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        response = await fetch(url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body, signal: AbortSignal.timeout(60000)
        });
        data = await response.json();
        if ((response.status === 429 || response.status === 503) && attempt < 3) {
          const retryMatch = (data.error?.message || '').match(/retry in ([\d.]+)s/i);
          const beklemeSn = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 1 : 15;
          await new Promise(r => setTimeout(r, beklemeSn * 1000));
          continue;
        }
        if (response.ok) { modelBasarili = true; }
        break;
      }
      if (modelBasarili) break;
      if (model !== modeller[modeller.length - 1]) {
        console.log(`Gemini ${model} başarısız (${response.status}), ${modeller[modeller.indexOf(model) + 1]} deneniyor...`);
      }
    }
    if (!response.ok) throw new Error(`Gemini API hata: ${data.error?.message || response.status}`);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    try { result = JSON.parse(cleaned); } catch { result = { raw_text: text, parse_error: true }; }

  } else if (provider === 'openai') {
    const apiKey = config.ai.katman3.openai.apiKey();
    if (!apiKey) throw new Error('OpenAI API anahtarı ayarlanmamış.');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: config.ai.katman3.openai.model,
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: userMsg }
        ],
        max_tokens: 8000,
        response_format: { type: 'json_object' }
      })
    });
    const data = await response.json();
    result = JSON.parse(data.choices[0].message.content);
  } else {
    throw new Error('AI provider yapılandırılmamış');
  }
  return result;
}

// Birden fazla sayfa sonucunu kod ile birleştir (AI çağrısı yapmaz, daha hızlı ve güvenilir)
function sayfalariKodIleBirlestir(sayfaSonuclari, belgeTipi) {
  if (sayfaSonuclari.length === 0) return null;
  if (sayfaSonuclari.length === 1) return sayfaSonuclari[0];

  // Belge bilgilerini ilk geçerli değerlerden al
  const bilgiAnahtarlari = belgeTipi === 'BONO'
    ? ['bono_no', 'bono_tarihi', 'kurum', 'teslim_alan', 'teslim_eden', 'aciklama']
    : ['irsaliye_no', 'irsaliye_tarihi', 'firma', 'sevk_eden', 'teslim_alan', 'aciklama'];

  const bilgi = {};
  for (const key of bilgiAnahtarlari) {
    for (const s of sayfaSonuclari) {
      const val = s[key] || s.belge_bilgi?.[key];
      if (val) { bilgi[key] = val; break; }
    }
    if (!bilgi[key]) bilgi[key] = null;
  }

  // Tüm kalemleri sayfa sırasına göre topla
  let tumKalemler = [];
  for (const s of sayfaSonuclari) {
    tumKalemler.push(...(s.kalemler || []));
  }

  // Tekrarlayan kalemleri kaldır (sayfa kenar tekrarları)
  // Aynı malzeme_kodu VEYA (aynı poz_no + benzer malzeme_adi) → tekrar
  const benzersizKalemler = [];
  for (const k of tumKalemler) {
    const tekrar = benzersizKalemler.find(b => {
      // Malzeme kodu eşleşmesi (her ikisinde de varsa)
      if (k.malzeme_kodu && b.malzeme_kodu && k.malzeme_kodu === b.malzeme_kodu) return true;
      // Poz no + malzeme adı eşleşmesi
      if (k.poz_no && b.poz_no && k.poz_no === b.poz_no) return true;
      // Tam aynı malzeme adı + aynı miktar → muhtemelen tekrar
      if (k.malzeme_adi && b.malzeme_adi &&
          k.malzeme_adi.trim().toLowerCase() === b.malzeme_adi.trim().toLowerCase() &&
          (k.miktar || 0) === (b.miktar || 0)) return true;
      return false;
    });
    if (!tekrar) {
      benzersizKalemler.push({ ...k });
    }
  }

  // sira_no'ları yeniden numarala
  benzersizKalemler.forEach((k, i) => { k.sira_no = i + 1; });

  console.log(`  Kod birleştirme: ${tumKalemler.length} toplam → ${benzersizKalemler.length} benzersiz kalem`);

  return { belge_bilgi: bilgi, kalemler: benzersizKalemler };
}

// Bono ve irsaliye kalem listelerini kod ile çapraz karşılaştır (AI çağrısı yapmaz)
function caprazKarsilastirKod(bonoKalemler, irsaliyeKalemler) {
  const sonuc = [];
  const eslesenIrsaliyeIndexler = new Set();

  // Metin benzerlik kontrolü (küçük harf, trim, özel karakter temizle)
  function normalizeAd(ad) {
    return (ad || '').trim().toLowerCase().replace(/[^a-z0-9çğıöşüâ]/gi, ' ').replace(/\s+/g, ' ').trim();
  }

  // Bono kalemlerini sırayla işle, irsaliyede eşleşen bul
  for (const bk of bonoKalemler) {
    let eslesenIdx = -1;

    for (let j = 0; j < irsaliyeKalemler.length; j++) {
      if (eslesenIrsaliyeIndexler.has(j)) continue;
      const ik = irsaliyeKalemler[j];

      // 1) Malzeme kodu eşleşmesi (en güvenilir)
      if (bk.malzeme_kodu && ik.malzeme_kodu && bk.malzeme_kodu === ik.malzeme_kodu) {
        eslesenIdx = j; break;
      }
      // 2) Poz no eşleşmesi
      if (bk.poz_no && ik.poz_no && bk.poz_no === ik.poz_no) {
        eslesenIdx = j; break;
      }
      // 3) Malzeme adı benzerliği
      const ad1 = normalizeAd(bk.malzeme_adi);
      const ad2 = normalizeAd(ik.malzeme_adi);
      if (ad1 && ad2 && (ad1 === ad2 || ad1.includes(ad2) || ad2.includes(ad1))) {
        eslesenIdx = j; break;
      }
    }

    const miktarBono = bk.miktar || bk.miktar_bono || 0;

    if (eslesenIdx >= 0) {
      eslesenIrsaliyeIndexler.add(eslesenIdx);
      const ik = irsaliyeKalemler[eslesenIdx];
      const miktarIrsaliye = ik.miktar || ik.miktar_irsaliye || 0;
      sonuc.push({
        sira_no: sonuc.length + 1,
        malzeme_kodu: bk.malzeme_kodu || ik.malzeme_kodu || null,
        poz_no: bk.poz_no || ik.poz_no || null,
        malzeme_adi: bk.malzeme_adi || ik.malzeme_adi || '',
        birim: bk.birim || ik.birim || 'Ad',
        miktar_bono: miktarBono,
        miktar_irsaliye: miktarIrsaliye,
        kaynak: 'her_ikisi',
        uyumsuzluk: miktarBono !== miktarIrsaliye,
      });
    } else {
      sonuc.push({
        sira_no: sonuc.length + 1,
        malzeme_kodu: bk.malzeme_kodu || null,
        poz_no: bk.poz_no || null,
        malzeme_adi: bk.malzeme_adi || '',
        birim: bk.birim || 'Ad',
        miktar_bono: miktarBono,
        miktar_irsaliye: 0,
        kaynak: 'bono',
        uyumsuzluk: false,
      });
    }
  }

  // İrsaliyede olup bonoda eşleşmeyen kalemleri sona ekle
  for (let j = 0; j < irsaliyeKalemler.length; j++) {
    if (eslesenIrsaliyeIndexler.has(j)) continue;
    const ik = irsaliyeKalemler[j];
    sonuc.push({
      sira_no: sonuc.length + 1,
      malzeme_kodu: ik.malzeme_kodu || null,
      poz_no: ik.poz_no || null,
      malzeme_adi: ik.malzeme_adi || '',
      birim: ik.birim || 'Ad',
      miktar_bono: 0,
      miktar_irsaliye: ik.miktar || ik.miktar_irsaliye || 0,
      kaynak: 'irsaliye',
      uyumsuzluk: false,
    });
  }

  const eslesenSayisi = eslesenIrsaliyeIndexler.size;
  const sadeceBono = bonoKalemler.length - eslesenSayisi;
  const sadeceIrsaliye = irsaliyeKalemler.length - eslesenSayisi;
  console.log(`  Çapraz karşılaştırma (kod): ${eslesenSayisi} eşleşti, ${sadeceBono} sadece bono, ${sadeceIrsaliye} sadece irsaliye`);

  return { kalemler: sonuc };
}

// POST /parse-evrak - Bono + İrsaliye görsellerini teker teker parse et, sonra AI ile birleştir
const evrakUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } }).fields([
  { name: 'bono_dosyalari', maxCount: 10 },
  { name: 'irsaliye_dosyalari', maxCount: 10 }
]);

router.post('/parse-evrak', evrakUpload, async (req, res) => {
  try {
    const bonoDosyalar = req.files?.bono_dosyalari || [];
    const irsaliyeDosyalar = req.files?.irsaliye_dosyalari || [];

    if (bonoDosyalar.length === 0 && irsaliyeDosyalar.length === 0) {
      return hata(res, 'En az bir dosya yüklenmeli');
    }

    const hasBono = bonoDosyalar.length > 0;
    const hasIrsaliye = irsaliyeDosyalar.length > 0;

    console.log(`Evrak parse: ${bonoDosyalar.length} bono, ${irsaliyeDosyalar.length} irsaliye dosyasi`);

    // 1) Her görseli teker teker parse et (araya 2sn bekleme - rate limit koruması)
    const bonoSonuclar = [];
    for (let i = 0; i < bonoDosyalar.length; i++) {
      const f = bonoDosyalar[i];
      console.log(`  Bono sayfa ${i + 1}/${bonoDosyalar.length} parse ediliyor...`);
      if (i > 0) await new Promise(r => setTimeout(r, 2000)); // rate limit koruması
      try {
        const sonuc = await tekGorselParseEt(
          f.buffer, f.mimetype || 'image/jpeg',
          bonoParsePrompt.buildPrompt(),
          'Bu bono belgesini analiz et ve JSON olarak dön.'
        );
        if (!sonuc.parse_error) bonoSonuclar.push(sonuc);
        else console.warn(`  Bono sayfa ${i + 1} parse hatasi:`, sonuc.raw_text?.slice(0, 200));
      } catch (err) {
        console.error(`  Bono sayfa ${i + 1} hata:`, err.message);
        // Bir sayfa hata verirse diğerlerine devam et
      }
    }

    const irsaliyeSonuclar = [];
    for (let i = 0; i < irsaliyeDosyalar.length; i++) {
      const f = irsaliyeDosyalar[i];
      console.log(`  Irsaliye sayfa ${i + 1}/${irsaliyeDosyalar.length} parse ediliyor...`);
      if (i > 0 || bonoSonuclar.length > 0) await new Promise(r => setTimeout(r, 2000)); // rate limit koruması
      try {
        const sonuc = await tekGorselParseEt(
          f.buffer, f.mimetype || 'image/jpeg',
          irsaliyeParsePrompt.buildPrompt(),
          'Bu irsaliye/fatura belgesini analiz et ve JSON olarak dön.'
        );
        if (!sonuc.parse_error) irsaliyeSonuclar.push(sonuc);
        else console.warn(`  Irsaliye sayfa ${i + 1} parse hatasi:`, sonuc.raw_text?.slice(0, 200));
      } catch (err) {
        console.error(`  Irsaliye sayfa ${i + 1} hata:`, err.message);
      }
    }

    if (bonoSonuclar.length === 0 && irsaliyeSonuclar.length === 0) {
      return hata(res, 'Hiçbir sayfa okunamadı. Daha net görseller yükleyin.', 400);
    }

    // 2) Çoklu sayfa varsa AI ile birleştir, tek sayfaysa direkt kullan
    let bonoBilgi = null;
    let bonoKalemler = [];
    if (bonoSonuclar.length === 1) {
      const s = bonoSonuclar[0];
      bonoBilgi = {
        bono_no: s.bono_no || s.belge_bilgi?.bono_no || null,
        bono_tarihi: s.bono_tarihi || s.belge_bilgi?.bono_tarihi || null,
        kurum: s.kurum || s.belge_bilgi?.kurum || null,
        teslim_alan: s.teslim_alan || s.belge_bilgi?.teslim_alan || null,
        teslim_eden: s.teslim_eden || s.belge_bilgi?.teslim_eden || null,
        aciklama: s.aciklama || s.belge_bilgi?.aciklama || null,
      };
      bonoKalemler = s.kalemler || [];
    } else if (bonoSonuclar.length > 1) {
      console.log('  Bono sayfalari birlestiriliyor (kod)...');
      const merged = sayfalariKodIleBirlestir(bonoSonuclar, 'BONO');
      if (merged) {
        const bb = merged.belge_bilgi || merged;
        bonoBilgi = {
          bono_no: bb.bono_no || null,
          bono_tarihi: bb.bono_tarihi || null,
          kurum: bb.kurum || null,
          teslim_alan: bb.teslim_alan || null,
          teslim_eden: bb.teslim_eden || null,
          aciklama: bb.aciklama || null,
        };
        bonoKalemler = merged.kalemler || [];
      }
    }

    let irsaliyeBilgi = null;
    let irsaliyeKalemler = [];
    if (irsaliyeSonuclar.length === 1) {
      const s = irsaliyeSonuclar[0];
      irsaliyeBilgi = {
        irsaliye_no: s.irsaliye_no || s.belge_bilgi?.irsaliye_no || null,
        irsaliye_tarihi: s.irsaliye_tarihi || s.belge_bilgi?.irsaliye_tarihi || null,
        firma: s.firma || s.belge_bilgi?.firma || null,
        sevk_eden: s.sevk_eden || s.belge_bilgi?.sevk_eden || null,
        teslim_alan: s.teslim_alan || s.belge_bilgi?.teslim_alan || null,
        aciklama: s.aciklama || s.belge_bilgi?.aciklama || null,
      };
      irsaliyeKalemler = s.kalemler || [];
    } else if (irsaliyeSonuclar.length > 1) {
      console.log('  Irsaliye sayfalari birlestiriliyor (kod)...');
      const merged = sayfalariKodIleBirlestir(irsaliyeSonuclar, 'İRSALİYE');
      if (merged) {
        const ib = merged.belge_bilgi || merged;
        irsaliyeBilgi = {
          irsaliye_no: ib.irsaliye_no || null,
          irsaliye_tarihi: ib.irsaliye_tarihi || null,
          firma: ib.firma || null,
          sevk_eden: ib.sevk_eden || null,
          teslim_alan: ib.teslim_alan || null,
          aciklama: ib.aciklama || null,
        };
        irsaliyeKalemler = merged.kalemler || [];
      }
    }

    // 3) Her iki belge tipi varsa çapraz karşılaştır, yoksa doğrudan formatla
    let kalemler;
    if (hasBono && hasIrsaliye && bonoKalemler.length > 0 && irsaliyeKalemler.length > 0) {
      console.log('  Capraz karsilastirma yapiliyor (kod)...');
      const capraz = caprazKarsilastirKod(bonoKalemler, irsaliyeKalemler);
      kalemler = capraz.kalemler || [];
    } else {
      // Tek tip belge — doğrudan formatla
      const kaynak = hasBono ? 'bono' : 'irsaliye';
      const rawKalemler = hasBono ? bonoKalemler : irsaliyeKalemler;
      kalemler = rawKalemler.map((k, i) => ({
        sira_no: k.sira_no || i + 1,
        malzeme_kodu: k.malzeme_kodu || null,
        poz_no: k.poz_no || null,
        malzeme_adi: k.malzeme_adi || '',
        birim: k.birim || 'Ad',
        miktar_bono: hasBono ? (k.miktar || k.miktar_bono || 0) : 0,
        miktar_irsaliye: hasIrsaliye ? (k.miktar || k.miktar_irsaliye || 0) : 0,
        kaynak,
        uyumsuzluk: false,
      }));
    }

    const sonuc = {
      bono_bilgi: bonoBilgi || { bono_no: null, bono_tarihi: null, kurum: null, teslim_alan: null, teslim_eden: null, aciklama: null },
      irsaliye_bilgi: irsaliyeBilgi || { irsaliye_no: null, irsaliye_tarihi: null, firma: null, sevk_eden: null, teslim_alan: null, aciklama: null },
      kalemler,
      _meta: {
        bono_sayfa: bonoDosyalar.length,
        irsaliye_sayfa: irsaliyeDosyalar.length,
        bono_parse_basarili: bonoSonuclar.length,
        irsaliye_parse_basarili: irsaliyeSonuclar.length,
      }
    };

    console.log(`  Evrak parse tamamlandi: ${kalemler.length} kalem`);
    basarili(res, sonuc);
  } catch (err) {
    console.error('Evrak parse hatası:', err);
    hata(res, err.message || 'AI analizi sırasında hata oluştu', 500);
  }
});

// POST /evrak-kaydet - Evrak verilerini kaydet + dosyaları Dosya Yönetimi'ne yükle
const evrakKaydetUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } }).fields([
  { name: 'bono_dosyalari', maxCount: 10 },
  { name: 'irsaliye_dosyalari', maxCount: 10 }
]);

router.post('/evrak-kaydet', evrakKaydetUpload, async (req, res) => {
  try {
    const db = getDb();
    const evrakData = JSON.parse(req.body.evrak_data || '{}');
    const { bono_bilgi, irsaliye_bilgi, kalemler } = evrakData;

    const bono_no = bono_bilgi?.bono_no || irsaliye_bilgi?.irsaliye_no;
    const bono_tarihi = bono_bilgi?.bono_tarihi || irsaliye_bilgi?.irsaliye_tarihi;
    if (!bono_no) return hata(res, 'Bono no veya irsaliye no zorunludur');
    if (!bono_tarihi) return hata(res, 'Tarih zorunludur');

    const transaction = db.transaction(() => {
      // Bono kaydı oluştur (irsaliye bilgileriyle birlikte)
      // bono_no NOT NULL olduğu için, sadece irsaliye girildiğinde irsaliye_no kullanılır
      const result = db.prepare(`
        INSERT INTO bonolar (bono_no, bono_tarihi, kurum, teslim_alan, aciklama, irsaliye_no, irsaliye_tarihi, tedarikci_firma)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        bono_bilgi?.bono_no || irsaliye_bilgi?.irsaliye_no || bono_no,
        bono_tarihi,
        bono_bilgi?.kurum || irsaliye_bilgi?.firma || 'EDAS',
        bono_bilgi?.teslim_alan || irsaliye_bilgi?.teslim_alan || null,
        bono_bilgi?.aciklama || irsaliye_bilgi?.aciklama || null,
        irsaliye_bilgi?.irsaliye_no || null,
        irsaliye_bilgi?.irsaliye_tarihi || null,
        irsaliye_bilgi?.firma || null
      );

      const bonoId = result.lastInsertRowid;

      // Kalemleri ekle
      if (kalemler && kalemler.length > 0) {
        const kalemStmt = db.prepare(`
          INSERT INTO bono_kalemleri (bono_id, malzeme_kodu, poz_no, malzeme_adi, birim, miktar, miktar_bono, miktar_irsaliye, kaynak, proje_id, proje_kesif_id, notlar)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const k of kalemler) {
          const miktar = k.miktar_bono || k.miktar_irsaliye || k.miktar || 0;
          kalemStmt.run(
            bonoId, k.malzeme_kodu, k.poz_no, k.malzeme_adi,
            k.birim || 'Ad', miktar,
            k.miktar_bono || 0, k.miktar_irsaliye || 0,
            k.kaynak || 'bono',
            k.proje_id || null, k.proje_kesif_id || null, k.notlar || null
          );

          // Ana Depo stoğuna ekle
          if (miktar > 0) {
            const malzeme = db.prepare('SELECT id FROM malzemeler WHERE malzeme_kodu = ?').get(k.malzeme_kodu);
            if (malzeme) {
              const anaDepo = db.prepare("SELECT id FROM depolar WHERE depo_tipi = 'ana_depo' LIMIT 1").get();
              if (anaDepo) {
                const mevcutStok = db.prepare('SELECT miktar FROM depo_stok WHERE depo_id = ? AND malzeme_id = ?').get(anaDepo.id, malzeme.id);
                if (mevcutStok) {
                  db.prepare('UPDATE depo_stok SET miktar = miktar + ?, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE depo_id = ? AND malzeme_id = ?').run(miktar, anaDepo.id, malzeme.id);
                } else {
                  db.prepare('INSERT INTO depo_stok (depo_id, malzeme_id, miktar) VALUES (?, ?, ?)').run(anaDepo.id, malzeme.id, miktar);
                }
                db.prepare('UPDATE malzemeler SET stok_miktari = stok_miktari + ? WHERE id = ?').run(miktar, malzeme.id);
              }
            }
          }

          if (k.proje_kesif_id) {
            db.prepare("UPDATE proje_kesif SET durum = 'alindi', guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?").run(k.proje_kesif_id);
          }
        }
      }

      const bono = db.prepare('SELECT * FROM bonolar WHERE id = ?').get(bonoId);
      aktiviteLogla('bono', 'olusturma', bonoId, `Evrak: ${bono_no} - ${kalemler?.length || 0} kalem`);
      return bono;
    });

    const bono = transaction();

    // Dosyaları Dosya Yönetimi'ne yükle (async, bono kaydından bağımsız)
    const bonoDosyalar = req.files?.bono_dosyalari || [];
    const irsaliyeDosyalar = req.files?.irsaliye_dosyalari || [];

    const yuklemeler = [];
    for (const f of bonoDosyalar) {
      yuklemeler.push(dosyaService.dosyaYukle(f.buffer, {
        orijinalAdi: f.originalname,
        alan: 'depo',
        altAlan: 'gelen_malzeme_bono',
        iliskiliKaynakTipi: 'bono',
        iliskiliKaynakId: bono.id,
        baslik: `Bono ${bono_bilgi?.bono_no || ''}`,
        kaynak: 'web',
      }).catch(err => console.error('Bono dosya yükleme hatası:', err.message)));
    }
    for (const f of irsaliyeDosyalar) {
      yuklemeler.push(dosyaService.dosyaYukle(f.buffer, {
        orijinalAdi: f.originalname,
        alan: 'depo',
        altAlan: 'gelen_malzeme_irsaliye',
        iliskiliKaynakTipi: 'bono',
        iliskiliKaynakId: bono.id,
        baslik: `İrsaliye ${irsaliye_bilgi?.irsaliye_no || ''}`,
        kaynak: 'web',
      }).catch(err => console.error('İrsaliye dosya yükleme hatası:', err.message)));
    }

    await Promise.allSettled(yuklemeler);

    basarili(res, bono, 201);
  } catch (err) {
    console.error('Evrak kaydet hatası:', err);
    hata(res, err.message, 500);
  }
});

module.exports = router;
