# ElektraTrack — Personel, Pozisyon ve Görev Yönetimi

> **Modül:** personel-gorev-yonetimi  
> **Bağımlılıklar:** kullanici-rolleri.md (sistem rolü), proje-dongu.md (proje atama)  
> **Versiyon:** 1.0  
> **Tarih:** 2026-02-22

---

## 1. Genel Bakış

### 1.1 Problem

Elektrik dağıtım müteahhitliğinde bir personel birden fazla şapka takar:

```
Mehmet Yılmaz
├── Resmi pozisyon: Elektrik Mühendisi
├── Proje-A'da: Şantiye Şefi
├── Proje-B'de: Proje Tasarımcısı
├── Firma genelinde: Keşif Sorumlusu
└── Belgeleri: ETİP, İSG-B, Ehliyet-B
```

Mevcut `kullanici-rolleri.md` sadece **sistem erişim rolü** tanımlıyor (koordinatör, mühendis, depocu, ekip). Bu yeterli değil — kimin hangi projede ne iş yaptığını, hangi belgelere sahip olduğunu ve hiyerarşideki yerini de bilmemiz gerekiyor.

### 1.2 Üç Katmanlı Model

```
┌─────────────────────────────────────────────────────────────┐
│ KATMAN 1 — Sistem Rolü (erişim kontrolü)                    │
│ Mevcut: koordinator | muhendis | tekniker | depocu |        │
│         ekip | izleyici                                     │
│ → Kim neyi görebilir, nereye erişebilir                     │
├─────────────────────────────────────────────────────────────┤
│ KATMAN 2 — Pozisyon & Hiyerarşi (firmadaki resmi unvan)     │
│ Yeni: Genel Müdür, Teknik Müdür, Koordinatör, Mühendis,    │
│       Tekniker, Ekip Başı, Usta, İşçi, Büro Personeli      │
│ → Organizasyon şeması, raporlama zinciri                    │
├─────────────────────────────────────────────────────────────┤
│ KATMAN 3 — Görevler (çoklu, proje/firma bazlı)              │
│ Yeni: Şantiye Şefi, Keşif Sorumlusu, İSG Uzmanı,          │
│       Proje Tasarımcısı, Topraklama Sorumlusu, ...          │
│ → Bir kişiye birden fazla görev atanabilir                  │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 İlişki Özeti

```
kullanicilar (mevcut tablo)
  ├── sistem_rolu: 'muhendis'          ← Katman 1 (erişim)
  ├── pozisyon_id → pozisyonlar        ← Katman 2 (unvan)
  ├── ust_kullanici_id → kullanicilar  ← Katman 2 (hiyerarşi)
  │
  ├── kullanici_gorevler[]             ← Katman 3 (görevler)
  │   ├── gorev: 'santiye_sefi'
  │   ├── proje_id: YB-2025-003
  │   └── aktif: true
  │
  ├── kullanici_belgeler[]             ← Ek: sertifika/belge
  │   ├── belge_tipi: 'ETIP'
  │   └── bitis_tarihi: 2027-06-15
  │
  └── kullanici_yetkinlikler[]         ← Ek: beceri/uzmanlık
      ├── yetkinlik: 'og_montaj'
      └── seviye: 'uzman'
```

---

## 2. Pozisyon ve Hiyerarşi (Katman 2)

### 2.1 Pozisyon Tanımları

Elektrik dağıtım müteahhitliğinde standart pozisyonlar:

```
Seviye 1 — Üst Yönetim
├── firma_sahibi      Firma Sahibi / Genel Müdür
├── teknik_mudur      Teknik Müdür
└── idari_mudur       İdari / Mali Müdür

Seviye 2 — Orta Yönetim / Koordinasyon
├── koordinator       Bölge Koordinatörü
├── isg_uzmani        İSG Uzmanı (firma geneli)
└── satin_alma        Satınalma Sorumlusu

Seviye 3 — Teknik Personel
├── saha_muhendisi    Saha Mühendisi
├── proje_muhendisi   Proje Mühendisi (tasarım/çizim)
├── buro_muhendisi    Büro Mühendisi (hakediş/evrak)
└── tekniker          Tekniker

Seviye 4 — Saha Operasyon
├── ekip_basi         Ekip Başı
├── usta              Usta (kablo, direk, trafo uzmanı)
├── operator          Şoför / Araç Operatörü
└── isci              İşçi

Seviye 5 — Destek
├── depocu            Depocu
├── buro_personeli    Büro Personeli
└── guvenlik          Güvenlik
```

### 2.2 Pozisyonlar Tablosu

```sql
CREATE TABLE IF NOT EXISTS pozisyonlar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kod TEXT UNIQUE NOT NULL,           -- 'saha_muhendisi'
    ad TEXT NOT NULL,                    -- 'Saha Mühendisi'
    seviye INTEGER NOT NULL,            -- 1-5 (hiyerarşi seviyesi)
    kategori TEXT NOT NULL,             -- 'yonetim','koordinasyon','teknik','saha','destek'
    aciklama TEXT,                      -- Pozisyon açıklaması
    varsayilan_sistem_rolu TEXT,        -- Bu pozisyondaki kişinin varsayılan erişim rolü
    aktif INTEGER DEFAULT 1,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.3 Seed Data — Varsayılan Pozisyonlar

```sql
INSERT INTO pozisyonlar (kod, ad, seviye, kategori, aciklama, varsayilan_sistem_rolu) VALUES
-- Seviye 1: Üst Yönetim
('firma_sahibi',    'Firma Sahibi / Genel Müdür',  1, 'yonetim',
 'Firma sahibi veya genel müdür. Tüm yetkilere sahip.', 'koordinator'),
('teknik_mudur',    'Teknik Müdür',                 1, 'yonetim',
 'Tüm teknik operasyonların sorumlusu. Projelerin genel koordinasyonu.', 'koordinator'),
('idari_mudur',     'İdari / Mali Müdür',           1, 'yonetim',
 'Muhasebe, finans, insan kaynakları ve idari işler.', 'koordinator'),

-- Seviye 2: Orta Yönetim
('koordinator',     'Bölge Koordinatörü',           2, 'koordinasyon',
 'Birden fazla ilçe/bölgedeki projeleri koordine eder. Mühendis ve ekipleri yönetir.', 'koordinator'),
('isg_uzmani',      'İSG Uzmanı',                   2, 'koordinasyon',
 'Tüm sahalarda iş sağlığı ve güvenliği denetimi, eğitim planlaması.', 'muhendis'),
('satin_alma',      'Satınalma Sorumlusu',           2, 'koordinasyon',
 'Malzeme tedariki, fiyat araştırması, sipariş yönetimi.', 'depocu'),

-- Seviye 3: Teknik Personel
('saha_muhendisi',  'Saha Mühendisi',               3, 'teknik',
 'Projelerin sahada teknik takibi. Ekip yönetimi, kalite kontrol.', 'muhendis'),
('proje_muhendisi', 'Proje Mühendisi',              3, 'teknik',
 'Proje tasarımı, DXF çizim, metraj hesabı, teknik dosya hazırlama.', 'muhendis'),
('buro_muhendisi',  'Büro Mühendisi',               3, 'teknik',
 'Hakediş hazırlama, evrak takibi, arşiv yönetimi, kurum yazışmaları.', 'muhendis'),
('tekniker',        'Tekniker',                      3, 'teknik',
 'Teknik destek, ölçüm, denetim yardımı.', 'tekniker'),

-- Seviye 4: Saha Operasyon
('ekip_basi',       'Ekip Başı',                     4, 'saha',
 'Bir saha ekibinin şefi. Günlük iş dağılımı, sahada yönetim.', 'ekip'),
('usta',            'Usta',                          4, 'saha',
 'Uzman işçi — kablo çekme, direk dikme, trafo montajı vb.', 'ekip'),
('operator',        'Şoför / Araç Operatörü',        4, 'saha',
 'Araç kullanma, sepetli/vinç operasyonu.', 'ekip'),
('isci',            'İşçi',                          4, 'saha',
 'Genel saha işçisi.', 'ekip'),

-- Seviye 5: Destek
('depocu',          'Depocu',                        5, 'destek',
 'Malzeme deposu yönetimi. Giriş/çıkış/stok takibi.', 'depocu'),
('buro_personeli',  'Büro Personeli',                5, 'destek',
 'Genel büro işleri, telefon, arşiv.', 'izleyici'),
('guvenlik',        'Güvenlik',                      5, 'destek',
 'Depo/şantiye güvenliği.', 'izleyici');
```

### 2.4 Kullanıcılar Tablosuna Ek Sütunlar

