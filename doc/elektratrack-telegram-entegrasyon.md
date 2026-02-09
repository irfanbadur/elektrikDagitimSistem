# ElektraTrack — Telegram Bot Entegrasyonu — Geliştirme Kılavuzu

## Genel Bakış

Bu kılavuz, ElektraTrack web uygulamasının mevcut Node.js backend'ine Telegram bot entegrasyonunu kapsar. Bot, saha ekiplerinden gelen metin mesajları, fotoğraflar, konum bilgileri ve dosyaları anlayarak sisteme otomatik kayıt yapar.

**Temel Fark:** n8n gibi harici bir otomasyon aracı kullanılmaz. Telegram bot doğrudan Express sunucusuna entegre edilir ve SQLite veritabanına direkt erişir. Bu sayede ticari dağıtımda tek uygulama, tek kurulum yeterlidir.

---

## Teknoloji Eklentileri

Mevcut ElektraTrack teknoloji yığınına eklenenler:

| Paket | Amaç |
|-------|------|
| `node-telegram-bot-api` | Telegram Bot API wrapper |
| `sharp` | Fotoğraf işleme, boyutlandırma, EXIF okuma |
| `exif-reader` | Fotoğraflardan GPS/tarih metadata çıkarma |
| `uuid` | Medya dosyaları için benzersiz dosya adı |
| `node-cron` | Zamanlanmış görevler (hatırlatmalar, özetler) |
| `@anthropic-ai/sdk` | *Opsiyonel:* Claude API (Katman 3 - detaylı analiz) |

> **NOT:** Lokal AI için Ollama kullanılır. Ollama ayrı bir sistem servisi olarak çalışır, 
> Node.js tarafından `fetch` ile çağrılır. Ek npm paketi gerekmez.

```bash
cd server
npm install node-telegram-bot-api sharp exif-reader uuid node-cron

# Opsiyonel: Sadece Katman 3 (Cloud API) kullanılacaksa
npm install @anthropic-ai/sdk

# Ollama kurulumu (ayrı)
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5:7b              # Katman 1: Metin parse
ollama pull llama3.2-vision:11b     # Katman 2: Genel görsel tanıma
```

---

## Klasör Yapısı Eklentileri

Mevcut `server/` klasörüne eklenecekler:

```
server/
├── telegram/
│   ├── bot.js                    # Bot başlatma ve ana mesaj yönlendirici
│   ├── handlers/
│   │   ├── messageHandler.js     # Metin mesaj işleyici
│   │   ├── photoHandler.js       # Fotoğraf + konum işleyici
│   │   ├── locationHandler.js    # Tekil konum mesajı işleyici
│   │   ├── commandHandler.js     # /komut işleyicileri
│   │   ├── callbackHandler.js    # Inline buton callback işleyici
│   │   └── analysisHandler.js    # Fotoğraf analiz talep işleyici
│   ├── ai/
│   │   ├── aiManager.js          # 3 katmanlı AI yönlendirici (ana orkestratör)
│   │   ├── providers/
│   │   │   ├── ollamaProvider.js   # Katman 1+2: Ollama (lokal, ücretsiz)
│   │   │   └── cloudProvider.js    # Katman 3: Claude/GPT-4V (bulut, ücretli)
│   │   ├── analysis/
│   │   │   ├── poleAnalyzer.js     # Direk tepesi analiz motoru
│   │   │   ├── equipmentDetector.js # Malzeme tanıma (konsol, izolatör vb.)
│   │   │   ├── damageDetector.js   # Hasar tespit modülü
│   │   │   └── catalogMatcher.js   # Tanınan malzemeyi katalogla eşleştir
│   │   └── prompts/
│   │       ├── textParsePrompt.js    # Metin → JSON parse
│   │       ├── photoCaptionPrompt.js # Caption analizi
│   │       ├── generalVisionPrompt.js # Genel fotoğraf açıklama
│   │       ├── poleAnalysisPrompt.js  # Direk tepesi detaylı analiz
│   │       └── damageAnalysisPrompt.js # Hasar tespit analizi
│   ├── services/
│   │   ├── mediaService.js       # Fotoğraf indirme, EXIF, kaydetme
│   │   ├── dataBundleService.js  # Veri paketi oluşturma/işleme
│   │   ├── analysisService.js    # Analiz sonuçlarını kaydet/yönet
│   │   ├── notificationService.js # Bildirim gönderme
│   │   └── registrationService.js # Personel-Telegram eşleştirme
│   ├── utils/
│   │   ├── keyboards.js          # Inline/Reply keyboard tanımları
│   │   ├── messages.js           # Türkçe mesaj şablonları
│   │   └── validators.js         # Gelen veri doğrulama
│   └── config.js                 # Bot + AI yapılandırması
│
├── media/                        # Fotoğraf ve dosya deposu
│   ├── photos/                   # Orijinal fotoğraflar
│   │   └── 2025/06/15/           # Tarih bazlı klasörleme
│   ├── thumbnails/               # Küçültülmüş önizlemeler
│   ├── analysis/                 # Analiz sonuç görselleri (annotated)
│   └── documents/                # Diğer dosyalar
│
├── catalog/                      # Malzeme referans kataloğu
│   ├── catalog.json              # Ana malzeme katalog verisi
│   ├── reference-images/         # Referans fotoğraflar (eğitim için)
│   │   ├── konsol/               # Konsol tipleri referansları
│   │   ├── izolator/             # İzolatör tipleri referansları
│   │   ├── iletken/              # İletken tipleri referansları
│   │   ├── armatur/              # Armatür tipleri referansları
│   │   ├── direk/                # Direk tipleri referansları
│   │   └── pano/                 # Pano tipleri referansları
│   └── README.md                 # Katalog yapısı açıklaması
│
└── server.js                     # ← Bot + AI başlatma eklenir
```

---

## Veritabanı Şema Eklentileri

Mevcut şemaya eklenecek yeni tablolar:

```sql
-- ============================================
-- TELEGRAM KULLANICI EŞLEŞTİRME
-- ============================================
CREATE TABLE IF NOT EXISTS telegram_kullanicilar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE NOT NULL,       -- Telegram user ID
    telegram_kullanici_adi TEXT,            -- @username
    telegram_ad TEXT,                       -- Telegram'daki görünen ad
    personel_id INTEGER,                    -- Eşleştirilmiş personel
    yetki_seviyesi TEXT DEFAULT 'ekip',     -- 'ekip', 'ekip_basi', 'koordinator', 'admin'
    aktif BOOLEAN DEFAULT 1,
    kayit_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    son_mesaj_tarihi DATETIME,
    FOREIGN KEY (personel_id) REFERENCES personel(id)
);

-- ============================================
-- MEDYA / FOTOĞRAF DEPOSU
-- ============================================
CREATE TABLE IF NOT EXISTS medya (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dosya_adi TEXT NOT NULL,                 -- UUID tabanlı benzersiz dosya adı
    orijinal_adi TEXT,                       -- Orijinal dosya adı
    dosya_yolu TEXT NOT NULL,                -- Sunucudaki tam yol
    thumbnail_yolu TEXT,                     -- Küçük önizleme yolu
    dosya_tipi TEXT NOT NULL,                -- 'photo', 'video', 'document'
    mime_tipi TEXT,                          -- 'image/jpeg', 'image/png' vb.
    dosya_boyutu INTEGER,                    -- Byte cinsinden
    genislik INTEGER,                        -- Piksel (fotoğraf için)
    yukseklik INTEGER,                       -- Piksel (fotoğraf için)

    -- GPS / Konum bilgileri
    latitude REAL,                           -- Enlem (EXIF veya Telegram konum)
    longitude REAL,                          -- Boylam (EXIF veya Telegram konum)
    konum_kaynagi TEXT,                      -- 'exif', 'telegram_konum', 'manuel'
    altitude REAL,                           -- Yükseklik (EXIF varsa)

    -- Zaman bilgileri
    cekim_tarihi DATETIME,                   -- EXIF'ten alınan çekim zamanı
    yukleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- İlişkiler
    yukleyen_personel_id INTEGER,
    yukleyen_telegram_id TEXT,
    proje_id INTEGER,
    ekip_id INTEGER,
    veri_paketi_id INTEGER,                  -- Hangi veri paketine ait

    -- Açıklama
    aciklama TEXT,                            -- Fotoğraf açıklaması / not
    etiketler TEXT,                           -- JSON: ["direk", "hasar", "montaj"]
    ai_analiz TEXT,                           -- Claude'un fotoğraf analizi (opsiyonel)

    FOREIGN KEY (yukleyen_personel_id) REFERENCES personel(id),
    FOREIGN KEY (proje_id) REFERENCES projeler(id),
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id),
    FOREIGN KEY (veri_paketi_id) REFERENCES veri_paketleri(id)
);

-- ============================================
-- VERİ PAKETLERİ
-- Saha ekibi fotoğraf + konum + not gönderiyor
-- Bunlar bir "paket" olarak gruplanır
-- ============================================
CREATE TABLE IF NOT EXISTS veri_paketleri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paket_no TEXT UNIQUE,                    -- 'VP-2025-0001'
    paket_tipi TEXT NOT NULL,
    -- Paket tipleri:
    -- 'direk_tespit'       → Direk fotoğrafı + konum
    -- 'montaj_oncesi'      → Montaj öncesi durum tespiti
    -- 'montaj_sonrasi'     → Montaj sonrası tamamlanma belgesi
    -- 'hasar_tespit'       → Hasar/arıza bildirimi
    -- 'malzeme_tespit'     → Sahadaki malzeme durumu
    -- 'ilerleme_raporu'    → Genel ilerleme fotoğrafı
    -- 'guzergah_tespit'    → Kablo güzergahı tespiti
    -- 'diger'              → Diğer

    durum TEXT DEFAULT 'tamamlandi',         -- 'devam_ediyor', 'tamamlandi', 'iptal'
    -- 'devam_ediyor': Personel hâlâ fotoğraf/not ekliyor
    -- 'tamamlandi': Paket tamamlandı, sisteme işlendi
    -- 'iptal': İptal edildi

    -- İlişkiler
    personel_id INTEGER,
    ekip_id INTEGER,
    proje_id INTEGER,
    bolge_id INTEGER,

    -- Konum (paketin ana konumu)
    latitude REAL,
    longitude REAL,
    adres_metni TEXT,                        -- Ters geocoding ile alınan adres (opsiyonel)

    -- İçerik
    foto_sayisi INTEGER DEFAULT 0,
    notlar TEXT,                              -- Personelin eklediği notlar
    ai_ozet TEXT,                             -- Claude'un paket özeti

    -- Zaman
    baslama_zamani DATETIME DEFAULT CURRENT_TIMESTAMP,
    tamamlanma_zamani DATETIME,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (personel_id) REFERENCES personel(id),
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id),
    FOREIGN KEY (proje_id) REFERENCES projeler(id),
    FOREIGN KEY (bolge_id) REFERENCES bolgeler(id)
);

-- ============================================
-- TELEGRAM MESAJ LOGU
-- Gelen/giden tüm mesajların kaydı
-- ============================================
CREATE TABLE IF NOT EXISTS telegram_mesaj_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT NOT NULL,
    mesaj_tipi TEXT,                          -- 'text', 'photo', 'location', 'document', 'command'
    yon TEXT NOT NULL,                        -- 'gelen', 'giden'
    ham_mesaj TEXT,                           -- Gelen orijinal mesaj / giden mesaj
    ai_parse_sonucu TEXT,                     -- JSON: Claude'un analiz sonucu
    islem_durumu TEXT DEFAULT 'islendi',      -- 'islendi', 'hata', 'yok_sayildi', 'beklemede'
    hata_detay TEXT,                          -- Hata varsa açıklama
    islem_suresi_ms INTEGER,                 -- İşlem süresi (performans takibi)
    tarih DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXLER (Telegram tabloları)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_telegram_kullanicilar_tid ON telegram_kullanicilar(telegram_id);
CREATE INDEX IF NOT EXISTS idx_medya_proje ON medya(proje_id);
CREATE INDEX IF NOT EXISTS idx_medya_paket ON medya(veri_paketi_id);
CREATE INDEX IF NOT EXISTS idx_medya_tarih ON medya(yukleme_tarihi);
CREATE INDEX IF NOT EXISTS idx_medya_konum ON medya(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_veri_paketleri_proje ON veri_paketleri(proje_id);
CREATE INDEX IF NOT EXISTS idx_veri_paketleri_ekip ON veri_paketleri(ekip_id);
CREATE INDEX IF NOT EXISTS idx_veri_paketleri_tarih ON veri_paketleri(olusturma_tarihi);
CREATE INDEX IF NOT EXISTS idx_mesaj_log_tid ON telegram_mesaj_log(telegram_id);
CREATE INDEX IF NOT EXISTS idx_mesaj_log_tarih ON telegram_mesaj_log(tarih);

-- ============================================
-- MALZEME REFERANS KATALOĞU
-- Direk, konsol, izolatör, iletken vb. tanımları
-- AI görsel analiz bu katalogla eşleştirme yapar
-- ============================================
CREATE TABLE IF NOT EXISTS ekipman_katalogu (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kategori TEXT NOT NULL,
    -- Kategoriler:
    -- 'konsol'       → L konsol, T konsol, V konsol, Ayırıcı konsolu vb.
    -- 'izolator'     → Cam izolatör, porselen, polimer (kompozit)
    -- 'iletken'      → ACSR, AAC, AAAC — kesit bazlı
    -- 'armatur'      → Gergi armatürü, taşıma armatürü, ek armatürü
    -- 'direk'        → Beton direk, ahşap direk, çelik direk — boy bazlı
    -- 'trafo'        → Trafo tipleri ve güçleri
    -- 'pano'         → Dağıtım panosu, ölçü panosu
    -- 'ayirici'      → Kesici, ayırıcı, sigorta
    -- 'topraklama'   → Topraklama iniş iletkeni, topraklama çubuğu
    -- 'aksesuar'     → Klip, kelepçe, bağlantı elemanları

    ekipman_kodu TEXT UNIQUE,                -- Firma/standart kodu: 'KNS-L-1200', 'IZL-CAM-U70'
    ekipman_adi TEXT NOT NULL,               -- 'L Konsol 1200mm'
    alt_kategori TEXT,                       -- 'L tipi', 'T tipi', 'cam', 'polimer'
    marka TEXT,                              -- Üretici firma
    model TEXT,                              -- Model numarası
    teknik_ozellikler TEXT,                  -- JSON: boyut, ağırlık, gerilim sınıfı vb.
    -- Örnek teknik_ozellikler JSON:
    -- konsol:   {"uzunluk_mm": 1200, "malzeme": "galvaniz çelik", "gerilim": "34.5kV"}
    -- izolator: {"tip": "cam", "model": "U70BL", "gerilim": "36kV", "mekanik_dayanim": "70kN"}
    -- iletken:  {"tip": "ACSR", "kesit_mm2": 95, "hawk_kodu": "Hawk", "akim_kapasitesi": "340A"}
    -- armatur:  {"tip": "gergi", "iletken_kesit": "50-95mm2", "malzeme": "aluminyum"}
    -- direk:    {"boy_m": 12, "malzeme": "beton", "tepe_yukü_kg": 500, "gerilim": "34.5kV"}

    gorsel_ozellikler TEXT,                  -- JSON: AI'ın tanıması için görsel ipuçları
    -- Örnek:
    -- konsol:   {"sekil": "L şeklinde", "renk": "gri/galvaniz", "baglanti": "direk gövdesine cıvatalı"}
    -- izolator: {"sekil": "disk/çan", "renk": "kahverengi cam / yeşil cam / gri porselen", "dizilim": "zincir"}
    -- iletken:  {"gorunus": "çok telli alüminyum", "kalinlik": "orta", "renk": "gümüş/mat"}

    referans_foto_sayisi INTEGER DEFAULT 0,  -- Kaç referans fotoğraf yüklendi
    gerilim_sinifi TEXT,                     -- 'AG' (0.4kV), 'OG' (34.5kV), 'her ikisi'
    aktif BOOLEAN DEFAULT 1,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- REFERANS FOTOĞRAFLAR (Katalog görselleri)
-- Her ekipman için örnek fotoğraflar
-- AI analiz sırasında karşılaştırma için kullanılır
-- ============================================
CREATE TABLE IF NOT EXISTS ekipman_referans_foto (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ekipman_id INTEGER NOT NULL,
    dosya_yolu TEXT NOT NULL,
    aciklama TEXT,                            -- 'Önden görünüm', 'Yakın çekim', 'Direk üzerinde'
    ana_referans BOOLEAN DEFAULT 0,          -- Bu ekipmanın birincil referans görseli mi?
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ekipman_id) REFERENCES ekipman_katalogu(id)
);

-- ============================================
-- FOTOĞRAF ANALİZ SONUÇLARI
-- AI'ın fotoğraftan çıkardığı detaylı analiz
-- ============================================
CREATE TABLE IF NOT EXISTS foto_analiz (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medya_id INTEGER NOT NULL,               -- Hangi fotoğraf analiz edildi
    veri_paketi_id INTEGER,

    -- Analiz seviyesi
    analiz_katmani INTEGER NOT NULL,         -- 1: metin parse, 2: genel görsel, 3: detaylı teknik
    ai_saglayici TEXT NOT NULL,              -- 'ollama', 'claude', 'gpt4v'
    ai_model TEXT,                           -- 'qwen2.5:7b', 'llama3.2-vision:11b', 'claude-sonnet-4-5'
    analiz_tipi TEXT NOT NULL,
    -- 'genel_tanima'     → Fotoğrafta ne var? (Katman 2)
    -- 'direk_analiz'     → Direk tepesi detaylı analiz (Katman 3)
    -- 'hasar_tespit'     → Hasar analizi (Katman 2 veya 3)
    -- 'malzeme_sayim'    → Malzeme tip ve miktar tespiti (Katman 3)
    -- 'karsilastirma'    → Önceki/sonraki karşılaştırma (Katman 3)

    -- Genel sonuç
    genel_aciklama TEXT,                     -- AI'ın genel açıklaması (Türkçe)
    guven_skoru REAL,                        -- 0.0 - 1.0 arası güven seviyesi
    isleme_suresi_ms INTEGER,               -- Analiz süresi

    -- Tespit edilen nesneler (JSON array)
    tespit_edilen_nesneler TEXT,
    -- Örnek JSON:
    -- [
    --   {
    --     "nesne": "konsol",
    --     "tip": "L konsol",
    --     "miktar": 2,
    --     "konum_fotograf": "üst sol",
    --     "guven": 0.85,
    --     "eslesen_katalog_id": 5,
    --     "eslesen_katalog_kodu": "KNS-L-1200",
    --     "detay": "1200mm galvaniz L konsol, standart montaj"
    --   },
    --   {
    --     "nesne": "izolator",
    --     "tip": "cam izolatör",
    --     "miktar": 6,
    --     "konum_fotograf": "üst orta",
    --     "guven": 0.78,
    --     "eslesen_katalog_id": 12,
    --     "eslesen_katalog_kodu": "IZL-CAM-U70",
    --     "detay": "U70BL cam izolatör, 3'lü zincir x 2 konsol"
    --   },
    --   {
    --     "nesne": "iletken",
    --     "tip": "ACSR",
    --     "miktar": 3,
    --     "konum_fotograf": "üst",
    --     "guven": 0.62,
    --     "eslesen_katalog_id": null,
    --     "detay": "3 faz iletken, tahmini kesit 50-95mm², kesin tespit zor"
    --   }
    -- ]

    -- Hasar tespiti (varsa)
    hasar_tespit TEXT,
    -- Örnek JSON:
    -- {
    --   "hasar_var": true,
    --   "hasar_seviyesi": "orta",   -- 'yok', 'hafif', 'orta', 'agir', 'kritik'
    --   "hasarlar": [
    --     {"nesne": "izolator", "hasar_tipi": "kirik", "aciklama": "1 adet izolatör kırık", "acil": false},
    --     {"nesne": "konsol", "hasar_tipi": "egik", "aciklama": "Sol konsol hafif eğilmiş", "acil": false}
    --   ]
    -- }

    -- Direk genel durumu (direk analiz için)
    direk_durumu TEXT,
    -- Örnek JSON:
    -- {
    --   "direk_tipi": "beton",
    --   "tahmini_boy": "12m",
    --   "gerilim_sinifi": "OG",
    --   "genel_durum": "iyi",        -- 'iyi', 'orta', 'kotu', 'tehlikeli'
    --   "hat_tipi": "havai hat",
    --   "faz_sayisi": 3,
    --   "topraklama_var": true,
    --   "aydinlatma_var": false,
    --   "plaka_var": true,
    --   "oneriler": ["İzolatör değişimi gerekli", "Konsol sıkma yapılmalı"]
    -- }

    -- Onay durumu
    onay_durumu TEXT DEFAULT 'beklemede',    -- 'beklemede', 'onaylandi', 'duzeltildi', 'reddedildi'
    onaylayan_personel_id INTEGER,
    onay_tarihi DATETIME,
    duzeltme_notlari TEXT,                   -- Koordinatör düzeltmesi

    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (medya_id) REFERENCES medya(id),
    FOREIGN KEY (veri_paketi_id) REFERENCES veri_paketleri(id),
    FOREIGN KEY (onaylayan_personel_id) REFERENCES personel(id)
);

-- ============================================
-- ANALİZ — TESPİT EDİLEN EKİPMAN EŞLEŞMELERİ
-- Her analizdeki tespit edilen nesne ↔ katalog eşleşmesi
-- Normalize edilmiş tablo (JSON'dan ayrı olarak da sorgulanabilir)
-- ============================================
CREATE TABLE IF NOT EXISTS analiz_ekipman_eslesmesi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    foto_analiz_id INTEGER NOT NULL,
    ekipman_katalog_id INTEGER,              -- Katalogla eşleştiyse
    nesne_tipi TEXT NOT NULL,                -- 'konsol', 'izolator', 'iletken' vb.
    tespit_detay TEXT,                       -- 'L konsol 1200mm'
    miktar INTEGER DEFAULT 1,
    guven_skoru REAL,                        -- 0.0 - 1.0
    onay_durumu TEXT DEFAULT 'beklemede',    -- 'beklemede', 'onaylandi', 'duzeltildi'
    duzeltme_notu TEXT,                      -- Koordinatör: "Bu L değil T konsol"
    FOREIGN KEY (foto_analiz_id) REFERENCES foto_analiz(id),
    FOREIGN KEY (ekipman_katalog_id) REFERENCES ekipman_katalogu(id)
);

-- ============================================
-- INDEXLER (Analiz tabloları)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_ekipman_katalogu_kategori ON ekipman_katalogu(kategori);
CREATE INDEX IF NOT EXISTS idx_ekipman_katalogu_gerilim ON ekipman_katalogu(gerilim_sinifi);
CREATE INDEX IF NOT EXISTS idx_foto_analiz_medya ON foto_analiz(medya_id);
CREATE INDEX IF NOT EXISTS idx_foto_analiz_paket ON foto_analiz(veri_paketi_id);
CREATE INDEX IF NOT EXISTS idx_foto_analiz_tip ON foto_analiz(analiz_tipi);
CREATE INDEX IF NOT EXISTS idx_foto_analiz_onay ON foto_analiz(onay_durumu);
CREATE INDEX IF NOT EXISTS idx_analiz_eslesmesi_analiz ON analiz_ekipman_eslesmesi(foto_analiz_id);
CREATE INDEX IF NOT EXISTS idx_analiz_eslesmesi_katalog ON analiz_ekipman_eslesmesi(ekipman_katalog_id);

-- ============================================
-- TETİKLEYİCİLER
-- ============================================

-- Veri paketi numarası otomatik oluştur
CREATE TRIGGER IF NOT EXISTS trg_veri_paketi_no
AFTER INSERT ON veri_paketleri
WHEN NEW.paket_no IS NULL
BEGIN
    UPDATE veri_paketleri
    SET paket_no = 'VP-' || strftime('%Y', 'now') || '-' ||
        printf('%04d', (SELECT COUNT(*) FROM veri_paketleri
        WHERE strftime('%Y', olusturma_tarihi) = strftime('%Y', 'now')))
    WHERE id = NEW.id;
END;

-- Medya eklendiğinde paket foto sayısını güncelle
CREATE TRIGGER IF NOT EXISTS trg_medya_paket_sayisi
AFTER INSERT ON medya
WHEN NEW.veri_paketi_id IS NOT NULL AND NEW.dosya_tipi = 'photo'
BEGIN
    UPDATE veri_paketleri
    SET foto_sayisi = (SELECT COUNT(*) FROM medya
        WHERE veri_paketi_id = NEW.veri_paketi_id AND dosya_tipi = 'photo')
    WHERE id = NEW.veri_paketi_id;
END;
```

