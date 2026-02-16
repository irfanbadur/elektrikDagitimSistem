# ElektraTrack — AI Sohbet: Medya, Konum ve Saha Özellikleri

## Amaç

AI sohbetine fotoğraf, konum, dosya ve sesli not ekleme desteği. Saha ekiplerinin direklere, hatlara ve ekipmanlara ait verileri AI destekli olarak kaydetmesi, analiz etmesi ve takip etmesi.

**Ön koşul:** `ai-sohbet.md` ve `ai-operasyon-birlesik.md` okunmuş ve uygulanmış olmalı.

```
Saha ekibi direkte:

📷 [Fotoğraf çek] + 📍 [Konum paylaş]
"Bu direkte 4 N-95 izolatör, 7 konsol var, 2 konsol eksik"

AI: "📍 Konumunuza en yakın direk: Direk #7 (12m mesafe) — Koşu köy hattı.
     
     Fotoğraf analizi:
     ✅ N-95 izolatör: 4 adet (proje: 4 — tam)
     ⚠️ Konsol: 7 adet (proje: 9 — 2 eksik)
     
     Kayıt oluşturulsun mu?"
     [✅ Onayla]  [✏️ Düzelt]
```

---

## Temel Kararlar

| Karar | Seçim |
|-------|-------|
| Fotoğraf | Çoklu fotoğraf, AI vision analizi, dosya sistemine kayıt |
| Konum | GPS, otomatik direk eşleştirme, harita üzerinde gösterim |
| Dosya sınıflandırma | AI komutuyla klasöre kaydetme |
| Direk tespiti | Konum bazlı otomatik tahmin + kullanıcı onayı |
| Sesli not | Ses → metin → parse → aksiyon |
| Topraklama | Ölçüm değeri + fotoğraf + standart kontrolü |
| İlerleme | Günlük otomatik rapor, direk bazlı tamamlanma |

---

## Mimari

```
┌─────────────────────────────────────────────────────────────────────┐
│ Kullanıcı Girdisi                                                   │
│                                                                     │
│  📝 Metin  +  📷 Fotoğraf(lar)  +  📍 Konum  +  🎤 Sesli Not      │
└───────┬─────────────┬──────────────────┬────────────────┬───────────┘
        ↓             ↓                  ↓                ↓
   ┌─────────┐  ┌───────────┐  ┌──────────────┐  ┌──────────────┐
   │ Metin   │  │ Vision    │  │ Konum        │  │ Ses→Metin    │
   │ Parse   │  │ Analiz    │  │ Eşleştirme   │  │ (Whisper/    │
   │         │  │ (Gemini)  │  │              │  │  STT API)    │
   │         │  │           │  │ Direk tahmin │  │              │
   └────┬────┘  └─────┬─────┘  └──────┬───────┘  └──────┬───────┘
        └─────────────┼───────────────┼──────────────────┘
                      ↓               ↓
              ┌───────────────────────────────┐
              │  BİRLEŞİK BAĞLAM              │
              │                               │
              │  metin + görsel analiz +       │
              │  konum + direk bilgisi +       │
              │  proje bağlamı                 │
              └───────────────┬───────────────┘
                              ↓
                    ┌──────────────────┐
                    │  MOD TESPİTİ     │
                    │  (mevcut sistem) │
                    └───┬────────┬─────┘
                        ↓        ↓
                   [SORGU]   [KOMUT]
                              ↓
                    ┌──────────────────────────────────┐
                    │ OLASI AKSİYONLAR                 │
                    │                                  │
                    │ • direk_kayit (malzeme+durum)     │
                    │ • tespit_olustur (eksiklik)       │
                    │ • dosya_kaydet (klasöre ekle)     │
                    │ • topraklama_kaydet (ölçüm)       │
                    │ • depo_cikis (mevcut)             │
                    │ • ilerleme_guncelle (direk bazlı) │
                    │ • veri_paketi_olustur             │
                    └──────────────────────────────────┘
```

---

## Adım 1 — Veritabanı Güncellemeleri

### `ai_mesajlar` — Medya Sütunları Ekleme

```sql
-- Mevcut ai_mesajlar tablosuna sütun ekle
ALTER TABLE ai_mesajlar ADD COLUMN dosya_ids TEXT;        -- JSON: [1, 5, 12]
ALTER TABLE ai_mesajlar ADD COLUMN konum_lat REAL;
ALTER TABLE ai_mesajlar ADD COLUMN konum_lon REAL;
ALTER TABLE ai_mesajlar ADD COLUMN konum_dogruluk REAL;   -- GPS doğruluk (metre)
```

### Yeni Tablo: `direk_kayitlar` — Direk Bazlı Saha Kayıtları

```sql
CREATE TABLE IF NOT EXISTS direk_kayitlar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proje_id INTEGER NOT NULL,
    direk_no TEXT NOT NULL,                   -- 'D7', 'D12' vb.
    direk_tipi TEXT,                          -- 'N-12', 'N-14', 'demir' vb.
    konum_lat REAL,
    konum_lon REAL,

    -- MALZEME DURUMU
    malzeme_durum TEXT,                       -- JSON: { "konsol": { "mevcut": 7, "proje": 9 }, ... }

    -- TOPRAKLAMA
    topraklama_yapildi INTEGER DEFAULT 0,
    topraklama_direnc REAL,                   -- Ohm cinsinden
    topraklama_tarihi DATETIME,
    topraklama_foto_id INTEGER,

    -- DURUM
    durum TEXT DEFAULT 'bekliyor',            -- 'bekliyor', 'devam', 'tamamlandi', 'sorunlu'
    tamamlanma_yuzdesi REAL DEFAULT 0,        -- 0-100

    -- İLİŞKİLER
    son_islem_yapan_id INTEGER,
    notlar TEXT,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (proje_id) REFERENCES projeler(id),
    FOREIGN KEY (topraklama_foto_id) REFERENCES dosyalar(id),
    FOREIGN KEY (son_islem_yapan_id) REFERENCES kullanicilar(id)
);

CREATE INDEX IF NOT EXISTS idx_direk_proje ON direk_kayitlar(proje_id);
CREATE INDEX IF NOT EXISTS idx_direk_konum ON direk_kayitlar(konum_lat, konum_lon);
```

### Yeni Tablo: `direk_fotograflar` — Direk Fotoğraf Geçmişi

```sql
CREATE TABLE IF NOT EXISTS direk_fotograflar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    direk_kayit_id INTEGER NOT NULL,
    dosya_id INTEGER NOT NULL,
    foto_tipi TEXT DEFAULT 'genel',           -- 'genel', 'topraklama', 'izolatör', 'konsol', 'ariza', 'oncesi', 'sonrasi'
    ai_analiz TEXT,                           -- JSON: AI vision analiz sonucu
    notlar TEXT,
    ekleyen_id INTEGER,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (direk_kayit_id) REFERENCES direk_kayitlar(id),
    FOREIGN KEY (dosya_id) REFERENCES dosyalar(id),
    FOREIGN KEY (ekleyen_id) REFERENCES kullanicilar(id)
);
```

### Yeni Tablo: `direk_islem_gecmisi` — Değişiklik Logu

```sql
CREATE TABLE IF NOT EXISTS direk_islem_gecmisi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    direk_kayit_id INTEGER NOT NULL,
    islem_tipi TEXT NOT NULL,                 -- 'malzeme_guncelle', 'topraklama', 'durum_degisikligi', 'not_ekle', 'foto_ekle'
    eski_deger TEXT,                          -- JSON
    yeni_deger TEXT,                          -- JSON
    islem_yapan_id INTEGER,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (direk_kayit_id) REFERENCES direk_kayitlar(id),
    FOREIGN KEY (islem_yapan_id) REFERENCES kullanicilar(id)
);
```

### Yeni Tablo: `saha_tespitler` — Saha Tespit Kayıtları