```sql
-- Mevcut kullanicilar tablosuna eklenen sütunlar (migration ile)
ALTER TABLE kullanicilar ADD COLUMN pozisyon_id INTEGER
    REFERENCES pozisyonlar(id);

ALTER TABLE kullanicilar ADD COLUMN ust_kullanici_id INTEGER
    REFERENCES kullanicilar(id);              -- Kime rapor veriyor

ALTER TABLE kullanicilar ADD COLUMN tc_kimlik TEXT;         -- TC kimlik no (opsiyonel)
ALTER TABLE kullanicilar ADD COLUMN dogum_tarihi DATE;
ALTER TABLE kullanicilar ADD COLUMN ise_giris_tarihi DATE;
ALTER TABLE kullanicilar ADD COLUMN kan_grubu TEXT;         -- İSG için
ALTER TABLE kullanicilar ADD COLUMN acil_kisi TEXT;         -- Acil durumda aranacak
ALTER TABLE kullanicilar ADD COLUMN acil_telefon TEXT;
ALTER TABLE kullanicilar ADD COLUMN adres TEXT;
ALTER TABLE kullanicilar ADD COLUMN notlar TEXT;
```

### 2.5 Hiyerarşi — Kim Kime Rapor Veriyor

`ust_kullanici_id` ile ağaç yapısı:

```
Hasan Bey (Firma Sahibi, ust=null)
├── Murat Bey (Teknik Müdür, ust=Hasan)
│   ├── İrfan (Koordinatör Bölge-1, ust=Murat)
│   │   ├── Mehmet (Saha Mühendisi, ust=İrfan)
│   │   │   ├── Ali (Ekip Başı Ekip-1, ust=Mehmet)
│   │   │   │   ├── Veli (Usta, ust=Ali)
│   │   │   │   └── Kemal (İşçi, ust=Ali)
│   │   │   └── Hüseyin (Ekip Başı Ekip-2, ust=Mehmet)
│   │   └── Fatma (Büro Mühendisi, ust=İrfan)
│   └── Ahmet (Koordinatör Bölge-2, ust=Murat)
│       └── ...
└── Ayşe (İdari Müdür, ust=Hasan)
    ├── Zeynep (Depocu, ust=Ayşe)
    └── Elif (Büro Personeli, ust=Ayşe)
```

**Backend: Hiyerarşi Sorgulama**

```javascript
// server/services/personelService.js

class PersonelService {

  /**
   * Bir kişinin altındaki tüm personeli getir (recursive)
   */
  altPersonel(kullaniciId, derinlik = 10) {
    const sonuc = [];
    const bul = (ustId, seviye) => {
      if (seviye > derinlik) return;
      const altlar = this.db.prepare(`
        SELECT k.*, p.ad as pozisyon_adi, p.seviye as pozisyon_seviye
        FROM kullanicilar k
        LEFT JOIN pozisyonlar p ON k.pozisyon_id = p.id
        WHERE k.ust_kullanici_id = ? AND k.aktif = 1
        ORDER BY p.seviye, k.ad_soyad
      `).all(ustId);

      for (const kisi of altlar) {
        sonuc.push({ ...kisi, hiyerarsi_derinlik: seviye });
        bul(kisi.id, seviye + 1);
      }
    };
    bul(kullaniciId, 1);
    return sonuc;
  }

  /**
   * Bir kişinin üstündeki zincir (yöneticileri)
   */
  ustZincir(kullaniciId) {
    const zincir = [];
    let mevcutId = kullaniciId;
    let guvenlik = 0;

    while (mevcutId && guvenlik < 20) {
      const kisi = this.db.prepare(`
        SELECT k.*, p.ad as pozisyon_adi
        FROM kullanicilar k
        LEFT JOIN pozisyonlar p ON k.pozisyon_id = p.id
        WHERE k.id = ?
      `).get(mevcutId);

      if (!kisi) break;
      if (kisi.id !== kullaniciId) zincir.push(kisi);
      mevcutId = kisi.ust_kullanici_id;
      guvenlik++;
    }
    return zincir;
  }

  /**
   * Organizasyon ağacı (tüm firma)
   */
  organizasyonAgaci() {
    const tumPersonel = this.db.prepare(`
      SELECT k.id, k.ad_soyad, k.ust_kullanici_id, k.aktif,
             p.ad as pozisyon_adi, p.seviye, p.kod as pozisyon_kodu
      FROM kullanicilar k
      LEFT JOIN pozisyonlar p ON k.pozisyon_id = p.id
      WHERE k.aktif = 1
      ORDER BY p.seviye, k.ad_soyad
    `).all();

    // Ağaç yapısı oluştur
    const agac = (ustId) => {
      return tumPersonel
        .filter(k => k.ust_kullanici_id === ustId)
        .map(k => ({
          ...k,
          altlar: agac(k.id)
        }));
    };

    return agac(null); // Kök düğümler (ust_kullanici_id = null)
  }
}
```

---

## 3. Görev Sistemi (Katman 3)

### 3.1 Görev Kategorileri

```
PROJE BAZLI GÖREVLER (belirli projeye atanır)
├── santiye_sefi         Şantiye Şefi
├── proje_sorumlusu      Proje Sorumlusu (A-Z sahip çıkar)
├── proje_tasarimci      Proje Tasarımcısı (DXF çizim)
├── kesif_sorumlusu      Keşif Sorumlusu
├── kabul_sorumlusu      Kabul Sorumlusu (geçici/kesin)
├── hakedis_hazirlayici  Hakediş Hazırlayıcısı
├── topraklama_sorumlu   Topraklama Sorumlusu
├── kalite_kontrol       Kalite Kontrol
├── malzeme_takip        Malzeme Takip (proje bazlı)
└── taseron_koordinator  Taşeron Koordinatör

FİRMA GENELİ GÖREVLER (tüm projelere geçerli)
├── isg_sorumlusu        İSG Sorumlusu
├── periyodik_kontrol    Periyodik Kontrol Uzmanı
├── depo_yoneticisi      Depo Yöneticisi
├── arac_sorumlusu       Araç Sorumlusu
├── egitim_sorumlusu     Eğitim Sorumlusu
├── arsiv_sorumlusu      Arşiv Sorumlusu
├── bilgi_islem          Bilgi İşlem Sorumlusu
└── kurum_irtibat        Kurum İrtibat (YEDAŞ/TEDAŞ muhatap)

GEÇİCİ / DÖNEMSEL GÖREVLER
├── nobetci              Nöbetçi (arıza müdahale)
├── ihale_hazirlama      İhale Dosya Hazırlama
├── denetim_eslik        Denetim Eşlikçi (YEDAŞ denetimi)
├── envanter_sayim       Envanter Sayım Sorumlusu
└── ozel_gorev           Özel Görev (açıklama ile)
```

### 3.2 Görev Tanımları Tablosu

```sql
CREATE TABLE IF NOT EXISTS gorev_tanimlari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kod TEXT UNIQUE NOT NULL,           -- 'santiye_sefi'
    ad TEXT NOT NULL,                    -- 'Şantiye Şefi'
    kategori TEXT NOT NULL,             -- 'proje_bazli', 'firma_geneli', 'gecici'
    aciklama TEXT,                      -- Ne yapar, neden sorumlu
    sorumluluklar TEXT,                 -- JSON: ["Günlük iş dağılımı", "İSG tedbirleri", ...]
    gerekli_belgeler TEXT,             -- JSON: ["ETIP", "ISG_B"] — bu belge olmadan atanamaz
    gerekli_pozisyonlar TEXT,          -- JSON: ["saha_muhendisi", "ekip_basi"] — hangi pozisyon atanabilir
    min_seviye INTEGER,                 -- Minimum hiyerarşi seviyesi (1-5)
    max_ayni_anda INTEGER DEFAULT 0,   -- 0 = sınırsız, 1 = proje başına tek kişi
    zorunlu_proje INTEGER DEFAULT 0,   -- 1 ise proje_id zorunlu
    aktif INTEGER DEFAULT 1,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3.3 Seed Data — Görev Tanımları

```sql
-- PROJE BAZLI GÖREVLER
INSERT INTO gorev_tanimlari (kod, ad, kategori, aciklama, sorumluluklar, gerekli_belgeler, gerekli_pozisyonlar, min_seviye, max_ayni_anda, zorunlu_proje) VALUES

('santiye_sefi', 'Şantiye Şefi', 'proje_bazli',
 'Sahada günlük yönetimden sorumlu kişi. İş güvenliği tedbirlerini uygular, iş dağılımı yapar.',
 '["Günlük iş dağılımı ve planlaması",
   "İSG tedbirlerinin sahada uygulanması",
   "Ekip performans takibi",
   "Günlük ilerleme raporu",
   "Malzeme ihtiyaç bildirimi",
   "Taşeron ekiplerin sahada yönetimi",
   "YEDAŞ ile saha koordinasyonu"]',
 '["ETIP"]',
 '["saha_muhendisi","tekniker","ekip_basi"]',
 3, 1, 1),  -- Proje başına 1 şantiye şefi

