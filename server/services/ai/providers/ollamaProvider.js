const AiProvider = require('./aiProvider');

class OllamaProvider extends AiProvider {
  constructor() {
    super('ollama');
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.modelText = process.env.OLLAMA_MODEL_TEXT || 'gemma3:12b';
    this.modelVision = process.env.OLLAMA_MODEL_VISION || 'llama3.2-vision:11b';
  }

  async saglikKontrol() {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async metinGonder(sistemPromptu, kullaniciMesaji, ayarlar = {}) {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.modelText,
        messages: [
          { role: 'system', content: sistemPromptu },
          { role: 'user', content: kullaniciMesaji },
        ],
        stream: false,
        options: {
          temperature: ayarlar.temperature ?? 0.1,
          num_predict: ayarlar.maxTokens ?? 4096,
        },
      }),
      signal: AbortSignal.timeout(parseInt(process.env.AI_TIMEOUT_MS) || 30000),
    });

    const json = await res.json();
    return {
      metin: json.message?.content || '',
      tokenKullanim: {
        girdi: json.prompt_eval_count || 0,
        cikti: json.eval_count || 0,
      },
    };
  }

  async gorselGonder(sistemPromptu, kullaniciMesaji, gorseller, ayarlar = {}) {
    const images = gorseller.map(g => g.base64);

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.modelVision,
        messages: [
          { role: 'system', content: sistemPromptu },
          { role: 'user', content: kullaniciMesaji, images },
        ],
        stream: false,
        options: {
          temperature: ayarlar.temperature ?? 0.1,
          num_predict: ayarlar.maxTokens ?? 4096,
        },
      }),
      signal: AbortSignal.timeout(parseInt(process.env.AI_TIMEOUT_MS) || 30000),
    });

    const json = await res.json();
    return {
      metin: json.message?.content || '',
      tokenKullanim: {
        girdi: json.prompt_eval_count || 0,
        cikti: json.eval_count || 0,
      },
    };
  }
}

module.exports = OllamaProvider;
