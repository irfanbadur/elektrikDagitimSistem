const config = require('../config');
const { getDb } = require('../db/database');
const sharp = require('sharp');

// Görseli küçült — Ollama'ya daha hızlı gönderilir
async function gorselKucult(buffer, maxBoyut = 1024) {
  try {
    const meta = await sharp(buffer).metadata();
    if (meta.width <= maxBoyut && meta.height <= maxBoyut) return buffer;
    return await sharp(buffer)
      .resize(maxBoyut, maxBoyut, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
  } catch { return buffer; }
}

// Ollama API ile görsel parse
async function ollamaGorselParse(imageBase64, prompt, userMessage) {
  const baseUrl = config.ai.katman2.baseUrl();
  const model = config.ai.katman2.model();
  const timeout = config.ai.katman2.timeout || 300000;

  console.log(`[Ollama] Görsel parse: model=${model}, url=${baseUrl}`);
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'user', content: prompt + '\n\n' + (userMessage || 'Bu görseli analiz et ve SADECE JSON olarak dön. Başka hiçbir şey yazma.'), images: [imageBase64] }
      ],
      stream: false,
      keep_alive: '30m',
      options: { temperature: 0.1, num_predict: 16384 }
    }),
    signal: AbortSignal.timeout(timeout)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama API hata (${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.message?.content || '';
  console.log(`[Ollama] Yanıt uzunluğu: ${text.length} karakter`);

  // JSON bloğunu bul — yanıtta ekstra metin olabilir
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const cleaned = jsonMatch ? jsonMatch[0] : text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    console.error('[Ollama] JSON parse hatası. Ham yanıt:', text.slice(0, 500));
    return { raw_text: text, parse_error: true };
  }
}

// Ollama API ile metin tabanlı parse
async function ollamaMetinParse(systemMsg, userMsg) {
  const baseUrl = config.ai.katman1.baseUrl();
  const model = config.ai.katman2.model(); // vision model metin için de daha iyi
  const timeout = config.ai.katman1.timeout || 120000;

  console.log(`[Ollama] Metin parse: model=${model}`);
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'user', content: systemMsg + '\n\n' + userMsg + '\n\nSADECE JSON olarak dön. Başka hiçbir şey yazma.' }
      ],
      stream: false,
      keep_alive: '30m',
      options: { temperature: 0.1, num_predict: 8192 }
    }),
    signal: AbortSignal.timeout(timeout)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama API hata (${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.message?.content || '';
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return { raw_text: text, parse_error: true };
  }
}

// Tek bir görseli AI ile parse et (buffer + mimeType alır, sonucu döner)
async function tekGorselParseEt(buffer, mimeType, prompt, userMessage) {
  const imageBase64 = buffer.toString('base64');
  const provider = config.ai.katman3.provider();
  let result = null;

  // Önce Ollama (yerel) dene — ücretsiz
  if (provider === 'ollama') {
    // Görseli küçült — daha hızlı işlenir
    const kucukBuffer = await gorselKucult(buffer, 1280);
    const kucukBase64 = kucukBuffer.toString('base64');
    console.log(`[Ollama] Görsel küçültüldü: ${(buffer.length/1024).toFixed(0)}KB → ${(kucukBuffer.length/1024).toFixed(0)}KB`);
    return await ollamaGorselParse(kucukBase64, prompt, userMessage);
  }

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

  if (provider === 'ollama') {
    return await ollamaMetinParse(systemMsg, userMsg);
  }

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

module.exports = { tekGorselParseEt, metinTabanliAI };