('proje_sorumlusu', 'Proje Sorumlusu', 'proje_bazli',
 'Projenin başından sonuna kadar tüm sürecin sahibi. Keşiften kesin kabule kadar takip eder.',
 '["Proje planlaması ve takvim yönetimi",
   "Kaynak (insan/malzeme) planlaması",
   "İlerleme takibi ve raporlama",
   "Sorun çözümü ve eskalasyon",
   "Kurum (YEDAŞ) ile koordinasyon",
   "Maliyet takibi",
   "Kalite standartlarının sağlanması"]',
 '["ETIP"]',
 '["koordinator","saha_muhendisi"]',
 2, 1, 1),

('proje_tasarimci', 'Proje Tasarımcısı', 'proje_bazli',
 'Projenin teknik çizimlerini hazırlar. DXF, metraj, teknik hesap.',
 '["DXF proje çizimi",
   "Metraj hesabı",
   "Malzeme listesi çıkarma",
   "Teknik şartname kontrolü",
   "Revize çizimleri"]',
 '["ETIP"]',
 '["proje_muhendisi","saha_muhendisi"]',
 3, 0, 1),

('kesif_sorumlusu', 'Keşif Sorumlusu', 'proje_bazli',
 'Yer teslimi ve keşif aşamasında sahayı inceler, raporlar.',
 '["Saha incelemesi ve fotoğraflama",
   "Yer teslim tutanağı hazırlama",
   "Mevcut hat/direk durumu tespiti",
   "Güzergah değerlendirmesi",
   "Keşif raporu yazma",
   "Tahmini malzeme listesi"]',
 'null',
 '["koordinator","saha_muhendisi","tekniker"]',
 2, 0, 1),

('kabul_sorumlusu', 'Kabul Sorumlusu', 'proje_bazli',
 'Geçici ve kesin kabul süreçlerini yönetir.',
 '["Kabul dosyası hazırlama",
   "Test ve ölçümlerin yapılması",
   "Eksiklik listesi takibi",
   "YEDAŞ kabul heyeti ile koordinasyon",
   "As-built çizim kontrolü"]',
 '["ETIP"]',
 '["saha_muhendisi","buro_muhendisi"]',
 3, 1, 1),

('hakedis_hazirlayici', 'Hakediş Hazırlayıcısı', 'proje_bazli',
 'Proje hakediş dosyasını hazırlar, metraj yapar.',
 '["Metraj hesabı",
   "Hakediş dosyası düzenleme",
   "Birim fiyat kontrolü",
   "İmalat kaydı tutma",
   "Fiyat farkı hesabı"]',
 'null',
 '["buro_muhendisi","proje_muhendisi","saha_muhendisi"]',
 3, 0, 1),

('topraklama_sorumlu', 'Topraklama Sorumlusu', 'proje_bazli',
 'Direk ve tesis topraklama ölçümlerini yapar, kayıt tutar.',
 '["Topraklama direnci ölçümü",
   "Ölçüm kayıtlarının tutulması",
   "Standart dışı değerlerin raporlanması",
   "İyileştirme önerisi",
   "Periyodik ölçüm takvimi"]',
 'null',
 '["saha_muhendisi","tekniker","ekip_basi"]',
 3, 0, 1),

('kalite_kontrol', 'Kalite Kontrol', 'proje_bazli',
 'İşçilik ve malzeme kalitesini denetler.',
 '["İşçilik kalite denetimi",
   "Malzeme uygunluk kontrolü",
   "Standart/şartname karşılaştırması",
   "Uygunsuzluk raporu",
   "Düzeltici faaliyet takibi"]',
 'null',
 '["saha_muhendisi","tekniker"]',
 3, 0, 1),

('malzeme_takip', 'Malzeme Takip', 'proje_bazli',
 'Projeye özel malzeme ihtiyacı, sevkiyat ve sarf takibi.',
 '["Proje malzeme ihtiyaç listesi",
   "Sevkiyat koordinasyonu",
   "Sarf takibi (kullanılan vs planlanan)",
   "Fazla/eksik malzeme raporu",
   "İade malzeme takibi"]',
 'null',
 '["saha_muhendisi","tekniker","ekip_basi","depocu"]',
 3, 0, 1),

('taseron_koordinator', 'Taşeron Koordinatör', 'proje_bazli',
 'Alt yüklenici/taşeron ekiplerin projede koordinasyonu.',
 '["Taşeron iş dağılımı",
   "İş teslim kontrolü",
   "Taşeron hakediş onayı",
   "İSG uyumluluk takibi",
   "Performans değerlendirme"]',
 'null',
 '["koordinator","saha_muhendisi"]',
 2, 0, 1);

-- FİRMA GENELİ GÖREVLER
INSERT INTO gorev_tanimlari (kod, ad, kategori, aciklama, sorumluluklar, gerekli_belgeler, gerekli_pozisyonlar, min_seviye, max_ayni_anda, zorunlu_proje) VALUES

('isg_sorumlusu', 'İSG Sorumlusu', 'firma_geneli',
 'Tüm sahalarda iş sağlığı ve güvenliği denetimi yapar.',
 '["Risk değerlendirmesi",
   "İSG eğitim planlaması ve takibi",
   "Kaza/ramak kala raporları",
   "KKD (Kişisel Koruyucu Donanım) takibi",
   "İSG-KATİP sistem kayıtları",
   "Acil durum planları",
   "Çalışma izinleri (yüksekte, enerji altında)"]',
 '["ISG_B","ISG_C"]',
 '["isg_uzmani","koordinator","saha_muhendisi"]',
 2, 0, 0),

('periyodik_kontrol', 'Periyodik Kontrol Uzmanı', 'firma_geneli',
 'Elektrik tesislerinin periyodik kontrollerini yapar.',
 '["Topraklama tesisi kontrolü",
   "Trafo kontrolü",
   "Jeneratör kontrolü",
   "Yangın algılama sistemi kontrolü",
   "Paratoner kontrolü",
   "Kontrol raporu düzenleme",
   "İSG-KATİP kayıt"]',
 '["ETIP","PERIYODIK_KONTROL"]',
 '["saha_muhendisi","tekniker"]',
 3, 0, 0),

('depo_yoneticisi', 'Depo Yöneticisi', 'firma_geneli',
 'Tüm malzeme depolarının yönetimi.',
 '["Stok sayımı ve kontrolü",
   "Giriş/çıkış kayıtları",
   "Minimum stok uyarıları",
   "Depo düzeni ve etiketleme",
   "Hurda ve iade yönetimi",
   "Yıllık envanter raporu"]',
 'null',
 '["depocu","satin_alma"]',
 4, 0, 0),

('arac_sorumlusu', 'Araç Sorumlusu', 'firma_geneli',
 'Firma araçlarının bakım, muayene ve kullanım takibi.',
 '["Araç bakım takvimi",
   "Muayene hatırlatmaları",
   "Yakıt takibi",
   "Sigorta/kasko takibi",
   "Araç tahsis yönetimi",
   "Kaza/hasar raporu"]',
 'null',
 '["operator","buro_personeli"]',
 4, 0, 0),

('egitim_sorumlusu', 'Eğitim Sorumlusu', 'firma_geneli',
 'Personel eğitim ihtiyaçlarının belirlenmesi ve takibi.',
 '["Eğitim ihtiyaç analizi",
   "Eğitim takvimi planlama",
   "Eğitim katılım takibi",
   "Sertifika yenileme uyarıları",
   "Yeni personel oryantasyonu"]',
 'null',
 '["koordinator","isg_uzmani"]',
 2, 0, 0),

('arsiv_sorumlusu', 'Arşiv Sorumlusu', 'firma_geneli',
 'Fiziksel ve dijital arşiv yönetimi.',
 '["Dosya sınıflandırma ve düzenleme",
   "Dijital arşiv bakımı",
   "Evrak kayıt defteri",
   "Saklama süresi takibi",
   "Yedekleme kontrolü"]',
 'null',
 '["buro_muhendisi","buro_personeli"]',
 3, 0, 0),

('kurum_irtibat', 'Kurum İrtibat', 'firma_geneli',
 'YEDAŞ/TEDAŞ ve diğer kurumlarla resmi iletişim.',
 '["Proje onay başvuruları",
   "Kabul randevu takibi",
   "Enerji kesme/verme talepleri",
   "Resmi yazışmalar",
   "Toplantı katılımı"]',
 'null',
 '["koordinator","buro_muhendisi"]',
 2, 0, 0),

