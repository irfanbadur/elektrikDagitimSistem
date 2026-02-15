# ElektraTrack — Proje Yaşam Döngüsü Yönetimi

## Amaç

Her proje tipinin (KET, YB, TES...) özelleştirilebilir bir yaşam döngüsü olmasını sağlamak.

**Temel özellikler:**
1. Kullanıcı istediği döngü şablonunu oluşturabilir (KET döngüsü, YB döngüsü, vb.)
2. Projeye şablon atanır → aşamalar otomatik oluşur
3. Her aşamanın başlangıç/bitiş tarihi takip edilir
4. Aktif (current) aşama otomatik belirlenir
5. Veri paketi oluşturulduğunda aktif aşama otomatik bağlanır
6. Proje detay sayfasında timeline/ilerleme gösterilir

**Örnek — KET Projesi:**
```
1. Yer Teslimi           ✅ 01.01.2026 → 05.01.2026  (5 gün)
2. Proje Aşaması         ✅ 06.01.2026 → 20.01.2026  (15 gün)
3. Malzeme Talep          🔄 21.01.2026 → —            (devam ediyor) ← AKTİF
4. Yapım                  ⏳ —                          (başlamadı)
5. CBS                    ⏳ —
6. Hak Ediş               ⏳ —
7. Geçici Kabul            ⏳ —
8. Geçici Kabul Eksikleri  ⏳ —
```

---

## Adım 1 — Veritabanı Şeması

### Tablo 1: `dongü_sablonlari` — Şablon Tanımları

Kullanıcının oluşturduğu döngü şablonları. Her şablon birden fazla projede kullanılabilir.

```sql
-- ============================================
-- DÖNGÜ ŞABLONLARI
-- Kullanıcı tarafından oluşturulan proje yaşam döngüsü şablonları
-- Bir şablon birden fazla projede kullanılabilir
-- ============================================
CREATE TABLE IF NOT EXISTS dongu_sablonlari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sablon_adi TEXT NOT NULL,                 -- "KET Döngüsü", "YB Döngüsü"
    sablon_kodu TEXT UNIQUE NOT NULL,         -- "KET", "YB", "TES" (kısa kod)
    aciklama TEXT,                            -- Şablonun açıklaması
    varsayilan INTEGER DEFAULT 0,            -- Bu proje tipi için varsayılan mı? (1=evet)

    durum TEXT DEFAULT 'aktif',              -- 'aktif', 'pasif'
    olusturan_id INTEGER,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (olusturan_id) REFERENCES personel(id)
);
```

### Tablo 2: `dongu_sablon_asamalari` — Şablondaki Aşama Tanımları

Her şablonun aşama sırası ve bilgileri.

```sql
-- ============================================
-- DÖNGÜ ŞABLON AŞAMALARI
-- Şablondaki aşama tanımları (sıra, isim, renk)
-- ============================================
CREATE TABLE IF NOT EXISTS dongu_sablon_asamalari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sablon_id INTEGER NOT NULL,
    sira INTEGER NOT NULL,                   -- 1, 2, 3... (sıralama)
    asama_adi TEXT NOT NULL,                 -- "Yer Teslimi", "Proje Aşaması"
    asama_kodu TEXT NOT NULL,                -- "yer_teslimi", "proje", "malzeme_talep"
    renk TEXT DEFAULT '#6b7280',             -- Renk kodu (timeline'da kullanılır)
    ikon TEXT DEFAULT '📋',                  -- Emoji ikon
    aciklama TEXT,                            -- Bu aşamada ne yapılır?
    tahmini_gun INTEGER,                     -- Tahmini süre (gün) — opsiyonel

    FOREIGN KEY (sablon_id) REFERENCES dongu_sablonlari(id) ON DELETE CASCADE,
    UNIQUE(sablon_id, sira),                 -- Aynı şablonda aynı sıra olamaz
    UNIQUE(sablon_id, asama_kodu)            -- Aynı şablonda aynı kod olamaz
);
```

### Tablo 3: `proje_asamalari` — Projenin Gerçek Aşamaları

Proje oluşturulduğunda şablondan kopyalanan aşamalar. Gerçek tarihler burada tutulur.

```sql
-- ============================================
-- PROJE AŞAMALARI
-- Her projenin kendi yaşam döngüsü aşamaları
-- Şablondan kopyalanır, tarihler proje bazında takip edilir
-- ============================================
CREATE TABLE IF NOT EXISTS proje_asamalari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proje_id INTEGER NOT NULL,
    sablon_asama_id INTEGER,                 -- Hangi şablon aşamasından geldi (referans)
    sira INTEGER NOT NULL,                   -- 1, 2, 3...
    asama_adi TEXT NOT NULL,                 -- "Yer Teslimi"
    asama_kodu TEXT NOT NULL,                -- "yer_teslimi"
    renk TEXT DEFAULT '#6b7280',
    ikon TEXT DEFAULT '📋',

    -- ─── DURUM ──────────────────────────────────
    durum TEXT DEFAULT 'bekliyor',
    -- 'bekliyor'      → Henüz başlamadı
    -- 'devam_ediyor'  → Aktif (current)
    -- 'tamamlandi'    → Tamamlandı
    -- 'atlandı'       → Bu aşama atlandı/geçildi

    -- ─── TARİHLER ──────────────────────────────
    baslangic_tarihi DATE,                   -- Gerçek başlangıç
    bitis_tarihi DATE,                       -- Gerçek bitiş
    planlanan_baslangic DATE,                -- Planlanan başlangıç (opsiyonel)
    planlanan_bitis DATE,                    -- Planlanan bitiş (opsiyonel)
    tahmini_gun INTEGER,                     -- Tahmini süre (gün)

    -- ─── NOTLAR ─────────────────────────────────
    notlar TEXT,                              -- Aşama notları
    tamamlanma_notu TEXT,                    -- Tamamlanırken eklenen not

    -- ─── İLİŞKİLER ─────────────────────────────
    baslatan_id INTEGER,                     -- Aşamayı başlatan personel
    tamamlayan_id INTEGER,                   -- Aşamayı tamamlayan personel

    -- ─── ZAMAN ──────────────────────────────────
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (proje_id) REFERENCES projeler(id) ON DELETE CASCADE,
    FOREIGN KEY (sablon_asama_id) REFERENCES dongu_sablon_asamalari(id),
    FOREIGN KEY (baslatan_id) REFERENCES personel(id),
    FOREIGN KEY (tamamlayan_id) REFERENCES personel(id),
    UNIQUE(proje_id, sira)
);
```

