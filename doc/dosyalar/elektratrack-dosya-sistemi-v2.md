# ElektraTrack — Evrensel Dosya Yönetimi + Veri Paketi Sistemi (v2)

## Amaç

Firmanın **tüm dosya ihtiyacını** tek bir evrensel yapıyla yönetmek — proje dosyaları, personel belgeleri, ekipman evrakları, ihale dosyaları, İSG belgeleri, muhasebe faturaları, kurum yazışmaları dahil.

> Bu MD, önceki `elektratrack-dosya-sistemi.md`'nin **yerini alır** (v2).

**Temel prensipler:**
1. **Tek tablo** → Her dosya tipi ve her alan aynı `dosyalar` tablosundan sorgulanır
2. **Alan bazlı kök klasörler** → `projeler/`, `personel/`, `ekipman/`, `ihale/`, `isg/`, `firma/`, `muhasebe/`, `kurum/`
3. **Hiyerarşik fiziksel yapı** → DB çökse bile klasörden dosya bulunabilir
4. **DB etiket + metadata** → Filtreleme, arama, ilişkilendirme tamamen DB'den
5. **Veri paketi** → Birden fazla dosya + not + konum bir "paket" altında gruplanır

---

## Adım 1 — Klasör Yapısı

### Genel Bakış

```
uploads/                                     ← Ana kök dizin
│
├── projeler/                                ← PROJE DOSYALARI (yıl + proje bazlı)
│   ├── 2026/
│   │   ├── YB-2025-001/
│   │   ├── KET-2025-011/
│   │   └── _genel/                          (projeye atanmamış)
│   └── 2025/
│
├── personel/                                ← PERSONEL DOSYALARI (kişi bazlı)
│   ├── PER-001_Ahmet-Yilmaz/
│   ├── PER-002_Mehmet-Kaya/
│   └── _genel/
│
├── ekipman/                                 ← EKİPMAN / ARAÇ DOSYALARI
│   ├── arac/
│   ├── is_makinesi/
│   ├── olcum_aleti/
│   └── _genel/
│
├── ihale/                                   ← İHALE DOSYALARI
│   ├── 2026/
│   │   ├── IH-2026-001_Bafra-OG-Hat/
│   │   └── IH-2026-002_Terme-AG-Sebekesi/
│   └── 2025/
│
├── isg/                                     ← İŞ SAĞLIĞI VE GÜVENLİĞİ
│   ├── 2026/
│   │   ├── risk_degerlendirme/
│   │   ├── egitim/
│   │   ├── denetim/
│   │   └── kaza_raporu/
│   └── genel/
│
├── firma/                                   ← FİRMA GENEL DOSYALARI
│   ├── resmi_belgeler/
│   ├── yetki_belgeleri/
│   ├── sigorta/
│   └── diger/
│
├── muhasebe/                                ← MUHASEBE / FİNANSAL
│   ├── 2026/
│   │   ├── fatura/
│   │   ├── hak_edis/
│   │   ├── banka/
│   │   └── vergi/
│   └── 2025/
│
├── kurum/                                   ← KURUM YAZIŞMALARI (YEDAŞ vb.)
│   ├── yedas/
│   ├── belediye/
│   ├── tedas/
│   └── diger/
│
├── sablon/                                  ← ŞABLON DOSYALAR (sabit)
│   ├── bos-malzeme-listesi.xlsx
│   ├── kesinti-basvuru-formu.pdf
│   └── proje-teslim-formu.docx
│
└── gecici/                                  ← GEÇİCİ DOSYALAR (otomatik temizlenir)
```

### Alan Detayları

---

### A) `projeler/` — Proje Dosyaları

Yıl + proje numarası bazlı. Her projenin içinde dosya tipine göre alt klasörler.

```
projeler/
├── 2026/
│   ├── YB-2025-001/
│   │   ├── fotograf/                       ← Saha fotoğrafları
│   │   │   ├── 2026-02-12_D3-montaj_EK01_a1b2.jpg
│   │   │   └── thumb/                      ← Otomatik thumbnail'lar
│   │   │       └── 2026-02-12_D3-montaj_EK01_a1b2_thumb.jpg
│   │   ├── cizim/                          ← CAD dosyaları (DWG, DXF)
│   │   │   ├── YB-2025-001_kesin-proje.dwg
│   │   │   └── YB-2025-001_guzergah.dxf
│   │   ├── belge/                          ← Belgeler (PDF, DOC)
│   │   │   ├── YB-2025-001_onay-belgesi.pdf
│   │   │   └── YB-2025-001_teslim-tutanagi.docx
│   │   ├── tablo/                          ← Excel, CSV
│   │   │   └── YB-2025-001_malzeme-listesi.xlsx
│   │   └── harita/                         ← KML, GeoJSON
│   │       └── YB-2025-001_guzergah.kml
│   │
│   ├── KET-2025-011/
│   │   ├── fotograf/
│   │   ├── cizim/
│   │   ├── belge/
│   │   └── tablo/
│   │
│   └── _genel/                             ← Projeye atanmamış
│       ├── fotograf/
│       └── belge/
```

**İsimlendirme:**
- Fotoğraf: `{tarih}_{aciklama}_{ekip}_{kisaID}.{uzanti}`
- Proje dosyası: `{proje_no}_{aciklama}.{uzanti}`

---

### B) `personel/` — Personel Dosyaları

Her çalışanın kendi klasörü. İçinde belge tipine göre alt klasörler.

