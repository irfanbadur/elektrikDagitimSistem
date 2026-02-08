-- FİRMA AYARLARI
CREATE TABLE IF NOT EXISTS firma_ayarlari (
    anahtar TEXT PRIMARY KEY,
    deger TEXT NOT NULL,
    aciklama TEXT
);

INSERT OR IGNORE INTO firma_ayarlari (anahtar, deger, aciklama) VALUES
('firma_adi', 'Firma Adı', 'Raporlarda ve başlıkta görünecek firma adı'),
('firma_il', 'İl', 'Firmanın bulunduğu il'),
('firma_telefon', '', 'Firma telefon numarası'),
('firma_adres', '', 'Firma adresi'),
('firma_logo_url', '', 'Firma logo dosya yolu'),
('dagitim_sirketi', 'EDAŞ', 'Çalışılan elektrik dağıtım şirketi adı'),
('para_birimi', 'TRY', 'Para birimi'),
('calisan_proje_tipleri', 'YB,KET,Tesis', 'Virgülle ayrılmış proje tipleri');

-- BÖLGELER
CREATE TABLE IF NOT EXISTS bolgeler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bolge_adi TEXT NOT NULL,
    bolge_tipi TEXT DEFAULT 'ilce',
    ust_bolge_id INTEGER,
    aktif BOOLEAN DEFAULT 1,
    sira INTEGER DEFAULT 0,
    FOREIGN KEY (ust_bolge_id) REFERENCES bolgeler(id)
);

-- PERSONEL
CREATE TABLE IF NOT EXISTS personel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad_soyad TEXT NOT NULL,
    telefon TEXT,
    telegram_id TEXT,
    telegram_kullanici_adi TEXT,
    gorev TEXT,
    ekip_id INTEGER,
    aktif BOOLEAN DEFAULT 1,
    notlar TEXT,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id)
);

-- EKİPLER
CREATE TABLE IF NOT EXISTS ekipler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ekip_adi TEXT NOT NULL,
    ekip_kodu TEXT UNIQUE,
    ekip_basi_id INTEGER,
    varsayilan_bolge_id INTEGER,
    arac_plaka TEXT,
    durum TEXT DEFAULT 'aktif',
    notlar TEXT,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ekip_basi_id) REFERENCES personel(id),
    FOREIGN KEY (varsayilan_bolge_id) REFERENCES bolgeler(id)
);

-- PROJELER
CREATE TABLE IF NOT EXISTS projeler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proje_no TEXT UNIQUE NOT NULL,
    proje_tipi TEXT NOT NULL,
    musteri_adi TEXT,
    bolge_id INTEGER,
    mahalle TEXT,
    adres TEXT,
    durum TEXT DEFAULT 'teslim_alindi',
    oncelik TEXT DEFAULT 'normal',
    ekip_id INTEGER,
    tahmini_sure_gun INTEGER,
    baslama_tarihi DATE,
    bitis_tarihi DATE,
    teslim_tarihi DATE,
    gerceklesen_bitis DATE,
    tamamlanma_yuzdesi INTEGER DEFAULT 0,
    notlar TEXT,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id),
    FOREIGN KEY (bolge_id) REFERENCES bolgeler(id)
);

-- PROJE DURUM GEÇMİŞİ
CREATE TABLE IF NOT EXISTS proje_durum_gecmisi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proje_id INTEGER NOT NULL,
    eski_durum TEXT,
    yeni_durum TEXT NOT NULL,
    degistiren TEXT,
    notlar TEXT,
    tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proje_id) REFERENCES projeler(id)
);

-- MALZEMELER
CREATE TABLE IF NOT EXISTS malzemeler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    malzeme_kodu TEXT UNIQUE,
    malzeme_adi TEXT NOT NULL,
    kategori TEXT,
    birim TEXT NOT NULL,
    stok_miktari REAL DEFAULT 0,
    kritik_seviye REAL DEFAULT 0,
    birim_fiyat REAL DEFAULT 0,
    depo_konumu TEXT,
    notlar TEXT,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- MALZEME HAREKETLERİ
CREATE TABLE IF NOT EXISTS malzeme_hareketleri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    malzeme_id INTEGER NOT NULL,
    miktar REAL NOT NULL,
    hareket_tipi TEXT NOT NULL,
    ekip_id INTEGER,
    proje_id INTEGER,
    teslim_alan TEXT,
    teslim_eden TEXT,
    kaynak TEXT DEFAULT 'web',
    belge_no TEXT,
    notlar TEXT,
    tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (malzeme_id) REFERENCES malzemeler(id),
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id),
    FOREIGN KEY (proje_id) REFERENCES projeler(id)
);