('bilgi_islem', 'Bilgi İşlem Sorumlusu', 'firma_geneli',
 'ElektraTrack ve diğer yazılım/donanım sistemlerinin bakımı.',
 '["Sistem yedekleme kontrolü",
   "Kullanıcı hesap yönetimi",
   "Donanım bakımı",
   "Ağ yönetimi",
   "Yazılım güncelleme"]',
 'null',
 '["koordinator","tekniker"]',
 2, 0, 0);

-- GEÇİCİ / DÖNEMSEL GÖREVLER
INSERT INTO gorev_tanimlari (kod, ad, kategori, aciklama, sorumluluklar, gerekli_belgeler, gerekli_pozisyonlar, min_seviye, max_ayni_anda, zorunlu_proje) VALUES

('nobetci', 'Nöbetçi', 'gecici',
 'Hafta sonu / gece arıza müdahale nöbeti.',
 '["Arıza çağrılarına cevap verme",
   "Acil müdahale koordinasyonu",
   "Nöbet raporu yazma",
   "YEDAŞ ile iletişim"]',
 'null',
 '["saha_muhendisi","tekniker","ekip_basi"]',
 3, 0, 0),

('ihale_hazirlama', 'İhale Dosya Hazırlama', 'gecici',
 'Belirli bir ihale için teklif dosyası hazırlama.',
 '["İhale şartnamesi inceleme",
   "Maliyet hesabı",
   "Teklif dosyası düzenleme",
   "Referans belgeleri toplama"]',
 'null',
 '["koordinator","buro_muhendisi","proje_muhendisi"]',
 2, 0, 0),

('denetim_eslik', 'Denetim Eşlikçi', 'gecici',
 'YEDAŞ veya resmi kurum denetiminde firmayı temsil eder.',
 '["Denetçilere eşlik",
   "İstenen belgelerin sunumu",
   "Saha gösterimi",
   "Denetim bulgularının kaydı"]',
 '["ETIP"]',
 '["koordinator","saha_muhendisi"]',
 2, 0, 0),

('envanter_sayim', 'Envanter Sayım Sorumlusu', 'gecici',
 'Dönemsel envanter sayımı.',
 '["Fiziksel sayım",
   "Sistem ile karşılaştırma",
   "Fark raporu",
   "Düzeltme önerileri"]',
 'null',
 '["depocu","buro_personeli","tekniker"]',
 4, 0, 0),

('ozel_gorev', 'Özel Görev', 'gecici',
 'Önceden tanımlanmamış, açıklama ile belirtilen görev.',
 'null',
 'null',
 'null',
 5, 0, 0);
```

### 3.4 Kullanıcı Görevleri Tablosu (Çoklu Atama)

```sql
CREATE TABLE IF NOT EXISTS kullanici_gorevler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kullanici_id INTEGER NOT NULL,
    gorev_tanim_id INTEGER NOT NULL,        -- gorev_tanimlari.id referansı
    proje_id INTEGER,                        -- NULL ise firma geneli
    ozel_aciklama TEXT,                      -- Özel görevler için açıklama
    baslangic_tarihi DATE NOT NULL,
    bitis_tarihi DATE,                       -- NULL = devam ediyor
    aktif INTEGER DEFAULT 1,
    atayan_id INTEGER,                       -- Görevi atayan kişi
    atama_notu TEXT,                         -- Atama nedeni/notu
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id),
    FOREIGN KEY (gorev_tanim_id) REFERENCES gorev_tanimlari(id),
    FOREIGN KEY (proje_id) REFERENCES projeler(id),
    FOREIGN KEY (atayan_id) REFERENCES kullanicilar(id)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_kg_kullanici ON kullanici_gorevler(kullanici_id);
CREATE INDEX IF NOT EXISTS idx_kg_proje ON kullanici_gorevler(proje_id);
CREATE INDEX IF NOT EXISTS idx_kg_aktif ON kullanici_gorevler(aktif);
CREATE INDEX IF NOT EXISTS idx_kg_gorev ON kullanici_gorevler(gorev_tanim_id);
```

### 3.5 Görev Atama Validasyonları

```javascript
// server/services/gorevService.js

class GorevService {