---

## Bot ve AI Yapılandırması

`server/telegram/config.js`:

```javascript
const path = require('path');

module.exports = {
  // Telegram Bot Token
  getBotToken: () => {
    const db = require('../db/database').getDb();
    const row = db.prepare(
      "SELECT deger FROM firma_ayarlari WHERE anahtar = 'telegram_bot_token'"
    ).get();
    return row?.deger || process.env.TELEGRAM_BOT_TOKEN;
  },

  // =============================================
  // 3 KATMANLI AI YAPILANDIRMASI
  // =============================================
  ai: {
    // Genel ayar: hangi katmanlar aktif
    getActiveProviders: () => {
      const db = require('../db/database').getDb();
      const row = db.prepare(
        "SELECT deger FROM firma_ayarlari WHERE anahtar = 'ai_aktif_katmanlar'"
      ).get();
      // Varsayılan: Katman 1+2 (lokal), Katman 3 kapalı
      return row?.deger ? JSON.parse(row.deger) : { katman1: true, katman2: true, katman3: false };
    },

    // KATMAN 1 — Metin Parse (Ollama Lokal)
    katman1: {
      provider: 'ollama',
      baseUrl: () => {
        const db = require('../db/database').getDb();
        const row = db.prepare(
          "SELECT deger FROM firma_ayarlari WHERE anahtar = 'ollama_base_url'"
        ).get();
        return row?.deger || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      },
      model: () => {
        const db = require('../db/database').getDb();
        const row = db.prepare(
          "SELECT deger FROM firma_ayarlari WHERE anahtar = 'ollama_text_model'"
        ).get();
        return row?.deger || 'qwen2.5:7b';
      },
      timeout: 30000
    },

    // KATMAN 2 — Genel Görsel Tanıma (Ollama Vision Lokal)
    katman2: {
      provider: 'ollama',
      baseUrl: () => module.exports.ai.katman1.baseUrl(), // Aynı Ollama sunucusu
      model: () => {
        const db = require('../db/database').getDb();
        const row = db.prepare(
          "SELECT deger FROM firma_ayarlari WHERE anahtar = 'ollama_vision_model'"
        ).get();
        return row?.deger || 'llama3.2-vision:11b';
      },
      timeout: 60000 // Vision daha yavaş
    },

    // KATMAN 3 — Detaylı Teknik Analiz (Cloud API)
    katman3: {
      provider: () => {
        const db = require('../db/database').getDb();
        const row = db.prepare(
          "SELECT deger FROM firma_ayarlari WHERE anahtar = 'cloud_ai_provider'"
        ).get();
        return row?.deger || 'claude'; // 'claude' veya 'openai'
      },
      claude: {
        apiKey: () => {
          const db = require('../db/database').getDb();
          const row = db.prepare(
            "SELECT deger FROM firma_ayarlari WHERE anahtar = 'claude_api_key'"
          ).get();
          return row?.deger || process.env.ANTHROPIC_API_KEY;
        },
        model: 'claude-sonnet-4-5-20250929' // Vision desteği olan en iyi model
      },
      openai: {
        apiKey: () => {
          const db = require('../db/database').getDb();
          const row = db.prepare(
            "SELECT deger FROM firma_ayarlari WHERE anahtar = 'openai_api_key'"
          ).get();
          return row?.deger || process.env.OPENAI_API_KEY;
        },
        model: 'gpt-4o'
      },
      timeout: 90000
    }
  },

  // Medya depolama ayarları
  media: {
    basePath: path.join(__dirname, '../../media'),
    photosDir: 'photos',
    thumbnailsDir: 'thumbnails',
    analysisDir: 'analysis',        // Annotated analiz görselleri
    documentsDir: 'documents',
    maxPhotoSize: 10 * 1024 * 1024,
    thumbnailWidth: 400,
    thumbnailHeight: 400,
    // Analiz için fotoğraf boyutlandırma
    analysisMaxWidth: 2048,          // AI'a gönderilecek max genişlik
    analysisMaxHeight: 2048,
    analysisQuality: 90,             // JPEG kalitesi (analiz için yüksek tut)
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
  },

  // Malzeme kataloğu ayarları
  catalog: {
    basePath: path.join(__dirname, '../../catalog'),
    referenceImagesDir: 'reference-images',
    // Analiz sırasında kaç referans fotoğraf gönderilsin (few-shot)
    maxReferencePhotos: 3,
    // Katalog eşleştirme minimum güven skoru
    minMatchConfidence: 0.6
  },

  // Veri paketi ayarları
  dataBundle: {
    autoCompleteMinutes: 15,
    maxPhotosPerBundle: 20,
    maxBundlesPerDay: 50,
    // Fotoğraf yüklendiğinde otomatik analiz seviyesi
    // 0: analiz yapma, 1: sadece metin, 2: genel görsel, 3: detaylı
    autoAnalysisLevel: 2
  },

  // Bot davranış ayarları
  bot: {
    processTimeout: 30000,
    sendConfirmation: true,
    notifyCoordinator: true
  }
};
```

Firma ayarları tablosuna eklenecek yeni satırlar:

```sql
INSERT OR IGNORE INTO firma_ayarlari (anahtar, deger, aciklama) VALUES
('telegram_bot_token', '', 'BotFather''dan alınan Telegram Bot Token'),
-- AI Katman ayarları
('ai_aktif_katmanlar', '{"katman1":true,"katman2":true,"katman3":false}', 'Aktif AI katmanları'),
('ollama_base_url', 'http://localhost:11434', 'Ollama sunucu adresi'),
('ollama_text_model', 'qwen2.5:7b', 'Katman 1: Metin parse modeli'),
('ollama_vision_model', 'llama3.2-vision:11b', 'Katman 2: Görsel tanıma modeli'),
('cloud_ai_provider', 'claude', 'Katman 3 sağlayıcı: claude veya openai'),
('claude_api_key', '', 'Anthropic Claude API anahtarı'),
('openai_api_key', '', 'OpenAI API anahtarı'),
('koordinator_telegram_id', '', 'Koordinatörün Telegram ID''si'),
('foto_oto_analiz_seviyesi', '2', 'Fotoğraf yüklendiğinde otomatik analiz: 0/1/2/3');
('koordinator_telegram_id', '', 'Koordinatörün Telegram ID''si (bildirimler için)');
```