```sql
CREATE TABLE IF NOT EXISTS saha_tespitler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proje_id INTEGER,
    direk_kayit_id INTEGER,                  -- Direkle ilişkiliyse
    tespit_tipi TEXT NOT NULL,               -- 'eksiklik', 'ariza', 'tehlike', 'genel', 'kesif'
    aciklama TEXT NOT NULL,
    konum_lat REAL,
    konum_lon REAL,
    oncelik TEXT DEFAULT 'normal',           -- 'dusuk', 'normal', 'yuksek', 'acil'
    durum TEXT DEFAULT 'acik',               -- 'acik', 'devam', 'cozuldu', 'iptal'
    raporlayan_id INTEGER NOT NULL,
    atanan_ekip_id INTEGER,
    cozum_tarihi DATETIME,
    cozum_notu TEXT,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (proje_id) REFERENCES projeler(id),
    FOREIGN KEY (direk_kayit_id) REFERENCES direk_kayitlar(id),
    FOREIGN KEY (raporlayan_id) REFERENCES kullanicilar(id),
    FOREIGN KEY (atanan_ekip_id) REFERENCES ekipler(id)
);

CREATE INDEX IF NOT EXISTS idx_tespit_proje ON saha_tespitler(proje_id);
CREATE INDEX IF NOT EXISTS idx_tespit_durum ON saha_tespitler(durum);
```

### Yeni Tablo: `gunluk_ilerleme` — Günlük İlerleme Kayıtları

```sql
CREATE TABLE IF NOT EXISTS gunluk_ilerleme (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proje_id INTEGER NOT NULL,
    tarih DATE NOT NULL,
    ekip_id INTEGER,

    -- ÖZET
    tamamlanan_direk_sayisi INTEGER DEFAULT 0,
    calisan_direk_ids TEXT,                  -- JSON: [5, 6, 7, 8]
    toplam_ilerleme_yuzde REAL,

    -- AI RAPOR
    ai_rapor TEXT,                           -- AI tarafından üretilen günlük özet
    ai_rapor_tarihi DATETIME,

    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (proje_id) REFERENCES projeler(id),
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id),
    UNIQUE(proje_id, tarih, ekip_id)
);
```

---

## Adım 2 — Konum Servisi: Direk Eşleştirme

### `server/services/ai/konumService.js`

```javascript
const { getDb } = require('../../db/database');

class KonumService {

  /**
   * GPS konumuna en yakın direği bul
   *
   * Haversine formülü ile mesafe hesaplar.
   * Proje bağlamı varsa sadece o projenin direklerinde arar.
   *
   * @param {number} lat
   * @param {number} lon
   * @param {number} [projeId] — Belirli projeyle sınırla
   * @param {number} [maxMesafe=50] — Metre cinsinden max mesafe
   * @returns {{ direk, mesafe, tahminGuven }} veya null
   */
  enYakinDirekBul(lat, lon, projeId = null, maxMesafe = 50) {
    const db = getDb();

    let sql = `
      SELECT dk.*,
        p.proje_no, p.musteri_adi,
        (6371000 * acos(
          cos(radians(?)) * cos(radians(dk.konum_lat)) *
          cos(radians(dk.konum_lon) - radians(?)) +
          sin(radians(?)) * sin(radians(dk.konum_lat))
        )) as mesafe_metre
      FROM direk_kayitlar dk
      JOIN projeler p ON p.id = dk.proje_id
      WHERE dk.konum_lat IS NOT NULL AND dk.konum_lon IS NOT NULL
    `;
    const params = [lat, lon, lat];

    if (projeId) {
      sql += ' AND dk.proje_id = ?';
      params.push(projeId);
    }

    sql += ' ORDER BY mesafe_metre ASC LIMIT 1';

    // SQLite'da radians/acos yok, basitleştirilmiş hesaplama kullanalım
    // Alternatif: Öklid mesafesi (küçük mesafelerde yeterli)
    const direkler = db.prepare(`
      SELECT dk.*,
        p.proje_no, p.musteri_adi
      FROM direk_kayitlar dk
      JOIN projeler p ON p.id = dk.proje_id
      WHERE dk.konum_lat IS NOT NULL AND dk.konum_lon IS NOT NULL
      ${projeId ? 'AND dk.proje_id = ?' : ''}
    `).all(projeId ? [projeId] : []);

    if (direkler.length === 0) return null;

    // Basit mesafe hesaplama (Equirectangular approximation)
    let enYakin = null;
    let enKucukMesafe = Infinity;

    for (const d of direkler) {
      const dLat = (d.konum_lat - lat) * 111320; // 1 derece ≈ 111.32 km
      const dLon = (d.konum_lon - lon) * 111320 * Math.cos(lat * Math.PI / 180);
      const mesafe = Math.sqrt(dLat * dLat + dLon * dLon);

      if (mesafe < enKucukMesafe) {
        enKucukMesafe = mesafe;
        enYakin = d;
      }
    }

    if (enKucukMesafe > maxMesafe) return null;

    // Tahmin güveni: mesafe arttıkça güven düşer
    const tahminGuven = Math.max(0, Math.min(1, 1 - (enKucukMesafe / maxMesafe)));

    return {
      direk: enYakin,
      mesafe: Math.round(enKucukMesafe * 10) / 10,
      tahminGuven: Math.round(tahminGuven * 100) / 100,
    };
  }

  /**
   * Projenin tüm direklerini konumlarıyla getir
   */
  projeDirekleriniGetir(projeId) {
    return getDb().prepare(`
      SELECT dk.*, 
        (SELECT COUNT(*) FROM direk_fotograflar df WHERE df.direk_kayit_id = dk.id) as foto_sayisi,
        (SELECT COUNT(*) FROM saha_tespitler st WHERE st.direk_kayit_id = dk.id AND st.durum = 'acik') as acik_tespit_sayisi
      FROM direk_kayitlar dk
      WHERE dk.proje_id = ?
      ORDER BY dk.direk_no
    `).all(projeId);
  }

  /**
   * Projenin genel ilerleme özeti
   */
  projeIlerlemeOzeti(projeId) {
    const db = getDb();
    const toplam = db.prepare('SELECT COUNT(*) as c FROM direk_kayitlar WHERE proje_id = ?').get(projeId);
    const tamamlanan = db.prepare("SELECT COUNT(*) as c FROM direk_kayitlar WHERE proje_id = ? AND durum = 'tamamlandi'").get(projeId);
    const sorunlu = db.prepare("SELECT COUNT(*) as c FROM direk_kayitlar WHERE proje_id = ? AND durum = 'sorunlu'").get(projeId);
    const acikTespitler = db.prepare("SELECT COUNT(*) as c FROM saha_tespitler WHERE proje_id = ? AND durum = 'acik'").get(projeId);

    return {
      toplamDirek: toplam.c,
      tamamlanan: tamamlanan.c,
      sorunlu: sorunlu.c,
      ilerlemYuzde: toplam.c > 0 ? Math.round((tamamlanan.c / toplam.c) * 100) : 0,
      acikTespitler: acikTespitler.c,
    };
  }
}

module.exports = new KonumService();
```

---

## Adım 3 — Yeni Aksiyon Tanımları

### `aksiyonlar/direkKayit.js` — Direk Malzeme/Durum Güncelleme