  /**
   * Görev ata — validasyonlarla
   */
  gorevAta({ kullaniciId, gorevTanimId, projeId, baslangiTarihi, atama_notu, atayanId }) {
    const gorevTanimi = this.db.prepare(
      'SELECT * FROM gorev_tanimlari WHERE id = ?'
    ).get(gorevTanimId);

    if (!gorevTanimi) throw new Error('Görev tanımı bulunamadı');

    const kullanici = this.db.prepare(`
      SELECT k.*, p.kod as pozisyon_kodu, p.seviye as pozisyon_seviye
      FROM kullanicilar k
      LEFT JOIN pozisyonlar p ON k.pozisyon_id = p.id
      WHERE k.id = ?
    `).get(kullaniciId);

    if (!kullanici) throw new Error('Kullanıcı bulunamadı');

    // VALİDASYON 1: Proje bazlı görev ise proje_id zorunlu
    if (gorevTanimi.zorunlu_proje && !projeId) {
      throw new Error(`"${gorevTanimi.ad}" görevi proje bazlıdır, proje seçilmeli`);
    }

    // VALİDASYON 2: Pozisyon uygunluğu
    if (gorevTanimi.gerekli_pozisyonlar) {
      const uygunPozisyonlar = JSON.parse(gorevTanimi.gerekli_pozisyonlar);
      if (!uygunPozisyonlar.includes(kullanici.pozisyon_kodu)) {
        throw new Error(
          `"${kullanici.ad_soyad}" (${kullanici.pozisyon_kodu}) bu göreve atanamaz. ` +
          `Uygun pozisyonlar: ${uygunPozisyonlar.join(', ')}`
        );
      }
    }

    // VALİDASYON 3: Hiyerarşi seviyesi
    if (gorevTanimi.min_seviye && kullanici.pozisyon_seviye > gorevTanimi.min_seviye + 1) {
      throw new Error(
        `Bu görev minimum seviye ${gorevTanimi.min_seviye} gerektirir, ` +
        `${kullanici.ad_soyad} seviye ${kullanici.pozisyon_seviye}`
      );
    }

    // VALİDASYON 4: Gerekli belgeler
    if (gorevTanimi.gerekli_belgeler) {
      const gerekliBelgeler = JSON.parse(gorevTanimi.gerekli_belgeler);
      const mevcutBelgeler = this.db.prepare(`
        SELECT belge_tipi FROM kullanici_belgeler
        WHERE kullanici_id = ? AND aktif = 1
          AND (bitis_tarihi IS NULL OR bitis_tarihi > date('now'))
      `).all(kullaniciId).map(b => b.belge_tipi);

      const eksikler = gerekliBelgeler.filter(b => !mevcutBelgeler.includes(b));
      if (eksikler.length > 0) {
        throw new Error(
          `Eksik belgeler: ${eksikler.join(', ')}. ` +
          `Bu belge(ler) olmadan "${gorevTanimi.ad}" görevi atanamaz.`
        );
      }
    }

    // VALİDASYON 5: Aynı projede aynı görevden max sayı kontrolü
    if (gorevTanimi.max_ayni_anda > 0 && projeId) {
      const mevcutSayi = this.db.prepare(`
        SELECT COUNT(*) as sayi FROM kullanici_gorevler
        WHERE gorev_tanim_id = ? AND proje_id = ? AND aktif = 1
      `).get(gorevTanimId, projeId).sayi;

      if (mevcutSayi >= gorevTanimi.max_ayni_anda) {
        throw new Error(
          `Bu projede zaten ${mevcutSayi} "${gorevTanimi.ad}" atanmış. ` +
          `Maksimum: ${gorevTanimi.max_ayni_anda}`
        );
      }
    }

    // VALİDASYON 6: Aynı görev zaten atanmış mı?
    const mevcutGorev = this.db.prepare(`
      SELECT id FROM kullanici_gorevler
      WHERE kullanici_id = ? AND gorev_tanim_id = ? AND proje_id IS ?
        AND aktif = 1
    `).get(kullaniciId, gorevTanimId, projeId || null);

    if (mevcutGorev) {
      throw new Error(
        `"${kullanici.ad_soyad}" zaten bu görevde aktif`
      );
    }

    // Her şey tamam — ata
    const sonuc = this.db.prepare(`
      INSERT INTO kullanici_gorevler
        (kullanici_id, gorev_tanim_id, proje_id, baslangic_tarihi, atayan_id, atama_notu)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(kullaniciId, gorevTanimId, projeId || null, baslangiTarihi, atayanId, atama_notu);

    return { id: sonuc.lastInsertRowid, basarili: true };
  }

  /**
   * Görevi sonlandır (silme değil, aktif=0)
   */
  gorevSonlandir(gorevId, bitisTarihi) {
    this.db.prepare(`
      UPDATE kullanici_gorevler
      SET aktif = 0, bitis_tarihi = ?, guncelleme_tarihi = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(bitisTarihi || new Date().toISOString().split('T')[0], gorevId);
  }

  /**
   * Kişinin tüm aktif görevleri
   */
  kisininGorevleri(kullaniciId) {
    return this.db.prepare(`
      SELECT kg.*, gt.kod as gorev_kodu, gt.ad as gorev_adi,
             gt.kategori, gt.sorumluluklar,
             p.proje_no, p.proje_tipi
      FROM kullanici_gorevler kg
      JOIN gorev_tanimlari gt ON kg.gorev_tanim_id = gt.id
      LEFT JOIN projeler p ON kg.proje_id = p.id
      WHERE kg.kullanici_id = ? AND kg.aktif = 1
      ORDER BY gt.kategori, gt.ad
    `).all(kullaniciId);
  }

  /**
   * Projedeki görev dağılımı
   */
  projeninGorevleri(projeId) {
    return this.db.prepare(`
      SELECT kg.*, gt.kod as gorev_kodu, gt.ad as gorev_adi,
             k.ad_soyad, poz.ad as pozisyon_adi
      FROM kullanici_gorevler kg
      JOIN gorev_tanimlari gt ON kg.gorev_tanim_id = gt.id
      JOIN kullanicilar k ON kg.kullanici_id = k.id
      LEFT JOIN pozisyonlar poz ON k.pozisyon_id = poz.id
      WHERE kg.proje_id = ? AND kg.aktif = 1
      ORDER BY gt.ad
    `).all(projeId);
  }

  /**
   * Belirli görevdeki kişileri bul
   * Örn: "Topraklama sorumlusu kim?" → görev koduna göre arama
   */
  gorevdekiKisiler(gorevKodu, projeId = null) {
    let sql = `
      SELECT k.id, k.ad_soyad, k.telefon, poz.ad as pozisyon_adi,
             kg.proje_id, p.proje_no
      FROM kullanici_gorevler kg
      JOIN gorev_tanimlari gt ON kg.gorev_tanim_id = gt.id
      JOIN kullanicilar k ON kg.kullanici_id = k.id
      LEFT JOIN pozisyonlar poz ON k.pozisyon_id = poz.id
      LEFT JOIN projeler p ON kg.proje_id = p.id
      WHERE gt.kod = ? AND kg.aktif = 1
    `;
    const params = [gorevKodu];

    if (projeId) {
      sql += ' AND kg.proje_id = ?';
      params.push(projeId);
    }

    return this.db.prepare(sql).all(...params);
  }

  /**
   * Proje başlatma kontrolü — zorunlu görevler atanmış mı?
   */
  projeZorunluGorevKontrol(projeId) {
    const zorunluGorevler = ['santiye_sefi', 'proje_sorumlusu'];
    const eksikler = [];

    for (const kod of zorunluGorevler) {
      const atanmis = this.db.prepare(`
        SELECT COUNT(*) as sayi FROM kullanici_gorevler kg
        JOIN gorev_tanimlari gt ON kg.gorev_tanim_id = gt.id
        WHERE gt.kod = ? AND kg.proje_id = ? AND kg.aktif = 1
      `).get(kod, projeId).sayi;

      if (atanmis === 0) {
        const gorev = this.db.prepare(
          'SELECT ad FROM gorev_tanimlari WHERE kod = ?'
        ).get(kod);
        eksikler.push(gorev.ad);
      }
    }

    return {
      tamam: eksikler.length === 0,
      eksikGorevler: eksikler
    };
  }
}
```

---

## 4. Belge ve Sertifika Yönetimi

### 4.1 Belge Türleri

Elektrik dağıtım sektöründe zorunlu/önemli belgeler:

```
ZORUNLU MESLEKİ BELGELER
├── ETIP              ETİP Belgesi (Elektrik Tesislerinde İşletme ve Proje)
├── EKAT              EKAT Belgesi (fen adamları için)
├── ISG_A             İSG-A Sertifikası
├── ISG_B             İSG-B Sertifikası
├── ISG_C             İSG-C Sertifikası
├── PERIYODIK_KONTROL Periyodik Kontrol Uzmanı Belgesi
├── MESLEKI_YETERLILIK Mesleki Yeterlilik Belgesi (MYK)
└── ILKYARDIM         İlk Yardım Sertifikası

EHLIYET / OPERATÖR
├── EHLIYET_B         B Sınıfı Ehliyet
├── EHLIYET_C         C Sınıfı Ehliyet
├── EHLIYET_E         E Sınıfı Ehliyet
├── SRC               SRC Belgesi
├── FORKLIFT          Forklift Operatör Belgesi
├── VINC              Vinç Operatör Belgesi
└── SEPETLI           Sepetli Araç Operatör Belgesi

İSG EĞİTİMLERİ
├── YUKSEKTE_CALISMA  Yüksekte Çalışma Eğitimi
├── ENERJI_ALTINDA    Enerji Altında Çalışma Eğitimi
├── ISG_TEMEL         İSG Temel Eğitimi (16 saat)
├── YANGIN            Yangın Eğitimi
└── KKD               KKD Kullanım Eğitimi

DİĞER
├── SGK               SGK İşe Giriş Bildirgesi
├── SAGLIK_RAPORU     Sağlık Raporu (işe giriş)
├── ADLI_SICIL        Adli Sicil Kaydı
└── DIPLOMA           Diploma / Mezuniyet Belgesi
```

### 4.2 Belge Tablosu

```sql
CREATE TABLE IF NOT EXISTS belge_turleri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kod TEXT UNIQUE NOT NULL,           -- 'ETIP'
    ad TEXT NOT NULL,                    -- 'ETİP Belgesi'
    kategori TEXT NOT NULL,             -- 'mesleki','ehliyet','isg','diger'
    yenileme_suresi_ay INTEGER,        -- NULL = süresiz, 36 = 3 yılda bir yenile
    zorunlu INTEGER DEFAULT 0,         -- 1 = tüm personel için zorunlu
    aciklama TEXT,
    aktif INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS kullanici_belgeler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kullanici_id INTEGER NOT NULL,
    belge_turu_id INTEGER NOT NULL,
    belge_tipi TEXT NOT NULL,           -- 'ETIP' (hızlı erişim için)
    belge_no TEXT,                      -- Belge numarası
    veren_kurum TEXT,                   -- Belgeyi veren kurum
    baslangic_tarihi DATE,
    bitis_tarihi DATE,                  -- NULL = süresiz
    dosya_id INTEGER,                   -- dosyalar tablosuna referans (taranmış kopya)
    durum TEXT DEFAULT 'gecerli',       -- 'gecerli', 'suresi_dolmus', 'iptal'
    aktif INTEGER DEFAULT 1,
    notlar TEXT,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id),
    FOREIGN KEY (belge_turu_id) REFERENCES belge_turleri(id),
    FOREIGN KEY (dosya_id) REFERENCES dosyalar(id)
);

CREATE INDEX IF NOT EXISTS idx_kb_kullanici ON kullanici_belgeler(kullanici_id);
CREATE INDEX IF NOT EXISTS idx_kb_bitis ON kullanici_belgeler(bitis_tarihi);
CREATE INDEX IF NOT EXISTS idx_kb_tipi ON kullanici_belgeler(belge_tipi);
```

### 4.3 Belge Seed Data

```sql
INSERT INTO belge_turleri (kod, ad, kategori, yenileme_suresi_ay, zorunlu, aciklama) VALUES
('ETIP',               'ETİP Belgesi',                    'mesleki',  36,   0, 'Elektrik Tesislerinde İşletme ve Proje belgesi'),
('EKAT',               'EKAT Belgesi',                    'mesleki',  60,   0, 'Elektrikle ilgili fen adamları çalışma belgesi'),
('ISG_A',              'İSG-A Sertifikası',               'isg',      NULL, 0, 'A sınıfı iş güvenliği uzmanlığı'),
('ISG_B',              'İSG-B Sertifikası',               'isg',      NULL, 0, 'B sınıfı iş güvenliği uzmanlığı'),
('ISG_C',              'İSG-C Sertifikası',               'isg',      NULL, 0, 'C sınıfı iş güvenliği uzmanlığı'),
('PERIYODIK_KONTROL',  'Periyodik Kontrol Belgesi',       'mesleki',  NULL, 0, 'Periyodik kontrol uzmanı yetki belgesi'),
('MESLEKI_YETERLILIK', 'MYK Belgesi',                     'mesleki',  60,   0, 'Mesleki Yeterlilik Kurumu belgesi'),
('ILKYARDIM',          'İlk Yardım Sertifikası',          'isg',      36,   0, 'Temel ilk yardım eğitimi sertifikası'),
('EHLIYET_B',          'B Sınıfı Ehliyet',                'ehliyet',  120,  0, 'Binek araç ehliyeti'),
('EHLIYET_C',          'C Sınıfı Ehliyet',                'ehliyet',  60,   0, 'Ticari araç ehliyeti'),
('SRC',                'SRC Belgesi',                      'ehliyet',  60,   0, 'Mesleki yeterlilik belgesi (sürücü)'),
('FORKLIFT',           'Forklift Operatör Belgesi',        'ehliyet',  60,   0, 'Forklift kullanım belgesi'),
('SEPETLI',            'Sepetli Araç Operatör Belgesi',    'ehliyet',  36,   0, 'Sepetli araç kullanım belgesi'),
('YUKSEKTE_CALISMA',   'Yüksekte Çalışma Eğitimi',        'isg',      12,   0, 'Yüksekte çalışma güvenliği eğitimi'),
('ENERJI_ALTINDA',     'Enerji Altında Çalışma Eğitimi',   'isg',      12,   0, 'Enerji altında çalışma güvenliği eğitimi'),
('ISG_TEMEL',          'İSG Temel Eğitimi (16 saat)',      'isg',      12,   1, 'Tüm çalışanlar için zorunlu İSG eğitimi'),
('SGK',                'SGK İşe Giriş Bildirgesi',         'diger',    NULL, 1, 'SGK işe giriş bildirimi'),
('SAGLIK_RAPORU',      'Sağlık Raporu',                    'diger',    12,   1, 'İşe giriş ve periyodik sağlık raporu'),
('DIPLOMA',            'Diploma / Mezuniyet Belgesi',      'diger',    NULL, 0, 'En son mezuniyet belgesi');
```

### 4.4 Belge Süre Kontrolü ve Uyarılar

```javascript
// server/services/belgeService.js