---

## Bot Ana Yapısı

### `server/telegram/bot.js` — Bot Başlatma

```javascript
const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const { getDb } = require('../db/database');
const commandHandler = require('./handlers/commandHandler');
const messageHandler = require('./handlers/messageHandler');
const photoHandler = require('./handlers/photoHandler');
const locationHandler = require('./handlers/locationHandler');
const callbackHandler = require('./handlers/callbackHandler');

let bot = null;

function startBot() {
  const token = config.getBotToken();
  if (!token) {
    console.log('⚠️  Telegram bot token tanımlı değil. Bot başlatılmadı.');
    console.log('   Ayarlar > Telegram bölümünden token giriniz.');
    return null;
  }

  bot = new TelegramBot(token, { polling: true });
  console.log('🤖 Telegram bot başlatıldı.');

  // --- KOMUTLAR ---
  bot.onText(/^\/start/, (msg) => commandHandler.handleStart(bot, msg));
  bot.onText(/^\/kayit/, (msg) => commandHandler.handleRegister(bot, msg));
  bot.onText(/^\/durum/, (msg) => commandHandler.handleStatus(bot, msg));
  bot.onText(/^\/ekip/, (msg) => commandHandler.handleTeamInfo(bot, msg));
  bot.onText(/^\/yardim/, (msg) => commandHandler.handleHelp(bot, msg));
  bot.onText(/^\/paket/, (msg) => commandHandler.handleBundle(bot, msg));
  bot.onText(/^\/iptal/, (msg) => commandHandler.handleCancel(bot, msg));

  // --- FOTOĞRAF ---
  bot.on('photo', (msg) => photoHandler.handlePhoto(bot, msg));

  // --- KONUM ---
  bot.on('location', (msg) => locationHandler.handleLocation(bot, msg));

  // --- INLINE BUTON CALLBACK ---
  bot.on('callback_query', (query) => callbackHandler.handle(bot, query));

  // --- METİN MESAJLARI (komut olmayanlar) ---
  bot.on('message', (msg) => {
    // Komut, fotoğraf veya konum değilse metin olarak işle
    if (msg.text && !msg.text.startsWith('/') && !msg.photo && !msg.location) {
      messageHandler.handleText(bot, msg);
    }
  });

  // --- HATA YÖNETİMİ ---
  bot.on('polling_error', (error) => {
    console.error('Telegram polling hatası:', error.code);
  });

  return bot;
}

function stopBot() {
  if (bot) {
    bot.stopPolling();
    bot = null;
    console.log('🤖 Telegram bot durduruldu.');
  }
}

function getBot() {
  return bot;
}

module.exports = { startBot, stopBot, getBot };
```

### `server/server.js`'e Ekleme

```javascript
// Mevcut server.js'in sonuna, app.listen'dan önce ekle:
const { startBot } = require('./telegram/bot');

// Veritabanını başlat
initDatabase();

// Telegram bot'u başlat
startBot();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ ElektraTrack sunucu çalışıyor: http://0.0.0.0:${PORT}`);
});
```

---

## Personel Kayıt ve Eşleştirme Akışı

Saha personeli botu ilk kez kullandığında kayıt olması gerekir.

### Akış:

```
Personel → /start komutu gönderir
  Bot → "Hoş geldiniz! Kayıt için /kayit komutunu kullanın"

Personel → /kayit komutu gönderir
  Bot → "Adınızı ve soyadınızı yazın:"

Personel → "Ali Demir" yazar
  Bot → Veritabanında "Ali Demir" arar
    → Bulursa: "Ali Demir olarak eşleştirildiniz. Ekip: Ekip 1"
    → Bulamazsa: "Bu isimde personel bulunamadı.
                   Koordinatörünüzle iletişime geçin."
    → Birden fazla bulursa: Inline butonlarla seçtir

Koordinatör web panelinden de eşleştirme yapabilir/onaylayabilir.
```

### `server/telegram/services/registrationService.js`

```javascript
const { getDb } = require('../../db/database');

class RegistrationService {

  // Telegram ID ile kayıtlı kullanıcı bul
  findByTelegramId(telegramId) {
    const db = getDb();
    return db.prepare(`
      SELECT tk.*, p.ad_soyad, p.gorev, e.ekip_adi, e.ekip_kodu
      FROM telegram_kullanicilar tk
      LEFT JOIN personel p ON tk.personel_id = p.id
      LEFT JOIN ekipler e ON p.ekip_id = e.id
      WHERE tk.telegram_id = ? AND tk.aktif = 1
    `).get(String(telegramId));
  }

  // İsimle personel ara
  searchPersonel(adSoyad) {
    const db = getDb();
    return db.prepare(`
      SELECT p.*, e.ekip_adi
      FROM personel p
      LEFT JOIN ekipler e ON p.ekip_id = e.id
      WHERE p.ad_soyad LIKE ? AND p.aktif = 1
    `).all(`%${adSoyad}%`);
  }

  // Telegram kullanıcısını personele eşleştir
  registerUser(telegramId, telegramUsername, telegramName, personelId) {
    const db = getDb();
    return db.prepare(`
      INSERT INTO telegram_kullanicilar
        (telegram_id, telegram_kullanici_adi, telegram_ad, personel_id)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(telegram_id) DO UPDATE SET
        personel_id = excluded.personel_id,
        telegram_kullanici_adi = excluded.telegram_kullanici_adi,
        telegram_ad = excluded.telegram_ad
    `).run(String(telegramId), telegramUsername, telegramName, personelId);
  }

  // Son mesaj zamanını güncelle
  updateLastMessage(telegramId) {
    const db = getDb();
    db.prepare(`
      UPDATE telegram_kullanicilar
      SET son_mesaj_tarihi = CURRENT_TIMESTAMP
      WHERE telegram_id = ?
    `).run(String(telegramId));
  }

  // Kullanıcının kayıtlı ve yetkili olup olmadığını kontrol et
  // Her mesaj işlenmeden önce çağrılır
  authenticate(telegramId) {
    const user = this.findByTelegramId(telegramId);
    if (!user) return { authenticated: false, reason: 'not_registered' };
    if (!user.personel_id) return { authenticated: false, reason: 'not_linked' };
    this.updateLastMessage(telegramId);
    return { authenticated: true, user };
  }
}

module.exports = new RegistrationService();
```

---

## Veri Paketi Sistemi

### Konsept

Saha personeli bir direk/trafo/hat tespiti yaparken genellikle şunları gönderir:
1. Birkaç fotoğraf (farklı açılardan)
2. Konum (GPS)
3. Açıklama notu

Bunlar ayrı ayrı Telegram mesajı olarak gelir. Sistem bunları **bir "veri paketi"** altında gruplar.

### Akış — Veri Paketi Oluşturma

```
Personel: /paket direk_tespit YB-2025-001
  Bot: "📦 Veri paketi oluşturuldu: VP-2025-0042
        Tip: Direk Tespit | Proje: YB-2025-001
        
        Şimdi fotoğraf, konum ve notlarınızı gönderin.
        Bitirdiğinizde /paket tamam yazın.
        15 dakika mesaj gelmezse otomatik tamamlanır."

Personel: [Fotoğraf gönderir]
  Bot: "📸 1. fotoğraf kaydedildi. GPS: 41.6833, 35.9167"

Personel: [Başka fotoğraf gönderir]  
  Bot: "📸 2. fotoğraf kaydedildi."

Personel: [Konum paylaşır]
  Bot: "📍 Konum kaydedildi: 41.6833, 35.9167"

Personel: "3 nolu direk, çürüme var, değişmeli"
  Bot: "📝 Not eklendi."

Personel: /paket tamam
  Bot: "✅ Veri paketi VP-2025-0042 tamamlandı!
        📸 3 fotoğraf | 📍 Konum var | 📝 Not var
        Koordinatöre bildirildi."
```

### Akış — Hızlı Mod (Paketsiz)

Personel `/paket` komutu kullanmadan direkt fotoğraf gönderirse:

```
Personel: [Fotoğraf + caption: "YB-001 3 nolu direk çürük"]
  Bot: Otomatik olarak yeni bir veri paketi oluşturur
       EXIF'ten GPS ve tarih alır
       Caption'dan proje no ve notu parse eder
  Bot: "📦 Otomatik paket oluşturuldu: VP-2025-0043
        Proje: YB-2025-001 | Tip: genel
        📸 Fotoğraf kaydedildi | 📍 GPS: 41.6833, 35.9167
        
        Aynı pakete eklemek için fotoğraf/not gönderin.
        15 dk sonra otomatik tamamlanır."
```

### `server/telegram/services/dataBundleService.js`

```javascript
const { getDb } = require('../../db/database');
const config = require('../config');

class DataBundleService {

  // Personelin aktif (devam eden) paketini bul
  getActiveBundle(personelId) {
    const db = getDb();
    const timeout = config.dataBundle.autoCompleteMinutes;
    return db.prepare(`
      SELECT * FROM veri_paketleri
      WHERE personel_id = ?
        AND durum = 'devam_ediyor'
        AND datetime(olusturma_tarihi, '+${timeout} minutes') > datetime('now')
      ORDER BY olusturma_tarihi DESC
      LIMIT 1
    `).get(personelId);
  }

  // Yeni veri paketi oluştur
  createBundle({ paketTipi, personelId, ekipId, projeId, bolgeId, notlar }) {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO veri_paketleri
        (paket_tipi, personel_id, ekip_id, proje_id, bolge_id, notlar, durum)
      VALUES (?, ?, ?, ?, ?, ?, 'devam_ediyor')
    `).run(paketTipi, personelId, ekipId, projeId, bolgeId, notlar);

    return this.getBundleById(result.lastInsertRowid);
  }

  // Paketi tamamla
  completeBundle(bundleId) {
    const db = getDb();
    db.prepare(`
      UPDATE veri_paketleri
      SET durum = 'tamamlandi', tamamlanma_zamani = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(bundleId);
    return this.getBundleById(bundleId);
  }

  // Pakete not ekle
  appendNote(bundleId, note) {
    const db = getDb();
    const bundle = this.getBundleById(bundleId);
    const existingNotes = bundle.notlar ? bundle.notlar + '\n' : '';
    db.prepare(`
      UPDATE veri_paketleri SET notlar = ? WHERE id = ?
    `).run(existingNotes + note, bundleId);
  }

  // Paketin konumunu güncelle
  updateLocation(bundleId, latitude, longitude) {
    const db = getDb();
    db.prepare(`
      UPDATE veri_paketleri
      SET latitude = ?, longitude = ?
      WHERE id = ?
    `).run(latitude, longitude, bundleId);
  }

  // Paket detayını medyalarla birlikte getir
  getBundleById(bundleId) {
    const db = getDb();
    const bundle = db.prepare('SELECT * FROM veri_paketleri WHERE id = ?').get(bundleId);
    if (bundle) {
      bundle.medyalar = db.prepare(
        'SELECT * FROM medya WHERE veri_paketi_id = ? ORDER BY yukleme_tarihi'
      ).all(bundleId);
    }
    return bundle;
  }

  // Süresi dolmuş paketleri otomatik tamamla
  autoCompleteExpiredBundles() {
    const db = getDb();
    const timeout = config.dataBundle.autoCompleteMinutes;
    const expired = db.prepare(`
      SELECT * FROM veri_paketleri
      WHERE durum = 'devam_ediyor'
        AND datetime(olusturma_tarihi, '+${timeout} minutes') <= datetime('now')
    `).all();

    for (const bundle of expired) {
      this.completeBundle(bundle.id);
    }
    return expired;
  }

  // Personelin belirli tarihteki paketleri
  getBundlesByPersonel(personelId, tarih = null) {
    const db = getDb();
    if (tarih) {
      return db.prepare(`
        SELECT * FROM veri_paketleri
        WHERE personel_id = ? AND date(olusturma_tarihi) = ?
        ORDER BY olusturma_tarihi DESC
      `).all(personelId, tarih);
    }
    return db.prepare(`
      SELECT * FROM veri_paketleri
      WHERE personel_id = ?
      ORDER BY olusturma_tarihi DESC
      LIMIT 20
    `).all(personelId);
  }
}

module.exports = new DataBundleService();
```

---

## Fotoğraf ve Medya İşleme

### `server/telegram/services/mediaService.js`

```javascript
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const exifReader = require('exif-reader');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../db/database');
const config = require('../config');

class MediaService {

  // Telegram'dan fotoğraf indir ve işle
  async processPhoto(bot, msg) {
    // Telegram en yüksek çözünürlüklü fotoğrafı son eleman olarak gönderir
    const photoSize = msg.photo[msg.photo.length - 1];
    const fileId = photoSize.file_id;

    // Dosyayı Telegram'dan indir
    const filePath = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${config.getBotToken()}/${filePath.file_path}`;
    const fileBuffer = await this.downloadFile(fileUrl);

    // Tarih bazlı klasör oluştur
    const now = new Date();
    const dateDir = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`;
    const photosDir = path.join(config.media.basePath, config.media.photosDir, dateDir);
    const thumbsDir = path.join(config.media.basePath, config.media.thumbnailsDir, dateDir);
    fs.mkdirSync(photosDir, { recursive: true });
    fs.mkdirSync(thumbsDir, { recursive: true });

    // Benzersiz dosya adı
    const fileName = `${uuidv4()}.jpg`;
    const fullPath = path.join(photosDir, fileName);
    const thumbPath = path.join(thumbsDir, fileName);

    // Orijinali kaydet
    fs.writeFileSync(fullPath, fileBuffer);

    // Thumbnail oluştur
    await sharp(fileBuffer)
      .resize(config.media.thumbnailWidth, config.media.thumbnailHeight, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toFile(thumbPath);

    // EXIF metadata oku
    const exifData = await this.extractExif(fileBuffer);

    // Fotoğraf boyutlarını al
    const metadata = await sharp(fileBuffer).metadata();

    return {
      fileName,
      fullPath,
      thumbPath,
      fileSize: fileBuffer.length,
      width: metadata.width,
      height: metadata.height,
      exif: exifData,
      caption: msg.caption || null
    };
  }

  // EXIF verisinden GPS ve tarih çıkar
  async extractExif(buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      if (!metadata.exif) return { gps: null, dateTime: null };

      const exif = exifReader(metadata.exif);
      let gps = null;
      let dateTime = null;

      // GPS koordinatları
      if (exif?.GPSInfo?.GPSLatitude && exif?.GPSInfo?.GPSLongitude) {
        const lat = this.convertDMStoDD(
          exif.GPSInfo.GPSLatitude,
          exif.GPSInfo.GPSLatitudeRef
        );
        const lng = this.convertDMStoDD(
          exif.GPSInfo.GPSLongitude,
          exif.GPSInfo.GPSLongitudeRef
        );
        const alt = exif.GPSInfo.GPSAltitude || null;
        gps = { latitude: lat, longitude: lng, altitude: alt };
      }

      // Çekim tarihi
      if (exif?.Photo?.DateTimeOriginal) {
        dateTime = exif.Photo.DateTimeOriginal;
      } else if (exif?.Image?.DateTime) {
        dateTime = exif.Image.DateTime;
      }

      return { gps, dateTime };
    } catch (err) {
      console.error('EXIF okuma hatası:', err.message);
      return { gps: null, dateTime: null };
    }
  }