```javascript
const { getDb } = require('../../../db/database');
const registry = require('../aksiyonRegistry');

registry.kaydet({
  tip: 'direk_kayit', etiket: 'Direk Kayıt', ikon: '🔩',
  kategori: 'saha', riskSeviyesi: 'dusuk',
  aciklama: 'Direk üzerindeki malzeme durumunu ve notları günceller',

  dogrula(params) {
    const hatalar = [];
    if (!params.direk_kayit_id && !params.direk_no) hatalar.push('Direk belirtilmeli');
    if (!params.malzeme_durum && !params.notlar && !params.durum) hatalar.push('En az bir güncelleme olmalı');
    return { gecerli: hatalar.length === 0, hatalar };
  },

  uygula(params, context) {
    const db = getDb();

    // Direk ID bul
    let direkId = params.direk_kayit_id;
    if (!direkId && params.direk_no && params.proje_id) {
      const d = db.prepare('SELECT id FROM direk_kayitlar WHERE direk_no = ? AND proje_id = ?')
        .get(params.direk_no, params.proje_id);
      direkId = d?.id;
    }

    if (!direkId) {
      return { basarili: false, mesaj: `Direk bulunamadı: ${params.direk_no}` };
    }

    const eskiDeger = db.prepare('SELECT malzeme_durum, durum, notlar FROM direk_kayitlar WHERE id = ?').get(direkId);

    // Güncelle
    const updates = [];
    const values = [];

    if (params.malzeme_durum) {
      // Mevcut malzeme durumunu merge et
      let mevcutMalzeme = {};
      try { mevcutMalzeme = JSON.parse(eskiDeger?.malzeme_durum || '{}'); } catch {}
      const yeniMalzeme = { ...mevcutMalzeme, ...params.malzeme_durum };
      updates.push('malzeme_durum = ?');
      values.push(JSON.stringify(yeniMalzeme));

      // Tamamlanma yüzdesini hesapla
      const toplam = Object.values(yeniMalzeme).reduce((s, m) => s + (m.proje || 0), 0);
      const mevcut = Object.values(yeniMalzeme).reduce((s, m) => s + (m.mevcut || 0), 0);
      const yuzde = toplam > 0 ? Math.round((mevcut / toplam) * 100) : 0;
      updates.push('tamamlanma_yuzdesi = ?');
      values.push(yuzde);
    }

    if (params.durum) {
      updates.push('durum = ?');
      values.push(params.durum);
    }

    if (params.notlar) {
      updates.push('notlar = CASE WHEN notlar IS NULL THEN ? ELSE notlar || char(10) || ? END');
      values.push(params.notlar, params.notlar);
    }

    updates.push('son_islem_yapan_id = ?');
    values.push(context.kullaniciId);
    updates.push("guncelleme_tarihi = datetime('now')");

    db.prepare(`UPDATE direk_kayitlar SET ${updates.join(', ')} WHERE id = ?`)
      .run(...values, direkId);

    // İşlem geçmişi
    db.prepare(`
      INSERT INTO direk_islem_gecmisi (direk_kayit_id, islem_tipi, eski_deger, yeni_deger, islem_yapan_id)
      VALUES (?, 'malzeme_guncelle', ?, ?, ?)
    `).run(direkId, JSON.stringify(eskiDeger), JSON.stringify(params), context.kullaniciId);

    return {
      basarili: true,
      sonuc: { direk_kayit_id: direkId },
      mesaj: `Direk ${params.direk_no || '#' + direkId} güncellendi`,
    };
  },

  geriAl(sonuc, context) {
    // İşlem geçmişinden eski değeri geri yükle
    const db = getDb();
    const son = db.prepare(
      'SELECT * FROM direk_islem_gecmisi WHERE direk_kayit_id = ? ORDER BY id DESC LIMIT 1'
    ).get(sonuc.direk_kayit_id);
    if (son?.eski_deger) {
      const eski = JSON.parse(son.eski_deger);
      db.prepare('UPDATE direk_kayitlar SET malzeme_durum = ?, durum = ?, notlar = ? WHERE id = ?')
        .run(eski.malzeme_durum, eski.durum, eski.notlar, sonuc.direk_kayit_id);
    }
    return { basarili: true };
  },

  ozet(p) {
    const parcalar = [];
    if (p.direk_no) parcalar.push(`Direk ${p.direk_no}`);
    if (p.malzeme_durum) {
      const items = Object.entries(p.malzeme_durum).map(([k, v]) => `${k}: ${v.mevcut}/${v.proje}`);
      parcalar.push(items.join(', '));
    }
    if (p.durum) parcalar.push(`→ ${p.durum}`);
    return parcalar.join(' — ');
  },
});
```

### `aksiyonlar/tespitOlustur.js` — Saha Tespiti

```javascript
const { getDb } = require('../../../db/database');
const registry = require('../aksiyonRegistry');

registry.kaydet({
  tip: 'tespit_olustur', etiket: 'Saha Tespiti', ikon: '🔍',
  kategori: 'saha', riskSeviyesi: 'dusuk',
  aciklama: 'Eksiklik, arıza veya tehlike tespiti oluşturur',

  dogrula(params) {
    const hatalar = [];
    if (!params.aciklama) hatalar.push('Açıklama zorunlu');
    if (!params.tespit_tipi) hatalar.push('Tespit tipi belirtilmeli');
    return { gecerli: hatalar.length === 0, hatalar };
  },

  uygula(params, context) {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO saha_tespitler (proje_id, direk_kayit_id, tespit_tipi, aciklama,
        konum_lat, konum_lon, oncelik, raporlayan_id, atanan_ekip_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.proje_id, params.direk_kayit_id,
      params.tespit_tipi, params.aciklama,
      params.konum_lat, params.konum_lon,
      params.oncelik || 'normal',
      context.kullaniciId, params.ekip_id
    );

    return {
      basarili: true,
      sonuc: { tespit_id: result.lastInsertRowid },
      mesaj: `${params.tespit_tipi} tespiti oluşturuldu: ${params.aciklama.substring(0, 60)}`,
    };
  },

  geriAl(sonuc) {
    getDb().prepare("UPDATE saha_tespitler SET durum = 'iptal' WHERE id = ?").run(sonuc.tespit_id);
    return { basarili: true };
  },

  ozet(p) {
    return `${p.tespit_tipi}: ${(p.aciklama || '').substring(0, 50)}${p.direk_kayit_id ? ` (Direk #${p.direk_kayit_id})` : ''}`;
  },
});
```

### `aksiyonlar/topraklamaKaydet.js`

```javascript
const { getDb } = require('../../../db/database');
const registry = require('../aksiyonRegistry');

// Topraklama standardı: ≤ 5 ohm genel, ≤ 10 ohm zorunlu üst sınır
const STANDARD_SINIR = 5;
const UYARI_SINIR = 10;

registry.kaydet({
  tip: 'topraklama_kaydet', etiket: 'Topraklama Kaydı', ikon: '⚡',
  kategori: 'saha', riskSeviyesi: 'orta',
  aciklama: 'Direk topraklama ölçümünü kaydeder, standart kontrolü yapar',

  dogrula(params) {
    const hatalar = [];
    if (!params.direk_kayit_id && !params.direk_no) hatalar.push('Direk belirtilmeli');
    if (params.direnc === undefined || params.direnc === null) hatalar.push('Direnç değeri zorunlu');
    if (typeof params.direnc === 'number' && params.direnc < 0) hatalar.push('Direnç negatif olamaz');
    return { gecerli: hatalar.length === 0, hatalar };
  },

  uygula(params, context) {
    const db = getDb();

    let direkId = params.direk_kayit_id;
    if (!direkId && params.direk_no && params.proje_id) {
      const d = db.prepare('SELECT id FROM direk_kayitlar WHERE direk_no = ? AND proje_id = ?')
        .get(params.direk_no, params.proje_id);
      direkId = d?.id;
    }
    if (!direkId) return { basarili: false, mesaj: 'Direk bulunamadı' };

    // Topraklama güncelle
    db.prepare(`
      UPDATE direk_kayitlar SET
        topraklama_yapildi = 1,
        topraklama_direnc = ?,
        topraklama_tarihi = datetime('now'),
        topraklama_foto_id = ?,
        son_islem_yapan_id = ?,
        guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(params.direnc, params.foto_id || null, context.kullaniciId, direkId);

    // İşlem geçmişi
    db.prepare(`
      INSERT INTO direk_islem_gecmisi (direk_kayit_id, islem_tipi, yeni_deger, islem_yapan_id)
      VALUES (?, 'topraklama', ?, ?)
    `).run(direkId, JSON.stringify({ direnc: params.direnc }), context.kullaniciId);

    // Standart değerlendirmesi
    let durumMesaj;
    if (params.direnc <= STANDARD_SINIR) {
      durumMesaj = `✅ ${params.direnc} Ω — Standart sınır içinde (≤${STANDARD_SINIR}Ω)`;
    } else if (params.direnc <= UYARI_SINIR) {
      durumMesaj = `⚠️ ${params.direnc} Ω — Sınıra yakın, iyileştirme önerilir (standart: ≤${STANDARD_SINIR}Ω)`;
    } else {
      durumMesaj = `❌ ${params.direnc} Ω — Standart aşıldı! Tekrar çalışma gerekli (max: ${UYARI_SINIR}Ω)`;
    }

    return {
      basarili: true,
      sonuc: { direk_kayit_id: direkId, direnc: params.direnc },
      mesaj: `Direk ${params.direk_no || '#' + direkId} topraklama: ${durumMesaj}`,
    };
  },

  geriAl(sonuc) {
    getDb().prepare(`
      UPDATE direk_kayitlar SET topraklama_yapildi = 0, topraklama_direnc = NULL, topraklama_tarihi = NULL
      WHERE id = ?
    `).run(sonuc.direk_kayit_id);
    return { basarili: true };
  },

  ozet(p) {
    return `Topraklama: ${p.direnc}Ω${p.direk_no ? ` — Direk ${p.direk_no}` : ''}`;
  },
});
```

### `aksiyonlar/dosyaKaydet.js` — Dosyayı Belirtilen Klasöre Kaydet

```javascript
const { getDb } = require('../../../db/database');
const registry = require('../aksiyonRegistry');

