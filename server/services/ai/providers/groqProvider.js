const AiProvider = require('./aiProvider');

class GroqProvider extends AiProvider {
  constructor() {
    super('groq');
    this.apiKey = process.env.GROQ_API_KEY;
    this.modelText = process.env.GROQ_MODEL_TEXT || 'llama-3.1-70b-versatile';
    this.modelVision = process.env.GROQ_MODEL_VISION || 'llama-3.2-90b-vision-preview';
    this.baseUrl = 'https://api.groq.com/openai/v1';
  }

  async saglikKontrol() {
    if (!this.apiKey) return false;
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async metinGonder(sistemPromptu, kullaniciMesaji, ayarlar = {}) {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelText,
        messages: [
          { role: 'system', content: sistemPromptu },
          { role: 'user', content: kullaniciMesaji },
        ],
        temperature: ayarlar.temperature ?? 0.1,
        max_tokens: ayarlar.maxTokens ?? 4096,
      }),
      signal: AbortSignal.timeout(parseInt(process.env.AI_TIMEOUT_MS) || 30000),
    });

    const json = await res.json();
    return {
      metin: json.choices?.[0]?.message?.content || '',
      tokenKullanim: { girdi: json.usage?.prompt_tokens || 0, cikti: json.usage?.completion_tokens || 0 },
    };
  }

  async gorselGonder(sistemPromptu, kullaniciMesaji, gorseller, ayarlar = {}) {
    const content = [{ type: 'text', text: kullaniciMesaji }];
    for (const gorsel of gorseller) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${gorsel.mimeType || 'image/jpeg'};base64,${gorsel.base64}` },
      });
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelVision,
        messages: [
          { role: 'system', content: sistemPromptu },
          { role: 'user', content },
        ],
        temperature: ayarlar.temperature ?? 0.1,
        max_tokens: ayarlar.maxTokens ?? 4096,
      }),
      signal: AbortSignal.timeout(parseInt(process.env.AI_TIMEOUT_MS) || 30000),
    });

    const json = await res.json();
    return {
      metin: json.choices?.[0]?.message?.content || '',
      tokenKullanim: { girdi: json.usage?.prompt_tokens || 0, cikti: json.usage?.completion_tokens || 0 },
    };
  }
}

module.exports = GroqProvider;
