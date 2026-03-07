# ElektraTrack — Elektrik Dağıtım Müteahhit İş Takip Sistemi — Geliştirme Kılavuzu

## Proje Özeti

**ElektraTrack**, elektrik dağıtım şirketlerine iş yapan müteahhitlik firmalarının YB (Yeni Bağlantı), KET (Küçük Ek Tesis) ve Tesis projelerini uçtan uca takip etmesi için geliştirilen bir iş takip ve koordinasyon sistemidir.

### Hedef Kitle
Türkiye genelinde elektrik dağıtım şirketleri (TEDAŞ, EDAŞ grupları vb.) ile sözleşmeli çalışan müteahhitlik firmaları. Bu firmalar genellikle belirli bir bölgede (il/ilçe bazında) YB, KET ve Tesis sözleşmeleri kapsamında saha ekipleri ile elektrik dağıtım altyapısı işleri yürütmektedir.

### Çözdüğü Problemler
- Saha ekiplerinin günlük çalışma durumunun anlık takibi
- Malzeme stok ve hareketlerinin merkezi yönetimi
- Proje bazlı ilerleme, durum ve süre takibi
- Personel puantaj ve görev atamaları
- Saha talep ve bildirimlerinin hızlı iletilmesi
- Raporlama ve Excel çıktı ihtiyaçları

### Teknik Yaklaşım
Sistem, firma ofisindeki bir bilgisayarda çalışacak ve aynı WiFi ağındaki cihazlardan erişilebilir olacaktır. **Web uygulaması + SQLite backend** olarak geliştirilmiştir.

### Ölçeklenebilirlik
Uygulama tek firma kullanımı için tasarlanmıştır. Her firma kendi sunucusunda kendi veritabanı ile çalışır. Firma adı, bölge tanımları, proje tipleri ve malzeme kategorileri tamamen yapılandırılabilir (configurable) olacaktır — böylece herhangi bir ildeki herhangi bir müteahhit firma sistemi kendi ihtiyaçlarına göre kurabilir.

---

## Teknoloji Yığını

| Katman | Teknoloji | Detay |
|--------|-----------|-------|
| Frontend | React 18 + Vite | SPA, dashboard odaklı |
| UI Framework | TailwindCSS + shadcn/ui | Modern, temiz arayüz |
| State Management | React Query (TanStack Query) | Server state, cache, auto-refetch |
| Tablo | TanStack Table | Filtreleme, sıralama, sayfalama |
| Grafik | Recharts | Özet kartlar ve raporlar için |
| Backend | Node.js + Express | REST API |
| Veritabanı | SQLite (better-sqlite3) | Tek dosya, senkron, hızlı |
| Excel Export | ExcelJS | Rapor çıktıları için |
| Tarih İşlemleri | date-fns | Türkçe locale desteği |

---

## Proje Klasör Yapısı

```
elektratrack/
├── client/                    # React Frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   ├── Header.jsx
│   │   │   │   └── MainLayout.jsx
│   │   │   ├── dashboard/
│   │   │   │   ├── OzetKartlar.jsx
│   │   │   │   ├── EkipDurumlari.jsx
│   │   │   │   ├── BolgeDagilimi.jsx
│   │   │   │   ├── AcikTalepler.jsx
│   │   │   │   └── SonAktiviteler.jsx
│   │   │   ├── ekipler/
│   │   │   │   ├── EkipListesi.jsx
│   │   │   │   ├── EkipDetay.jsx
│   │   │   │   └── EkipForm.jsx
│   │   │   ├── projeler/
│   │   │   │   ├── ProjeListesi.jsx
│   │   │   │   ├── ProjeDetay.jsx
│   │   │   │   ├── ProjeForm.jsx
│   │   │   │   └── ProjeDurumTimeline.jsx
│   │   │   ├── malzeme/
│   │   │   │   ├── StokListesi.jsx
│   │   │   │   ├── MalzemeHareketleri.jsx
│   │   │   │   ├── MalzemeForm.jsx
│   │   │   │   └── StokUyarilari.jsx
│   │   │   ├── personel/
│   │   │   │   ├── PersonelListesi.jsx
│   │   │   │   ├── PersonelDetay.jsx
│   │   │   │   └── PersonelForm.jsx
│   │   │   ├── puantaj/
│   │   │   │   ├── GunlukRapor.jsx
│   │   │   │   ├── PuantajTablosu.jsx
│   │   │   │   └── PuantajForm.jsx
│   │   │   ├── talepler/
│   │   │   │   ├── TalepListesi.jsx
│   │   │   │   ├── TalepDetay.jsx
│   │   │   │   └── TalepForm.jsx
│   │   │   ├── raporlar/
│   │   │   │   ├── RaporOlusturucu.jsx
│   │   │   │   ├── GunlukOzet.jsx
│   │   │   │   ├── HaftalikRapor.jsx
│   │   │   │   └── MalzemeRaporu.jsx
│   │   │   ├── ayarlar/
│   │   │   │   ├── FirmaBilgileri.jsx
│   │   │   │   ├── BolgeYonetimi.jsx
│   │   │   │   └── ProjeTipleri.jsx
│   │   │   └── shared/
│   │   │       ├── DataTable.jsx
│   │   │       ├── StatusBadge.jsx
│   │   │       ├── ConfirmDialog.jsx
│   │   │       ├── SearchInput.jsx
│   │   │       └── DateRangePicker.jsx
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── EkiplerPage.jsx
│   │   │   ├── ProjelerPage.jsx
│   │   │   ├── MalzemePage.jsx
│   │   │   ├── PersonelPage.jsx
│   │   │   ├── PuantajPage.jsx
│   │   │   ├── TaleplerPage.jsx
│   │   │   ├── RaporlarPage.jsx
│   │   │   └── AyarlarPage.jsx
│   │   ├── hooks/
│   │   │   ├── useEkipler.js
│   │   │   ├── useProjeler.js
│   │   │   ├── useMalzeme.js
│   │   │   ├── usePersonel.js
│   │   │   ├── usePuantaj.js
│   │   │   ├── useTalepler.js
│   │   │   └── useDashboard.js
│   │   ├── api/
│   │   │   └── client.js        # Axios/fetch wrapper
│   │   ├── utils/
│   │   │   ├── formatters.js
│   │   │   └── constants.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── server/                    # Node.js Backend
│   ├── db/
│   │   ├── schema.sql         # Tablo tanımları
│   │   ├── seed.sql           # Örnek veri
│   │   └── database.js        # SQLite bağlantı ve init
│   ├── routes/
│   │   ├── ayarlar.js
│   │   ├── bolgeler.js
│   │   ├── ekipler.js
│   │   ├── projeler.js
│   │   ├── malzeme.js
│   │   ├── personel.js
│   │   ├── puantaj.js
│   │   ├── talepler.js
│   │   ├── dashboard.js
│   │   └── raporlar.js
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   └── validator.js
│   ├── utils/
│   │   ├── excelExport.js
│   │   └── helpers.js
│   ├── server.js              # Ana sunucu dosyası
│   └── package.json
│
├── data/
│   └── elektratrack.db          # SQLite veritabanı dosyası
│
└── README.md
```

