const router = require('express').Router();
const multer = require('multer');
const config = require('../config');
const { basarili, hata } = require('../utils/helpers');
const yerTeslimPrompt = require('../services/ai-engine/prompts/yerTeslimPrompt');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// AI'ın Türkçe karakterli key döndürme sorununu düzelt (ilçe→ilce, başvuru_no→basvuru_no vb.)
function normalizeKeys(result) {
  const keyMap = {
    'ilçe': 'ilce',
    'başvuru_no': 'basvuru_no',
    'basvuru_no': 'basvuru_no',
    'öncelik': 'oncelik',
    'başlama_tarihi': 'baslama_tarihi',
    'bitiş_tarihi': 'bitis_tarihi',
    'bitış_tarihi': 'bitis_tarihi',
    'bitis_tarihi': 'bitis_tarihi',
    'tamamlanma_yüzdesi': 'tamamlanma_yuzdesi',
    'enerji_alınan_direk_no': 'enerji_alinan_direk_no',
    'enerji_alinan_direk_no': 'enerji_alinan_direk_no',
    'kesinti_ihtiyacı': 'kesinti_ihtiyaci',
    'kesinti_ihtiyaci': 'kesinti_ihtiyaci',
    'abone_kablosu_metre': 'abone_kablosu_metre',
    'İzinler': 'izinler',
    'İl': 'il',
    'İlçe': 'ilce',
    'proje_adı': 'proje_adi',
    'proje_adi': 'proje_adi',
    'proje_tipı': 'proje_tipi',
    'müşteri_adı': 'musteri_adi',
    'musteri_adi': 'musteri_adi',
    'ek_bilgiler': 'ek_bilgiler',
    'öncelık': 'oncelik',
    'kazı_izni': 'kazi_izni',
    'karayolları': 'karayollari',
    'diğer': 'diger',
    'müvafakatname': 'muvafakatname',
  };

  const normalized = {};
  for (const [key, val] of Object.entries(result)) {
    const ascii = key.toLowerCase()
      .replace(/İ/gi, 'i').replace(/ı/g, 'i')
      .replace(/ş/g, 's').replace(/Ş/g, 's')
      .replace(/ğ/g, 'g').replace(/Ğ/g, 'g')
      .replace(/ü/g, 'u').replace(/Ü/g, 'u')
      .replace(/ö/g, 'o').replace(/Ö/g, 'o')
      .replace(/ç/g, 'c').replace(/Ç/g, 'c');
    const mappedKey = keyMap[key] || keyMap[ascii] || ascii;
    // İzinler objesi içindeki key'leri de normalize et
    if (mappedKey === 'izinler' && val && typeof val === 'object' && !Array.isArray(val)) {
      const normIzinler = {};
      for (const [ik, iv] of Object.entries(val)) {
        const ikAscii = ik.toLowerCase()
          .replace(/İ/gi, 'i').replace(/ı/g, 'i')
          .replace(/ş/g, 's').replace(/Ş/g, 's')
          .replace(/ğ/g, 'g').replace(/Ğ/g, 'g')
          .replace(/ü/g, 'u').replace(/Ü/g, 'u')
          .replace(/ö/g, 'o').replace(/Ö/g, 'o')
          .replace(/ç/g, 'c').replace(/Ç/g, 'c');
        const mappedIk = keyMap[ik] || keyMap[ikAscii] || ikAscii;
        normIzinler[mappedIk] = iv;
      }
      normalized[mappedKey] = normIzinler;
    } else {
      normalized[mappedKey] = val;
    }
  }
  return normalized;
}