class BelgeService {

  /**
   * Süresi dolmak üzere olan belgeler
   * Varsayılan: 30 gün içinde dolacaklar
   */
  suresiDolacakBelgeler(gunSayisi = 30) {
    const hedefTarih = new Date();
    hedefTarih.setDate(hedefTarih.getDate() + gunSayisi);

    return this.db.prepare(`
      SELECT kb.*, k.ad_soyad, k.telefon,
             bt.ad as belge_adi, bt.kategori,
             julianday(kb.bitis_tarihi) - julianday('now') as kalan_gun
      FROM kullanici_belgeler kb
      JOIN kullanicilar k ON kb.kullanici_id = k.id
      JOIN belge_turleri bt ON kb.belge_turu_id = bt.id
      WHERE kb.aktif = 1
        AND kb.bitis_tarihi IS NOT NULL
        AND kb.bitis_tarihi <= ?
        AND kb.bitis_tarihi >= date('now')
      ORDER BY kb.bitis_tarihi ASC
    `).all(hedefTarih.toISOString().split('T')[0]);
  }

  /**
   * Süresi dolmuş belgeler
   */
  suresiDolmusBelgeler() {
    return this.db.prepare(`
      SELECT kb.*, k.ad_soyad, k.telefon,
             bt.ad as belge_adi, bt.kategori,
             julianday('now') - julianday(kb.bitis_tarihi) as gecen_gun
      FROM kullanici_belgeler kb
      JOIN kullanicilar k ON kb.kullanici_id = k.id
      JOIN belge_turleri bt ON kb.belge_turu_id = bt.id
      WHERE kb.aktif = 1
        AND kb.bitis_tarihi IS NOT NULL
        AND kb.bitis_tarihi < date('now')
      ORDER BY kb.bitis_tarihi ASC
    `).all();
  }

  /**
   * Zorunlu belgesi eksik olan personel
   */
  eksikZorunluBelgeler() {
    return this.db.prepare(`
      SELECT k.id, k.ad_soyad, bt.kod as belge_kodu, bt.ad as belge_adi
      FROM kullanicilar k
      CROSS JOIN belge_turleri bt
      WHERE bt.zorunlu = 1
        AND k.aktif = 1
        AND NOT EXISTS (
          SELECT 1 FROM kullanici_belgeler kb
          WHERE kb.kullanici_id = k.id
            AND kb.belge_tipi = bt.kod
            AND kb.aktif = 1
            AND (kb.bitis_tarihi IS NULL OR kb.bitis_tarihi >= date('now'))
        )
      ORDER BY k.ad_soyad, bt.ad
    `).all();
  }

  /**
   * Kişinin belge özeti
   */
  kisiBegeOzeti(kullaniciId) {
    return this.db.prepare(`
      SELECT kb.*, bt.ad as belge_adi, bt.kategori, bt.yenileme_suresi_ay,
             CASE
               WHEN kb.bitis_tarihi IS NULL THEN 'süresiz'
               WHEN kb.bitis_tarihi < date('now') THEN 'süresi_dolmuş'
               WHEN kb.bitis_tarihi < date('now', '+30 days') THEN 'yakında_dolacak'
               ELSE 'geçerli'
             END as belge_durum
      FROM kullanici_belgeler kb
      JOIN belge_turleri bt ON kb.belge_turu_id = bt.id
      WHERE kb.kullanici_id = ? AND kb.aktif = 1
      ORDER BY bt.kategori, bt.ad
    `).all(kullaniciId);
  }
}
```

---

## 5. Yetkinlik Sistemi (Opsiyonel Genişletme)

### 5.1 Yetkinlik Tablosu

Belge = resmi sertifika, Yetkinlik = pratik beceri/uzmanlık.

```sql
CREATE TABLE IF NOT EXISTS yetkinlik_tanimlari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kod TEXT UNIQUE NOT NULL,           -- 'og_montaj'
    ad TEXT NOT NULL,                    -- 'OG Montaj (Orta Gerilim)'
    kategori TEXT NOT NULL,             -- 'teknik','idari','yazilim','diger'
    aciklama TEXT,
    aktif INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS kullanici_yetkinlikler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kullanici_id INTEGER NOT NULL,
    yetkinlik_id INTEGER NOT NULL,
    seviye TEXT NOT NULL DEFAULT 'orta',  -- 'baslangic','orta','ileri','uzman'
    notlar TEXT,
    degerlendiren_id INTEGER,           -- Kim değerlendirdi
    degerlendirme_tarihi DATE,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id),
    FOREIGN KEY (yetkinlik_id) REFERENCES yetkinlik_tanimlari(id),
    FOREIGN KEY (degerlendiren_id) REFERENCES kullanicilar(id),
    UNIQUE(kullanici_id, yetkinlik_id)
);
```

### 5.2 Yetkinlik Tanımları

```sql
INSERT INTO yetkinlik_tanimlari (kod, ad, kategori, aciklama) VALUES
-- Teknik Yetkinlikler
('ag_montaj',       'AG Hat Montajı',                 'teknik', 'Alçak gerilim hat çekimi ve montaj'),
('og_montaj',       'OG Hat Montajı',                 'teknik', 'Orta gerilim hat çekimi ve montaj'),
('trafo_montaj',    'Trafo Montajı',                  'teknik', 'Dağıtım trafosu montaj ve bağlantı'),
('direk_dikme',     'Direk Dikme',                    'teknik', 'Beton/ahşap/çelik direk dikimi'),
('kablo_eki',       'Kablo Eki ve Başlığı',           'teknik', 'OG/AG kablo eki ve başlık yapımı'),
('topraklama',      'Topraklama Tesisatı',            'teknik', 'Topraklama montajı ve ölçümü'),
('sayac_montaj',    'Sayaç Montajı',                  'teknik', 'Elektrik sayacı montaj ve programlama'),
('pano_montaj',     'Pano Montajı',                   'teknik', 'AG/OG pano montajı ve kablajı'),
('aydinlatma',      'Aydınlatma Sistemi',             'teknik', 'Sokak ve tesis aydınlatma montajı'),
('jenerator',       'Jeneratör Bakım/Montaj',         'teknik', 'Jeneratör montajı, bakımı, test'),
('olcum_alet',      'Ölçüm Aletleri Kullanımı',      'teknik', 'Topraklama ölçer, izolasyon ölçer, vb.'),

-- Proje/Büro Yetkinlikleri
('autocad',         'AutoCAD / DXF',                   'yazilim', 'Proje çizimi ve okuma'),
('metraj',          'Metraj Hesabı',                   'idari',   'İmalat miktarı hesaplama'),
('hakedis',         'Hakediş Hazırlama',               'idari',   'Hakediş dosyası düzenleme'),
('teknik_sartname', 'Teknik Şartname Okuma',           'idari',   'Şartname analizi ve uyumluluk'),
('excel_ileri',     'İleri Excel',                      'yazilim', 'Formül, pivot, makro'),
('resmi_yazi',      'Resmi Yazışma',                    'idari',   'Kurum yazışma formatı ve prosedürleri'),