---

## Veritabanı Şeması (SQLite)

Aşağıdaki SQL ile veritabanı oluşturulacaktır. `server/db/schema.sql` dosyasına yazılmalıdır.

```sql
-- ============================================
-- FİRMA AYARLARI (Yapılandırma)
-- ============================================
CREATE TABLE IF NOT EXISTS firma_ayarlari (
    anahtar TEXT PRIMARY KEY,
    deger TEXT NOT NULL,
    aciklama TEXT
);

-- Varsayılan firma ayarları
INSERT OR IGNORE INTO firma_ayarlari (anahtar, deger, aciklama) VALUES
('firma_adi', 'Firma Adı', 'Raporlarda ve başlıkta görünecek firma adı'),
('firma_il', 'İl', 'Firmanın bulunduğu il'),
('firma_telefon', '', 'Firma telefon numarası'),
('firma_adres', '', 'Firma adresi'),
('firma_logo_url', '', 'Firma logo dosya yolu'),
('dagitim_sirketi', 'EDAŞ', 'Çalışılan elektrik dağıtım şirketi adı'),
('para_birimi', 'TRY', 'Para birimi'),
('calisan_proje_tipleri', 'YB,KET,Tesis', 'Virgülle ayrılmış proje tipleri');

-- ============================================
-- BÖLGELER (Dinamik il/ilçe/bölge tanımları)
-- ============================================
CREATE TABLE IF NOT EXISTS bolgeler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bolge_adi TEXT NOT NULL,              -- 'Bafra', 'Alaçam', 'Merkez' vb.
    bolge_tipi TEXT DEFAULT 'ilce',       -- 'il', 'ilce', 'mahalle', 'saha'
    ust_bolge_id INTEGER,                 -- Hiyerarşi: İl > İlçe > Mahalle
    aktif BOOLEAN DEFAULT 1,
    sira INTEGER DEFAULT 0,              -- Gösterim sırası
    FOREIGN KEY (ust_bolge_id) REFERENCES bolgeler(id)
);

-- ============================================
-- PERSONEL TABLOSU
-- ============================================
CREATE TABLE IF NOT EXISTS personel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad_soyad TEXT NOT NULL,
    telefon TEXT,
    gorev TEXT,                          -- 'ekip_basi', 'usta', 'teknisyen', 'cirak', 'sofor'
    ekip_id INTEGER,
    aktif BOOLEAN DEFAULT 1,
    notlar TEXT,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id)
);

-- ============================================
-- EKİPLER TABLOSU
-- ============================================
CREATE TABLE IF NOT EXISTS ekipler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ekip_adi TEXT NOT NULL,              -- 'Ekip 1', 'Ekip 2' vb.
    ekip_kodu TEXT UNIQUE,               -- 'EK-01', 'EK-02' vb.
    ekip_basi_id INTEGER,
    varsayilan_bolge_id INTEGER,          -- Dinamik bölge referansı
    arac_plaka TEXT,
    durum TEXT DEFAULT 'aktif',          -- 'aktif', 'izinli', 'pasif'
    notlar TEXT,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ekip_basi_id) REFERENCES personel(id),
    FOREIGN KEY (varsayilan_bolge_id) REFERENCES bolgeler(id)
);

-- ============================================
-- PROJELER TABLOSU
-- ============================================
CREATE TABLE IF NOT EXISTS projeler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proje_no TEXT UNIQUE NOT NULL,       -- 'YB-2025-001', 'KET-2025-042'
    proje_tipi TEXT NOT NULL,            -- 'YB', 'KET', 'Tesis'
    musteri_adi TEXT,
    bolge_id INTEGER,                    -- Dinamik bölge referansı
    mahalle TEXT,
    adres TEXT,
    durum TEXT DEFAULT 'teslim_alindi',
    -- Durum değerleri:
    -- 'teslim_alindi'     → Sözleşme/yer teslimi yapıldı
    -- 'tasarimda'         → Proje tasarımı yapılıyor
    -- 'onay_bekliyor'     → Onay sürecinde
    -- 'malzeme_bekliyor'  → Malzeme tedarik ediliyor
    -- 'programda'         → İş programına alındı, ekip atanacak
    -- 'sahada'            → Saha çalışması devam ediyor
    -- 'montaj_tamam'      → Montaj bitti, test/kabul bekliyor
    -- 'tamamlandi'        → Proje tamamlandı
    -- 'askida'            → Beklemede (engel var)
    oncelik TEXT DEFAULT 'normal',       -- 'acil', 'yuksek', 'normal', 'dusuk'
    ekip_id INTEGER,
    tahmini_sure_gun INTEGER,
    baslama_tarihi DATE,
    bitis_tarihi DATE,
    teslim_tarihi DATE,                  -- sözleşme teslim tarihi
    gerceklesen_bitis DATE,
    tamamlanma_yuzdesi INTEGER DEFAULT 0,
    notlar TEXT,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id),
    FOREIGN KEY (bolge_id) REFERENCES bolgeler(id)
);

-- ============================================
-- PROJE DURUM GEÇMİŞİ
-- ============================================
CREATE TABLE IF NOT EXISTS proje_durum_gecmisi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proje_id INTEGER NOT NULL,
    eski_durum TEXT,
    yeni_durum TEXT NOT NULL,
    degistiren TEXT,                      -- 'sistem', 'koordinator'
    notlar TEXT,
    tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proje_id) REFERENCES projeler(id)
);

-- ============================================
-- MALZEME DEPOSU
-- ============================================
CREATE TABLE IF NOT EXISTS malzemeler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    malzeme_kodu TEXT UNIQUE,            -- 'KBL-3x150', 'DIR-KLM-50' vb.
    malzeme_adi TEXT NOT NULL,
    kategori TEXT,                        -- 'kablo', 'direk', 'trafo', 'klemens', 'pano', 'diger'
    birim TEXT NOT NULL,                  -- 'metre', 'adet', 'kg', 'takım', 'kutu', 'top'
    stok_miktari REAL DEFAULT 0,
    kritik_seviye REAL DEFAULT 0,        -- bu seviyenin altında uyarı ver
    birim_fiyat REAL DEFAULT 0,
    depo_konumu TEXT,                     -- 'merkez_depo', 'saha_depo_bafra' vb.
    notlar TEXT,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- MALZEME HAREKETLERİ
-- ============================================
CREATE TABLE IF NOT EXISTS malzeme_hareketleri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    malzeme_id INTEGER NOT NULL,
    miktar REAL NOT NULL,
    hareket_tipi TEXT NOT NULL,           -- 'cikis', 'giris', 'iade', 'fire', 'transfer'
    ekip_id INTEGER,
    proje_id INTEGER,
    teslim_alan TEXT,                     -- malzemeyi teslim alan kişi
    teslim_eden TEXT,                     -- malzemeyi veren kişi
    kaynak TEXT DEFAULT 'web',            -- 'web', 'mobil', 'excel_import'
    belge_no TEXT,                        -- irsaliye/fiş numarası
    notlar TEXT,
    tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (malzeme_id) REFERENCES malzemeler(id),
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id),
    FOREIGN KEY (proje_id) REFERENCES projeler(id)
);

-- ============================================
-- GÜNLÜK PUANTAJ / SAHA RAPORU
-- ============================================
CREATE TABLE IF NOT EXISTS gunluk_rapor (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tarih DATE DEFAULT (date('now')),
    ekip_id INTEGER NOT NULL,
    proje_id INTEGER,
    bolge_id INTEGER,                    -- Dinamik bölge referansı
    kisi_sayisi INTEGER DEFAULT 0,
    calisan_listesi TEXT,                 -- JSON: ["Ali Yılmaz", "Veli Demir"]
    baslama_saati TIME,
    bitis_saati TIME,
    yapilan_is TEXT,                      -- serbest metin açıklama
    is_kategorisi TEXT,                   -- 'kablo_cekimi', 'direk_dikimi', 'trafo_montaj', 'pano_montaj', 'test', 'diger'
    hava_durumu TEXT,                     -- 'acik', 'yagmurlu', 'karli', 'ruzgarli'
    enerji_kesintisi BOOLEAN DEFAULT 0,
    kesinti_detay TEXT,
    arac_km_baslangic INTEGER,
    arac_km_bitis INTEGER,
    kaynak TEXT DEFAULT 'web',            -- 'web', 'mobil'
    notlar TEXT,
    olusturma_zamani DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id),
    FOREIGN KEY (proje_id) REFERENCES projeler(id),
    -- Bir ekip aynı gün aynı projede tek rapor
    UNIQUE(tarih, ekip_id, proje_id)
);

-- ============================================
-- TALEPLER / BİLDİRİMLER
-- ============================================
CREATE TABLE IF NOT EXISTS talepler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    talep_no TEXT UNIQUE,                 -- otomatik: 'TLP-2025-0001'
    ekip_id INTEGER,
    proje_id INTEGER,
    talep_eden_id INTEGER,               -- personel id
    talep_tipi TEXT NOT NULL,
    -- Talep tipleri:
    -- 'malzeme'           → Malzeme talebi
    -- 'enerji_kesintisi'  → Enerji kesintisi talebi
    -- 'arac'              → Araç/nakliye talebi
    -- 'teknik_destek'     → Teknik destek
    -- 'is_guvenligi'      → İSG ile ilgili
    -- 'diger'             → Diğer
    aciklama TEXT NOT NULL,
    talep_detay TEXT,                     -- JSON: malzeme listesi vb.
    oncelik TEXT DEFAULT 'normal',        -- 'acil', 'yuksek', 'normal', 'dusuk'
    durum TEXT DEFAULT 'beklemede',       -- 'beklemede', 'isleniyor', 'onaylandi', 'reddedildi', 'tamamlandi'
    atanan_kisi TEXT,                     -- talebi işleyen kişi
    cozum_aciklama TEXT,
    kaynak TEXT DEFAULT 'web',            -- 'web', 'mobil'
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    cozum_tarihi DATETIME,
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id),
    FOREIGN KEY (proje_id) REFERENCES projeler(id),
    FOREIGN KEY (talep_eden_id) REFERENCES personel(id)
);

-- ============================================
-- GÖREV ATAMA / İŞ TAKİBİ
-- ============================================
CREATE TABLE IF NOT EXISTS gorevler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gorev_basligi TEXT NOT NULL,
    aciklama TEXT,
    gorev_tipi TEXT,                      -- 'saha_isi', 'malzeme_temini', 'tasarim', 'onay', 'test', 'diger'
    proje_id INTEGER,
    ekip_id INTEGER,
    atanan_personel_id INTEGER,
    oncelik TEXT DEFAULT 'normal',
    durum TEXT DEFAULT 'atandi',          -- 'atandi', 'baslamadi', 'devam_ediyor', 'tamamlandi', 'iptal'
    son_tarih DATE,
    tamamlanma_tarihi DATE,
    olusturan TEXT DEFAULT 'koordinator', -- 'koordinator', 'sistem', 'otomasyon'
    notlar TEXT,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proje_id) REFERENCES projeler(id),
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id),
    FOREIGN KEY (atanan_personel_id) REFERENCES personel(id)
);

-- ============================================
-- AKTİVİTE LOGU (Tüm sistem hareketleri)
-- ============================================
CREATE TABLE IF NOT EXISTS aktivite_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    modul TEXT NOT NULL,                  -- 'proje', 'malzeme', 'ekip', 'puantaj', 'talep', 'gorev'
    islem TEXT NOT NULL,                  -- 'olusturma', 'guncelleme', 'silme', 'durum_degisikligi'
    kayit_id INTEGER,                     -- ilgili tablodaki kayıt ID
    detay TEXT,                           -- JSON: değişiklik detayları
    kullanici TEXT DEFAULT 'koordinator', -- 'koordinator', 'sistem'
    tarih DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXLER (Performans için)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_projeler_durum ON projeler(durum);
CREATE INDEX IF NOT EXISTS idx_projeler_bolge ON projeler(bolge_id);
CREATE INDEX IF NOT EXISTS idx_projeler_ekip ON projeler(ekip_id);
CREATE INDEX IF NOT EXISTS idx_malzeme_hareketleri_tarih ON malzeme_hareketleri(tarih);
CREATE INDEX IF NOT EXISTS idx_malzeme_hareketleri_ekip ON malzeme_hareketleri(ekip_id);
CREATE INDEX IF NOT EXISTS idx_gunluk_rapor_tarih ON gunluk_rapor(tarih);
CREATE INDEX IF NOT EXISTS idx_gunluk_rapor_ekip ON gunluk_rapor(ekip_id);
CREATE INDEX IF NOT EXISTS idx_talepler_durum ON talepler(durum);
CREATE INDEX IF NOT EXISTS idx_gorevler_durum ON gorevler(durum);
CREATE INDEX IF NOT EXISTS idx_aktivite_log_tarih ON aktivite_log(tarih);

-- ============================================
-- TETİKLEYİCİLER (Triggers)
-- ============================================

-- Malzeme çıkışında stok güncelle
CREATE TRIGGER IF NOT EXISTS trg_malzeme_cikis
AFTER INSERT ON malzeme_hareketleri
WHEN NEW.hareket_tipi = 'cikis'
BEGIN
    UPDATE malzemeler
    SET stok_miktari = stok_miktari - NEW.miktar,
        guncelleme_tarihi = CURRENT_TIMESTAMP
    WHERE id = NEW.malzeme_id;
END;

-- Malzeme girişinde stok güncelle
CREATE TRIGGER IF NOT EXISTS trg_malzeme_giris
AFTER INSERT ON malzeme_hareketleri
WHEN NEW.hareket_tipi IN ('giris', 'iade')
BEGIN
    UPDATE malzemeler
    SET stok_miktari = stok_miktari + NEW.miktar,
        guncelleme_tarihi = CURRENT_TIMESTAMP
    WHERE id = NEW.malzeme_id;
END;

-- Proje durum değişikliğinde geçmiş kaydet
CREATE TRIGGER IF NOT EXISTS trg_proje_durum_degisikligi
AFTER UPDATE OF durum ON projeler
WHEN OLD.durum != NEW.durum
BEGIN
    INSERT INTO proje_durum_gecmisi (proje_id, eski_durum, yeni_durum, degistiren)
    VALUES (NEW.id, OLD.durum, NEW.durum, 'sistem');
END;

-- Talep numarası otomatik oluştur
CREATE TRIGGER IF NOT EXISTS trg_talep_no
AFTER INSERT ON talepler
WHEN NEW.talep_no IS NULL
BEGIN
    UPDATE talepler
    SET talep_no = 'TLP-' || strftime('%Y', 'now') || '-' ||
        printf('%04d', (SELECT COUNT(*) FROM talepler WHERE strftime('%Y', olusturma_tarihi) = strftime('%Y', 'now')))
    WHERE id = NEW.id;
END;
```