```
personel/
├── PER-001_Ahmet-Yilmaz/
│   ├── kimlik/                              ← Nüfus cüzdanı, ehliyet
│   │   ├── kimlik-on.jpg
│   │   ├── kimlik-arka.jpg
│   │   └── ehliyet.jpg
│   ├── saglik/                              ← Sağlık raporu, kan grubu kartı
│   │   ├── saglik-raporu-2026.pdf
│   │   └── ise-giris-raporu.pdf
│   ├── sertifika/                           ← Mesleki sertifikalar
│   │   ├── og-ehliyet-belgesi.pdf
│   │   ├── yuksekte-calisma-sertifika.pdf
│   │   └── ilkyardim-sertifika.pdf
│   ├── sgk/                                 ← SGK belgeleri
│   │   ├── sgk-ise-giris-bildirgesi.pdf
│   │   └── sgk-hizmet-dokumu.pdf
│   ├── isg_egitim/                          ← İSG eğitim belgeleri
│   │   ├── temel-isg-egitimi-2026.pdf
│   │   └── elektrik-guvenlik-egitimi.pdf
│   ├── sozlesme/                            ← İş sözleşmesi
│   │   └── is-sozlesmesi-2026.pdf
│   └── diger/
│       └── vesikalik.jpg
│
├── PER-002_Mehmet-Kaya/
│   ├── kimlik/
│   ├── saglik/
│   └── ...
│
└── _genel/                                  ← Kişiye atanmamış personel belgeleri
    └── personel-devam-cizelgesi-2026.xlsx
```

**İsimlendirme:** `{belge_turu}[-detay][-yil].{uzanti}`

**Önemli:** Sertifika/sağlık raporlarının **geçerlilik tarihi** DB'de `ozel_alanlar` JSON'ında tutulur:
```json
{ "gecerlilik_bitis": "2027-03-15", "belge_no": "ISG-2026-1234" }
```
Bu sayede süresi dolan belgeler otomatik raporlanabilir.

---

### C) `ekipman/` — Ekipman, Araç, Gereç Dosyaları

Araç ve iş makineleri, ölçüm aletleri, el aletleri.

```
ekipman/
├── arac/                                    ← Firma araçları
│   ├── 34-ABC-123_Ford-Ranger/
│   │   ├── ruhsat.pdf
│   │   ├── sigorta-police-2026.pdf
│   │   ├── muayene-2026.pdf
│   │   ├── bakim/
│   │   │   ├── 2026-01-15_periyodik-bakim.pdf
│   │   │   └── 2026-02-10_lastik-degisimi.jpg
│   │   └── kaza/
│   │       └── 2026-03-01_kaza-raporu.pdf
│   │
│   └── 55-DEF-456_Isuzu-Vinc/
│       ├── ruhsat.pdf
│       └── ...
│
├── is_makinesi/                             ← İş makineleri (vinç, kazıcı vb.)
│   ├── VINC-001_Hidrolik-Sepetli/
│   │   ├── ruhsat.pdf
│   │   ├── operasyon-belgesi.pdf
│   │   ├── periyodik-muayene-2026.pdf
│   │   └── bakim/
│   └── KZCI-001_Mini-Kazici/
│       └── ...
│
├── olcum_aleti/                             ← Ölçüm ve test cihazları
│   ├── CLM-001_Clamp-Metre/
│   │   ├── kalibrasyon-2026.pdf
│   │   └── kullanim-kilavuzu.pdf
│   └── TRM-001_Toprak-Direnc-Olcer/
│       └── kalibrasyon-2026.pdf
│
└── _genel/                                  ← Ekipmana atanmamış
    └── ekipman-envanter-2026.xlsx
```

**İsimlendirme:** `{plaka_veya_kod}_{aciklama}/` klasörü altında ilgili belgeler.

**Özel alanlar (DB):**
```json
// Araç
{ "plaka": "34-ABC-123", "marka": "Ford", "model": "Ranger", "yil": 2022, "sigorta_bitis": "2026-06-15", "muayene_bitis": "2026-09-01" }
// Ölçüm aleti
{ "seri_no": "CLM-2023-456", "kalibrasyon_bitis": "2026-12-01", "kalibrasyon_firmasi": "Metroloji AŞ" }
```

---

### D) `ihale/` — İhale Dosyaları

İhale sürecinin tüm dokümanları. İhale projeye dönüşürse ilişkilendirilir.

```
ihale/
├── 2026/
│   ├── IH-2026-001_Bafra-OG-Hat/
│   │   ├── sartname/                        ← İhale şartnamesi
│   │   │   ├── idari-sartname.pdf
│   │   │   └── teknik-sartname.pdf
│   │   ├── kesif/                           ← Keşif ve metraj
│   │   │   ├── kesif-ozeti.xlsx
│   │   │   └── metraj.xlsx
│   │   ├── teklif/                          ← Firma teklifi
│   │   │   ├── teklif-mektubu.pdf
│   │   │   └── birim-fiyat-teklif.xlsx
│   │   ├── sozlesme/                        ← Sözleşme (kazanıldıysa)
│   │   │   └── sozlesme.pdf
│   │   └── diger/
│   │       ├── yer-gorme-tutanagi.pdf
│   │       └── ihale-komisyon-karari.pdf
│   │
│   └── IH-2026-002_Terme-AG-Sebekesi/
│       └── ...
│
└── 2025/
    └── ...
```

**İsimlendirme:** `IH-{yil}-{sira}_{kisa-aciklama}/`

**Özel alanlar (DB):**
```json
{ "ihale_tarihi": "2026-03-15", "kurum": "YEDAŞ", "sonuc": "kazanildi", "proje_id": 5 }
```

---

### E) `isg/` — İş Sağlığı ve Güvenliği

Firma geneli İSG belgeleri. Personele özel İSG eğitimleri `personel/{kisi}/isg_egitim/` altında.

