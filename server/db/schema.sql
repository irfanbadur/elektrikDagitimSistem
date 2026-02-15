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
    son_latitude REAL,
    son_longitude REAL,
    son_konum_zamani DATETIME,
    son_konum_kaynagi TEXT,
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

-- ============================================
-- TELEGRAM KULLANICI EŞLEŞTİRME
-- ============================================
CREATE TABLE IF NOT EXISTS telegram_kullanicilar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE NOT NULL,
    telegram_kullanici_adi TEXT,
    telegram_ad TEXT,
    personel_id INTEGER,
    yetki_seviyesi TEXT DEFAULT 'ekip',
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
    dosya_adi TEXT NOT NULL,
    orijinal_adi TEXT,
    dosya_yolu TEXT NOT NULL,
    thumbnail_yolu TEXT,
    dosya_tipi TEXT NOT NULL,
    mime_tipi TEXT,
    dosya_boyutu INTEGER,
    genislik INTEGER,
    yukseklik INTEGER,
    latitude REAL,
    longitude REAL,
    konum_kaynagi TEXT,
    altitude REAL,
    cekim_tarihi DATETIME,
    yukleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    yukleyen_personel_id INTEGER,
    yukleyen_telegram_id TEXT,
    proje_id INTEGER,
    ekip_id INTEGER,
    veri_paketi_id INTEGER,
    aciklama TEXT,
    etiketler TEXT,
    ai_analiz TEXT,
    FOREIGN KEY (yukleyen_personel_id) REFERENCES personel(id),
    FOREIGN KEY (proje_id) REFERENCES projeler(id),
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id),
    FOREIGN KEY (veri_paketi_id) REFERENCES veri_paketleri(id)
);

-- ============================================
-- VERİ PAKETLERİ
-- ============================================
CREATE TABLE IF NOT EXISTS veri_paketleri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paket_no TEXT UNIQUE,
    paket_tipi TEXT NOT NULL,
    durum TEXT DEFAULT 'tamamlandi',
    personel_id INTEGER,
    ekip_id INTEGER,
    proje_id INTEGER,
    bolge_id INTEGER,
    latitude REAL,
    longitude REAL,
    adres_metni TEXT,
    foto_sayisi INTEGER DEFAULT 0,
    notlar TEXT,
    ai_ozet TEXT,
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
-- ============================================
CREATE TABLE IF NOT EXISTS telegram_mesaj_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT NOT NULL,
    mesaj_tipi TEXT,
    yon TEXT NOT NULL,
    ham_mesaj TEXT,
    ai_parse_sonucu TEXT,
    islem_durumu TEXT DEFAULT 'islendi',
    hata_detay TEXT,
    islem_suresi_ms INTEGER,
    tarih DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- MALZEME REFERANS KATALOĞU
-- ============================================
CREATE TABLE IF NOT EXISTS ekipman_katalogu (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kategori TEXT NOT NULL,
    ekipman_kodu TEXT UNIQUE,
    ekipman_adi TEXT NOT NULL,
    alt_kategori TEXT,
    marka TEXT,
    model TEXT,
    teknik_ozellikler TEXT,
    gorsel_ozellikler TEXT,
    referans_foto_sayisi INTEGER DEFAULT 0,
    gerilim_sinifi TEXT,
    aktif BOOLEAN DEFAULT 1,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- REFERANS FOTOĞRAFLAR
-- ============================================
CREATE TABLE IF NOT EXISTS ekipman_referans_foto (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ekipman_id INTEGER NOT NULL,
    dosya_yolu TEXT NOT NULL,
    aciklama TEXT,
    ana_referans BOOLEAN DEFAULT 0,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ekipman_id) REFERENCES ekipman_katalogu(id)
);

