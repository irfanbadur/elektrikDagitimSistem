# ElektraTrack — Evrensel Dosya Yönetimi + Veri Paketi Sistemi

## Amaç

Projenin **tüm dosya ihtiyacını** (fotoğraf, çizim, belge, tablo, harita) tek bir evrensel yapıyla yönetmek.

**Mevcut sorun:** Eski `medya` tablosu sadece fotoğraflara odaklı. DWG, PDF, Excel gibi dosyalar için yapı yok.  
**Yeni yapı:** Her dosya tipi aynı `dosyalar` tablosundan yönetilir. Fiziksel olarak hiyerarşik klasörlerde durur. DB'de etiket, metadata, ilişki tutulur.

**Temel prensipler:**
1. **Tek tablo** → Her dosya tipi (jpeg, dwg, pdf, xlsx...) aynı tablodan sorgulanır
2. **Hiyerarşik klasör** → Fiziksel dosyalar anlamlı klasörlerde durur, DB çökse bile bulunabilir
3. **DB etiket + metadata** → Filtreleme, arama, ilişkilendirme tamamen DB'den
4. **Veri paketi** → Birden fazla dosya + not + konum bir "paket" altında gruplanır

---

## Adım 1 — Klasör Yapısı

### Fiziksel Dizin Yapısı

```
uploads/                                   ← Ana dosya kök dizini
├── {yıl}/                                 ← Yıl bazlı (klasör şişmesini önler)
│   ├── {proje_no}/                        ← Proje klasörü
│   │   ├── fotograf/                      ← Saha fotoğrafları
│   │   │   ├── 2026-02-12_D3-montaj_EK01_a1b2.jpg
│   │   │   ├── 2026-02-12_D3-montaj_EK01_c3d4.jpg
│   │   │   └── thumb/                     ← Otomatik üretilen thumbnail'lar
│   │   │       ├── 2026-02-12_D3-montaj_EK01_a1b2_thumb.jpg
│   │   │       └── 2026-02-12_D3-montaj_EK01_c3d4_thumb.jpg
│   │   ├── cizim/                         ← CAD dosyaları
│   │   │   ├── YB-2025-001_kesin-proje.dwg
│   │   │   ├── YB-2025-001_guzergah.dxf
│   │   │   └── YB-2025-001_vaziyet-plani.pdf
│   │   ├── belge/                         ← Belgeler (PDF, DOC)
│   │   │   ├── YB-2025-001_onay-belgesi.pdf
│   │   │   ├── YB-2025-001_sozlesme.pdf
│   │   │   └── YB-2025-001_teslim-tutanagi.docx
│   │   ├── tablo/                         ← Tablolar (Excel, CSV)
│   │   │   ├── YB-2025-001_malzeme-listesi.xlsx
│   │   │   └── YB-2025-001_puantaj.xlsx
│   │   └── harita/                        ← Coğrafi dosyalar
│   │       ├── YB-2025-001_guzergah.kml
│   │       └── YB-2025-001_direk-noktalari.geojson
│   │
│   ├── KET-2025-011/                      ← Başka bir proje
│   │   ├── fotograf/
│   │   ├── cizim/
│   │   ├── belge/
│   │   └── tablo/
│   │
│   └── _genel/                            ← Projeye atanmamış dosyalar
│       ├── fotograf/
│       ├── belge/
│       └── tablo/
│
├── sablon/                                ← Şablon dosyalar (proje bağımsız, sabit)
│   ├── bos-malzeme-listesi.xlsx
│   ├── kesinti-basvuru-formu.pdf
│   └── proje-teslim-formu.docx
│
└── gecici/                                ← İşlem sırasında geçici dosyalar
    └── (otomatik temizlenir)
```

### Dosya İsimlendirme Kuralları

**Fotoğraflar (saha — otomatik isimlendirilir):**
```
{tarih}_{aciklama}_{ekip}_{kisaID}.{uzanti}

Örnekler:
2026-02-12_D3-montaj_EK01_a1b2c3.jpg
2026-02-15_hasar-izolator_EK02_d4e5f6.jpg
2026-02-15_hat-cekimi_EK01_g7h8i9.jpg
```

**Proje dosyaları (çizim, belge, tablo — kullanıcı yüklemesi):**
```
{proje_no}_{aciklama}.{uzanti}

Örnekler:
YB-2025-001_kesin-proje.dwg
YB-2025-001_onay-belgesi.pdf
KET-2025-011_malzeme-listesi.xlsx
```

> Kullanıcı orijinal isimle yüklerse sistem yeniden adlandırır.  
> Orijinal isim DB'de `orijinal_adi` sütununda saklanır.

### Dosya İsimlendirme Fonksiyonu

```javascript
// server/services/dosyaIsimService.js

const { v4: uuidv4 } = require('uuid');

/**
 * Saha fotoğrafı için dosya adı üret
 * @param {Object} bilgi - { aciklama, ekipKodu, uzanti }
 * @returns {string} "2026-02-12_D3-montaj_EK01_a1b2c3.jpg"
 */
function sahaFotoAdi({ aciklama, ekipKodu, uzanti = 'jpg' }) {
  const tarih = new Date().toISOString().slice(0, 10);    // 2026-02-12
  const kisaAciklama = slugify(aciklama || 'foto');        // "D3 montaj" → "D3-montaj"
  const kisaId = uuidv4().slice(0, 6);                     // a1b2c3
  const ekip = ekipKodu || 'GENEL';

  return `${tarih}_${kisaAciklama}_${ekip}_${kisaId}.${uzanti}`;
}

/**
 * Proje dosyası için dosya adı üret
 * @param {Object} bilgi - { projeNo, aciklama, uzanti }
 * @returns {string} "YB-2025-001_kesin-proje.dwg"
 */
function projeDosyaAdi({ projeNo, aciklama, uzanti }) {
  const kisaAciklama = slugify(aciklama || 'dosya');
  return `${projeNo}_${kisaAciklama}.${uzanti}`;
}

/**
 * Dosyanın fiziksel yolunu hesapla
 * @param {Object} bilgi - { projeNo, kategori, dosyaAdi }
 * @returns {string} "2026/YB-2025-001/fotograf/2026-02-12_xxx.jpg"
 */
function dosyaYoluHesapla({ projeNo, kategori, dosyaAdi }) {
  const yil = new Date().getFullYear().toString();
  const projeKlasoru = projeNo || '_genel';
  const kategoriKlasoru = KATEGORI_KLASOR_ESLESMESI[kategori] || 'diger';

  return `${yil}/${projeKlasoru}/${kategoriKlasoru}/${dosyaAdi}`;
}

/**
 * Thumbnail yolunu hesapla
 */
function thumbnailYoluHesapla(dosyaYolu) {
  const dir = dosyaYolu.substring(0, dosyaYolu.lastIndexOf('/'));
  const adi = dosyaYolu.substring(dosyaYolu.lastIndexOf('/') + 1);
  const isim = adi.substring(0, adi.lastIndexOf('.'));
  return `${dir}/thumb/${isim}_thumb.jpg`;
}

/**
 * Türkçe karakterleri temizle, slug oluştur
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ş/g, 'S')
    .replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
    .replace(/[^a-z0-9\-]/g, '-')   // Harf/rakam dışı → tire
    .replace(/-+/g, '-')            // Çoklu tire → tek tire
    .replace(/^-|-$/g, '')          // Baş/son tire sil
    .slice(0, 40);                  // Maks 40 karakter
}

// Kategori → Fiziksel klasör eşleşmesi
const KATEGORI_KLASOR_ESLESMESI = {
  fotograf:  'fotograf',    // jpg, jpeg, png, heic, webp
  cizim:     'cizim',       // dwg, dxf, dgn
  belge:     'belge',       // pdf, doc, docx
  tablo:     'tablo',       // xls, xlsx, csv
  harita:    'harita',      // kml, kmz, geojson, gpx
  arsiv:     'arsiv',       // zip, rar, 7z
  diger:     'diger',       // geri kalan her şey
};

// Uzantı → Kategori otomatik eşleşmesi
const UZANTI_KATEGORI_ESLESMESI = {
  // Fotoğraf
  jpg: 'fotograf', jpeg: 'fotograf', png: 'fotograf',
  heic: 'fotograf', webp: 'fotograf', gif: 'fotograf',
  // Çizim
  dwg: 'cizim', dxf: 'cizim', dgn: 'cizim',
  // Belge
  pdf: 'belge', doc: 'belge', docx: 'belge', txt: 'belge',
  // Tablo
  xls: 'tablo', xlsx: 'tablo', csv: 'tablo', tsv: 'tablo',
  // Harita
  kml: 'harita', kmz: 'harita', geojson: 'harita', gpx: 'harita',
  // Arşiv
  zip: 'arsiv', rar: 'arsiv', '7z': 'arsiv',
};

function uzantidanKategori(dosyaAdi) {
  const uzanti = dosyaAdi.split('.').pop().toLowerCase();
  return UZANTI_KATEGORI_ESLESMESI[uzanti] || 'diger';
}

module.exports = {
  sahaFotoAdi,
  projeDosyaAdi,
  dosyaYoluHesapla,
  thumbnailYoluHesapla,
  slugify,
  uzantidanKategori,
  KATEGORI_KLASOR_ESLESMESI,
  UZANTI_KATEGORI_ESLESMESI,
};
```