```
isg/
├── 2026/
│   ├── risk_degerlendirme/                  ← Risk değerlendirme raporları
│   │   ├── RD-2026-001_Bafra-OG-Hat.pdf
│   │   └── RD-2026-002_Genel-Saha.pdf
│   ├── egitim/                              ← Toplu eğitim belgeleri
│   │   ├── 2026-01-15_temel-isg-egitimi/
│   │   │   ├── katilimci-listesi.pdf
│   │   │   ├── egitim-fotograf-1.jpg
│   │   │   └── egitim-sertifika-toplu.pdf
│   │   └── 2026-02-01_yuksekte-calisma/
│   │       └── ...
│   ├── denetim/                             ← İSG denetimleri
│   │   ├── 2026-02-10_saha-denetim-bafra.pdf
│   │   └── 2026-02-10_saha-denetim-bafra-fotolar/
│   │       ├── uygunsuzluk-1.jpg
│   │       └── uygunsuzluk-2.jpg
│   └── kaza_raporu/                         ← İş kazası raporları
│       └── 2026-03-05_kaza-raporu-KZ001.pdf
│
├── genel/                                   ← Yıldan bağımsız İSG belgeleri
│   ├── acil-durum-plani.pdf
│   ├── isg-politikasi.pdf
│   ├── isg-ic-yonerge.pdf
│   └── kkd-listesi.xlsx
│
└── formlar/                                 ← Boş formlar (şablon)
    ├── gunluk-isg-kontrol-formu.xlsx
    ├── kkd-teslim-tutanagi.xlsx
    └── ramak-kala-bildirim-formu.docx
```

---

### F) `firma/` — Firma Genel Dosyaları

Firmanın resmi belgeleri, yetki belgeleri, sigortalar.

```
firma/
├── resmi_belgeler/                          ← Ticari belgeler
│   ├── vergi-levhasi.pdf
│   ├── ticaret-sicil-gazetesi.pdf
│   ├── faaliyet-belgesi.pdf
│   ├── imza-sirkuleri.pdf
│   └── ana-sozlesme.pdf
│
├── yetki_belgeleri/                         ← Müteahhitlik yetki belgeleri
│   ├── yetki-belgesi-C2.pdf
│   ├── elektrik-muteahhitlik-belgesi.pdf
│   ├── iso-9001-sertifika.pdf
│   └── yedas-isleme-yetki-belgesi.pdf
│
├── sigorta/                                 ← Firma sigortaları
│   ├── isveren-sorumluluk-sigortasi-2026.pdf
│   ├── is-makinesi-sigortasi-2026.pdf
│   └── yangin-sigortasi-2026.pdf
│
└── diger/
    ├── organizasyon-semasi.pdf
    └── firma-logo.png
```

**Özel alanlar (DB):**
```json
{ "belge_no": "C2-2024-12345", "gecerlilik_bitis": "2027-01-01", "veren_kurum": "Çevre ve Şehircilik Bakanlığı" }
```

---

### G) `muhasebe/` — Muhasebe / Finansal Dosyalar

Yıl bazlı, alt kategorilere ayrılmış.

```
muhasebe/
├── 2026/
│   ├── fatura/                              ← Gelen/giden faturalar
│   │   ├── gelen/
│   │   │   ├── 2026-01-15_ABC-Kablo-fatura.pdf
│   │   │   └── 2026-02-01_XYZ-Direk-fatura.pdf
│   │   └── giden/
│   │       ├── 2026-01-31_YB-2025-001-hakedis-1.pdf
│   │       └── 2026-02-28_KET-2025-011-hakedis-1.pdf
│   │
│   ├── hak_edis/                            ← Hak ediş dosyaları
│   │   ├── YB-2025-001/
│   │   │   ├── hakedis-1-metraj.xlsx
│   │   │   ├── hakedis-1-icmal.pdf
│   │   │   └── hakedis-1-onay.pdf
│   │   └── KET-2025-011/
│   │       └── ...
│   │
│   ├── banka/                               ← Banka dekontları, ekstreler
│   │   ├── 2026-01_ekstre.pdf
│   │   └── 2026-02-15_havale-dekontu.pdf
│   │
│   └── vergi/                               ← Vergi beyannameleri
│       ├── 2026-01_kdv-beyannamesi.pdf
│       └── 2026-01_muhtasar.pdf
│
└── 2025/
    └── ...
```

---

### H) `kurum/` — Kurum Yazışmaları

YEDAŞ, belediye, TEDAŞ ve diğer kurumlarla yazışmalar.

```
kurum/
├── yedas/                                   ← YEDAŞ yazışmaları
│   ├── 2026/
│   │   ├── 2026-01-10_enerji-kesinti-talep-YB001.pdf
│   │   ├── 2026-01-15_enerji-kesinti-onay-YB001.pdf
│   │   ├── 2026-02-01_gecici-kabul-basvuru-KET011.pdf
│   │   └── 2026-02-10_hat-devreye-alma-tutanagi.pdf
│   └── 2025/
│
├── belediye/                                ← Belediye yazışmaları
│   ├── 2026/
│   │   ├── 2026-01-05_kazi-izin-basvuru.pdf
│   │   └── 2026-01-08_kazi-izin-onay.pdf
│   └── ...
│
├── tedas/                                   ← TEDAŞ / EPDK
│   └── 2026/
│
└── diger/                                   ← Diğer kurumlar
    └── 2026/
```

---

## Adım 2 — Veritabanı: Güncellenmiş `dosyalar` Tablosu

Önceki versiyona göre eklenen: `alan`, `alt_alan`, `iliskili_kaynak_tipi`, `iliskili_kaynak_id` sütunları.

