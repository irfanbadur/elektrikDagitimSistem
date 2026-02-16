const AiProvider = require('./aiProvider');

class GeminiProvider extends AiProvider {
  constructor() {
    super('gemini');
    this.apiKey = process.env.GEMINI_API_KEY;
    this.modelText = process.env.GEMINI_MODEL_TEXT || 'gemini-2.5-flash';
    this.modelVision = process.env.GEMINI_MODEL_VISION || 'gemini-2.5-flash';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  }

  async saglikKontrol() {
    if (!this.apiKey) return false;
    try {
      const res = await fetch(
        `${this.baseUrl}/${this.modelText}?key=${this.apiKey}`,
        { signal: AbortSignal.timeout(5000) }
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  _checkError(res, json) {
    if (!res.ok) {
      const errMsg = json.error?.message || `HTTP ${res.status}`;
      throw new Error(`Gemini API hata (${res.status}): ${errMsg}`);
    }
    if (!json.candidates?.length) {
      const blockReason = json.promptFeedback?.blockReason;
      if (blockReason) {
        throw new Error(`Gemini içerik engellendi: ${blockReason}`);
      }
      throw new Error('Gemini boş yanıt döndürdü');
    }
  }

  async metinGonder(sistemPromptu, kullaniciMesaji, ayarlar = {}) {
    const url = `${this.baseUrl}/${this.modelText}:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sistemPromptu }] },
        contents: [{ role: 'user', parts: [{ text: kullaniciMesaji }] }],
        generationConfig: {
          temperature: ayarlar.temperature ?? 0.1,
          maxOutputTokens: ayarlar.maxTokens ?? 4096,
        },
      }),
      signal: AbortSignal.timeout(parseInt(process.env.AI_TIMEOUT_MS) || 30000),
    });

    const json = await res.json();
    this._checkError(res, json);

    const metin = json.candidates[0].content?.parts?.[0]?.text || '';
    const usage = json.usageMetadata || {};

    return {
      metin,
      tokenKullanim: { girdi: usage.promptTokenCount || 0, cikti: usage.candidatesTokenCount || 0 },
    };
  }

  async gorselGonder(sistemPromptu, kullaniciMesaji, gorseller, ayarlar = {}) {
    const url = `${this.baseUrl}/${this.modelVision}:generateContent?key=${this.apiKey}`;

    const parts = [{ text: kullaniciMesaji }];
    for (const gorsel of gorseller) {
      parts.push({
        inline_data: { mime_type: gorsel.mimeType || 'image/jpeg', data: gorsel.base64 },
      });
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sistemPromptu }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: ayarlar.temperature ?? 0.1,
          maxOutputTokens: ayarlar.maxTokens ?? 4096,
        },
      }),
      signal: AbortSignal.timeout(parseInt(process.env.AI_TIMEOUT_MS) || 30000),
    });

    const json = await res.json();
    this._checkError(res, json);

    return {
      metin: json.candidates[0].content?.parts?.[0]?.text || '',
      tokenKullanim: {
        girdi: json.usageMetadata?.promptTokenCount || 0,
        cikti: json.usageMetadata?.candidatesTokenCount || 0,
      },
    };
  }
}

module.exports = GeminiProvider;
