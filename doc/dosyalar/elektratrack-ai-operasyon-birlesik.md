# ElektraTrack — AI Operasyon Sistemi (Birleşik)

## Amaç

Kullanıcıların doğal dil mesajlarıyla, fotoğraflarla ve belgelerle sistemi yönetmesini sağlayan AI katmanı.

> Bu MD, önceki `ai-operasyon.md` ve `ai-altyapi-konfig.md`'nin **yerini alır** (birleşik).

**Mesaj yaz → AI anla → Plan oluştur → Kullanıcı onayla → Sistem çalıştır**

```
Kullanıcı: "Depodan 3 adet 12I A tipi direk ekip-1 tarafından Elalan köyüne götürüldü"

AI yanıt:
┌──────────────────────────────────────────────────┐
│ 🤖 AI — 3 aksiyon belirlendi:                   │
│                                                  │
│ 1. 📤 Depo Çıkış                                │
│    12I A tipi direk × 3 adet                     │
│    Depo stoktan düşülecek                        │
│                                                  │
│ 2. 📍 Lokasyon Ata                               │
│    Hedef: Elalan köyü / Ekip: Ekip-1            │
│                                                  │
│ 3. 📄 Teslim Tutanağı                            │
│    Otomatik oluşturulacak                        │
│                                                  │
│ [✅ Onayla]  [✏️ Düzelt]  [❌ İptal]             │
└──────────────────────────────────────────────────┘
```

**Temel prensipler:**
1. **Her zaman onay** — AI hiçbir işlemi otomatik yapmaz
2. **Provider-agnostic** — Ollama/Gemini/Groq arası tek satır geçiş
3. **Genişletilebilir** — Yeni aksiyon = 1 dosya, yeni AI = 1 dosya
4. **Metin + Görsel + Belge** — Üç tip girdi desteklenir
5. **Fallback** — Birincil AI çökerse otomatik yedek devreye girer
6. **Audit log** — Her AI kararı ve onay kayıt altında
7. **Geri alma** — Onaylanmış işlemler geri alınabilir

---