registry.kaydet({
  tip: 'dosya_kaydet', etiket: 'Dosya Kaydet', ikon: '📁',
  kategori: 'dosya', riskSeviyesi: 'dusuk',
  aciklama: 'Dosyayı belirtilen klasöre/projeye kaydeder',

  dogrula(params) {
    const hatalar = [];
    if (!params.dosya_id && !params.dosya_ids) hatalar.push('Dosya belirtilmeli');
    if (!params.alan) hatalar.push('Hedef alan belirtilmeli (proje, personel, isg vb.)');
    return { gecerli: hatalar.length === 0, hatalar };
  },

  uygula(params, context) {
    const db = getDb();
    const dosyaIds = params.dosya_ids || [params.dosya_id];
    let kaydedilen = 0;

    for (const dosyaId of dosyaIds) {
      db.prepare(`
        UPDATE dosyalar SET
          alan = ?, alt_alan = ?, iliskili_id = ?,
          guncelleme_tarihi = datetime('now')
        WHERE id = ?
      `).run(params.alan, params.alt_alan || null, params.iliskili_id || null, dosyaId);
      kaydedilen++;
    }

    return {
      basarili: true,
      sonuc: { dosya_ids: dosyaIds },
      mesaj: `${kaydedilen} dosya → ${params.alan}${params.alt_alan ? '/' + params.alt_alan : ''} klasörüne kaydedildi`,
    };
  },

  geriAl() { return { basarili: true }; },

  ozet(p) {
    const sayi = p.dosya_ids?.length || 1;
    return `${sayi} dosya → ${p.alan}${p.alt_alan ? '/' + p.alt_alan : ''}`;
  },
});
```

### `aksiyonlar/ilerlemGuncelle.js` — Günlük İlerleme

```javascript
const { getDb } = require('../../../db/database');
const registry = require('../aksiyonRegistry');