---

## Adım 2 — Veritabanı Şeması

### Eski Tabloları Kaldır

> **ÖNEMLİ:** Eğer mevcut sistemde `medya` ve `veri_paketleri` tabloları aktif kullanılıyorsa veri taşıması (migration) gerekir. Eğer henüz gerçek veri yoksa (geliştirme aşaması) doğrudan yeni tabloları oluştur.

```sql
-- Mevcut yapı kullanılmıyorsa kaldır:
-- DROP TABLE IF EXISTS medya;
-- DROP TABLE IF EXISTS veri_paketleri;
```

### Yeni Tablo: `dosyalar` (Evrensel)

```sql
-- ============================================
-- DOSYALAR — Evrensel Dosya Tablosu
-- Tüm dosya tipleri (fotoğraf, çizim, belge, tablo, harita)
-- tek tablodan yönetilir
-- ============================================
CREATE TABLE IF NOT EXISTS dosyalar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- ─── DOSYA BİLGİLERİ ────────────────────────
    dosya_adi TEXT NOT NULL,                 -- Sistemdeki isim: "2026-02-12_D3-montaj_EK01_a1b2c3.jpg"
    orijinal_adi TEXT,                       -- Kullanıcının yüklediği orijinal isim: "IMG_4521.jpg"
    dosya_yolu TEXT NOT NULL,               -- Göreceli yol: "2026/YB-2025-001/fotograf/xxx.jpg"
    thumbnail_yolu TEXT,                     -- Thumbnail yolu (fotoğraflar için)
    dosya_boyutu INTEGER,                    -- Byte cinsinden
    mime_tipi TEXT,                          -- "image/jpeg", "application/pdf", "application/dwg"

    -- ─── KATEGORİ ──────────────────────────────
    kategori TEXT NOT NULL,
    -- 'fotograf'   → jpg, png, heic, webp (saha fotoğrafları)
    -- 'cizim'      → dwg, dxf, dgn (CAD dosyaları)
    -- 'belge'      → pdf, doc, docx (belgeler)
    -- 'tablo'      → xls, xlsx, csv (tablolar)
    -- 'harita'     → kml, kmz, geojson, gpx (coğrafi)
    -- 'arsiv'      → zip, rar, 7z (arşivler)
    -- 'diger'      → diğer her şey

    -- ─── COĞRAFİ BİLGİ ─────────────────────────
    latitude REAL,                           -- Enlem
    longitude REAL,                          -- Boylam
    konum_adi TEXT,                          -- "Bafra D-3 direği", "Merkez trafo"
    konum_kaynagi TEXT,                      -- 'exif', 'telegram', 'manuel', 'harita'
    altitude REAL,                           -- Yükseklik (metre)

    -- ─── İLİŞKİLER ─────────────────────────────
    proje_id INTEGER,                        -- Hangi projeye ait
    ekip_id INTEGER,                         -- Hangi ekip yükledi
    yukleyen_id INTEGER,                     -- Yükleyen personel
    veri_paketi_id INTEGER,                  -- Hangi veri paketine ait (opsiyonel)

    -- ─── AÇIKLAMA ve ETİKETLER ──────────────────
    baslik TEXT,                              -- Kısa başlık: "3 nolu direk montaj"
    notlar TEXT,                              -- Detaylı açıklama
    etiketler TEXT,                           -- JSON array: ["direk","montaj","D-3","konsol","OG"]

    -- ─── DOSYA TİPİNE ÖZEL VERİLER ─────────────
    -- Her dosya tipinin kendine özel bilgileri burada saklanır
    -- JSON formatında, tip-agnostik
    ozel_alanlar TEXT,
    -- Fotoğraf:  {"genislik":4032,"yukseklik":3024,"kamera":"iPhone 15","cekim_tarihi":"..."}
    -- DWG/DXF:   {"autocad_versiyon":"2018","olcek":"1:500","katmanlar":["elektrik","topraklama"]}
    -- PDF:       {"sayfa_sayisi":12,"belge_tipi":"onay_belgesi"}
    -- Excel:     {"satir_sayisi":250,"sayfa_adlari":["malzeme","puantaj"]}
    -- KML:       {"alan_m2":15000,"cevre_m":500,"nokta_sayisi":25}

    -- ─── AI ANALİZ ─────────────────────────────
    ai_analiz TEXT,                           -- JSON: AI analiz sonucu (fotoğraflar için)
    ai_analiz_katmani INTEGER,              -- Hangi AI katmanı kullandı (1,2,3)

    -- ─── KAYNAK ─────────────────────────────────
    kaynak TEXT DEFAULT 'web',
    -- 'web'        → Web arayüzünden yüklendi
    -- 'mobil'      → Mobil PWA'dan yüklendi
    -- 'telegram'   → Telegram bot'tan geldi
    -- 'sistem'     → Sistem tarafından oluşturuldu (ör: thumbnail)
    -- 'import'     → Toplu aktarım ile

    -- ─── DURUM ──────────────────────────────────
    durum TEXT DEFAULT 'aktif',
    -- 'aktif'      → Normal kullanımda
    -- 'arsiv'      → Arşivlenmiş (görünmez ama silinmemiş)
    -- 'silindi'    → Yumuşak silme (dosya fiziksel olarak duruyor)

    -- ─── VERSİYON (opsiyonel) ───────────────────
    versiyon INTEGER DEFAULT 1,              -- Dosya versiyonu
    onceki_versiyon_id INTEGER,              -- Önceki versiyonun dosya ID'si

    -- ─── ZAMAN ──────────────────────────────────
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (proje_id) REFERENCES projeler(id),
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id),
    FOREIGN KEY (yukleyen_id) REFERENCES personel(id),
    FOREIGN KEY (veri_paketi_id) REFERENCES veri_paketleri(id),
    FOREIGN KEY (onceki_versiyon_id) REFERENCES dosyalar(id)
);
```