## Mimari Genel Bakış

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   GİRDİ     │ ──→ │   ANLAMA    │ ──→ │  PLANLAMA   │ ──→ │   ONAY      │
│             │     │             │     │             │     │             │
│ • Metin     │     │ • NLP parse │     │ • Aksiyonlar│     │ • Kullanıcı │
│ • Fotoğraf  │     │ • OCR/Vision│     │ • Parametr. │     │   onaylar   │
│ • PDF/Excel │     │ • Belge parse│    │ • Sıralama  │     │ • Düzeltir  │
│ • Ses (gel.)│     │             │     │ • Doğrulama │     │ • İptal eder│
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                                        │
                           ↓                                        ↓
                  ┌─────────────────┐                      ┌─────────────┐
                  │  AI PROVIDER    │                      │  UYGULAMA   │
                  │                 │                      │             │
                  │ ┌─────────────┐ │                      │ • DB işlem  │
                  │ │ Ollama      │ │ ← birincil           │ • Dosya oluş│
                  │ │ (lokal,GPU) │ │                      │ • Bildirim  │
                  │ ├─────────────┤ │                      │ • Log kayıt │
                  │ │ Groq        │ │ ← fallback-1         └─────────────┘
                  │ │ (bulut,hızlı│ │
                  │ ├─────────────┤ │
                  │ │ Gemini      │ │ ← fallback-2
                  │ │ (bulut)     │ │
                  │ └─────────────┘ │
                  └─────────────────┘
```

---

# BÖLÜM A — AI ALTYAPI VE KONFİGÜRASYON

> Önce altyapı kurulur, sonra üstüne operasyon mantığı gelir.

---

## A1 — Ollama Kurulumu (Birincil AI)

### Ollama Yükleme (Windows)

```powershell
# Windows — Resmi installer
# https://ollama.com/download/windows adresinden indir ve çalıştır

# Kurulumu doğrula
ollama --version
```

### Modelleri İndir

```bash
# ─── METİN MODELİ (ana parse) ─────────────────────
# Gemma 3 12B — hızlı, kaliteli, Türkçe iyi
ollama pull gemma3:12b
# Alternatif: ollama pull llama3.1:8b (daha hafif)

# ─── GÖRSEL MODEL (irsaliye/belge OCR) ────────────
# Llama 3.2 Vision 11B — fotoğraf + metin anlama
ollama pull llama3.2-vision:11b

# ─── KONTROl ──────────────────────────────────────
ollama list
```

**Model boyutları ve RAM ihtiyacı:**

| Model | Boyut | Min RAM | GPU VRAM | Hız (GPU) |
|-------|-------|---------|----------|-----------|
| `gemma3:12b` | ~7 GB | 12 GB | 8 GB | 2-4 sn |
| `llama3.1:8b` | ~4.7 GB | 8 GB | 6 GB | 1-3 sn |
| `llama3.2-vision:11b` | ~7.9 GB | 12 GB | 8 GB | 3-6 sn |

> 16GB RAM + NVIDIA GPU ile `gemma3:12b` ve `llama3.2-vision:11b` rahat çalışır.

### Test

Ollama varsayılan olarak `http://localhost:11434` adresinde çalışır.

```bash
# Çalışıyor mu
curl http://localhost:11434/api/tags

# Metin test
curl http://localhost:11434/api/chat -d '{
  "model": "gemma3:12b",
  "messages": [
    {"role": "user", "content": "Depodan 3 adet 12I direk ekip-1 tarafından Elalan köyüne götürüldü. Bu mesajdan malzeme adını, miktarını ve hedef konumu JSON olarak çıkar."}
  ],
  "stream": false
}'

# Vision test (base64 görsel ile)
curl http://localhost:11434/api/chat -d '{
  "model": "llama3.2-vision:11b",
  "messages": [
    {"role": "user", "content": "Bu irsaliyedeki malzeme listesini JSON olarak çıkar.", "images": ["BASE64_ENCODED_IMAGE"]}
  ],
  "stream": false
}'
```

### Windows Otomatik Başlatma

Ollama Windows'ta tray'de çalışır, bilgisayar açılınca otomatik başlar.
Kontrol: Ayarlar → Uygulamalar → Başlangıç'ta "Ollama" aktif olmalı.

---

## A2 — Bulut Sağlayıcı API Key'leri

### Google Gemini (Fallback-1)

```
1. https://aistudio.google.com → Google hesabıyla giriş
2. "Get API Key" → key oluştur → kopyala
```

| Model | İstek/Dakika | İstek/Gün | Token/Dakika |
|-------|-------------|-----------|-------------|
| Gemini 2.5 Flash | 10 RPM | 250 RPD | 250K TPM |
| Gemini 2.5 Flash-Lite | 15 RPM | 1000 RPD | 250K TPM |

### Groq (Fallback-2)

```
1. https://console.groq.com → Hesap oluştur (kredi kartı gerekmez)
2. API Keys → "Create API Key" → kopyala
```

| Model | İstek/Dakika | Token/Gün |
|-------|-------------|-----------|
| Llama 3.1 70B | 30 RPM | 500K TPD |
| Llama 3.2 Vision | 15 RPM | 500K TPD |

---

## A3 — `.env` Dosyası

```env
# ═══════════════════════════════════════════════
# AI SAĞLAYICI KONFİGÜRASYONU
# ═══════════════════════════════════════════════

# ─── AKTİF SAĞLAYICI ──────────────────────────
# 'ollama' | 'gemini' | 'groq'
AI_PROVIDER=ollama

# ─── OLLAMA (Lokal) ───────────────────────────
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL_TEXT=gemma3:12b
OLLAMA_MODEL_VISION=llama3.2-vision:11b

# ─── GOOGLE GEMINI (Bulut Fallback-1) ─────────
GEMINI_API_KEY=AIzaSy...your_key_here
GEMINI_MODEL_TEXT=gemini-2.5-flash
GEMINI_MODEL_VISION=gemini-2.5-flash

# ─── GROQ (Bulut Fallback-2) ──────────────────
GROQ_API_KEY=gsk_...your_key_here
GROQ_MODEL_TEXT=llama-3.1-70b-versatile
GROQ_MODEL_VISION=llama-3.2-90b-vision-preview

# ─── FALLBACK SIRASI ──────────────────────────
AI_FALLBACK_ORDER=ollama,groq,gemini

# ─── GENEL AI AYARLARI ────────────────────────
AI_MAX_TOKENS=4096
AI_TEMPERATURE=0.1
AI_TIMEOUT_MS=30000
AI_MAX_RETRY=2
```

> `.env` → `.gitignore`'a eklenmeli!

---

## A4 — Provider-Agnostic AI Interface

Tüm sağlayıcılar aynı interface'i uygular. Değiştirmek = `.env`'de tek satır.

### Klasör Yapısı

```
server/services/ai/
├── providers/
│   ├── aiProvider.js           ← Base interface
│   ├── ollamaProvider.js       ← Ollama (lokal)
│   ├── geminiProvider.js       ← Google Gemini (bulut)
│   └── groqProvider.js         ← Groq (bulut)
├── providerManager.js          ← Fallback + sağlık kontrolü
├── aiParseService.js           ← Metin/görsel parse (provider-agnostic)
├── aiOperasyonService.js       ← Ana orkestratör
├── aksiyonRegistry.js          ← Aksiyon tiplerini yönetir
└── aksiyonlar/                 ← Her aksiyon tipi ayrı dosya
    ├── depoGiris.js
    ├── depoCikis.js
    ├── depoTransfer.js
    ├── belgeParse.js
    ├── sahaRaporu.js
    ├── asamaIlerlet.js
    ├── paketSiniflandir.js
    ├── belgeTakip.js
    └── tutanakOlustur.js
```

### `providers/aiProvider.js` — Base Interface

```javascript
/**
 * AI SAĞLAYICI BASE INTERFACE
 *
 * Tüm sağlayıcılar bu interface'i uygular.
 * Yeni sağlayıcı eklemek = bu interface'i implement eden yeni dosya.
 */
class AiProvider {
  constructor(isim) {
    this.isim = isim;
  }

  /** Sağlayıcı erişilebilir mi */
  async saglikKontrol() {
    throw new Error('saglikKontrol() implement edilmeli');
  }

  /**
   * Metin mesajı gönder
   * @returns {Promise<{ metin: string, tokenKullanim: { girdi, cikti } }>}
   */
  async metinGonder(sistemPromptu, kullaniciMesaji, ayarlar = {}) {
    throw new Error('metinGonder() implement edilmeli');
  }

  /**
   * Metin + görsel gönder (Vision)
   * @param {Array<{ base64: string, mimeType: string }>} gorseller
   * @returns {Promise<{ metin: string, tokenKullanim: { girdi, cikti } }>}
   */
  async gorselGonder(sistemPromptu, kullaniciMesaji, gorseller, ayarlar = {}) {
    throw new Error('gorselGonder() implement edilmeli');
  }
}

module.exports = AiProvider;
```

### `providers/ollamaProvider.js`

```javascript
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
```

### `providers/geminiProvider.js`

```javascript
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
    const metin = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
    return {
      metin: json.candidates?.[0]?.content?.parts?.[0]?.text || '',
      tokenKullanim: {
        girdi: json.usageMetadata?.promptTokenCount || 0,
        cikti: json.usageMetadata?.candidatesTokenCount || 0,
      },
    };
  }
}

module.exports = GeminiProvider;
```

### `providers/groqProvider.js`

```javascript
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
```

---

## A5 — Provider Manager (Fallback + Sağlık Kontrolü)

### `providerManager.js`

```javascript
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

  /** Metin gönder — fallback destekli */
  async metinGonder(sistemPromptu, kullaniciMesaji, ayarlar = {}) {
    return this._fallbackIleGonder('metinGonder', [sistemPromptu, kullaniciMesaji, ayarlar]);
  }

  /** Görsel gönder — fallback destekli */
  async gorselGonder(sistemPromptu, kullaniciMesaji, gorseller, ayarlar = {}) {
    return this._fallbackIleGonder('gorselGonder', [sistemPromptu, kullaniciMesaji, gorseller, ayarlar]);
  }

  /** Tüm sağlayıcıların durumu */
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

  /** İstatistikleri getir */
  istatistikGetir() {
    return { ...this.istatistik };
  }

  // ─── FALLBACK MEKANİZMASI ──────────────────────
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
              console.warn(`⚠️ ${providerIsim} sağlık kontrolü başarısız, sonrakine geçiliyor`);
              break;
            }
          }

          const sonuc = await provider[metod](...args);

          // Başarılı — istatistik güncelle
          this.istatistik.basarili++;
          this.istatistik.tokenKullanim.girdi += sonuc.tokenKullanim?.girdi || 0;
          this.istatistik.tokenKullanim.cikti += sonuc.tokenKullanim?.cikti || 0;
          this.istatistik.providerKullanim[providerIsim] =
            (this.istatistik.providerKullanim[providerIsim] || 0) + 1;

          if (providerIsim !== this.birincil) {
            this.istatistik.fallbackKullanildi++;
            console.log(`🔄 Fallback: ${this.birincil} → ${providerIsim}`);
          }

          return { ...sonuc, provider: providerIsim, fallback: providerIsim !== this.birincil };
        } catch (err) {
          console.warn(`❌ ${providerIsim} deneme ${deneme + 1}/${maxRetry + 1}:`, err.message);

          // Rate limit → hemen sonraki provider
          if (err.message?.includes('429') || err.message?.includes('rate')) break;

          // Diğer hata → retry (artan bekleme)
          if (deneme < maxRetry) await new Promise(r => setTimeout(r, 1000 * (deneme + 1)));
        }
      }
    }

    this.istatistik.hatali++;
    throw new Error('Tüm AI sağlayıcılar başarısız. Ollama çalışıyor mu? (.env kontrol edin)');
  }
}

const manager = new ProviderManager();
module.exports = manager;
```

---

# BÖLÜM B — AI OPERASYON MANTIĞI

> Altyapı hazır, şimdi "ne yapılacak" kısmı.

---

## B1 — Veritabanı

### Tablo: `ai_islemler`

```sql
CREATE TABLE IF NOT EXISTS ai_islemler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- GİRDİ
    girdi_tipi TEXT NOT NULL,                 -- 'metin', 'gorsel', 'belge', 'karma'
    girdi_metin TEXT,
    girdi_dosya_id INTEGER,
    veri_paketi_id INTEGER,

    -- PARSE SONUCU
    parse_sonuc TEXT,                         -- JSON
    parse_guven REAL,                        -- 0.0 - 1.0

    -- AKSİYON PLANI
    aksiyon_plani TEXT,                       -- JSON dizisi
    aksiyon_sayisi INTEGER DEFAULT 0,

    -- DURUM
    durum TEXT DEFAULT 'onay_bekliyor',
    -- 'onay_bekliyor','onaylandi','uygulandı','kismi_uygulama',
    -- 'reddedildi','duzeltildi','hata'

    -- UYGULAMA
    uygulama_sonuc TEXT,                     -- JSON
    hata_mesaji TEXT,

    -- İLİŞKİLER
    kullanici_id INTEGER NOT NULL,
    proje_id INTEGER,
    ekip_id INTEGER,

    -- ZAMAN
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    onay_tarihi DATETIME,
    uygulama_tarihi DATETIME,

    -- PROVIDER BİLGİSİ
    provider_adi TEXT,                        -- 'ollama', 'gemini', 'groq'
    fallback_kullanildi INTEGER DEFAULT 0,    -- 0 veya 1

    FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id),
    FOREIGN KEY (girdi_dosya_id) REFERENCES dosyalar(id),
    FOREIGN KEY (veri_paketi_id) REFERENCES veri_paketleri(id),
    FOREIGN KEY (proje_id) REFERENCES projeler(id),
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_islem_durum ON ai_islemler(durum);
CREATE INDEX IF NOT EXISTS idx_ai_islem_kullanici ON ai_islemler(kullanici_id);
CREATE INDEX IF NOT EXISTS idx_ai_islem_tarih ON ai_islemler(olusturma_tarihi);
```

---

## B2 — Aksiyon Kayıt Sistemi (Action Registry)

### `aksiyonRegistry.js`

```javascript
/**
 * Yeni aksiyon eklemek için:
 * 1. aksiyonlar/ klasörüne yeni dosya oluştur
 * 2. Standart interface'i uygula (bilgi, dogrula, uygula, geriAl)
 * 3. Bu dosyada require() ile kaydet
 *
 * Her aksiyon şu interface'i uygulamalı:
 * {
 *   tip, etiket, ikon, kategori, riskSeviyesi, aciklama,
 *   dogrula(params, context): { gecerli, hatalar[] }
 *   uygula(params, context): { basarili, sonuc, mesaj }
 *   geriAl(uygulamaSonuc, context): { basarili }
 *   ozet(params): string
 * }
 */

class AksiyonRegistry {
  constructor() { this.aksiyonlar = new Map(); }

  kaydet(tanim) {
    if (!tanim.tip) throw new Error('Aksiyon tipi zorunlu');
    if (!tanim.uygula) throw new Error('uygula() fonksiyonu zorunlu');
    this.aksiyonlar.set(tanim.tip, tanim);
    console.log(`✅ Aksiyon kaydedildi: ${tanim.tip} (${tanim.etiket})`);
  }

  getir(tip) { return this.aksiyonlar.get(tip); }

  tumunu() {
    return Array.from(this.aksiyonlar.values()).map(a => ({
      tip: a.tip, etiket: a.etiket, ikon: a.ikon,
      kategori: a.kategori, riskSeviyesi: a.riskSeviyesi, aciklama: a.aciklama,
    }));
  }
}

const registry = new AksiyonRegistry();

// Kayıtları yükle
require('./aksiyonlar/depoGiris');
require('./aksiyonlar/depoCikis');
require('./aksiyonlar/asamaIlerlet');
require('./aksiyonlar/belgeParse');
require('./aksiyonlar/tutanakOlustur');
require('./aksiyonlar/paketSiniflandir');
// Gelecek: hakedisHazirla, kesifHazirla, siparisOlustur...

module.exports = registry;
```

---

## B3 — Aksiyon Tanımları

### `aksiyonlar/depoCikis.js`

```javascript
const { getDb } = require('../../../db/database');
const registry = require('../aksiyonRegistry');

registry.kaydet({
  tip: 'depo_cikis', etiket: 'Depo Çıkış', ikon: '📤',
  kategori: 'depo', riskSeviyesi: 'orta',
  aciklama: 'Depodan malzeme çıkışı yapar, stok düşer',

  dogrula(params) {
    const hatalar = [];
    if (!params.malzeme_adi && !params.malzeme_kodu) hatalar.push('Malzeme belirtilmeli');
    if (!params.miktar || params.miktar <= 0) hatalar.push('Miktar pozitif olmalı');

    if (params.malzeme_kodu) {
      const stok = getDb().prepare('SELECT miktar FROM depo_stok WHERE malzeme_kodu = ?')
        .get(params.malzeme_kodu);
      if (!stok) hatalar.push(`"${params.malzeme_kodu}" depoda bulunamadı`);
      else if (stok.miktar < params.miktar) hatalar.push(`Yetersiz stok: ${stok.miktar} var, ${params.miktar} isteniyor`);
    }
    return { gecerli: hatalar.length === 0, hatalar };
  },

  uygula(params, context) {
    const db = getDb();
    db.prepare(`UPDATE depo_stok SET miktar = miktar - ?, son_hareket = datetime('now') WHERE malzeme_kodu = ?`)
      .run(params.miktar, params.malzeme_kodu);

    const result = db.prepare(`
      INSERT INTO depo_hareketler (hareket_tipi, malzeme_kodu, malzeme_adi, miktar, birim,
        hedef_konum, hedef_ekip_id, proje_id, islem_yapan_id, notlar)
      VALUES ('cikis', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(params.malzeme_kodu, params.malzeme_adi, params.miktar, params.birim || 'adet',
      params.hedef_konum, params.ekip_id, params.proje_id, context.kullaniciId,
      params.notlar || `AI operasyon #${context.aiIslemId}`);

    return { basarili: true, sonuc: { hareket_id: result.lastInsertRowid },
      mesaj: `${params.miktar} adet ${params.malzeme_adi} depodan çıkış → ${params.hedef_konum || '—'}` };
  },

  geriAl(sonuc) {
    const db = getDb();
    const h = db.prepare('SELECT * FROM depo_hareketler WHERE id = ?').get(sonuc.hareket_id);
    if (h) {
      db.prepare('UPDATE depo_stok SET miktar = miktar + ? WHERE malzeme_kodu = ?').run(h.miktar, h.malzeme_kodu);
      db.prepare("UPDATE depo_hareketler SET durum = 'iptal' WHERE id = ?").run(h.id);
    }
    return { basarili: true };
  },

  ozet(p) { return `${p.malzeme_adi} × ${p.miktar} ${p.birim || 'adet'} → depodan çıkış${p.hedef_konum ? ` → ${p.hedef_konum}` : ''}`; },
});
```

### `aksiyonlar/depoGiris.js`

```javascript
const { getDb } = require('../../../db/database');
const registry = require('../aksiyonRegistry');