---

## Örnek Veri (Seed Data)

`server/db/seed.sql` dosyasına yazılacak başlangıç verileri:

```sql
-- Firma Ayarları (örnek)
UPDATE firma_ayarlari SET deger = 'Örnek Elektrik Müteahhitlik Ltd.' WHERE anahtar = 'firma_adi';
UPDATE firma_ayarlari SET deger = 'Samsun' WHERE anahtar = 'firma_il';
UPDATE firma_ayarlari SET deger = 'YEDAŞ' WHERE anahtar = 'dagitim_sirketi';

-- Bölgeler (firma kendi ilçelerini tanımlar)
INSERT INTO bolgeler (bolge_adi, bolge_tipi, ust_bolge_id, sira) VALUES
('Samsun', 'il', NULL, 1);
INSERT INTO bolgeler (bolge_adi, bolge_tipi, ust_bolge_id, sira) VALUES
('Bafra', 'ilce', 1, 1),
('Alaçam', 'ilce', 1, 2),
('Yakakent', 'ilce', 1, 3),
('19 Mayıs', 'ilce', 1, 4);

-- Personel
INSERT INTO personel (ad_soyad, telefon, gorev) VALUES
('Ahmet Yıldız', '0532-111-2233', 'ekip_basi'),
('Mehmet Kara', '0533-222-3344', 'usta'),
('Ali Demir', '0534-333-4455', 'teknisyen'),
('Hasan Çelik', '0535-444-5566', 'ekip_basi'),
('Osman Koç', '0536-555-6677', 'usta'),
('Veli Arslan', '0537-666-7788', 'teknisyen'),
('Emre Şahin', '0538-777-8899', 'ekip_basi'),
('Burak Aydın', '0539-888-9900', 'sofor'),
('Serkan Öz', '0530-999-0011', 'cirak'),
('Fatih Erdoğan', '0531-000-1122', 'usta');

-- Ekipler (bolge_id referansları bolgeler tablosuna)
INSERT INTO ekipler (ekip_adi, ekip_kodu, ekip_basi_id, varsayilan_bolge_id, arac_plaka) VALUES
('Ekip 1', 'EK-01', 1, 2, '55 ABC 101'),
('Ekip 2', 'EK-02', 4, 3, '55 DEF 202'),
('Ekip 3', 'EK-03', 7, 5, '55 GHI 303');

-- Personeli ekiplere ata
UPDATE personel SET ekip_id = 1 WHERE id IN (1, 2, 3);
UPDATE personel SET ekip_id = 2 WHERE id IN (4, 5, 6, 8);
UPDATE personel SET ekip_id = 3 WHERE id IN (7, 9, 10);

-- Malzemeler
INSERT INTO malzemeler (malzeme_kodu, malzeme_adi, kategori, birim, stok_miktari, kritik_seviye) VALUES
('KBL-3x150', '3x150mm² XLPE Kablo', 'kablo', 'metre', 2500, 500),
('KBL-3x70', '3x70mm² XLPE Kablo', 'kablo', 'metre', 1800, 300),
('KBL-3x35', '3x35mm² NYY Kablo', 'kablo', 'metre', 3200, 400),
('DIR-BET-9', '9m Beton Direk', 'direk', 'adet', 45, 10),
('DIR-BET-12', '12m Beton Direk', 'direk', 'adet', 20, 5),
('KLM-50', '50mm² Klemens', 'klemens', 'adet', 320, 50),
('KLM-95', '95mm² Klemens', 'klemens', 'adet', 180, 30),
('PNO-DAG', 'Dağıtım Panosu', 'pano', 'adet', 12, 3),
('TRF-100', '100 kVA Trafo', 'trafo', 'adet', 3, 1),
('SIG-35', '35mm² Sigorta', 'diger', 'adet', 500, 100),
('IZL-BANT', 'İzole Bant (Top)', 'diger', 'top', 150, 30),
('CIV-M12', 'M12 Civata Takımı', 'diger', 'takım', 200, 40);

-- Projeler (bolge_id referansları bolgeler tablosuna, Tesis tipi eklendi)
INSERT INTO projeler (proje_no, proje_tipi, musteri_adi, bolge_id, mahalle, durum, oncelik, ekip_id, tamamlanma_yuzdesi) VALUES
('YB-2025-001', 'YB', 'OSB Müdürlüğü', 2, 'Sanayi Mah.', 'sahada', 'yuksek', 1, 60),
('YB-2025-002', 'YB', 'Belediye Başkanlığı', 3, 'Merkez', 'malzeme_bekliyor', 'normal', NULL, 20),
('KET-2025-010', 'KET', 'Tarım Kooperatifi', 4, 'Çarşı Mah.', 'programda', 'normal', 2, 10),
('YB-2025-003', 'YB', 'Üniversite Rektörlüğü', 5, 'Kampüs', 'tasarimda', 'yuksek', NULL, 5),
('KET-2025-011', 'KET', 'Devlet Hastanesi', 2, 'Hastane Cad.', 'sahada', 'acil', 1, 45),
('KET-2025-012', 'KET', 'İlkokul Müdürlüğü', 3, 'Okul Sok.', 'tamamlandi', 'normal', 2, 100),
('TES-2025-001', 'Tesis', 'Balıkçı Barınağı', 4, 'Liman', 'onay_bekliyor', 'dusuk', NULL, 15),
('KET-2025-013', 'KET', 'AVM Yönetimi', 2, 'Atatürk Blv.', 'askida', 'normal', NULL, 30),
('TES-2025-002', 'Tesis', 'Sanayi Sitesi', 2, 'Sanayi Mah.', 'sahada', 'yuksek', 3, 35);
```

