# ElektraTrack — Kullanıcı Rolleri ve Yetkilendirme Sistemi (RBAC)

## Amaç

Esnek, modül bazlı yetkilendirme sistemi. Kullanıcı istediği rolü oluşturabilir, her role modül bazlı izinler atayabilir.

**Temel özellikler:**
1. Roller tamamen özelleştirilebilir (yeni rol oluştur, izin ata)
2. Modül + aksiyon bazlı izin sistemi (ör: `projeler:okuma`, `malzeme:silme`)
3. Her kullanıcıya bir veya birden fazla rol atanabilir
4. "Kendi verisi" kısıtlaması (ör: ekip başı sadece kendi ekibini görür)
5. Backend middleware ile her API isteği kontrol edilir
6. Frontend'de menü, buton ve sayfalar yetkiye göre gösterilir/gizlenir
7. Varsayılan roller hazır gelir (Patron, Koordinatör, vb.) ama düzenlenebilir

---

## Kavramlar

```
ROL          → "Koordinatör", "Depocu", "Ekip Başı"...
  └─ İZİNLER → Her rol birden fazla izne sahip
       └─ modul:aksiyon → "projeler:okuma", "malzeme:yazma", "raporlar:tam"

KULLANICI
  └─ ROL(LER) → Her kullanıcıya 1+ rol atanır
       └─ VERİ KAPSAMI → "tum", "kendi_ekip", "kendi" (hangi verileri görebilir)
```

### İzin Aksiyonları

| Aksiyon | Açıklama |
|---------|----------|
| `okuma` | Listeleme ve detay görüntüleme |
| `yazma` | Oluşturma ve güncelleme |
| `silme` | Silme (yumuşak veya kalıcı) |
| `onaylama` | Onay/red işlemleri |
| `tam` | Tüm aksiyonlar (okuma+yazma+silme+onaylama) |

### Veri Kapsamları

| Kapsam | Açıklama |
|--------|----------|
| `tum` | Tüm verileri görür/düzenler |
| `kendi_santiye` | Sadece kendi şantiyesindeki projeler |
| `kendi_ekip` | Sadece kendi ekibine ait veriler |
| `kendi` | Sadece kendisinin oluşturduğu veriler |

---

## Adım 1 — Veritabanı Şeması

### Tablo: `roller`

```sql
-- ============================================
-- ROLLER — Özelleştirilebilir rol tanımları
-- ============================================
CREATE TABLE IF NOT EXISTS roller (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rol_adi TEXT NOT NULL,                    -- "Koordinatör", "Ekip Başı"
    rol_kodu TEXT UNIQUE NOT NULL,            -- "koordinator", "ekip_basi"
    aciklama TEXT,                            -- Rolün açıklaması
    renk TEXT DEFAULT '#6b7280',             -- UI'da gösterilecek renk
    ikon TEXT DEFAULT '👤',                   -- Emoji ikon
    seviye INTEGER DEFAULT 50,               -- Hiyerarşi seviyesi (100=en yüksek)
    sistem_rolu INTEGER DEFAULT 0,           -- 1=sistem rolü (silinemez, kodu değişemez)

    durum TEXT DEFAULT 'aktif',              -- 'aktif', 'pasif'
    olusturan_id INTEGER,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (olusturan_id) REFERENCES kullanicilar(id)
);
```

### Tablo: `izinler` — Modül Bazlı İzin Tanımları

```sql
-- ============================================
-- İZİNLER — Sistemdeki tüm izin tanımları
-- Her modül+aksiyon çifti bir izindir
-- ============================================
CREATE TABLE IF NOT EXISTS izinler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    modul TEXT NOT NULL,                      -- "projeler", "ekipler", "malzeme"
    aksiyon TEXT NOT NULL,                    -- "okuma", "yazma", "silme", "onaylama", "tam"
    aciklama TEXT,                            -- "Projeleri görüntüleme"
    modul_etiketi TEXT,                       -- "Projeler" (UI'da gösterilecek)
    aksiyon_etiketi TEXT,                     -- "Okuma" (UI'da gösterilecek)

    UNIQUE(modul, aksiyon)
);
```

### Tablo: `rol_izinleri` — Hangi Rolde Hangi İzin + Kapsam

```sql
-- ============================================
-- ROL İZİNLERİ — Rol-İzin eşleşmesi
-- Her satır: "Bu rolün, bu modülde, bu aksiyonu, bu kapsamda yapabilir" der
-- ============================================
CREATE TABLE IF NOT EXISTS rol_izinleri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rol_id INTEGER NOT NULL,
    izin_id INTEGER NOT NULL,
    veri_kapsami TEXT DEFAULT 'tum',          -- 'tum', 'kendi_santiye', 'kendi_ekip', 'kendi'

    FOREIGN KEY (rol_id) REFERENCES roller(id) ON DELETE CASCADE,
    FOREIGN KEY (izin_id) REFERENCES izinler(id) ON DELETE CASCADE,
    UNIQUE(rol_id, izin_id)
);
```

### Tablo: `kullanicilar`

```sql
-- ============================================
-- KULLANICILAR — Sisteme giriş yapan kullanıcılar
-- ============================================
CREATE TABLE IF NOT EXISTS kullanicilar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kullanici_adi TEXT UNIQUE NOT NULL,       -- Login adı
    sifre_hash TEXT NOT NULL,                -- bcrypt hash
    ad_soyad TEXT NOT NULL,
    email TEXT,
    telefon TEXT,
    avatar_yolu TEXT,                         -- Profil fotoğrafı

    -- İlişkiler
    personel_id INTEGER,                     -- Bağlı personel kaydı (varsa)
    ekip_id INTEGER,                         -- Bağlı olduğu ekip (varsa)

    -- Durum
    durum TEXT DEFAULT 'aktif',              -- 'aktif', 'pasif', 'kilitli'
    son_giris DATETIME,
    basarisiz_giris_sayisi INTEGER DEFAULT 0,

    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (personel_id) REFERENCES personel(id),
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id)
);
```

### Tablo: `kullanici_rolleri` — Kullanıcıya Atanan Roller

```sql
-- ============================================
-- KULLANICI ROLLERİ — Bir kullanıcıya birden fazla rol atanabilir
-- Nihai yetki: tüm rollerinin izinlerinin birleşimi (en geniş kazanır)
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
```

### İndeksler

```sql
CREATE INDEX IF NOT EXISTS idx_rol_izin_rol ON rol_izinleri(rol_id);
CREATE INDEX IF NOT EXISTS idx_rol_izin_izin ON rol_izinleri(izin_id);
CREATE INDEX IF NOT EXISTS idx_kullanici_rol_kullanici ON kullanici_rolleri(kullanici_id);
CREATE INDEX IF NOT EXISTS idx_kullanici_rol_rol ON kullanici_rolleri(rol_id);
CREATE INDEX IF NOT EXISTS idx_kullanici_durum ON kullanicilar(durum);
```

---

## Adım 2 — Seed Data: İzin Tanımları + Varsayılan Roller

### Tüm İzin Tanımları