### Yeni Tablo: `veri_paketleri` (Yeniden Tasarım)

```sql
-- ============================================
-- VERİ PAKETLERİ
-- Birden fazla dosya + not + konum bir "paket" altında gruplanır.
-- Her paket bir saha işini temsil eder.
-- Kaynak: Telegram, mobil UI veya web arayüzü
-- ============================================
CREATE TABLE IF NOT EXISTS veri_paketleri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paket_no TEXT UNIQUE,                    -- Otomatik: "VP-2026-0001"

    -- ─── TİP ───────────────────────────────────
    paket_tipi TEXT NOT NULL DEFAULT 'genel',
    -- 'direk_tespit'       → Direk fotoğrafı + konum
    -- 'montaj_oncesi'      → Montaj öncesi durum tespiti
    -- 'montaj_sonrasi'     → Montaj sonrası tamamlanma belgesi
    -- 'hasar_tespit'       → Hasar/arıza bildirimi
    -- 'malzeme_tespit'     → Sahadaki malzeme durumu
    -- 'ilerleme_raporu'    → Genel ilerleme raporu
    -- 'guzergah_tespit'    → Kablo güzergahı tespiti
    -- 'kesin_proje'        → Kesin proje dosyaları (DWG + PDF + XLS)
    -- 'teslim'             → Proje teslim dosyaları
    -- 'kesinti_basvuru'    → Enerji kesinti başvurusu
    -- 'genel'              → Diğer

    -- ─── DURUM ──────────────────────────────────
    durum TEXT DEFAULT 'devam_ediyor',
    -- 'devam_ediyor'  → Dosya/not ekleniyor
    -- 'tamamlandi'    → Paket tamamlandı
    -- 'onay_bekliyor' → Koordinatör onayı bekliyor
    -- 'onaylandi'     → Koordinatör onayladı
    -- 'reddedildi'    → Koordinatör reddetti
    -- 'iptal'         → İptal edildi

    -- ─── İLİŞKİLER ─────────────────────────────
    personel_id INTEGER,                     -- Paketi oluşturan personel
    ekip_id INTEGER,                         -- Ekip
    proje_id INTEGER,                        -- Proje
    bolge_id INTEGER,                        -- Bölge

    -- ─── KONUM ──────────────────────────────────
    latitude REAL,                           -- Paketin ana konumu
    longitude REAL,
    konum_adi TEXT,                          -- "Bafra D-3 direği"

    -- ─── İÇERİK SAYAÇLARI ──────────────────────
    dosya_sayisi INTEGER DEFAULT 0,          -- Toplam dosya sayısı
    fotograf_sayisi INTEGER DEFAULT 0,       -- Fotoğraf sayısı
    belge_sayisi INTEGER DEFAULT 0,          -- Belge/çizim/tablo sayısı

    -- ─── AÇIKLAMA ───────────────────────────────
    baslik TEXT,                              -- Paket başlığı
    notlar TEXT,                              -- Personelin eklediği notlar
    etiketler TEXT,                           -- JSON: ["acil","montaj","D-3"]

    -- ─── AI ─────────────────────────────────────
    ai_ozet TEXT,                             -- AI'ın oluşturduğu paket özeti
    ai_islemler TEXT,                         -- JSON: Doğal dil parse sonucu (mesaj kaynaklıysa)

    -- ─── KAYNAK ─────────────────────────────────
    kaynak TEXT DEFAULT 'web',               -- 'web', 'mobil', 'telegram'

    -- ─── ONAY ───────────────────────────────────
    onaylayan_id INTEGER,
    onay_tarihi DATETIME,
    onay_notu TEXT,

    -- ─── ZAMAN ──────────────────────────────────
    baslama_zamani DATETIME DEFAULT CURRENT_TIMESTAMP,
    tamamlanma_zamani DATETIME,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (personel_id) REFERENCES personel(id),
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id),
    FOREIGN KEY (proje_id) REFERENCES projeler(id),
    FOREIGN KEY (bolge_id) REFERENCES bolgeler(id),
    FOREIGN KEY (onaylayan_id) REFERENCES personel(id)
);
```

### İndeksler

```sql
-- ─── DOSYALAR İNDEKSLERİ ────────────────────────
CREATE INDEX IF NOT EXISTS idx_dosya_proje ON dosyalar(proje_id);
CREATE INDEX IF NOT EXISTS idx_dosya_ekip ON dosyalar(ekip_id);
CREATE INDEX IF NOT EXISTS idx_dosya_paket ON dosyalar(veri_paketi_id);
CREATE INDEX IF NOT EXISTS idx_dosya_kategori ON dosyalar(kategori);
CREATE INDEX IF NOT EXISTS idx_dosya_durum ON dosyalar(durum);
CREATE INDEX IF NOT EXISTS idx_dosya_tarih ON dosyalar(olusturma_tarihi);
CREATE INDEX IF NOT EXISTS idx_dosya_konum ON dosyalar(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_dosya_kaynak ON dosyalar(kaynak);

-- ─── VERİ PAKETLERİ İNDEKSLERİ ─────────────────
CREATE INDEX IF NOT EXISTS idx_paket_proje ON veri_paketleri(proje_id);
CREATE INDEX IF NOT EXISTS idx_paket_ekip ON veri_paketleri(ekip_id);
CREATE INDEX IF NOT EXISTS idx_paket_durum ON veri_paketleri(durum);
CREATE INDEX IF NOT EXISTS idx_paket_tip ON veri_paketleri(paket_tipi);
CREATE INDEX IF NOT EXISTS idx_paket_tarih ON veri_paketleri(olusturma_tarihi);
CREATE INDEX IF NOT EXISTS idx_paket_konum ON veri_paketleri(latitude, longitude);
```

### Otomatik Paket Numarası Trigger'ı