```sql
-- ============================================
-- DOSYALAR — Evrensel Dosya Tablosu (v2)
-- Tüm alanlar (proje, personel, ekipman, ihale, isg, firma, muhasebe, kurum)
-- tek tablodan yönetilir
-- ============================================
CREATE TABLE IF NOT EXISTS dosyalar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- ─── DOSYA BİLGİLERİ ────────────────────────
    dosya_adi TEXT NOT NULL,                 -- Sistemdeki isim
    orijinal_adi TEXT,                       -- Kullanıcının yüklediği orijinal isim
    dosya_yolu TEXT NOT NULL,               -- Göreceli yol: "projeler/2026/YB-2025-001/fotograf/xxx.jpg"
    thumbnail_yolu TEXT,                     -- Thumbnail yolu (fotoğraflar için)
    dosya_boyutu INTEGER,                    -- Byte cinsinden
    mime_tipi TEXT,                          -- "image/jpeg", "application/pdf"

    -- ─── ALAN (yeni v2) ─────────────────────────
    -- Dosyanın hangi iş alanına ait olduğu
    alan TEXT NOT NULL,
    -- 'proje'       → Proje dosyaları (saha fotoğrafı, çizim, belge)
    -- 'personel'    → Personel belgeleri (kimlik, sertifika, sağlık)
    -- 'ekipman'     → Ekipman/araç dosyaları (ruhsat, muayene, bakım)
    -- 'ihale'       → İhale dosyaları (şartname, teklif, sözleşme)
    -- 'isg'         → İSG belgeleri (risk, eğitim, denetim, kaza)
    -- 'firma'       → Firma genel belgeleri (yetki, sigorta)
    -- 'muhasebe'    → Muhasebe/finansal (fatura, hak ediş, banka)
    -- 'kurum'       → Kurum yazışmaları (YEDAŞ, belediye)
    -- 'sablon'      → Şablon dosyalar
    -- 'diger'       → Sınıflandırılamayan

    -- ─── ALT ALAN (yeni v2) ─────────────────────
    -- Alan içindeki spesifik kategori
    alt_alan TEXT,
    -- proje:    'fotograf','cizim','belge','tablo','harita'
    -- personel: 'kimlik','saglik','sertifika','sgk','isg_egitim','sozlesme'
    -- ekipman:  'ruhsat','sigorta','muayene','bakim','kalibrasyon','kaza'
    -- ihale:    'sartname','kesif','teklif','sozlesme'
    -- isg:      'risk_degerlendirme','egitim','denetim','kaza_raporu','form'
    -- firma:    'resmi_belge','yetki_belgesi','sigorta'
    -- muhasebe: 'fatura_gelen','fatura_giden','hak_edis','banka','vergi'
    -- kurum:    'yedas','belediye','tedas','diger'

    -- ─── KATEGORİ (dosya tipi) ──────────────────
    kategori TEXT NOT NULL,
    -- 'fotograf'  → jpg, png, heic, webp
    -- 'cizim'     → dwg, dxf, dgn
    -- 'belge'     → pdf, doc, docx
    -- 'tablo'     → xls, xlsx, csv
    -- 'harita'    → kml, kmz, geojson, gpx
    -- 'arsiv'     → zip, rar, 7z
    -- 'diger'

    -- ─── İLİŞKİLİ KAYNAK (yeni v2 — polimorfik) ──
    -- Dosyanın bağlı olduğu kaynağı gösterir
    iliskili_kaynak_tipi TEXT,
    -- 'proje'     → projeler tablosu
    -- 'personel'  → personel tablosu
    -- 'ekipman'   → ekipman tablosu
    -- 'ihale'     → ihaleler tablosu
    -- 'kurum'     → kurum_yazisma tablosu
    -- null        → Genel dosya

    iliskili_kaynak_id INTEGER,              -- İlişkili tablodaki ID

    -- ─── COĞRAFİ BİLGİ ─────────────────────────
    latitude REAL,
    longitude REAL,
    konum_adi TEXT,
    konum_kaynagi TEXT,                      -- 'exif','telegram','manuel','harita'
    altitude REAL,

    -- ─── ESKİ İLİŞKİLER (geriye uyumluluk) ─────
    proje_id INTEGER,                        -- Proje dosyaları için
    ekip_id INTEGER,
    yukleyen_id INTEGER,
    veri_paketi_id INTEGER,
    proje_asama_id INTEGER,

    -- ─── AÇIKLAMA ve ETİKETLER ──────────────────
    baslik TEXT,
    notlar TEXT,
    etiketler TEXT,                           -- JSON: ["direk","montaj","acil"]

    -- ─── DOSYA TİPİNE / ALANA ÖZEL VERİLER ─────
    ozel_alanlar TEXT,
    -- Fotoğraf:   {"genislik":4032,"yukseklik":3024,"kamera":"iPhone 15"}
    -- DWG/DXF:    {"autocad_versiyon":"2018","olcek":"1:500"}
    -- PDF:        {"sayfa_sayisi":12}
    -- Personel:   {"gecerlilik_bitis":"2027-03-15","belge_no":"ISG-2026-1234"}
    -- Ekipman:    {"plaka":"34-ABC-123","muayene_bitis":"2026-09-01","kalibrasyon_bitis":"2026-12-01"}
    -- İhale:      {"ihale_tarihi":"2026-03-15","kurum":"YEDAŞ","sonuc":"kazanildi"}
    -- Firma:      {"belge_no":"C2-2024-12345","gecerlilik_bitis":"2027-01-01"}
    -- Muhasebe:   {"fatura_no":"A-2026-001","tutar":15000,"kdv":2700,"vade":"2026-03-15"}

    -- ─── AI ANALİZ ─────────────────────────────
    ai_analiz TEXT,
    ai_analiz_katmani INTEGER,

    -- ─── KAYNAK ─────────────────────────────────
    kaynak TEXT DEFAULT 'web',               -- 'web','mobil','telegram','sistem','import'

    -- ─── DURUM ──────────────────────────────────
    durum TEXT DEFAULT 'aktif',              -- 'aktif','arsiv','silindi'

    -- ─── VERSİYON ──────────────────────────────
    versiyon INTEGER DEFAULT 1,
    onceki_versiyon_id INTEGER,

    -- ─── ZAMAN ──────────────────────────────────
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (proje_id) REFERENCES projeler(id),
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id),
    FOREIGN KEY (yukleyen_id) REFERENCES personel(id),
    FOREIGN KEY (veri_paketi_id) REFERENCES veri_paketleri(id),
    FOREIGN KEY (proje_asama_id) REFERENCES proje_asamalari(id),
    FOREIGN KEY (onceki_versiyon_id) REFERENCES dosyalar(id)
);
```

