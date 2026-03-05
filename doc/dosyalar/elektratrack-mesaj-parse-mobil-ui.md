# ElektraTrack — Doğal Dil Mesaj Parse + Mobil Saha UI

## Amaç

Saha ekiplerinin doğal Türkçe ile yazdığı mesajları AI ile parse edip sisteme kaydetmek.  
Mesajlar Telegram'dan veya mobil web arayüzünden (PWA) gönderilebilir.  
iPhone/Android'den geliştirme aşamasında bile test edilebilir.

**Gerçek mesaj örnekleri:**
```
"yukarıElmaya 2 tane 12I direk 70lik alpek gerek"
"23 tane 10I direk"
"salı günü üniversite işi için acil enerji kesintisi lazım"
"bugün 4 kişi bafrada kablo çektik 350m 95lik acsr kullandık"
"3 nolu direğe konsol taktık, izolatörler takılacak"
"yarın sabah 08:00'de enerji kesilecek, merkez mah trafo çıkışı"
```

---

## Adım 1 — AI Provider Seçimi

### Önerilen: Claude Haiku API (Cloud)

| Kriter | Claude Haiku | Ollama 3B (Lokal) |
|--------|-------------|-------------------|
| RAM kullanımı | 0 (cloud) | ~2.5 GB |
| Hız | 1-2 sn | 3-8 sn |
| Türkçe kalitesi | Çok iyi | Orta |
| Elektrik jargonu | Çok iyi | Orta-zayıf |
| Maliyet | ~₺0.10/mesaj | Ücretsiz |
| Aylık (50 mesaj/gün) | ~₺150/ay | ₺0 |
| Bilgisayar yükü | Sıfır | CPU yükü |
| İnternet gerekli | Evet | Hayır |

> **Karar:** Geliştirme ve ilk kullanımda **Claude Haiku** kullan.  
> Günde 50 mesaj × 30 gün = 1500 mesaj/ay ≈ ₺150/ay.  
> Bilgisayarına ek yük binmez, Türkçe elektrik jargonunu çok iyi anlar.  
> İnternet yoksa fallback olarak Ollama 3B eklenebilir (ileride).

### Paket Kurulumu

```bash
cd server
npm install @anthropic-ai/sdk
```

### API Key

Anthropic Console'dan (console.anthropic.com) API key al.  
Ayarlar sayfasındaki "Telegram & AI" tabından `claude_api_key` alanına gir.  
Veya `.env` dosyasına:

```env
CLAUDE_API_KEY=sk-ant-api03-...
```

---

## Adım 2 — Mesaj Parse Servisi

### `server/services/mesajParseService.js`

```javascript
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
// Türkçe elektrik dağıtım jargonu ile eğitilmiş prompt
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

    // Bugünün tarihini prompt'a ekle
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

  // Her işlemi ayrı kayıt olarak veritabanına yaz
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
        gonderenBilgisi.kaynak || 'mobil',     // 'mobil' veya 'telegram'
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
```

---

## Adım 3 — Veritabanı: Saha Mesajları Tablosu