-- GÜNLÜK RAPOR / PUANTAJ
CREATE TABLE IF NOT EXISTS gunluk_rapor (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tarih DATE DEFAULT (date('now')),
    ekip_id INTEGER NOT NULL,
    proje_id INTEGER,
    bolge_id INTEGER,
    kisi_sayisi INTEGER DEFAULT 0,
    calisan_listesi TEXT,
    baslama_saati TIME,
    bitis_saati TIME,
    yapilan_is TEXT,
    is_kategorisi TEXT,
    hava_durumu TEXT,
    enerji_kesintisi BOOLEAN DEFAULT 0,
    kesinti_detay TEXT,
    arac_km_baslangic INTEGER,
    arac_km_bitis INTEGER,
    kaynak TEXT DEFAULT 'web',
    notlar TEXT,
    olusturma_zamani DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id),
    FOREIGN KEY (proje_id) REFERENCES projeler(id),
    UNIQUE(tarih, ekip_id, proje_id)
);

-- TALEPLER
CREATE TABLE IF NOT EXISTS talepler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    talep_no TEXT UNIQUE,
    ekip_id INTEGER,
    proje_id INTEGER,
    talep_eden_id INTEGER,
    talep_tipi TEXT NOT NULL,
    aciklama TEXT NOT NULL,
    talep_detay TEXT,
    oncelik TEXT DEFAULT 'normal',
    durum TEXT DEFAULT 'beklemede',
    atanan_kisi TEXT,
    cozum_aciklama TEXT,
    kaynak TEXT DEFAULT 'web',
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    cozum_tarihi DATETIME,
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id),
    FOREIGN KEY (proje_id) REFERENCES projeler(id),
    FOREIGN KEY (talep_eden_id) REFERENCES personel(id)
);

-- GÖREVLER
CREATE TABLE IF NOT EXISTS gorevler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gorev_basligi TEXT NOT NULL,
    aciklama TEXT,
    gorev_tipi TEXT,
    proje_id INTEGER,
    ekip_id INTEGER,
    atanan_personel_id INTEGER,
    oncelik TEXT DEFAULT 'normal',
    durum TEXT DEFAULT 'atandi',
    son_tarih DATE,
    tamamlanma_tarihi DATE,
    olusturan TEXT DEFAULT 'koordinator',
    notlar TEXT,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proje_id) REFERENCES projeler(id),
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id),
    FOREIGN KEY (atanan_personel_id) REFERENCES personel(id)
);

-- AKTİVİTE LOGU
CREATE TABLE IF NOT EXISTS aktivite_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    modul TEXT NOT NULL,
    islem TEXT NOT NULL,
    kayit_id INTEGER,
    detay TEXT,
    kullanici TEXT DEFAULT 'koordinator',
    tarih DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- INDEXLER
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

-- TETİKLEYİCİLER
CREATE TRIGGER IF NOT EXISTS trg_malzeme_cikis
AFTER INSERT ON malzeme_hareketleri
WHEN NEW.hareket_tipi = 'cikis'
BEGIN
    UPDATE malzemeler SET stok_miktari = stok_miktari - NEW.miktar, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = NEW.malzeme_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_malzeme_giris
AFTER INSERT ON malzeme_hareketleri
WHEN NEW.hareket_tipi IN ('giris', 'iade')
BEGIN
    UPDATE malzemeler SET stok_miktari = stok_miktari + NEW.miktar, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = NEW.malzeme_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_proje_durum_degisikligi
AFTER UPDATE OF durum ON projeler
WHEN OLD.durum != NEW.durum
BEGIN
    INSERT INTO proje_durum_gecmisi (proje_id, eski_durum, yeni_durum, degistiren)
    VALUES (NEW.id, OLD.durum, NEW.durum, 'sistem');
END;

CREATE TRIGGER IF NOT EXISTS trg_talep_no
AFTER INSERT ON talepler
WHEN NEW.talep_no IS NULL
BEGIN
    UPDATE talepler
    SET talep_no = 'TLP-' || strftime('%Y', 'now') || '-' ||
        printf('%04d', (SELECT COUNT(*) FROM talepler WHERE strftime('%Y', olusturma_tarihi) = strftime('%Y', 'now')))
    WHERE id = NEW.id;
END;