  // DMS (Degree/Minute/Second) → Decimal Degree dönüşümü
  convertDMStoDD(dms, ref) {
    const dd = dms[0] + dms[1] / 60 + dms[2] / 3600;
    return (ref === 'S' || ref === 'W') ? -dd : dd;
  }

  // Medya kaydını veritabanına ekle
  saveMediaRecord({
    fileName, fullPath, thumbPath, fileSize, width, height,
    latitude, longitude, konumKaynagi, altitude,
    cekimTarihi, personelId, telegramId, projeId, ekipId,
    veriPaketiId, aciklama, etiketler
  }) {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO medya (
        dosya_adi, dosya_yolu, thumbnail_yolu, dosya_tipi, mime_tipi,
        dosya_boyutu, genislik, yukseklik,
        latitude, longitude, konum_kaynagi, altitude,
        cekim_tarihi, yukleyen_personel_id, yukleyen_telegram_id,
        proje_id, ekip_id, veri_paketi_id, aciklama, etiketler
      ) VALUES (?, ?, ?, 'photo', 'image/jpeg',
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?)
    `).run(
      fileName, fullPath, thumbPath,
      fileSize, width, height,
      latitude, longitude, konumKaynagi, altitude,
      cekimTarihi, personelId, telegramId,
      projeId, ekipId, veriPaketiId, aciklama,
      etiketler ? JSON.stringify(etiketler) : null
    );
    return result.lastInsertRowid;
  }

  // Dosya indirme yardımcısı
  async downloadFile(url) {
    const response = await fetch(url);
    return Buffer.from(await response.arrayBuffer());
  }
}

module.exports = new MediaService();
```

---

## Fotoğraf Handler — Tam Akış

### `server/telegram/handlers/photoHandler.js`

```javascript
const registrationService = require('../services/registrationService');
const mediaService = require('../services/mediaService');
const dataBundleService = require('../services/dataBundleService');
const messageParser = require('../ai/messageParser');
const messages = require('../utils/messages');
const { getDb } = require('../../db/database');

class PhotoHandler {

  async handlePhoto(bot, msg) {
    const telegramId = String(msg.from.id);
    const chatId = msg.chat.id;

    // 1. Kullanıcı doğrulama
    const auth = registrationService.authenticate(telegramId);
    if (!auth.authenticated) {
      return bot.sendMessage(chatId, messages.notRegistered);
    }

    const { user } = auth;
    const startTime = Date.now();

    try {
      // 2. Fotoğrafı indir ve işle
      const photoResult = await mediaService.processPhoto(bot, msg);

      // 3. GPS koordinatlarını belirle (öncelik sırası)
      let latitude = null, longitude = null, konumKaynagi = null, altitude = null;

      // Öncelik 1: EXIF GPS verisi (fotoğraftaki gömülü konum)
      if (photoResult.exif?.gps) {
        latitude = photoResult.exif.gps.latitude;
        longitude = photoResult.exif.gps.longitude;
        altitude = photoResult.exif.gps.altitude;
        konumKaynagi = 'exif';
      }

      // Öncelik 2: Mesajla birlikte gelen konum (Telegram location)
      if (!latitude && msg.location) {
        latitude = msg.location.latitude;
        longitude = msg.location.longitude;
        konumKaynagi = 'telegram_konum';
      }

      // 4. Caption'ı AI ile parse et (varsa)
      let parsedCaption = null;
      let projeId = null;
      let paketTipi = 'diger';

      if (photoResult.caption) {
        parsedCaption = await messageParser.parsePhotoCaption(photoResult.caption);
        if (parsedCaption?.proje_no) {
          const proje = getDb().prepare(
            'SELECT id FROM projeler WHERE proje_no = ?'
          ).get(parsedCaption.proje_no);
          projeId = proje?.id || null;
        }
        if (parsedCaption?.paket_tipi) {
          paketTipi = parsedCaption.paket_tipi;
        }
      }

      // 5. Aktif veri paketini bul veya yeni oluştur
      let bundle = dataBundleService.getActiveBundle(user.personel_id);

      if (!bundle) {
        // Yeni paket oluştur
        bundle = dataBundleService.createBundle({
          paketTipi: paketTipi,
          personelId: user.personel_id,
          ekipId: user.ekip_id || null,
          projeId: projeId,
          bolgeId: null,
          notlar: parsedCaption?.not || null
        });
      } else {
        // Mevcut pakete not ekle (caption varsa)
        if (parsedCaption?.not) {
          dataBundleService.appendNote(bundle.id, parsedCaption.not);
        }
      }

      // 6. Konum bilgisini pakete kaydet (ilk konum)
      if (latitude && !bundle.latitude) {
        dataBundleService.updateLocation(bundle.id, latitude, longitude);
      }

      // 7. Medya kaydını veritabanına ekle
      const mediaId = mediaService.saveMediaRecord({
        fileName: photoResult.fileName,
        fullPath: photoResult.fullPath,
        thumbPath: photoResult.thumbPath,
        fileSize: photoResult.fileSize,
        width: photoResult.width,
        height: photoResult.height,
        latitude, longitude, konumKaynagi, altitude,
        cekimTarihi: photoResult.exif?.dateTime || null,
        personelId: user.personel_id,
        telegramId: telegramId,
        projeId: projeId || bundle.proje_id,
        ekipId: user.ekip_id,
        veriPaketiId: bundle.id,
        aciklama: parsedCaption?.not || photoResult.caption,
        etiketler: parsedCaption?.etiketler || null
      });

      // 8. Güncellenmiş paket bilgisini al
      const updatedBundle = dataBundleService.getBundleById(bundle.id);

      // 9. Onay mesajı gönder
      let confirmMsg = `📸 Fotoğraf #${updatedBundle.foto_sayisi} kaydedildi.`;
      if (latitude) {
        confirmMsg += `\n📍 GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      } else {
        confirmMsg += `\n⚠️ GPS bilgisi bulunamadı. Konum gönderin veya fotoğraftaki GPS'i açın.`;
      }
      confirmMsg += `\n📦 Paket: ${updatedBundle.paket_no}`;

      await bot.sendMessage(chatId, confirmMsg);

      // 10. Mesaj logla
      this.logMessage(telegramId, 'photo', msg, { mediaId, bundleId: bundle.id }, Date.now() - startTime);

    } catch (error) {
      console.error('Fotoğraf işleme hatası:', error);
      await bot.sendMessage(chatId, messages.processingError);
      this.logMessage(telegramId, 'photo', msg, null, Date.now() - startTime, error.message);
    }
  }

  logMessage(telegramId, type, msg, result, duration, error = null) {
    const db = getDb();
    db.prepare(`
      INSERT INTO telegram_mesaj_log
        (telegram_id, mesaj_tipi, yon, ham_mesaj, ai_parse_sonucu, islem_durumu, hata_detay, islem_suresi_ms)
      VALUES (?, ?, 'gelen', ?, ?, ?, ?, ?)
    `).run(
      telegramId, type,
      JSON.stringify({ caption: msg.caption, photo_count: msg.photo?.length }),
      result ? JSON.stringify(result) : null,
      error ? 'hata' : 'islendi',
      error, duration
    );
  }
}

module.exports = new PhotoHandler();
```

---

## 3 Katmanlı AI Mimarisi

### Genel Bakış

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AI MANAGER (Orkestratör)                     │
│                     server/telegram/ai/aiManager.js                 │
│                                                                     │
│  Gelen istek tipine göre doğru katmanı seçer ve yönlendirir        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  KATMAN 1 — Metin Parse                    [Ollama Lokal, Ücretsiz] │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Model: qwen2.5:7b                                           │  │
│  │  İş: Serbest Türkçe mesaj → yapılandırılmış JSON             │  │
│  │  Örnekler:                                                    │  │
│  │    "4 kişi kablo çektik" → {tip:"gunluk_rapor", ...}         │  │
│  │    "50 klemens lazım" → {tip:"malzeme_talep", ...}           │  │
│  │    Fotoğraf caption'ı → {proje_no, not, etiketler}           │  │
│  │  Hız: 2-5 sn | RAM: ~5GB | Her mesajda otomatik çalışır     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  KATMAN 2 — Genel Görsel Tanıma            [Ollama Lokal, Ücretsiz] │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Model: llama3.2-vision:11b                                   │  │
│  │  İş: Fotoğrafta ne var? Genel sınıflandırma + durum tespiti  │  │
│  │  Örnekler:                                                    │  │
│  │    "Bu fotoğrafta beton direk ve havai hat görünüyor"         │  │
│  │    "Hasar tespit edildi: sol konsol eğilmiş"                  │  │
│  │    "Trafo binası, kapı açık, genel durum orta"                │  │
│  │  Hız: 5-15 sn | RAM: ~8GB | Fotoğraf yüklendiğinde otomatik │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  KATMAN 3 — Detaylı Teknik Analiz          [Cloud API, Ücretli]     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Model: Claude Sonnet 4.5 Vision / GPT-4o                    │  │
│  │  İş: Direk tepesi detaylı analiz, malzeme tip+miktar tespiti │  │
│  │  Referans katalog ile karşılaştırma (few-shot prompting)     │  │
│  │  Örnekler:                                                    │  │
│  │    "2x L konsol (1200mm), 6x cam izolatör (U70BL),          │  │
│  │     3 faz ACSR iletken (~95mm²), 1x gergi armatürü"          │  │
│  │  Hasar detay: "1 izolatör kırık, konsol cıvatası gevşemiş"  │  │
│  │  Hız: 3-8 sn | Maliyet: ~$0.01-0.03/foto | Talep üzerine   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  İLERİDE — Katman 4 (Opsiyonel)                                    │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Özel Fine-tune Model (kendi fotoğraflarınla eğitilmiş)      │  │
│  │  %95+ doğrulukla malzeme tanıma, firma standartlarına uygun  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### `server/telegram/ai/aiManager.js` — Ana Orkestratör

```javascript
const ollamaProvider = require('./providers/ollamaProvider');
const cloudProvider = require('./providers/cloudProvider');
const analysisService = require('../services/analysisService');
const config = require('../config');

class AIManager {

  // ─── KATMAN 1: Metin Parse (Her mesajda, lokal) ────────────────
  async parseText(text) {
    const providers = config.ai.getActiveProviders();

    if (providers.katman1) {
      return ollamaProvider.parseText(text);
    }
    // Fallback: Cloud varsa onu kullan
    if (providers.katman3) {
      return cloudProvider.parseText(text);
    }
    return null;
  }

  // ─── KATMAN 1: Caption Parse (Fotoğraf açıklaması, lokal) ─────
  async parseCaption(caption) {
    const providers = config.ai.getActiveProviders();

    if (providers.katman1) {
      return ollamaProvider.parseCaption(caption);
    }
    if (providers.katman3) {
      return cloudProvider.parseCaption(caption);
    }
    return null;
  }

  // ─── KATMAN 2: Genel Görsel Tanıma (Fotoğraf yüklendiğinde, lokal) ─
  async analyzePhotoGeneral(imageBuffer) {
    const providers = config.ai.getActiveProviders();

    if (providers.katman2) {
      const imageBase64 = imageBuffer.toString('base64');
      return ollamaProvider.analyzeImage(imageBase64, 'general');
    }
    // Fallback: Katman 3 varsa genel analiz için onu kullan
    if (providers.katman3) {
      const imageBase64 = imageBuffer.toString('base64');
      return cloudProvider.analyzeImage(imageBase64, 'general');
    }
    return null;
  }

  // ─── KATMAN 3: Detaylı Teknik Analiz (Talep üzerine, cloud) ────
  async analyzePhotoDetailed(imageBuffer, analizTipi, katalogVerisi = null) {
    const providers = config.ai.getActiveProviders();

    if (!providers.katman3) {
      return {
        error: true,
        message: 'Detaylı analiz için Cloud AI (Katman 3) aktif değil. ' +
                 'Ayarlar > AI bölümünden Cloud API anahtarı giriniz.'
      };
    }

    const imageBase64 = imageBuffer.toString('base64');
    return cloudProvider.analyzeImage(imageBase64, analizTipi, katalogVerisi);
  }

  // ─── KOMPLE ANALİZ AKIŞI (Fotoğraf yüklendiğinde tetiklenir) ──
  async processPhotoAnalysis(mediaId, imageBuffer, autoLevel = null) {
    const level = autoLevel ?? config.dataBundle.autoAnalysisLevel;
    const results = [];

    // Seviye 2+: Genel görsel tanıma (lokal)
    if (level >= 2) {
      try {
        const generalResult = await this.analyzePhotoGeneral(imageBuffer);
        if (generalResult) {
          const savedId = await analysisService.saveAnalysis({
            medyaId: mediaId,
            katman: 2,
            analizTipi: 'genel_tanima',
            sonuc: generalResult
          });
          results.push({ katman: 2, id: savedId, sonuc: generalResult });
        }
      } catch (err) {
        console.error('Katman 2 analiz hatası:', err.message);
      }
    }

    // Seviye 3: Detaylı analiz (cloud, otomatik tetiklenmez normalde)
    // Sadece autoLevel açıkça 3 olarak ayarlandıysa
    if (level >= 3) {
      try {
        const katalog = await analysisService.getRelevantCatalog();
        const detailResult = await this.analyzePhotoDetailed(
          imageBuffer, 'direk_analiz', katalog
        );
        if (detailResult && !detailResult.error) {
          const savedId = await analysisService.saveAnalysis({
            medyaId: mediaId,
            katman: 3,
            analizTipi: 'direk_analiz',
            sonuc: detailResult
          });
          results.push({ katman: 3, id: savedId, sonuc: detailResult });
        }
      } catch (err) {
        console.error('Katman 3 analiz hatası:', err.message);
      }
    }

    return results;
  }

  // ─── Sağlık kontrolü: Hangi AI servisleri çalışıyor? ──────────
  async healthCheck() {
    const status = { katman1: false, katman2: false, katman3: false };

    try {
      const res = await fetch(`${config.ai.katman1.baseUrl()}/api/tags`);
      if (res.ok) {
        const data = await res.json();
        const models = data.models?.map(m => m.name) || [];
        status.katman1 = models.some(m => m.includes(config.ai.katman1.model()));
        status.katman2 = models.some(m => m.includes('vision') || m.includes('llava'));
        status.ollama_running = true;
        status.ollama_models = models;
      }
    } catch {
      status.ollama_running = false;
    }

    try {
      const provider = config.ai.katman3.provider();
      if (provider === 'claude' && config.ai.katman3.claude.apiKey()) {
        status.katman3 = true;
        status.cloud_provider = 'claude';
      } else if (provider === 'openai' && config.ai.katman3.openai.apiKey()) {
        status.katman3 = true;
        status.cloud_provider = 'openai';
      }
    } catch {
      status.katman3 = false;
    }

    return status;
  }
}

module.exports = new AIManager();
```

### `server/telegram/ai/providers/ollamaProvider.js` — Lokal AI (Katman 1+2)

```javascript
const config = require('../../config');
const prompts = require('../prompts/textParsePrompt');
const captionPrompts = require('../prompts/photoCaptionPrompt');
const visionPrompts = require('../prompts/generalVisionPrompt');

class OllamaProvider {