-- ============================================
-- FOTOĞRAF ANALİZ SONUÇLARI
-- ============================================
CREATE TABLE IF NOT EXISTS foto_analiz (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medya_id INTEGER NOT NULL,
    veri_paketi_id INTEGER,
    analiz_katmani INTEGER NOT NULL,
    ai_saglayici TEXT NOT NULL,
    ai_model TEXT,
    analiz_tipi TEXT NOT NULL,
    genel_aciklama TEXT,
    guven_skoru REAL,
    isleme_suresi_ms INTEGER,
    tespit_edilen_nesneler TEXT,
    hasar_tespit TEXT,
    direk_durumu TEXT,
    onay_durumu TEXT DEFAULT 'beklemede',
    onaylayan_personel_id INTEGER,
    onay_tarihi DATETIME,
    duzeltme_notlari TEXT,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medya_id) REFERENCES medya(id),
    FOREIGN KEY (veri_paketi_id) REFERENCES veri_paketleri(id),
    FOREIGN KEY (onaylayan_personel_id) REFERENCES personel(id)
);

-- ============================================
-- ANALİZ EKİPMAN EŞLEŞMELERİ
-- ============================================
CREATE TABLE IF NOT EXISTS analiz_ekipman_eslesmesi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    foto_analiz_id INTEGER NOT NULL,
    ekipman_katalog_id INTEGER,
    nesne_tipi TEXT NOT NULL,
    tespit_detay TEXT,
    miktar INTEGER DEFAULT 1,
    guven_skoru REAL,
    onay_durumu TEXT DEFAULT 'beklemede',
    duzeltme_notu TEXT,
    FOREIGN KEY (foto_analiz_id) REFERENCES foto_analiz(id),
    FOREIGN KEY (ekipman_katalog_id) REFERENCES ekipman_katalogu(id)
);

-- TELEGRAM INDEXLER
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
CREATE INDEX IF NOT EXISTS idx_ekipman_katalogu_kategori ON ekipman_katalogu(kategori);
CREATE INDEX IF NOT EXISTS idx_ekipman_katalogu_gerilim ON ekipman_katalogu(gerilim_sinifi);
CREATE INDEX IF NOT EXISTS idx_foto_analiz_medya ON foto_analiz(medya_id);
CREATE INDEX IF NOT EXISTS idx_foto_analiz_paket ON foto_analiz(veri_paketi_id);
CREATE INDEX IF NOT EXISTS idx_foto_analiz_tip ON foto_analiz(analiz_tipi);
CREATE INDEX IF NOT EXISTS idx_foto_analiz_onay ON foto_analiz(onay_durumu);
CREATE INDEX IF NOT EXISTS idx_analiz_eslesmesi_analiz ON analiz_ekipman_eslesmesi(foto_analiz_id);
CREATE INDEX IF NOT EXISTS idx_analiz_eslesmesi_katalog ON analiz_ekipman_eslesmesi(ekipman_katalog_id);

-- TELEGRAM TETİKLEYİCİLER
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

CREATE TRIGGER IF NOT EXISTS trg_medya_paket_sayisi
AFTER INSERT ON medya
WHEN NEW.veri_paketi_id IS NOT NULL AND NEW.dosya_tipi = 'photo'
BEGIN
    UPDATE veri_paketleri
    SET foto_sayisi = (SELECT COUNT(*) FROM medya
        WHERE veri_paketi_id = NEW.veri_paketi_id AND dosya_tipi = 'photo')
    WHERE id = NEW.veri_paketi_id;
END;

-- ============================================
-- SAHA MESAJLARI
-- Doğal dil ile gönderilen saha mesajları ve AI parse sonuçları
-- ============================================
CREATE TABLE IF NOT EXISTS saha_mesajlari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gonderen_id INTEGER,
    gonderen_tipi TEXT DEFAULT 'personel',
    kaynak TEXT DEFAULT 'mobil',

    ham_mesaj TEXT NOT NULL,
    islem_tipi TEXT,
    islem_detay TEXT,
    konum TEXT,
    proje_no TEXT,

    guven_skoru REAL,
    ai_model TEXT,
    ai_sure_ms INTEGER,
    ai_token_input INTEGER,
    ai_token_output INTEGER,

    durum TEXT DEFAULT 'beklemede',

    onaylayan_id INTEGER,
    onay_tarihi DATETIME,
    duzeltme_notu TEXT,

    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (gonderen_id) REFERENCES personel(id),
    FOREIGN KEY (onaylayan_id) REFERENCES personel(id)
);

