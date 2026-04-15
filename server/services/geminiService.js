/**
 * AI Chat Servisi — Groq (ücretsiz, hızlı) + Gemini (fallback)
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const SISTEM_PROMPTU = `Sen enerjabze elektrik dağıtım yönetim sisteminin AI asistanısın.
Türkçe yanıt ver. Kısa ve öz ol.

Sistem hakkında bilgin:
- Proje yönetimi (KET ve YB projeleri)
- Keşif listeleri ve malzeme yönetimi
- DXF çizim editörü
- Depo ve stok yönetimi
- Saha haritası
- Ekip ve personel yönetimi
- Hakediş ve ilerleme takibi

Kullanıcıya sistem kullanımı, proje süreçleri ve elektrik dağıtım işleri hakkında yardımcı ol.`;

// ─── Groq API (birincil — ücretsiz, hızlı) ───
async function groqChat(mesajlar, sistemPrompt) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY tanımlı değil');

  const messages = [
    { role: 'system', content: sistemPrompt || SISTEM_PROMPTU },
    ...mesajlar.map(m => ({ role: m.role, content: m.content }))
  ];

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API hatası: ${response.status} — ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Boş yanıt';
}

// ─── Gemini API (yedek) ───
async function geminiChatFallback(mesajlar, sistemPrompt) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY tanımlı değil');

  const contents = mesajlar.map((m, i) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: i === 0 ? `${sistemPrompt || SISTEM_PROMPTU}\n\n${m.content}` : m.content }]
  }));

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 2048 } }),
  });

  if (!response.ok) throw new Error(`Gemini API hatası: ${response.status}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Boş yanıt';
}

// ─── Ana fonksiyon — önce Groq, başarısızsa Gemini ───
async function geminiChat(mesajlar, sistemPrompt) {
  try {
    return await groqChat(mesajlar, sistemPrompt);
  } catch (groqErr) {
    console.warn('[AI] Groq başarısız, Gemini deneniyor:', groqErr.message);
    try {
      return await geminiChatFallback(mesajlar, sistemPrompt);
    } catch (geminiErr) {
      throw new Error(`AI servisleri yanıt veremedi. Groq: ${groqErr.message}`);
    }
  }
}

module.exports = { geminiChat };