```sql
-- ═══════════════════════════════════════════════════
-- İZİN TANIMLARI — Sistemdeki tüm modül:aksiyon çiftleri
-- ═══════════════════════════════════════════════════

-- ─── PROJE YÖNETİMİ ─────────────────────────────
INSERT INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('projeler', 'okuma',    'Projeler', 'Okuma',    'Proje listesi ve detay görüntüleme'),
  ('projeler', 'yazma',    'Projeler', 'Yazma',    'Proje oluşturma ve düzenleme'),
  ('projeler', 'silme',    'Projeler', 'Silme',    'Proje silme'),
  ('projeler', 'onaylama', 'Projeler', 'Onaylama', 'Proje durumu onaylama');

-- ─── DÖNGÜ / YAŞAM DÖNGÜSÜ ─────────────────────
INSERT INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('dongu', 'okuma',    'Yaşam Döngüsü', 'Okuma',    'Proje aşamalarını görüntüleme'),
  ('dongu', 'yazma',    'Yaşam Döngüsü', 'Yazma',    'Aşama başlatma/tamamlama/tarih güncelleme'),
  ('dongu', 'sablon',   'Yaşam Döngüsü', 'Şablon Yönetimi', 'Döngü şablonu oluşturma/düzenleme');

-- ─── EKİPLER ────────────────────────────────────
INSERT INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('ekipler', 'okuma',  'Ekipler', 'Okuma',  'Ekip listesi ve detay görüntüleme'),
  ('ekipler', 'yazma',  'Ekipler', 'Yazma',  'Ekip oluşturma ve düzenleme'),
  ('ekipler', 'silme',  'Ekipler', 'Silme',  'Ekip silme');

-- ─── PERSONEL ───────────────────────────────────
INSERT INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('personel', 'okuma',  'Personel', 'Okuma',  'Personel listesi ve detay görüntüleme'),
  ('personel', 'yazma',  'Personel', 'Yazma',  'Personel ekleme ve düzenleme'),
  ('personel', 'silme',  'Personel', 'Silme',  'Personel silme/pasifleştirme');

-- ─── VERİ PAKETLERİ ─────────────────────────────
INSERT INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('veri_paketi', 'okuma',    'Veri Paketleri', 'Okuma',    'Veri paketi listeleme/detay'),
  ('veri_paketi', 'yazma',    'Veri Paketleri', 'Yazma',    'Veri paketi oluşturma ve dosya ekleme'),
  ('veri_paketi', 'silme',    'Veri Paketleri', 'Silme',    'Veri paketi silme'),
  ('veri_paketi', 'onaylama', 'Veri Paketleri', 'Onaylama', 'Veri paketi onaylama/reddetme');

-- ─── DOSYALAR ───────────────────────────────────
INSERT INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('dosyalar', 'okuma',    'Dosyalar', 'Okuma',    'Dosya listeleme, indirme, önizleme'),
  ('dosyalar', 'yazma',    'Dosyalar', 'Yazma',    'Dosya yükleme ve metadata düzenleme'),
  ('dosyalar', 'silme',    'Dosyalar', 'Silme',    'Dosya silme');

-- ─── SAHA HARİTA ────────────────────────────────
INSERT INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('saha_harita', 'okuma',  'Saha Harita', 'Okuma',  'Haritayı görüntüleme'),
  ('saha_harita', 'yazma',  'Saha Harita', 'Yazma',  'Konum güncelleme, marker düzenleme');

-- ─── SAHA MESAJ ─────────────────────────────────
INSERT INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('saha_mesaj', 'okuma',    'Saha Mesaj', 'Okuma',    'Mesaj geçmişini görüntüleme'),
  ('saha_mesaj', 'yazma',    'Saha Mesaj', 'Yazma',    'Mesaj gönderme'),
  ('saha_mesaj', 'onaylama', 'Saha Mesaj', 'Onaylama', 'Parse sonuçlarını onaylama/düzeltme');

-- ─── MALZEME / DEPO ─────────────────────────────
INSERT INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('malzeme', 'okuma',    'Malzeme/Depo', 'Okuma',    'Stok ve malzeme listesi görüntüleme'),
  ('malzeme', 'yazma',    'Malzeme/Depo', 'Yazma',    'Stok giriş/çıkış, malzeme tanımlama'),
  ('malzeme', 'silme',    'Malzeme/Depo', 'Silme',    'Malzeme silme'),
  ('malzeme', 'talep',    'Malzeme/Depo', 'Talep',    'Malzeme talep oluşturma'),
  ('malzeme', 'onaylama', 'Malzeme/Depo', 'Onaylama', 'Malzeme talep onaylama');

-- ─── FİNANSAL ───────────────────────────────────
INSERT INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('finansal', 'okuma',  'Finansal', 'Okuma',  'Hak ediş, maliyet, fatura görüntüleme'),
  ('finansal', 'yazma',  'Finansal', 'Yazma',  'Hak ediş/maliyet/fatura oluşturma/düzenleme'),
  ('finansal', 'silme',  'Finansal', 'Silme',  'Finansal kayıt silme'),
  ('finansal', 'onaylama','Finansal', 'Onaylama','Hak ediş onaylama');

-- ─── İSG ────────────────────────────────────────
INSERT INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('isg', 'okuma',  'İSG', 'Okuma',  'İSG denetim ve kontrol listesi görüntüleme'),
  ('isg', 'yazma',  'İSG', 'Yazma',  'Denetim oluşturma, kontrol listesi doldurma'),
  ('isg', 'silme',  'İSG', 'Silme',  'İSG kayıt silme'),
  ('isg', 'rapor',  'İSG', 'Raporlama', 'İSG raporu oluşturma');

-- ─── RAPORLAR ───────────────────────────────────
INSERT INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('raporlar', 'genel',    'Raporlar', 'Genel',    'Genel raporları görüntüleme'),
  ('raporlar', 'mali',     'Raporlar', 'Mali',     'Mali raporları görüntüleme'),
  ('raporlar', 'isg',      'Raporlar', 'İSG',      'İSG raporlarını görüntüleme'),
  ('raporlar', 'depo',     'Raporlar', 'Depo',     'Depo/malzeme raporlarını görüntüleme');

-- ─── AYARLAR ────────────────────────────────────
INSERT INTO izinler (modul, aksiyon, modul_etiketi, aksiyon_etiketi, aciklama) VALUES
  ('ayarlar', 'genel',      'Ayarlar', 'Genel',      'Genel ayarlar (firma bilgileri)'),
  ('ayarlar', 'telegram',   'Ayarlar', 'Telegram/AI', 'Telegram bot ve AI ayarları'),
  ('ayarlar', 'dongu',      'Ayarlar', 'Döngü Şablon','Döngü şablon yönetimi'),
  ('ayarlar', 'roller',     'Ayarlar', 'Rol Yönetimi','Rol oluşturma ve izin atama'),
  ('ayarlar', 'kullanicilar','Ayarlar', 'Kullanıcılar','Kullanıcı oluşturma ve rol atama');
```

### Varsayılan Roller