### Yeni İndeksler

```sql
-- Alan ve alt alan bazlı hızlı filtreleme
CREATE INDEX IF NOT EXISTS idx_dosya_alan ON dosyalar(alan);
CREATE INDEX IF NOT EXISTS idx_dosya_alt_alan ON dosyalar(alan, alt_alan);
CREATE INDEX IF NOT EXISTS idx_dosya_iliskili ON dosyalar(iliskili_kaynak_tipi, iliskili_kaynak_id);

-- Mevcut indeksler
CREATE INDEX IF NOT EXISTS idx_dosya_proje ON dosyalar(proje_id);
CREATE INDEX IF NOT EXISTS idx_dosya_ekip ON dosyalar(ekip_id);
CREATE INDEX IF NOT EXISTS idx_dosya_paket ON dosyalar(veri_paketi_id);
CREATE INDEX IF NOT EXISTS idx_dosya_kategori ON dosyalar(kategori);
CREATE INDEX IF NOT EXISTS idx_dosya_durum ON dosyalar(durum);
CREATE INDEX IF NOT EXISTS idx_dosya_tarih ON dosyalar(olusturma_tarihi);
CREATE INDEX IF NOT EXISTS idx_dosya_konum ON dosyalar(latitude, longitude);
```

---

## Adım 3 — Dosya Yolu Hesaplama Servisi (Güncellenmiş)

### `server/services/dosyaIsimService.js` — Güncelleme

Mevcut dosyaya eklenen/değiştirilen fonksiyonlar:

```javascript
// ─── ALAN → KÖK KLASÖR EŞLEŞMESİ ────────────────
const ALAN_KLASOR = {
  proje:     'projeler',
  personel:  'personel',
  ekipman:   'ekipman',
  ihale:     'ihale',
  isg:       'isg',
  firma:     'firma',
  muhasebe:  'muhasebe',
  kurum:     'kurum',
  sablon:    'sablon',
  diger:     'diger',
};

// ─── ALT ALAN → ALT KLASÖR EŞLEŞMESİ ────────────
const ALT_ALAN_KLASOR = {
  // Proje
  fotograf: 'fotograf', cizim: 'cizim', belge: 'belge',
  tablo: 'tablo', harita: 'harita',
  // Personel
  kimlik: 'kimlik', saglik: 'saglik', sertifika: 'sertifika',
  sgk: 'sgk', isg_egitim: 'isg_egitim', sozlesme: 'sozlesme',
  // Ekipman
  ruhsat: 'ruhsat', sigorta: 'sigorta', muayene: 'muayene',
  bakim: 'bakim', kalibrasyon: 'kalibrasyon', kaza: 'kaza',
  // İhale
  sartname: 'sartname', kesif: 'kesif', teklif: 'teklif',
  // İSG
  risk_degerlendirme: 'risk_degerlendirme', egitim: 'egitim',
  denetim: 'denetim', kaza_raporu: 'kaza_raporu', form: 'formlar',
  // Firma
  resmi_belge: 'resmi_belgeler', yetki_belgesi: 'yetki_belgeleri',
  // Muhasebe
  fatura_gelen: 'fatura/gelen', fatura_giden: 'fatura/giden',
  hak_edis: 'hak_edis', banka: 'banka', vergi: 'vergi',
  // Kurum
  yedas: 'yedas', belediye: 'belediye', tedas: 'tedas',
};

/**
 * Dosyanın fiziksel yolunu hesapla (v2 — alan bazlı)
 *
 * @param {Object} bilgi
 * @param {string} bilgi.alan        - 'proje','personel','ekipman'...
 * @param {string} bilgi.altAlan     - 'fotograf','kimlik','ruhsat'...
 * @param {string} bilgi.dosyaAdi    - Dosya adı
 * @param {string} [bilgi.projeNo]   - Proje numarası (alan=proje ise)
 * @param {string} [bilgi.personelKodu] - Personel kodu (alan=personel ise)
 * @param {string} [bilgi.ekipmanKodu]  - Ekipman kodu/plaka (alan=ekipman ise)
 * @param {string} [bilgi.ihaleNo]      - İhale numarası (alan=ihale ise)
 * @param {string} [bilgi.kurumAdi]     - Kurum adı (alan=kurum ise)
 * @returns {string} Göreceli dosya yolu
 */
function dosyaYoluHesaplaV2({
  alan, altAlan, dosyaAdi,
  projeNo, personelKodu, ekipmanKodu, ihaleNo, kurumAdi
}) {
  const yil = new Date().getFullYear().toString();
  const kokKlasor = ALAN_KLASOR[alan] || 'diger';
  const altKlasor = ALT_ALAN_KLASOR[altAlan] || altAlan || 'diger';

  switch (alan) {
    case 'proje':
      // projeler/2026/YB-2025-001/fotograf/dosya.jpg
      return `${kokKlasor}/${yil}/${projeNo || '_genel'}/${altKlasor}/${dosyaAdi}`;

    case 'personel':
      // personel/PER-001_Ahmet-Yilmaz/sertifika/dosya.pdf
      return `${kokKlasor}/${personelKodu || '_genel'}/${altKlasor}/${dosyaAdi}`;

    case 'ekipman':
      // ekipman/arac/34-ABC-123_Ford-Ranger/muayene/dosya.pdf
      // altAlan burada ekipman tipi: arac, is_makinesi, olcum_aleti
      return `${kokKlasor}/${altKlasor}/${ekipmanKodu || '_genel'}/${dosyaAdi}`;

    case 'ihale':
      // ihale/2026/IH-2026-001_Bafra-OG-Hat/sartname/dosya.pdf
      return `${kokKlasor}/${yil}/${ihaleNo || '_genel'}/${altKlasor}/${dosyaAdi}`;

    case 'isg':
      // isg/2026/egitim/dosya.pdf  veya  isg/genel/dosya.pdf
      return `${kokKlasor}/${yil}/${altKlasor}/${dosyaAdi}`;

    case 'firma':
      // firma/yetki_belgeleri/dosya.pdf
      return `${kokKlasor}/${altKlasor}/${dosyaAdi}`;

    case 'muhasebe':
      // muhasebe/2026/fatura/gelen/dosya.pdf
      return `${kokKlasor}/${yil}/${altKlasor}/${dosyaAdi}`;

    case 'kurum':
      // kurum/yedas/2026/dosya.pdf
      return `${kokKlasor}/${kurumAdi || 'diger'}/${yil}/${dosyaAdi}`;

    case 'sablon':
      // sablon/dosya.xlsx
      return `${kokKlasor}/${dosyaAdi}`;

    default:
      return `diger/${yil}/${dosyaAdi}`;
  }
}

module.exports = {
  // ... mevcut fonksiyonlar ...
  dosyaYoluHesaplaV2,
  ALAN_KLASOR,
  ALT_ALAN_KLASOR,
};
```