CREATE INDEX IF NOT EXISTS idx_saha_mesaj_tip ON saha_mesajlari(islem_tipi);
CREATE INDEX IF NOT EXISTS idx_saha_mesaj_durum ON saha_mesajlari(durum);
CREATE INDEX IF NOT EXISTS idx_saha_mesaj_tarih ON saha_mesajlari(olusturma_tarihi);
CREATE INDEX IF NOT EXISTS idx_saha_mesaj_gonderen ON saha_mesajlari(gonderen_id);

-- Firma ayarları telegram eklentileri
INSERT OR IGNORE INTO firma_ayarlari (anahtar, deger, aciklama) VALUES
('telegram_bot_token', '', 'BotFather''dan alınan Telegram Bot Token'),
('ai_aktif_katmanlar', '{"katman1":true,"katman2":true,"katman3":false}', 'Aktif AI katmanları'),
('ollama_base_url', 'http://localhost:11434', 'Ollama sunucu adresi'),
('ollama_text_model', 'qwen2.5:7b', 'Katman 1: Metin parse modeli'),
('ollama_vision_model', 'llama3.2-vision:11b', 'Katman 2: Görsel tanıma modeli'),
('cloud_ai_provider', 'claude', 'Katman 3 sağlayıcı: claude veya openai'),
('claude_api_key', '', 'Anthropic Claude API anahtarı'),
('openai_api_key', '', 'OpenAI API anahtarı'),
('koordinator_telegram_id', '', 'Koordinatörün Telegram ID''si (bildirimler için)'),
('foto_oto_analiz_seviyesi', '2', 'Fotoğraf yüklendiğinde otomatik analiz: 0/1/2/3');

-- ============================================
-- PROJE DOKÜMANLARI (Dokümanlar + Proje Dosyaları CAD)
-- ============================================
CREATE TABLE IF NOT EXISTS proje_dokumanlari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proje_id INTEGER NOT NULL,
    kategori TEXT NOT NULL DEFAULT 'dokuman', -- 'dokuman' veya 'cad'
    dosya_adi TEXT NOT NULL,
    orijinal_adi TEXT,
    dosya_yolu TEXT NOT NULL,
    dosya_tipi TEXT, -- pdf, dwg, dxf, xlsx vb.
    mime_tipi TEXT,
    dosya_boyutu INTEGER,
    aciklama TEXT,
    yukleyen TEXT DEFAULT 'koordinator',
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proje_dokumanlari_proje ON proje_dokumanlari(proje_id);
CREATE INDEX IF NOT EXISTS idx_proje_dokumanlari_kategori ON proje_dokumanlari(kategori);

-- ============================================
-- PROJE NOTLARI
-- ============================================
CREATE TABLE IF NOT EXISTS proje_notlari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proje_id INTEGER NOT NULL,
    baslik TEXT,
    icerik TEXT NOT NULL,
    yazar TEXT DEFAULT 'koordinator',
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proje_id) REFERENCES projeler(id)
);

CREATE INDEX IF NOT EXISTS idx_proje_notlari_proje ON proje_notlari(proje_id);

-- ============================================
-- PROJE KEŞİFLERİ
-- ============================================
CREATE TABLE IF NOT EXISTS proje_kesifler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proje_id INTEGER NOT NULL,
    kesif_tarihi DATE DEFAULT (date('now')),
    kesif_yapan TEXT,
    bulgular TEXT,
    notlar TEXT,
    konum_bilgisi TEXT,
    durum TEXT DEFAULT 'taslak', -- taslak, tamamlandi
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proje_id) REFERENCES projeler(id)
);

CREATE INDEX IF NOT EXISTS idx_proje_kesifler_proje ON proje_kesifler(proje_id);