```sql
-- ═══════════════════════════════════════════════════
-- VARSAYILAN ROLLER
-- sistem_rolu=1 olanlar silinemez ama izinleri düzenlenebilir
-- ═══════════════════════════════════════════════════

INSERT INTO roller (rol_adi, rol_kodu, aciklama, renk, ikon, seviye, sistem_rolu) VALUES
  ('Patron',          'patron',       'Tüm yetkilere sahip, firma sahibi',           '#dc2626', '👑', 100, 1),
  ('Koordinatör',     'koordinator',  'Günlük operasyon yönetimi',                    '#2563eb', '📋', 90,  1),
  ('Şantiye Şefi',   'santiye_sefi', 'Şantiye bazlı proje ve ekip yönetimi',         '#f59e0b', '🏗️', 80,  1),
  ('Saha Mühendisi',  'saha_muhendis','Sahada teknik kontrol ve denetim',             '#10b981', '🔍', 70,  1),
  ('Ekip Başı',       'ekip_basi',   'Saha ekip yönetimi, veri paketi gönderimi',     '#8b5cf6', '👷', 60,  1),
  ('Depocu',          'depocu',      'Malzeme ve stok yönetimi',                      '#0ea5e9', '📦', 50,  1),
  ('İSG Uzmanı',      'isg_uzmani',  'İş sağlığı ve güvenliği denetimi',             '#f43f5e', '🛡️', 50,  1),
  ('Muhasebeci',      'muhasebeci',  'Hak ediş, maliyet ve finansal işlemler',        '#84cc16', '💰', 50,  1),
  ('Sürveyan',        'surveyan',    'Saha kontrolü ve yapım denetimi',               '#14b8a6', '📏', 55,  0),
  ('Taşeron',         'taseron',     'Dış firma — sadece kendi işi',                   '#6b7280', '🤝', 30,  0);
```

### Varsayılan Rol İzin Atamaları

```javascript
// server/db/seedRolIzinleri.js
// Bu dosya ilk kurulumda veya migration sırasında çalıştırılır

const { getDb } = require('./database');

function seedRolIzinleri() {
  const db = getDb();

  // Yardımcı: Modül+aksiyon çiftinden izin ID'sini bul
  function izinId(modul, aksiyon) {
    const row = db.prepare('SELECT id FROM izinler WHERE modul = ? AND aksiyon = ?').get(modul, aksiyon);
    return row?.id;
  }

  function rolId(kod) {
    const row = db.prepare('SELECT id FROM roller WHERE rol_kodu = ?').get(kod);
    return row?.id;
  }

  // Yardımcı: Bir role izin ata
  function ata(rolKodu, modul, aksiyon, kapsam = 'tum') {
    const rId = rolId(rolKodu);
    const iId = izinId(modul, aksiyon);
    if (rId && iId) {
      db.prepare(`
        INSERT OR IGNORE INTO rol_izinleri (rol_id, izin_id, veri_kapsami)
        VALUES (?, ?, ?)
      `).run(rId, iId, kapsam);
    }
  }

  // ─── PATRON — HER ŞEY ──────────────────────────
  const patronIzinler = db.prepare('SELECT id FROM izinler').all();
  const pId = rolId('patron');
  for (const izin of patronIzinler) {
    db.prepare('INSERT OR IGNORE INTO rol_izinleri (rol_id, izin_id, veri_kapsami) VALUES (?, ?, ?)')
      .run(pId, izin.id, 'tum');
  }

  // ─── KOORDİNATÖR ─────────────────────────────────
  // Projeler: tam
  ata('koordinator', 'projeler', 'okuma');
  ata('koordinator', 'projeler', 'yazma');
  ata('koordinator', 'projeler', 'silme');
  ata('koordinator', 'projeler', 'onaylama');
  // Döngü: tam
  ata('koordinator', 'dongu', 'okuma');
  ata('koordinator', 'dongu', 'yazma');
  ata('koordinator', 'dongu', 'sablon');
  // Ekipler: tam
  ata('koordinator', 'ekipler', 'okuma');
  ata('koordinator', 'ekipler', 'yazma');
  ata('koordinator', 'ekipler', 'silme');
  // Personel: tam
  ata('koordinator', 'personel', 'okuma');
  ata('koordinator', 'personel', 'yazma');
  ata('koordinator', 'personel', 'silme');
  // Veri Paketi: tam + onay
  ata('koordinator', 'veri_paketi', 'okuma');
  ata('koordinator', 'veri_paketi', 'yazma');
  ata('koordinator', 'veri_paketi', 'silme');
  ata('koordinator', 'veri_paketi', 'onaylama');
  // Dosyalar: tam
  ata('koordinator', 'dosyalar', 'okuma');
  ata('koordinator', 'dosyalar', 'yazma');
  ata('koordinator', 'dosyalar', 'silme');
  // Saha: tam
  ata('koordinator', 'saha_harita', 'okuma');
  ata('koordinator', 'saha_harita', 'yazma');
  ata('koordinator', 'saha_mesaj', 'okuma');
  ata('koordinator', 'saha_mesaj', 'yazma');
  ata('koordinator', 'saha_mesaj', 'onaylama');
  // Malzeme: tam
  ata('koordinator', 'malzeme', 'okuma');
  ata('koordinator', 'malzeme', 'yazma');
  ata('koordinator', 'malzeme', 'silme');
  ata('koordinator', 'malzeme', 'talep');
  ata('koordinator', 'malzeme', 'onaylama');
  // Finansal: okuma
  ata('koordinator', 'finansal', 'okuma');
  // İSG: okuma
  ata('koordinator', 'isg', 'okuma');
  // Raporlar: genel
  ata('koordinator', 'raporlar', 'genel');
  // Ayarlar: Telegram/AI + döngü
  ata('koordinator', 'ayarlar', 'telegram');
  ata('koordinator', 'ayarlar', 'dongu');

  // ─── ŞANTİYE ŞEFİ ─────────────────────────────
  ata('santiye_sefi', 'projeler', 'okuma', 'kendi_santiye');
  ata('santiye_sefi', 'projeler', 'yazma', 'kendi_santiye');
  ata('santiye_sefi', 'dongu', 'okuma', 'kendi_santiye');
  ata('santiye_sefi', 'dongu', 'yazma', 'kendi_santiye');
  ata('santiye_sefi', 'ekipler', 'okuma', 'kendi_santiye');
  ata('santiye_sefi', 'ekipler', 'yazma', 'kendi_santiye');
  ata('santiye_sefi', 'personel', 'okuma', 'kendi_santiye');
  ata('santiye_sefi', 'veri_paketi', 'okuma', 'kendi_santiye');
  ata('santiye_sefi', 'veri_paketi', 'yazma', 'kendi_santiye');
  ata('santiye_sefi', 'dosyalar', 'okuma', 'kendi_santiye');
  ata('santiye_sefi', 'dosyalar', 'yazma', 'kendi_santiye');
  ata('santiye_sefi', 'dosyalar', 'silme', 'kendi_santiye');
  ata('santiye_sefi', 'saha_harita', 'okuma');
  ata('santiye_sefi', 'saha_harita', 'yazma', 'kendi_santiye');
  ata('santiye_sefi', 'saha_mesaj', 'okuma', 'kendi_santiye');
  ata('santiye_sefi', 'malzeme', 'okuma');
  ata('santiye_sefi', 'malzeme', 'talep');
  ata('santiye_sefi', 'raporlar', 'genel');

  // ─── SAHA MÜHENDİSİ ────────────────────────────
  ata('saha_muhendis', 'projeler', 'okuma');
  ata('saha_muhendis', 'dongu', 'okuma');
  ata('saha_muhendis', 'ekipler', 'okuma');
  ata('saha_muhendis', 'personel', 'okuma');
  ata('saha_muhendis', 'veri_paketi', 'okuma');
  ata('saha_muhendis', 'veri_paketi', 'yazma');
  ata('saha_muhendis', 'dosyalar', 'okuma');
  ata('saha_muhendis', 'dosyalar', 'yazma');
  ata('saha_muhendis', 'saha_harita', 'okuma');
  ata('saha_muhendis', 'saha_mesaj', 'okuma');
  ata('saha_muhendis', 'saha_mesaj', 'yazma');
  ata('saha_muhendis', 'malzeme', 'okuma');
  ata('saha_muhendis', 'malzeme', 'talep');
  ata('saha_muhendis', 'isg', 'okuma');
  ata('saha_muhendis', 'raporlar', 'genel');

  // ─── EKİP BAŞI ──────────────────────────────────
  ata('ekip_basi', 'projeler', 'okuma', 'kendi_ekip');
  ata('ekip_basi', 'dongu', 'okuma', 'kendi_ekip');
  ata('ekip_basi', 'ekipler', 'okuma', 'kendi_ekip');
  ata('ekip_basi', 'personel', 'okuma', 'kendi_ekip');
  ata('ekip_basi', 'veri_paketi', 'yazma', 'kendi_ekip');
  ata('ekip_basi', 'veri_paketi', 'okuma', 'kendi_ekip');
  ata('ekip_basi', 'dosyalar', 'yazma', 'kendi_ekip');
  ata('ekip_basi', 'dosyalar', 'okuma', 'kendi_ekip');
  ata('ekip_basi', 'saha_harita', 'okuma', 'kendi_ekip');
  ata('ekip_basi', 'saha_mesaj', 'yazma', 'kendi_ekip');
  ata('ekip_basi', 'malzeme', 'talep', 'kendi_ekip');
  ata('ekip_basi', 'malzeme', 'okuma', 'kendi_ekip');

  // ─── DEPOCU ─────────────────────────────────────
  ata('depocu', 'malzeme', 'okuma');
  ata('depocu', 'malzeme', 'yazma');
  ata('depocu', 'malzeme', 'silme');
  ata('depocu', 'malzeme', 'onaylama');
  ata('depocu', 'dosyalar', 'okuma', 'kendi');
  ata('depocu', 'dosyalar', 'yazma', 'kendi');
  ata('depocu', 'raporlar', 'depo');

  // ─── İSG UZMANI ─────────────────────────────────
  ata('isg_uzmani', 'isg', 'okuma');
  ata('isg_uzmani', 'isg', 'yazma');
  ata('isg_uzmani', 'isg', 'silme');
  ata('isg_uzmani', 'isg', 'rapor');
  ata('isg_uzmani', 'personel', 'okuma');
  ata('isg_uzmani', 'projeler', 'okuma');
  ata('isg_uzmani', 'dosyalar', 'okuma');
  ata('isg_uzmani', 'dosyalar', 'yazma');
  ata('isg_uzmani', 'saha_harita', 'okuma');
  ata('isg_uzmani', 'raporlar', 'isg');

  // ─── MUHASEBECİ ─────────────────────────────────
  ata('muhasebeci', 'finansal', 'okuma');
  ata('muhasebeci', 'finansal', 'yazma');
  ata('muhasebeci', 'finansal', 'silme');
  ata('muhasebeci', 'finansal', 'onaylama');
  ata('muhasebeci', 'projeler', 'okuma');
  ata('muhasebeci', 'personel', 'okuma');
  ata('muhasebeci', 'malzeme', 'okuma');
  ata('muhasebeci', 'dosyalar', 'okuma');
  ata('muhasebeci', 'raporlar', 'mali');

  // ─── SÜRVEYAN ───────────────────────────────────
  ata('surveyan', 'projeler', 'okuma', 'kendi_santiye');
  ata('surveyan', 'dongu', 'okuma', 'kendi_santiye');
  ata('surveyan', 'ekipler', 'okuma', 'kendi_santiye');
  ata('surveyan', 'veri_paketi', 'okuma', 'kendi_santiye');
  ata('surveyan', 'veri_paketi', 'yazma', 'kendi_santiye');
  ata('surveyan', 'dosyalar', 'okuma', 'kendi_santiye');
  ata('surveyan', 'dosyalar', 'yazma', 'kendi_santiye');
  ata('surveyan', 'saha_harita', 'okuma');
  ata('surveyan', 'saha_mesaj', 'yazma', 'kendi');
  ata('surveyan', 'malzeme', 'okuma');

  // ─── TAŞERON ────────────────────────────────────
  ata('taseron', 'projeler', 'okuma', 'kendi');
  ata('taseron', 'veri_paketi', 'yazma', 'kendi');
  ata('taseron', 'veri_paketi', 'okuma', 'kendi');
  ata('taseron', 'dosyalar', 'yazma', 'kendi');
  ata('taseron', 'dosyalar', 'okuma', 'kendi');
  ata('taseron', 'saha_mesaj', 'yazma', 'kendi');

  console.log('✅ Rol izinleri seed edildi');
}

module.exports = { seedRolIzinleri };
```