---

## Adım 4 — Dosya Servisi Güncellemesi

`dosyaService.js`'deki `dosyaYukle` fonksiyonunun alan bazlı güncellenmesi:

```javascript
// dosyaService.js — dosyaYukle fonksiyonuna eklenen parametreler

async dosyaYukle(buffer, {
  orijinalAdi,
  // ─── ALAN BİLGİLERİ (yeni v2) ────────────────
  alan = 'proje',                  // 'proje','personel','ekipman',...
  altAlan = null,                  // 'fotograf','kimlik','ruhsat',...
  iliskiliKaynakTipi = null,       // 'proje','personel','ekipman',...
  iliskiliKaynakId = null,         // İlişkili tablodaki ID

  // Yol hesaplama için tanımlayıcılar
  projeNo = null,
  personelKodu = null,
  ekipmanKodu = null,
  ihaleNo = null,
  kurumAdi = null,

  // ─── MEVCUT PARAMETRELER ──────────────────────
  projeId = null, ekipId = null, ekipKodu = null,
  yukleyenId = null, veriPaketiId = null,
  baslik = null, notlar = null, etiketler = [],
  latitude = null, longitude = null, konumAdi = null, konumKaynagi = null,
  kaynak = 'web', ozelAlanlar = {},
}) {
  // ...

  // Alt alan otomatik belirleme (alan=proje ise dosya uzantısından)
  if (alan === 'proje' && !altAlan) {
    altAlan = uzantidanKategori(orijinalAdi);
  }

  // Dosya yolu hesapla (v2)
  const goreceliYol = dosyaYoluHesaplaV2({
    alan, altAlan, dosyaAdi,
    projeNo, personelKodu, ekipmanKodu, ihaleNo, kurumAdi,
  });

  // ... geri kalan işlem aynı, INSERT'e alan + alt_alan + iliskili sütunlar eklenir ...
}
```

### Dosya Sorgulama Güncelleme

```javascript
/**
 * Dosyaları filtrele — v2 (alan bazlı)
 */
dosyalariGetir({
  alan, altAlan,                             // YENİ: Alan filtresi
  iliskiliKaynakTipi, iliskiliKaynakId,     // YENİ: İlişkili kaynak
  projeId, ekipId, veriPaketiId,
  kategori, etiket, kaynak,
  durum = 'aktif', limit = 50, offset = 0,
  siralama = 'olusturma_tarihi DESC'
} = {}) {
  const db = getDb();
  let where = ['d.durum = ?'];
  let params = [durum];

  // ─── ALAN FİLTRELERİ (yeni) ────────────────
  if (alan) { where.push('d.alan = ?'); params.push(alan); }
  if (altAlan) { where.push('d.alt_alan = ?'); params.push(altAlan); }
  if (iliskiliKaynakTipi && iliskiliKaynakId) {
    where.push('d.iliskili_kaynak_tipi = ? AND d.iliskili_kaynak_id = ?');
    params.push(iliskiliKaynakTipi, iliskiliKaynakId);
  }

  // ─── MEVCUT FİLTRELER ─────────────────────
  if (projeId) { where.push('d.proje_id = ?'); params.push(projeId); }
  if (ekipId) { where.push('d.ekip_id = ?'); params.push(ekipId); }
  if (veriPaketiId) { where.push('d.veri_paketi_id = ?'); params.push(veriPaketiId); }
  if (kategori) { where.push('d.kategori = ?'); params.push(kategori); }
  if (kaynak) { where.push('d.kaynak = ?'); params.push(kaynak); }
  if (etiket) { where.push("d.etiketler LIKE ?"); params.push(`%"${etiket}"%`); }

  // ... SQL sorgusu aynı ...
}
```

---

## Adım 5 — API Endpoint Güncellemesi

Mevcut `routes/dosya.js`'e ek endpoint'ler:

```javascript
// ─── ALAN BAZLI DOSYA LİSTELEME ──────────────────
// GET /api/dosya/alan/:alan — Belirli bir alanın dosyaları
// Örnek: GET /api/dosya/alan/personel?iliskili_kaynak_id=5
router.get('/alan/:alan', (req, res) => {
  try {
    const dosyalar = dosyaService.dosyalariGetir({
      alan: req.params.alan,
      altAlan: req.query.alt_alan,
      iliskiliKaynakTipi: req.query.kaynak_tipi,
      iliskiliKaynakId: req.query.kaynak_id ? parseInt(req.query.kaynak_id) : null,
      kategori: req.query.kategori,
      etiket: req.query.etiket,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
    });
    res.json({ success: true, data: dosyalar });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── SÜRESİ DOLAN BELGELER RAPORU ────────────────
// GET /api/dosya/suresi-dolan?gun=30
// Personel sertifikaları, ekipman muayeneleri, firma belgeleri
router.get('/suresi-dolan', (req, res) => {
  try {
    const db = getDb();
    const gun = parseInt(req.query.gun) || 30;
    const hedefTarih = new Date();
    hedefTarih.setDate(hedefTarih.getDate() + gun);

    const dosyalar = db.prepare(`
      SELECT d.*,
        json_extract(d.ozel_alanlar, '$.gecerlilik_bitis') as gecerlilik_bitis,
        json_extract(d.ozel_alanlar, '$.muayene_bitis') as muayene_bitis,
        json_extract(d.ozel_alanlar, '$.kalibrasyon_bitis') as kalibrasyon_bitis,
        json_extract(d.ozel_alanlar, '$.sigorta_bitis') as sigorta_bitis
      FROM dosyalar d
      WHERE d.durum = 'aktif'
        AND (
          (json_extract(d.ozel_alanlar, '$.gecerlilik_bitis') IS NOT NULL
           AND json_extract(d.ozel_alanlar, '$.gecerlilik_bitis') <= ?)
          OR
          (json_extract(d.ozel_alanlar, '$.muayene_bitis') IS NOT NULL
           AND json_extract(d.ozel_alanlar, '$.muayene_bitis') <= ?)
          OR
          (json_extract(d.ozel_alanlar, '$.kalibrasyon_bitis') IS NOT NULL
           AND json_extract(d.ozel_alanlar, '$.kalibrasyon_bitis') <= ?)
          OR
          (json_extract(d.ozel_alanlar, '$.sigorta_bitis') IS NOT NULL
           AND json_extract(d.ozel_alanlar, '$.sigorta_bitis') <= ?)
        )
      ORDER BY COALESCE(
        json_extract(d.ozel_alanlar, '$.gecerlilik_bitis'),
        json_extract(d.ozel_alanlar, '$.muayene_bitis'),
        json_extract(d.ozel_alanlar, '$.kalibrasyon_bitis'),
        json_extract(d.ozel_alanlar, '$.sigorta_bitis')
      ) ASC
    `).all(
      hedefTarih.toISOString().slice(0, 10),
      hedefTarih.toISOString().slice(0, 10),
      hedefTarih.toISOString().slice(0, 10),
      hedefTarih.toISOString().slice(0, 10)
    );

    res.json({ success: true, data: dosyalar });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── ALAN BAZLI İSTATİSTİK ───────────────────────
// GET /api/dosya/istatistik/alan
router.get('/istatistik/alan', (req, res) => {
  try {
    const db = getDb();
    const istatistik = db.prepare(`
      SELECT
        alan,
        alt_alan,
        COUNT(*) as dosya_sayisi,
        SUM(dosya_boyutu) as toplam_boyut
      FROM dosyalar
      WHERE durum = 'aktif'
      GROUP BY alan, alt_alan
      ORDER BY alan, alt_alan
    `).all();

    res.json({ success: true, data: istatistik });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

## Adım 6 — Kullanıcı Erişim Senaryoları

Kullanıcı dosyayı **6 farklı yoldan** bulabilir:

### A) Alan Bazlı Gezinti (Ana Yol)

```
Dosya Yönetimi → Alan Seç → Alt Alan → Dosya Listesi

┌──────────────────────────────────────────────────────────────┐
│ 📂 Dosya Yönetimi                                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  📁 Projeler        📁 Personel       📁 Ekipman            │
│     142 dosya          67 dosya          23 dosya            │
│     1.2 GB             340 MB            180 MB              │
│                                                              │
│  📁 İhale           📁 İSG            📁 Firma              │
│     35 dosya           28 dosya          15 dosya            │
│     220 MB             95 MB             45 MB               │
│                                                              │
│  📁 Muhasebe        📁 Kurum Yazışma  📁 Şablonlar         │
│     89 dosya           42 dosya          12 dosya            │
│     310 MB             155 MB            8 MB                │
│                                                              │
└──────────────────────────────────────────────────────────────┘

→ "Personel" tıkla:

┌──────────────────────────────────────────────────────────────┐
│ 📂 Dosya Yönetimi > Personel                                │
├──────────────────────────────────────────────────────────────┤
│ [Filtre: Kişi ▾] [Belge Tipi ▾] [Süresi Dolan ⚠️]         │
│                                                              │
│  👤 Ahmet Yılmaz (PER-001)              12 dosya            │
│     kimlik(2) saglik(2) sertifika(4) sgk(2) sozlesme(1)    │
│     ⚠️ OG ehliyet belgesi 15 gün sonra sona erecek         │
│                                                              │
│  👤 Mehmet Kaya (PER-002)               8 dosya             │
│     kimlik(2) saglik(1) sertifika(3) sgk(1) sozlesme(1)    │
│                                                              │
│  👤 Ali Demir (PER-003)                 6 dosya             │
│     kimlik(2) saglik(1) sertifika(2) sozlesme(1)            │
│     🔴 Sağlık raporu süresi dolmuş!                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### B) Modül İçinden (Bağlamsal)

```
Projeler > YB-2025-001 > Dosyalar sekmesi
→ GET /api/dosya?alan=proje&proje_id=5

Personel > Ahmet Yılmaz > Belgeler sekmesi
→ GET /api/dosya/alan/personel?kaynak_tipi=personel&kaynak_id=1

Ekipman > 34-ABC-123 > Belgeler sekmesi
→ GET /api/dosya/alan/ekipman?kaynak_tipi=ekipman&kaynak_id=3

İhale > IH-2026-001 > Dosyalar
→ GET /api/dosya/alan/ihale?kaynak_tipi=ihale&kaynak_id=1
```