-- Ekipman kataloğu seed data
INSERT OR IGNORE INTO ekipman_katalogu (kategori, ekipman_kodu, ekipman_adi, alt_kategori, teknik_ozellikler, gorsel_ozellikler, gerilim_sinifi) VALUES
('konsol', 'KNS-L-1200', 'L Konsol 1200mm', 'L tipi', '{"uzunluk_mm":1200,"malzeme":"galvaniz çelik","gerilim":"34.5kV"}', '{"sekil":"L şeklinde tek kol","renk":"gri/galvaniz","baglanti":"direk gövdesine cıvatalı"}', 'OG'),
('konsol', 'KNS-L-1500', 'L Konsol 1500mm', 'L tipi', '{"uzunluk_mm":1500,"malzeme":"galvaniz çelik","gerilim":"34.5kV"}', '{"sekil":"L şeklinde tek kol, uzun","renk":"gri/galvaniz"}', 'OG'),
('konsol', 'KNS-T-1200', 'T Konsol 1200mm', 'T tipi', '{"uzunluk_mm":1200,"malzeme":"galvaniz çelik","gerilim":"34.5kV"}', '{"sekil":"T şeklinde çift kol simetrik","renk":"gri/galvaniz"}', 'OG'),
('konsol', 'KNS-V-1000', 'V Konsol 1000mm', 'V tipi', '{"uzunluk_mm":1000,"malzeme":"galvaniz çelik","gerilim":"34.5kV"}', '{"sekil":"V şeklinde çapraz iki kol","renk":"gri/galvaniz"}', 'OG'),
('konsol', 'KNS-AYR', 'Ayırıcı Konsolu', 'Ayırıcı', '{"malzeme":"galvaniz çelik","gerilim":"34.5kV"}', '{"sekil":"U profil yatay, ayırıcı montaj noktaları var"}', 'OG'),
('izolator', 'IZL-CAM-U70', 'Cam İzolatör U70BL', 'cam', '{"tip":"cam","model":"U70BL","gerilim":"36kV","mekanik_dayanim":"70kN"}', '{"sekil":"disk/çan şekli","renk":"kahverengi/koyu yeşil cam","dizilim":"zincir halinde dizilebilir"}', 'OG'),
('izolator', 'IZL-CAM-U120', 'Cam İzolatör U120BL', 'cam', '{"tip":"cam","model":"U120BL","gerilim":"36kV","mekanik_dayanim":"120kN"}', '{"sekil":"büyük disk/çan","renk":"kahverengi cam","dizilim":"zincir, U70den büyük"}', 'OG'),
('izolator', 'IZL-PRS-P70', 'Porselen İzolatör P70', 'porselen', '{"tip":"porselen","gerilim":"36kV","mekanik_dayanim":"70kN"}', '{"sekil":"disk","renk":"gri/beyaz porselen mat yüzey"}', 'OG'),
('izolator', 'IZL-PLM-36', 'Polimer İzolatör 36kV', 'polimer', '{"tip":"polimer/kompozit","gerilim":"36kV"}', '{"sekil":"uzun silindirik gövde, diskli yüzey","renk":"kırmızı/kahverengi silikon kaplamalı"}', 'OG'),
('iletken', 'ILT-ACSR-50', 'ACSR İletken 50mm²', 'ACSR', '{"tip":"ACSR","kesit_mm2":50,"hawk_kodu":"Rabbit","akim_kapasitesi":"210A"}', '{"gorunus":"çok telli alüminyum üzeri çelik çekirdek","kalinlik":"ince","renk":"gümüş/mat"}', 'OG'),
('iletken', 'ILT-ACSR-95', 'ACSR İletken 95mm²', 'ACSR', '{"tip":"ACSR","kesit_mm2":95,"hawk_kodu":"Hawk","akim_kapasitesi":"340A"}', '{"gorunus":"çok telli alüminyum, belirgin kalınlık","kalinlik":"orta","renk":"gümüş/mat"}', 'OG'),
('iletken', 'ILT-ACSR-150', 'ACSR İletken 150mm²', 'ACSR', '{"tip":"ACSR","kesit_mm2":150,"hawk_kodu":"Drake","akim_kapasitesi":"450A"}', '{"gorunus":"kalın çok telli alüminyum","kalinlik":"kalin","renk":"gümüş/mat"}', 'OG'),
('iletken', 'ILT-XLPE-3x150', 'XLPE Kablo 3x150mm²', 'XLPE', '{"tip":"XLPE","kesit_mm2":150,"kor_sayisi":3}', '{"gorunus":"siyah dış kılıf, üç damarlı","renk":"siyah"}', 'OG'),
('armatur', 'ARM-GRG-50', 'Gergi Armatürü 50mm²', 'gergi', '{"tip":"gergi","iletken_kesit":"35-50mm2","malzeme":"aluminyum"}', '{"sekil":"silindirik sıkma, izolatör zincire bağlantılı"}', 'OG'),
('armatur', 'ARM-GRG-95', 'Gergi Armatürü 95mm²', 'gergi', '{"tip":"gergi","iletken_kesit":"70-95mm2","malzeme":"aluminyum"}', '{"sekil":"silindirik sıkma, büyük boy"}', 'OG'),
('armatur', 'ARM-TSM', 'Taşıma Armatürü', 'taşıma', '{"tip":"taşıma","malzeme":"aluminyum"}', '{"sekil":"askı tipi, U şekilli tutma","renk":"gümüş"}', 'OG'),
('armatur', 'ARM-EK', 'Ek Armatürü (Sıkma Manşon)', 'ek', '{"tip":"ek/manson"}', '{"sekil":"silindirik tüp, iletken üzerine sıkılır"}', 'OG'),
('direk', 'DRK-BTN-10', 'Beton Direk 10m', 'beton', '{"boy_m":10,"malzeme":"beton","tepe_yuku_kg":300,"gerilim":"34.5kV"}', '{"sekil":"konik silindir, üste doğru incelen","renk":"gri beton","yuzey":"pürüzlü"}', 'OG'),
('direk', 'DRK-BTN-12', 'Beton Direk 12m', 'beton', '{"boy_m":12,"malzeme":"beton","tepe_yuku_kg":500,"gerilim":"34.5kV"}', '{"sekil":"konik silindir, uzun","renk":"gri beton"}', 'OG'),
('direk', 'DRK-CLK-12', 'Çelik Direk 12m', 'çelik', '{"boy_m":12,"malzeme":"galvaniz çelik","gerilim":"34.5kV"}', '{"sekil":"kafes veya boru, metalik","renk":"galvaniz gri/parlak"}', 'OG'),
('direk', 'DRK-AHS-9', 'Ahşap Direk 9m', 'ahşap', '{"boy_m":9,"malzeme":"emprenye ahşap","gerilim":"34.5kV"}', '{"sekil":"düz silindir","renk":"koyu kahverengi, emprenye kokulu"}', 'OG'),
('konsol', 'KNS-AG-RAK', 'AG Rak', 'AG rak', '{"malzeme":"galvaniz çelik","gerilim":"0.4kV"}', '{"sekil":"düz yatay çubuk, izolatörlü","renk":"gri galvaniz"}', 'AG'),
('izolator', 'IZL-AG-GRD', 'AG Geçit İzolatörü', 'AG', '{"tip":"porselen","gerilim":"1kV"}', '{"sekil":"küçük silindir","renk":"beyaz/krem porselen"}', 'AG'),
('iletken', 'ILT-ABC-4x16', 'ABC Kablo 4x16mm²', 'ABC', '{"tip":"ABC","kesit_mm2":16,"kor_sayisi":4}', '{"gorunus":"siyah yalıtımlı bükülmüş demetli kablo","renk":"siyah"}', 'AG'),
('iletken', 'ILT-ABC-4x50', 'ABC Kablo 4x50mm²', 'ABC', '{"tip":"ABC","kesit_mm2":50,"kor_sayisi":4}', '{"gorunus":"kalın siyah yalıtımlı demetli","renk":"siyah"}', 'AG');

