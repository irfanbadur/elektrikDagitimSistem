const Anthropic = require('@anthropic-ai/sdk').default;
const { getDb } = require('../db/database');

// ─── AI CLIENT ──────────────────────────────────────────
function getClient() {
  const db = getDb();
  const row = db.prepare(
    "SELECT deger FROM firma_ayarlari WHERE anahtar = 'claude_api_key'"
  ).get();
  const apiKey = row?.deger || process.env.CLAUDE_API_KEY;

  if (!apiKey) throw new Error('Claude API key tanımlı değil');

  return new Anthropic({ apiKey });
}

// ─── SYSTEM PROMPT ──────────────────────────────────────
const SYSTEM_PROMPT = `Sen bir elektrik dağıtım müteahhitlik firmasının saha mesaj analiz sistemisin.
Saha ekiplerinden gelen doğal Türkçe mesajları analiz edip yapılandırılmış JSON'a dönüştür.

MESAJ TİPLERİ:
1. malzeme_talep  → Malzeme istekleri
2. malzeme_kullanim → Kullanılan malzeme bildirimi
3. gunluk_rapor → Yapılan iş bildirimi (kişi sayısı, iş tanımı)
4. enerji_kesintisi → Enerji kesinti talebi
5. ariza_bildirim → Arıza/hasar bildirimi
6. ilerleme_notu → Genel ilerleme notu
7. genel_not → Sınıflandırılamayan diğer notlar

ELEKTRİK DAĞITIM JARGONU SÖZLÜĞÜ:
Direkler:
- "10I", "12I" → 10 metre / 12 metre I tipi beton direk
- "10T", "12T" → T tipi (gergi) beton direk
- "ahşap direk" → Ahşap direk
- "çelik direk" → Çelik kafes direk

İletkenler:
- "alpek", "ALPEK" → Alüminyum-Polietilen kablo (AG yeraltı)
- "70lik alpek" → 70mm² kesitli ALPEK kablo
- "acsr", "ACSR" → Alüminyum iletken çelik öz (havai hat)
- "95lik acsr" → 95mm² ACSR havai hat iletkeni
- "150lik acsr" → 150mm² ACSR
- "1x70", "3x70", "4x16" → Kesit gösterimi (damarsayısı x kesitmm²)
- "xlpe" → Çapraz bağlı polietilen kablo (yeraltı OG)
- "abc", "ABC" → Aerial Bundled Cable (AG havai paket kablo)
- "4x16 abc" → 4 damarlı 16mm² ABC kablo

Konsollar ve izolatörler:
- "L konsol", "T konsol", "V konsol" → Direk konsol tipleri
- "cam izolatör", "porselen izolatör" → İzolatör tipleri
- "U70" → U70BL tipi cam izolatör (standart OG)
- "polimer izolatör" → Silikon polimer izolatör

Genel terimler:
- "trafo" → Transformatör
- "pano" → Dağıtım panosu / ölçü panosu
- "OG" → Orta Gerilim (genelde 34.5kV)
- "AG" → Alçak Gerilim (genelde 0.4kV)
- "branşman" → Ana hattan ayrılan bağlantı
- "şalt" → Şalt sahası / anahtarlama
- "kesici" → Devre kesici
- "ayırıcı" → Yük ayırıcı
- "sigorta" → Sigorta
- "röle" → Koruma rölesi
- "topraklama" → Topraklama sistemi
- "müşteri" → Abone (bağlantı yapılacak kişi)

Bölge/konum isimleri genelde:
- Mahalle, köy, semt isimleri olabilir (ör: "yukarıElma", "merkez mah", "aşağıköy")
- Bazen bitişik yazılır: "yukarıElmaya" = "Yukarı Elma" köyüne

ÇIKIŞ FORMATI:
{
  "islemler": [
    {
      "tip": "malzeme_talep | malzeme_kullanim | gunluk_rapor | enerji_kesintisi | ariza_bildirim | ilerleme_notu | genel_not",
      "konum": "Konum/bölge adı veya null",
      "proje_no": "Varsa proje numarası (YB-xxxx, KET-xxxx) veya null",
      "detay": {
        // --- malzeme_talep ---
        "malzemeler": [
          { "ad": "Beton direk", "boy_m": 12, "tip": "I", "miktar": 2, "birim": "adet" },
          { "ad": "ALPEK kablo", "kesit_mm2": 70, "miktar": null, "birim": "metre" }
        ],
        "aciliyet": "normal | acil"

        // --- malzeme_kullanim ---
        "malzemeler": [{ "ad": "ACSR iletken", "kesit_mm2": 95, "miktar": 350, "birim": "metre" }]

        // --- gunluk_rapor ---
        "kisi_sayisi": 4,
        "yapilan_is": "Kablo çekimi",
        "detay": "350m 95mm² ACSR çekildi",
        "baslama_saati": null,
        "bitis_saati": null

        // --- enerji_kesintisi ---
        "tarih": "2026-02-11",
        "baslama_saati": "08:00",
        "bitis_saati": null,
        "sebep": "Üniversite işi",
        "adres": "Merkez mahallesi trafo çıkışı",
        "aciliyet": "acil | normal"

        // --- ariza_bildirim ---
        "aciklama": "Arıza açıklaması",
        "konum_detay": "3 nolu direk",
        "aciliyet": "acil | normal"

        // --- ilerleme_notu ---
        "aciklama": "3 nolu direğe konsol takıldı, izolatörler takılacak",
        "tamamlanan": "Konsol montajı",
        "siradaki": "İzolatör montajı"

        // --- genel_not ---
        "mesaj": "Orijinal mesaj"
      }
    }
  ],
  "ham_mesaj": "Orijinal mesaj metni",
  "guven_skoru": 0.85,
  "anlasilamayan": "Varsa anlaşılamayan kısım veya null"
}

ÖNEMLİ KURALLAR:
- Mesajda birden fazla işlem olabilir. Her birini ayrı islem olarak döndür.
- Belirsiz miktarları null yap, tahmin etme.
- Jargonu standart isimlere çevir (ör: "70lik alpek" → ad: "ALPEK kablo", kesit_mm2: 70).
- Konum isimlerini düzelt (ör: "yukarıElmaya" → "Yukarı Elma").
- Sadece JSON döndür, başka açıklama ekleme.
- Mesajın dilinden (acil, lazım, hemen) aciliyet seviyesini çıkar.
- Tarih referanslarını bugüne göre hesapla. Bugünün tarihi: {BUGUN}`;