-- Operatör Yetkinlikleri
('sepetli_kullanim', 'Sepetli Araç Kullanımı',          'teknik', 'Sepetli platformlu araç operasyonu'),
('vinc_kullanim',    'Vinç Kullanımı',                   'teknik', 'Mobil vinç operasyonu'),
('agir_vasita',      'Ağır Vasıta Kullanımı',            'teknik', 'Kamyon, TIR kullanımı');
```

---

## 6. API Endpoints

### 6.1 Personel

```
GET    /api/personel                         → Tüm personel listesi (filtre: pozisyon, aktif)
GET    /api/personel/:id                     → Personel detay (pozisyon + görevler + belgeler)
PUT    /api/personel/:id                     → Personel güncelle
GET    /api/personel/:id/gorevler            → Kişinin görevleri
GET    /api/personel/:id/belgeler            → Kişinin belgeleri
GET    /api/personel/:id/yetkinlikler        → Kişinin yetkinlikleri
GET    /api/personel/:id/alt-personel        → Kişinin altındaki personel (hiyerarşi)
GET    /api/personel/:id/ust-zincir          → Kişinin üst yöneticileri
```

### 6.2 Organizasyon

```
GET    /api/organizasyon/agac                → Firma organizasyon ağacı
GET    /api/organizasyon/pozisyonlar         → Pozisyon tanımları listesi
POST   /api/organizasyon/pozisyonlar         → Yeni pozisyon tanımla (özel)
```

### 6.3 Görevler

```
GET    /api/gorevler/tanimlar                → Görev tanımları listesi
POST   /api/gorevler/ata                     → Görev ata (validasyonlu)
PUT    /api/gorevler/:id/sonlandir           → Görevi sonlandır
GET    /api/gorevler/proje/:projeId          → Projedeki görev dağılımı
GET    /api/gorevler/kodu/:kod               → Bu görevdeki kişiler (tüm projeler)
GET    /api/gorevler/proje/:projeId/kontrol  → Proje zorunlu görev kontrolü
```

### 6.4 Belgeler

```
GET    /api/belgeler/turler                  → Belge türleri listesi
POST   /api/belgeler                         → Belge ekle
PUT    /api/belgeler/:id                     → Belge güncelle
DELETE /api/belgeler/:id                     → Belge sil (soft delete)
GET    /api/belgeler/suresi-dolacak          → Süresi dolmak üzere olanlar
GET    /api/belgeler/suresi-dolmus           → Süresi dolmuşlar
GET    /api/belgeler/eksik-zorunlu           → Zorunlu belgesi eksik personel
```

### 6.5 Yetkinlikler

```
GET    /api/yetkinlikler/tanimlar            → Yetkinlik tanımları
POST   /api/yetkinlikler                     → Yetkinlik ekle/güncelle
GET    /api/yetkinlikler/ara                 → Yetkinliğe göre personel ara
```

---

## 7. Frontend UI

### 7.1 Personel Profil Sayfası

```
┌─────────────────────────────────────────────────────────────────┐
│  👤 Mehmet Yılmaz                                              │
│  Saha Mühendisi (Seviye 3)                                     │
│  📞 0532 xxx xx xx   ✉ mehmet@firma.com                        │
│  🏢 Bölge 1 — Raporlama: İrfan Bey (Koordinatör)              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ AKTİF GÖREVLER                                           │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ 🔧 Şantiye Şefi — YB-2025-003 Koşu Köy                 │   │
│  │    Başlangıç: 15.01.2025                                 │   │
│  │                                                          │   │
│  │ 📐 Proje Tasarımcı — KET-2025-012 Merkez                │   │
│  │    Başlangıç: 01.02.2025                                 │   │
│  │                                                          │   │
│  │ 🔍 Keşif Sorumlusu — (firma geneli)                      │   │
│  │    Başlangıç: 01.01.2025                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ BELGELER                                                  │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ ✅ ETİP Belgesi        — 2024-2027 (2 yıl kaldı)        │   │
│  │ ✅ İSG-B Sertifikası   — 2023-2028 (süresiz)            │   │
│  │ ⚠️ Ehliyet B           — 2025-06-15 (4 ay kaldı!)       │   │
│  │ ✅ İSG Temel Eğitimi   — 2025-2026                       │   │
│  │ ❌ Yüksekte Çalışma    — SÜRESİ DOLMUŞ (45 gün)        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ YETKİNLİKLER                                              │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ ⭐⭐⭐⭐ OG Montaj      ⭐⭐⭐   Topraklama               │   │
│  │ ⭐⭐⭐   AutoCAD        ⭐⭐⭐⭐ Metraj Hesabı            │   │
│  │ ⭐⭐     Hakediş        ⭐⭐⭐   Kablo Eki                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [✏️ Düzenle]  [📋 Görev Ata]  [📄 Belge Ekle]               │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Organizasyon Şeması Sayfası

```
┌──────────────────────────────────────────────────────────────────┐
│  Firma Organizasyon Şeması                          [🔍 Ara]    │
│                                                                  │
│                    ┌──────────────────┐                           │
│                    │   Hasan Bey      │                           │
│                    │   Firma Sahibi   │                           │
│                    └────────┬─────────┘                           │
│                    ┌────────┴─────────┐                           │
│              ┌─────┴──────┐    ┌─────┴──────┐                    │
│              │ Murat Bey  │    │  Ayşe Hn.  │                    │
│              │ Teknik Md. │    │  İdari Md. │                    │
│              └─────┬──────┘    └─────┬──────┘                    │
│           ┌────────┴────────┐        │                            │
│     ┌─────┴──────┐   ┌─────┴──────┐ ├── Zeynep (Depocu)         │
│     │  İrfan     │   │  Ahmet     │ └── Elif (Büro)              │
│     │  Koord-1   │   │  Koord-2   │                              │
│     └─────┬──────┘   └────────────┘                              │
│     ┌─────┴──────────┐                                           │
│  ┌──┴──┐         ┌───┴──┐                                        │
│  │Mehmet│         │Fatma │                                        │
│  │Saha M│         │Büro M│                                        │
│  └──┬───┘         └──────┘                                        │
│  ┌──┴────────┐                                                    │
│  │Ali │Hüseyn│  (Ekip Başları)                                    │
│  └────┴──────┘                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 7.3 Proje Görev Dağılımı Kartı

```
┌──────────────────────────────────────────────────────────┐
│  YB-2025-003 Koşu Köy — Görev Dağılımı                  │
│                                                          │
│  ✅ Proje Sorumlusu    → İrfan (Koordinatör)             │
│  ✅ Şantiye Şefi       → Mehmet (Saha Müh.)             │
│  ✅ Topraklama Soruml.  → Mehmet (Saha Müh.)             │
│  ✅ Malzeme Takip       → Ali (Ekip Başı)                │
│  ⬜ Hakediş Hazırlama   → Atanmadı!                      │
│  ⬜ Kalite Kontrol      → Atanmadı                       │
│                                                          │
│  [➕ Görev Ata]                                           │
└──────────────────────────────────────────────────────────┘
```

### 7.4 Belge Uyarı Dashboard Kartı

```
┌──────────────────────────────────────────────────────────┐
│  📋 Belge Durumu                                         │
│                                                          │
│  ❌ Süresi Dolmuş (3)                                    │
│     • Veli — Yüksekte Çalışma (45 gün geçmiş)           │
│     • Kemal — Sağlık Raporu (12 gün geçmiş)             │
│     • Ali — Sepetli Araç Belgesi (5 gün geçmiş)         │
│                                                          │
│  ⚠️ 30 Gün İçinde Dolacak (2)                            │
│     • Mehmet — Ehliyet B (28 gün kaldı)                  │
│     • Fatma — İSG Temel Eğitimi (15 gün kaldı)          │
│                                                          │
│  📌 Eksik Zorunlu Belge (1)                              │
│     • Yeni İşçi Hasan — SGK Bildirgesi eksik             │
│                                                          │
│  [📊 Tüm Belge Raporu]                                   │
└──────────────────────────────────────────────────────────┘
```

---

## 8. AI Entegrasyonu

### 8.1 Doğal Dil Sorguları

AI asistan bu görev/pozisyon verilerini sorgulayabilir:

```
Kullanıcı: "Koşu köy şantiye şefi kim?"
AI: → gorevdekiKisiler('santiye_sefi', projeId) → "Mehmet Yılmaz"

Kullanıcı: "Mehmet'in üzerinde kaç proje var?"
AI: → kisininGorevleri(mehmetId) → "3 aktif proje görevi"

Kullanıcı: "Topraklama yapabilecek kim var?"
AI: → yetkinlik 'topraklama' olan + sertifika geçerli kişiler → liste