-- ============================================
-- DOSYALAR — Evrensel Dosya Tablosu
-- Tüm dosya tipleri (fotoğraf, çizim, belge, tablo, harita)
-- tek tablodan yönetilir
-- ============================================
CREATE TABLE IF NOT EXISTS dosyalar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- DOSYA BİLGİLERİ
    dosya_adi TEXT NOT NULL,
    orijinal_adi TEXT,
    dosya_yolu TEXT NOT NULL,
    thumbnail_yolu TEXT,
    dosya_boyutu INTEGER,
    mime_tipi TEXT,

    -- KATEGORİ
    kategori TEXT NOT NULL,
    -- 'fotograf', 'cizim', 'belge', 'tablo', 'harita', 'arsiv', 'diger'

    -- COĞRAFİ BİLGİ
    latitude REAL,
    longitude REAL,
    konum_adi TEXT,
    konum_kaynagi TEXT,
    altitude REAL,

    -- İLİŞKİLER
    proje_id INTEGER,
    ekip_id INTEGER,
    yukleyen_id INTEGER,
    veri_paketi_id INTEGER,

    -- AÇIKLAMA ve ETİKETLER
    baslik TEXT,
    notlar TEXT,
    etiketler TEXT,

    -- DOSYA TİPİNE ÖZEL VERİLER (JSON)
    ozel_alanlar TEXT,

    -- AI ANALİZ
    ai_analiz TEXT,
    ai_analiz_katmani INTEGER,

    -- KAYNAK
    kaynak TEXT DEFAULT 'web',

    -- DURUM
    durum TEXT DEFAULT 'aktif',

    -- VERSİYON
    versiyon INTEGER DEFAULT 1,
    onceki_versiyon_id INTEGER,

    -- ZAMAN
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (proje_id) REFERENCES projeler(id),
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id),
    FOREIGN KEY (yukleyen_id) REFERENCES personel(id),
    FOREIGN KEY (veri_paketi_id) REFERENCES veri_paketleri(id),
    FOREIGN KEY (onceki_versiyon_id) REFERENCES dosyalar(id)
);