---

## Adım 3 — Yetki Servisi (Backend)

### `server/services/yetkilendirmeService.js`

```javascript
const { getDb } = require('../db/database');

class YetkilendirmeService {

  /**
   * Kullanıcının tüm izinlerini getir (tüm rollerinden birleştirilmiş)
   * Bu sonuç cache'lenebilir (session'da veya bellekte)
   */
  kullaniciIzinleri(kullaniciId) {
    const db = getDb();
    return db.prepare(`
      SELECT DISTINCT
        i.modul,
        i.aksiyon,
        ri.veri_kapsami
      FROM kullanici_rolleri kr
      JOIN rol_izinleri ri ON kr.rol_id = ri.rol_id
      JOIN izinler i ON ri.izin_id = i.id
      JOIN roller r ON kr.rol_id = r.id
      WHERE kr.kullanici_id = ? AND r.durum = 'aktif'
    `).all(kullaniciId);
  }

  /**
   * Kullanıcının rollerini getir
   */
  kullaniciRolleri(kullaniciId) {
    const db = getDb();
    return db.prepare(`
      SELECT r.* FROM roller r
      JOIN kullanici_rolleri kr ON r.id = kr.rol_id
      WHERE kr.kullanici_id = ? AND r.durum = 'aktif'
      ORDER BY r.seviye DESC
    `).all(kullaniciId);
  }

  /**
   * Kullanıcının belirli bir izne sahip olup olmadığını kontrol et
   * @returns { izinVar: boolean, kapsam: string }
   */
  izinKontrol(kullaniciId, modul, aksiyon) {
    const db = getDb();

    // "tam" aksiyonu tüm aksiyonları kapsar
    const izin = db.prepare(`
      SELECT ri.veri_kapsami FROM kullanici_rolleri kr
      JOIN rol_izinleri ri ON kr.rol_id = ri.rol_id
      JOIN izinler i ON ri.izin_id = i.id
      JOIN roller r ON kr.rol_id = r.id
      WHERE kr.kullanici_id = ?
        AND r.durum = 'aktif'
        AND i.modul = ?
        AND (i.aksiyon = ? OR i.aksiyon = 'tam')
      ORDER BY
        CASE ri.veri_kapsami
          WHEN 'tum' THEN 1
          WHEN 'kendi_santiye' THEN 2
          WHEN 'kendi_ekip' THEN 3
          WHEN 'kendi' THEN 4
        END
      LIMIT 1
    `).get(kullaniciId, modul, aksiyon);

    return {
      izinVar: !!izin,
      kapsam: izin?.veri_kapsami || null,
    };
  }

  /**
   * Kullanıcının tüm izinlerini yapılandırılmış nesne olarak döndür
   * Frontend'e gönderilir
   */
  izinHaritasi(kullaniciId) {
    const izinler = this.kullaniciIzinleri(kullaniciId);
    const harita = {};

    for (const izin of izinler) {
      if (!harita[izin.modul]) harita[izin.modul] = {};

      // En geniş kapsam kazanır
      const mevcutKapsam = harita[izin.modul][izin.aksiyon];
      if (!mevcutKapsam || kapsamOncelik(izin.veri_kapsami) < kapsamOncelik(mevcutKapsam)) {
        harita[izin.modul][izin.aksiyon] = izin.veri_kapsami;
      }
    }

    return harita;
  }

  /**
   * Kullanıcının en yüksek rol seviyesini döndür
   */
  enYuksekSeviye(kullaniciId) {
    const db = getDb();
    const row = db.prepare(`
      SELECT MAX(r.seviye) as max_seviye FROM roller r
      JOIN kullanici_rolleri kr ON r.id = kr.rol_id
      WHERE kr.kullanici_id = ? AND r.durum = 'aktif'
    `).get(kullaniciId);
    return row?.max_seviye || 0;
  }
}

// Kapsam önceliği: düşük sayı = geniş kapsam (kazanır)
function kapsamOncelik(kapsam) {
  const oncelikler = { tum: 1, kendi_santiye: 2, kendi_ekip: 3, kendi: 4 };
  return oncelikler[kapsam] || 5;
}

module.exports = new YetkilendirmeService();
```