### Projeler Tablosuna Eklenen Sütunlar

```sql
-- Mevcut projeler tablosuna ekle:
ALTER TABLE projeler ADD COLUMN dongu_sablon_id INTEGER REFERENCES dongu_sablonlari(id);
ALTER TABLE projeler ADD COLUMN aktif_asama_id INTEGER REFERENCES proje_asamalari(id);
```

### Veri Paketleri Tablosuna Eklenen Sütun

```sql
-- Veri paketi hangi aşamada oluşturuldu
ALTER TABLE veri_paketleri ADD COLUMN proje_asama_id INTEGER REFERENCES proje_asamalari(id);
```

### Dosyalar Tablosuna Eklenen Sütun

```sql
-- Dosya hangi aşamada yüklendi
ALTER TABLE dosyalar ADD COLUMN proje_asama_id INTEGER REFERENCES proje_asamalari(id);
```

### İndeksler

```sql
CREATE INDEX IF NOT EXISTS idx_proje_asama_proje ON proje_asamalari(proje_id);
CREATE INDEX IF NOT EXISTS idx_proje_asama_durum ON proje_asamalari(durum);
CREATE INDEX IF NOT EXISTS idx_sablon_asama_sablon ON dongu_sablon_asamalari(sablon_id);
CREATE INDEX IF NOT EXISTS idx_paket_asama ON veri_paketleri(proje_asama_id);
CREATE INDEX IF NOT EXISTS idx_dosya_asama ON dosyalar(proje_asama_id);
```

### Varsayılan Şablonlar (Seed Data)

```sql
-- ─── KET Döngüsü ────────────────────────────────
INSERT INTO dongu_sablonlari (sablon_adi, sablon_kodu, aciklama, varsayilan)
VALUES ('KET Döngüsü', 'KET', 'Küçük Ek Tesis projeleri yaşam döngüsü', 1);

INSERT INTO dongu_sablon_asamalari (sablon_id, sira, asama_adi, asama_kodu, renk, ikon, tahmini_gun) VALUES
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='KET'), 1, 'Yer Teslimi',              'yer_teslimi',       '#6366f1', '📍', 5),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='KET'), 2, 'Proje Aşaması',            'proje',             '#8b5cf6', '📐', 15),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='KET'), 3, 'Malzeme Talep',             'malzeme_talep',     '#0ea5e9', '📦', 10),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='KET'), 4, 'Yapım',                     'yapim',             '#f59e0b', '🔧', 30),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='KET'), 5, 'CBS',                       'cbs',               '#10b981', '🗺️', 5),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='KET'), 6, 'Hak Ediş',                  'hak_edis',          '#3b82f6', '💰', 10),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='KET'), 7, 'Geçici Kabul',              'gecici_kabul',      '#14b8a6', '✅', 15),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='KET'), 8, 'Geçici Kabul Eksikleri',    'gk_eksikleri',      '#f43f5e', '🔴', 20);

-- ─── YB Döngüsü ─────────────────────────────────
INSERT INTO dongu_sablonlari (sablon_adi, sablon_kodu, aciklama, varsayilan)
VALUES ('YB Döngüsü', 'YB', 'Yeni Bağlantı / Yapı Bağlantı projeleri yaşam döngüsü', 1);

INSERT INTO dongu_sablon_asamalari (sablon_id, sira, asama_adi, asama_kodu, renk, ikon, tahmini_gun) VALUES
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='YB'), 1, 'Yer Teslimi',          'yer_teslimi',     '#6366f1', '📍', 3),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='YB'), 2, 'Proje',                'proje',           '#8b5cf6', '📐', 10),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='YB'), 3, 'Malzeme Temin',        'malzeme_temin',   '#0ea5e9', '📦', 7),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='YB'), 4, 'Yapım',                'yapim',           '#f59e0b', '🔧', 15),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='YB'), 5, 'CBS Kayıt',            'cbs',             '#10b981', '🗺️', 3),
  ((SELECT id FROM dongu_sablonlari WHERE sablon_kodu='YB'), 6, 'Geçici Kabul',         'gecici_kabul',    '#14b8a6', '✅', 10);
```

---

## Adım 2 — Döngü Servisi (Backend)

### `server/services/donguService.js`