```sql
-- ============================================
-- SAHA MESAJLARI
-- Doğal dil ile gönderilen saha mesajları ve AI parse sonuçları
-- ============================================
CREATE TABLE IF NOT EXISTS saha_mesajlari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gonderen_id INTEGER,                     -- personel.id
    gonderen_tipi TEXT DEFAULT 'personel',   -- 'personel', 'koordinator'
    kaynak TEXT DEFAULT 'mobil',             -- 'mobil', 'telegram', 'web'

    ham_mesaj TEXT NOT NULL,                 -- Orijinal mesaj metni
    islem_tipi TEXT,                         -- AI'ın belirlediği tip
    islem_detay TEXT,                        -- JSON: parse edilmiş detay
    konum TEXT,                              -- Konum/bölge adı
    proje_no TEXT,                           -- İlişkilendirilen proje

    guven_skoru REAL,                        -- AI güven skoru (0-1)
    ai_model TEXT,                           -- Kullanılan model
    ai_sure_ms INTEGER,                     -- Parse süresi
    ai_token_input INTEGER,                 -- Kullanılan input token
    ai_token_output INTEGER,                -- Kullanılan output token

    durum TEXT DEFAULT 'beklemede',
    -- 'beklemede'     → Parse edildi, onay bekliyor
    -- 'onaylandi'     → Koordinatör onayladı
    -- 'islendi'       → Sisteme işlendi (malzeme talebi oluşturuldu vb.)
    -- 'reddedildi'    → Koordinatör reddetti
    -- 'hata'          → Parse hatası

    onaylayan_id INTEGER,                   -- Onaylayan koordinatör
    onay_tarihi DATETIME,
    duzeltme_notu TEXT,                     -- Koordinatör düzeltmesi

    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (gonderen_id) REFERENCES personel(id),
    FOREIGN KEY (onaylayan_id) REFERENCES personel(id)
);

CREATE INDEX IF NOT EXISTS idx_saha_mesaj_tip ON saha_mesajlari(islem_tipi);
CREATE INDEX IF NOT EXISTS idx_saha_mesaj_durum ON saha_mesajlari(durum);
CREATE INDEX IF NOT EXISTS idx_saha_mesaj_tarih ON saha_mesajlari(olusturma_tarihi);
CREATE INDEX IF NOT EXISTS idx_saha_mesaj_gonderen ON saha_mesajlari(gonderen_id);
```

---

## Adım 4 — Backend API

### `server/routes/mesaj.js`

```javascript
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { parseMesaj, parseVeKaydet } = require('../services/mesajParseService');

// ─────────────────────────────────────────────────────────
// POST /api/mesaj/gonder — Mesaj gönder + AI parse + kaydet
// Hem Telegram hem mobil UI bu endpoint'i kullanır
// ─────────────────────────────────────────────────────────
router.post('/gonder', async (req, res) => {
  try {
    const { mesaj, personel_id, kaynak } = req.body;

    if (!mesaj || mesaj.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Mesaj boş olamaz'
      });
    }

    const sonuc = await parseVeKaydet(mesaj.trim(), {
      personel_id: personel_id || null,
      kaynak: kaynak || 'mobil'
    });

    res.json({
      success: true,
      data: {
        parse: sonuc.parse,
        kaydedilenler: sonuc.kaydedilenler,
        meta: sonuc.meta
      }
    });
  } catch (error) {
    console.error('Mesaj gönderme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/mesaj/test-parse — Sadece parse et, kaydetme
// Geliştirme ve test amaçlı
// ─────────────────────────────────────────────────────────
router.post('/test-parse', async (req, res) => {
  try {
    const { mesaj } = req.body;

    if (!mesaj) {
      return res.status(400).json({ success: false, error: 'Mesaj gerekli' });
    }

    const sonuc = await parseMesaj(mesaj.trim());
    res.json(sonuc);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/mesaj/gecmis — Mesaj geçmişi (mobil UI için)
// ─────────────────────────────────────────────────────────
router.get('/gecmis', (req, res) => {
  try {
    const db = getDb();
    const { personel_id, limit, offset } = req.query;

    let where = [];
    let params = [];

    if (personel_id) {
      where.push('sm.gonderen_id = ?');
      params.push(personel_id);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const mesajlar = db.prepare(`
      SELECT 
        sm.id,
        sm.ham_mesaj,
        sm.islem_tipi,
        sm.islem_detay,
        sm.konum,
        sm.proje_no,
        sm.guven_skoru,
        sm.durum,
        sm.kaynak,
        sm.olusturma_tarihi,
        p.ad_soyad AS gonderen_adi
      FROM saha_mesajlari sm
      LEFT JOIN personel p ON sm.gonderen_id = p.id
      ${whereClause}
      ORDER BY sm.olusturma_tarihi DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit) || 50, parseInt(offset) || 0);

    res.json({ success: true, data: mesajlar });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────