---

## Adım 4 — Auth Middleware

### `server/middleware/auth.js`

```javascript
const jwt = require('jsonwebtoken');
const yetkilendirmeService = require('../services/yetkilendirmeService');

const JWT_SECRET = process.env.JWT_SECRET || 'elektratrack-gizli-anahtar-degistir';

/**
 * JWT token kontrolü — her istekte çalışır
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Yetkilendirme gerekli' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.kullanici = decoded;   // { id, kullanici_adi, ad_soyad, ekip_id }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Geçersiz veya süresi dolmuş token' });
  }
}

/**
 * İzin kontrolü middleware'i
 * Kullanım: izinGerekli('projeler', 'yazma')
 *
 * @param {string} modul - Modül adı
 * @param {string} aksiyon - Aksiyon adı
 * @returns Express middleware
 */
function izinGerekli(modul, aksiyon) {
  return (req, res, next) => {
    const { izinVar, kapsam } = yetkilendirmeService.izinKontrol(
      req.kullanici.id, modul, aksiyon
    );

    if (!izinVar) {
      return res.status(403).json({
        success: false,
        error: 'Bu işlem için yetkiniz yok',
        gerekli_izin: `${modul}:${aksiyon}`
      });
    }

    // Kapsamı request'e ekle — route handler'da kullanılır
    req.izinKapsami = kapsam;
    next();
  };
}

/**
 * Veri kapsam filtresi oluştur
 * Route handler'da WHERE koşullarına eklenir
 *
 * Kullanım:
 *   const { where, params } = kapsamFiltresi(req, 'p.ekip_id', 'p.olusturan_id');
 *   db.prepare(`SELECT * FROM projeler p WHERE ${where}`).all(...params);
 */
function kapsamFiltresi(req, ekipSutunu = null, olusturanSutunu = null) {
  const kapsam = req.izinKapsami;
  const kullanici = req.kullanici;

  switch (kapsam) {
    case 'tum':
      return { where: '1=1', params: [] };

    case 'kendi_santiye':
      // Şantiye şefi: kendi şantiyesindeki projelerle ilişkili
      // Bu genelde projenin sorumlu ekipleri üzerinden filtrelenir
      if (ekipSutunu) {
        return {
          where: `${ekipSutunu} IN (SELECT id FROM ekipler WHERE santiye_id = (SELECT santiye_id FROM kullanicilar WHERE id = ?))`,
          params: [kullanici.id]
        };
      }
      return { where: '1=1', params: [] };

    case 'kendi_ekip':
      if (ekipSutunu && kullanici.ekip_id) {
        return { where: `${ekipSutunu} = ?`, params: [kullanici.ekip_id] };
      }
      return { where: '1=0', params: [] }; // Ekip yoksa hiç gösterme

    case 'kendi':
      if (olusturanSutunu) {
        return { where: `${olusturanSutunu} = ?`, params: [kullanici.id] };
      }
      return { where: '1=0', params: [] };

    default:
      return { where: '1=0', params: [] };
  }
}

module.exports = { authMiddleware, izinGerekli, kapsamFiltresi, JWT_SECRET };
```

### Mevcut Route'lara Uygulanması (Örnek)

```javascript
const { authMiddleware, izinGerekli, kapsamFiltresi } = require('../middleware/auth');

// Tüm route'lara auth ekle
router.use(authMiddleware);

// ─── Projeler ─────────────────────────────────────
// Proje listeleme (kapsam filtreli)
router.get('/',
  izinGerekli('projeler', 'okuma'),
  (req, res) => {
    const db = getDb();
    const { where, params } = kapsamFiltresi(req, 'p.ekip_id', 'p.olusturan_id');

    const projeler = db.prepare(`
      SELECT p.* FROM projeler p WHERE ${where}
      ORDER BY p.olusturma_tarihi DESC
    `).all(...params);

    res.json({ success: true, data: projeler });
  }
);

// Proje oluşturma
router.post('/',
  izinGerekli('projeler', 'yazma'),
  (req, res) => { /* ... */ }
);

// Proje silme
router.delete('/:id',
  izinGerekli('projeler', 'silme'),
  (req, res) => { /* ... */ }
);

// Veri paketi onaylama
router.put('/:id/onayla',
  izinGerekli('veri_paketi', 'onaylama'),
  (req, res) => { /* ... */ }
);
```

---

## Adım 5 — Auth API (Login/Register)

### `server/routes/auth.js`