// AI sonucundaki adres alanından il/ilçe/mahalle/ada_parsel alanlarını ayrıştır
function postProcessResult(result) {
  if (!result || result.parse_error) return result;

  // Türkçe key normalizasyonu
  result = normalizeKeys(result);

  const adres = result.adres || '';
  if (!adres) return result;

  // Ada/Parsel pattern: "Ada/Parsel: 984/4" veya "984/4" gibi
  if (!result.ada_parsel) {
    const adaMatch = adres.match(/(?:ada\s*[\/\\]\s*parsel\s*[:=]?\s*)([\d]+\s*[\/\\]\s*[\d]+)/i);
    if (adaMatch) {
      result.ada_parsel = adaMatch[1].replace(/\s/g, '');
    }
  }

  // Adres'i virgül veya boşlukla ayrılmış parçalara böl
  const parcalar = adres.split(/[,،]\s*/).map(p => p.trim()).filter(Boolean);
  if (parcalar.length < 2) return result;

  // Türkiye il listesi (yaygın olanlar)
  const iller = [
    'ADANA','ADIYAMAN','AFYON','AFYONKARAHISAR','AGRI','AĞRI','AKSARAY','AMASYA','ANKARA','ANTALYA',
    'ARDAHAN','ARTVIN','AYDIN','BALIKESIR','BARTIN','BATMAN','BAYBURT','BILECIK','BINGOL','BİNGÖL',
    'BITLIS','BİTLİS','BOLU','BURDUR','BURSA','CANAKKALE','ÇANAKKALE','CANKIRI','ÇANKIRI','CORUM',
    'ÇORUM','DENIZLI','DENİZLİ','DIYARBAKIR','DİYARBAKIR','DUZCE','DÜZCE','EDIRNE','ELAZIG','ELÂZIĞ',
    'ERZINCAN','ERZİNCAN','ERZURUM','ESKISEHIR','ESKİŞEHİR','GAZIANTEP','GAZİANTEP','GIRESUN','GİRESUN',
    'GUMUSHANE','GÜMÜŞHANE','HAKKARI','HAKKARİ','HATAY','IGDIR','IĞDIR','ISPARTA','ISTANBUL','İSTANBUL',
    'IZMIR','İZMİR','KAHRAMANMARAS','KAHRAMANMARAŞ','KARABUK','KARABÜK','KARAMAN','KARS','KASTAMONU',
    'KAYSERI','KAYSERİ','KIRIKKALE','KIRKLARELI','KIRŞEHIR','KIRSEHIR','KILIS','KİLİS','KOCAELI','KOCAELİ',
    'KONYA','KUTAHYA','KÜTAHYA','MALATYA','MANISA','MANİSA','MARDIN','MARDİN','MERSIN','MERSİN',
    'MUGLA','MUĞLA','MUS','MUŞ','NEVSEHIR','NEVŞEHİR','NIGDE','NİĞDE','ORDU','OSMANIYE','OSMANİYE',
    'RIZE','RİZE','SAKARYA','SAMSUN','SANLIURFA','ŞANLIURFA','SIIRT','SİİRT','SINOP','SİNOP','SIRNAK',
    'ŞIRNAK','SIVAS','SİVAS','TEKIRDAG','TEKİRDAĞ','TOKAT','TRABZON','TUNCELI','TUNCELİ','USAK',
    'UŞAK','VAN','YALOVA','YOZGAT','ZONGULDAK'
  ];

  const temizle = (s) => s.toUpperCase().replace(/İ/g,'I').replace(/Ş/g,'S').replace(/Ğ/g,'G').replace(/Ü/g,'U').replace(/Ö/g,'O').replace(/Ç/g,'C');

  const eslenenParcalar = new Set();

  // İl tespiti
  if (!result.il) {
    for (let i = 0; i < parcalar.length; i++) {
      const p = parcalar[i].replace(/^il\s*[:=]?\s*/i, '').trim();
      const pNorm = temizle(p);
      if (iller.some(il => temizle(il) === pNorm)) {
        result.il = p;
        eslenenParcalar.add(i);
        break;
      }
    }
  }

  // İlçe tespiti - il'den sonraki parça veya "İlçe:" etiketi
  if (!result.ilce) {
    for (let i = 0; i < parcalar.length; i++) {
      if (eslenenParcalar.has(i)) continue;
      const ilceMatch = parcalar[i].match(/^(?:ilce|ilçe)\s*[:=]?\s*(.+)/i);
      if (ilceMatch) {
        result.ilce = ilceMatch[1].trim();
        eslenenParcalar.add(i);
        break;
      }
    }
    // İl bulunduysa ve ilçe hala boşsa, il'den hemen sonraki parçayı ilçe olarak al
    if (!result.ilce && result.il) {
      for (let i = 0; i < parcalar.length; i++) {
        if (eslenenParcalar.has(i)) continue;
        const p = parcalar[i].trim();
        // Ada/Parsel veya mahalle etiketli değilse ve il değilse
        if (!p.match(/ada|parsel|mah|köy|sok|cad|no\s*[:=]/i) && temizle(p) !== temizle(result.il)) {
          result.ilce = p;
          eslenenParcalar.add(i);
          break;
        }
      }
    }
  }

  // Mahalle tespiti
  if (!result.mahalle) {
    for (let i = 0; i < parcalar.length; i++) {
      if (eslenenParcalar.has(i)) continue;
      const mahMatch = parcalar[i].match(/^(?:mah(?:alle)?|mh|köy)\s*[.\/:]?\s*(.+)/i);
      if (mahMatch) {
        result.mahalle = mahMatch[1].trim();
        eslenenParcalar.add(i);
        break;
      }
    }
  }

  // Ada/Parsel tespiti (adres içinden)
  if (!result.ada_parsel) {
    for (let i = 0; i < parcalar.length; i++) {
      if (eslenenParcalar.has(i)) continue;
      const apMatch = parcalar[i].match(/(?:ada\s*[\/\\]\s*(?:parsel|pafta))\s*[:=]?\s*([\d]+\s*[\/\\]\s*[\d]+)/i);
      if (apMatch) {
        result.ada_parsel = apMatch[1].replace(/\s/g, '');
        eslenenParcalar.add(i);
        break;
      }
    }
  }

  // Adres alanını olduğu gibi bırak - sadece boş alanları doldur

  // Enerji alınan direk no: notlardan veya direk_listesinden çıkar
  if (!result.enerji_alinan_direk_no) {
    const notlar = result.notlar || '';
    // "DR5568387 (enerji alınan direk)" gibi pattern
    const direkMatch = notlar.match(/([A-Z0-9-]+)\s*\(?\s*enerji\s+al[ıi]nan\s+dire[kğ]/i);
    if (direkMatch) {
      result.enerji_alinan_direk_no = direkMatch[1].trim();
    }
    // direk_listesinde "enerji alınan" notu olan direği bul
    if (!result.enerji_alinan_direk_no && Array.isArray(result.direk_listesi)) {
      const enerjiDirek = result.direk_listesi.find(d =>
        (d.notlar || '').toLowerCase().includes('enerji') || (d.notlar || '').toLowerCase().includes('besleme')
      );
      if (enerjiDirek) {
        result.enerji_alinan_direk_no = enerjiDirek.kisa_adi;
      }
    }
  }

  return result;
}

// POST /api/yer-teslim/parse - Yer teslim tutanağı görselini AI ile parse et
router.post('/parse', upload.single('dosya'), async (req, res) => {
  try {
    if (!req.file) return hata(res, 'Dosya yüklenmedi');

    const imageBase64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';
    const prompt = yerTeslimPrompt.buildPrompt();

    console.log(`[YerTeslim] Dosya: ${req.file.originalname}, MIME: ${mimeType}, Boyut: ${(req.file.size / 1024).toFixed(0)}KB, Base64: ${(imageBase64.length / 1024).toFixed(0)}KB`);

    // Provider seçimi: ollama (yerel) veya cloud
    const provider = config.ai.katman3.provider();
    console.log(`[YerTeslim] Provider: ${provider}`);
    let result = null;

    if (provider === 'ollama') {
      const baseUrl = config.ai.katman2.baseUrl();
      const model = config.ai.katman2.model();
      console.log(`[YerTeslim] Ollama model: ${model}, url: ${baseUrl}`);
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: 'Bu yer teslim tutanagi gorselini analiz et ve JSON olarak don.', images: [imageBase64] }
          ],
          stream: false,
          options: { temperature: 0.1, num_predict: 8192 },
          format: 'json'
        }),
        signal: AbortSignal.timeout(config.ai.katman2.timeout || 120000)
      });
      if (!response.ok) {
        const errText = await response.text();
        return hata(res, `Ollama API hata (${response.status}): ${errText.slice(0, 200)}`, 500);
      }
      const data = await response.json();
      const text = data.message?.content || '';
      console.log(`[YerTeslim] Ollama yanıt uzunluğu: ${text.length} karakter`);
      const cleaned = text.replace(/```json|```/g, '').trim();
      try {
        result = JSON.parse(cleaned);
        console.log(`[YerTeslim] JSON parse başarılı`);
      } catch (parseErr) {
        console.error(`[YerTeslim] JSON parse hatası:`, parseErr.message);
        result = { raw_text: text, parse_error: true };
      }
    } else if (provider === 'claude') {
      const apiKey = config.ai.katman3.claude.apiKey();
      if (!apiKey) return hata(res, 'Claude API anahtarı ayarlanmamış. Ayarlar > AI bölümünden ekleyin.', 400);

      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });
      console.log(`[YerTeslim] Claude model: ${config.ai.katman3.claude.model}`);
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
      console.log(`[YerTeslim] Claude yanıt uzunluğu: ${text.length} karakter`);
      const cleaned = text.replace(/```json|```/g, '').trim();
      try {
        result = JSON.parse(cleaned);
        console.log(`[YerTeslim] JSON parse başarılı`);
      } catch (parseErr) {
        console.error(`[YerTeslim] JSON parse hatası:`, parseErr.message);
        console.error(`[YerTeslim] Ham yanıt (ilk 500):`, text.slice(0, 500));
        result = { raw_text: text, parse_error: true };
      }
    } else if (provider === 'gemini') {
      const { getDb } = require('../db/database');
      const db = getDb();
      const apiKey = db.prepare("SELECT deger FROM firma_ayarlari WHERE anahtar = 'gemini_api_key'").get()?.deger;
      if (!apiKey) return hata(res, 'Gemini API anahtarı ayarlanmamış. Ayarlar > AI bölümünden ekleyin.', 400);

      const model = 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const body = JSON.stringify({
        system_instruction: { parts: [{ text: prompt }] },
        contents: [{ role: 'user', parts: [
          { text: 'Bu yer teslim tutanagi gorselini analiz et ve JSON olarak don.' },
          { inline_data: { mime_type: mimeType, data: imageBase64 } }
        ]}],
        generationConfig: { temperature: 0.1, maxOutputTokens: 16384, responseMimeType: 'application/json' }
      });

      // Rate limit retry mekanizması (maks 3 deneme)
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
          // Retry-After header veya hata mesajından bekleme süresini al
          const retryMatch = (data.error?.message || '').match(/retry in ([\d.]+)s/i);
          const beklemeSn = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 1 : 30;
          console.log(`Gemini rate limit - ${beklemeSn}sn bekleniyor (deneme ${attempt}/3)...`);
          await new Promise(r => setTimeout(r, beklemeSn * 1000));
          continue;
        }
        break;
      }

      if (!response.ok) {
        const errMsg = data.error?.message || `HTTP ${response.status}`;
        console.error(`[YerTeslim] Gemini API hata:`, errMsg);
        return hata(res, `Gemini API hata: ${errMsg}`, 500);
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log(`[YerTeslim] Gemini yanıt uzunluğu: ${text.length} karakter`);
      if (!text) {
        console.error(`[YerTeslim] Gemini boş yanıt döndü. finishReason:`, data.candidates?.[0]?.finishReason);
        console.error(`[YerTeslim] Gemini full response:`, JSON.stringify(data).slice(0, 1000));
      }
      const cleaned = text.replace(/```json|```/g, '').trim();
      try {
        result = JSON.parse(cleaned);
        console.log(`[YerTeslim] JSON parse başarılı`);
      } catch (parseErr) {
        console.error(`[YerTeslim] JSON parse hatası:`, parseErr.message);
        console.error(`[YerTeslim] Ham yanıt (ilk 500):`, text.slice(0, 500));
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

    // AI alanları doğru ayırmamışsa adres'ten il/ilçe/ada_parsel çıkar
    if (result && !result.parse_error) {
      result = postProcessResult(result);
    }

    basarili(res, result);
  } catch (err) {
    console.error('[YerTeslim] HATA:', err.message);
    if (err.status) console.error('[YerTeslim] HTTP Status:', err.status);
    if (err.error) console.error('[YerTeslim] Error details:', JSON.stringify(err.error).slice(0, 500));
    console.error('[YerTeslim] Stack:', err.stack?.split('\n').slice(0, 3).join('\n'));
    hata(res, err.message || 'AI analizi sırasında hata oluştu', 500);
  }
});

module.exports = router;