---

## API Endpoint Tasarımı

### Dashboard

```
GET /api/dashboard/ozet
  → Toplam aktif ekip, sahada kişi sayısı, bekleyen talep, kritik stok, aktif proje
  → Response: {
      aktif_ekip: 3,
      sahada_kisi: 12,
      bekleyen_talep: 4,
      kritik_stok_sayisi: 2,
      aktif_proje: 5,
      bugun_tamamlanan: 1,
      gunluk_rapor_durumu: [
        { ekip_id: 1, ekip_adi: "Ekip 1", rapor_geldi: true },
        { ekip_id: 2, ekip_adi: "Ekip 2", rapor_geldi: false }
      ]
    }

GET /api/dashboard/aktiviteler?limit=20
  → Son aktiviteler (tüm modüllerden)

GET /api/dashboard/ekip-durumlari
  → Her ekibin bugünkü durumu, konumu, kişi sayısı, çalıştığı proje
```

### Firma Ayarları ve Bölgeler

```
GET    /api/ayarlar                 → Tüm firma ayarları
PUT    /api/ayarlar                 → Ayarları toplu güncelle (body: { firma_adi: "...", ... })
GET    /api/bolgeler                → Tüm bölgeler (hiyerarşik)
GET    /api/bolgeler/:id            → Bölge detay
POST   /api/bolgeler                → Yeni bölge ekle
PUT    /api/bolgeler/:id            → Bölge güncelle
DELETE /api/bolgeler/:id            → Bölge sil (altında kayıt yoksa)
```