// PUT /api/mesaj/:id/onayla — Koordinatör mesaj onayı
// ─────────────────────────────────────────────────────────
router.put('/:id/onayla', (req, res) => {
  try {
    const db = getDb();
    const { durum, duzeltme_notu, onaylayan_id } = req.body;
    // durum: 'onaylandi' | 'reddedildi'

    db.prepare(`
      UPDATE saha_mesajlari SET
        durum = ?,
        onaylayan_id = ?,
        onay_tarihi = datetime('now'),
        duzeltme_notu = ?
      WHERE id = ?
    `).run(
      durum || 'onaylandi',
      onaylayan_id || null,
      duzeltme_notu || null,
      req.params.id
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

### Route Kaydı

`server/server.js`'e ekle:

```javascript
const mesajRoutes = require('./routes/mesaj');
app.use('/api/mesaj', mesajRoutes);
```

---

## Adım 5 — Mobil Saha UI (PWA Mesaj Ekranı)

### Sidebar'a Menü Ekle

```javascript
{
  label: 'Saha Mesaj',
  icon: '💬',        // veya ChatBubbleIcon
  path: '/saha-mesaj',
}
```

### Route Tanımı

```jsx
import SahaMesajPage from './pages/SahaMesajPage';
<Route path="/saha-mesaj" element={<SahaMesajPage />} />
```

### `client/src/pages/SahaMesajPage.jsx`

```jsx
import React, { useState, useEffect, useRef } from 'react';

// ─── İŞLEM TİPİ ETİKETLERİ ─────────────────────────────
const ISLEM_TIPLERI = {
  malzeme_talep:    { ikon: '📦', renk: '#2563eb', etiket: 'Malzeme Talebi' },
  malzeme_kullanim: { ikon: '🔧', renk: '#16a34a', etiket: 'Malzeme Kullanım' },
  gunluk_rapor:     { ikon: '📊', renk: '#0891b2', etiket: 'Günlük Rapor' },
  enerji_kesintisi: { ikon: '⚡', renk: '#ea580c', etiket: 'Enerji Kesintisi' },
  ariza_bildirim:   { ikon: '🚨', renk: '#dc2626', etiket: 'Arıza Bildirim' },
  ilerleme_notu:    { ikon: '📝', renk: '#9333ea', etiket: 'İlerleme Notu' },
  genel_not:        { ikon: '💬', renk: '#6b7280', etiket: 'Genel Not' },
};

function getTipBilgisi(tip) {
  return ISLEM_TIPLERI[tip] || ISLEM_TIPLERI.genel_not;
}

// ─── PARSE SONUÇ KARTI ─────────────────────────────────
function ParseSonucKarti({ islem }) {
  const tipBilgisi = getTipBilgisi(islem.tip);
  const detay = islem.detay || {};

  return (
    <div style={{
      background: '#f8fafc',
      border: `1px solid ${tipBilgisi.renk}30`,
      borderLeft: `4px solid ${tipBilgisi.renk}`,
      borderRadius: '8px',
      padding: '10px 12px',
      marginTop: '8px',
      fontSize: '13px',
    }}>
      {/* Tip etiketi */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: `${tipBilgisi.renk}15`,
        color: tipBilgisi.renk,
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '12px',
        fontWeight: 600,
        marginBottom: '6px',
      }}>
        {tipBilgisi.ikon} {tipBilgisi.etiket}
      </div>

      {/* Konum */}
      {islem.konum && (
        <div style={{ marginTop: '4px' }}>
          📍 <strong>{islem.konum}</strong>
        </div>
      )}

      {/* Malzeme listesi */}
      {detay.malzemeler && detay.malzemeler.length > 0 && (
        <div style={{ marginTop: '6px' }}>
          {detay.malzemeler.map((m, i) => (
            <div key={i} style={{ padding: '2px 0' }}>
              • {m.miktar && `${m.miktar} ${m.birim || 'adet'}`} <strong>{m.ad}</strong>
              {m.kesit_mm2 && ` ${m.kesit_mm2}mm²`}
              {m.boy_m && ` ${m.boy_m}m`}
              {m.tip && ` (${m.tip})`}
            </div>
          ))}
        </div>
      )}

      {/* Günlük rapor */}
      {detay.kisi_sayisi && (
        <div style={{ marginTop: '4px' }}>
          👥 {detay.kisi_sayisi} kişi
          {detay.yapilan_is && ` — ${detay.yapilan_is}`}
        </div>
      )}
      {detay.detay && islem.tip === 'gunluk_rapor' && (
        <div style={{ marginTop: '2px', color: '#4b5563' }}>{detay.detay}</div>
      )}

      {/* Enerji kesintisi */}
      {islem.tip === 'enerji_kesintisi' && (
        <>
          {detay.tarih && <div style={{ marginTop: '4px' }}>📅 {detay.tarih} {detay.baslama_saati || ''}</div>}
          {detay.sebep && <div>Sebep: {detay.sebep}</div>}
          {detay.adres && <div>📍 {detay.adres}</div>}
        </>
      )}

      {/* İlerleme notu */}
      {islem.tip === 'ilerleme_notu' && (
        <>
          {detay.aciklama && <div style={{ marginTop: '4px' }}>{detay.aciklama}</div>}
          {detay.tamamlanan && <div style={{ color: '#16a34a' }}>✅ {detay.tamamlanan}</div>}
          {detay.siradaki && <div style={{ color: '#ea580c' }}>⏭️ {detay.siradaki}</div>}
        </>
      )}

      {/* Aciliyet */}
      {detay.aciliyet === 'acil' && (
        <div style={{
          marginTop: '6px',
          color: '#dc2626',
          fontWeight: 600,
          fontSize: '12px',
        }}>
          🔴 ACİL
        </div>
      )}
    </div>
  );
}

// ─── MESAJ BALONU ────────────────────────────────────────
function MesajBalonu({ mesaj }) {
  const isKullanici = mesaj.tip === 'giden';
  const parseData = mesaj.parseData;

  return (
    <div style={{
      display: 'flex',
      justifyContent: isKullanici ? 'flex-end' : 'flex-start',
      marginBottom: '12px',
      padding: '0 12px',
    }}>
      <div style={{
        maxWidth: '85%',
        minWidth: '200px',
      }}>
        {/* Kullanıcı mesajı */}
        {isKullanici && (
          <div style={{
            background: '#2563eb',
            color: 'white',
            padding: '10px 14px',
            borderRadius: '16px 16px 4px 16px',
            fontSize: '14px',
            lineHeight: 1.4,
          }}>
            {mesaj.metin}
          </div>
        )}

        {/* Sistem yanıtı (parse sonucu) */}
        {!isKullanici && parseData && (
          <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            padding: '10px 14px',
            borderRadius: '16px 16px 16px 4px',
          }}>
            {/* Başarılı parse */}
            {parseData.islemler && parseData.islemler.map((islem, i) => (
              <ParseSonucKarti key={i} islem={islem} />
            ))}

            {/* Anlaşılamayan kısım */}
            {parseData.anlasilamayan && (
              <div style={{
                marginTop: '8px',
                padding: '6px 10px',
                background: '#fef3c7',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#92400e',
              }}>
                ⚠️ Anlaşılamayan: {parseData.anlasilamayan}
              </div>
            )}

            {/* Güven skoru */}
            {parseData.guven_skoru != null && (
              <div style={{
                marginTop: '6px',
                fontSize: '11px',
                color: '#9ca3af',
                textAlign: 'right',
              }}>
                Güven: %{Math.round(parseData.guven_skoru * 100)}
              </div>
            )}
          </div>
        )}

        {/* Hata durumu */}
        {!isKullanici && mesaj.hata && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            padding: '10px 14px',
            borderRadius: '16px 16px 16px 4px',
            color: '#991b1b',
            fontSize: '13px',
          }}>
            ❌ {mesaj.hata}
          </div>
        )}

        {/* Zaman */}
        <div style={{
          fontSize: '11px',
          color: '#9ca3af',
          marginTop: '4px',
          textAlign: isKullanici ? 'right' : 'left',
        }}>
          {mesaj.zaman}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ANA SAYFA
// ═══════════════════════════════════════════════════════════
export default function SahaMesajPage() {
  const [mesajlar, setMesajlar] = useState([]);
  const [girdi, setGirdi] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const mesajListeRef = useRef(null);
  const inputRef = useRef(null);

  // Geçmiş mesajları yükle
  useEffect(() => {
    const yukle = async () => {
      try {
        const res = await fetch('/api/mesaj/gecmis?limit=30');
        const json = await res.json();
        if (json.success && json.data.length > 0) {
          const gecmis = json.data.reverse().flatMap(m => {
            const items = [];
            // Kullanıcı mesajı
            items.push({
              id: `giden-${m.id}`,
              tip: 'giden',
              metin: m.ham_mesaj,
              zaman: new Date(m.olusturma_tarihi).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            });
            // Sistem yanıtı
            items.push({
              id: `gelen-${m.id}`,
              tip: 'gelen',
              parseData: {
                islemler: [{
                  tip: m.islem_tipi,
                  konum: m.konum,
                  proje_no: m.proje_no,
                  detay: m.islem_detay ? JSON.parse(m.islem_detay) : null
                }],
                guven_skoru: m.guven_skoru
              },
              zaman: new Date(m.olusturma_tarihi).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            });
            return items;
          });
          setMesajlar(gecmis);
        }
      } catch (err) {
        console.error('Geçmiş yükleme hatası:', err);
      }
    };
    yukle();
  }, []);

  // Yeni mesaj geldiğinde en alta scroll
  useEffect(() => {
    if (mesajListeRef.current) {
      mesajListeRef.current.scrollTop = mesajListeRef.current.scrollHeight;
    }
  }, [mesajlar]);

  // Mesaj gönder
  const mesajGonder = async () => {
    const metin = girdi.trim();
    if (!metin || gonderiliyor) return;

    const simdi = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    // Kullanıcı mesajını hemen göster
    const kullaniciMesaj = {
      id: `giden-${Date.now()}`,
      tip: 'giden',
      metin: metin,
      zaman: simdi,
    };

    setMesajlar(prev => [...prev, kullaniciMesaj]);
    setGirdi('');
    setGonderiliyor(true);

    try {
      const res = await fetch('/api/mesaj/gonder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesaj: metin,
          kaynak: 'mobil'
        })
      });

      const json = await res.json();

      const sistemYaniti = {
        id: `gelen-${Date.now()}`,
        tip: 'gelen',
        parseData: json.success ? json.data.parse : null,
        hata: json.success ? null : (json.error || 'Parse hatası'),
        zaman: simdi,
      };

      setMesajlar(prev => [...prev, sistemYaniti]);
    } catch (error) {
      setMesajlar(prev => [...prev, {
        id: `hata-${Date.now()}`,
        tip: 'gelen',
        hata: 'Sunucuya bağlanılamadı',
        zaman: simdi,
      }]);
    } finally {
      setGonderiliyor(false);
      // Mobilde input'a focus geri ver
      inputRef.current?.focus();
    }
  };

  // Enter ile gönder
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      mesajGonder();
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      maxWidth: '768px',       // Mobilde tam genişlik, masaüstünde ortalanmış
      margin: '0 auto',
      background: '#f9fafb',
    }}>

      {/* ─── BAŞLIK ──────────────────────────────── */}
      <div style={{
        padding: '12px 16px',
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
            💬 Saha Mesaj
          </h1>
          <p style={{ margin: '2px 0 0', color: '#6b7280', fontSize: '12px' }}>
            Doğal dille mesaj gönderin, AI otomatik sınıflandırsın
          </p>
        </div>
      </div>

      {/* ─── MESAJ LİSTESİ ───────────────────────── */}
      <div
        ref={mesajListeRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 0',
          // iOS momentum scroll
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Boş durum */}
        {mesajlar.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#9ca3af',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>💬</div>
            <p style={{ fontSize: '14px', margin: '0 0 16px' }}>
              Saha mesajlarınızı doğal dille yazın
            </p>
            <div style={{
              textAlign: 'left',
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '16px',
              maxWidth: '320px',
              margin: '0 auto',
              fontSize: '13px',
              lineHeight: 1.6,
            }}>
              <strong>Örnek mesajlar:</strong><br/>
              📦 "2 tane 12I direk ve 70lik alpek lazım"<br/>
              📊 "Bugün 4 kişi 350m kablo çektik"<br/>
              ⚡ "Salı günü acil enerji kesintisi lazım"<br/>
              📝 "3 nolu direğe konsol taktık"<br/>
              🚨 "Bafra hattında izolatör kırıldı"
            </div>
          </div>
        )}

        {/* Mesaj balonları */}
        {mesajlar.map(mesaj => (
          <MesajBalonu key={mesaj.id} mesaj={mesaj} />
        ))}

        {/* Yazıyor göstergesi */}
        {gonderiliyor && (
          <div style={{
            padding: '8px 24px',
            color: '#9ca3af',
            fontSize: '13px',
          }}>
            🤖 Analiz ediliyor...
          </div>
        )}
      </div>

      {/* ─── MESAJ GİRİŞ ALANI ──────────────────── */}
      <div style={{
        padding: '12px 12px',
        background: 'white',
        borderTop: '1px solid #e5e7eb',
        // iOS safe area (alt çentik)
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
      }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end',
        }}>
          <textarea
            ref={inputRef}
            value={girdi}
            onChange={(e) => setGirdi(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Mesajınızı yazın..."
            rows={1}
            style={{
              flex: 1,
              padding: '10px 14px',
              border: '1px solid #d1d5db',
              borderRadius: '20px',
              fontSize: '15px',
              resize: 'none',
              outline: 'none',
              maxHeight: '100px',
              lineHeight: 1.4,
              fontFamily: 'inherit',
            }}
            onInput={(e) => {
              // Auto-resize textarea
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
            }}
          />
          <button
            onClick={mesajGonder}
            disabled={!girdi.trim() || gonderiliyor}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              border: 'none',
              background: girdi.trim() && !gonderiliyor ? '#2563eb' : '#d1d5db',
              color: 'white',
              fontSize: '18px',
              cursor: girdi.trim() && !gonderiliyor ? 'pointer' : 'default',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
          >
            {gonderiliyor ? '⏳' : '➤'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Adım 6 — Vite LAN Erişimi (iPhone'dan Bağlanma)

### `client/vite.config.js` Güncelleme

Mevcut Vite config dosyasına `host` ve `proxy` ayarlarını ekle:

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    host: '0.0.0.0',          // ← LAN'dan erişim için (sadece localhost yerine)
    port: 5173,

    // API isteklerini backend'e yönlendir
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      }
    }
  }
});
```

> **ÖNEMLİ:** `host: '0.0.0.0'` ayarı Vite'ın sadece localhost değil, aynı WiFi'daki tüm cihazlardan erişilebilir olmasını sağlar. Geliştirme ortamında sorun olmaz.

---

## Adım 7 — PWA Manifest (Ana Ekrana Ekle)

### `client/public/manifest.json`

Eğer yoksa oluştur:

```json
{
  "name": "ElektraTrack",
  "short_name": "ElektraTrack",
  "description": "Elektrik Dağıtım Saha Takip Sistemi",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1e40af",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### `client/index.html`'e Ekle

`<head>` bölümüne:

```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#1e40af" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="ElektraTrack" />
<link rel="apple-touch-icon" href="/icon-192.png" />

<!-- Mobil viewport — zoom engellemez, doğal deneyim -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

> **İkon yoksa geçici çözüm:** İkon dosyaları (icon-192.png, icon-512.png) yoksa manifest çalışır ama ikon görünmez. İleride eklenebilir.

---

## Adım 8 — iPhone'dan Test Etme

### Ön Koşullar
- Bilgisayar ve iPhone **aynı WiFi ağında** olmalı
- Bilgisayarda sunucu (server) ve client çalışıyor olmalı

### Adım Adım

**1. Bilgisayarının yerel IP'sini öğren:**

```powershell
# Windows PowerShell
ipconfig
# "IPv4 Address" satırını bul, örn: 192.168.1.42

# Veya kısaca:
(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias Wi-Fi).IPAddress
```

**2. Sunucuları başlat:**

Terminal 1:
```bash
cd server
node server.js
# → http://localhost:4000
```

Terminal 2:
```bash
cd client
npm run dev
# → http://localhost:5173
# → Network: http://192.168.1.42:5173  ← Bu adresi kullan
```

Vite konsolunda `Network: http://192.168.1.42:5173` yazıyorsa her şey tamam.  
Yazmıyorsa `vite.config.js`'de `host: '0.0.0.0'` eklediğinden emin ol.

**3. iPhone Safari'den aç:**

```
http://192.168.1.42:5173
```

> IP adresini her seferinde yazmak yerine QR kod oluştur:  
> Chrome'da `chrome://flags/#enable-sharing-qr-code` veya herhangi bir QR oluşturucu.

**4. Ana Ekrana Ekle (isteğe bağlı):**

```
Safari → Paylaş ikonu (□↑) → "Ana Ekrana Ekle" → "Ekle"
```

Artık uygulama ana ekranda bir ikon olarak görünür, açıldığında tam ekran çalışır (adres çubuğu olmadan).

**5. Test et:**

Saha Mesaj sayfasına git ve şu mesajları dene:

```
"yukarıElmaya 2 tane 12I direk 70lik alpek gerek"
"bugün 4 kişi bafrada kablo çektik 350m 95lik acsr kullandık"
"salı günü üniversite işi için acil enerji kesintisi lazım"
"3 nolu direğe konsol taktık izolatörler takılacak"
```

---

## Beklenen Görünüm

### Mesaj Ekranı (Mobil)

```
┌────────────────────────────────────────┐
│  💬 Saha Mesaj                         │
│  Doğal dille mesaj gönderin            │
├────────────────────────────────────────┤
│                                        │
│  💬 Saha mesajlarınızı doğal dille yazın│
│                                        │
│  Örnek mesajlar:                       │
│  📦 "2 tane 12I direk ve 70lik..."    │
│  📊 "Bugün 4 kişi 350m kablo..."      │
│  ⚡ "Salı günü acil enerji..."        │
│                                        │
├────────────────────────────────────────┤
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ yukarıElmaya 2 tane 12I direk   │◄─ Kullanıcı mesajı (mavi)
│  │ 70lik alpek gerek               │  │
│  └──────────────────────────────────┘  │
│                                14:32   │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ ┌ 📦 Malzeme Talebi ──────────┐│◄─ AI parse sonucu (beyaz)
│  │ │ 📍 Yukarı Elma               ││  │
│  │ │                              ││  │
│  │ │ • 2 adet Beton direk 12m (I) ││  │
│  │ │ • ALPEK kablo 70mm²          ││  │
│  │ └─────────────────────────────┘│  │
│  │                     Güven: %87  │  │
│  └──────────────────────────────────┘  │
│  14:32                                 │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ salı günü üniversite işi için   │◄─ Kullanıcı mesajı
│  │ acil enerji kesintisi lazım     │  │
│  └──────────────────────────────────┘  │
│                                14:35   │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ ┌ ⚡ Enerji Kesintisi ─────────┐│◄─ AI parse sonucu
│  │ │ 📅 2026-02-11                ││  │
│  │ │ Sebep: Üniversite işi        ││  │
│  │ │ 🔴 ACİL                     ││  │
│  │ └─────────────────────────────┘│  │
│  └──────────────────────────────────┘  │
│  14:35                                 │
│                                        │
├────────────────────────────────────────┤
│ ┌──────────────────────────────┐ ┌──┐ │
│ │ Mesajınızı yazın...          │ │➤ │ │◄─ Giriş alanı
│ └──────────────────────────────┘ └──┘ │
└────────────────────────────────────────┘
```

---

## Kontrol Listesi

**Altyapı:**
- [ ] `npm install @anthropic-ai/sdk` — server'da çalıştırıldı
- [ ] Claude API key ayarlara girildi (firma_ayarlari veya .env)
- [ ] `saha_mesajlari` tablosu veritabanına eklendi

**Backend API:**
- [ ] `POST /api/mesaj/gonder` → Mesaj parse + kayıt çalışıyor
- [ ] `POST /api/mesaj/test-parse` → Sadece parse (kayıt yok) çalışıyor
- [ ] `GET /api/mesaj/gecmis` → Geçmiş mesajlar dönüyor
- [ ] `PUT /api/mesaj/:id/onayla` → Onay/red çalışıyor

**Mesaj Parse Testi (en az bu 5 mesajı test et):**
- [ ] `"yukarıElmaya 2 tane 12I direk 70lik alpek gerek"` → malzeme_talep
- [ ] `"bugün 4 kişi bafrada kablo çektik 350m 95lik acsr"` → gunluk_rapor + malzeme_kullanim
- [ ] `"salı günü üniversite işi için acil enerji kesintisi lazım"` → enerji_kesintisi
- [ ] `"3 nolu direğe konsol taktık izolatörler takılacak"` → ilerleme_notu
- [ ] `"23 tane 10I direk"` → malzeme_talep

**Mobil UI:**
- [ ] Sidebar'da "Saha Mesaj" menüsü var
- [ ] Mesaj girişi çalışıyor (textarea + gönder butonu)
- [ ] AI yanıtı doğru renk/ikon ile gösteriliyor
- [ ] Mesaj geçmişi yükleniyor
- [ ] Enter ile mesaj gönderilebiliyor
- [ ] Boş durum ekranı (örnek mesajlar) görünüyor

**iPhone Erişimi:**
- [ ] `vite.config.js`'de `host: '0.0.0.0'` ayarlandı
- [ ] `vite.config.js`'de `/api` proxy ayarlandı
- [ ] `manifest.json` oluşturuldu
- [ ] `index.html`'e PWA meta tagları eklendi
- [ ] iPhone Safari'den `http://<IP>:5173` açılıyor
- [ ] Mesaj gönderme iPhone'dan çalışıyor
- [ ] Ana Ekrana Ekle ile tam ekran açılıyor (opsiyonel)

---

## Windows Güvenlik Duvarı Notu

iPhone'dan bağlanamıyorsan Windows Güvenlik Duvarı portu engelliyor olabilir:

```powershell
# PowerShell'i Yönetici olarak aç ve çalıştır:
netsh advfirewall firewall add rule name="Vite Dev Server" dir=in action=allow protocol=TCP localport=5173
netsh advfirewall firewall add rule name="ElektraTrack API" dir=in action=allow protocol=TCP localport=4000
```

Bu komutlar 5173 ve 4000 portlarını LAN'dan erişime açar.

---

## İleri Aşama (Şimdi yapılmayacak)

1. **Telegram entegrasyonu** — Aynı `parseVeKaydet` fonksiyonunu Telegram handler'da da kullan
2. **Fotoğraf gönderimi** — Mobil UI'dan fotoğraf çekip mesajla birlikte gönder
3. **Konum paylaşımı** — GPS koordinatını mesajla birlikte gönder
4. **Sesli mesaj** — Whisper API ile ses → metin → parse
5. **Offline kuyruk** — İnternet yokken mesajları biriktir, gelince gönder
6. **Push notification** — Koordinatör onayı geldiğinde bildirim
7. **Ollama fallback** — İnternet yoksa lokal model ile parse
8. **Koordinatör onay UI** — Web panelinde parse sonuçlarını onayala/düzelt ekranı