registry.kaydet({
  tip: 'ilerleme_guncelle', etiket: 'İlerleme Güncelle', ikon: '📊',
  kategori: 'saha', riskSeviyesi: 'dusuk',
  aciklama: 'Günlük ilerleme kaydı oluşturur/günceller',

  dogrula(params) {
    return { gecerli: !!params.proje_id, hatalar: params.proje_id ? [] : ['Proje gerekli'] };
  },

  uygula(params, context) {
    const db = getDb();
    const tarih = params.tarih || new Date().toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO gunluk_ilerleme (proje_id, tarih, ekip_id, tamamlanan_direk_sayisi, calisan_direk_ids, toplam_ilerleme_yuzde)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(proje_id, tarih, ekip_id) DO UPDATE SET
        tamamlanan_direk_sayisi = excluded.tamamlanan_direk_sayisi,
        calisan_direk_ids = excluded.calisan_direk_ids,
        toplam_ilerleme_yuzde = excluded.toplam_ilerleme_yuzde
    `).run(
      params.proje_id, tarih, params.ekip_id,
      params.tamamlanan_direk || 0,
      JSON.stringify(params.calisan_direkler || []),
      params.ilerleme_yuzde || 0
    );

    return {
      basarili: true,
      sonuc: { tarih },
      mesaj: `${tarih} ilerleme kaydı: ${params.tamamlanan_direk || 0} direk tamamlandı, toplam %${params.ilerleme_yuzde || 0}`,
    };
  },

  geriAl() { return { basarili: true }; },
  ozet(p) { return `Günlük ilerleme: ${p.tamamlanan_direk || 0} direk, %${p.ilerleme_yuzde || 0}`; },
});
```

### Registry Güncellemesi

```javascript
// aksiyonRegistry.js'e ekle:
require('./aksiyonlar/direkKayit');
require('./aksiyonlar/tespitOlustur');
require('./aksiyonlar/topraklamaKaydet');
require('./aksiyonlar/dosyaKaydet');
require('./aksiyonlar/ilerlemGuncelle');
```

---

## Adım 4 — aiSohbetService Güncelleme: Medya Desteği

### `aiSohbetService.js` — Değişen/Eklenen Kısımlar

```javascript
const konumService = require('./konumService');

// mesajGonder() — Yeni parametre: dosyalar, konum
async mesajGonder({ sohbetId, mesaj, kullaniciId, baglam = {}, dosyalar = [], konum = null }) {
  const db = getDb();

  // ... mevcut sohbet oturumu kodu aynı ...

  // ─── DOSYALARI YÜKLE VE KAYDET ────────────
  let yukluDosyalar = [];
  if (dosyalar.length > 0) {
    for (const dosya of dosyalar) {
      // dosya: { buffer, mimeType, orijinalAdi }
      // Dosya sistemi servisine kaydet (mevcut dosya upload mekanizması)
      const kaydedilen = await dosyaService.yukle({
        buffer: dosya.buffer,
        mimeType: dosya.mimeType,
        orijinalAdi: dosya.orijinalAdi,
        yukleyenId: kullaniciId,
        alan: 'sohbet_temp', // Geçici — AI komutu ile doğru yere taşınabilir
      });
      yukluDosyalar.push(kaydedilen);
    }
  }

  // ─── KONUM → DİREK EŞLEŞTİRME ───────────
  let direkTahmin = null;
  if (konum?.lat && konum?.lon) {
    direkTahmin = konumService.enYakinDirekBul(
      konum.lat, konum.lon,
      baglam.projeId || null
    );
  }

  // ─── KULLANICI MESAJINI KAYDET (medya dahil) ─
  db.prepare(`
    INSERT INTO ai_mesajlar (sohbet_id, rol, icerik, dosya_ids, konum_lat, konum_lon, konum_dogruluk)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    sohbetId, 'kullanici', mesaj,
    yukluDosyalar.length > 0 ? JSON.stringify(yukluDosyalar.map(d => d.id)) : null,
    konum?.lat || null, konum?.lon || null, konum?.dogruluk || null
  );

  // ─── MOD TESPİTİ + YANIT (medya bağlamı ile) ─
  const yanit = await this._mesajIsle(mesaj, gecmis, baglam, kullaniciId, {
    dosyalar: yukluDosyalar,
    konum,
    direkTahmin,
  });

  // ... mevcut kaydet/güncelle kodu aynı ...
}

/**
 * _mesajIsle — Güncelleme: medya bağlamını AI'a ilet
 */
async _mesajIsle(mesaj, gecmis, baglam, kullaniciId, medya = {}) {
  const db = getDb();
  const { dosyalar = [], konum, direkTahmin } = medya;

  const sistemPromptu = this._sistemPromptu(baglam, medya);

  // Fotoğraf varsa vision modeli kullan
  const gorselDosyalar = dosyalar.filter(d =>
    d.mimeType?.startsWith('image/')
  );

  let aiYanit;
  const gecmisMesajlar = gecmis.map(m =>
    `${m.rol === 'kullanici' ? 'Kullanıcı' : 'Asistan'}: ${m.icerik}`
  ).join('\n');

  const prompt = `${gecmisMesajlar ? `GEÇMİŞ KONUŞMA:\n${gecmisMesajlar}\n\n` : ''}Kullanıcı: ${mesaj}`;

  if (gorselDosyalar.length > 0) {
    // Vision modeli ile gönder
    const gorseller = gorselDosyalar.map(d => ({
      base64: d.buffer.toString('base64'),
      mimeType: d.mimeType,
    }));
    aiYanit = await providerManager.gorselGonder(sistemPromptu, prompt, gorseller);
  } else {
    aiYanit = await providerManager.metinGonder(sistemPromptu, prompt);
  }

  // ... mevcut JSON parse + mod işleme kodu aynı ...
  // Ek: dosya_ids'i aksiyon parametrelerine ekle

  let parsed;
  try {
    const jsonMatch = aiYanit.metin.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return { metin: aiYanit.metin, tip: 'sohbet', meta: { provider: aiYanit.provider } };
  }

  // Sorgu modu
  if (parsed.mod === 'sorgu' && parsed.sql) {
    const sqlSonuc = guvenliCalistir(db, parsed.sql);
    if (!sqlSonuc.basarili) {
      return { metin: `Sorgu hatası: ${sqlSonuc.hata}`, tip: 'hata', meta: { sql: parsed.sql } };
    }
    const ozetYanit = await providerManager.metinGonder(
      'Sen ElektraTrack AI asistanısın. Sonuçları doğal Türkçe ile özetle.',
      `Soru: ${mesaj}\nSQL: ${parsed.sql}\nSonuç:\n${JSON.stringify(sqlSonuc.satirlar, null, 2)}`
    );
    return {
      metin: ozetYanit.metin, tip: 'sorgu',
      meta: { sql: parsed.sql, satirSayisi: sqlSonuc.satirSayisi, satirlar: sqlSonuc.satirlar, provider: aiYanit.provider },
    };
  }

  // Komut modu
  if (parsed.mod === 'komut') {
    try {
      const plan = await aiOperasyonService.mesajIsle({
        metin: mesaj,
        gorseller: gorselDosyalar.map(d => ({ base64: d.buffer.toString('base64'), mimeType: d.mimeType })),
        kullaniciId,
        projeId: baglam.projeId || null,
        ekipId: baglam.ekipId || null,
      });
      return {
        metin: parsed.yanit || 'Komut algılandı.', tip: 'komut',
        meta: { provider: aiYanit.provider, direkTahmin },
        aksiyonPlan: plan,
      };
    } catch (err) {
      return { metin: `Hata: ${err.message}`, tip: 'hata', meta: {} };
    }
  }

  // Sohbet modu
  return { metin: parsed.yanit || aiYanit.metin, tip: 'sohbet', meta: { provider: aiYanit.provider, direkTahmin } };
}
```

### Sistem Promptu Güncellemesi

```javascript
_sistemPromptu(baglam, medya = {}) {
  const { konum, direkTahmin, dosyalar = [] } = medya;

  let medyaBaglam = '';

  if (konum) {
    medyaBaglam += `\nKONUM BİLGİSİ:
- GPS: ${konum.lat}, ${konum.lon} (doğruluk: ${konum.dogruluk || '?'}m)`;

    if (direkTahmin) {
      medyaBaglam += `
- EN YAKIN DİREK: ${direkTahmin.direk.direk_no} (${direkTahmin.mesafe}m mesafe, güven: %${Math.round(direkTahmin.tahminGuven * 100)})
  Proje: ${direkTahmin.direk.proje_no || ''} — ${direkTahmin.direk.musteri_adi || ''}
  Direk tipi: ${direkTahmin.direk.direk_tipi || 'bilinmiyor'}
  Mevcut durum: ${direkTahmin.direk.durum || 'belirsiz'}
  Mevcut malzeme: ${direkTahmin.direk.malzeme_durum || 'kayıt yok'}`;
    }
  }

  if (dosyalar.length > 0) {
    const gorselSayisi = dosyalar.filter(d => d.mimeType?.startsWith('image/')).length;
    const digerSayisi = dosyalar.length - gorselSayisi;
    medyaBaglam += `\nEKLENEN DOSYALAR:
- ${gorselSayisi > 0 ? `${gorselSayisi} fotoğraf (vision ile analiz edebilirsin)` : ''}
- ${digerSayisi > 0 ? `${digerSayisi} dosya` : ''}`;
  }

  return `Sen ElektraTrack adlı elektrik dağıtım müteahhitliği proje takip sisteminin AI asistanısın.

GÖREV: Kullanıcının mesajını, konumunu ve gönderdiği medyayı analiz et. 3 moddan birini seç:
1. SORGU — Bilgi istiyor → SQL üret
2. KOMUT — İş yaptırmak istiyor → komut olarak işaretle
3. SOHBET — Genel konuşma → metin yanıt

${DB_SEMA}

EK TABLOLAR (Saha):
-- Direk Kayıtları
direk_kayitlar (id, proje_id, direk_no, direk_tipi, konum_lat, konum_lon, malzeme_durum, topraklama_yapildi, topraklama_direnc, durum, tamamlanma_yuzdesi, notlar)
-- malzeme_durum JSON: { "konsol": { "mevcut": 7, "proje": 9 }, "izolator_n95": { "mevcut": 4, "proje": 4 } }
-- durum: 'bekliyor', 'devam', 'tamamlandi', 'sorunlu'

-- Saha Tespitleri
saha_tespitler (id, proje_id, direk_kayit_id, tespit_tipi, aciklama, konum_lat, konum_lon, oncelik, durum, raporlayan_id)

-- Günlük İlerleme
gunluk_ilerleme (id, proje_id, tarih, ekip_id, tamamlanan_direk_sayisi, toplam_ilerleme_yuzde)

KULLANILABILIR SAHA AKSİYONLARI:
- direk_kayit: Direk malzeme durumunu güncelle (malzeme_durum JSON, durum, notlar)
- tespit_olustur: Eksiklik/arıza/tehlike tespiti oluştur
- topraklama_kaydet: Topraklama ölçümü kaydet (direnc Ohm cinsinden, ≤5Ω normal, >10Ω tehlike)
- dosya_kaydet: Dosyayı belirtilen klasöre kaydet (alan: proje/personel/isg vb.)
- ilerleme_guncelle: Günlük ilerleme kaydı
- depo_cikis, depo_giris: Mevcut malzeme aksiyonları
- tutanak_olustur: Tutanak oluşturma

MEVCUT BAĞLAM:
${baglam.sayfaYolu ? `- Sayfa: ${baglam.sayfaYolu}` : ''}
${baglam.projeNo ? `- Aktif proje: ${baglam.projeNo} (${baglam.projeAdi || ''})` : ''}
${baglam.projeId ? `- Proje ID: ${baglam.projeId}` : ''}
${baglam.ekipAdi ? `- Ekip: ${baglam.ekipAdi}` : ''}
${baglam.kullaniciAdi ? `- Kullanıcı: ${baglam.kullaniciAdi}` : ''}
${medyaBaglam}

ÇIKTI JSON:

SORGU: { "mod": "sorgu", "sql": "SELECT ...", "yanit": "..." }
KOMUT: { "mod": "komut", "yanit": "...", "aksiyonlar": [...] }
SOHBET: { "mod": "sohbet", "yanit": "..." }

FOTOĞRAF ANALİZ KURALLARI:
1. Fotoğrafta direk görüyorsan: malzeme sayımı yap (izolatör, konsol, travers vb.)
2. İrsaliye/belge görüyorsan: malzeme listesi çıkar
3. Arıza/tehlike görüyorsan: tespit oluştur, önceliği belirle
4. Topraklama fotoğrafıysa: topraklama durumunu değerlendir

DİREK TAHMİN KURALLARI:
1. Konum varsa ve yakında direk bulunduysa → direk numarasını belirt, kullanıcıdan onayla
2. Kullanıcı "direk #7" gibi açıkça belirttiyse → doğrudan kullan
3. Direk bulunamadıysa → kullanıcıya hangi direk olduğunu sor
4. Tahmin güveni %70 altındaysa → kullanıcıdan teyit iste

MOD TESPİT KURALLARI:
- Fotoğraf + "bu direkte..." → KOMUT (direk_kayit)
- Fotoğraf + "eksik/arıza/sorun" → KOMUT (tespit_olustur)
- Fotoğraf + "bunu X klasörüne ekle" → KOMUT (dosya_kaydet)
- Fotoğraf + "topraklama yaptık, X ohm" → KOMUT (topraklama_kaydet)
- Fotoğraf + soru → SOHBET (analiz yap, bilgi ver)
- "kaç/ne kadar/durumu ne" → SORGU
- "gönder/çıkar/ekle" → KOMUT`;
}
```

---

## Adım 5 — API Endpoint Güncellemesi

### `routes/aiSohbet.js` — Dosya Upload Desteği

```javascript
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    const izinli = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    cb(null, izinli.includes(file.mimetype));
  },
});