### Ekipler

```
GET    /api/ekipler                → Tüm ekipler (personel sayısı ile birlikte)
GET    /api/ekipler/:id            → Ekip detay (personel listesi, aktif projeler, son raporlar)
POST   /api/ekipler                → Yeni ekip oluştur
PUT    /api/ekipler/:id            → Ekip güncelle
DELETE /api/ekipler/:id            → Ekip sil (soft delete: durum='pasif')
GET    /api/ekipler/:id/raporlar   → Ekibin günlük raporları
GET    /api/ekipler/:id/projeler   → Ekibe atanmış projeler
```

### Projeler

```
GET    /api/projeler                    → Tüm projeler (filtreleme: ?durum=sahada&bolge_id=2&tip=YB)
GET    /api/projeler/:id                → Proje detay (durum geçmişi, malzeme kullanımı, raporlar)
POST   /api/projeler                    → Yeni proje oluştur
PUT    /api/projeler/:id                → Proje güncelle
PATCH  /api/projeler/:id/durum          → Proje durumu değiştir (geçmiş otomatik kaydedilir)
DELETE /api/projeler/:id                → Proje sil
GET    /api/projeler/:id/malzeme        → Projede kullanılan malzemeler
GET    /api/projeler/:id/durum-gecmisi  → Proje durum değişiklik geçmişi
GET    /api/projeler/istatistikler      → Bölge/tip/durum bazlı istatistikler
```

