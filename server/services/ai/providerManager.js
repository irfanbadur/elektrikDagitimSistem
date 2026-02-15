const OllamaProvider = require('./providers/ollamaProvider');
const GeminiProvider = require('./providers/geminiProvider');
const GroqProvider = require('./providers/groqProvider');

class ProviderManager {
  constructor() {
    this.providers = {
      ollama: new OllamaProvider(),
      gemini: new GeminiProvider(),
      groq: new GroqProvider(),
    };

    this.birincil = process.env.AI_PROVIDER || 'ollama';
    this.fallbackSirasi = (process.env.AI_FALLBACK_ORDER || 'ollama,groq,gemini')
      .split(',').map(s => s.trim());

    this.istatistik = {
      toplamIstek: 0,
      basarili: 0,
      fallbackKullanildi: 0,
      hatali: 0,
      tokenKullanim: { girdi: 0, cikti: 0 },
      providerKullanim: {},
    };
  }

  /** Metin gonder — fallback destekli */
  async metinGonder(sistemPromptu, kullaniciMesaji, ayarlar = {}) {
    return this._fallbackIleGonder('metinGonder', [sistemPromptu, kullaniciMesaji, ayarlar]);
  }

  /** Gorsel gonder — fallback destekli */
  async gorselGonder(sistemPromptu, kullaniciMesaji, gorseller, ayarlar = {}) {
    return this._fallbackIleGonder('gorselGonder', [sistemPromptu, kullaniciMesaji, gorseller, ayarlar]);
  }

  /** Tum saglayicilarin durumu */
  async durumKontrol() {
    const durum = {};
    for (const [isim, provider] of Object.entries(this.providers)) {
      try {
        durum[isim] = { aktif: await provider.saglikKontrol(), birincil: isim === this.birincil };
      } catch {
        durum[isim] = { aktif: false, birincil: isim === this.birincil };
      }
    }
    return durum;
  }

  /** Istatistikleri getir */
  istatistikGetir() {
    return { ...this.istatistik };
  }

  // --- FALLBACK MEKANIZMASI ---
  async _fallbackIleGonder(metod, args) {
    this.istatistik.toplamIstek++;
    const maxRetry = parseInt(process.env.AI_MAX_RETRY) || 2;

    for (const providerIsim of this.fallbackSirasi) {
      const provider = this.providers[providerIsim];
      if (!provider) continue;

      for (let deneme = 0; deneme <= maxRetry; deneme++) {
        try {
          if (deneme === 0) {
            const saglikli = await provider.saglikKontrol();
            if (!saglikli) {
              console.warn(`[AI] ${providerIsim} saglik kontrolu basarisiz, sonrakine geciliyor`);
              break;
            }
          }

          const sonuc = await provider[metod](...args);

          // Basarili — istatistik guncelle
          this.istatistik.basarili++;
          this.istatistik.tokenKullanim.girdi += sonuc.tokenKullanim?.girdi || 0;
          this.istatistik.tokenKullanim.cikti += sonuc.tokenKullanim?.cikti || 0;
          this.istatistik.providerKullanim[providerIsim] =
            (this.istatistik.providerKullanim[providerIsim] || 0) + 1;

          if (providerIsim !== this.birincil) {
            this.istatistik.fallbackKullanildi++;
            console.log(`[AI] Fallback: ${this.birincil} -> ${providerIsim}`);
          }

          return { ...sonuc, provider: providerIsim, fallback: providerIsim !== this.birincil };
        } catch (err) {
          console.warn(`[AI] ${providerIsim} deneme ${deneme + 1}/${maxRetry + 1}:`, err.message);

          // Rate limit -> hemen sonraki provider
          if (err.message?.includes('429') || err.message?.includes('rate')) break;

          // Diger hata -> retry (artan bekleme)
          if (deneme < maxRetry) await new Promise(r => setTimeout(r, 1000 * (deneme + 1)));
        }
      }
    }

    this.istatistik.hatali++;
    throw new Error('Tum AI saglayicilar basarisiz. Ollama calisiyor mu? (.env kontrol edin)');
  }
}

const manager = new ProviderManager();
module.exports = manager;