-- DOSYALAR İNDEKSLERİ
CREATE INDEX IF NOT EXISTS idx_dosya_proje ON dosyalar(proje_id);
CREATE INDEX IF NOT EXISTS idx_dosya_ekip ON dosyalar(ekip_id);
CREATE INDEX IF NOT EXISTS idx_dosya_paket ON dosyalar(veri_paketi_id);
CREATE INDEX IF NOT EXISTS idx_dosya_kategori ON dosyalar(kategori);
CREATE INDEX IF NOT EXISTS idx_dosya_durum ON dosyalar(durum);
CREATE INDEX IF NOT EXISTS idx_dosya_tarih ON dosyalar(olusturma_tarihi);
CREATE INDEX IF NOT EXISTS idx_dosya_konum ON dosyalar(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_dosya_kaynak ON dosyalar(kaynak);

-- VERİ PAKETLERİ ek indeksler
CREATE INDEX IF NOT EXISTS idx_paket_durum ON veri_paketleri(durum);
CREATE INDEX IF NOT EXISTS idx_paket_tip ON veri_paketleri(paket_tipi);
CREATE INDEX IF NOT EXISTS idx_paket_konum ON veri_paketleri(latitude, longitude);

-- Dosya sayaçlarını otomatik güncelle
CREATE TRIGGER IF NOT EXISTS trg_dosya_sayac_ekle
AFTER INSERT ON dosyalar
WHEN NEW.veri_paketi_id IS NOT NULL
BEGIN
  UPDATE veri_paketleri SET
    dosya_sayisi = (SELECT COUNT(*) FROM dosyalar WHERE veri_paketi_id = NEW.veri_paketi_id AND durum = 'aktif'),
    fotograf_sayisi = (SELECT COUNT(*) FROM dosyalar WHERE veri_paketi_id = NEW.veri_paketi_id AND kategori = 'fotograf' AND durum = 'aktif'),
    belge_sayisi = (SELECT COUNT(*) FROM dosyalar WHERE veri_paketi_id = NEW.veri_paketi_id AND kategori != 'fotograf' AND durum = 'aktif')
  WHERE id = NEW.veri_paketi_id;
END;

-- ============================================
-- DÖNGÜ ŞABLONLARI
-- ============================================
CREATE TABLE IF NOT EXISTS dongu_sablonlari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sablon_adi TEXT NOT NULL,
    sablon_kodu TEXT UNIQUE NOT NULL,
    aciklama TEXT,
    varsayilan INTEGER DEFAULT 0,
    durum TEXT DEFAULT 'aktif',
    olusturan_id INTEGER,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (olusturan_id) REFERENCES personel(id)
);