  // ─── Metin → JSON (Katman 1) ──────────────────────────────────
  async parseText(text) {
    const baseUrl = config.ai.katman1.baseUrl();
    const model = config.ai.katman1.model();

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: prompts.systemPrompt },
          { role: 'user', content: text }
        ],
        format: 'json',
        stream: false,
        options: { temperature: 0.1 }  // Düşük sıcaklık = tutarlı JSON
      }),
      signal: AbortSignal.timeout(config.ai.katman1.timeout)
    });

    const data = await response.json();
    return JSON.parse(data.message.content);
  }

  // ─── Caption → JSON (Katman 1) ────────────────────────────────
  async parseCaption(caption) {
    const baseUrl = config.ai.katman1.baseUrl();
    const model = config.ai.katman1.model();

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: captionPrompts.systemPrompt },
          { role: 'user', content: caption }
        ],
        format: 'json',
        stream: false,
        options: { temperature: 0.1 }
      }),
      signal: AbortSignal.timeout(config.ai.katman1.timeout)
    });

    const data = await response.json();
    return JSON.parse(data.message.content);
  }

  // ─── Görsel Analiz (Katman 2) ─────────────────────────────────
  async analyzeImage(imageBase64, analysisType = 'general') {
    const baseUrl = config.ai.katman2.baseUrl();
    const model = config.ai.katman2.model();

    let prompt;
    switch (analysisType) {
      case 'general':
        prompt = visionPrompts.generalPrompt;
        break;
      case 'damage':
        prompt = visionPrompts.damagePrompt;
        break;
      default:
        prompt = visionPrompts.generalPrompt;
    }

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: prompt,
          images: [imageBase64]   // Ollama vision formatı
        }],
        format: 'json',
        stream: false,
        options: { temperature: 0.2 }
      }),
      signal: AbortSignal.timeout(config.ai.katman2.timeout)
    });

    const data = await response.json();
    try {
      return JSON.parse(data.message.content);
    } catch {
      // JSON parse edilemezse metin olarak döndür
      return { genel_aciklama: data.message.content, structured: false };
    }
  }
}

module.exports = new OllamaProvider();
```

### `server/telegram/ai/providers/cloudProvider.js` — Cloud AI (Katman 3)

```javascript
const config = require('../../config');
const polePrompts = require('../prompts/poleAnalysisPrompt');
const damagePrompts = require('../prompts/damageAnalysisPrompt');
const generalPrompts = require('../prompts/generalVisionPrompt');

class CloudProvider {

  // ─── Metin Parse (Fallback: Katman 1 yoksa) ───────────────────
  async parseText(text) {
    const provider = config.ai.katman3.provider();

    if (provider === 'claude') {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: config.ai.katman3.claude.apiKey() });
      const response = await client.messages.create({
        model: config.ai.katman3.claude.model,
        max_tokens: 1000,
        system: require('../prompts/textParsePrompt').systemPrompt,
        messages: [{ role: 'user', content: text }]
      });
      const cleaned = response.content[0].text.replace(/```json|```/g, '').trim();
      return JSON.parse(cleaned);
    }
    // OpenAI fallback eklenebilir
    throw new Error(`Bilinmeyen provider: ${provider}`);
  }

  // ─── Caption Parse (Fallback) ─────────────────────────────────
  async parseCaption(caption) {
    return this.parseText(caption); // Aynı mekanizma
  }

  // ─── Görsel Analiz (Katman 3 — Detaylı Teknik) ────────────────
  async analyzeImage(imageBase64, analysisType, katalogVerisi = null) {
    const provider = config.ai.katman3.provider();

    // Analiz tipine göre prompt seç
    let prompt;
    switch (analysisType) {
      case 'direk_analiz':
        prompt = polePrompts.buildPrompt(katalogVerisi);
        break;
      case 'hasar_tespit':
        prompt = damagePrompts.buildPrompt();
        break;
      case 'malzeme_sayim':
        prompt = polePrompts.buildCountPrompt(katalogVerisi);
        break;
      default:
        prompt = generalPrompts.cloudPrompt;
    }

    if (provider === 'claude') {
      return this._analyzeWithClaude(imageBase64, prompt);
    } else if (provider === 'openai') {
      return this._analyzeWithOpenAI(imageBase64, prompt);
    }
    throw new Error(`Bilinmeyen provider: ${provider}`);
  }

  async _analyzeWithClaude(imageBase64, prompt) {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: config.ai.katman3.claude.apiKey() });

    const response = await client.messages.create({
      model: config.ai.katman3.claude.model,
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 }
          },
          { type: 'text', text: prompt }
        ]
      }]
    });

    const text = response.content[0].text;
    const cleaned = text.replace(/```json|```/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      return { genel_aciklama: text, structured: false };
    }
  }

  async _analyzeWithOpenAI(imageBase64, prompt) {
    const apiKey = config.ai.katman3.openai.apiKey();
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.ai.katman3.openai.model,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            { type: 'text', text: prompt }
          ]
        }],
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    const text = data.choices[0].message.content;
    return JSON.parse(text);
  }
}

module.exports = new CloudProvider();
```

---

## AI Prompt Tanımları

### `server/telegram/ai/prompts/textParsePrompt.js`

```javascript
module.exports = {
  systemPrompt: `Sen bir elektrik dağıtım müteahhitlik firmasının saha koordinasyon asistanısın.
Saha ekiplerinden gelen Telegram mesajlarını analiz edip yapılandırılmış JSON'a dönüştür.

Mesajda birden fazla işlem olabilir (örn: hem günlük rapor hem malzeme çıkışı).

Her işlem için aşağıdaki formatı kullan:

{
  "islemler": [
    {
      "tip": "gunluk_rapor" | "malzeme_kullanim" | "malzeme_talep" | "enerji_kesintisi" | "ariza_bildirim" | "genel_not",
      "ekip_kodu": "EK-01 veya null",
      "proje_no": "YB-2025-001 veya null",
      "bolge": "bölge adı veya null",
      "detay": {
        // Tipe göre değişen alanlar:
        // gunluk_rapor: { kisi_sayisi, yapilan_is, baslama_saati, bitis_saati }
        // malzeme_kullanim: { malzemeler: [{ adi, miktar, birim }] }
        // malzeme_talep: { malzemeler: [{ adi, miktar, birim }], aciliyet }
        // enerji_kesintisi: { tarih, baslama, bitis, adres }
        // ariza_bildirim: { aciklama, konum, aciliyet }
        // genel_not: { mesaj }
      }
    }
  ],
  "anlasilamayan": "varsa anlaşılamayan kısım veya null"
}

Sadece JSON döndür, başka açıklama ekleme.`
};
```

### `server/telegram/ai/prompts/photoCaptionPrompt.js`

```javascript
module.exports = {
  systemPrompt: `Saha ekibinden gelen fotoğraf açıklamasını analiz et.

Aşağıdaki JSON formatında yanıt ver:
{
  "proje_no": "varsa proje numarası (YB-xxxx, KET-xxxx, TES-xxxx) veya null",
  "paket_tipi": "direk_tespit|montaj_oncesi|montaj_sonrasi|hasar_tespit|malzeme_tespit|ilerleme_raporu|guzergah_tespit|diger",
  "not": "açıklama metni",
  "etiketler": ["direk", "hasar", "kablo", vb. veya boş array],
  "aciliyet": "normal|acil"
}

Sadece JSON döndür.`
};
```

### `server/telegram/ai/prompts/generalVisionPrompt.js` — Katman 2

```javascript
module.exports = {

  generalPrompt: `Bu bir elektrik dağıtım sahası fotoğrafı. Aşağıdaki JSON formatında analiz et:

{
  "fotograf_tipi": "direk|trafo|pano|kablo|genel_saha|diger",
  "genel_aciklama": "Kısa Türkçe açıklama",
  "tespit_edilen_nesneler": [
    {"nesne": "beton direk", "durum": "iyi|orta|kotu", "not": ""},
    {"nesne": "havai hat", "durum": "iyi", "not": "3 faz görünüyor"}
  ],
  "hasar_var": false,
  "hasar_aciklama": "varsa kısa açıklama",
  "acil_durum": false,
  "oneriler": ["varsa kısa öneriler"]
}

Sadece JSON döndür. Kısa ve öz ol.`,

  damagePrompt: `Bu bir elektrik dağıtım ekipmanı fotoğrafı. HASAR TESPİTİ yap:

{
  "hasar_var": true|false,
  "hasar_seviyesi": "yok|hafif|orta|agir|kritik",
  "hasarlar": [
    {
      "nesne": "etkilenen ekipman",
      "hasar_tipi": "kirik|egik|yanmis|paslanmis|kopmus|diger",
      "aciklama": "detaylı açıklama",
      "acil_mudahale": true|false
    }
  ],
  "genel_degerlendirme": "Türkçe özet",
  "onerilen_aksiyonlar": ["aksiyon 1", "aksiyon 2"]
}

Sadece JSON döndür.`,

  // Cloud (Katman 3) için daha detaylı genel prompt
  cloudPrompt: `Bu bir elektrik dağıtım sahası fotoğrafı. Detaylı analiz et.
Türkçe yanıt ver, sadece JSON formatında.`
};
```

### `server/telegram/ai/prompts/poleAnalysisPrompt.js` — Katman 3: Direk Tepesi Analizi ⭐

```javascript
module.exports = {

  // Direk tepesi detaylı analiz prompt'u
  // katalogVerisi: Sistemdeki ekipman kataloğundan ilgili öğeler
  buildPrompt: (katalogVerisi = null) => {
    let prompt = `Sen bir elektrik dağıtım hattı mühendisisin. 
Bu fotoğrafta bir elektrik direğinin tepesi görünüyor.

FOTOĞRAFTAKİ TÜM EKİPMANLARI TESPİT ET ve aşağıdaki JSON formatında döndür:

{
  "direk_bilgisi": {
    "direk_tipi": "beton|ahsap|celik|kompozit",
    "tahmini_boy_m": 10,
    "gerilim_sinifi": "AG|OG",
    "hat_tipi": "havai_hat|yeralti_cikis|dagitim",
    "genel_durum": "iyi|orta|kotu|tehlikeli"
  },
  "ekipmanlar": [
    {
      "kategori": "konsol|izolator|iletken|armatur|ayirici|trafo|pano|topraklama|aksesuar",
      "tip": "detaylı tip adı (örn: L konsol, cam izolatör, ACSR iletken)",
      "alt_tip": "varsa alt tip (örn: 1200mm, U70BL, 95mm²)",
      "miktar": 2,
      "konum": "üst_sol|üst_sag|üst_orta|orta|alt|yan",
      "durum": "yeni|iyi|orta|kotu|hasarli",
      "guven_yuzdesi": 85,
      "notlar": "ek açıklama varsa"
    }
  ],
  "hat_bilgisi": {
    "faz_sayisi": 3,
    "notr_var": true,
    "aydinlatma_hatti_var": false,
    "iletken_tipi_tahmini": "ACSR/AAC/bakır",
    "iletken_kesit_tahmini": "50-95mm²"
  },
  "ek_elemanlar": {
    "topraklama_inis_iletkeni": true,
    "direk_plakasi": true,
    "uyari_levhasi": false,
    "bosluk_cubugu": false,
    "kus_koruyucu": false,
    "tirmanma_engeli": false
  },
  "hasar_tespiti": {
    "hasar_var": false,
    "hasarlar": [],
    "acil_mudahale_gerekli": false
  },
  "toplam_malzeme_ozeti": [
    {"malzeme": "L Konsol 1200mm", "miktar": 2, "birim": "adet"},
    {"malzeme": "Cam İzolatör U70BL", "miktar": 6, "birim": "adet"},
    {"malzeme": "ACSR İletken 95mm²", "miktar": 3, "birim": "faz"}
  ],
  "guven_skoru": 0.78,
  "analiz_notlari": "Genel değerlendirme ve belirsizlikler"
}

ÖNEMLİ KURALLAR:
1. Emin olmadığın ekipmanlar için guven_yuzdesi düşük ver (<%60)
2. İletken kesitini fotoğraftan kesin tespit etmek zordur, tahmini yaz
3. İzolatör sayısını dikkatli say, her konsoldaki zincir uzunluğuna bak
4. Konsol tipini şekline göre belirle: L (tek kol), T (çift kol, simetrik), V (çapraz)
5. Sadece JSON döndür, başka açıklama ekleme`;

    // Katalog verisi varsa referans olarak ekle
    if (katalogVerisi && katalogVerisi.length > 0) {
      prompt += `\n\n--- SİSTEMDEKİ MALZEME KATALOĞU (Referans) ---
Aşağıdaki malzemeler firmanın kullandığı standart ekipmanlardır.
Tespit ettiğin ekipmanları mümkünse bu katalogla eşleştir.
Her eşleşme için "eslesen_katalog_kodu" alanını ekle.

`;
      for (const item of katalogVerisi) {
        prompt += `- [${item.ekipman_kodu}] ${item.ekipman_adi}`;
        if (item.gorsel_ozellikler) {
          const ozellik = JSON.parse(item.gorsel_ozellikler);
          prompt += ` | Görsel: ${Object.values(ozellik).join(', ')}`;
        }
        prompt += '\n';
      }
    }

    return prompt;
  },

  // Sadece malzeme sayımı prompt'u (daha hızlı, daha odaklı)
  buildCountPrompt: (katalogVerisi = null) => {
    let prompt = `Bu fotoğraftaki elektrik direğindeki TÜM MALZEMELERİ say.

JSON formatında döndür:
{
  "malzemeler": [
    {"malzeme": "isim", "tip": "detay", "miktar": 2, "birim": "adet", "guven": 80}
  ],
  "toplam_cesit": 5,
  "notlar": "belirsizlikler"
}

Sadece JSON döndür.`;

    if (katalogVerisi && katalogVerisi.length > 0) {
      prompt += '\n\nReferans katalog:\n';
      for (const item of katalogVerisi) {
        prompt += `- [${item.ekipman_kodu}] ${item.ekipman_adi}\n`;
      }
    }

    return prompt;
  }
};
```

### `server/telegram/ai/prompts/damageAnalysisPrompt.js` — Hasar Tespit

```javascript
module.exports = {
  buildPrompt: () => `Bu fotoğraftaki elektrik dağıtım ekipmanının HASAR ANALİZİNİ yap.

JSON formatında döndür:
{
  "hasar_var": true|false,
  "hasar_seviyesi": "yok|hafif|orta|agir|kritik",
  "risk_degerlendirmesi": {
    "can_guvenligi_riski": false,
    "elektrik_ariza_riski": true,
    "acil_mudahale": false
  },
  "hasarlar": [
    {
      "etkilenen_ekipman": "ekipman adı",
      "hasar_tipi": "kirik|egik|yanmis|paslanmis|kopmus|catlak|deformasyon|korozyon",
      "hasar_yeri": "fotoğraftaki konum",
      "siddet": "hafif|orta|agir|kritik",
      "aciklama": "detaylı Türkçe açıklama",
      "tahmini_neden": "mekanik zorlanma|yaslanma|vandalizm|hava_kosullari|asiri_yuk|bilinmiyor",
      "onerilen_aksiyon": "degisim|tamir|izleme|acil_mudahale"
    }
  ],
  "genel_degerlendirme": "Türkçe genel özet",
  "oncelikli_aksiyonlar": ["en acil aksiyon", "ikinci öncelik"],
  "tahmini_maliyet_etkisi": "dusuk|orta|yuksek",
  "guven_skoru": 0.82
}

ÖNEMLİ:
1. Can güvenliği riski varsa mutlaka belirt
2. Kırık izolatör, kopmuş iletken, eğilmiş direk = kritik
3. Korozyon/pas, renk değişimi = orta seviye
4. Sadece JSON döndür`
};
```

---

## Analiz Servisi

### `server/telegram/services/analysisService.js`

```javascript
const { getDb } = require('../../db/database');