```javascript
const { getDb } = require('../db/database');

class DonguService {

  // ═══════════════════════════════════════════════
  // ŞABLON YÖNETİMİ
  // ═══════════════════════════════════════════════

  /**
   * Tüm şablonları listele (aşamalarıyla birlikte)
   */
  sablonlariListele() {
    const db = getDb();
    const sablonlar = db.prepare(`
      SELECT * FROM dongu_sablonlari WHERE durum = 'aktif' ORDER BY sablon_adi
    `).all();

    return sablonlar.map(s => ({
      ...s,
      asamalar: db.prepare(`
        SELECT * FROM dongu_sablon_asamalari
        WHERE sablon_id = ? ORDER BY sira
      `).all(s.id)
    }));
  }

  /**
   * Tek şablon detay
   */
  sablonGetir(sablonId) {
    const db = getDb();
    const sablon = db.prepare('SELECT * FROM dongu_sablonlari WHERE id = ?').get(sablonId);
    if (!sablon) return null;

    sablon.asamalar = db.prepare(`
      SELECT * FROM dongu_sablon_asamalari
      WHERE sablon_id = ? ORDER BY sira
    `).all(sablonId);

    return sablon;
  }

  /**
   * Yeni şablon oluştur
   */
  sablonOlustur({ sablonAdi, sablonKodu, aciklama, olusturanId, asamalar }) {
    const db = getDb();

    // Şablonu oluştur
    const result = db.prepare(`
      INSERT INTO dongu_sablonlari (sablon_adi, sablon_kodu, aciklama, olusturan_id)
      VALUES (?, ?, ?, ?)
    `).run(sablonAdi, sablonKodu.toUpperCase(), aciklama, olusturanId);

    const sablonId = result.lastInsertRowid;

    // Aşamaları ekle
    const stmt = db.prepare(`
      INSERT INTO dongu_sablon_asamalari
        (sablon_id, sira, asama_adi, asama_kodu, renk, ikon, aciklama, tahmini_gun)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const a of asamalar) {
      stmt.run(
        sablonId, a.sira, a.asama_adi, a.asama_kodu,
        a.renk || '#6b7280', a.ikon || '📋',
        a.aciklama || null, a.tahmini_gun || null
      );
    }

    return this.sablonGetir(sablonId);
  }

  /**
   * Şablon güncelle (aşama ekle/çıkar/sırala)
   */
  sablonGuncelle(sablonId, { sablonAdi, aciklama, asamalar }) {
    const db = getDb();

    // Şablon bilgilerini güncelle
    if (sablonAdi || aciklama) {
      const updates = [];
      const params = [];
      if (sablonAdi) { updates.push('sablon_adi = ?'); params.push(sablonAdi); }
      if (aciklama !== undefined) { updates.push('aciklama = ?'); params.push(aciklama); }
      updates.push("guncelleme_tarihi = datetime('now')");
      params.push(sablonId);
      db.prepare(`UPDATE dongu_sablonlari SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    // Aşamaları güncelle (varsa) — silip yeniden oluştur stratejisi
    if (asamalar && asamalar.length > 0) {
      // Mevcut aşamaları bu şablondan kullanan projelerde sorun olmaması için:
      // Sadece şablon aşamalarını güncelle, proje aşamalarına dokunma
      db.prepare('DELETE FROM dongu_sablon_asamalari WHERE sablon_id = ?').run(sablonId);

      const stmt = db.prepare(`
        INSERT INTO dongu_sablon_asamalari
          (sablon_id, sira, asama_adi, asama_kodu, renk, ikon, aciklama, tahmini_gun)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const a of asamalar) {
        stmt.run(
          sablonId, a.sira, a.asama_adi, a.asama_kodu,
          a.renk || '#6b7280', a.ikon || '📋',
          a.aciklama || null, a.tahmini_gun || null
        );
      }
    }

    return this.sablonGetir(sablonId);
  }

  // ═══════════════════════════════════════════════
  // PROJE AŞAMA YÖNETİMİ
  // ═══════════════════════════════════════════════

  /**
   * Projeye döngü şablonu ata → aşamaları oluştur
   * Proje oluşturulurken veya sonradan çağrılır
   */
  projeDoguAta(projeId, sablonId) {
    const db = getDb();

    // Şablon aşamalarını al
    const sablonAsamalar = db.prepare(`
      SELECT * FROM dongu_sablon_asamalari
      WHERE sablon_id = ? ORDER BY sira
    `).all(sablonId);

    if (sablonAsamalar.length === 0) {
      throw new Error('Şablonda aşama tanımlı değil');
    }

    // Projenin mevcut aşamalarını kontrol et
    const mevcutSayi = db.prepare(
      'SELECT COUNT(*) as sayi FROM proje_asamalari WHERE proje_id = ?'
    ).get(projeId).sayi;

    if (mevcutSayi > 0) {
      throw new Error('Bu projenin zaten aşamaları var. Önce mevcut aşamaları silmeniz gerekir.');
    }

    // Aşamaları oluştur
    const stmt = db.prepare(`
      INSERT INTO proje_asamalari (
        proje_id, sablon_asama_id, sira, asama_adi, asama_kodu,
        renk, ikon, tahmini_gun, durum
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'bekliyor')
    `);

    for (const a of sablonAsamalar) {
      stmt.run(projeId, a.id, a.sira, a.asama_adi, a.asama_kodu, a.renk, a.ikon, a.tahmini_gun);
    }

    // Projeye şablon ID'sini kaydet
    db.prepare(`
      UPDATE projeler SET dongu_sablon_id = ?, guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(sablonId, projeId);

    return this.projeAsamalariGetir(projeId);
  }

  /**
   * Projenin tüm aşamalarını getir
   */
  projeAsamalariGetir(projeId) {
    const db = getDb();
    return db.prepare(`
      SELECT pa.*,
        (SELECT COUNT(*) FROM veri_paketleri vp WHERE vp.proje_asama_id = pa.id) as paket_sayisi,
        (SELECT COUNT(*) FROM dosyalar d WHERE d.proje_asama_id = pa.id AND d.durum = 'aktif') as dosya_sayisi
      FROM proje_asamalari pa
      WHERE pa.proje_id = ?
      ORDER BY pa.sira
    `).all(projeId);
  }

  /**
   * Projenin aktif (current) aşamasını getir
   */
  aktifAsamaGetir(projeId) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM proje_asamalari
      WHERE proje_id = ? AND durum = 'devam_ediyor'
      ORDER BY sira
      LIMIT 1
    `).get(projeId);
  }

  /**
   * Aşamayı başlat
   */
  asamaBaslat(asamaId, { baslatanId, notlar } = {}) {
    const db = getDb();

    const asama = db.prepare('SELECT * FROM proje_asamalari WHERE id = ?').get(asamaId);
    if (!asama) throw new Error('Aşama bulunamadı');

    // Önceki devam eden aşamayı kontrol et
    // Birden fazla aşama aynı anda devam edebilir mi?
    // → Hayır, önceki aşamayı önce tamamla uyarısı verelim
    const devamEden = db.prepare(`
      SELECT * FROM proje_asamalari
      WHERE proje_id = ? AND durum = 'devam_ediyor' AND sira < ?
    `).get(asama.proje_id, asama.sira);

    // Aşamayı başlat
    db.prepare(`
      UPDATE proje_asamalari SET
        durum = 'devam_ediyor',
        baslangic_tarihi = date('now'),
        baslatan_id = ?,
        notlar = CASE WHEN ? IS NOT NULL THEN COALESCE(notlar || char(10), '') || ? ELSE notlar END,
        guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(baslatanId, notlar, notlar, asamaId);

    // Projenin aktif_asama_id'sini güncelle
    db.prepare(`
      UPDATE projeler SET aktif_asama_id = ?, guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(asamaId, asama.proje_id);

    return {
      asama: db.prepare('SELECT * FROM proje_asamalari WHERE id = ?').get(asamaId),
      uyari: devamEden ? `"${devamEden.asama_adi}" aşaması henüz tamamlanmamış.` : null
    };
  }

  /**
   * Aşamayı tamamla
   */
  asamaTamamla(asamaId, { tamamlayanId, tamamlanmaNotu } = {}) {
    const db = getDb();

    const asama = db.prepare('SELECT * FROM proje_asamalari WHERE id = ?').get(asamaId);
    if (!asama) throw new Error('Aşama bulunamadı');

    // Tamamla
    db.prepare(`
      UPDATE proje_asamalari SET
        durum = 'tamamlandi',
        bitis_tarihi = date('now'),
        tamamlayan_id = ?,
        tamamlanma_notu = ?,
        guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(tamamlayanId, tamamlanmaNotu, asamaId);

    // Sonraki aşama var mı? Varsa onu aktif aşama yap (otomatik başlatma)
    const sonraki = db.prepare(`
      SELECT id FROM proje_asamalari
      WHERE proje_id = ? AND sira > ? AND durum = 'bekliyor'
      ORDER BY sira LIMIT 1
    `).get(asama.proje_id, asama.sira);

    if (sonraki) {
      db.prepare(`
        UPDATE projeler SET aktif_asama_id = ?, guncelleme_tarihi = datetime('now')
        WHERE id = ?
      `).run(sonraki.id, asama.proje_id);
    } else {
      // Tüm aşamalar tamamlandı
      db.prepare(`
        UPDATE projeler SET aktif_asama_id = NULL, guncelleme_tarihi = datetime('now')
        WHERE id = ?
      `).run(asama.proje_id);
    }

    return {
      tamamlanan: db.prepare('SELECT * FROM proje_asamalari WHERE id = ?').get(asamaId),
      sonraki_asama: sonraki
        ? db.prepare('SELECT * FROM proje_asamalari WHERE id = ?').get(sonraki.id)
        : null,
      tum_tamamlandi: !sonraki
    };
  }

  /**
   * Aşamayı atla (skip)
   */
  asamaAtla(asamaId, { notu } = {}) {
    const db = getDb();
    db.prepare(`
      UPDATE proje_asamalari SET
        durum = 'atlandi',
        tamamlanma_notu = ?,
        guncelleme_tarihi = datetime('now')
      WHERE id = ?
    `).run(notu || 'Aşama atlandı', asamaId);
  }

  /**
   * Aşama tarihlerini güncelle (planlama)
   */
  asamaTarihGuncelle(asamaId, { planBas, planBit, gercekBas, gercekBit }) {
    const db = getDb();
    const updates = [];
    const params = [];

    if (planBas !== undefined) { updates.push('planlanan_baslangic = ?'); params.push(planBas); }
    if (planBit !== undefined) { updates.push('planlanan_bitis = ?'); params.push(planBit); }
    if (gercekBas !== undefined) { updates.push('baslangic_tarihi = ?'); params.push(gercekBas); }
    if (gercekBit !== undefined) { updates.push('bitis_tarihi = ?'); params.push(gercekBit); }

    if (updates.length === 0) return;

    updates.push("guncelleme_tarihi = datetime('now')");
    params.push(asamaId);

    db.prepare(`UPDATE proje_asamalari SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  // ═══════════════════════════════════════════════
  // VERİ PAKETİ + DOSYA ENTEGRASYONU
  // ═══════════════════════════════════════════════

  /**
   * Projenin aktif aşama ID'sini döndür
   * Veri paketi veya dosya oluşturulurken çağrılır
   */
  aktifAsamaIdGetir(projeId) {
    if (!projeId) return null;

    const db = getDb();
    const asama = db.prepare(`
      SELECT id FROM proje_asamalari
      WHERE proje_id = ? AND durum = 'devam_ediyor'
      ORDER BY sira LIMIT 1
    `).get(projeId);

    return asama?.id || null;
  }

  // ═══════════════════════════════════════════════
  // PROJE İLERLEME HESAPLAMA
  // ═══════════════════════════════════════════════

  /**
   * Projenin genel ilerleme durumu
   */
  projeIlerleme(projeId) {
    const db = getDb();
    const asamalar = this.projeAsamalariGetir(projeId);

    const toplam = asamalar.length;
    if (toplam === 0) return { yuzde: 0, aktif: null, asamalar: [] };

    const tamamlanan = asamalar.filter(a => a.durum === 'tamamlandi').length;
    const atlanan = asamalar.filter(a => a.durum === 'atlandi').length;
    const devamEden = asamalar.find(a => a.durum === 'devam_ediyor');

    // İlerleme yüzdesi: tamamlanan + atlanan / toplam
    const yuzde = Math.round(((tamamlanan + atlanan) / toplam) * 100);

    // Gecikme kontrolü
    const bugun = new Date().toISOString().slice(0, 10);
    const gecikenler = asamalar.filter(a => {
      return a.durum === 'devam_ediyor' && a.planlanan_bitis && a.planlanan_bitis < bugun;
    });

    return {
      yuzde,
      toplam_asama: toplam,
      tamamlanan,
      devam_eden: devamEden ? devamEden.asama_adi : null,
      aktif_asama: devamEden || null,
      geciken_asamalar: gecikenler,
      asamalar,
    };
  }
}

module.exports = new DonguService();
```

---

## Adım 3 — Veri Paketi Entegrasyonu

Veri paketi oluşturulurken aktif aşama otomatik bağlanır.

### `veriPaketiService.js` — `olustur` Fonksiyonunu Güncelle

```javascript
// Mevcut veriPaketiService.js'deki olustur fonksiyonuna ekle:

const donguService = require('./donguService');

/**
 * Yeni veri paketi oluştur
 * Aktif aşama otomatik bağlanır
 */
olustur({ paketTipi, personelId, ekipId, projeId, bolgeId, baslik, notlar, kaynak = 'web' }) {
  const db = getDb();

  // ─── YENİ: Aktif aşamayı otomatik bağla ───
  const aktifAsamaId = donguService.aktifAsamaIdGetir(projeId);

  const result = db.prepare(`
    INSERT INTO veri_paketleri (
      paket_tipi, personel_id, ekip_id, proje_id, bolge_id,
      baslik, notlar, kaynak, proje_asama_id, durum
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'devam_ediyor')
  `).run(paketTipi, personelId, ekipId, projeId, bolgeId, baslik, notlar, kaynak, aktifAsamaId);

  const paket = db.prepare('SELECT * FROM veri_paketleri WHERE id = ?').get(result.lastInsertRowid);
  return paket;
}
```

### `dosyaService.js` — `dosyaYukle` Fonksiyonunu Güncelle

```javascript
// Mevcut dosyaService.js'deki dosyaYukle fonksiyonunun parametre listesine ekle:

const donguService = require('./donguService');

async dosyaYukle(buffer, {
  // ... mevcut parametreler ...
  projeAsamaId = null,   // ← YENİ: Açıkça belirtilmezse otomatik bulunur
}) {
  // ... mevcut kod ...

  // ─── YENİ: Aktif aşamayı otomatik bağla ───
  if (!projeAsamaId && projeId) {
    projeAsamaId = donguService.aktifAsamaIdGetir(projeId);
  }

  // INSERT'e proje_asama_id ekle
  // ... mevcut INSERT sorgusuna proje_asama_id sütununu ekle ...
}
```

---

## Adım 4 — API Endpoint'leri

### `server/routes/dongu.js`

```javascript
const express = require('express');
const router = express.Router();
const donguService = require('../services/donguService');

// ═══════════════════════════════════════════════
// ŞABLON ENDPOINT'LERİ
// ═══════════════════════════════════════════════

// GET /api/dongu/sablon — Tüm şablonlar (aşamalarıyla)
router.get('/sablon', (req, res) => {
  try {
    const sablonlar = donguService.sablonlariListele();
    res.json({ success: true, data: sablonlar });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dongu/sablon/:id — Tek şablon detay
router.get('/sablon/:id', (req, res) => {
  try {
    const sablon = donguService.sablonGetir(parseInt(req.params.id));
    if (!sablon) return res.status(404).json({ success: false, error: 'Şablon bulunamadı' });
    res.json({ success: true, data: sablon });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/dongu/sablon — Yeni şablon oluştur
router.post('/sablon', (req, res) => {
  try {
    const sablon = donguService.sablonOlustur(req.body);
    res.json({ success: true, data: sablon });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/dongu/sablon/:id — Şablon güncelle
router.put('/sablon/:id', (req, res) => {
  try {
    const sablon = donguService.sablonGuncelle(parseInt(req.params.id), req.body);
    res.json({ success: true, data: sablon });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════
// PROJE AŞAMA ENDPOINT'LERİ
// ═══════════════════════════════════════════════

// POST /api/dongu/proje/:projeId/ata — Projeye şablon ata
router.post('/proje/:projeId/ata', (req, res) => {
  try {
    const asamalar = donguService.projeDoguAta(
      parseInt(req.params.projeId),
      parseInt(req.body.sablon_id)
    );
    res.json({ success: true, data: asamalar });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dongu/proje/:projeId — Projenin aşamalarını getir
router.get('/proje/:projeId', (req, res) => {
  try {
    const asamalar = donguService.projeAsamalariGetir(parseInt(req.params.projeId));
    res.json({ success: true, data: asamalar });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dongu/proje/:projeId/ilerleme — Proje ilerleme durumu
router.get('/proje/:projeId/ilerleme', (req, res) => {
  try {
    const ilerleme = donguService.projeIlerleme(parseInt(req.params.projeId));
    res.json({ success: true, data: ilerleme });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/dongu/asama/:id/baslat — Aşamayı başlat
router.put('/asama/:id/baslat', (req, res) => {
  try {
    const sonuc = donguService.asamaBaslat(parseInt(req.params.id), req.body);
    res.json({ success: true, data: sonuc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/dongu/asama/:id/tamamla — Aşamayı tamamla
router.put('/asama/:id/tamamla', (req, res) => {
  try {
    const sonuc = donguService.asamaTamamla(parseInt(req.params.id), req.body);
    res.json({ success: true, data: sonuc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/dongu/asama/:id/atla — Aşamayı atla
router.put('/asama/:id/atla', (req, res) => {
  try {
    donguService.asamaAtla(parseInt(req.params.id), req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/dongu/asama/:id/tarih — Aşama tarih güncelle
router.put('/asama/:id/tarih', (req, res) => {
  try {
    donguService.asamaTarihGuncelle(parseInt(req.params.id), req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

### Route Kaydı

```javascript
// server/server.js'e ekle
const donguRoutes = require('./routes/dongu');
app.use('/api/dongu', donguRoutes);
```

---

## Adım 5 — Frontend: Proje Detay Sayfasında Timeline

Proje detay sayfasına "Yaşam Döngüsü" bölümü ekle.

### Timeline Bileşeni: `client/src/components/ProjeDongu.jsx`

```jsx
import React, { useState, useEffect } from 'react';

// ─── DURUM STİLLERİ ────────────────────────────
const DURUM_STILLER = {
  bekliyor:      { bg: '#f3f4f6', border: '#d1d5db', text: '#6b7280', label: 'Bekliyor', ikon: '⏳' },
  devam_ediyor:  { bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8', label: 'Devam Ediyor', ikon: '🔄' },
  tamamlandi:    { bg: '#dcfce7', border: '#22c55e', text: '#15803d', label: 'Tamamlandı', ikon: '✅' },
  atlandi:       { bg: '#fef9c3', border: '#eab308', text: '#a16207', label: 'Atlandı', ikon: '⏭️' },
};

function getDurumStil(durum) {
  return DURUM_STILLER[durum] || DURUM_STILLER.bekliyor;
}

// ─── TEK AŞAMA KARTI ───────────────────────────
function AsamaKarti({ asama, onBaslat, onTamamla, onAtla }) {
  const stil = getDurumStil(asama.durum);
  const aktif = asama.durum === 'devam_ediyor';

  // Gün hesapla
  let gecenGun = null;
  if (asama.baslangic_tarihi) {
    const bas = new Date(asama.baslangic_tarihi);
    const bit = asama.bitis_tarihi ? new Date(asama.bitis_tarihi) : new Date();
    gecenGun = Math.ceil((bit - bas) / (1000 * 60 * 60 * 24));
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      gap: '12px',
    }}>
      {/* Sol — Timeline çizgisi */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '40px',
        flexShrink: 0,
      }}>
        {/* Daire */}
        <div style={{
          width: aktif ? '36px' : '28px',
          height: aktif ? '36px' : '28px',
          borderRadius: '50%',
          background: stil.bg,
          border: `3px solid ${stil.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: aktif ? '16px' : '13px',
          flexShrink: 0,
          transition: 'all 0.2s',
          boxShadow: aktif ? `0 0 0 4px ${stil.border}30` : 'none',
        }}>
          {asama.ikon || stil.ikon}
        </div>
        {/* Dikey çizgi */}
        <div style={{
          flex: 1,
          width: '2px',
          background: asama.durum === 'tamamlandi' ? '#22c55e' : '#e5e7eb',
          minHeight: '20px',
        }} />
      </div>

      {/* Sağ — İçerik */}
      <div style={{
        flex: 1,
        background: aktif ? stil.bg : 'white',
        border: `1px solid ${aktif ? stil.border : '#e5e7eb'}`,
        borderRadius: '10px',
        padding: '12px 16px',
        marginBottom: '8px',
        transition: 'all 0.2s',
      }}>
        {/* Başlık satırı */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{
              fontSize: '11px',
              color: '#9ca3af',
              fontWeight: 600,
            }}>
              {asama.sira}. AŞAMA
            </span>
            <div style={{
              fontSize: '15px',
              fontWeight: 600,
              color: stil.text,
            }}>
              {asama.asama_adi}
            </div>
          </div>

          {/* Durum badge */}
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: '20px',
            background: stil.bg,
            color: stil.text,
            border: `1px solid ${stil.border}`,
          }}>
            {stil.ikon} {stil.label}
          </span>
        </div>

        {/* Tarih bilgisi */}
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
          {asama.baslangic_tarihi && (
            <span>📅 {asama.baslangic_tarihi}</span>
          )}
          {asama.bitis_tarihi && (
            <span> → {asama.bitis_tarihi}</span>
          )}
          {gecenGun !== null && (
            <span style={{ marginLeft: '8px', color: '#9ca3af' }}>
              ({gecenGun} gün)
            </span>
          )}
          {!asama.baslangic_tarihi && asama.tahmini_gun && (
            <span style={{ color: '#9ca3af' }}>Tahmini: ~{asama.tahmini_gun} gün</span>
          )}
        </div>

        {/* İstatistikler */}
        {(asama.paket_sayisi > 0 || asama.dosya_sayisi > 0) && (
          <div style={{ marginTop: '6px', fontSize: '12px', color: '#6b7280' }}>
            {asama.paket_sayisi > 0 && <span>📦 {asama.paket_sayisi} veri paketi</span>}
            {asama.dosya_sayisi > 0 && <span style={{ marginLeft: '8px' }}>📎 {asama.dosya_sayisi} dosya</span>}
          </div>
        )}

        {/* Aksiyon butonları */}
        <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
          {asama.durum === 'bekliyor' && (
            <>
              <button
                onClick={() => onBaslat(asama.id)}
                style={{
                  padding: '5px 14px', fontSize: '12px', fontWeight: 600,
                  background: '#2563eb', color: 'white',
                  border: 'none', borderRadius: '6px', cursor: 'pointer',
                }}
              >
                ▶ Başlat
              </button>
              <button
                onClick={() => onAtla(asama.id)}
                style={{
                  padding: '5px 14px', fontSize: '12px',
                  background: 'white', color: '#6b7280',
                  border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer',
                }}
              >
                Atla
              </button>
            </>
          )}
          {asama.durum === 'devam_ediyor' && (
            <button
              onClick={() => onTamamla(asama.id)}
              style={{
                padding: '5px 14px', fontSize: '12px', fontWeight: 600,
                background: '#16a34a', color: 'white',
                border: 'none', borderRadius: '6px', cursor: 'pointer',
              }}
            >
              ✅ Tamamla
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── İLERLEME ÇUBUĞU ───────────────────────────
function IlerlemeBar({ ilerleme }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '6px',
      }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
          Genel İlerleme
        </span>
        <span style={{ fontSize: '20px', fontWeight: 700, color: '#2563eb' }}>
          %{ilerleme.yuzde}
        </span>
      </div>
      <div style={{
        height: '8px',
        background: '#e5e7eb',
        borderRadius: '4px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${ilerleme.yuzde}%`,
          height: '100%',
          background: ilerleme.yuzde === 100 ? '#22c55e' : '#2563eb',
          borderRadius: '4px',
          transition: 'width 0.3s',
        }} />
      </div>
      <div style={{ marginTop: '4px', fontSize: '12px', color: '#6b7280' }}>
        {ilerleme.tamamlanan}/{ilerleme.toplam_asama} aşama tamamlandı
        {ilerleme.devam_eden && ` • Şu an: ${ilerleme.devam_eden}`}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// ANA BİLEŞEN
// ═══════════════════════════════════════════════
export default function ProjeDongu({ projeId }) {
  const [ilerleme, setIlerleme] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  const verileriYukle = async () => {
    try {
      const res = await fetch(`/api/dongu/proje/${projeId}/ilerleme`);
      const json = await res.json();
      if (json.success) setIlerleme(json.data);
    } catch (err) {
      console.error('Döngü yükleme hatası:', err);
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => { verileriYukle(); }, [projeId]);

  const asamaBaslat = async (asamaId) => {
    await fetch(`/api/dongu/asama/${asamaId}/baslat`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    verileriYukle();
  };

  const asamaTamamla = async (asamaId) => {
    await fetch(`/api/dongu/asama/${asamaId}/tamamla`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    verileriYukle();
  };

  const asamaAtla = async (asamaId) => {
    await fetch(`/api/dongu/asama/${asamaId}/atla`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    verileriYukle();
  };

  if (yukleniyor) return <div style={{ padding: '20px', color: '#6b7280' }}>Yükleniyor...</div>;

  if (!ilerleme || ilerleme.asamalar.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>
        <p>Bu projeye henüz döngü atanmamış.</p>
        <p style={{ fontSize: '13px' }}>Proje düzenleme sayfasından bir döngü şablonu seçin.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      {/* İlerleme çubuğu */}
      <IlerlemeBar ilerleme={ilerleme} />

      {/* Timeline */}
      <div style={{ marginTop: '8px' }}>
        {ilerleme.asamalar.map(asama => (
          <AsamaKarti
            key={asama.id}
            asama={asama}
            onBaslat={asamaBaslat}
            onTamamla={asamaTamamla}
            onAtla={asamaAtla}
          />
        ))}
      </div>
    </div>
  );
}
```

### Proje Detay Sayfasına Entegre Et

```jsx
// Mevcut proje detay sayfasında (ProjeDetay.jsx veya benzeri):
import ProjeDongu from '../components/ProjeDongu';

// Tab veya bölüm olarak ekle:
<ProjeDongu projeId={proje.id} />
```

---

## Adım 6 — Frontend: Döngü Şablon Yönetimi (Ayarlar)

Ayarlar sayfasına "Döngü Şablonları" sekmesi ekle.

### `client/src/components/DonguSablonYonetimi.jsx`

```jsx
import React, { useState, useEffect } from 'react';

// Varsayılan renkler
const RENKLER = ['#6366f1','#8b5cf6','#0ea5e9','#f59e0b','#10b981','#3b82f6','#14b8a6','#f43f5e','#ec4899','#84cc16'];
const IKONLAR = ['📍','📐','📦','🔧','🗺️','💰','✅','🔴','📋','⚡','🏗️','📊','🔍','📝'];

export default function DonguSablonYonetimi() {
  const [sablonlar, setSablonlar] = useState([]);
  const [secili, setSecili] = useState(null);      // Düzenlenen şablon
  const [yeniMod, setYeniMod] = useState(false);   // Yeni şablon oluşturma modu

  // Şablon form state
  const [form, setForm] = useState({
    sablonAdi: '',
    sablonKodu: '',
    aciklama: '',
    asamalar: [],
  });

  // Yükle
  useEffect(() => {
    fetch('/api/dongu/sablon')
      .then(r => r.json())
      .then(j => { if (j.success) setSablonlar(j.data); });
  }, []);

  // Şablon seç → düzenleme formuna yükle
  const sablonSec = (sablon) => {
    setSecili(sablon);
    setYeniMod(false);
    setForm({
      sablonAdi: sablon.sablon_adi,
      sablonKodu: sablon.sablon_kodu,
      aciklama: sablon.aciklama || '',
      asamalar: sablon.asamalar.map(a => ({
        sira: a.sira,
        asama_adi: a.asama_adi,
        asama_kodu: a.asama_kodu,
        renk: a.renk,
        ikon: a.ikon,
        tahmini_gun: a.tahmini_gun,
      })),
    });
  };

  // Yeni şablon başlat
  const yeniBaslat = () => {
    setSecili(null);
    setYeniMod(true);
    setForm({
      sablonAdi: '',
      sablonKodu: '',
      aciklama: '',
      asamalar: [
        { sira: 1, asama_adi: '', asama_kodu: '', renk: RENKLER[0], ikon: '📋', tahmini_gun: null },
      ],
    });
  };

  // Aşama ekle
  const asamaEkle = () => {
    const yeniSira = form.asamalar.length + 1;
    setForm({
      ...form,
      asamalar: [...form.asamalar, {
        sira: yeniSira,
        asama_adi: '',
        asama_kodu: '',
        renk: RENKLER[(yeniSira - 1) % RENKLER.length],
        ikon: '📋',
        tahmini_gun: null,
      }],
    });
  };

  // Aşama sil
  const asamaSil = (sira) => {
    const yeni = form.asamalar
      .filter(a => a.sira !== sira)
      .map((a, i) => ({ ...a, sira: i + 1 }));
    setForm({ ...form, asamalar: yeni });
  };

  // Aşama güncelle
  const asamaGuncelle = (sira, alan, deger) => {
    setForm({
      ...form,
      asamalar: form.asamalar.map(a =>
        a.sira === sira ? { ...a, [alan]: deger } : a
      ),
    });
  };

  // Aşama adından otomatik kod üret
  const kodUret = (adi) => {
    return adi
      .toLowerCase()
      .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
      .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  };

  // Kaydet
  const kaydet = async () => {
    const body = {
      sablonAdi: form.sablonAdi,
      sablonKodu: form.sablonKodu,
      aciklama: form.aciklama,
      asamalar: form.asamalar.map(a => ({
        ...a,
        asama_kodu: a.asama_kodu || kodUret(a.asama_adi),
      })),
    };

    let res;
    if (yeniMod) {
      res = await fetch('/api/dongu/sablon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      res = await fetch(`/api/dongu/sablon/${secili.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    const json = await res.json();
    if (json.success) {
      // Listeyi yenile
      const listRes = await fetch('/api/dongu/sablon');
      const listJson = await listRes.json();
      if (listJson.success) setSablonlar(listJson.data);

      if (yeniMod) {
        setYeniMod(false);
        setSecili(json.data);
      }
    }
  };

  return (
    <div style={{ display: 'flex', gap: '20px', height: '100%' }}>
      {/* Sol: Şablon Listesi */}
      <div style={{ width: '240px', borderRight: '1px solid #e5e7eb', paddingRight: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Şablonlar</h3>
          <button
            onClick={yeniBaslat}
            style={{
              padding: '4px 10px', fontSize: '12px',
              background: '#2563eb', color: 'white',
              border: 'none', borderRadius: '4px', cursor: 'pointer',
            }}
          >
            + Yeni
          </button>
        </div>
        {sablonlar.map(s => (
          <div
            key={s.id}
            onClick={() => sablonSec(s)}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              marginBottom: '4px',
              background: secili?.id === s.id ? '#eff6ff' : 'transparent',
              border: secili?.id === s.id ? '1px solid #bfdbfe' : '1px solid transparent',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '14px' }}>{s.sablon_adi}</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              {s.asamalar.length} aşama • {s.sablon_kodu}
            </div>
          </div>
        ))}
      </div>

      {/* Sağ: Düzenleme Formu */}
      <div style={{ flex: 1 }}>
        {!secili && !yeniMod ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
            Bir şablon seçin veya yeni oluşturun
          </div>
        ) : (
          <div>
            {/* Şablon bilgileri */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <input
                value={form.sablonAdi}
                onChange={e => setForm({ ...form, sablonAdi: e.target.value })}
                placeholder="Şablon Adı"
                style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
              />
              <input
                value={form.sablonKodu}
                onChange={e => setForm({ ...form, sablonKodu: e.target.value.toUpperCase() })}
                placeholder="Kod"
                disabled={!yeniMod}
                style={{ width: '80px', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', textAlign: 'center' }}
              />
            </div>

            {/* Aşamalar */}
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>Aşamalar</h4>
              {form.asamalar.map(a => (
                <div key={a.sira} style={{
                  display: 'flex', gap: '8px', alignItems: 'center',
                  padding: '8px', marginBottom: '4px',
                  background: '#f9fafb', borderRadius: '6px',
                }}>
                  <span style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: a.renk, color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700, flexShrink: 0,
                  }}>
                    {a.sira}
                  </span>

                  {/* İkon seçimi */}
                  <select
                    value={a.ikon}
                    onChange={e => asamaGuncelle(a.sira, 'ikon', e.target.value)}
                    style={{ width: '50px', padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px' }}
                  >
                    {IKONLAR.map(ikon => (
                      <option key={ikon} value={ikon}>{ikon}</option>
                    ))}
                  </select>

                  <input
                    value={a.asama_adi}
                    onChange={e => asamaGuncelle(a.sira, 'asama_adi', e.target.value)}
                    placeholder="Aşama Adı"
                    style={{ flex: 1, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                  />

                  <input
                    value={a.tahmini_gun || ''}
                    onChange={e => asamaGuncelle(a.sira, 'tahmini_gun', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Gün"
                    type="number"
                    style={{ width: '56px', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', textAlign: 'center' }}
                  />

                  {/* Renk seçimi */}
                  <input
                    type="color"
                    value={a.renk}
                    onChange={e => asamaGuncelle(a.sira, 'renk', e.target.value)}
                    style={{ width: '32px', height: '32px', border: 'none', cursor: 'pointer' }}
                  />

                  <button
                    onClick={() => asamaSil(a.sira)}
                    style={{
                      width: '28px', height: '28px',
                      background: '#fee2e2', color: '#dc2626',
                      border: 'none', borderRadius: '4px', cursor: 'pointer',
                      fontSize: '14px',
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                onClick={asamaEkle}
                style={{
                  padding: '6px 14px', fontSize: '12px',
                  background: 'white', color: '#2563eb',
                  border: '1px dashed #93c5fd', borderRadius: '6px',
                  cursor: 'pointer', marginTop: '4px', width: '100%',
                }}
              >
                + Aşama Ekle
              </button>
            </div>

            {/* Kaydet */}
            <button
              onClick={kaydet}
              disabled={!form.sablonAdi || form.asamalar.length === 0}
              style={{
                padding: '10px 24px', fontSize: '14px', fontWeight: 600,
                background: '#2563eb', color: 'white',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
              }}
            >
              {yeniMod ? '✅ Şablon Oluştur' : '💾 Güncelle'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Beklenen Görünüm

### Proje Detay — Yaşam Döngüsü

```
┌──────────────────────────────────────────────────────────┐
│ YB-2025-001 — Bafra YB                                  │
│ [Genel] [Döngü] [Dosyalar] [Veri Paketleri] [Ekip]    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Genel İlerleme                                   %37   │
│  ████████░░░░░░░░░░░░░░░                                │
│  3/8 aşama tamamlandı • Şu an: Malzeme Talep           │
│                                                          │
│  ● 1. AŞAMA                                            │
│  │ 📍 Yer Teslimi                        ✅ Tamamlandı  │
│  │ 📅 01.01.2026 → 05.01.2026 (5 gün)                  │
│  │                                                      │
│  ● 2. AŞAMA                                            │
│  │ 📐 Proje Aşaması                      ✅ Tamamlandı  │
│  │ 📅 06.01.2026 → 20.01.2026 (15 gün)                 │
│  │ 📦 2 veri paketi  📎 5 dosya                        │
│  │                                                      │
│  ◉ 3. AŞAMA                                            │
│  │ 📦 Malzeme Talep                      🔄 Devam Ediyor│
│  │ 📅 21.01.2026 → —  (23 gün)                         │
│  │ 📦 4 veri paketi  📎 12 dosya                       │
│  │ [✅ Tamamla]                                         │
│  │                                                      │
│  ○ 4. AŞAMA                                            │
│  │ 🔧 Yapım                              ⏳ Bekliyor   │
│  │ Tahmini: ~30 gün                                     │
│  │ [▶ Başlat] [Atla]                                   │
│  │                                                      │
│  ○ 5. AŞAMA                                            │
│  │ 🗺️ CBS                                ⏳ Bekliyor    │
│  ⋮                                                      │
└──────────────────────────────────────────────────────────┘
```

### Ayarlar — Döngü Şablon Yönetimi

```
┌────────────────────┬───────────────────────────────────────┐
│ Şablonlar  [+Yeni] │ KET Döngüsü                          │
│                    │                                       │
│ ▸ KET Döngüsü     │ Kod: KET                              │
│   8 aşama          │                                       │
│                    │ Aşamalar:                              │
│ ▸ YB Döngüsü      │ ① 📍 Yer Teslimi         ~5 gün  🎨 ✕│
│   6 aşama          │ ② 📐 Proje Aşaması       ~15 gün 🎨 ✕│
│                    │ ③ 📦 Malzeme Talep        ~10 gün 🎨 ✕│
│                    │ ④ 🔧 Yapım               ~30 gün 🎨 ✕│
│                    │ ⑤ 🗺️ CBS                  ~5 gün  🎨 ✕│
│                    │ ⑥ 💰 Hak Ediş            ~10 gün 🎨 ✕│
│                    │ ⑦ ✅ Geçici Kabul          ~15 gün 🎨 ✕│
│                    │ ⑧ 🔴 G.K. Eksikleri       ~20 gün 🎨 ✕│
│                    │                                       │
│                    │ [+ Aşama Ekle]                        │
│                    │                                       │
│                    │ [💾 Güncelle]                          │
└────────────────────┴───────────────────────────────────────┘
```

---

## Kontrol Listesi

**Veritabanı:**
- [ ] `dongu_sablonlari` tablosu oluşturuldu
- [ ] `dongu_sablon_asamalari` tablosu oluşturuldu
- [ ] `proje_asamalari` tablosu oluşturuldu
- [ ] `projeler` tablosuna `dongu_sablon_id`, `aktif_asama_id` eklendi
- [ ] `veri_paketleri` tablosuna `proje_asama_id` eklendi
- [ ] `dosyalar` tablosuna `proje_asama_id` eklendi
- [ ] KET ve YB varsayılan şablonları seed data olarak eklendi
- [ ] İndeksler oluşturuldu

**Backend:**
- [ ] `donguService.js` — Şablon CRUD + proje aşama yönetimi çalışıyor
- [ ] `GET /api/dongu/sablon` → Şablon listesi dönüyor
- [ ] `POST /api/dongu/sablon` → Yeni şablon oluşturma
- [ ] `PUT /api/dongu/sablon/:id` → Şablon güncelleme
- [ ] `POST /api/dongu/proje/:id/ata` → Projeye şablon atama → aşamalar oluşuyor
- [ ] `GET /api/dongu/proje/:id` → Proje aşamaları dönüyor
- [ ] `GET /api/dongu/proje/:id/ilerleme` → İlerleme hesaplaması doğru
- [ ] `PUT /api/dongu/asama/:id/baslat` → Aşama başlatma çalışıyor
- [ ] `PUT /api/dongu/asama/:id/tamamla` → Aşama tamamlama çalışıyor

**Veri Paketi Entegrasyonu:**
- [ ] Veri paketi oluşturulduğunda aktif aşama otomatik bağlanıyor
- [ ] Dosya yüklendiğinde aktif aşama otomatik bağlanıyor

**Frontend:**
- [ ] Proje detay sayfasında "Döngü" sekmesi/bölümü var
- [ ] Timeline görünümü çalışıyor (ilerleme bar + aşama kartları)
- [ ] Başlat/Tamamla/Atla butonları çalışıyor
- [ ] Ayarlar sayfasında "Döngü Şablonları" sekmesi var
- [ ] Yeni şablon oluşturma çalışıyor (aşama ekle/sil/sırala)
- [ ] Mevcut şablon düzenleme çalışıyor

**Test Senaryoları:**
- [ ] KET şablonu ile proje oluştur → 8 aşama otomatik geldi
- [ ] Aşama 1'i başlat → durum "devam_ediyor"
- [ ] Aşama 1'i tamamla → Aşama 2 aktif oldu
- [ ] Veri paketi oluştur → aktif aşama otomatik bağlandı
- [ ] Özel şablon oluştur (3 aşamalı) → projeye ata → çalışıyor