```sql
-- Paket numarası otomatik oluşturma
CREATE TRIGGER IF NOT EXISTS trg_paket_no
AFTER INSERT ON veri_paketleri
WHEN NEW.paket_no IS NULL
BEGIN
  UPDATE veri_paketleri
  SET paket_no = 'VP-' || strftime('%Y', 'now') || '-' ||
    printf('%04d', (SELECT COUNT(*) FROM veri_paketleri WHERE strftime('%Y', olusturma_tarihi) = strftime('%Y', 'now')))
  WHERE id = NEW.id;
END;

-- Dosya sayaçlarını otomatik güncelle
CREATE TRIGGER IF NOT EXISTS trg_dosya_sayac_ekle
AFTER INSERT ON dosyalar
WHEN NEW.veri_paketi_id IS NOT NULL
BEGIN
  UPDATE veri_paketleri SET
    dosya_sayisi = (SELECT COUNT(*) FROM dosyalar WHERE veri_paketi_id = NEW.veri_paketi_id AND durum = 'aktif'),
    fotograf_sayisi = (SELECT COUNT(*) FROM dosyalar WHERE veri_paketi_id = NEW.veri_paketi_id AND kategori = 'fotograf' AND durum = 'aktif'),
    belge_sayisi = (SELECT COUNT(*) FROM dosyalar WHERE veri_paketi_id = NEW.veri_paketi_id AND kategori != 'fotograf' AND durum = 'aktif'),
    guncelleme_tarihi = datetime('now')
  WHERE id = NEW.veri_paketi_id;
END;
```

---

## Adım 3 — Dosya Servisi (Backend)

### `server/services/dosyaService.js`