class AnalysisService {

  // Analiz sonucunu veritabanına kaydet
  async saveAnalysis({ medyaId, veriPaketiId, katman, analizTipi, sonuc, aiProvider, aiModel, suresi }) {
    const db = getDb();

    const result = db.prepare(`
      INSERT INTO foto_analiz (
        medya_id, veri_paketi_id, analiz_katmani, ai_saglayici, ai_model,
        analiz_tipi, genel_aciklama, guven_skoru, isleme_suresi_ms,
        tespit_edilen_nesneler, hasar_tespit, direk_durumu
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      medyaId,
      veriPaketiId || null,
      katman,
      aiProvider || (katman <= 2 ? 'ollama' : 'claude'),
      aiModel || null,
      analizTipi,
      sonuc.genel_aciklama || sonuc.analiz_notlari || null,
      sonuc.guven_skoru || null,
      suresi || null,
      sonuc.ekipmanlar ? JSON.stringify(sonuc.ekipmanlar) : (sonuc.tespit_edilen_nesneler ? JSON.stringify(sonuc.tespit_edilen_nesneler) : null),
      sonuc.hasar_tespiti ? JSON.stringify(sonuc.hasar_tespiti) : (sonuc.hasarlar ? JSON.stringify(sonuc) : null),
      sonuc.direk_bilgisi ? JSON.stringify(sonuc.direk_bilgisi) : null
    );

    const analizId = result.lastInsertRowid;

    // Tespit edilen ekipmanları normalize edilmiş tabloya da kaydet
    if (sonuc.ekipmanlar && Array.isArray(sonuc.ekipmanlar)) {
      for (const ekipman of sonuc.ekipmanlar) {
        // Katalogla eşleştirmeyi dene
        let katalogId = null;
        if (ekipman.eslesen_katalog_kodu) {
          const katalog = db.prepare(
            'SELECT id FROM ekipman_katalogu WHERE ekipman_kodu = ?'
          ).get(ekipman.eslesen_katalog_kodu);
          katalogId = katalog?.id || null;
        }

        db.prepare(`
          INSERT INTO analiz_ekipman_eslesmesi
            (foto_analiz_id, ekipman_katalog_id, nesne_tipi, tespit_detay, miktar, guven_skoru)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          analizId,
          katalogId,
          ekipman.kategori || ekipman.nesne || 'bilinmiyor',
          `${ekipman.tip || ''} ${ekipman.alt_tip || ''}`.trim(),
          ekipman.miktar || 1,
          (ekipman.guven_yuzdesi || 0) / 100
        );
      }
    }

    // Malzeme özeti varsa kaydet (toplam_malzeme_ozeti)
    if (sonuc.toplam_malzeme_ozeti && Array.isArray(sonuc.toplam_malzeme_ozeti)) {
      for (const mlz of sonuc.toplam_malzeme_ozeti) {
        const katalog = db.prepare(
          'SELECT id FROM ekipman_katalogu WHERE ekipman_adi LIKE ?'
        ).get(`%${mlz.malzeme}%`);

        db.prepare(`
          INSERT INTO analiz_ekipman_eslesmesi
            (foto_analiz_id, ekipman_katalog_id, nesne_tipi, tespit_detay, miktar, guven_skoru)
          VALUES (?, ?, 'malzeme_ozeti', ?, ?, ?)
        `).run(
          analizId,
          katalog?.id || null,
          mlz.malzeme,
          mlz.miktar,
          sonuc.guven_skoru || null
        );
      }
    }

    return analizId;
  }

  // İlgili katalog verilerini getir (prompt'a enjekte etmek için)
  async getRelevantCatalog(kategori = null) {
    const db = getDb();
    if (kategori) {
      return db.prepare(
        'SELECT * FROM ekipman_katalogu WHERE kategori = ? AND aktif = 1'
      ).all(kategori);
    }
    // Tüm aktif katalog (en çok kullanılanlar önce)
    return db.prepare(
      'SELECT * FROM ekipman_katalogu WHERE aktif = 1 ORDER BY kategori'
    ).all();
  }

  // Belirli bir fotoğrafın tüm analizleri
  getAnalysesByMedia(medyaId) {
    const db = getDb();
    const analyses = db.prepare(`
      SELECT fa.*, 
        (SELECT COUNT(*) FROM analiz_ekipman_eslesmesi WHERE foto_analiz_id = fa.id) as eslesmis_ekipman_sayisi
      FROM foto_analiz fa
      WHERE fa.medya_id = ?
      ORDER BY fa.analiz_katmani, fa.olusturma_tarihi DESC
    `).all(medyaId);
    return analyses;
  }

  // Bir analizin ekipman eşleşmeleri
  getEquipmentMatches(analizId) {
    const db = getDb();
    return db.prepare(`
      SELECT ae.*, ek.ekipman_kodu, ek.ekipman_adi, ek.kategori as katalog_kategori
      FROM analiz_ekipman_eslesmesi ae
      LEFT JOIN ekipman_katalogu ek ON ae.ekipman_katalog_id = ek.id
      WHERE ae.foto_analiz_id = ?
    `).all(analizId);
  }

  // Koordinatör onay/düzeltme
  approveAnalysis(analizId, personelId, durum, duzeltmeNotlari = null) {
    const db = getDb();
    db.prepare(`
      UPDATE foto_analiz
      SET onay_durumu = ?, onaylayan_personel_id = ?, onay_tarihi = CURRENT_TIMESTAMP,
          duzeltme_notlari = ?
      WHERE id = ?
    `).run(durum, personelId, duzeltmeNotlari, analizId);
  }

  // Ekipman eşleşmesini düzelt
  correctEquipmentMatch(eslesmeId, duzeltmeNotu, dogruKatalogId = null) {
    const db = getDb();
    db.prepare(`
      UPDATE analiz_ekipman_eslesmesi
      SET onay_durumu = 'duzeltildi', duzeltme_notu = ?,
          ekipman_katalog_id = COALESCE(?, ekipman_katalog_id)
      WHERE id = ?
    `).run(duzeltmeNotu, dogruKatalogId, eslesmeId);
  }

  // İstatistikler: AI doğruluk oranı
  getAccuracyStats() {
    const db = getDb();
    return db.prepare(`
      SELECT
        analiz_katmani,
        COUNT(*) as toplam,
        SUM(CASE WHEN onay_durumu = 'onaylandi' THEN 1 ELSE 0 END) as onaylanan,
        SUM(CASE WHEN onay_durumu = 'duzeltildi' THEN 1 ELSE 0 END) as duzeltilen,
        ROUND(AVG(guven_skoru), 2) as ort_guven
      FROM foto_analiz
      WHERE onay_durumu != 'beklemede'
      GROUP BY analiz_katmani
    `).all();
  }
}

module.exports = new AnalysisService();
```

---

## Metin Mesaj Handler

### `server/telegram/handlers/messageHandler.js`

```javascript
const registrationService = require('../services/registrationService');
const dataBundleService = require('../services/dataBundleService');
const messageParser = require('../ai/messageParser');
const messages = require('../utils/messages');
const { getDb } = require('../../db/database');

class MessageHandler {

  async handleText(bot, msg) {
    const telegramId = String(msg.from.id);
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    // 1. Kullanıcı doğrulama
    const auth = registrationService.authenticate(telegramId);
    if (!auth.authenticated) {
      return bot.sendMessage(chatId, messages.notRegistered);
    }

    const { user } = auth;
    const startTime = Date.now();

    try {
      // 2. Aktif veri paketi varsa, mesajı not olarak ekle
      const activeBundle = dataBundleService.getActiveBundle(user.personel_id);
      if (activeBundle) {
        dataBundleService.appendNote(activeBundle.id, text);
        await bot.sendMessage(chatId,
          `📝 Not eklendi → Paket: ${activeBundle.paket_no}`
        );
        this.logMessage(telegramId, text, { action: 'note_to_bundle', bundleId: activeBundle.id }, Date.now() - startTime);
        return;
      }

      // 3. AI ile mesajı analiz et
      const parsed = await messageParser.parseTextMessage(text);

      if (!parsed || !parsed.islemler || parsed.islemler.length === 0) {
        await bot.sendMessage(chatId,
          '❓ Mesajınızı anlayamadım. Lütfen daha açık yazın veya /yardim komutunu kullanın.'
        );
        this.logMessage(telegramId, text, null, Date.now() - startTime);
        return;
      }

      // 4. Her işlemi sırayla yürüt
      const results = [];
      for (const islem of parsed.islemler) {
        const result = await this.processIslem(islem, user);
        results.push(result);
      }

      // 5. Özet onay mesajı gönder
      const summary = results.map(r => r.message).join('\n');
      await bot.sendMessage(chatId, summary, { parse_mode: 'HTML' });

      // 6. Anlaşılamayan kısım varsa bildir
      if (parsed.anlasilamayan) {
        await bot.sendMessage(chatId,
          `⚠️ Şu kısım anlaşılamadı: "${parsed.anlasilamayan}"`
        );
      }

      this.logMessage(telegramId, text, parsed, Date.now() - startTime);

    } catch (error) {
      console.error('Metin işleme hatası:', error);
      await bot.sendMessage(chatId, messages.processingError);
      this.logMessage(telegramId, text, null, Date.now() - startTime, error.message);
    }
  }

  // İşlem tipine göre veritabanına kaydet
  async processIslem(islem, user) {
    const db = getDb();

    switch (islem.tip) {
      case 'gunluk_rapor': {
        // Proje ID bul
        let projeId = null;
        if (islem.proje_no) {
          const proje = db.prepare('SELECT id FROM projeler WHERE proje_no = ?').get(islem.proje_no);
          projeId = proje?.id;
        }

        db.prepare(`
          INSERT INTO gunluk_rapor
            (ekip_id, proje_id, bolge_id, kisi_sayisi, yapilan_is, kaynak)
          VALUES (?, ?, ?, ?, ?, 'telegram')
        `).run(
          user.ekip_id, projeId, null,
          islem.detay?.kisi_sayisi || 0,
          islem.detay?.yapilan_is || ''
        );

        return {
          success: true,
          message: `✅ <b>Günlük rapor kaydedildi</b>\n👷 ${islem.detay?.kisi_sayisi || '?'} kişi | ${islem.proje_no || 'Proje belirtilmedi'}`
        };
      }

      case 'malzeme_kullanim': {
        const malzemeler = islem.detay?.malzemeler || [];
        let msg = '✅ <b>Malzeme kullanımı kaydedildi:</b>\n';

        for (const mlz of malzemeler) {
          // Malzeme adıyla ara
          const malzeme = db.prepare(
            'SELECT id FROM malzemeler WHERE malzeme_adi LIKE ?'
          ).get(`%${mlz.adi}%`);

          if (malzeme) {
            db.prepare(`
              INSERT INTO malzeme_hareketleri
                (malzeme_id, miktar, hareket_tipi, ekip_id, kaynak)
              VALUES (?, ?, 'cikis', ?, 'telegram')
            `).run(malzeme.id, mlz.miktar, user.ekip_id);
            msg += `  📦 ${mlz.adi}: ${mlz.miktar} ${mlz.birim || ''}\n`;
          } else {
            msg += `  ⚠️ ${mlz.adi}: tanımsız malzeme\n`;
          }
        }
        return { success: true, message: msg };
      }

      case 'malzeme_talep': {
        const talep = islem.detay;
        const malzemeListesi = (talep?.malzemeler || [])
          .map(m => `${m.adi}: ${m.miktar} ${m.birim || ''}`).join(', ');

        db.prepare(`
          INSERT INTO talepler
            (ekip_id, talep_eden_id, talep_tipi, aciklama, talep_detay, oncelik, kaynak)
          VALUES (?, ?, 'malzeme', ?, ?, ?, 'telegram')
        `).run(
          user.ekip_id, user.personel_id,
          `Malzeme talebi: ${malzemeListesi}`,
          JSON.stringify(talep?.malzemeler),
          talep?.aciliyet === 'acil' ? 'acil' : 'normal'
        );

        return {
          success: true,
          message: `📨 <b>Malzeme talebi oluşturuldu</b>\n${malzemeListesi}`
        };
      }

      case 'enerji_kesintisi': {
        db.prepare(`
          INSERT INTO talepler
            (ekip_id, talep_eden_id, talep_tipi, aciklama, talep_detay, oncelik, kaynak)
          VALUES (?, ?, 'enerji_kesintisi', ?, ?, 'yuksek', 'telegram')
        `).run(
          user.ekip_id, user.personel_id,
          `Enerji kesintisi talebi`,
          JSON.stringify(islem.detay)
        );

        return {
          success: true,
          message: `⚡ <b>Enerji kesintisi talebi kaydedildi</b>\n${islem.detay?.tarih || ''} ${islem.detay?.baslama || ''}-${islem.detay?.bitis || ''}`
        };
      }

      case 'ariza_bildirim': {
        db.prepare(`
          INSERT INTO talepler
            (ekip_id, talep_eden_id, talep_tipi, aciklama, oncelik, kaynak)
          VALUES (?, ?, 'teknik_destek', ?, ?, 'telegram')
        `).run(
          user.ekip_id, user.personel_id,
          islem.detay?.aciklama || 'Arıza bildirimi',
          islem.detay?.aciliyet === 'acil' ? 'acil' : 'normal'
        );

        return {
          success: true,
          message: `🔧 <b>Arıza bildirimi kaydedildi</b>\n${islem.detay?.aciklama || ''}`
        };
      }

      default:
        return {
          success: true,
          message: `📝 Mesaj kaydedildi: "${islem.detay?.mesaj || ''}"`
        };
    }
  }

  logMessage(telegramId, text, parsed, duration, error = null) {
    const db = getDb();
    db.prepare(`
      INSERT INTO telegram_mesaj_log
        (telegram_id, mesaj_tipi, yon, ham_mesaj, ai_parse_sonucu, islem_durumu, hata_detay, islem_suresi_ms)
      VALUES (?, 'text', 'gelen', ?, ?, ?, ?, ?)
    `).run(
      telegramId, text,
      parsed ? JSON.stringify(parsed) : null,
      error ? 'hata' : 'islendi',
      error, duration
    );
  }
}