### Malzeme

```
GET    /api/malzemeler                   → Tüm malzemeler (stok durumu ile)
GET    /api/malzemeler/:id               → Malzeme detay + hareket geçmişi
POST   /api/malzemeler                   → Yeni malzeme tanımla
PUT    /api/malzemeler/:id               → Malzeme bilgisi güncelle
GET    /api/malzemeler/kritik            → Kritik seviyenin altındaki malzemeler
POST   /api/malzeme-hareketleri          → Yeni hareket kaydet (çıkış/giriş/iade)
GET    /api/malzeme-hareketleri          → Hareket listesi (filtre: ?tarih_baslangic=&tarih_bitis=&ekip_id=)
GET    /api/malzeme-hareketleri/ozet     → Belirli dönem malzeme özeti
```

### Personel

```
GET    /api/personel              → Tüm personel
GET    /api/personel/:id          → Personel detay
POST   /api/personel              → Yeni personel ekle
PUT    /api/personel/:id          → Personel güncelle
DELETE /api/personel/:id          → Personel sil (soft delete)
PATCH  /api/personel/:id/ekip     → Personeli ekibe ata/çıkar
```

### Puantaj / Günlük Rapor

```
GET    /api/puantaj                → Günlük raporlar (filtre: ?tarih=&ekip_id=)
GET    /api/puantaj/:id            → Rapor detay
POST   /api/puantaj                → Yeni günlük rapor oluştur
PUT    /api/puantaj/:id            → Rapor güncelle
GET    /api/puantaj/ozet           → Dönem bazlı puantaj özeti (adam/gün)
GET    /api/puantaj/takvim/:ay     → Aylık takvim görünümü verisi
```

### Talepler

```
GET    /api/talepler               → Tüm talepler (filtre: ?durum=beklemede&tip=malzeme)
GET    /api/talepler/:id           → Talep detay
POST   /api/talepler               → Yeni talep oluştur
PUT    /api/talepler/:id           → Talep güncelle
PATCH  /api/talepler/:id/durum     → Talep durumu değiştir
GET    /api/talepler/bekleyen      → Sadece bekleyen talepler (dashboard için)
```

### Görevler

```
GET    /api/gorevler               → Tüm görevler (filtre: ?durum=&ekip_id=&personel_id=)
GET    /api/gorevler/:id           → Görev detay
POST   /api/gorevler               → Yeni görev ata
PUT    /api/gorevler/:id           → Görev güncelle
PATCH  /api/gorevler/:id/durum     → Görev durumu değiştir
GET    /api/gorevler/takvim        → Takvim görünümü için görevler
```

### Raporlar / Excel Export

```
GET    /api/raporlar/gunluk-ozet?tarih=2025-06-15           → Günlük özet rapor (JSON)
GET    /api/raporlar/haftalik?hafta_baslangic=2025-06-09    → Haftalık rapor
GET    /api/raporlar/malzeme-kullanim?ay=2025-06             → Aylık malzeme kullanım raporu
GET    /api/raporlar/proje-durumu                            → Tüm projelerin durum raporu
GET    /api/raporlar/ekip-performans?ay=2025-06              → Ekip performans raporu

-- Excel export versiyonları (aynı endpoint'e ?format=excel eklenerek)
GET    /api/raporlar/gunluk-ozet?tarih=2025-06-15&format=excel
GET    /api/raporlar/malzeme-kullanim?ay=2025-06&format=excel
```

---

## Frontend Sayfa Tasarımları

### Ana Sayfa (Dashboard)