```javascript
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');
const { JWT_SECRET, authMiddleware } = require('../middleware/auth');
const yetkilendirmeService = require('../services/yetkilendirmeService');

// ─── LOGIN ────────────────────────────────────────
router.post('/giris', async (req, res) => {
  try {
    const db = getDb();
    const { kullanici_adi, sifre } = req.body;

    const kullanici = db.prepare(
      "SELECT * FROM kullanicilar WHERE kullanici_adi = ? AND durum = 'aktif'"
    ).get(kullanici_adi);

    if (!kullanici) {
      return res.status(401).json({ success: false, error: 'Geçersiz kullanıcı adı veya şifre' });
    }

    const sifreGecerli = await bcrypt.compare(sifre, kullanici.sifre_hash);
    if (!sifreGecerli) {
      // Başarısız giriş sayısını artır
      db.prepare('UPDATE kullanicilar SET basarisiz_giris_sayisi = basarisiz_giris_sayisi + 1 WHERE id = ?')
        .run(kullanici.id);
      return res.status(401).json({ success: false, error: 'Geçersiz kullanıcı adı veya şifre' });
    }

    // Başarılı giriş
    db.prepare("UPDATE kullanicilar SET son_giris = datetime('now'), basarisiz_giris_sayisi = 0 WHERE id = ?")
      .run(kullanici.id);

    // Rolleri getir
    const roller = yetkilendirmeService.kullaniciRolleri(kullanici.id);
    const izinHaritasi = yetkilendirmeService.izinHaritasi(kullanici.id);

    // JWT oluştur
    const token = jwt.sign(
      {
        id: kullanici.id,
        kullanici_adi: kullanici.kullanici_adi,
        ad_soyad: kullanici.ad_soyad,
        ekip_id: kullanici.ekip_id,
        personel_id: kullanici.personel_id,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      data: {
        token,
        kullanici: {
          id: kullanici.id,
          kullanici_adi: kullanici.kullanici_adi,
          ad_soyad: kullanici.ad_soyad,
          email: kullanici.email,
          avatar_yolu: kullanici.avatar_yolu,
          roller: roller.map(r => ({ id: r.id, adi: r.rol_adi, kodu: r.rol_kodu, ikon: r.ikon, renk: r.renk })),
          izinler: izinHaritasi,
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── PROFİL (giriş yapmış kullanıcı) ──────────────
router.get('/profil', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const kullanici = db.prepare('SELECT * FROM kullanicilar WHERE id = ?').get(req.kullanici.id);
    const roller = yetkilendirmeService.kullaniciRolleri(req.kullanici.id);
    const izinHaritasi = yetkilendirmeService.izinHaritasi(req.kullanici.id);

    res.json({
      success: true,
      data: {
        kullanici: {
          id: kullanici.id,
          kullanici_adi: kullanici.kullanici_adi,
          ad_soyad: kullanici.ad_soyad,
          email: kullanici.email,
          roller: roller.map(r => ({ id: r.id, adi: r.rol_adi, kodu: r.rol_kodu, ikon: r.ikon })),
          izinler: izinHaritasi,
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── ŞİFRE DEĞİŞTİRME ────────────────────────────
router.put('/sifre-degistir', authMiddleware, async (req, res) => {
  try {
    const { mevcut_sifre, yeni_sifre } = req.body;
    const db = getDb();

    const kullanici = db.prepare('SELECT sifre_hash FROM kullanicilar WHERE id = ?').get(req.kullanici.id);
    const gecerli = await bcrypt.compare(mevcut_sifre, kullanici.sifre_hash);
    if (!gecerli) {
      return res.status(400).json({ success: false, error: 'Mevcut şifre yanlış' });
    }

    const yeniHash = await bcrypt.hash(yeni_sifre, 10);
    db.prepare("UPDATE kullanicilar SET sifre_hash = ?, guncelleme_tarihi = datetime('now') WHERE id = ?")
      .run(yeniHash, req.kullanici.id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

### Paket Kurulumları

```bash
cd server
npm install bcrypt jsonwebtoken
```

### Route Kaydı

```javascript
// server/server.js'e ekle
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);
```

---

## Adım 6 — Rol ve Kullanıcı Yönetim API

### `server/routes/rolYonetimi.js`

```javascript
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { getDb } = require('../db/database');
const { authMiddleware, izinGerekli } = require('../middleware/auth');
const yetkilendirmeService = require('../services/yetkilendirmeService');

router.use(authMiddleware);

// ═══════════════════════════════════════════════
// ROL YÖNETİMİ
// ═══════════════════════════════════════════════