### C) Süresi Dolan Belgeler Uyarısı (Dashboard)

```
GET /api/dosya/suresi-dolan?gun=30

Dashboard'da:
┌────────────────────────────────────────────────┐
│ ⚠️ Süresi Dolacak Belgeler (30 gün)           │
├────────────────────────────────────────────────┤
│ 🔴 Ali Demir — Sağlık Raporu      (dolmuş!)  │
│ 🟡 Ahmet Yılmaz — OG Ehliyet      (15 gün)   │
│ 🟡 34-ABC-123 — Araç Muayenesi    (22 gün)   │
│ 🟡 Firma — İşveren Soruml. Sigorta (28 gün)  │
└────────────────────────────────────────────────┘
```

### D) Global Arama

```
Arama: etiket="acil" + alan=herhangi

→ Proje fotoğrafı, İSG raporu, kaza raporu — hepsi tek listede
```

### E) Harita Üzerinden (Konumlu Dosyalar)

```
Saha harita → marker tıkla → dosya listesi
```

### F) Fiziksel Klasörden (Acil/DB-dışı)

```
Windows Explorer → uploads/personel/PER-001_Ahmet-Yilmaz/sertifika/
→ İsimler okunabilir, DB olmadan bile bulunur
```

---

## Kontrol Listesi

**Klasör Yapısı:**
- [ ] `uploads/` altında 8 kök klasör oluşturuldu (projeler, personel, ekipman, ihale, isg, firma, muhasebe, kurum)
- [ ] `uploads/sablon/` ve `uploads/gecici/` oluşturuldu
- [ ] Her kök klasörün alt yapısı dökümana uygun

**Veritabanı:**
- [ ] `dosyalar` tablosuna `alan`, `alt_alan` sütunları eklendi
- [ ] `dosyalar` tablosuna `iliskili_kaynak_tipi`, `iliskili_kaynak_id` eklendi
- [ ] `idx_dosya_alan`, `idx_dosya_alt_alan`, `idx_dosya_iliskili` indeksleri oluşturuldu

**Backend Servis:**
- [ ] `dosyaYoluHesaplaV2()` fonksiyonu çalışıyor (alan bazlı yol)
- [ ] `dosyaService.dosyaYukle()` → `alan`, `altAlan` parametreleri kabul ediyor
- [ ] `dosyaService.dosyalariGetir()` → `alan`, `altAlan`, `iliskiliKaynakTipi/Id` filtresi çalışıyor

**API Endpoint'leri:**
- [ ] `GET /api/dosya/alan/:alan` → Alan bazlı dosya listesi
- [ ] `GET /api/dosya/suresi-dolan?gun=30` → Süresi dolan belgeler
- [ ] `GET /api/dosya/istatistik/alan` → Alan bazlı istatistik
- [ ] `POST /api/dosya/yukle` → `alan`, `alt_alan` parametreleri çalışıyor

**Test Senaryoları — Her Alandan Birer Dosya:**
- [ ] Proje fotoğrafı → `projeler/2026/YB-2025-001/fotograf/` altına kaydedildi
- [ ] Personel sertifikası → `personel/PER-001_Ahmet-Yilmaz/sertifika/` altına kaydedildi
- [ ] Araç muayene → `ekipman/arac/34-ABC-123_Ford-Ranger/` altına kaydedildi
- [ ] İhale şartname → `ihale/2026/IH-2026-001_Bafra-OG-Hat/sartname/` altına kaydedildi
- [ ] İSG eğitim → `isg/2026/egitim/` altına kaydedildi
- [ ] Firma yetki belgesi → `firma/yetki_belgeleri/` altına kaydedildi
- [ ] Gelen fatura → `muhasebe/2026/fatura/gelen/` altına kaydedildi
- [ ] YEDAŞ yazışma → `kurum/yedas/2026/` altına kaydedildi

**Süresi Dolan Belge Testi:**
- [ ] `gecerlilik_bitis` geçmiş tarihli personel belgesi → "süresi dolmuş" listesinde görünüyor
- [ ] `muayene_bitis` 20 gün sonraya ayarlanmış araç → 30 günlük filtre ile görünüyor
- [ ] `sigorta_bitis` 45 gün sonraya ayarlanmış → 30 günlük filtre ile görünmüyor

---

## Mevcut Sistemle Entegrasyon

Bu dosya sistemi projenin **her modülünden** kullanılır:

| Modül | Alan | Kullanım |
|-------|------|----------|
| **Projeler** | `proje` | Proje detay > Dosyalar sekmesi |
| **Personel** | `personel` | Personel detay > Belgeler sekmesi |
| **Ekipler** | `proje` | Ekibin yüklediği saha dosyaları |
| **Ekipman** | `ekipman` | Ekipman detay > Belgeler sekmesi |
| **Veri Paketleri** | `proje` | Paket içindeki dosyalar |
| **Saha Harita** | `proje` | Konumlu fotoğraflar |
| **Saha Mesaj** | `proje` | Mesajla gönderilen fotoğraflar |
| **Telegram Bot** | `proje` | Bot'tan gelen fotoğraflar |
| **İhale** | `ihale` | İhale dosyaları |
| **Malzeme/Depo** | `proje`/`muhasebe` | Malzeme listesi Excel, fatura |
| **İSG** | `isg` | Denetim, eğitim, risk değerlendirme |
| **Finansal** | `muhasebe` | Fatura, hak ediş, dekont |
| **Kurum Yazışma** | `kurum` | YEDAŞ, belediye yazışmaları |
| **Firma Ayarları** | `firma` | Yetki belgeleri, sigorta |
| **Raporlar** | — | `suresi-dolan` endpoint → Dashboard uyarı |
| **Dashboard** | — | Alan bazlı dosya istatistiği |