```
┌──────────────────────────────────────────────────────────────────┐
│  [☰ Sidebar]     ⚡ ElektraTrack                 📅 08.02.2026  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│
│  │ 🏗️ 6     │ │ 👷 12    │ │ ⚠️ 3     │ │ 📦 2     │ │ ✅ 1   ││
│  │ Aktif    │ │ Sahada   │ │ Bekleyen │ │ Kritik   │ │ Bugün  ││
│  │ Proje    │ │ Personel │ │ Talep    │ │ Stok     │ │Biten   ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘│
│                                                                  │
│  ┌─ EKİP DURUMLARI ──────────────┐  ┌─ SON AKTİVİTELER ──────┐│
│  │                                │  │                          ││
│  │  🟢 Ekip 1 - [Bölge adı]      │  │ 09:15 Ekip 1 malzeme    ││
│  │     YB-2025-001 | 4 kişi      │  │       çıkışı: 3x150     ││
│  │     Son rapor: 08:30          │  │       kablo 120m         ││
│  │                                │  │                          ││
│  │  🟡 Ekip 2 - [Bölge adı]      │  │ 09:00 Yeni talep:       ││
│  │     KET-2025-010 | 3 kişi     │  │       Ekip 3 klemens    ││
│  │     Rapor bekleniyor          │  │       talebi             ││
│  │                                │  │                          ││
│  │  🔴 Ekip 3 - [Bölge adı]      │  │ 08:45 Proje durum:      ││
│  │     Acil talep var!           │  │       TES-2025-002       ││
│  │     Son rapor: 08:15          │  │       → sahada           ││
│  │                                │  │                          ││
│  └────────────────────────────────┘  └──────────────────────────┘│
│                                                                  │
│  ┌─ PROJE DAĞILIMI ──────────────┐  ┌─ ACİL / ÖNEMLİ ─────────┐│
│  │                                │  │                          ││
│  │  [Pasta Grafik / Bar Chart]   │  │ 🔴 KET-2025-011 Acil     ││
│  │  Bölge bazlı proje dağılımı   │  │    Devlet Hastanesi %45  ││
│  │  Durum bazlı proje dağılımı   │  │                          ││
│  │  Tip bazlı: YB / KET / Tesis │  │ ⚠️ 3x150 Kablo stok     ││
│  │                                │  │    kritik seviyeye       ││
│  │  [Bölge 1]: ███████ 3         │  │    yaklaşıyor            ││
│  │  [Bölge 2]: ████ 2            │  │                          ││
│  │  [Bölge 3]: ███ 2             │  │ ⏰ YB-2025-002 malzeme   ││
│  │  [Bölge 4]: ██ 2              │  │    5 gündür bekliyor     ││
│  │                                │  │                          ││
│  └────────────────────────────────┘  └──────────────────────────┘│
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Sidebar Navigasyon

```
┌─────────────────────┐
│  ⚡ ElektraTrack     │
│  [Firma Adı]        │
│                     │
│  📊 Dashboard       │
│  👥 Ekipler         │
│  🏗️ Projeler        │
│  📦 Malzeme         │
│  👤 Personel        │
│  📋 Puantaj         │
│  📨 Talepler        │
│  ✅ Görevler        │
│  📈 Raporlar        │
│  ──────────────     │
│  ⚙️ Ayarlar         │
│     Firma Bilgileri │
│     Bölge Yönetimi  │
│     Proje Tipleri   │
└─────────────────────┘
```

### Projeler Sayfası

```
┌──────────────────────────────────────────────────────────────────┐
│  Projeler                                    [+ Yeni Proje]     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Filtreler: [Bölge ▾] [Durum ▾] [Tip ▾] [Öncelik ▾] 🔍 Ara...  │
│                                                                  │
│  ┌────────┬──────┬────────┬──────────────┬──────────┬──────┬───┐│
│  │Proje No│ Tip  │ Bölge  │ Müşteri      │ Durum    │  %   │ ⚡││
│  ├────────┼──────┼────────┼──────────────┼──────────┼──────┼───┤│
│  │YB-001  │ YB   │ [Blg1] │ OSB Müd.     │ 🟢Sahada │ 60%  │ ▸ ││
│  │KET-011 │ KET  │ [Blg1] │ Devlet Hast. │ 🔴Acil   │ 45%  │ ▸ ││
│  │TES-002 │Tesis │ [Blg1] │ Sanayi Sit.  │ 🟢Sahada │ 35%  │ ▸ ││
│  │YB-002  │ YB   │ [Blg2] │ Belediye     │ 🟡Mlz.Bk│ 20%  │ ▸ ││
│  │KET-010 │ KET  │ [Blg3] │ Tarım Koop.  │ 🔵Prog.  │ 10%  │ ▸ ││
│  │YB-003  │ YB   │ [Blg4] │ Üniversite   │ 🟣Tasrım│ 5%   │ ▸ ││
│  └────────┴──────┴────────┴──────────────┴──────────┴──────┴───┘│
│                                                                  │
│  Sayfa 1/2  [◀ Önceki] [Sonraki ▶]                             │
└──────────────────────────────────────────────────────────────────┘
```

### Proje Detay Sayfası

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Projeler / YB-2025-001                     [Düzenle] [Sil]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  OSB Müdürlüğü — Yeni Bağlantı                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 60%          │
│                                                                  │
│  Tip: YB  |  Bölge: [Bölge adı]  |  Ekip: Ekip 1  |  Öncelik: Yüksek │
│                                                                  │
│  ┌─ DURUM TİMELINE ───────────────────────────────────────────┐ │
│  │  ✅ Teslim Alındı (10.01) → ✅ Tasarım (15.01)            │ │
│  │  → ✅ Onay (22.01) → ✅ Malzeme (01.02) → 🔵 Sahada      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  [Sekmeler: Detay | Malzeme | Raporlar | Görevler | Geçmiş]    │
│                                                                  │
│  ┌─ MALZEME KULLANIMI ────────────────────────────────────────┐ │
│  │  3x150 XLPE Kablo ........ 480m kullanıldı                │ │
│  │  9m Beton Direk .......... 12 adet                        │ │
│  │  50mm Klemens ............ 24 adet                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ SON RAPORLAR ─────────────────────────────────────────────┐ │
│  │  08.02 - Ekip 1: Kablo çekimi devam ediyor, 4 kişi       │ │
│  │  07.02 - Ekip 1: Direk dikimi tamamlandı, 5 kişi         │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Renk Kodları ve Durum Göstergeleri

### Proje Durumları

| Durum | Renk | Badge |
|-------|------|-------|
| teslim_alindi | Gri | ⚪ |
| tasarimda | Mor | 🟣 |
| onay_bekliyor | Turuncu | 🟠 |
| malzeme_bekliyor | Sarı | 🟡 |
| programda | Mavi | 🔵 |
| sahada | Yeşil | 🟢 |
| montaj_tamam | Açık yeşil | ✅ |
| tamamlandi | Koyu yeşil | ✅✅ |
| askida | Kırmızı | 🔴 |

### Ekip Durumları (Dashboard)

| Durum | Renk | Açıklama |
|-------|------|----------|
| Yeşil 🟢 | Bugün rapor geldi, aktif çalışıyor |
| Sarı 🟡 | Henüz bugün rapor gelmedi |
| Kırmızı 🔴 | Acil talep var veya sorun bildirildi |
| Gri ⚪ | İzinli veya pasif |

### Talep Öncelikleri

| Öncelik | Renk |
|---------|------|
| Acil | Kırmızı |
| Yüksek | Turuncu |
| Normal | Mavi |
| Düşük | Gri |

---

## Backend Detayları

### Server Yapılandırması

`server/server.js`:

```javascript
// Temel yapı taslağı
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Route'ları bağla
app.use('/api/ayarlar', require('./routes/ayarlar'));
app.use('/api/bolgeler', require('./routes/bolgeler'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/ekipler', require('./routes/ekipler'));
app.use('/api/projeler', require('./routes/projeler'));
app.use('/api/malzemeler', require('./routes/malzeme'));
app.use('/api/personel', require('./routes/personel'));
app.use('/api/puantaj', require('./routes/puantaj'));
app.use('/api/talepler', require('./routes/talepler'));
app.use('/api/gorevler', require('./routes/gorevler'));
app.use('/api/raporlar', require('./routes/raporlar'));
app.use('/api/malzeme-hareketleri', require('./routes/malzeme'));

// Production: React build dosyalarını sun
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Veritabanını başlat ve sunucuyu aç
initDatabase();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sunucu çalışıyor: http://0.0.0.0:${PORT}`);
});
```

### Veritabanı Bağlantısı

`server/db/database.js`:

```javascript
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/elektratrack.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const SEED_PATH = path.join(__dirname, 'seed.sql');