// GET /api/yonetim/roller — Tüm roller (izinleriyle)
router.get('/roller',
  izinGerekli('ayarlar', 'roller'),
  (req, res) => {
    try {
      const db = getDb();
      const roller = db.prepare("SELECT * FROM roller WHERE durum = 'aktif' ORDER BY seviye DESC").all();

      // Her rolün izinlerini ekle
      const stmt = db.prepare(`
        SELECT i.modul, i.aksiyon, i.modul_etiketi, i.aksiyon_etiketi, ri.veri_kapsami
        FROM rol_izinleri ri
        JOIN izinler i ON ri.izin_id = i.id
        WHERE ri.rol_id = ?
        ORDER BY i.modul, i.aksiyon
      `);

      const sonuc = roller.map(r => ({
        ...r,
        izinler: stmt.all(r.id),
        kullanici_sayisi: db.prepare('SELECT COUNT(*) as sayi FROM kullanici_rolleri WHERE rol_id = ?').get(r.id).sayi,
      }));

      res.json({ success: true, data: sonuc });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// GET /api/yonetim/izinler — Tüm izin tanımları (modül bazlı gruplu)
router.get('/izinler',
  izinGerekli('ayarlar', 'roller'),
  (req, res) => {
    try {
      const db = getDb();
      const izinler = db.prepare('SELECT * FROM izinler ORDER BY modul, aksiyon').all();

      // Modül bazlı grupla
      const gruplu = {};
      for (const izin of izinler) {
        if (!gruplu[izin.modul]) {
          gruplu[izin.modul] = { modul: izin.modul, etiket: izin.modul_etiketi, aksiyonlar: [] };
        }
        gruplu[izin.modul].aksiyonlar.push({
          id: izin.id,
          aksiyon: izin.aksiyon,
          etiket: izin.aksiyon_etiketi,
          aciklama: izin.aciklama,
        });
      }

      res.json({ success: true, data: Object.values(gruplu) });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// POST /api/yonetim/roller — Yeni rol oluştur
router.post('/roller',
  izinGerekli('ayarlar', 'roller'),
  (req, res) => {
    try {
      const db = getDb();
      const { rol_adi, rol_kodu, aciklama, renk, ikon, seviye, izinler } = req.body;

      // Çağıran kullanıcının seviyesinden yüksek rol oluşturulmasını engelle
      const cagiranSeviye = yetkilendirmeService.enYuksekSeviye(req.kullanici.id);
      if ((seviye || 50) >= cagiranSeviye) {
        return res.status(403).json({ success: false, error: 'Kendinizden yüksek seviyeli rol oluşturulamaz' });
      }

      const result = db.prepare(`
        INSERT INTO roller (rol_adi, rol_kodu, aciklama, renk, ikon, seviye, olusturan_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(rol_adi, rol_kodu, aciklama, renk || '#6b7280', ikon || '👤', seviye || 50, req.kullanici.id);

      const rolId = result.lastInsertRowid;

      // İzinleri ata
      if (izinler && izinler.length > 0) {
        const stmt = db.prepare('INSERT INTO rol_izinleri (rol_id, izin_id, veri_kapsami) VALUES (?, ?, ?)');
        for (const izin of izinler) {
          stmt.run(rolId, izin.izin_id, izin.kapsam || 'tum');
        }
      }

      res.json({ success: true, data: { id: rolId } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// PUT /api/yonetim/roller/:id — Rol güncelle
router.put('/roller/:id',
  izinGerekli('ayarlar', 'roller'),
  (req, res) => {
    try {
      const db = getDb();
      const rolId = parseInt(req.params.id);
      const { rol_adi, aciklama, renk, ikon, seviye, izinler } = req.body;

      // Sistem rolünün kodunu değiştirmeye izin verme
      const rol = db.prepare('SELECT * FROM roller WHERE id = ?').get(rolId);
      if (!rol) return res.status(404).json({ success: false, error: 'Rol bulunamadı' });

      // Rol bilgilerini güncelle
      db.prepare(`
        UPDATE roller SET
          rol_adi = COALESCE(?, rol_adi),
          aciklama = COALESCE(?, aciklama),
          renk = COALESCE(?, renk),
          ikon = COALESCE(?, ikon),
          seviye = COALESCE(?, seviye),
          guncelleme_tarihi = datetime('now')
        WHERE id = ?
      `).run(rol_adi, aciklama, renk, ikon, seviye, rolId);

      // İzinleri güncelle (varsa) — sil + yeniden oluştur
      if (izinler) {
        db.prepare('DELETE FROM rol_izinleri WHERE rol_id = ?').run(rolId);
        const stmt = db.prepare('INSERT INTO rol_izinleri (rol_id, izin_id, veri_kapsami) VALUES (?, ?, ?)');
        for (const izin of izinler) {
          stmt.run(rolId, izin.izin_id, izin.kapsam || 'tum');
        }
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// DELETE /api/yonetim/roller/:id — Rol sil
router.delete('/roller/:id',
  izinGerekli('ayarlar', 'roller'),
  (req, res) => {
    try {
      const db = getDb();
      const rol = db.prepare('SELECT * FROM roller WHERE id = ?').get(req.params.id);

      if (!rol) return res.status(404).json({ success: false, error: 'Rol bulunamadı' });
      if (rol.sistem_rolu) return res.status(403).json({ success: false, error: 'Sistem rolü silinemez' });

      // Kullanıcısı olan rol silinemez
      const kullaniciSayisi = db.prepare('SELECT COUNT(*) as s FROM kullanici_rolleri WHERE rol_id = ?').get(rol.id).s;
      if (kullaniciSayisi > 0) {
        return res.status(400).json({ success: false, error: `Bu role ${kullaniciSayisi} kullanıcı atanmış. Önce rol atamasını kaldırın.` });
      }

      db.prepare("UPDATE roller SET durum = 'pasif' WHERE id = ?").run(rol.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════
// KULLANICI YÖNETİMİ
// ═══════════════════════════════════════════════

// GET /api/yonetim/kullanicilar — Tüm kullanıcılar
router.get('/kullanicilar',
  izinGerekli('ayarlar', 'kullanicilar'),
  (req, res) => {
    try {
      const db = getDb();
      const kullanicilar = db.prepare(`
        SELECT
          k.id, k.kullanici_adi, k.ad_soyad, k.email, k.telefon,
          k.durum, k.son_giris, k.olusturma_tarihi,
          p.ad_soyad as personel_adi,
          e.ekip_adi, e.ekip_kodu
        FROM kullanicilar k
        LEFT JOIN personel p ON k.personel_id = p.id
        LEFT JOIN ekipler e ON k.ekip_id = e.id
        WHERE k.durum != 'silindi'
        ORDER BY k.ad_soyad
      `).all();

      // Her kullanıcının rollerini ekle
      const rolStmt = db.prepare(`
        SELECT r.id, r.rol_adi, r.rol_kodu, r.ikon, r.renk
        FROM roller r
        JOIN kullanici_rolleri kr ON r.id = kr.rol_id
        WHERE kr.kullanici_id = ?
      `);

      const sonuc = kullanicilar.map(k => ({
        ...k,
        roller: rolStmt.all(k.id),
      }));

      res.json({ success: true, data: sonuc });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// POST /api/yonetim/kullanicilar — Yeni kullanıcı oluştur
router.post('/kullanicilar',
  izinGerekli('ayarlar', 'kullanicilar'),
  async (req, res) => {
    try {
      const db = getDb();
      const { kullanici_adi, sifre, ad_soyad, email, telefon, personel_id, ekip_id, rol_idler } = req.body;

      const sifreHash = await bcrypt.hash(sifre, 10);

      const result = db.prepare(`
        INSERT INTO kullanicilar (kullanici_adi, sifre_hash, ad_soyad, email, telefon, personel_id, ekip_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(kullanici_adi, sifreHash, ad_soyad, email, telefon, personel_id, ekip_id);

      const kullaniciId = result.lastInsertRowid;

      // Rolleri ata
      if (rol_idler && rol_idler.length > 0) {
        const stmt = db.prepare('INSERT INTO kullanici_rolleri (kullanici_id, rol_id, atayan_id) VALUES (?, ?, ?)');
        for (const rolId of rol_idler) {
          stmt.run(kullaniciId, rolId, req.kullanici.id);
        }
      }

      res.json({ success: true, data: { id: kullaniciId } });
    } catch (error) {
      if (error.message.includes('UNIQUE')) {
        return res.status(400).json({ success: false, error: 'Bu kullanıcı adı zaten kullanılıyor' });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// PUT /api/yonetim/kullanicilar/:id/roller — Kullanıcıya rol ata/güncelle
router.put('/kullanicilar/:id/roller',
  izinGerekli('ayarlar', 'kullanicilar'),
  (req, res) => {
    try {
      const db = getDb();
      const kullaniciId = parseInt(req.params.id);
      const { rol_idler } = req.body;

      // Mevcut rolleri sil
      db.prepare('DELETE FROM kullanici_rolleri WHERE kullanici_id = ?').run(kullaniciId);

      // Yeni rolleri ata
      if (rol_idler && rol_idler.length > 0) {
        const stmt = db.prepare('INSERT INTO kullanici_rolleri (kullanici_id, rol_id, atayan_id) VALUES (?, ?, ?)');
        for (const rolId of rol_idler) {
          stmt.run(kullaniciId, rolId, req.kullanici.id);
        }
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

module.exports = router;
```

### Route Kaydı

```javascript
// server/server.js
const rolYonetimRoutes = require('./routes/rolYonetimi');
app.use('/api/yonetim', rolYonetimRoutes);
```

---

## Adım 7 — Frontend: İzin Kontrolü

### `client/src/hooks/useIzin.js`

```javascript
import { useCallback } from 'react';

/**
 * Kullanıcının izinlerini kontrol eden hook
 *
 * Kullanım:
 *   const { izinVar, izinKapsam } = useIzin();
 *   if (izinVar('projeler', 'yazma')) { ... }
 */
export function useIzin() {
  // Login sonrası localStorage veya context'te saklanan izin haritası
  const kullanici = JSON.parse(localStorage.getItem('kullanici') || '{}');
  const izinler = kullanici.izinler || {};

  const izinVar = useCallback((modul, aksiyon) => {
    if (!izinler[modul]) return false;
    // 'tam' aksiyonu tüm aksiyonları kapsar
    return !!(izinler[modul][aksiyon] || izinler[modul]['tam']);
  }, [izinler]);

  const izinKapsam = useCallback((modul, aksiyon) => {
    if (!izinler[modul]) return null;
    return izinler[modul][aksiyon] || izinler[modul]['tam'] || null;
  }, [izinler]);

  return { izinVar, izinKapsam, izinler, kullanici };
}
```

### Sidebar Menü Filtreleme

```jsx
import { useIzin } from '../hooks/useIzin';

function Sidebar() {
  const { izinVar } = useIzin();

  const menuItems = [
    { label: 'Dashboard',        path: '/',             icon: '🏠', her_zaman: true },
    { label: 'Projeler',         path: '/projeler',     icon: '📁', modul: 'projeler',    aksiyon: 'okuma' },
    { label: 'Ekipler',          path: '/ekipler',      icon: '👥', modul: 'ekipler',     aksiyon: 'okuma' },
    { label: 'Personel',         path: '/personel',     icon: '👤', modul: 'personel',    aksiyon: 'okuma' },
    { label: 'Veri Paketleri',   path: '/veri-paketi',  icon: '📦', modul: 'veri_paketi', aksiyon: 'okuma' },
    { label: 'Saha',             path: '/saha',         icon: '🗺️', modul: 'saha_harita', aksiyon: 'okuma' },
    { label: 'Saha Mesaj',       path: '/saha-mesaj',   icon: '💬', modul: 'saha_mesaj',  aksiyon: 'yazma' },
    { label: 'Malzeme/Depo',     path: '/malzeme',      icon: '📦', modul: 'malzeme',     aksiyon: 'okuma' },
    { label: 'Finansal',         path: '/finansal',     icon: '💰', modul: 'finansal',    aksiyon: 'okuma' },
    { label: 'İSG',              path: '/isg',          icon: '🛡️', modul: 'isg',         aksiyon: 'okuma' },
    { label: 'Raporlar',         path: '/raporlar',     icon: '📊', modul: 'raporlar',    aksiyon: 'genel' },
    { label: 'Ayarlar',          path: '/ayarlar',      icon: '⚙️', modul: 'ayarlar',     aksiyon: 'genel' },
  ];

  // Sadece yetkisi olan menü öğelerini göster
  const gorunurMenu = menuItems.filter(item =>
    item.her_zaman || izinVar(item.modul, item.aksiyon)
  );

  return (
    <nav>
      {gorunurMenu.map(item => (
        <a key={item.path} href={item.path}>
          {item.icon} {item.label}
        </a>
      ))}
    </nav>
  );
}
```

### Buton Seviyesinde İzin Kontrolü

```jsx
import { useIzin } from '../hooks/useIzin';

function ProjeDetay({ proje }) {
  const { izinVar } = useIzin();

  return (
    <div>
      <h1>{proje.proje_adi}</h1>

      {/* Sadece yazma yetkisi varsa düzenleme butonu göster */}
      {izinVar('projeler', 'yazma') && (
        <button>✏️ Düzenle</button>
      )}

      {/* Sadece silme yetkisi varsa silme butonu göster */}
      {izinVar('projeler', 'silme') && (
        <button>🗑️ Sil</button>
      )}

      {/* Sadece onaylama yetkisi varsa onay butonu göster */}
      {izinVar('veri_paketi', 'onaylama') && (
        <button>✅ Onayla</button>
      )}
    </div>
  );
}
```

---

## İlk Kullanıcı Oluşturma

Sistem ilk kurulumda patron kullanıcısı oluşturmalı:

```javascript
// server/db/seedIlkKullanici.js
const bcrypt = require('bcrypt');

async function seedIlkKullanici() {
  const db = getDb();

  // Kullanıcı var mı kontrol et
  const mevcut = db.prepare('SELECT COUNT(*) as sayi FROM kullanicilar').get();
  if (mevcut.sayi > 0) return;

  // İlk patron kullanıcısı
  const sifreHash = await bcrypt.hash('admin123', 10);  // ← İlk girişte değiştirilmeli

  const result = db.prepare(`
    INSERT INTO kullanicilar (kullanici_adi, sifre_hash, ad_soyad, email)
    VALUES ('admin', ?, 'Sistem Yöneticisi', 'admin@firma.com')
  `).run(sifreHash);

  // Patron rolünü ata
  const patronRol = db.prepare("SELECT id FROM roller WHERE rol_kodu = 'patron'").get();
  if (patronRol) {
    db.prepare('INSERT INTO kullanici_rolleri (kullanici_id, rol_id) VALUES (?, ?)')
      .run(result.lastInsertRowid, patronRol.id);
  }

  console.log('✅ İlk kullanıcı oluşturuldu: admin / admin123');
  console.log('⚠️ Lütfen ilk girişte şifreyi değiştirin!');
}

module.exports = { seedIlkKullanici };
```

---

## Kontrol Listesi

**Paketler:**
- [ ] `npm install bcrypt jsonwebtoken` — server'da çalıştırıldı

**Veritabanı:**
- [ ] `roller` tablosu oluşturuldu
- [ ] `izinler` tablosu oluşturuldu
- [ ] `rol_izinleri` tablosu oluşturuldu
- [ ] `kullanicilar` tablosu oluşturuldu
- [ ] `kullanici_rolleri` tablosu oluşturuldu
- [ ] İzin tanımları seed edildi (tüm modül:aksiyon çiftleri)
- [ ] 10 varsayılan rol seed edildi
- [ ] Varsayılan rol izin atamaları seed edildi
- [ ] İlk patron kullanıcısı oluşturuldu (admin/admin123)

**Backend — Auth:**
- [ ] `POST /api/auth/giris` → Login + JWT token dönüyor
- [ ] `GET /api/auth/profil` → Token ile kullanıcı bilgisi + izin haritası
- [ ] `PUT /api/auth/sifre-degistir` → Şifre değiştirme

**Backend — Middleware:**
- [ ] `authMiddleware` → JWT kontrolü çalışıyor
- [ ] `izinGerekli('projeler','yazma')` → İzin yoksa 403 dönüyor
- [ ] `kapsamFiltresi()` → Veri kapsamına göre WHERE üretiyor

**Backend — Rol Yönetimi:**
- [ ] `GET /api/yonetim/roller` → Roller izinleriyle birlikte dönüyor
- [ ] `GET /api/yonetim/izinler` → Tüm izin tanımları (modül gruplu)
- [ ] `POST /api/yonetim/roller` → Yeni rol + izin atama
- [ ] `PUT /api/yonetim/roller/:id` → Rol güncelleme + izin düzenleme
- [ ] `DELETE /api/yonetim/roller/:id` → Rol silme (sistem rolü silinemez)
- [ ] `POST /api/yonetim/kullanicilar` → Yeni kullanıcı oluşturma
- [ ] `PUT /api/yonetim/kullanicilar/:id/roller` → Kullanıcıya rol atama

**Frontend:**
- [ ] `useIzin()` hook'u çalışıyor
- [ ] Sidebar menüsü yetkiye göre filtreleniyor
- [ ] Butonlar yetkiye göre gösteriliyor/gizleniyor
- [ ] Login sayfası çalışıyor

**Test Senaryoları:**
- [ ] Admin (patron) ile giriş yap → Tüm menüler görünüyor
- [ ] Ekip Başı rolüyle giriş yap → Sadece yetkili menüler görünüyor
- [ ] Depocu ile proje silmeye çalış → 403 hatası dönüyor
- [ ] Yeni rol oluştur (ör: "Stajyer") → 2 izin ata → Kullanıcıya ata → Doğru çalışıyor
- [ ] Koordinatör ile veri paketi onayla → Çalışıyor
- [ ] Ekip Başı ile başka ekibin verisini görmeye çalış → Göremez (kendi_ekip kapsamı)