registry.kaydet({
  tip: 'depo_giris', etiket: 'Depo Giriş', ikon: '📥',
  kategori: 'depo', riskSeviyesi: 'dusuk',
  aciklama: 'Depoya malzeme girişi yapar, stok artar',

  dogrula(params) {
    const hatalar = [];
    if (!params.malzeme_adi && !params.malzeme_kodu) hatalar.push('Malzeme belirtilmeli');
    if (!params.miktar || params.miktar <= 0) hatalar.push('Miktar pozitif olmalı');
    return { gecerli: hatalar.length === 0, hatalar };
  },

  uygula(params, context) {
    const db = getDb();
    const mevcut = db.prepare('SELECT id FROM depo_stok WHERE malzeme_kodu = ?').get(params.malzeme_kodu);

    if (mevcut) {
      db.prepare("UPDATE depo_stok SET miktar = miktar + ?, son_hareket = datetime('now') WHERE malzeme_kodu = ?")
        .run(params.miktar, params.malzeme_kodu);
    } else {
      db.prepare('INSERT INTO depo_stok (malzeme_kodu, malzeme_adi, miktar, birim, kategori) VALUES (?, ?, ?, ?, ?)')
        .run(params.malzeme_kodu, params.malzeme_adi, params.miktar, params.birim || 'adet', params.kategori || 'genel');
    }

    const result = db.prepare(`
      INSERT INTO depo_hareketler (hareket_tipi, malzeme_kodu, malzeme_adi, miktar, birim, kaynak, irsaliye_no, islem_yapan_id, notlar)
      VALUES ('giris', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(params.malzeme_kodu, params.malzeme_adi, params.miktar, params.birim || 'adet',
      params.kaynak || 'ambar', params.irsaliye_no, context.kullaniciId, params.notlar);

    return { basarili: true, sonuc: { hareket_id: result.lastInsertRowid },
      mesaj: `${params.miktar} adet ${params.malzeme_adi} depoya giriş${params.irsaliye_no ? ` (İrs: ${params.irsaliye_no})` : ''}` };
  },

  geriAl(sonuc) {
    const db = getDb();
    const h = db.prepare('SELECT * FROM depo_hareketler WHERE id = ?').get(sonuc.hareket_id);
    if (h) {
      db.prepare('UPDATE depo_stok SET miktar = miktar - ? WHERE malzeme_kodu = ?').run(h.miktar, h.malzeme_kodu);
      db.prepare("UPDATE depo_hareketler SET durum = 'iptal' WHERE id = ?").run(h.id);
    }
    return { basarili: true };
  },

  ozet(p) { return `${p.malzeme_adi} × ${p.miktar} ${p.birim || 'adet'} → depoya giriş${p.irsaliye_no ? ` (İrs: ${p.irsaliye_no})` : ''}`; },
});
```

### `aksiyonlar/asamaIlerlet.js`

```javascript
const { getDb } = require('../../../db/database');
const registry = require('../aksiyonRegistry');

registry.kaydet({
  tip: 'asama_ilerlet', etiket: 'Aşama İlerlet', ikon: '⏭️',
  kategori: 'proje', riskSeviyesi: 'orta',
  aciklama: 'Proje aşamasını başlatır veya tamamlar',

  dogrula(params) {
    const hatalar = [];
    if (!params.proje_id) hatalar.push('Proje belirtilmeli');
    if (!params.islem || !['baslat', 'tamamla'].includes(params.islem)) hatalar.push('"baslat" veya "tamamla" olmalı');
    return { gecerli: hatalar.length === 0, hatalar };
  },

  uygula(params, context) {
    const db = getDb();
    if (params.islem === 'tamamla') {
      const aktif = db.prepare("SELECT * FROM proje_asamalari WHERE proje_id = ? AND durum = 'aktif' LIMIT 1").get(params.proje_id);
      if (!aktif) return { basarili: false, mesaj: 'Aktif aşama bulunamadı' };
      db.prepare("UPDATE proje_asamalari SET durum = 'tamamlandi', tamamlanma_tarihi = datetime('now') WHERE id = ?").run(aktif.id);
      const sonraki = db.prepare("SELECT * FROM proje_asamalari WHERE proje_id = ? AND durum = 'bekliyor' ORDER BY sira LIMIT 1").get(params.proje_id);
      return { basarili: true, sonuc: { tamamlanan_id: aktif.id, sonraki_id: sonraki?.id },
        mesaj: `"${aktif.asama_adi}" tamamlandı${sonraki ? `, sıradaki: "${sonraki.asama_adi}"` : ' — tüm aşamalar bitti!'}` };
    } else {
      const hedef = db.prepare("SELECT * FROM proje_asamalari WHERE proje_id = ? AND durum = 'bekliyor' ORDER BY sira LIMIT 1").get(params.proje_id);
      if (!hedef) return { basarili: false, mesaj: 'Başlatılacak aşama yok' };
      db.prepare("UPDATE proje_asamalari SET durum = 'aktif', baslama_tarihi = datetime('now') WHERE id = ?").run(hedef.id);
      return { basarili: true, sonuc: { baslayan_id: hedef.id }, mesaj: `"${hedef.asama_adi}" başlatıldı` };
    }
  },

  geriAl() { return { basarili: false, mesaj: 'Aşama ilerletme geri alınamaz' }; },
  ozet(p) { return p.islem === 'tamamla' ? 'Aktif aşamayı tamamla' : 'Sıradaki aşamayı başlat'; },
});
```

### `aksiyonlar/belgeParse.js`

```javascript
const registry = require('../aksiyonRegistry');

registry.kaydet({
  tip: 'belge_parse', etiket: 'Belge Parse', ikon: '📋',
  kategori: 'belge', riskSeviyesi: 'dusuk',
  aciklama: 'Fotoğraf/PDF belgesini AI ile parse eder',

  dogrula(params) {
    const hatalar = [];
    if (!params.dosya_id && !params.gorsel_url) hatalar.push('Dosya veya görsel gerekli');
    return { gecerli: hatalar.length === 0, hatalar };
  },

  async uygula(params) {
    return { basarili: true,
      sonuc: { parse_tipi: params.belge_tipi, parse_veri: params.parse_sonuc },
      mesaj: `${params.belge_tipi || 'Belge'} parse edildi` };
  },

  geriAl() { return { basarili: true }; },
  ozet(p) { return `${p.belge_tipi || 'Belge'} parse et`; },
});
```

### `aksiyonlar/tutanakOlustur.js`

```javascript
const { getDb } = require('../../../db/database');
const registry = require('../aksiyonRegistry');

registry.kaydet({
  tip: 'tutanak_olustur', etiket: 'Tutanak Oluştur', ikon: '📄',
  kategori: 'belge', riskSeviyesi: 'dusuk',
  aciklama: 'Teslim tutanağı, tespit tutanağı vb. oluşturur',

  dogrula(params) {
    return { gecerli: !!params.tutanak_tipi, hatalar: params.tutanak_tipi ? [] : ['Tutanak tipi belirtilmeli'] };
  },

  async uygula(params) {
    return { basarili: true, sonuc: { tutanak_dosya_id: null },
      mesaj: `${params.tutanak_tipi} tutanağı oluşturuldu` };
  },

  geriAl(sonuc) {
    if (sonuc.tutanak_dosya_id) {
      getDb().prepare("UPDATE dosyalar SET durum = 'silindi' WHERE id = ?").run(sonuc.tutanak_dosya_id);
    }
    return { basarili: true };
  },

  ozet(p) { return `${p.tutanak_tipi} tutanağı oluştur`; },
});
```

### `aksiyonlar/paketSiniflandir.js`

```javascript
const { getDb } = require('../../../db/database');
const registry = require('../aksiyonRegistry');

registry.kaydet({
  tip: 'paket_siniflandir', etiket: 'Paket Sınıflandır', ikon: '🏷️',
  kategori: 'proje', riskSeviyesi: 'dusuk',
  aciklama: 'Veri paketini otomatik sınıflandırır ve etiketler',

  dogrula(params) {
    return { gecerli: !!params.veri_paketi_id, hatalar: params.veri_paketi_id ? [] : ['Veri paketi ID gerekli'] };
  },

  uygula(params) {
    const db = getDb();
    const updates = {};
    if (params.paket_tipi) updates.paket_tipi = params.paket_tipi;
    if (params.etiketler) updates.etiketler = JSON.stringify(params.etiketler);
    if (params.baslik) updates.baslik = params.baslik;

    const setClauses = Object.keys(updates).map(k => `${k} = ?`);
    setClauses.push("guncelleme_tarihi = datetime('now')");
    db.prepare(`UPDATE veri_paketleri SET ${setClauses.join(', ')} WHERE id = ?`)
      .run(...Object.values(updates), params.veri_paketi_id);

    return { basarili: true, sonuc: { veri_paketi_id: params.veri_paketi_id },
      mesaj: `Paket sınıflandırıldı: ${params.paket_tipi || 'güncellendi'}` };
  },

  geriAl() { return { basarili: true }; },
  ozet(p) { return `Paketi "${p.paket_tipi}" olarak sınıflandır`; },
});
```

---

## B4 — AI Parse Servisi (Provider-Agnostic)

### `aiParseService.js`

```javascript
const providerManager = require('./providerManager');

class AiParseService {

  /**
   * ANA PARSE — Metin ve/veya görselleri analiz et, aksiyon planı döndür
   * Provider-agnostic: .env'deki AI_PROVIDER'a göre Ollama/Gemini/Groq kullanır
   */
  async parseEt({ metin, gorseller = [], belgeler = [], context = {} }) {
    const sistemPromptu = this._sistemPromptu(context);
    let sonuc;

    if (gorseller.length > 0) {
      const mesaj = metin
        ? `${metin}\n\nEklenen görselleri analiz et ve mesajla birlikte değerlendir.`
        : 'Bu görseli analiz et ve içeriğini yapılandırılmış JSON olarak döndür.';
      const aiYanit = await providerManager.gorselGonder(sistemPromptu, mesaj, gorseller);
      sonuc = this._yanitParsele(aiYanit.metin);
      sonuc._provider = aiYanit.provider;
      sonuc._fallback = aiYanit.fallback;
    } else {
      const aiYanit = await providerManager.metinGonder(sistemPromptu, metin);
      sonuc = this._yanitParsele(aiYanit.metin);
      sonuc._provider = aiYanit.provider;
      sonuc._fallback = aiYanit.fallback;
    }

    return sonuc;
  }

  /** Sistem promptu — AI'ın ElektraTrack'i anlaması */
  _sistemPromptu(context) {
    return `Sen ElektraTrack adlı elektrik dağıtım müteahhitliği proje takip sisteminin AI asistanısın.

GÖREV: Kullanıcının mesajını (metin ve/veya görsel) analiz et, yapılması gereken sistem aksiyonlarını belirle.

SİSTEM BİLGİSİ:
- Depo stok yönetimi var (malzeme giriş/çıkış/transfer)
- Proje yaşam döngüsü var (aşama başlat/tamamla)
- Veri paketleri var (saha raporları, tespit paketleri)
- Dosya yönetimi var (8 alan: proje, personel, ekipman, ihale, isg, firma, muhasebe, kurum)
- Personel ve ekip yönetimi var

MEVCUT BAĞLAM:
- Kullanıcı: ${context.kullaniciAdi || 'bilinmiyor'}
- Rol: ${context.rol || 'bilinmiyor'}
- Aktif proje: ${context.projeNo || 'yok'}
- Ekip: ${context.ekipAdi || 'yok'}

KULLANILABILIR AKSİYON TİPLERİ:
${context.aksiyonTipleri || '(yükleniyor)'}

ÇIKTI FORMATI — KESİNLİKLE bu JSON formatında yanıtla, başka metin ekleme:

{
  "anlama": {
    "ozet": "Kullanıcının ne istediğinin kısa açıklaması",
    "guven": 0.95,
    "belirsizlikler": ["varsa belirsiz noktalar"]
  },
  "aksiyonlar": [
    {
      "tip": "depo_cikis",
      "oncelik": 1,
      "params": {
        "malzeme_kodu": "12I_A_DIREK",
        "malzeme_adi": "12I A tipi direk",
        "miktar": 3,
        "birim": "adet",
        "hedef_konum": "Elalan köyü",
        "ekip_id": 1
      }
    }
  ],
  "uyarilar": ["Stok kontrolü yapılmalı"],
  "sorular": []
}

KURALLAR:
1. Belirsiz durumlarda "sorular"a soru ekle, aksiyon ekleme
2. Birden fazla aksiyon gerekiyorsa hepsini listele (sıralı)
3. Stok azaltma + lokasyon + tutanak gibi ilişkili aksiyonları birlikte planla
4. Görsel parse ediyorsan tüm satırları yapılandırılmış döndür
5. Güven 0.7 altındaysa sorular dizisine ne sorulmalı ekle
6. Malzeme kodlarını standardize et (büyük harf, alt çizgi)`;
  }

  /** AI yanıtını JSON'a parse et */
  _yanitParsele(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON bulunamadı');
      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      return {
        anlama: { ozet: 'Parse hatası', guven: 0, belirsizlikler: [err.message] },
        aksiyonlar: [], uyarilar: ['AI yanıtı parse edilemedi'], sorular: [],
      };
    }
  }
}

module.exports = new AiParseService();
```

---

## B5 — Ana Orkestratör

### `aiOperasyonService.js`

```javascript
const { getDb } = require('../../db/database');
const aiParseService = require('./aiParseService');
const aksiyonRegistry = require('./aksiyonRegistry');

class AiOperasyonService {

  /**
   * ANA GİRİŞ NOKTASI — Mesaj + görselleri işle, aksiyon planı oluştur
   * @returns { islemId, anlama, aksiyonlar, uyarilar, sorular }
   */
  async mesajIsle({ metin, gorseller = [], belgeler = [], kullaniciId, projeId, ekipId, veriPaketiId }) {
    const db = getDb();

    // 1. Bağlam oluştur
    const context = await this._baglamOlustur(kullaniciId, projeId, ekipId);

    // 2. AI parse
    const parseSonuc = await aiParseService.parseEt({ metin, gorseller, belgeler, context });

    // 3. Aksiyonları doğrula
    const dogrulanmis = [];
    for (const aksiyon of parseSonuc.aksiyonlar) {
      const tanim = aksiyonRegistry.getir(aksiyon.tip);
      if (!tanim) {
        dogrulanmis.push({ ...aksiyon, gecerli: false, hatalar: [`"${aksiyon.tip}" bilinmeyen aksiyon`] });
        continue;
      }
      const d = tanim.dogrula ? tanim.dogrula(aksiyon.params, context) : { gecerli: true, hatalar: [] };
      dogrulanmis.push({
        ...aksiyon, etiket: tanim.etiket, ikon: tanim.ikon, riskSeviyesi: tanim.riskSeviyesi,
        ozet: tanim.ozet ? tanim.ozet(aksiyon.params) : '', gecerli: d.gecerli, hatalar: d.hatalar || [],
      });
    }

    // 4. DB'ye kaydet
    const result = db.prepare(`
      INSERT INTO ai_islemler (
        girdi_tipi, girdi_metin, veri_paketi_id, parse_sonuc, parse_guven,
        aksiyon_plani, aksiyon_sayisi, durum, kullanici_id, proje_id, ekip_id,
        provider_adi, fallback_kullanildi
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'onay_bekliyor', ?, ?, ?, ?, ?)
    `).run(
      gorseller.length > 0 ? 'karma' : 'metin', metin, veriPaketiId,
      JSON.stringify(parseSonuc), parseSonuc.anlama?.guven || 0,
      JSON.stringify(dogrulanmis), dogrulanmis.length,
      kullaniciId, projeId, ekipId,
      parseSonuc._provider || null, parseSonuc._fallback ? 1 : 0
    );

    return {
      islemId: result.lastInsertRowid,
      anlama: parseSonuc.anlama,
      aksiyonlar: dogrulanmis,
      uyarilar: parseSonuc.uyarilar || [],
      sorular: parseSonuc.sorular || [],
    };
  }

  /** ONAYLA — Aksiyonları uygula */
  async onayla(islemId, kullaniciId, duzeltmeler = null) {
    const db = getDb();
    const islem = db.prepare('SELECT * FROM ai_islemler WHERE id = ?').get(islemId);
    if (!islem) throw new Error('İşlem bulunamadı');
    if (islem.durum !== 'onay_bekliyor') throw new Error('Bu işlem zaten işlenmiş');

    let aksiyonlar = JSON.parse(islem.aksiyon_plani);
    if (duzeltmeler) {
      for (const d of duzeltmeler) {
        if (d.sil) aksiyonlar[d.index] = { ...aksiyonlar[d.index], gecerli: false };
        else if (d.params) aksiyonlar[d.index].params = { ...aksiyonlar[d.index].params, ...d.params };
      }
      aksiyonlar = aksiyonlar.filter(a => a.gecerli !== false);
    }

    db.prepare("UPDATE ai_islemler SET durum = 'onaylandi', onay_tarihi = datetime('now') WHERE id = ?").run(islemId);

    const context = { kullaniciId, aiIslemId: islemId, projeId: islem.proje_id, ekipId: islem.ekip_id };
    const sonuclar = [];
    let tumBasarili = true;

    for (const aksiyon of aksiyonlar) {
      const tanim = aksiyonRegistry.getir(aksiyon.tip);
      if (!tanim || !aksiyon.gecerli) {
        sonuclar.push({ tip: aksiyon.tip, basarili: false, mesaj: 'Geçersiz aksiyon' });
        tumBasarili = false;
        continue;
      }
      try {
        const sonuc = await tanim.uygula(aksiyon.params, context);
        sonuclar.push({ tip: aksiyon.tip, ...sonuc });
        if (!sonuc.basarili) tumBasarili = false;
      } catch (err) {
        sonuclar.push({ tip: aksiyon.tip, basarili: false, mesaj: err.message });
        tumBasarili = false;
      }
    }

    const yeniDurum = tumBasarili ? 'uygulandı' : 'kismi_uygulama';
    db.prepare("UPDATE ai_islemler SET durum = ?, uygulama_sonuc = ?, uygulama_tarihi = datetime('now') WHERE id = ?")
      .run(yeniDurum, JSON.stringify(sonuclar), islemId);

    return { islemId, durum: yeniDurum, sonuclar };
  }

  /** REDDET */
  reddet(islemId, kullaniciId, sebep = null) {
    getDb().prepare("UPDATE ai_islemler SET durum = 'reddedildi', hata_mesaji = ?, onay_tarihi = datetime('now') WHERE id = ? AND durum = 'onay_bekliyor'")
      .run(sebep, islemId);
  }

  /** GERİ AL */
  async geriAl(islemId, kullaniciId) {
    const db = getDb();
    const islem = db.prepare('SELECT * FROM ai_islemler WHERE id = ?').get(islemId);
    if (!islem || !['uygulandı', 'kismi_uygulama'].includes(islem.durum)) throw new Error('Geri alınamaz');

    for (const sonuc of JSON.parse(islem.uygulama_sonuc || '[]').reverse()) {
      if (!sonuc.basarili) continue;
      const tanim = aksiyonRegistry.getir(sonuc.tip);
      if (tanim?.geriAl) await tanim.geriAl(sonuc.sonuc, { kullaniciId, aiIslemId: islemId });
    }
    db.prepare("UPDATE ai_islemler SET durum = 'geri_alindi' WHERE id = ?").run(islemId);
    return { basarili: true };
  }

  /** Bağlam oluştur */
  async _baglamOlustur(kullaniciId, projeId, ekipId) {
    const db = getDb();
    const k = db.prepare('SELECT * FROM kullanicilar WHERE id = ?').get(kullaniciId);
    const roller = db.prepare('SELECT r.rol_adi FROM roller r JOIN kullanici_rolleri kr ON r.id = kr.rol_id WHERE kr.kullanici_id = ?').all(kullaniciId);
    const proje = projeId ? db.prepare('SELECT proje_no, proje_adi FROM projeler WHERE id = ?').get(projeId) : null;
    const ekip = ekipId ? db.prepare('SELECT ekip_adi, ekip_kodu FROM ekipler WHERE id = ?').get(ekipId) : null;

    return {
      kullaniciId, kullaniciAdi: k?.ad_soyad || 'bilinmiyor',
      rol: roller.map(r => r.rol_adi).join(', ') || 'bilinmiyor',
      projeNo: proje?.proje_no, projeAdi: proje?.proje_adi,
      ekipAdi: ekip?.ekip_adi, ekipKodu: ekip?.ekip_kodu,
      aksiyonTipleri: aksiyonRegistry.tumunu().map(a => `- ${a.tip}: ${a.aciklama} (${a.ikon} ${a.etiket})`).join('\n'),
    };
  }
}

module.exports = new AiOperasyonService();
```

---

## B6 — API Endpoint'leri

### `server/routes/aiOperasyon.js`

```javascript
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const aiOperasyonService = require('../services/ai/aiOperasyonService');
const aksiyonRegistry = require('../services/ai/aksiyonRegistry');
const providerManager = require('../services/ai/providerManager');

router.use(authMiddleware);

// POST /api/ai/islem — Yeni AI işlem başlat (parse + plan)
router.post('/islem', async (req, res) => {
  try {
    const { metin, gorseller, belgeler, proje_id, ekip_id, veri_paketi_id } = req.body;
    const sonuc = await aiOperasyonService.mesajIsle({
      metin, gorseller: gorseller || [], belgeler: belgeler || [],
      kullaniciId: req.kullanici.id, projeId: proje_id,
      ekipId: ekip_id || req.kullanici.ekip_id, veriPaketiId: veri_paketi_id,
    });
    res.json({ success: true, data: sonuc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/ai/islem/:id/onayla
router.put('/islem/:id/onayla', async (req, res) => {
  try {
    const sonuc = await aiOperasyonService.onayla(parseInt(req.params.id), req.kullanici.id, req.body.duzeltmeler);
    res.json({ success: true, data: sonuc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/ai/islem/:id/reddet
router.put('/islem/:id/reddet', (req, res) => {
  try {
    aiOperasyonService.reddet(parseInt(req.params.id), req.kullanici.id, req.body.sebep);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/ai/islem/:id/geri-al
router.put('/islem/:id/geri-al', async (req, res) => {
  try {
    const sonuc = await aiOperasyonService.geriAl(parseInt(req.params.id), req.kullanici.id);
    res.json({ success: true, data: sonuc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ai/islemler — İşlem geçmişi
router.get('/islemler', (req, res) => {
  try {
    const db = require('../db/database').getDb();
    const { durum, limit = 20, offset = 0 } = req.query;
    let where = ['1=1'], params = [];
    if (durum) { where.push('durum = ?'); params.push(durum); }

    const islemler = db.prepare(`
      SELECT ai.*, k.ad_soyad as kullanici_adi FROM ai_islemler ai
      LEFT JOIN kullanicilar k ON ai.kullanici_id = k.id
      WHERE ${where.join(' AND ')} ORDER BY ai.olusturma_tarihi DESC LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), parseInt(offset));
    res.json({ success: true, data: islemler });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ai/aksiyonlar — Mevcut aksiyon tipleri
router.get('/aksiyonlar', (req, res) => {
  res.json({ success: true, data: aksiyonRegistry.tumunu() });
});

// GET /api/ai/durum — AI sağlayıcı durumları
router.get('/durum', async (req, res) => {
  try {
    const durum = await providerManager.durumKontrol();
    const istatistik = providerManager.istatistikGetir();
    res.json({ success: true, data: {
      aktifProvider: process.env.AI_PROVIDER || 'ollama',
      fallbackSirasi: (process.env.AI_FALLBACK_ORDER || 'ollama,groq,gemini').split(','),
      providers: durum, istatistik,
    }});
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/ai/test — Bağlantı testi
router.post('/test', async (req, res) => {
  try {
    const { metin, provider } = req.body;
    const testMesaj = metin || 'Merhaba, test. "test": true JSON döndür.';

    if (provider && providerManager.providers[provider]) {
      const p = providerManager.providers[provider];
      const saglikli = await p.saglikKontrol();
      if (!saglikli) return res.json({ success: false, error: `${provider} erişilemez` });
      const baslangic = Date.now();
      const sonuc = await p.metinGonder('Kısa yanıt ver.', testMesaj);
      return res.json({ success: true, provider, sure: Date.now() - baslangic, data: sonuc });
    }

    // Tüm provider'ları test et
    const sonuclar = {};
    for (const [isim, p] of Object.entries(providerManager.providers)) {
      try {
        const saglikli = await p.saglikKontrol();
        if (saglikli) {
          const bas = Date.now();
          const sonuc = await p.metinGonder('Kısa yanıt ver.', testMesaj);
          sonuclar[isim] = { aktif: true, sure: Date.now() - bas, yanitUzunluk: sonuc.metin.length };
        } else {
          sonuclar[isim] = { aktif: false, sebep: 'Sağlık kontrolü başarısız' };
        }
      } catch (err) {
        sonuclar[isim] = { aktif: false, sebep: err.message };
      }
    }
    res.json({ success: true, data: sonuclar });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

### Route Kaydı

```javascript
// server/server.js
const aiRoutes = require('./routes/aiOperasyon');
app.use('/api/ai', aiRoutes);
```

---

# BÖLÜM C — FRONTEND

---

## C1 — AI Onay Paneli

### `client/src/components/ai/AiOnayPaneli.jsx`

```jsx
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const RISK_RENK = {
  dusuk: { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
  orta:  { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
  yuksek:{ bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
};

export default function AiOnayPaneli({ islemId, anlama, aksiyonlar, uyarilar = [], sorular = [], onOnayla, onReddet, onKapat }) {
  const { authFetch } = useAuth();
  const [yukleniyor, setYukleniyor] = useState(false);
  const [sonuc, setSonuc] = useState(null);
  const [duzenleme, setDuzenleme] = useState({});

  const handleOnayla = async () => {
    setYukleniyor(true);
    try {
      const duzeltmeler = Object.keys(duzenleme).length > 0
        ? Object.entries(duzenleme).map(([idx, params]) => ({ index: parseInt(idx), params }))
        : null;
      const res = await authFetch(`/api/ai/islem/${islemId}/onayla`, { method: 'PUT', body: JSON.stringify({ duzeltmeler }) });
      const json = await res.json();
      if (json.success) { setSonuc(json.data); onOnayla?.(json.data); }
    } finally { setYukleniyor(false); }
  };

  const handleReddet = async () => {
    await authFetch(`/api/ai/islem/${islemId}/reddet`, { method: 'PUT', body: '{}' });
    onReddet?.();
  };

  // Sonuç gösterimi
  if (sonuc) {
    return (
      <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '12px', padding: '16px' }}>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#166534', marginBottom: '12px' }}>✅ İşlem Tamamlandı</div>
        {sonuc.sonuclar.map((s, i) => (
          <div key={i} style={{ padding: '8px 12px', marginBottom: '4px', borderRadius: '8px',
            background: s.basarili ? '#dcfce7' : '#fef2f2', fontSize: '13px' }}>
            {s.basarili ? '✅' : '❌'} {s.mesaj}
          </div>
        ))}
        <button onClick={onKapat} style={{ marginTop: '12px', padding: '8px 16px', fontSize: '13px',
          background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Tamam</button>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      {/* Başlık */}
      <div style={{ padding: '14px 16px', background: '#f0f9ff', borderBottom: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '20px' }}>🤖</span>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0369a1' }}>AI — {aksiyonlar.length} aksiyon belirlendi</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {anlama?.ozet}
            {anlama?.guven && <span style={{ marginLeft: '8px', color: '#9ca3af' }}>(güven: %{Math.round(anlama.guven * 100)})</span>}
          </div>
        </div>
      </div>

      {/* Uyarılar */}
      {uyarilar.length > 0 && (
        <div style={{ padding: '8px 16px', background: '#fffbeb', borderBottom: '1px solid #fcd34d' }}>
          {uyarilar.map((u, i) => <div key={i} style={{ fontSize: '12px', color: '#92400e' }}>⚠️ {u}</div>)}
        </div>
      )}

      {/* Sorular */}
      {sorular.length > 0 && (
        <div style={{ padding: '12px 16px', background: '#fef3c7', borderBottom: '1px solid #fcd34d' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#92400e', marginBottom: '4px' }}>❓ Doğrulama Gerekiyor:</div>
          {sorular.map((s, i) => <div key={i} style={{ fontSize: '13px', color: '#78350f' }}>• {s}</div>)}
        </div>
      )}

      {/* Aksiyonlar */}
      <div style={{ padding: '12px 16px' }}>
        {aksiyonlar.map((aksiyon, index) => {
          const stil = RISK_RENK[aksiyon.riskSeviyesi] || RISK_RENK.dusuk;
          return (
            <div key={index} style={{ border: `1px solid ${aksiyon.gecerli ? stil.border : '#fca5a5'}`,
              borderRadius: '10px', padding: '12px', marginBottom: '8px', background: aksiyon.gecerli ? stil.bg : '#fef2f2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>{aksiyon.ikon || '⚡'}</span>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: stil.text }}>{aksiyon.etiket || aksiyon.tip}</span>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>{aksiyon.ozet}</div>
                  </div>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: stil.border, color: stil.text }}>
                  {aksiyon.riskSeviyesi}
                </span>
              </div>
              {/* Düzenlenebilir parametreler */}
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#374151' }}>
                {Object.entries(aksiyon.params || {}).map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#9ca3af', width: '120px', flexShrink: 0 }}>{key.replace(/_/g, ' ')}:</span>
                    <input value={duzenleme[index]?.[key] ?? (typeof val === 'object' ? JSON.stringify(val) : val)}
                      onChange={(e) => setDuzenleme({ ...duzenleme, [index]: { ...(duzenleme[index] || {}), [key]: e.target.value } })}
                      style={{ flex: 1, padding: '3px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '12px' }} />
                  </div>
                ))}
              </div>
              {!aksiyon.gecerli && aksiyon.hatalar?.map((h, i) => (
                <div key={i} style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>❌ {h}</div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Butonlar */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={handleReddet} disabled={yukleniyor}
          style={{ padding: '8px 20px', fontSize: '13px', background: 'white', color: '#dc2626',
            border: '1px solid #fca5a5', borderRadius: '8px', cursor: 'pointer' }}>❌ İptal</button>
        <button onClick={handleOnayla} disabled={yukleniyor || aksiyonlar.every(a => !a.gecerli)}
          style={{ padding: '8px 20px', fontSize: '13px', fontWeight: 600,
            background: yukleniyor ? '#93c5fd' : '#2563eb', color: 'white',
            border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          {yukleniyor ? '⏳ Uygulanıyor...' : '✅ Onayla ve Uygula'}
        </button>
      </div>
    </div>
  );
}
```

---

# BÖLÜM D — ÖRNEKLER VE GENİŞLETME

---

## D1 — Akış Örnekleri

### Depo Çıkış

```
Depocu: "Depodan 3 adet 12I A tipi direk ekip-1 tarafından Elalan köyüne götürüldü"

→ AI parse → 2 aksiyon:
  1. 📤 Depo Çıkış: 12I_A_DIREK × 3 → Elalan köyü
  2. 📄 Teslim Tutanağı oluştur
→ Kullanıcı onaylar → Stok düşer + tutanak oluşur
```

### İrsaliye Parse (Görsel + Metin)

```
Depocu: [irsaliye-foto.jpg] + "yeni mal geldi irsaliyesi bu, depoya işle"

→ AI Vision parse → malzeme listesi çıkarır:
  N-12 Beton Direk × 10, 3x35+16 NYY Kablo × 500m, OG Sigorta 36kV × 6
→ 3x Depo Giriş aksiyonu planlanır
→ Kullanıcı onaylar → Her malzeme stoka eklenir
```

### İrsaliye Uyuşmazlığı

```
Depocu irsaliyeyi parse ettirdi ama gelen mal farklı:
"gelen mal ile irsaliye uyuşmuyor, irsaliyede N-12 görülüyor ama gelen N-14"

→ Depocu onay panelinde malzeme_kodu'nu N-12 → N-14 olarak düzeltir
→ Not alanına uyuşmazlık yazar
→ Onay → N-14 girişi yapılır + uyuşmazlık loglanır
```

### Proje Aşama İlerletme

```
Mühendis: "YB-2025-001 yapım tamamlandı, CBS'ye geçelim"

→ AI parse → 1 aksiyon:
  ⏭️ "Yapım" tamamla → "CBS" otomatik aktif
→ Onay → Aşama güncellenir
```

---

## D2 — Yeni Aksiyon Eklemek (5 dakika)

```javascript
// server/services/ai/aksiyonlar/siparisOlustur.js
const registry = require('../aksiyonRegistry');

registry.kaydet({
  tip: 'siparis_olustur', etiket: 'Sipariş Oluştur', ikon: '🛒',
  kategori: 'depo', riskSeviyesi: 'yuksek',
  aciklama: 'Malzeme siparişi oluşturur',
  dogrula(params) { return { gecerli: true, hatalar: [] }; },
  uygula(params, context) { return { basarili: true, sonuc: {}, mesaj: 'Sipariş oluşturuldu' }; },
  geriAl() { return { basarili: true }; },
  ozet(params) { return `${params.malzemeler?.length || 0} kalem sipariş`; },
});

// aksiyonRegistry.js'e ekle: require('./aksiyonlar/siparisOlustur');
```

## D3 — Yeni AI Sağlayıcı Eklemek (10 dakika)

```javascript
// 1. providers/mistralProvider.js oluştur (aiProvider interface'ini uygula)
// 2. providerManager.js'de: this.providers.mistral = new MistralProvider();
// 3. .env'de: AI_PROVIDER=mistral
```

## D4 — Gelecekte Eklenecek Aksiyonlar

| Aksiyon | Kategori | Açıklama |
|---------|----------|----------|
| `hakedis_hazirla` | finansal | Hak ediş taslağı oluştur |
| `kesif_hazirla` | proje | Keşif özeti hazırla |
| `siparis_olustur` | depo | Malzeme siparişi |
| `enerji_kesinti_basvuru` | kurum | YEDAŞ'a kesinti başvurusu |
| `puantaj_isle` | personel | Puantaj verisi işle |
| `rapor_olustur` | rapor | Haftalık/aylık rapor |
| `fatura_isle` | muhasebe | Fatura parse + kaydet |
| `isg_denetim` | isg | İSG denetiminden aksiyon çıkar |
| `taseron_is_emri` | proje | Taşerona iş emri oluştur |
| `gecici_kabul_dosya` | proje | Geçici kabul dosyası hazırla |

---

## Kontrol Listesi

### Altyapı (Bölüm A)
- [ ] Ollama Windows'a yüklendi ve çalışıyor
- [ ] `gemma3:12b` ve `llama3.2-vision:11b` modelleri indirildi
- [ ] `.env` dosyası oluşturuldu (AI_PROVIDER=ollama)
- [ ] `.env` → `.gitignore`'a eklendi
- [ ] `aiProvider.js` base interface oluşturuldu
- [ ] `ollamaProvider.js` çalışıyor
- [ ] `geminiProvider.js` çalışıyor (API key ile)
- [ ] `groqProvider.js` çalışıyor (API key ile)
- [ ] `providerManager.js` fallback mekanizması çalışıyor
- [ ] Ollama kapalıyken → Groq'a otomatik geçiyor

### Operasyon (Bölüm B)
- [ ] `ai_islemler` tablosu oluşturuldu
- [ ] `aksiyonRegistry.js` çalışıyor
- [ ] 6 aksiyon tanımlı: depoGiris, depoCikis, asamaIlerlet, belgeParse, tutanakOlustur, paketSiniflandir
- [ ] `aiParseService.js` provider-agnostic çalışıyor
- [ ] `aiOperasyonService.mesajIsle()` → parse + plan
- [ ] `aiOperasyonService.onayla()` → aksiyonları uygula
- [ ] `aiOperasyonService.reddet()` → işlemi reddet
- [ ] `aiOperasyonService.geriAl()` → geri al
- [ ] API: POST/PUT/GET endpoint'leri çalışıyor
- [ ] `GET /api/ai/durum` → sağlayıcı durumları

### Frontend (Bölüm C)
- [ ] `AiOnayPaneli` → aksiyon kartları, risk renkleri, parametre düzenleme
- [ ] Onay → sonuç gösterimi
- [ ] Red → panel kapanması

### Entegrasyon Testleri
- [ ] Metin → Depo çıkış mesajı → 2 aksiyon → onay → stok düşüyor
- [ ] Görsel → İrsaliye fotoğrafı → malzeme listesi → depo giriş → onay
- [ ] İrsaliye uyuşmazlığı → parametre düzeltme → doğru giriş
- [ ] Proje aşama → "tamamla" → sonraki aşama aktif
- [ ] Geçersiz → doğrulama hatası gösteriliyor
- [ ] Geri al → stok eski haline dönüyor
- [ ] `AI_PROVIDER=groq` → tüm işlemler Groq üzerinden