Kullanıcı: "Süresi dolmuş belge var mı?"
AI: → suresiDolmusBelgeler() → uyarı listesi

Kullanıcı: "Ali'nin altında kimler çalışıyor?"
AI: → altPersonel(aliId) → ağaç yapısı
```

### 8.2 Görev Atamada AI Önerisi

```
Kullanıcı: "YB-2025-010 projesine şantiye şefi ata"
AI:
  1. projeZorunluGorevKontrol → şantiye şefi eksik
  2. gorevTanimi.gerekli_pozisyonlar → ['saha_muhendisi','tekniker','ekip_basi']
  3. Bu pozisyondaki + ETİP belgeli + müsait kişiler → liste
  4. "Mehmet Yılmaz (2 projede aktif), Ayşe Kaya (1 projede aktif) uygun.
      Ayşe'nin iş yükü daha az, onu öneriyorum."
```

---

## 9. Migration Planı

### 9.1 Yeni Migration Dosyası

```sql
-- migrations/010_personel_gorev.sql

-- 1. Pozisyonlar
CREATE TABLE IF NOT EXISTS pozisyonlar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kod TEXT UNIQUE NOT NULL,
    ad TEXT NOT NULL,
    seviye INTEGER NOT NULL,
    kategori TEXT NOT NULL,
    aciklama TEXT,
    varsayilan_sistem_rolu TEXT,
    aktif INTEGER DEFAULT 1,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Kullanıcılar tablosuna ek sütunlar
ALTER TABLE kullanicilar ADD COLUMN pozisyon_id INTEGER REFERENCES pozisyonlar(id);
ALTER TABLE kullanicilar ADD COLUMN ust_kullanici_id INTEGER REFERENCES kullanicilar(id);
ALTER TABLE kullanicilar ADD COLUMN tc_kimlik TEXT;
ALTER TABLE kullanicilar ADD COLUMN dogum_tarihi DATE;
ALTER TABLE kullanicilar ADD COLUMN ise_giris_tarihi DATE;
ALTER TABLE kullanicilar ADD COLUMN kan_grubu TEXT;
ALTER TABLE kullanicilar ADD COLUMN acil_kisi TEXT;
ALTER TABLE kullanicilar ADD COLUMN acil_telefon TEXT;
ALTER TABLE kullanicilar ADD COLUMN adres TEXT;
ALTER TABLE kullanicilar ADD COLUMN notlar TEXT;

-- 3. Görev tanımları
CREATE TABLE IF NOT EXISTS gorev_tanimlari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kod TEXT UNIQUE NOT NULL,
    ad TEXT NOT NULL,
    kategori TEXT NOT NULL,
    aciklama TEXT,
    sorumluluklar TEXT,
    gerekli_belgeler TEXT,
    gerekli_pozisyonlar TEXT,
    min_seviye INTEGER,
    max_ayni_anda INTEGER DEFAULT 0,
    zorunlu_proje INTEGER DEFAULT 0,
    aktif INTEGER DEFAULT 1,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Kullanıcı görevleri (çoklu atama)
CREATE TABLE IF NOT EXISTS kullanici_gorevler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kullanici_id INTEGER NOT NULL,
    gorev_tanim_id INTEGER NOT NULL,
    proje_id INTEGER,
    ozel_aciklama TEXT,
    baslangic_tarihi DATE NOT NULL,
    bitis_tarihi DATE,
    aktif INTEGER DEFAULT 1,
    atayan_id INTEGER,
    atama_notu TEXT,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id),
    FOREIGN KEY (gorev_tanim_id) REFERENCES gorev_tanimlari(id),
    FOREIGN KEY (proje_id) REFERENCES projeler(id),
    FOREIGN KEY (atayan_id) REFERENCES kullanicilar(id)
);

-- 5. Belge türleri
CREATE TABLE IF NOT EXISTS belge_turleri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kod TEXT UNIQUE NOT NULL,
    ad TEXT NOT NULL,
    kategori TEXT NOT NULL,
    yenileme_suresi_ay INTEGER,
    zorunlu INTEGER DEFAULT 0,
    aciklama TEXT,
    aktif INTEGER DEFAULT 1
);

-- 6. Kullanıcı belgeleri
CREATE TABLE IF NOT EXISTS kullanici_belgeler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kullanici_id INTEGER NOT NULL,
    belge_turu_id INTEGER NOT NULL,
    belge_tipi TEXT NOT NULL,
    belge_no TEXT,
    veren_kurum TEXT,
    baslangic_tarihi DATE,
    bitis_tarihi DATE,
    dosya_id INTEGER,
    durum TEXT DEFAULT 'gecerli',
    aktif INTEGER DEFAULT 1,
    notlar TEXT,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id),
    FOREIGN KEY (belge_turu_id) REFERENCES belge_turleri(id),
    FOREIGN KEY (dosya_id) REFERENCES dosyalar(id)
);

-- 7. Yetkinlikler (opsiyonel)
CREATE TABLE IF NOT EXISTS yetkinlik_tanimlari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kod TEXT UNIQUE NOT NULL,
    ad TEXT NOT NULL,
    kategori TEXT NOT NULL,
    aciklama TEXT,
    aktif INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS kullanici_yetkinlikler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kullanici_id INTEGER NOT NULL,
    yetkinlik_id INTEGER NOT NULL,
    seviye TEXT NOT NULL DEFAULT 'orta',
    notlar TEXT,
    degerlendiren_id INTEGER,
    degerlendirme_tarihi DATE,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id),
    FOREIGN KEY (yetkinlik_id) REFERENCES yetkinlik_tanimlari(id),
    FOREIGN KEY (degerlendiren_id) REFERENCES kullanicilar(id),
    UNIQUE(kullanici_id, yetkinlik_id)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_kg_kullanici ON kullanici_gorevler(kullanici_id);
CREATE INDEX IF NOT EXISTS idx_kg_proje ON kullanici_gorevler(proje_id);
CREATE INDEX IF NOT EXISTS idx_kg_aktif ON kullanici_gorevler(aktif);
CREATE INDEX IF NOT EXISTS idx_kg_gorev ON kullanici_gorevler(gorev_tanim_id);
CREATE INDEX IF NOT EXISTS idx_kb_kullanici ON kullanici_belgeler(kullanici_id);
CREATE INDEX IF NOT EXISTS idx_kb_bitis ON kullanici_belgeler(bitis_tarihi);
CREATE INDEX IF NOT EXISTS idx_kb_tipi ON kullanici_belgeler(belge_tipi);
```

### 9.2 Seed Migration

```sql
-- migrations/011_personel_gorev_seed.sql
-- Pozisyon, görev, belge ve yetkinlik tanımlarının seed data'sı
-- (Yukarıdaki INSERT ifadelerinin tamamı buraya)
```

---

## 10. Mevcut MD'ler ile İlişki

```
kullanici-rolleri.md (Katman 1)
├── Sistem rolü: koordinator, muhendis, tekniker, depocu, ekip, izleyici
├── Erişim kontrolü: kim neyi görebilir
└── Bu MD'yi DEĞİŞTİRMEYE gerek yok, olduğu gibi kalır

personel-gorev-yonetimi.md (Katman 2+3) ← BU DOSYA
├── Pozisyon: Firmadaki resmi unvan + hiyerarşi seviyesi
├── Görev: Çoklu atanabilir roller (proje/firma/geçici)
├── Belge: Sertifika ve süre takibi
├── Yetkinlik: Pratik beceri değerlendirmesi
└── kullanici-rolleri.md'nin ÜZERİNE inşa edilir (çelişmez)

proje-dongu.md
├── Proje aşamaları ve takibi
└── Proje başlatma kontrolü → zorunlu görev kontrolüne bağlanır

ai-operasyon-birlesik.md / ai-sohbet.md
├── "Şantiye şefi kim?" gibi sorgular
└── Görev/pozisyon verilerine erişim
```

---

## 11. Özet

| Özellik | Açıklama |
|---------|----------|
| **Pozisyon** | Firmadaki resmi unvan (15 tanımlı) |
| **Hiyerarşi** | Kim kime rapor veriyor (ağaç yapısı) |
| **Görev** | Proje bazlı, firma geneli, geçici (25+ tanımlı) |
| **Çoklu görev** | Bir kişi birden fazla görevde olabilir |
| **Validasyon** | Pozisyon uygunluğu, belge kontrolü, seviye kontrolü |
| **Belge/Sertifika** | 19 belge türü, süre takibi, otomatik uyarı |
| **Yetkinlik** | Pratik beceri seviyesi (başlangıç→uzman) |
| **AI entegrasyonu** | Doğal dil ile görev sorgulama |
| **Tablo sayısı** | 7 yeni tablo + kullanicilar'a 10 yeni sütun |
| **Migration** | 010_personel_gorev.sql + 011_seed.sql |