let db;

function getDb() {
  if (!db) {
    // data klasörünü oluştur
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');      // Performans için
    db.pragma('foreign_keys = ON');       // Referans bütünlüğü
  }
  return db;
}

function initDatabase() {
  const database = getDb();
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  database.exec(schema);

  // Eğer personel tablosu boşsa seed data yükle
  const count = database.prepare('SELECT COUNT(*) as c FROM personel').get();
  if (count.c === 0) {
    const seed = fs.readFileSync(SEED_PATH, 'utf8');
    database.exec(seed);
    console.log('Örnek veri yüklendi.');
  }
}

module.exports = { getDb, initDatabase };
```

---

## Excel Export Özellikleri

Uygulama aşağıdaki raporları Excel formatında export edebilmelidir:

1. **Günlük Saha Raporu**: Tüm ekiplerin o günkü çalışma durumu
2. **Haftalık Puantaj Özeti**: Ekip bazlı adam/gün tablosu
3. **Malzeme Hareket Raporu**: Belirli dönemdeki tüm giriş/çıkış/iade hareketleri
4. **Stok Durum Raporu**: Anlık stok durumu ve kritik seviyelere yakın malzemeler
5. **Proje Durum Raporu**: Tüm projelerin güncel durumu, tamamlanma yüzdeleri
6. **Ekip Performans Raporu**: Ekip bazlı tamamlanan iş, kullanılan malzeme, çalışma günü

Her raporda üst bilgi olarak şirket adı, rapor tarihi, oluşturan bilgisi bulunmalıdır.

---

## Geliştirme Notları

### Claude Code ile Geliştirme Sırası

1. **Proje iskeletini oluştur**: Node.js + React + Vite + TailwindCSS
2. **Veritabanını kur**: schema.sql + seed.sql + database.js
3. **Backend API'yi geliştir**: Önce ayarlar, bölgeler, dashboard ve projeler route'ları
4. **Frontend layout**: Sidebar + Header + Ana sayfa iskeleti
5. **İlk kurulum sihirbazı**: Firma adı, il, bölgeler, proje tipleri tanımlama ekranı
6. **Dashboard bileşenleri**: Özet kartlar, ekip durumları
7. **Proje yönetimi**: Liste, detay, form, durum değiştirme (YB/KET/Tesis)
8. **Malzeme yönetimi**: Stok, hareketler, kritik uyarılar
9. **Personel ve ekip yönetimi**
10. **Puantaj sistemi**: Günlük rapor giriş ve görüntüleme
11. **Talep sistemi**: Oluşturma, durum takibi
12. **Görev yönetimi**: Atama, takip
13. **Raporlar ve Excel export**
14. **Ayarlar sayfası**: Firma bilgileri, bölge yönetimi, proje tipleri
15. **Son dokunuşlar**: Responsive tasarım, hata yönetimi, loading states

### Önemli Kurallar

- **Ürün odaklı geliştirme**: Bu bir satılabilir ürün olacak — hardcoded bölge/şirket adı olmamalı, her şey ayarlar üzerinden yapılandırılabilir olmalı
- **İlk kurulum sihirbazı**: Uygulama ilk açıldığında firma adı, il, bölgeler ve proje tiplerini soran basit bir setup wizard göstermeli
- Tüm tarihler Türkiye saati (UTC+3) ile işlenmelidir
- Arayüz tamamen Türkçe olmalıdır
- Tüm tablolarda arama, filtreleme ve sıralama olmalıdır
- Silme işlemleri soft delete olmalıdır (aktif=0 veya durum='pasif')
- Her veri değişikliğinde aktivite_log tablosuna kayıt düşülmelidir
- API yanıtları tutarlı format kullanmalıdır: `{ success: true, data: {...} }`
- Hata yanıtları: `{ success: false, error: "hata mesajı" }`
- Frontend'de loading skeleton'lar kullanılmalıdır
- Form validasyonları hem frontend hem backend'de yapılmalıdır
- Proje tipleri (YB, KET, Tesis) ayarlardan genişletilebilir olmalı
- Bölge hiyerarşisi (il → ilçe → mahalle) dinamik olmalı

### Yerel Ağ Erişimi

```bash
# Development
cd client && npm run dev -- --host 0.0.0.0 --port 3000
cd server && node server.js  # 0.0.0.0:4000

# Production build
cd client && npm run build
# server.js static dosyaları sunacak, tek port yeterli (4000)
```

Aynı WiFi ağındaki cihazlar `http://<bilgisayar-ip>:4000` adresinden erişir.