module.exports = new MessageHandler();
```

---

## Türkçe Mesaj Şablonları

### `server/telegram/utils/messages.js`

```javascript
module.exports = {
  notRegistered:
    '⚠️ Kayıtlı değilsiniz.\n' +
    'Sistemi kullanmak için /kayit komutunu gönderin.',

  welcomeMessage:
    '👋 <b>ElektraTrack Saha Asistanına Hoş Geldiniz!</b>\n\n' +
    'Sisteme kayıt olmak için /kayit komutunu kullanın.\n' +
    'Komut listesi için /yardim yazın.',

  registrationSuccess: (name, team) =>
    `✅ <b>Kayıt başarılı!</b>\n` +
    `👤 ${name}\n` +
    `👥 ${team}\n\n` +
    `Artık mesaj, fotoğraf ve konum gönderebilirsiniz.`,

  helpMessage:
    '📋 <b>Kullanılabilir Komutlar:</b>\n\n' +
    '/kayit — Sisteme kayıt ol\n' +
    '/durum — Ekip ve proje durumu\n' +
    '/ekip — Ekip bilgileri\n' +
    '/paket [tip] [proje] — Veri paketi başlat\n' +
    '/paket tamam — Paketi tamamla\n' +
    '/iptal — Aktif paketi iptal et\n' +
    '/yardim — Bu mesaj\n\n' +
    '📸 <b>Fotoğraf Gönderme:</b>\n' +
    'Fotoğraf + açıklama gönderin, otomatik kaydedilir.\n' +
    'GPS açık çekilen fotoğraflarda konum otomatik alınır.\n\n' +
    '📍 <b>Konum Gönderme:</b>\n' +
    'Telegram\'dan konum paylaşın.\n\n' +
    '💬 <b>Serbest Mesaj:</b>\n' +
    'Günlük rapor, malzeme bildirimi vb. serbest yazın.\n' +
    'Yapay zeka mesajınızı anlayıp işlem yapar.\n\n' +
    '<b>Örnek mesajlar:</b>\n' +
    '<i>"Bugün 4 kişi Bafra\'da YB-2025-001 üzerinde kablo çekimi yaptık"</i>\n' +
    '<i>"Depodan 120m 3x150 kablo ve 30 klemens aldık"</i>\n' +
    '<i>"Yarın için 50 adet klemens lazım, acil"</i>',

  processingError:
    '❌ Mesajınız işlenirken bir hata oluştu.\n' +
    'Lütfen tekrar deneyin veya koordinatörünüze bildirin.',

  bundleStarted: (paketNo, tip, proje) =>
    `📦 <b>Veri paketi oluşturuldu: ${paketNo}</b>\n` +
    `Tip: ${tip}${proje ? ` | Proje: ${proje}` : ''}\n\n` +
    `Şimdi fotoğraf, konum ve notlarınızı gönderin.\n` +
    `Bitirdiğinizde /paket tamam yazın.\n` +
    `15 dakika mesaj gelmezse otomatik tamamlanır.`,

  bundleCompleted: (paketNo, fotoSayisi, hasLocation, hasNotes) =>
    `✅ <b>Veri paketi tamamlandı: ${paketNo}</b>\n` +
    `📸 ${fotoSayisi} fotoğraf` +
    `${hasLocation ? ' | 📍 Konum var' : ' | ⚠️ Konum yok'}` +
    `${hasNotes ? ' | 📝 Not var' : ''}\n` +
    `Koordinatöre bildirildi.`,

  bundleCancelled: (paketNo) =>
    `🚫 Veri paketi iptal edildi: ${paketNo}`,

  noBundleTypes:
    '📦 <b>Paket Tipleri:</b>\n' +
    'direk_tespit — Direk fotoğrafı + konum\n' +
    'montaj_oncesi — Montaj öncesi durum\n' +
    'montaj_sonrasi — Montaj sonrası durum\n' +
    'hasar_tespit — Hasar/arıza bildirimi\n' +
    'malzeme_tespit — Malzeme durumu\n' +
    'ilerleme_raporu — İlerleme fotoğrafı\n' +
    'guzergah_tespit — Kablo güzergahı\n\n' +
    'Kullanım: /paket direk_tespit YB-2025-001'
};
```

---

## Web Uygulaması API Eklentileri

Mevcut API'ye eklenecek endpoint'ler:

### Medya / Fotoğraf Yönetimi

```
GET    /api/medya                       → Tüm medya listesi (filtre: ?proje_id=&ekip_id=&tarih=)
GET    /api/medya/:id                   → Medya detay
GET    /api/medya/:id/dosya             → Fotoğraf dosyasını sun (binary)
GET    /api/medya/:id/thumbnail         → Thumbnail dosyasını sun
DELETE /api/medya/:id                   → Medya sil
GET    /api/medya/harita                → Konumlu medyalar (harita görünümü için)
```

### Veri Paketleri

```
GET    /api/veri-paketleri              → Tüm paketler (filtre: ?proje_id=&ekip_id=&tip=&tarih=)
GET    /api/veri-paketleri/:id          → Paket detay (medyalar dahil)
PUT    /api/veri-paketleri/:id          → Paket güncelle (tip, proje, not değiştirme)
DELETE /api/veri-paketleri/:id          → Paket sil
GET    /api/veri-paketleri/:id/medya    → Paketin medyaları
```

### Telegram Yönetimi

```
GET    /api/telegram/kullanicilar       → Kayıtlı Telegram kullanıcıları
POST   /api/telegram/kullanicilar       → Manuel kullanıcı eşleştirme
DELETE /api/telegram/kullanicilar/:id   → Kullanıcı eşleştirmesini kaldır
GET    /api/telegram/mesaj-log          → Mesaj logu (filtre: ?tarih=&durum=)
GET    /api/telegram/istatistik         → Bot kullanım istatistikleri
POST   /api/telegram/ayarlar            → Bot ayarlarını güncelle (token, API key)
GET    /api/telegram/durum              → Bot çalışıyor mu? Son mesaj ne zaman?
```

### Ekipman Kataloğu

```
GET    /api/katalog                     → Tüm ekipman kataloğu (filtre: ?kategori=&gerilim=)
GET    /api/katalog/:id                 → Ekipman detay (referans fotoğraflar dahil)
POST   /api/katalog                     → Yeni ekipman tanımı ekle
PUT    /api/katalog/:id                 → Ekipman güncelle
DELETE /api/katalog/:id                 → Ekipman sil
POST   /api/katalog/:id/referans-foto   → Referans fotoğraf yükle
DELETE /api/katalog/:id/referans-foto/:fotoId → Referans fotoğraf sil
GET    /api/katalog/kategoriler          → Kategori listesi (özet sayılarla)
POST   /api/katalog/toplu-yukle         → Excel/CSV'den toplu ekipman yükleme
```

### Fotoğraf Analiz

```
GET    /api/analiz                       → Tüm analizler (filtre: ?katman=&tip=&onay=)
GET    /api/analiz/:id                   → Analiz detay (eşleşen ekipmanlar dahil)
POST   /api/analiz/baslat                → Manuel analiz başlat {medya_id, katman, tip}
PUT    /api/analiz/:id/onayla            → Koordinatör onay {durum, duzeltme_notlari}
GET    /api/analiz/medya/:medyaId        → Bir fotoğrafın tüm analizleri
GET    /api/analiz/paket/:paketId        → Bir paketin tüm analizleri

PUT    /api/analiz/eslesmeler/:id        → Ekipman eşleşmesini düzelt
GET    /api/analiz/istatistik            → AI doğruluk oranları, katman bazlı
GET    /api/analiz/malzeme-ozet/:projeId → Proje bazlı tespit edilen malzeme özeti
```

### AI Yönetimi

```
GET    /api/ai/durum                     → AI sağlık kontrolü (hangi katmanlar çalışıyor)
GET    /api/ai/ayarlar                   → AI yapılandırma ayarları
PUT    /api/ai/ayarlar                   → AI ayarlarını güncelle
GET    /api/ai/ollama/modeller           → Ollama'da yüklü modeller
POST   /api/ai/ollama/model-indir        → Yeni Ollama modeli indir {model_adi}
```

---

## Frontend Eklentileri

Mevcut web uygulamasına eklenecek sayfalar/bileşenler:

### Veri Paketleri Sayfası

```
┌──────────────────────────────────────────────────────────────────┐
│  Veri Paketleri                          [Filtrele ▾] [Harita]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ VP-2025-0042 | Direk Tespit | YB-2025-001               │   │
│  │ 📸 3 fotoğraf | 📍 41.6833, 35.9167 | Ekip 1            │   │
│  │ 🕐 08.02.2026 09:15 | ✅ Tamamlandı                     │   │
│  │ Not: "3 nolu direk, çürüme var, değişmeli"              │   │
│  │ 🤖 AI: 2x konsol, 6x izolatör, hasar var ⚠️            │   │
│  │ [Fotoğraflar: 🖼️ 🖼️ 🖼️]  [📊 Analiz] [✅ Onayla]       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Paket Detay — Fotoğraf Galerisi + Analiz Sonuçları

```
┌──────────────────────────────────────────────────────────────────┐
│  ← VP-2025-0042 | Direk Tespit                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Proje: YB-2025-001 | Ekip: Ekip 1 | Ahmet Yıldız             │
│  📍 41.6833, 35.9167 | 🕐 08.02.2026 09:15                     │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    📝 NOTLAR                             │   │
│  │  "3 nolu direk, çürüme var, değişmeli"                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────┐  ┌────────┐  ┌────────┐                            │
│  │        │  │        │  │        │                            │
│  │  📸 1  │  │  📸 2  │  │  📸 3  │                            │
│  │        │  │        │  │        │                            │
│  │GPS: ✅ │  │GPS: ✅ │  │GPS: ❌ │                            │
│  │AI: ✅  │  │AI: ✅  │  │AI: ⏳  │                            │
│  └────────┘  └────────┘  └────────┘                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  🤖 AI ANALİZ SONUÇLARI (Fotoğraf #1)                   │   │
│  │                                                          │   │
│  │  Katman 2 — Genel Tanıma (Ollama, lokal)     Güven: 82% │   │
│  │  "Beton direk, OG havai hat, 3 faz, hasar tespit edildi" │   │
│  │                                                          │   │
│  │  [🔍 Detaylı Analiz Yap (Katman 3)] ← Cloud API butonu  │   │
│  │                                                          │   │
│  │  ┌── Katman 3 — Direk Analizi (Claude) ──────────────┐  │   │
│  │  │  Direk: Beton, ~12m, OG (34.5kV)                  │  │   │
│  │  │                                                    │  │   │
│  │  │  Tespit Edilen Ekipmanlar:                         │  │   │
│  │  │  ┌────────────────┬──────┬───────┬──────────────┐ │  │   │
│  │  │  │ Ekipman        │Miktar│ Güven │ Katalog Eşl. │ │  │   │
│  │  │  ├────────────────┼──────┼───────┼──────────────┤ │  │   │
│  │  │  │ L Konsol 1200mm│  2   │  85%  │ KNS-L-1200 ✅│ │  │   │
│  │  │  │ Cam İzol. U70BL│  6   │  78%  │ IZL-CAM-U70 ✅│ │  │   │
│  │  │  │ ACSR ~95mm²    │ 3faz │  62%  │ — (belirsiz) │ │  │   │
│  │  │  │ Gergi Armatürü │  2   │  71%  │ ARM-GRG-95  ✅│ │  │   │
│  │  │  └────────────────┴──────┴───────┴──────────────┘ │  │   │
│  │  │                                                    │  │   │
│  │  │  ⚠️ Hasar: 1 izolatör kırık (orta seviye)         │  │   │
│  │  │                                                    │  │   │
│  │  │  [✅ Onayla] [✏️ Düzelt] [❌ Reddet]               │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  🗺️  MİNİ HARİTA                                       │   │
│  │  [Fotoğraf konumları harita üzerinde gösterilir]         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Ekipman Kataloğu Sayfası

```
┌──────────────────────────────────────────────────────────────────┐
│  Ekipman Kataloğu                    [+ Ekipman Ekle] [📥 İçe]  │
├──────────────────────────────────────────────────────────────────┤
│  Kategoriler:                                                    │
│  [Tümü] [Konsol(8)] [İzolatör(5)] [İletken(12)] [Armatür(6)]   │
│  [Direk(4)] [Trafo(3)] [Pano(2)] [Aksesuar(15)]                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 🖼️ │ KNS-L-1200 | L Konsol 1200mm                       │   │
│  │    │ Galvaniz çelik | 34.5kV | 3 referans foto           │   │
│  │    │ AI Eşleşme: 42 kez tespit, 38 onay (%90 doğruluk)  │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ 🖼️ │ IZL-CAM-U70 | Cam İzolatör U70BL                   │   │
│  │    │ 36kV, 70kN mekanik dayanım | 5 referans foto        │   │
│  │    │ AI Eşleşme: 78 kez tespit, 65 onay (%83 doğruluk)  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### AI Yönetim Sayfası

```
┌──────────────────────────────────────────────────────────────────┐
│  🤖 AI Yönetimi                                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Servis Durumu:                                                  │
│  ┌────────────────────────────────────────────────────┐         │
│  │ Katman 1 (Metin)   │ ● Çalışıyor │ qwen2.5:7b     │         │
│  │ Katman 2 (Görsel)  │ ● Çalışıyor │ llama3.2-vision│         │
│  │ Katman 3 (Detaylı) │ ○ Kapalı    │ API key giriniz│         │
│  │ Ollama Sunucu      │ ● Çalışıyor │ localhost:11434 │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                  │
│  Ayarlar:                                                       │
│  ┌────────────────────────────────────────────────────┐         │
│  │ Ollama Adresi:    [http://localhost:11434      ]   │         │
│  │ Metin Modeli:     [qwen2.5:7b              ▾   ]   │         │
│  │ Vision Modeli:    [llama3.2-vision:11b     ▾   ]   │         │
│  │ Oto. Analiz Sev.: [Katman 2 (Genel Görsel) ▾   ]   │         │
│  │                                                    │         │
│  │ Cloud API:        [Claude  ▾]                      │         │
│  │ API Key:          [sk-ant-•••••••          ]       │         │
│  │                                      [Kaydet]      │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                  │
│  AI Doğruluk İstatistikleri:                                    │
│  ┌────────────────────────────────────────────────────┐         │
│  │ Katman │ Toplam │ Onay │ Düzelt │ Doğruluk │ Güven│         │
│  │ K2     │   156  │  130 │   26   │   83%    │ 0.74 │         │
│  │ K3     │    42  │   38 │    4   │   90%    │ 0.82 │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Sidebar Eklentisi

```
│  📊 Dashboard       │
│  👥 Ekipler         │
│  🏗️ Projeler        │
│  📦 Malzeme         │
│  👤 Personel        │
│  📋 Puantaj         │
│  📨 Talepler        │
│  ✅ Görevler        │
│  📸 Veri Paketleri  │  ← YENİ
│  🔧 Ekipman Katalog │  ← YENİ (malzeme referans tanımları)
│  📈 Raporlar        │
│  ──────────────     │
│  🤖 AI & Telegram   │  ← YENİ (AI yönetim, bot, kullanıcılar, log)
│  ⚙️ Ayarlar         │
```

---

## Zamanlanmış Görevler

`server/telegram/bot.js`'e eklenecek cron görevleri:

```javascript
const cron = require('node-cron');

// Her 5 dakikada süresi dolmuş paketleri tamamla
cron.schedule('*/5 * * * *', () => {
  const expired = dataBundleService.autoCompleteExpiredBundles();
  if (expired.length > 0) {
    console.log(`⏰ ${expired.length} veri paketi otomatik tamamlandı.`);
  }
});

// Her gün 18:00'de rapor göndermeyenlere hatırlatma
cron.schedule('0 18 * * 1-6', async () => {
  // Bugün rapor göndermemiş ekipleri bul
  const db = getDb();
  const raporGondermeyenEkipler = db.prepare(`
    SELECT e.id, e.ekip_adi, tk.telegram_id
    FROM ekipler e
    JOIN personel p ON p.ekip_id = e.id AND p.gorev = 'ekip_basi'
    LEFT JOIN telegram_kullanicilar tk ON tk.personel_id = p.id
    WHERE e.durum = 'aktif'
      AND e.id NOT IN (
        SELECT DISTINCT ekip_id FROM gunluk_rapor
        WHERE tarih = date('now')
      )
  `).all();

  for (const ekip of raporGondermeyenEkipler) {
    if (ekip.telegram_id && bot) {
      await bot.sendMessage(ekip.telegram_id,
        `⏰ <b>Hatırlatma:</b> Bugün için günlük rapor göndermediniz.\n` +
        `Lütfen çalışma durumunuzu bildirin.`,
        { parse_mode: 'HTML' }
      );
    }
  }
});