// POST /api/ai-sohbet/mesaj — Güncelleme: dosya + konum desteği
router.post('/mesaj', upload.array('dosyalar', 10), async (req, res) => {
  try {
    const { sohbet_id, mesaj, baglam: baglamStr, konum: konumStr } = req.body;
    if (!mesaj?.trim() && !req.files?.length) {
      return res.status(400).json({ success: false, error: 'Mesaj veya dosya gerekli' });
    }

    const baglam = baglamStr ? JSON.parse(baglamStr) : {};
    const konum = konumStr ? JSON.parse(konumStr) : null;

    const dosyalar = (req.files || []).map(f => ({
      buffer: f.buffer,
      mimeType: f.mimetype,
      orijinalAdi: f.originalname,
    }));

    const sonuc = await aiSohbetService.mesajGonder({
      sohbetId: sohbet_id ? parseInt(sohbet_id) : null,
      mesaj: mesaj?.trim() || '(fotoğraf gönderildi)',
      kullaniciId: req.kullanici.id,
      baglam: { ...baglam, kullaniciAdi: req.kullanici.ad_soyad },
      dosyalar,
      konum,
    });

    res.json({ success: true, data: sonuc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

## Adım 6 — Frontend: Medya Ekleme UI

### `client/src/components/ai/AiSohbetGirdi.jsx`

```jsx
import React, { useState, useRef } from 'react';

/**
 * AI Sohbet Girdi Alanı — metin + dosya + konum + sesli not
 *
 * Props:
 *   onGonder({ metin, dosyalar, konum })
 *   yukleniyor: boolean
 */
export default function AiSohbetGirdi({ onGonder, yukleniyor }) {
  const [metin, setMetin] = useState('');
  const [dosyalar, setDosyalar] = useState([]);      // [{ file, onizleme }]
  const [konum, setKonum] = useState(null);           // { lat, lon, dogruluk }
  const [konumYukleniyor, setKonumYukleniyor] = useState(false);
  const dosyaRef = useRef(null);

  // ─── DOSYA EKLEME ────────────────────────────
  const dosyaEkle = (e) => {
    const yeniDosyalar = Array.from(e.target.files).map(file => ({
      file,
      onizleme: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));
    setDosyalar(prev => [...prev, ...yeniDosyalar]);
    e.target.value = ''; // Aynı dosyayı tekrar seçebilmek için
  };

  const dosyaSil = (index) => {
    setDosyalar(prev => {
      const yeni = [...prev];
      if (yeni[index].onizleme) URL.revokeObjectURL(yeni[index].onizleme);
      yeni.splice(index, 1);
      return yeni;
    });
  };

  // ─── KONUM PAYLAŞ ────────────────────────────
  const konumPaylas = () => {
    if (!navigator.geolocation) {
      alert('Tarayıcınız konum paylaşmayı desteklemiyor');
      return;
    }
    setKonumYukleniyor(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setKonum({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          dogruluk: Math.round(pos.coords.accuracy),
        });
        setKonumYukleniyor(false);
      },
      (err) => {
        alert('Konum alınamadı: ' + err.message);
        setKonumYukleniyor(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ─── GÖNDER ────────────────────────────────
  const gonder = () => {
    if ((!metin.trim() && dosyalar.length === 0) || yukleniyor) return;

    onGonder({
      metin: metin.trim(),
      dosyalar: dosyalar.map(d => d.file),
      konum,
    });

    // Temizle
    setMetin('');
    dosyalar.forEach(d => { if (d.onizleme) URL.revokeObjectURL(d.onizleme); });
    setDosyalar([]);
    setKonum(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); gonder(); }
  };

  return (
    <div style={{ borderTop: '1px solid #e5e7eb' }}>

      {/* ─── DOSYA ÖNİZLEMELERİ ────────────── */}
      {(dosyalar.length > 0 || konum) && (
        <div style={{ padding: '8px 16px', display: 'flex', gap: '8px', flexWrap: 'wrap', background: '#f9fafb' }}>
          {dosyalar.map((d, i) => (
            <div key={i} style={{ position: 'relative' }}>
              {d.onizleme ? (
                <img src={d.onizleme} alt="" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e5e7eb' }} />
              ) : (
                <div style={{ width: '60px', height: '60px', borderRadius: '8px', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#6b7280' }}>
                  📄 {d.file.name.split('.').pop()}
                </div>
              )}
              <button onClick={() => dosyaSil(i)}
                style={{ position: 'absolute', top: '-4px', right: '-4px', width: '18px', height: '18px', borderRadius: '50%', background: '#ef4444', color: 'white', border: 'none', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ✕
              </button>
            </div>
          ))}
          {konum && (
            <div style={{ padding: '4px 10px', background: '#dbeafe', borderRadius: '8px', fontSize: '11px', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '4px' }}>
              📍 {konum.lat.toFixed(5)}, {konum.lon.toFixed(5)}
              <span style={{ opacity: 0.6 }}>(±{konum.dogruluk}m)</span>
              <button onClick={() => setKonum(null)}
                style={{ background: 'none', border: 'none', color: '#1e40af', cursor: 'pointer', fontSize: '12px' }}>✕</button>
            </div>
          )}
        </div>
      )}

      {/* ─── GİRDİ ALANI ───────────────────── */}
      <div style={{ padding: '12px 16px', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>

        {/* Dosya butonu */}
        <input type="file" ref={dosyaRef} onChange={dosyaEkle} multiple accept="image/*,.pdf" style={{ display: 'none' }} />
        <button onClick={() => dosyaRef.current?.click()}
          style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f3f4f6', border: 'none', cursor: 'pointer', fontSize: '16px', flexShrink: 0 }}
          title="Dosya/fotoğraf ekle">
          📎
        </button>

        {/* Kamera butonu (mobil) */}
        <input type="file" id="kamera" onChange={dosyaEkle} capture="environment" accept="image/*" style={{ display: 'none' }} />
        <button onClick={() => document.getElementById('kamera')?.click()}
          style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f3f4f6', border: 'none', cursor: 'pointer', fontSize: '16px', flexShrink: 0 }}
          title="Fotoğraf çek">
          📷
        </button>

        {/* Konum butonu */}
        <button onClick={konumPaylas} disabled={konumYukleniyor || !!konum}
          style={{ width: '36px', height: '36px', borderRadius: '8px', background: konum ? '#dbeafe' : '#f3f4f6', border: 'none', cursor: 'pointer', fontSize: '16px', flexShrink: 0 }}
          title={konum ? 'Konum eklendi' : 'Konum paylaş'}>
          {konumYukleniyor ? '⏳' : '📍'}
        </button>

        {/* Metin */}
        <textarea value={metin} onChange={(e) => setMetin(e.target.value)} onKeyDown={handleKeyDown}
          placeholder="Mesaj, not veya komut yaz..."
          rows={1}
          style={{ flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '13px', resize: 'none', outline: 'none', fontFamily: 'inherit', maxHeight: '80px' }}
          onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'; }}
        />

        {/* Gönder */}
        <button onClick={gonder} disabled={(!metin.trim() && dosyalar.length === 0) || yukleniyor}
          style={{ width: '40px', height: '40px', borderRadius: '10px', background: (metin.trim() || dosyalar.length > 0) ? '#2563eb' : '#e5e7eb', color: 'white', border: 'none', cursor: (metin.trim() || dosyalar.length > 0) ? 'pointer' : 'default', fontSize: '16px', flexShrink: 0 }}>
          ➤
        </button>
      </div>
    </div>
  );
}
```

### `AiSohbetPanel.jsx` Entegrasyonu

```jsx
// Mevcut girdi alanını AiSohbetGirdi ile değiştir:
import AiSohbetGirdi from './AiSohbetGirdi';

// mesajGonder fonksiyonunu güncelle:
const mesajGonder = async ({ metin, dosyalar = [], konum }) => {
  if ((!metin && dosyalar.length === 0) || yukleniyor) return;
  setYukleniyor(true);

  // Kullanıcı mesajını hemen göster (fotoğraf önizlemeleriyle)
  setMesajlar(prev => [...prev, {
    rol: 'kullanici', icerik: metin || '(medya gönderildi)',
    dosyalar: dosyalar.map(f => ({
      onizleme: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      adi: f.name,
    })),
    konum,
  }]);

  try {
    // FormData ile gönder (dosyalar için)
    const formData = new FormData();
    if (sohbetId) formData.append('sohbet_id', sohbetId);
    formData.append('mesaj', metin || '');
    formData.append('baglam', JSON.stringify(baglam));
    if (konum) formData.append('konum', JSON.stringify(konum));
    for (const dosya of dosyalar) {
      formData.append('dosyalar', dosya);
    }

    const { data } = await api.post('/api/ai-sohbet/mesaj', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const d = data.data;
    setSohbetId(d.sohbetId);

    setMesajlar(prev => [...prev, {
      rol: 'asistan', icerik: d.yanit, tip: d.tip, meta: d.meta,
    }]);

    // Direk tahmin bilgisi varsa göster
    if (d.meta?.direkTahmin) {
      const dt = d.meta.direkTahmin;
      if (dt.tahminGuven < 0.7) {
        // Düşük güven → kullanıcıdan teyit iste
        // (AI zaten yanıtında soracak)
      }
    }

    if (d.aksiyonPlan) setAksiyonPlan(d.aksiyonPlan);
  } catch (err) {
    setMesajlar(prev => [...prev, {
      rol: 'asistan', icerik: `Hata: ${err.response?.data?.error || err.message}`, tip: 'hata',
    }]);
  } finally {
    setYukleniyor(false);
  }
};

// JSX'te girdi alanını değiştir:
<AiSohbetGirdi onGonder={mesajGonder} yukleniyor={yukleniyor} />
```

### Mesaj Baloncuğunda Fotoğraf Gösterimi

```jsx
// Mesaj baloncuğu içinde (mesajlar.map kısmına ekle):
{m.dosyalar?.length > 0 && (
  <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexWrap: 'wrap' }}>
    {m.dosyalar.map((d, j) => d.onizleme ? (
      <img key={j} src={d.onizleme} alt="" style={{ width: '100px', height: '80px', objectFit: 'cover', borderRadius: '6px' }} />
    ) : (
      <div key={j} style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.2)', borderRadius: '4px', fontSize: '11px' }}>📄 {d.adi}</div>
    ))}
  </div>
)}
{m.konum && (
  <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '4px' }}>
    📍 {m.konum.lat.toFixed(5)}, {m.konum.lon.toFixed(5)}
  </div>
)}
```

---

## Adım 7 — Sesli Not Desteği (Gelecek Faz)

Sesli not → metin dönüşümü için iki yol:

### Yol 1 — Tarayıcı Web Speech API (Ücretsiz, Çevrimdışı)

```jsx
const SesliNot = ({ onMetinAl }) => {
  const [kayit, setKayit] = useState(false);

  const basla = () => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'tr-TR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (e) => {
      const metin = Array.from(e.results).map(r => r[0].transcript).join(' ');
      onMetinAl(metin);
    };

    recognition.start();
    setKayit(true);
  };

  return (
    <button onClick={kayit ? null : basla}
      style={{ width: '36px', height: '36px', borderRadius: '8px',
        background: kayit ? '#ef4444' : '#f3f4f6', border: 'none',
        cursor: 'pointer', fontSize: '16px' }}>
      {kayit ? '⏹' : '🎤'}
    </button>
  );
};
```

### Yol 2 — Whisper API (Daha Doğru, Bulut)

```javascript
// Backend: Ses dosyası → Whisper → Metin
// Gelecek implementasyon — şimdilik Yol 1 yeterli
```

---

## Adım 8 — Otomatik Günlük Rapor Üretimi

### `server/services/ai/gunlukRaporService.js`

```javascript
const { getDb } = require('../../db/database');
const providerManager = require('./providerManager');
const konumService = require('./konumService');

class GunlukRaporService {

  /**
   * Projenin bugünkü aktivitelerinden otomatik rapor üret
   * Cron job veya manuel tetikleme ile çalıştırılır
   */
  async raporUret(projeId) {
    const db = getDb();
    const bugun = new Date().toISOString().split('T')[0];

    // Bugünkü aktiviteleri topla
    const direkGuncellemeleri = db.prepare(`
      SELECT dk.direk_no, dig.islem_tipi, dig.yeni_deger, k.ad_soyad
      FROM direk_islem_gecmisi dig
      JOIN direk_kayitlar dk ON dk.id = dig.direk_kayit_id
      LEFT JOIN kullanicilar k ON k.id = dig.islem_yapan_id
      WHERE dk.proje_id = ? AND date(dig.olusturma_tarihi) = ?
    `).all(projeId, bugun);

    const yeniTespitler = db.prepare(`
      SELECT tespit_tipi, aciklama, oncelik
      FROM saha_tespitler
      WHERE proje_id = ? AND date(olusturma_tarihi) = ?
    `).all(projeId, bugun);

    const malzemeHareketleri = db.prepare(`
      SELECT m.ad, mh.hareket_tipi, mh.miktar, mh.birim
      FROM malzeme_hareketleri mh
      JOIN malzemeler m ON m.id = mh.malzeme_id
      WHERE mh.proje_id = ? AND date(mh.tarih) = ?
    `).all(projeId, bugun);

    const ilerleme = konumService.projeIlerlemeOzeti(projeId);

    // AI'a özetlet
    const prompt = `Bu günkü aktivite özeti:
Proje ilerleme: %${ilerleme.ilerlemYuzde} (${ilerleme.tamamlanan}/${ilerleme.toplamDirek} direk)
Açık tespit sayısı: ${ilerleme.acikTespitler}

Direk güncellemeleri (${direkGuncellemeleri.length}):
${JSON.stringify(direkGuncellemeleri)}

Yeni tespitler (${yeniTespitler.length}):
${JSON.stringify(yeniTespitler)}

Malzeme hareketleri (${malzemeHareketleri.length}):
${JSON.stringify(malzemeHareketleri)}

Bu verileri kullanarak kısa, profesyonel bir günlük saha raporu yaz. Önemli noktaları vurgula, sorunları belirt, yarın için önerilerde bulun.`;

    const yanit = await providerManager.metinGonder(
      'Sen saha mühendisi raporlama asistanısın. Kısa, net, profesyonel raporlar yazarsın.',
      prompt
    );

    // DB'ye kaydet
    db.prepare(`
      INSERT INTO gunluk_ilerleme (proje_id, tarih, toplam_ilerleme_yuzde, tamamlanan_direk_sayisi, ai_rapor, ai_rapor_tarihi)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(proje_id, tarih, ekip_id) DO UPDATE SET
        ai_rapor = excluded.ai_rapor, ai_rapor_tarihi = excluded.ai_rapor_tarihi
    `).run(projeId, bugun, ilerleme.ilerlemYuzde, ilerleme.tamamlanan, yanit.metin);

    return { tarih: bugun, rapor: yanit.metin, ilerleme };
  }
}

module.exports = new GunlukRaporService();
```

---

## Adım 9 — Akıllı Bildirimler

### `server/services/ai/bildirimService.js`

```javascript
const { getDb } = require('../../db/database');

class AiBildirimService {

  /**
   * Periyodik kontrol — sorunları tespit et, bildirim üret
   * Cron job ile günde 1-2 kez çalışır
   */
  kontrol() {
    const bildirimler = [];

    // 1. Düşük stok uyarısı
    const dusukStok = getDb().prepare(
      'SELECT ad, stok_miktari, min_stok FROM malzemeler WHERE stok_miktari <= min_stok AND min_stok > 0'
    ).all();
    for (const m of dusukStok) {
      bildirimler.push({
        tip: 'stok_uyari', oncelik: 'yuksek',
        mesaj: `⚠️ ${m.ad}: ${m.stok_miktari} adet kaldı (minimum: ${m.min_stok})`,
      });
    }

    // 2. Aşılan topraklama değerleri
    const kotüTopraklama = getDb().prepare(
      'SELECT dk.direk_no, dk.topraklama_direnc, p.proje_no FROM direk_kayitlar dk JOIN projeler p ON p.id = dk.proje_id WHERE dk.topraklama_direnc > 10'
    ).all();
    for (const d of kotüTopraklama) {
      bildirimler.push({
        tip: 'topraklama_tehlike', oncelik: 'acil',
        mesaj: `❌ ${d.proje_no} Direk ${d.direk_no}: Topraklama ${d.topraklama_direnc}Ω — standart aşıldı!`,
      });
    }

    // 3. Açık tespitler (3 günden eski)
    const eskiTespitler = getDb().prepare(`
      SELECT st.aciklama, st.tespit_tipi, p.proje_no,
        julianday('now') - julianday(st.olusturma_tarihi) as gun
      FROM saha_tespitler st
      JOIN projeler p ON p.id = st.proje_id
      WHERE st.durum = 'acik' AND julianday('now') - julianday(st.olusturma_tarihi) > 3
    `).all();
    for (const t of eskiTespitler) {
      bildirimler.push({
        tip: 'eski_tespit', oncelik: 'normal',
        mesaj: `📋 ${t.proje_no}: "${t.aciklama.substring(0, 40)}..." tespiti ${Math.round(t.gun)} gündür açık`,
      });
    }

    // 4. Yaklaşan bitiş tarihi
    const yaklasanProjeler = getDb().prepare(`
      SELECT proje_no, musteri_adi, bitis_tarihi,
        julianday(bitis_tarihi) - julianday('now') as kalan_gun
      FROM projeler
      WHERE durum = 'devam_eden' AND julianday(bitis_tarihi) - julianday('now') BETWEEN 0 AND 7
    `).all();
    for (const p of yaklasanProjeler) {
      bildirimler.push({
        tip: 'bitis_yaklasma', oncelik: 'yuksek',
        mesaj: `⏰ ${p.proje_no} (${p.musteri_adi}): Bitiş tarihine ${Math.round(p.kalan_gun)} gün kaldı!`,
      });
    }

    // 5. İlerleme gecikmesi
    const gecikenProjeler = getDb().prepare(`
      SELECT p.proje_no, p.musteri_adi,
        (SELECT toplam_ilerleme_yuzde FROM gunluk_ilerleme WHERE proje_id = p.id ORDER BY tarih DESC LIMIT 1) as ilerleme,
        julianday(p.bitis_tarihi) - julianday('now') as kalan_gun,
        julianday('now') - julianday(p.baslama_tarihi) as gecen_gun,
        julianday(p.bitis_tarihi) - julianday(p.baslama_tarihi) as toplam_gun
      FROM projeler p WHERE p.durum = 'devam_eden'
    `).all();
    for (const p of gecikenProjeler) {
      if (!p.toplam_gun || !p.ilerleme) continue;
      const beklenenIlerleme = (p.gecen_gun / p.toplam_gun) * 100;
      if (p.ilerleme < beklenenIlerleme - 15) {
        bildirimler.push({
          tip: 'ilerleme_gecikme', oncelik: 'yuksek',
          mesaj: `📉 ${p.proje_no}: İlerleme %${Math.round(p.ilerleme)}, beklenen %${Math.round(beklenenIlerleme)} — geride`,
        });
      }
    }

    return bildirimler;
  }
}

module.exports = new AiBildirimService();
```

---

## Adım 10 — Malzeme İhtiyaç Tahmini

```javascript
// aiSohbetService'in sorgu modunda AI'ın kullanacağı ek SQL bilgisi:
// Kullanıcı: "Bu proje için malzeme tahmini yap"

// AI üretecek SQL serisi:
// 1. Proje direklerini ve mevcut durumları al
// 2. Proje gereksinimlerini (DXF'ten parse edilmiş) al
// 3. Mevcut stoku al
// 4. Farkı hesapla

// Örnek AI yanıtı:
// "Koşu köy projesi için kalan 8 direkte ihtiyaç:
//  - Konsol: 72 adet gerekli, depoda 45 var → 27 adet eksik ⚠️
//  - N-95 izolatör: 32 adet gerekli, depoda 50 var → yeterli ✅
//  - NYY kablo: 1200m gerekli, depoda 800m var → 400m eksik ⚠️
//  Sipariş oluşturmamı ister misiniz?"
```

---

## Akış Örnekleri

### Fotoğraf + Konum + Metin → Direk Kaydı

```
[📷 direk fotoğrafı] + [📍 GPS: 40.1234, 36.5678]
"4 izolatör, 7 konsol var, hattı pansy"

AI:
1. Konum → direk_kayitlar'da arar → "Direk #7, 8m mesafe, %92 güven"
2. Fotoğraf → vision analiz → malzeme sayımı doğrular
3. Yanıt:
   "📍 Direk #7 (Koşu köy hattı, 8m mesafe) olarak tespit ettim.

   Fotoğraf + mesaj analizi:
   ✅ N-95 izolatör: 4 adet (proje: 4 — tam)
   ⚠️ Konsol: 7 adet (proje: 9 — 2 eksik)
   📝 Hat tipi: Pansy

   Direk kaydını güncelleyeyim mi?"
   [✅ Güncelle]  [✏️ Düzelt]
```

### Fotoğraf + "Bunu X Klasörüne Ekle"

```
[📷 fotoğraf] "Bunu Koşu köy projesinin yapım klasörüne ekle"

AI → mod: komut → dosya_kaydet aksiyonu
📁 Dosya Kaydet: foto_001.jpg → proje/Koşu köy/Yapım
[✅ Onayla]
```

### Topraklama Kaydı

```
[📷 topraklama fotoğrafı] [📍 konum]
"Topraklama yaptık 4.2 ohm ölçtük"

AI → konum → Direk #7 → topraklama_kaydet
"Direk #7 topraklama: 4.2Ω ✅ Standart sınır içinde (≤5Ω).
 Kayıt oluşturulsun mu?"
[✅ Onayla]
```

### Arıza/Tehlike Tespiti

```
[📷 eğilmiş direk fotoğrafı] [📍 konum]
"Bu direk eğilmiş, tehlikeli görünüyor"

AI → vision: eğilme tespit → tespit_olustur
"⚠️ Direk #12'de eğilme tespit edildi.
 Öncelik: YÜKSEK — mühendis değerlendirmesi önerilir.
 Tespit kaydı oluşturulsun mu?"
[✅ Oluştur]
```

### Konumdan Otomatik Direk Tahmini (Düşük Güven)

```
[📷 fotoğraf] [📍 konum: arazi ortası]
"Bu direk sorunlu"

AI → konum araması → en yakın direk 35m mesafede, güven %30
"📍 Konumunuza en yakın direk #15 (35m mesafe) ama emin değilim.
 Hangi direk olduğunu belirtir misiniz?"
```

---

## Kontrol Listesi

**Veritabanı:**
- [ ] `ai_mesajlar` → dosya_ids, konum_lat/lon/dogruluk sütunları
- [ ] `direk_kayitlar` tablosu
- [ ] `direk_fotograflar` tablosu
- [ ] `direk_islem_gecmisi` tablosu
- [ ] `saha_tespitler` tablosu
- [ ] `gunluk_ilerleme` tablosu

**Yeni Aksiyonlar:**
- [ ] `direk_kayit` — Direk malzeme/durum güncelleme
- [ ] `tespit_olustur` — Saha tespiti
- [ ] `topraklama_kaydet` — Topraklama ölçümü + standart kontrol
- [ ] `dosya_kaydet` — Dosyayı klasöre kaydet
- [ ] `ilerleme_guncelle` — Günlük ilerleme

**Konum Servisi:**
- [ ] `konumService.enYakinDirekBul()` çalışıyor
- [ ] Konum → direk eşleştirme doğru
- [ ] Güven skoru doğru hesaplanıyor
- [ ] Max mesafe filtresi çalışıyor

**Sohbet Servisi:**
- [ ] Fotoğraf upload + vision analizi
- [ ] Konum + direk eşleştirme
- [ ] FormData ile çoklu dosya gönderimi
- [ ] Sistem promptu medya bağlamını içeriyor

**Frontend:**
- [ ] 📎 Dosya ekleme butonu
- [ ] 📷 Kamera butonu (mobil)
- [ ] 📍 Konum paylaş butonu
- [ ] Dosya önizleme (küçük resimler)
- [ ] Konum badge gösterimi
- [ ] Mesaj baloncuğunda fotoğraf gösterimi
- [ ] FormData ile API gönderimi

**Sesli Not:**
- [ ] 🎤 Web Speech API (tarayıcı)
- [ ] tr-TR dil desteği

**Günlük Rapor:**
- [ ] `gunlukRaporService.raporUret()` çalışıyor
- [ ] Direk güncellemeleri + tespitler + malzeme hareketleri toplanıyor
- [ ] AI özet raporu üretiliyor

**Akıllı Bildirimler:**
- [ ] Düşük stok uyarısı
- [ ] Tehlikeli topraklama değeri
- [ ] 3+ gün açık tespit
- [ ] Yaklaşan bitiş tarihi
- [ ] İlerleme gecikmesi

**Test:**
- [ ] Fotoğraf + metin → direk kaydı güncelleme
- [ ] Fotoğraf + "klasöre ekle" → dosya kaydet
- [ ] Konum → doğru direk tahmin
- [ ] Konum yakın değilse → kullanıcıdan teyit
- [ ] Topraklama ölçüm → standart kontrol (✅ / ⚠️ / ❌)
- [ ] Arıza fotoğrafı → tespit oluşturma
- [ ] Günlük rapor üretimi
- [ ] Bildirim kontrolü → düşük stok, eski tespit vb.