-- ============================================
-- DÖNGÜ ŞABLON AŞAMALARI
-- ============================================
CREATE TABLE IF NOT EXISTS dongu_sablon_asamalari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sablon_id INTEGER NOT NULL,
    sira INTEGER NOT NULL,
    asama_adi TEXT NOT NULL,
    asama_kodu TEXT NOT NULL,
    renk TEXT DEFAULT '#6b7280',
    ikon TEXT DEFAULT '📋',
    aciklama TEXT,
    tahmini_gun INTEGER,
    FOREIGN KEY (sablon_id) REFERENCES dongu_sablonlari(id) ON DELETE CASCADE,
    UNIQUE(sablon_id, sira),
    UNIQUE(sablon_id, asama_kodu)
);

-- ============================================
-- PROJE AŞAMALARI
-- ============================================
CREATE TABLE IF NOT EXISTS proje_asamalari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proje_id INTEGER NOT NULL,
    sablon_asama_id INTEGER,
    sira INTEGER NOT NULL,
    asama_adi TEXT NOT NULL,
    asama_kodu TEXT NOT NULL,
    renk TEXT DEFAULT '#6b7280',
    ikon TEXT DEFAULT '📋',
    durum TEXT DEFAULT 'bekliyor',
    baslangic_tarihi DATE,
    bitis_tarihi DATE,
    planlanan_baslangic DATE,
    planlanan_bitis DATE,
    tahmini_gun INTEGER,
    notlar TEXT,
    tamamlanma_notu TEXT,
    baslatan_id INTEGER,
    tamamlayan_id INTEGER,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proje_id) REFERENCES projeler(id) ON DELETE CASCADE,
    FOREIGN KEY (sablon_asama_id) REFERENCES dongu_sablon_asamalari(id),
    FOREIGN KEY (baslatan_id) REFERENCES personel(id),
    FOREIGN KEY (tamamlayan_id) REFERENCES personel(id),
    UNIQUE(proje_id, sira)
);

CREATE INDEX IF NOT EXISTS idx_proje_asama_proje ON proje_asamalari(proje_id);
CREATE INDEX IF NOT EXISTS idx_proje_asama_durum ON proje_asamalari(durum);
CREATE INDEX IF NOT EXISTS idx_sablon_asama_sablon ON dongu_sablon_asamalari(sablon_id);
-- idx_paket_asama ve idx_dosya_asama migration sonrasi database.js'de olusturulur

-- ============================================
-- ROLLER — Özelleştirilebilir rol tanımları
-- ============================================
CREATE TABLE IF NOT EXISTS roller (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rol_adi TEXT NOT NULL,
    rol_kodu TEXT UNIQUE NOT NULL,
    aciklama TEXT,
    renk TEXT DEFAULT '#6b7280',
    ikon TEXT DEFAULT '👤',
    seviye INTEGER DEFAULT 50,
    sistem_rolu INTEGER DEFAULT 0,
    durum TEXT DEFAULT 'aktif',
    olusturan_id INTEGER,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (olusturan_id) REFERENCES kullanicilar(id)
);

-- ============================================
-- İZİNLER — Sistemdeki tüm izin tanımları
-- ============================================
CREATE TABLE IF NOT EXISTS izinler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    modul TEXT NOT NULL,
    aksiyon TEXT NOT NULL,
    aciklama TEXT,
    modul_etiketi TEXT,
    aksiyon_etiketi TEXT,
    UNIQUE(modul, aksiyon)
);

-- ============================================
-- ROL İZİNLERİ — Rol-İzin eşleşmesi
-- ============================================
CREATE TABLE IF NOT EXISTS rol_izinleri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rol_id INTEGER NOT NULL,
    izin_id INTEGER NOT NULL,
    veri_kapsami TEXT DEFAULT 'tum',
    FOREIGN KEY (rol_id) REFERENCES roller(id) ON DELETE CASCADE,
    FOREIGN KEY (izin_id) REFERENCES izinler(id) ON DELETE CASCADE,
    UNIQUE(rol_id, izin_id)
);

-- ============================================
-- KULLANICILAR — Sisteme giriş yapan kullanıcılar
-- ============================================
CREATE TABLE IF NOT EXISTS kullanicilar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kullanici_adi TEXT UNIQUE NOT NULL,
    sifre_hash TEXT NOT NULL,
    ad_soyad TEXT NOT NULL,
    email TEXT,
    telefon TEXT,
    avatar_yolu TEXT,
    personel_id INTEGER,
    ekip_id INTEGER,
    durum TEXT DEFAULT 'aktif',
    son_giris DATETIME,
    basarisiz_giris_sayisi INTEGER DEFAULT 0,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (personel_id) REFERENCES personel(id),
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id)
);