// ─── MESAJ PARSE FONKSİYONU ────────────────────────────
async function parseMesaj(mesajMetni, opsiyonlar = {}) {
  const baslangic = Date.now();

  try {
    const client = getClient();

    const bugun = new Date().toLocaleDateString('tr-TR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const systemPrompt = SYSTEM_PROMPT.replace('{BUGUN}', bugun);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: mesajMetni }
      ]
    });

    const jsonText = response.content[0].text.trim();

    // JSON parse — bazen markdown code block ile sarmalı olabiliyor
    const temiz = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const sonuc = JSON.parse(temiz);

    const sure = Date.now() - baslangic;

    return {
      success: true,
      data: sonuc,
      meta: {
        model: 'claude-haiku-4-5-20251001',
        sure_ms: sure,
        token_kullanim: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens
        }
      }
    };
  } catch (error) {
    console.error('Mesaj parse hatası:', error);
    return {
      success: false,
      error: error.message,
      data: {
        islemler: [{
          tip: 'genel_not',
          detay: { mesaj: mesajMetni }
        }],
        ham_mesaj: mesajMetni,
        guven_skoru: 0,
        anlasilamayan: mesajMetni
      }
    };
  }
}

// ─── PARSE SONUCUNU KAYDET ─────────────────────────────
async function parseVeKaydet(mesajMetni, gonderenBilgisi = {}) {
  const parseResult = await parseMesaj(mesajMetni);

  const db = getDb();

  const kaydedilenler = [];

  if (parseResult.success && parseResult.data.islemler) {
    for (const islem of parseResult.data.islemler) {
      const kayit = db.prepare(`
        INSERT INTO saha_mesajlari (
          gonderen_id, gonderen_tipi, kaynak,
          ham_mesaj, islem_tipi, islem_detay,
          konum, proje_no, guven_skoru,
          ai_model, ai_sure_ms, ai_token_input, ai_token_output,
          durum, olusturma_tarihi
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'beklemede', datetime('now'))
      `).run(
        gonderenBilgisi.personel_id || null,
        gonderenBilgisi.tip || 'personel',
        gonderenBilgisi.kaynak || 'mobil',
        mesajMetni,
        islem.tip,
        JSON.stringify(islem.detay),
        islem.konum || null,
        islem.proje_no || null,
        parseResult.data.guven_skoru || null,
        parseResult.meta?.model || null,
        parseResult.meta?.sure_ms || null,
        parseResult.meta?.token_kullanim?.input || null,
        parseResult.meta?.token_kullanim?.output || null
      );

      kaydedilenler.push({
        id: kayit.lastInsertRowid,
        tip: islem.tip,
        detay: islem.detay,
        konum: islem.konum
      });
    }
  }

  return {
    success: parseResult.success,
    parse: parseResult.data,
    kaydedilenler,
    meta: parseResult.meta
  };
}

module.exports = { parseMesaj, parseVeKaydet };