// Her gün 08:00'de ekiplere günaydın + günün görevleri
cron.schedule('0 8 * * 1-6', async () => {
  // Her ekibe bugünkü görevlerini gönder
  const db = getDb();
  const ekipler = db.prepare(`
    SELECT e.id, e.ekip_adi, tk.telegram_id
    FROM ekipler e
    JOIN personel p ON p.ekip_id = e.id AND p.gorev = 'ekip_basi'
    LEFT JOIN telegram_kullanicilar tk ON tk.personel_id = p.id
    WHERE e.durum = 'aktif' AND tk.telegram_id IS NOT NULL
  `).all();

  for (const ekip of ekipler) {
    const gorevler = db.prepare(`
      SELECT g.gorev_basligi, p.proje_no
      FROM gorevler g
      LEFT JOIN projeler p ON g.proje_id = p.id
      WHERE g.ekip_id = ? AND g.durum IN ('atandi', 'devam_ediyor')
      ORDER BY g.oncelik DESC
    `).all(ekip.id);

    if (gorevler.length > 0) {
      let msg = `🌅 <b>Günaydın ${ekip.ekip_adi}!</b>\n\nBugünkü görevler:\n`;
      gorevler.forEach((g, i) => {
        msg += `${i+1}. ${g.gorev_basligi}${g.proje_no ? ` (${g.proje_no})` : ''}\n`;
      });
      msg += '\nİyi çalışmalar! 💪';

      await bot.sendMessage(ekip.telegram_id, msg, { parse_mode: 'HTML' });
    }
  }
});
```

---

## Geliştirme Sırası

### Faz 1 — Temel Altyapı
1. **Veritabanı şema eklentileri**: Tüm yeni tabloları mevcut schema.sql'e ekle
2. **Ollama kurulum + doğrulama**: Ollama kur, modelleri indir, API çalışıyor mu test et
3. **Bot altyapısı**: bot.js, config.js (3 katmanlı), server.js entegrasyonu
4. **Kayıt sistemi**: registrationService + commandHandler (/start, /kayit)

### Faz 2 — Medya ve Veri Paketi
5. **Medya servisi**: Fotoğraf indirme, EXIF/GPS okuma, dosya kaydetme
6. **Veri paketi servisi**: Paket oluşturma, fotoğraf ekleme, otomatik tamamlama
7. **AI Manager + Katman 1**: ollamaProvider metin parse, test et
8. **Fotoğraf handler**: Tam fotoğraf işleme akışı (kaydet + Katman 1 caption)
9. **Metin handler**: Serbest mesaj analizi ve işleme
10. **Konum handler**: Telegram konum mesajları

### Faz 3 — Görsel Analiz
11. **Katman 2**: ollamaProvider vision, genel fotoğraf tanıma
12. **Katman 3**: cloudProvider (Claude/OpenAI), detaylı direk analizi
13. **Analiz servisi**: Sonuçları kaydet, ekipman eşleştir, onay mekanizması
14. **Ekipman kataloğu**: Katalog CRUD + seed data + referans fotoğraf yükleme

### Faz 4 — Web Arayüzü
15. **Web API'ler**: Medya, veri paketi, analiz, katalog, AI endpoint'leri
16. **Veri Paketleri sayfası**: Liste + detay + fotoğraf galerisi
17. **Analiz görünümü**: AI sonuçları, ekipman tablosu, onay/düzelt butonları
18. **Ekipman Kataloğu sayfası**: Katalog yönetimi, referans fotoğraflar
19. **AI Yönetim sayfası**: Servis durumu, ayarlar, istatistikler

### Faz 5 — Otomasyon + İyileştirme
20. **Cron görevleri**: Otomatik tamamlama, hatırlatmalar, günlük özetler
21. **Bildirim sistemi**: Koordinatöre acil durum bildirimleri
22. **Doğruluk takibi**: AI onay/düzeltme verilerinden doğruluk raporları

---

## Ekipman Kataloğu Seed Data

İlk kurulumda yüklenecek temel ekipman tanımları:

```sql
-- ============================================
-- TEMEL EKİPMAN KATALOĞU (OG Hat — 34.5kV)
-- ============================================

-- Konsollar
INSERT INTO ekipman_katalogu (kategori, ekipman_kodu, ekipman_adi, alt_kategori, teknik_ozellikler, gorsel_ozellikler, gerilim_sinifi) VALUES
('konsol', 'KNS-L-1200', 'L Konsol 1200mm', 'L tipi', '{"uzunluk_mm":1200,"malzeme":"galvaniz çelik","gerilim":"34.5kV"}', '{"sekil":"L şeklinde tek kol","renk":"gri/galvaniz","baglanti":"direk gövdesine cıvatalı"}', 'OG'),
('konsol', 'KNS-L-1500', 'L Konsol 1500mm', 'L tipi', '{"uzunluk_mm":1500,"malzeme":"galvaniz çelik","gerilim":"34.5kV"}', '{"sekil":"L şeklinde tek kol, uzun","renk":"gri/galvaniz"}', 'OG'),
('konsol', 'KNS-T-1200', 'T Konsol 1200mm', 'T tipi', '{"uzunluk_mm":1200,"malzeme":"galvaniz çelik","gerilim":"34.5kV"}', '{"sekil":"T şeklinde çift kol simetrik","renk":"gri/galvaniz"}', 'OG'),
('konsol', 'KNS-V-1000', 'V Konsol 1000mm', 'V tipi', '{"uzunluk_mm":1000,"malzeme":"galvaniz çelik","gerilim":"34.5kV"}', '{"sekil":"V şeklinde çapraz iki kol","renk":"gri/galvaniz"}', 'OG'),
('konsol', 'KNS-AYR', 'Ayırıcı Konsolu', 'Ayırıcı', '{"malzeme":"galvaniz çelik","gerilim":"34.5kV"}', '{"sekil":"U profil yatay, ayırıcı montaj noktaları var"}', 'OG');

-- İzolatörler
INSERT INTO ekipman_katalogu (kategori, ekipman_kodu, ekipman_adi, alt_kategori, teknik_ozellikler, gorsel_ozellikler, gerilim_sinifi) VALUES
('izolator', 'IZL-CAM-U70', 'Cam İzolatör U70BL', 'cam', '{"tip":"cam","model":"U70BL","gerilim":"36kV","mekanik_dayanim":"70kN"}', '{"sekil":"disk/çan şekli","renk":"kahverengi/koyu yeşil cam","dizilim":"zincir halinde dizilebilir"}', 'OG'),
('izolator', 'IZL-CAM-U120', 'Cam İzolatör U120BL', 'cam', '{"tip":"cam","model":"U120BL","gerilim":"36kV","mekanik_dayanim":"120kN"}', '{"sekil":"büyük disk/çan","renk":"kahverengi cam","dizilim":"zincir, U70den büyük"}', 'OG'),
('izolator', 'IZL-PRS-P70', 'Porselen İzolatör P70', 'porselen', '{"tip":"porselen","gerilim":"36kV","mekanik_dayanim":"70kN"}', '{"sekil":"disk","renk":"gri/beyaz porselen mat yüzey"}', 'OG'),
('izolator', 'IZL-PLM-36', 'Polimer İzolatör 36kV', 'polimer', '{"tip":"polimer/kompozit","gerilim":"36kV"}', '{"sekil":"uzun silindirik gövde, diskli yüzey","renk":"kırmızı/kahverengi silikon kaplamalı"}', 'OG');

-- İletkenler
INSERT INTO ekipman_katalogu (kategori, ekipman_kodu, ekipman_adi, alt_kategori, teknik_ozellikler, gorsel_ozellikler, gerilim_sinifi) VALUES
('iletken', 'ILT-ACSR-50', 'ACSR İletken 50mm²', 'ACSR', '{"tip":"ACSR","kesit_mm2":50,"hawk_kodu":"Rabbit","akim_kapasitesi":"210A"}', '{"gorunus":"çok telli alüminyum üzeri çelik çekirdek","kalinlik":"ince","renk":"gümüş/mat"}', 'OG'),
('iletken', 'ILT-ACSR-95', 'ACSR İletken 95mm²', 'ACSR', '{"tip":"ACSR","kesit_mm2":95,"hawk_kodu":"Hawk","akim_kapasitesi":"340A"}', '{"gorunus":"çok telli alüminyum, belirgin kalınlık","kalinlik":"orta","renk":"gümüş/mat"}', 'OG'),
('iletken', 'ILT-ACSR-150', 'ACSR İletken 150mm²', 'ACSR', '{"tip":"ACSR","kesit_mm2":150,"hawk_kodu":"Drake","akim_kapasitesi":"450A"}', '{"gorunus":"kalın çok telli alüminyum","kalinlik":"kalin","renk":"gümüş/mat"}', 'OG'),
('iletken', 'ILT-XLPE-3x150', 'XLPE Kablo 3x150mm²', 'XLPE', '{"tip":"XLPE","kesit_mm2":150,"kor_sayisi":3}', '{"gorunus":"siyah dış kılıf, üç damarlı","renk":"siyah"}', 'OG');

-- Armatürler
INSERT INTO ekipman_katalogu (kategori, ekipman_kodu, ekipman_adi, alt_kategori, teknik_ozellikler, gorsel_ozellikler, gerilim_sinifi) VALUES
('armatur', 'ARM-GRG-50', 'Gergi Armatürü 50mm²', 'gergi', '{"tip":"gergi","iletken_kesit":"35-50mm2","malzeme":"aluminyum"}', '{"sekil":"silindirik sıkma, izolatör zincire bağlantılı"}', 'OG'),
('armatur', 'ARM-GRG-95', 'Gergi Armatürü 95mm²', 'gergi', '{"tip":"gergi","iletken_kesit":"70-95mm2","malzeme":"aluminyum"}', '{"sekil":"silindirik sıkma, büyük boy"}', 'OG'),
('armatur', 'ARM-TSM', 'Taşıma Armatürü', 'taşıma', '{"tip":"taşıma","malzeme":"aluminyum"}', '{"sekil":"askı tipi, U şekilli tutma","renk":"gümüş"}', 'OG'),
('armatur', 'ARM-EK', 'Ek Armatürü (Sıkma Manşon)', 'ek', '{"tip":"ek/manson"}', '{"sekil":"silindirik tüp, iletken üzerine sıkılır"}', 'OG');

-- Direkler
INSERT INTO ekipman_katalogu (kategori, ekipman_kodu, ekipman_adi, alt_kategori, teknik_ozellikler, gorsel_ozellikler, gerilim_sinifi) VALUES
('direk', 'DRK-BTN-10', 'Beton Direk 10m', 'beton', '{"boy_m":10,"malzeme":"beton","tepe_yuku_kg":300,"gerilim":"34.5kV"}', '{"sekil":"konik silindir, üste doğru incelen","renk":"gri beton","yuzey":"pürüzlü"}', 'OG'),
('direk', 'DRK-BTN-12', 'Beton Direk 12m', 'beton', '{"boy_m":12,"malzeme":"beton","tepe_yuku_kg":500,"gerilim":"34.5kV"}', '{"sekil":"konik silindir, uzun","renk":"gri beton"}', 'OG'),
('direk', 'DRK-CLK-12', 'Çelik Direk 12m', 'çelik', '{"boy_m":12,"malzeme":"galvaniz çelik","gerilim":"34.5kV"}', '{"sekil":"kafes veya boru, metalik","renk":"galvaniz gri/parlak"}', 'OG'),
('direk', 'DRK-AHS-9', 'Ahşap Direk 9m', 'ahşap', '{"boy_m":9,"malzeme":"emprenye ahşap","gerilim":"34.5kV"}', '{"sekil":"düz silindir","renk":"koyu kahverengi, emprenye kokulu"}', 'OG');

-- AG Ekipmanları
INSERT INTO ekipman_katalogu (kategori, ekipman_kodu, ekipman_adi, alt_kategori, teknik_ozellikler, gorsel_ozellikler, gerilim_sinifi) VALUES
('konsol', 'KNS-AG-RAK', 'AG Rak', 'AG rak', '{"malzeme":"galvaniz çelik","gerilim":"0.4kV"}', '{"sekil":"düz yatay çubuk, izolatörlü","renk":"gri galvaniz"}', 'AG'),
('izolator', 'IZL-AG-GRD', 'AG Geçit İzolatörü', 'AG', '{"tip":"porselen","gerilim":"1kV"}', '{"sekil":"küçük silindir","renk":"beyaz/krem porselen"}', 'AG'),
('iletken', 'ILT-ABC-4x16', 'ABC Kablo 4x16mm²', 'ABC', '{"tip":"ABC","kesit_mm2":16,"kor_sayisi":4}', '{"gorunus":"siyah yalıtımlı bükülmüş demetli kablo","renk":"siyah"}', 'AG'),
('iletken', 'ILT-ABC-4x50', 'ABC Kablo 4x50mm²', 'ABC', '{"tip":"ABC","kesit_mm2":50,"kor_sayisi":4}', '{"gorunus":"kalın siyah yalıtımlı demetli","renk":"siyah"}', 'AG');
```

---

## Ortam Değişkenleri (.env)

```env
# Opsiyonel: Tüm bu değerler Ayarlar sayfasından da girilebilir

# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...

# Ollama (Katman 1+2)
OLLAMA_BASE_URL=http://localhost:11434

# Cloud AI - Katman 3 (Opsiyonel)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Sunucu
PORT=4000
NODE_ENV=production
```

---

## Güvenlik Notları

- Telegram bot token ve API key'ler veritabanında saklanır, `.env`'den de okunabilir
- Bot sadece kayıtlı ve eşleştirilmiş kullanıcılara yanıt verir
- Tüm gelen mesajlar `telegram_mesaj_log` tablosuna kaydedilir (denetim izi)
- Fotoğraflar sunucuda UUID ile saklanır (tahmin edilemez dosya adları)
- Web API'den medya erişimi auth kontrolü ile yapılmalıdır
- Katman 1+2 tamamen lokal çalışır, veri dışarı çıkmaz
- Katman 3 (cloud) kullanımında fotoğraf Anthropic/OpenAI'a gönderilir — kullanıcı bilgilendirilmeli
- Koordinatör bildirimlerinde hassas bilgi (GPS) dikkatli paylaşılmalı
- Analiz sonuçlarında onay mekanizması var — AI çıktısı direkt kabul edilmez

---

## Donanım Gereksinimleri (AI Dahil)

Ollama ile 2 model aynı anda çalıştırmak için:

| Senaryo | RAM | GPU | Açıklama |
|---------|-----|-----|----------|
| Sadece Katman 1 (metin) | 8 GB | Gerekmez | qwen2.5:7b CPU'da çalışır |
| Katman 1 + 2 (metin + vision) | 16 GB | Önerilir | llama3.2-vision:11b RAM'e sığar |
| Katman 1 + 2 + uygulama | **16-32 GB** | Önerilir | ⭐ Önerilen kurulum |

> **NOT:** Ollama modelleri aynı anda yüklü durmaz. İstek geldiğinde yükler, idle kalınca boşaltır.
> Bu yüzden 16GB RAM ile her iki model de çalışabilir, sadece model değişiminde 5-10sn ek bekleme olur.