```javascript
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const exifReader = require('exif-reader');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const {
  sahaFotoAdi, projeDosyaAdi, dosyaYoluHesapla,
  thumbnailYoluHesapla, uzantidanKategori
} = require('./dosyaIsimService');

// Uploads kök dizini
const UPLOADS_ROOT = process.env.UPLOADS_PATH || path.join(__dirname, '../../uploads');

class DosyaService {

  // ═══════════════════════════════════════════════
  // DOSYA YÜKLEME — Evrensel
  // Her dosya tipi bu fonksiyondan geçer
  // ═══════════════════════════════════════════════
  async dosyaYukle(buffer, {
    orijinalAdi,
    projeNo = null,
    projeId = null,
    ekipId = null,
    ekipKodu = null,
    yukleyenId = null,
    veriPaketiId = null,
    baslik = null,
    notlar = null,
    etiketler = [],
    latitude = null,
    longitude = null,
    konumAdi = null,
    konumKaynagi = null,
    kaynak = 'web',
  }) {
    const db = getDb();

    // 1. Dosya uzantısı ve kategorisini belirle
    const uzanti = orijinalAdi.split('.').pop().toLowerCase();
    const kategori = uzantidanKategori(orijinalAdi);
    const mimeTipi = this.mimeTipiBelirle(uzanti);

    // 2. Dosya adını oluştur
    let dosyaAdi;
    if (kategori === 'fotograf') {
      dosyaAdi = sahaFotoAdi({
        aciklama: baslik || orijinalAdi.replace(/\.[^.]+$/, ''),
        ekipKodu: ekipKodu,
        uzanti: uzanti === 'heic' ? 'jpg' : uzanti,
      });
    } else {
      dosyaAdi = projeNo
        ? projeDosyaAdi({ projeNo, aciklama: baslik || orijinalAdi.replace(/\.[^.]+$/, ''), uzanti })
        : `${new Date().toISOString().slice(0,10)}_${uuidv4().slice(0,6)}_${orijinalAdi}`;
    }

    // 3. Fiziksel yolu hesapla
    const goreceliYol = dosyaYoluHesapla({ projeNo, kategori, dosyaAdi });
    const tamYol = path.join(UPLOADS_ROOT, goreceliYol);
    const klasor = path.dirname(tamYol);

    // 4. Klasörü oluştur
    fs.mkdirSync(klasor, { recursive: true });

    // 5. Dosya tipine göre işle
    let dosyaBoyutu = buffer.length;
    let ozelAlanlar = {};
    let thumbnailYolu = null;
    let islenmisBuf = buffer;

    if (kategori === 'fotograf') {
      // HEIC → JPEG dönüşümü
      if (uzanti === 'heic') {
        islenmisBuf = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
      }

      // Metadata oku
      const imgMeta = await sharp(islenmisBuf).metadata();
      ozelAlanlar.genislik = imgMeta.width;
      ozelAlanlar.yukseklik = imgMeta.height;

      // EXIF oku
      const exif = await this.exifOku(islenmisBuf);
      if (exif) {
        if (exif.latitude && !latitude) {
          latitude = exif.latitude;
          longitude = exif.longitude;
          konumKaynagi = 'exif';
        }
        if (exif.dateTime) {
          ozelAlanlar.cekim_tarihi = exif.dateTime;
        }
        if (exif.camera) {
          ozelAlanlar.kamera = exif.camera;
        }
      }

      // Thumbnail oluştur
      const thumbGoreceliYol = thumbnailYoluHesapla(goreceliYol);
      const thumbTamYol = path.join(UPLOADS_ROOT, thumbGoreceliYol);
      fs.mkdirSync(path.dirname(thumbTamYol), { recursive: true });

      await sharp(islenmisBuf)
        .resize(300, 300, { fit: 'inside' })
        .jpeg({ quality: 75 })
        .toFile(thumbTamYol);

      thumbnailYolu = thumbGoreceliYol;
      dosyaBoyutu = islenmisBuf.length;
    }

    // 6. Dosyayı kaydet
    fs.writeFileSync(tamYol, islenmisBuf);

    // 7. Veritabanına kaydet
    const result = db.prepare(`
      INSERT INTO dosyalar (
        dosya_adi, orijinal_adi, dosya_yolu, thumbnail_yolu,
        dosya_boyutu, mime_tipi, kategori,
        latitude, longitude, konum_adi, konum_kaynagi, altitude,
        proje_id, ekip_id, yukleyen_id, veri_paketi_id,
        baslik, notlar, etiketler, ozel_alanlar,
        kaynak, durum, olusturma_tarihi
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, 'aktif', datetime('now')
      )
    `).run(
      dosyaAdi, orijinalAdi, goreceliYol, thumbnailYolu,
      dosyaBoyutu, mimeTipi, kategori,
      latitude, longitude, konumAdi, konumKaynagi, null,
      projeId, ekipId, yukleyenId, veriPaketiId,
      baslik, notlar,
      etiketler.length > 0 ? JSON.stringify(etiketler) : null,
      Object.keys(ozelAlanlar).length > 0 ? JSON.stringify(ozelAlanlar) : null,
      kaynak
    );

    return {
      id: result.lastInsertRowid,
      dosyaAdi,
      dosyaYolu: goreceliYol,
      thumbnailYolu,
      kategori,
      dosyaBoyutu,
    };
  }

  // ═══════════════════════════════════════════════
  // DOSYA SORGULAMA
  // ═══════════════════════════════════════════════

  /**
   * Dosyaları filtrele ve listele
   * Projenin her yerinden çağrılabilir
   */
  dosyalariGetir({
    projeId, ekipId, veriPaketiId, kategori, etiket,
    kaynak, durum = 'aktif', limit = 50, offset = 0,
    siralama = 'olusturma_tarihi DESC'
  } = {}) {
    const db = getDb();
    let where = ['d.durum = ?'];
    let params = [durum];

    if (projeId) { where.push('d.proje_id = ?'); params.push(projeId); }
    if (ekipId) { where.push('d.ekip_id = ?'); params.push(ekipId); }
    if (veriPaketiId) { where.push('d.veri_paketi_id = ?'); params.push(veriPaketiId); }
    if (kategori) { where.push('d.kategori = ?'); params.push(kategori); }
    if (kaynak) { where.push('d.kaynak = ?'); params.push(kaynak); }
    if (etiket) {
      // JSON array içinde arama: ["direk","montaj"] içinde "direk" var mı?
      where.push("d.etiketler LIKE ?");
      params.push(`%"${etiket}"%`);
    }

    const sql = `
      SELECT 
        d.*,
        p.proje_no, p.proje_adi,
        e.ekip_adi, e.ekip_kodu,
        pr.ad_soyad AS yukleyen_adi
      FROM dosyalar d
      LEFT JOIN projeler p ON d.proje_id = p.id
      LEFT JOIN ekipler e ON d.ekip_id = e.id
      LEFT JOIN personel pr ON d.yukleyen_id = pr.id
      WHERE ${where.join(' AND ')}
      ORDER BY ${siralama}
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    return db.prepare(sql).all(...params);
  }

  /**
   * Tek dosya detayı
   */
  dosyaGetir(dosyaId) {
    const db = getDb();
    return db.prepare(`
      SELECT 
        d.*,
        p.proje_no, p.proje_adi,
        e.ekip_adi, e.ekip_kodu,
        pr.ad_soyad AS yukleyen_adi,
        vp.paket_no, vp.paket_tipi
      FROM dosyalar d
      LEFT JOIN projeler p ON d.proje_id = p.id
      LEFT JOIN ekipler e ON d.ekip_id = e.id
      LEFT JOIN personel pr ON d.yukleyen_id = pr.id
      LEFT JOIN veri_paketleri vp ON d.veri_paketi_id = vp.id
      WHERE d.id = ?
    `).get(dosyaId);
  }

  /**
   * Bir projenin dosya istatistikleri
   */
  projeIstatistik(projeId) {
    const db = getDb();
    return db.prepare(`
      SELECT 
        kategori,
        COUNT(*) as sayi,
        SUM(dosya_boyutu) as toplam_boyut
      FROM dosyalar
      WHERE proje_id = ? AND durum = 'aktif'
      GROUP BY kategori
    `).all(projeId);
  }

  // ═══════════════════════════════════════════════
  // DOSYA GÜNCELLEME
  // ═══════════════════════════════════════════════

  /**
   * Dosya metadata güncelle (etiket, not, konum vb.)
   */
  dosyaGuncelle(dosyaId, { baslik, notlar, etiketler, latitude, longitude, konumAdi, projeId, veriPaketiId }) {
    const db = getDb();
    const updates = [];
    const params = [];

    if (baslik !== undefined) { updates.push('baslik = ?'); params.push(baslik); }
    if (notlar !== undefined) { updates.push('notlar = ?'); params.push(notlar); }
    if (etiketler !== undefined) { updates.push('etiketler = ?'); params.push(JSON.stringify(etiketler)); }
    if (latitude !== undefined) { updates.push('latitude = ?'); params.push(latitude); }
    if (longitude !== undefined) { updates.push('longitude = ?'); params.push(longitude); }
    if (konumAdi !== undefined) { updates.push('konum_adi = ?'); params.push(konumAdi); }
    if (projeId !== undefined) { updates.push('proje_id = ?'); params.push(projeId); }
    if (veriPaketiId !== undefined) { updates.push('veri_paketi_id = ?'); params.push(veriPaketiId); }

    if (updates.length === 0) return;

    updates.push("guncelleme_tarihi = datetime('now')");
    params.push(dosyaId);

    db.prepare(`UPDATE dosyalar SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  /**
   * Yumuşak silme
   */
  dosyaSil(dosyaId) {
    const db = getDb();
    db.prepare("UPDATE dosyalar SET durum = 'silindi', guncelleme_tarihi = datetime('now') WHERE id = ?").run(dosyaId);
  }

  // ═══════════════════════════════════════════════
  // YARDIMCI FONKSİYONLAR
  // ═══════════════════════════════════════════════

  async exifOku(buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      if (!metadata.exif) return null;

      const exif = exifReader(metadata.exif);
      const result = {};

      // GPS
      if (exif?.gps?.GPSLatitude && exif?.gps?.GPSLongitude) {
        result.latitude = this.dmsToDecimal(exif.gps.GPSLatitude, exif.gps.GPSLatitudeRef);
        result.longitude = this.dmsToDecimal(exif.gps.GPSLongitude, exif.gps.GPSLongitudeRef);
      }

      // Tarih
      if (exif?.exif?.DateTimeOriginal) {
        result.dateTime = exif.exif.DateTimeOriginal.toISOString();
      }

      // Kamera
      if (exif?.image?.Make || exif?.image?.Model) {
        result.camera = [exif.image?.Make, exif.image?.Model].filter(Boolean).join(' ');
      }

      return result;
    } catch {
      return null;
    }
  }

  dmsToDecimal(dms, ref) {
    const degrees = dms[0] + dms[1] / 60 + dms[2] / 3600;
    return (ref === 'S' || ref === 'W') ? -degrees : degrees;
  }

  mimeTipiBelirle(uzanti) {
    const map = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      heic: 'image/heic', webp: 'image/webp', gif: 'image/gif',
      pdf: 'application/pdf',
      doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      dwg: 'application/acad', dxf: 'application/dxf',
      kml: 'application/vnd.google-earth.kml+xml', kmz: 'application/vnd.google-earth.kmz',
      geojson: 'application/geo+json',
      zip: 'application/zip', rar: 'application/x-rar-compressed',
    };
    return map[uzanti] || 'application/octet-stream';
  }

  /**
   * Dosya sunma — fiziksel dosyayı oku ve döndür
   */
  dosyaYoluCozumle(goreceliYol) {
    return path.join(UPLOADS_ROOT, goreceliYol);
  }
}

module.exports = new DosyaService();
```

---

## Adım 4 — Veri Paketi Servisi

### `server/services/veriPaketiService.js`

```javascript
const { getDb } = require('../db/database');
const dosyaService = require('./dosyaService');

class VeriPaketiService {

  /**
   * Yeni veri paketi oluştur
   */
  olustur({ paketTipi, personelId, ekipId, projeId, bolgeId, baslik, notlar, kaynak = 'web' }) {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO veri_paketleri (
        paket_tipi, personel_id, ekip_id, proje_id, bolge_id,
        baslik, notlar, kaynak, durum
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'devam_ediyor')
    `).run(paketTipi, personelId, ekipId, projeId, bolgeId, baslik, notlar, kaynak);

    // Paket no otomatik trigger ile oluşur
    const paket = db.prepare('SELECT * FROM veri_paketleri WHERE id = ?').get(result.lastInsertRowid);
    return paket;
  }

  /**
   * Pakete dosya ekle
   * Dosyayı dosyaService ile yükle, bu pakete bağla
   */
  async dosyaEkle(paketId, buffer, dosyaBilgisi) {
    // Paketin bilgilerini al (proje, ekip vb. otomatik miras alsın)
    const paket = this.getir(paketId);
    if (!paket) throw new Error('Paket bulunamadı');

    // projeNo'yu bul (klasör yapısı için)
    const db = getDb();
    let projeNo = null;
    if (paket.proje_id) {
      const proje = db.prepare('SELECT proje_no FROM projeler WHERE id = ?').get(paket.proje_id);
      projeNo = proje?.proje_no;
    }

    let ekipKodu = null;
    if (paket.ekip_id) {
      const ekip = db.prepare('SELECT ekip_kodu FROM ekipler WHERE id = ?').get(paket.ekip_id);
      ekipKodu = ekip?.ekip_kodu;
    }

    // Dosyayı yükle
    const dosya = await dosyaService.dosyaYukle(buffer, {
      ...dosyaBilgisi,
      projeNo,
      projeId: paket.proje_id,
      ekipId: paket.ekip_id,
      ekipKodu,
      yukleyenId: dosyaBilgisi.yukleyenId || paket.personel_id,
      veriPaketiId: paketId,
      kaynak: paket.kaynak,
    });

    // Paketin konumunu ilk GPS'li dosyadan al (yoksa)
    if (!paket.latitude && dosya.latitude) {
      db.prepare(`
        UPDATE veri_paketleri SET latitude = ?, longitude = ?, guncelleme_tarihi = datetime('now')
        WHERE id = ? AND latitude IS NULL
      `).run(dosya.latitude, dosya.longitude, paketId);
    }

    return dosya;
  }

  /**
   * Pakete not ekle
   */
  notEkle(paketId, notMetni) {
    const db = getDb();
    const paket = this.getir(paketId);
    if (!paket) throw new Error('Paket bulunamadı');

    const mevcutNot = paket.notlar ? paket.notlar + '\n' : '';
    db.prepare(`
      UPDATE veri_paketleri SET 
        notlar = ?,
        guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(mevcutNot + notMetni, paketId);
  }

  /**
   * Paketi tamamla
   */
  tamamla(paketId) {
    const db = getDb();
    db.prepare(`
      UPDATE veri_paketleri SET 
        durum = 'tamamlandi',
        tamamlanma_zamani = datetime('now'),
        guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(paketId);
  }

  /**
   * Tek paket getir (dosyaları ile birlikte)
   */
  getir(paketId) {
    const db = getDb();
    return db.prepare('SELECT * FROM veri_paketleri WHERE id = ?').get(paketId);
  }

  getirDetayli(paketId) {
    const db = getDb();
    const paket = db.prepare(`
      SELECT vp.*,
        p.proje_no, p.proje_adi,
        e.ekip_adi, e.ekip_kodu,
        pr.ad_soyad AS personel_adi
      FROM veri_paketleri vp
      LEFT JOIN projeler p ON vp.proje_id = p.id
      LEFT JOIN ekipler e ON vp.ekip_id = e.id
      LEFT JOIN personel pr ON vp.personel_id = pr.id
      WHERE vp.id = ?
    `).get(paketId);

    if (!paket) return null;

    // Paketin dosyalarını getir
    const dosyalar = dosyaService.dosyalariGetir({ veriPaketiId: paketId });

    return { ...paket, dosyalar };
  }

  /**
   * Paketleri listele (filtreli)
   */
  listele({ projeId, ekipId, paketTipi, durum, limit = 50, offset = 0 } = {}) {
    const db = getDb();
    let where = [];
    let params = [];

    if (projeId) { where.push('vp.proje_id = ?'); params.push(projeId); }
    if (ekipId) { where.push('vp.ekip_id = ?'); params.push(ekipId); }
    if (paketTipi) { where.push('vp.paket_tipi = ?'); params.push(paketTipi); }
    if (durum) { where.push('vp.durum = ?'); params.push(durum); }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    return db.prepare(`
      SELECT vp.*,
        p.proje_no, p.proje_adi,
        e.ekip_adi, e.ekip_kodu,
        pr.ad_soyad AS personel_adi
      FROM veri_paketleri vp
      LEFT JOIN projeler p ON vp.proje_id = p.id
      LEFT JOIN ekipler e ON vp.ekip_id = e.id
      LEFT JOIN personel pr ON vp.personel_id = pr.id
      ${whereClause}
      ORDER BY vp.olusturma_tarihi DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
  }

  /**
   * Personelin aktif (devam eden) paketini bul
   * Telegram veya mobil'den dosya geldiğinde mevcut pakete ekle
   */
  aktifPaketBul(personelId, timeoutDakika = 15) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM veri_paketleri
      WHERE personel_id = ?
        AND durum = 'devam_ediyor'
        AND datetime(guncelleme_tarihi, '+' || ? || ' minutes') > datetime('now')
      ORDER BY olusturma_tarihi DESC
      LIMIT 1
    `).get(personelId, timeoutDakika);
  }

  /**
   * Koordinatör onay/red
   */
  onayla(paketId, { durum, onaylayanId, onayNotu }) {
    const db = getDb();
    db.prepare(`
      UPDATE veri_paketleri SET
        durum = ?,
        onaylayan_id = ?,
        onay_tarihi = datetime('now'),
        onay_notu = ?,
        guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(durum, onaylayanId, onayNotu, paketId);
  }
}

module.exports = new VeriPaketiService();
```

---

## Adım 5 — API Endpoint'leri

### `server/routes/dosya.js`

```javascript
const express = require('express');
const router = express.Router();
const multer = require('multer');
const dosyaService = require('../services/dosyaService');
const veriPaketiService = require('../services/veriPaketiService');

// Multer — bellek tamponu (dosyayı RAM'de tut, dosyaService kaydetsin)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },   // Maks 50MB
});

// ─── DOSYA YÜKLEME ────────────────────────────────────
// POST /api/dosya/yukle — Tekli dosya yükleme
router.post('/yukle', upload.single('dosya'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Dosya seçilmedi' });
    }

    const sonuc = await dosyaService.dosyaYukle(req.file.buffer, {
      orijinalAdi: req.file.originalname,
      projeNo: req.body.proje_no || null,
      projeId: req.body.proje_id ? parseInt(req.body.proje_id) : null,
      ekipId: req.body.ekip_id ? parseInt(req.body.ekip_id) : null,
      ekipKodu: req.body.ekip_kodu || null,
      yukleyenId: req.body.yukleyen_id ? parseInt(req.body.yukleyen_id) : null,
      veriPaketiId: req.body.veri_paketi_id ? parseInt(req.body.veri_paketi_id) : null,
      baslik: req.body.baslik || null,
      notlar: req.body.notlar || null,
      etiketler: req.body.etiketler ? JSON.parse(req.body.etiketler) : [],
      latitude: req.body.latitude ? parseFloat(req.body.latitude) : null,
      longitude: req.body.longitude ? parseFloat(req.body.longitude) : null,
      konumAdi: req.body.konum_adi || null,
      kaynak: req.body.kaynak || 'web',
    });

    res.json({ success: true, data: sonuc });
  } catch (error) {
    console.error('Dosya yükleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/dosya/toplu-yukle — Çoklu dosya yükleme
router.post('/toplu-yukle', upload.array('dosyalar', 20), async (req, res) => {
  try {
    const sonuclar = [];
    for (const file of req.files) {
      const sonuc = await dosyaService.dosyaYukle(file.buffer, {
        orijinalAdi: file.originalname,
        projeNo: req.body.proje_no || null,
        projeId: req.body.proje_id ? parseInt(req.body.proje_id) : null,
        kaynak: req.body.kaynak || 'web',
      });
      sonuclar.push(sonuc);
    }
    res.json({ success: true, data: sonuclar });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── DOSYA LİSTELEME / SORGULAMA ─────────────────────
// GET /api/dosya — Dosyaları filtreli listele
router.get('/', (req, res) => {
  try {
    const dosyalar = dosyaService.dosyalariGetir({
      projeId: req.query.proje_id,
      ekipId: req.query.ekip_id,
      veriPaketiId: req.query.veri_paketi_id,
      kategori: req.query.kategori,
      etiket: req.query.etiket,
      kaynak: req.query.kaynak,
      durum: req.query.durum || 'aktif',
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
    });
    res.json({ success: true, data: dosyalar });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dosya/:id — Tek dosya detayı
router.get('/:id', (req, res) => {
  try {
    const dosya = dosyaService.dosyaGetir(parseInt(req.params.id));
    if (!dosya) return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });
    res.json({ success: true, data: dosya });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dosya/:id/indir — Dosyayı indir
router.get('/:id/indir', (req, res) => {
  try {
    const dosya = dosyaService.dosyaGetir(parseInt(req.params.id));
    if (!dosya) return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });

    const tamYol = dosyaService.dosyaYoluCozumle(dosya.dosya_yolu);
    res.download(tamYol, dosya.orijinal_adi || dosya.dosya_adi);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dosya/:id/thumb — Thumbnail göster
router.get('/:id/thumb', (req, res) => {
  try {
    const dosya = dosyaService.dosyaGetir(parseInt(req.params.id));
    if (!dosya || !dosya.thumbnail_yolu) {
      return res.status(404).json({ success: false, error: 'Thumbnail yok' });
    }
    const tamYol = dosyaService.dosyaYoluCozumle(dosya.thumbnail_yolu);
    res.sendFile(tamYol);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── DOSYA GÜNCELLEME ─────────────────────────────────
// PUT /api/dosya/:id — Metadata güncelle
router.put('/:id', (req, res) => {
  try {
    dosyaService.dosyaGuncelle(parseInt(req.params.id), req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/dosya/:id — Yumuşak silme
router.delete('/:id', (req, res) => {
  try {
    dosyaService.dosyaSil(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── PROJE DOSYA İSTATİSTİĞİ ─────────────────────────
// GET /api/dosya/istatistik/proje/:projeId
router.get('/istatistik/proje/:projeId', (req, res) => {
  try {
    const istatistik = dosyaService.projeIstatistik(parseInt(req.params.projeId));
    res.json({ success: true, data: istatistik });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

### `server/routes/veriPaketi.js`

```javascript
const express = require('express');
const router = express.Router();
const multer = require('multer');
const veriPaketiService = require('../services/veriPaketiService');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// POST /api/veri-paketi — Yeni paket oluştur
router.post('/', (req, res) => {
  try {
    const paket = veriPaketiService.olustur(req.body);
    res.json({ success: true, data: paket });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/veri-paketi — Paketleri listele
router.get('/', (req, res) => {
  try {
    const paketler = veriPaketiService.listele({
      projeId: req.query.proje_id,
      ekipId: req.query.ekip_id,
      paketTipi: req.query.paket_tipi,
      durum: req.query.durum,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
    });
    res.json({ success: true, data: paketler });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/veri-paketi/:id — Paket detay (dosyalar dahil)
router.get('/:id', (req, res) => {
  try {
    const paket = veriPaketiService.getirDetayli(parseInt(req.params.id));
    if (!paket) return res.status(404).json({ success: false, error: 'Paket bulunamadı' });
    res.json({ success: true, data: paket });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/veri-paketi/:id/dosya — Pakete dosya ekle
router.post('/:id/dosya', upload.single('dosya'), async (req, res) => {
  try {
    const sonuc = await veriPaketiService.dosyaEkle(
      parseInt(req.params.id),
      req.file.buffer,
      {
        orijinalAdi: req.file.originalname,
        baslik: req.body.baslik || null,
        notlar: req.body.notlar || null,
        etiketler: req.body.etiketler ? JSON.parse(req.body.etiketler) : [],
        latitude: req.body.latitude ? parseFloat(req.body.latitude) : null,
        longitude: req.body.longitude ? parseFloat(req.body.longitude) : null,
      }
    );
    res.json({ success: true, data: sonuc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/veri-paketi/:id/not — Pakete not ekle
router.put('/:id/not', (req, res) => {
  try {
    veriPaketiService.notEkle(parseInt(req.params.id), req.body.not);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/veri-paketi/:id/tamamla — Paketi tamamla
router.put('/:id/tamamla', (req, res) => {
  try {
    veriPaketiService.tamamla(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/veri-paketi/:id/onayla — Koordinatör onay/red
router.put('/:id/onayla', (req, res) => {
  try {
    veriPaketiService.onayla(parseInt(req.params.id), req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

### Route Kayıtları

```javascript
// server/server.js'e ekle
const multer = require('multer');    // npm install multer
const dosyaRoutes = require('./routes/dosya');
const veriPaketiRoutes = require('./routes/veriPaketi');

app.use('/api/dosya', dosyaRoutes);
app.use('/api/veri-paketi', veriPaketiRoutes);

// Statik dosya sunma (fotoğraf önizleme vb.)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
```

### Paket Kurulumu

```bash
cd server
npm install multer     # Dosya yükleme middleware'i (yoksa)
```

---

## Adım 6 — Kullanıcı Dosya Bulma Senaryoları

Kullanıcı bir dosyayı **3 farklı yoldan** bulabilir:

### A) Proje Üzerinden (En yaygın)

```
Projeler → YB-2025-001 → Dosyalar sekmesi

GET /api/dosya?proje_id=5

Sonuç:
┌─────────────────────────────────────────────────────────────┐
│ YB-2025-001 — Bafra YB  │ Dosyalar                         │
├─────────────────────────────────────────────────────────────┤
│ 📸 Fotoğraflar (23)     │ 📐 Çizimler (3)                 │
│ 📄 Belgeler (5)         │ 📊 Tablolar (2)                  │
│ 🗺️ Harita (1)           │                                  │
├─────────────────────────────────────────────────────────────┤
│ [Filtre: Kategori ▾] [Etiket ▾] [Tarih ▾] [Ekip ▾]       │
│                                                             │
│ 📸 2026-02-12 │ D3 montaj │ EK-01 │ #direk #montaj       │
│ 📸 2026-02-12 │ D3 montaj │ EK-01 │ #direk #montaj       │
│ 📐 2026-01-15 │ Kesin proje │ — │ #proje #onay            │
│ 📄 2026-01-10 │ Onay belgesi │ — │ #belge #yedas          │
│ 📊 2026-02-01 │ Malzeme listesi │ — │ #malzeme             │
└─────────────────────────────────────────────────────────────┘
```

### B) Veri Paketi Üzerinden

```
Veri Paketleri → VP-2026-0042 → İçerik

GET /api/veri-paketi/42

Sonuç:
┌────────────────────────────────────────────────────┐
│ VP-2026-0042 │ Direk Tespit │ EK-01                │
│ Proje: YB-2025-001 │ 📍 Bafra                      │
├────────────────────────────────────────────────────┤
│ Dosyalar (3):                                      │
│ 📸 D3 genel görünüm.jpg     │ 1.2 MB │ GPS var   │
│ 📸 D3 konsol detay.jpg      │ 0.8 MB │ GPS var   │
│ 📸 D3 izolatör.jpg          │ 0.9 MB │ GPS var   │
│                                                    │
│ Notlar:                                            │
│ "3 nolu direk montaj tamamlandı, izolatörler OK"  │
│                                                    │
│ AI Analiz: 2x L konsol, 6x U70 cam izolatör       │
└────────────────────────────────────────────────────┘
```

### C) Arama / Etiket Filtresi (Global)

```
Arama: etiket="hasar" + kategori=fotograf + tarih=bu_hafta

GET /api/dosya?etiket=hasar&kategori=fotograf

Sonuç — projeye bağlı olmadan tüm sistemden:
┌────────────────────────────────────────────────────┐
│ 📸 Hasar izolatör │ YB-2025-001 │ EK-02 │ Bafra  │
│ 📸 Kırık konsol   │ KET-2025-011 │ EK-01 │ Terme  │
│ 📸 Çürük direk    │ YB-2025-003 │ EK-03 │ Çarşamba│
└────────────────────────────────────────────────────┘
```

### D) Saha Haritası Üzerinden

```
Saha → Haritada veri paketi marker'a tıkla → Dosyaları gör

Aynı zamanda:
GET /api/dosya?latitude_min=41.5&latitude_max=41.7&longitude_min=35.8&longitude_max=36.0
```

### E) Fiziksel Klasörden (Acil/DB-dışı)

```
Windows Explorer / Finder → uploads/2026/YB-2025-001/fotograf/
→ Dosya isimleri okunabilir: 2026-02-12_D3-montaj_EK01_a1b2c3.jpg
→ DB olmadan bile bulunur
```

---

## Kontrol Listesi

**Altyapı:**
- [ ] `npm install multer` — server'da çalıştırıldı
- [ ] `uploads/` kök dizini oluşturuldu
- [ ] `dosyaIsimService.js` dosyası oluşturuldu
- [ ] `dosyaService.js` dosyası oluşturuldu
- [ ] `veriPaketiService.js` dosyası oluşturuldu

**Veritabanı:**
- [ ] `dosyalar` tablosu oluşturuldu (eski `medya` tablosunu değiştiriyor)
- [ ] `veri_paketleri` tablosu güncellendi (yeni yapı)
- [ ] İndeksler oluşturuldu
- [ ] Trigger'lar oluşturuldu (paket_no + dosya sayaçları)

**API Endpoint'leri:**
- [ ] `POST /api/dosya/yukle` → Tekli dosya yükleme çalışıyor
- [ ] `POST /api/dosya/toplu-yukle` → Çoklu yükleme çalışıyor
- [ ] `GET /api/dosya?kategori=&etiket=&proje_id=` → Filtreli listeleme çalışıyor
- [ ] `GET /api/dosya/:id` → Tek dosya detay
- [ ] `GET /api/dosya/:id/indir` → Dosya indirme çalışıyor
- [ ] `GET /api/dosya/:id/thumb` → Thumbnail gösterme çalışıyor
- [ ] `POST /api/veri-paketi` → Paket oluşturma
- [ ] `POST /api/veri-paketi/:id/dosya` → Pakete dosya ekleme
- [ ] `GET /api/veri-paketi/:id` → Paket detay (dosyalar dahil)

**Klasör Yapısı:**
- [ ] Fotoğraf yüklendi → `uploads/2026/{proje_no}/fotograf/` altına kaydedildi
- [ ] DWG yüklendi → `uploads/2026/{proje_no}/cizim/` altına kaydedildi
- [ ] PDF yüklendi → `uploads/2026/{proje_no}/belge/` altına kaydedildi
- [ ] Projesiz dosya → `uploads/2026/_genel/` altına kaydedildi
- [ ] Thumbnail otomatik oluşturuldu

**Test Senaryoları:**
- [ ] Fotoğraf yükle → EXIF GPS okundu, thumbnail oluştu, DB'ye kaydedildi
- [ ] DWG yükle → `cizim/` klasörüne kaydedildi, kategori "cizim"
- [ ] Etiket filtresi → `GET /api/dosya?etiket=direk` doğru sonuç döndü
- [ ] Proje filtresi → `GET /api/dosya?proje_id=5` sadece o projenin dosyaları geldi
- [ ] Veri paketi → Paket oluştur, 3 fotoğraf ekle, tamamla → dosya_sayisi=3

---

## Mevcut Sistemle Entegrasyon

Bu dosya sistemi projenin **her yerinden** kullanılır:

| Modül | Kullanım |
|-------|----------|
| **Projeler** | Proje detay sayfasında "Dosyalar" sekmesi → `GET /api/dosya?proje_id=X` |
| **Ekipler** | Ekip detayında son yüklenen dosyalar → `GET /api/dosya?ekip_id=X` |
| **Veri Paketleri** | Paket detayında dosya listesi → `GET /api/veri-paketi/:id` |
| **Saha Haritası** | Konumlu dosyalar haritada marker → `GET /api/dosya?kategori=fotograf` |
| **Telegram Bot** | Gelen fotoğraf → `dosyaService.dosyaYukle(buffer, {..., kaynak: 'telegram'})` |
| **Mobil UI** | Kameradan çekim → `POST /api/dosya/yukle` + `kaynak=mobil` |
| **AI Analiz** | Fotoğraf analizi → `dosyalar.ai_analiz` JSON alanına yaz |
| **Malzeme** | Malzeme listesi Excel → `GET /api/dosya?proje_id=X&kategori=tablo` |
| **Raporlar** | Proje dosya istatistiği → `GET /api/dosya/istatistik/proje/:id` |