-- ============================================
-- KULLANICI ROLLERİ — Kullanıcıya atanan roller
-- ============================================
CREATE TABLE IF NOT EXISTS kullanici_rolleri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kullanici_id INTEGER NOT NULL,
    rol_id INTEGER NOT NULL,
    atayan_id INTEGER,
    atanma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id) ON DELETE CASCADE,
    FOREIGN KEY (rol_id) REFERENCES roller(id) ON DELETE CASCADE,
    FOREIGN KEY (atayan_id) REFERENCES kullanicilar(id),
    UNIQUE(kullanici_id, rol_id)
);

-- ============================================
-- AI ISLEMLER — AI operasyon kayitlari
-- ============================================
CREATE TABLE IF NOT EXISTS ai_islemler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- GIRDI
    girdi_tipi TEXT NOT NULL,                 -- 'metin', 'gorsel', 'belge', 'karma'
    girdi_metin TEXT,
    girdi_dosya_id INTEGER,
    veri_paketi_id INTEGER,

    -- PARSE SONUCU
    parse_sonuc TEXT,                         -- JSON
    parse_guven REAL,                         -- 0.0 - 1.0

    -- AKSIYON PLANI
    aksiyon_plani TEXT,                       -- JSON dizisi
    aksiyon_sayisi INTEGER DEFAULT 0,

    -- DURUM
    durum TEXT DEFAULT 'onay_bekliyor',
    -- 'onay_bekliyor','onaylandi','uygulandi','kismi_uygulama',
    -- 'reddedildi','duzeltildi','hata','geri_alindi'

    -- UYGULAMA
    uygulama_sonuc TEXT,                     -- JSON
    hata_mesaji TEXT,

    -- ILISKILER
    kullanici_id INTEGER NOT NULL,
    proje_id INTEGER,
    ekip_id INTEGER,

    -- ZAMAN
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    onay_tarihi DATETIME,
    uygulama_tarihi DATETIME,

    -- PROVIDER BILGISI
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

-- RBAC İNDEKSLERİ
CREATE INDEX IF NOT EXISTS idx_rol_izin_rol ON rol_izinleri(rol_id);
CREATE INDEX IF NOT EXISTS idx_rol_izin_izin ON rol_izinleri(izin_id);
CREATE INDEX IF NOT EXISTS idx_kullanici_rol_kullanici ON kullanici_rolleri(kullanici_id);
CREATE INDEX IF NOT EXISTS idx_kullanici_rol_rol ON kullanici_rolleri(rol_id);
CREATE INDEX IF NOT EXISTS idx_kullanici_durum ON kullanicilar(durum);

-- ============================================
-- AI SOHBET OTURUMLARI
-- ============================================
CREATE TABLE IF NOT EXISTS ai_sohbetler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kullanici_id INTEGER NOT NULL,
    baslik TEXT,
    baglam_tipi TEXT DEFAULT 'genel',
    baglam_id INTEGER,
    baglam_meta TEXT,
    mesaj_sayisi INTEGER DEFAULT 0,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    son_mesaj_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    durum TEXT DEFAULT 'aktif',
    FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id)
);

CREATE INDEX IF NOT EXISTS idx_sohbet_kullanici ON ai_sohbetler(kullanici_id);
CREATE INDEX IF NOT EXISTS idx_sohbet_tarih ON ai_sohbetler(son_mesaj_tarihi);

-- ============================================
-- AI SOHBET MESAJLARI
-- ============================================
CREATE TABLE IF NOT EXISTS ai_mesajlar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sohbet_id INTEGER NOT NULL,
    rol TEXT NOT NULL,
    icerik TEXT NOT NULL,
    mesaj_tipi TEXT DEFAULT 'metin',
    meta TEXT,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sohbet_id) REFERENCES ai_sohbetler(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mesaj_sohbet ON ai_mesajlar(sohbet_id);
