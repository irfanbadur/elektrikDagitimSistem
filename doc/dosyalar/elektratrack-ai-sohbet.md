# ElektraTrack — AI Sohbet Modülü

## Amaç

Kullanıcıların doğal dilde sistemle sohbet etmesini sağlayan modül. Hem soru sorar hem komut verir — tek chat'te.

**Ön koşul:** `ai-operasyon-birlesik.md` okunmuş ve uygulanmış olmalı. Bu modül, oradaki provider altyapısını ve aksiyon registry'sini kullanır.

```
Kullanıcı: "Koşu köy projesinde durum ne?"
AI: "Koşu köy (YB-2025-003) yapım aşamasında. 12/18 direk kurulmuş,
     3x35 kablo %70 çekilmiş. Son saha raporu 2 gün önce Ekip-2'den geldi.
     Tahmini tamamlanma: 2 hafta."

Kullanıcı: "Oraya 5 adet N-12 direk gönder ekip-2 ile"
AI: [Komut algılandı → AiOnayPaneli açılır]
    📤 Depo Çıkış: N-12 direk × 5 → Koşu köy, Ekip-2
    [✅ Onayla]  [❌ İptal]
```

---

## Temel Kararlar

| Karar | Seçim |
|-------|-------|
| Sorgulama yöntemi | **AI SQL üretir** (SELECT-only güvenlik filtresi) |
| Sayfa bağlamı | **Bağlamı bilir** + kullanıcı değiştirebilir |
| Komut desteği | **Hibrit** — aynı chat'te soru + komut |
| Sohbet geçmişi | **Kullanıcı bazlı**, DB'de saklanır |
| UI konumları | **3 yerde**: Ayrı sayfa + Floating panel + Veri paketi içi |
| Tablo erişimi | **Tüm sistem** — projeler, malzemeler, personel, dosyalar, hepsi |

---

## Mimari

```
┌─────────────────────────────────────────────────────────────────┐
│ Kullanıcı Mesajı                                                │
│ "Koşu köy projesinde kaç direk kurulmuş?"                       │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
              ┌─────────────────┐
              │  MOD TESPİTİ    │
              │  Soru mu?       │
              │  Komut mu?      │
              │  Sohbet mi?     │
              └────┬───────┬────┘
                   ↓       ↓
            ┌──────────┐ ┌──────────────┐
            │  SORGU   │ │   KOMUT      │
            │  MODU    │ │   MODU       │
            │          │ │              │
            │ SQL üret │ │ Aksiyon      │
            │ Çalıştır │ │ planla       │
            │ Özetle   │ │ (mevcut AI   │
            │          │ │  operasyon)  │
            └────┬─────┘ └──────┬───────┘
                 ↓              ↓
            ┌──────────┐ ┌──────────────┐
            │ Metin    │ │ AiOnayPaneli │
            │ yanıt    │ │ (onay bekle) │
            └──────────┘ └──────────────┘
```

---

## Adım 1 — Veritabanı

### Tablo: `ai_sohbetler` — Sohbet Oturumları

```sql
CREATE TABLE IF NOT EXISTS ai_sohbetler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kullanici_id INTEGER NOT NULL,
    baslik TEXT,                              -- Otomatik veya kullanıcı tarafından
    baglam_tipi TEXT,                        -- 'genel', 'proje', 'malzeme', 'personel'
    baglam_id INTEGER,                       -- İlişkili kayıt ID (proje_id vb.)
    baglam_meta TEXT,                        -- JSON: { sayfaYolu, projeNo, ekipId ... }
    mesaj_sayisi INTEGER DEFAULT 0,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    son_mesaj_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    durum TEXT DEFAULT 'aktif',              -- 'aktif', 'arsivlendi'
    FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id)
);

CREATE INDEX IF NOT EXISTS idx_sohbet_kullanici ON ai_sohbetler(kullanici_id);
CREATE INDEX IF NOT EXISTS idx_sohbet_tarih ON ai_sohbetler(son_mesaj_tarihi);
```

### Tablo: `ai_mesajlar` — Mesaj Geçmişi

```sql
CREATE TABLE IF NOT EXISTS ai_mesajlar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sohbet_id INTEGER NOT NULL,
    rol TEXT NOT NULL,                       -- 'kullanici', 'asistan', 'sistem'
    icerik TEXT NOT NULL,                    -- Mesaj metni
    mesaj_tipi TEXT DEFAULT 'metin',         -- 'metin', 'sorgu', 'komut', 'hata'
    meta TEXT,                               -- JSON: { sql, sonucSayisi, aksiyonPlan, provider }
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sohbet_id) REFERENCES ai_sohbetler(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mesaj_sohbet ON ai_mesajlar(sohbet_id);
```

---

## Adım 2 — SQL Güvenlik Katmanı

AI'ın ürettiği SQL'i çalıştırmadan önce güvenlik kontrolü. **Sadece SELECT izin verilir.**

### `server/services/ai/sqlGuvenlik.js`

```javascript
/**
 * SQL GÜVENLİK FİLTRESİ
 *
 * AI'ın ürettiği SQL'i çalıştırmadan önce kontrol eder.
 * Kural basit: Sadece SELECT. Geri kalan her şey engellenir.
 */

// Kesinlikle engellenen anahtar kelimeler
const YASAKLI = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE',
  'TRUNCATE', 'REPLACE', 'GRANT', 'REVOKE', 'EXEC',
  'ATTACH', 'DETACH', 'PRAGMA', 'VACUUM', 'REINDEX',
];

// Hassas sütunlar (çıktıda maskelenir)
const HASSAS_SUTUNLAR = ['sifre_hash', 'api_key', 'token'];

function sqlKontrol(sql) {
  if (!sql || typeof sql !== 'string') {
    return { gecerli: false, sebep: 'SQL boş' };
  }

  const temiz = sql.trim().toUpperCase();

  // 1. SELECT ile başlamalı
  if (!temiz.startsWith('SELECT')) {
    return { gecerli: false, sebep: 'Sadece SELECT sorguları çalıştırılabilir' };
  }

  // 2. Yasaklı kelime kontrolü
  for (const yasak of YASAKLI) {
    const regex = new RegExp(`\\b${yasak}\\b`, 'i');
    if (regex.test(sql)) {
      return { gecerli: false, sebep: `"${yasak}" ifadesi kullanılamaz` };
    }
  }

  // 3. Noktalı virgül — birden fazla statement engelle
  const statementSayisi = sql.split(';').filter(s => s.trim()).length;
  if (statementSayisi > 1) {
    return { gecerli: false, sebep: 'Tek sorguda birden fazla statement çalıştırılamaz' };
  }

  // 4. Hassas sütun kontrolü — uyarı ver
  const hassasBulunan = HASSAS_SUTUNLAR.filter(s =>
    sql.toLowerCase().includes(s.toLowerCase())
  );

  return {
    gecerli: true,
    uyarilar: hassasBulunan.length > 0
      ? [`Hassas sütunlar maskelenecek: ${hassasBulunan.join(', ')}`]
      : [],
  };
}

/**
 * SQL sonuçlarından hassas verileri maskele
 */
function sonucMaskele(rows) {
  return rows.map(row => {
    const temiz = { ...row };
    for (const sutun of HASSAS_SUTUNLAR) {
      if (temiz[sutun]) temiz[sutun] = '***';
    }
    return temiz;
  });
}

/**
 * SQL'i güvenli çalıştır (max 100 satır)
 */
function guvenliCalistir(db, sql) {
  const kontrol = sqlKontrol(sql);
  if (!kontrol.gecerli) {
    return { basarili: false, hata: kontrol.sebep, satirlar: [] };
  }

  try {
    // LIMIT yoksa ekle (max 100)
    let guvenliSql = sql.trim();
    if (!guvenliSql.toUpperCase().includes('LIMIT')) {
      guvenliSql = guvenliSql.replace(/;?\s*$/, ' LIMIT 100');
    }

    const satirlar = db.prepare(guvenliSql).all();
    return {
      basarili: true,
      satirlar: sonucMaskele(satirlar),
      satirSayisi: satirlar.length,
      uyarilar: kontrol.uyarilar || [],
    };
  } catch (err) {
    return { basarili: false, hata: err.message, satirlar: [] };
  }
}

module.exports = { sqlKontrol, sonucMaskele, guvenliCalistir };
```

---

## Adım 3 — DB Şema Bilgisi (AI'a verilecek)

AI'ın doğru SQL yazabilmesi için tablo yapılarını bilmesi lazım.

### `server/services/ai/dbSema.js`

```javascript
/**
 * DB ŞEMA BİLGİSİ
 *
 * AI'a sistem promptunda verilir, böylece doğru SQL üretebilir.
 * Tablo yapıları değiştiğinde burası güncellenmeli.
 */

const DB_SEMA = `
VERITABANI ŞEMASI (SQLite):

-- Projeler
projeler (id, proje_no, musteri_adi, proje_tipi, bolge_adi, il, ilce, mahalle_koy, durum, baslama_tarihi, bitis_tarihi, notlar, olusturma_tarihi)
-- proje_tipi: 'YB' (Yapı Bağlantı), 'KET' (Küçük Ek Tesis)
-- durum: 'planlanan', 'devam_eden', 'tamamlanan', 'iptal'

-- Proje Aşamaları
proje_asamalari (id, proje_id, asama_adi, sira, durum, baslangic_tarihi, bitis_tarihi, notlar)
-- durum: 'bekliyor', 'aktif', 'tamamlandi', 'atlandi'
-- Tipik aşamalar: Keşif, Proje, İhale, Malzeme, Yapım, CBS, Geçici Kabul, Kesin Kabul

-- Malzemeler (Depo Stok)
malzemeler (id, malzeme_kodu, ad, birim, stok_miktari, min_stok, kategori, aciklama, olusturma_tarihi)
-- Stok miktarı trigger ile otomatik güncellenir

-- Malzeme Hareketleri
malzeme_hareketleri (id, malzeme_id, hareket_tipi, miktar, birim, tarih, proje_id, ekip_id, kaynak_hedef, irsaliye_no, notlar, islem_yapan_id, olusturma_tarihi)
-- hareket_tipi: 'giris', 'cikis', 'transfer', 'sayim', 'iade'

-- Kullanıcılar
kullanicilar (id, ad_soyad, kullanici_adi, eposta, telefon, durum, olusturma_tarihi)

-- Roller ve Yetkiler
roller (id, rol_adi, aciklama)
kullanici_rolleri (kullanici_id, rol_id)
izinler (id, izin_kodu, modul, aciklama)
rol_izinleri (rol_id, izin_id)

-- Ekipler
ekipler (id, ekip_adi, ekip_kodu, sorumlu_id, durum)
ekip_uyeleri (id, ekip_id, kullanici_id, gorev)

-- Dosyalar
dosyalar (id, dosya_adi, orijinal_adi, dosya_yolu, mime_type, boyut, alan, alt_alan, iliskili_id, yukleyen_id, olusturma_tarihi, durum)
-- alan: 'proje', 'personel', 'ekipman', 'ihale', 'isg', 'firma', 'muhasebe', 'kurum'

-- Veri Paketleri (Saha Raporları)
veri_paketleri (id, baslik, paket_tipi, proje_id, olusturan_id, durum, etiketler, olusturma_tarihi)
paket_mesajlari (id, paket_id, gonderen_id, icerik, mesaj_tipi, olusturma_tarihi)
paket_dosyalari (id, paket_id, dosya_id, olusturma_tarihi)

-- AI İşlemleri
ai_islemler (id, girdi_tipi, girdi_metin, parse_sonuc, aksiyon_plani, durum, kullanici_id, proje_id, olusturma_tarihi, onay_tarihi, uygulama_tarihi, provider_adi)

ÖNEMLİ İLİŞKİLER:
- malzeme_hareketleri.malzeme_id → malzemeler.id
- malzeme_hareketleri.proje_id → projeler.id
- malzeme_hareketleri.ekip_id → ekipler.id
- proje_asamalari.proje_id → projeler.id
- veri_paketleri.proje_id → projeler.id
- dosyalar.iliskili_id → alan'a göre ilgili tablo ID'si
- ekip_uyeleri.ekip_id → ekipler.id
- ekip_uyeleri.kullanici_id → kullanicilar.id
`;

module.exports = DB_SEMA;
```

---

## Adım 4 — Sohbet Servisi

### `server/services/ai/aiSohbetService.js`

```javascript
const { getDb } = require('../../db/database');
const providerManager = require('./providerManager');
const { guvenliCalistir } = require('./sqlGuvenlik');
const DB_SEMA = require('./dbSema');
const aiOperasyonService = require('./aiOperasyonService');

class AiSohbetService {

  /**
   * MESAJ GÖNDER — Ana giriş noktası
   *
   * 1. Mod tespit (soru mu, komut mu, sohbet mi)
   * 2. Soru → SQL üret + çalıştır + özetle
   * 3. Komut → aiOperasyonService'e yönlendir
   * 4. Sohbet → Genel yanıt
   */
  async mesajGonder({ sohbetId, mesaj, kullaniciId, baglam = {} }) {
    const db = getDb();

    // ─── SOHBET OTURUMU ────────────────────────
    let sohbet;
    if (sohbetId) {
      sohbet = db.prepare('SELECT * FROM ai_sohbetler WHERE id = ? AND kullanici_id = ?')
        .get(sohbetId, kullaniciId);
      if (!sohbet) throw new Error('Sohbet bulunamadı');
    } else {
      const result = db.prepare(`
        INSERT INTO ai_sohbetler (kullanici_id, baglam_tipi, baglam_id, baglam_meta)
        VALUES (?, ?, ?, ?)
      `).run(kullaniciId, baglam.tip || 'genel', baglam.id || null, JSON.stringify(baglam));
      sohbetId = result.lastInsertRowid;
      sohbet = { id: sohbetId, mesaj_sayisi: 0 };
    }

    // ─── KULLANICI MESAJINI KAYDET ─────────────
    db.prepare('INSERT INTO ai_mesajlar (sohbet_id, rol, icerik) VALUES (?, ?, ?)')
      .run(sohbetId, 'kullanici', mesaj);

    // ─── GEÇMİŞ MESAJLARI AL (son 10) ─────────
    const gecmis = db.prepare(`
      SELECT rol, icerik, mesaj_tipi FROM ai_mesajlar
      WHERE sohbet_id = ? ORDER BY id DESC LIMIT 10
    `).all(sohbetId).reverse();

    // ─── MOD TESPİTİ + YANIT ──────────────────
    const yanit = await this._mesajIsle(mesaj, gecmis, baglam, kullaniciId);

    // ─── AI YANITINI KAYDET ────────────────────
    db.prepare(`
      INSERT INTO ai_mesajlar (sohbet_id, rol, icerik, mesaj_tipi, meta)
      VALUES (?, 'asistan', ?, ?, ?)
    `).run(sohbetId, yanit.metin, yanit.tip, JSON.stringify(yanit.meta || {}));

    // ─── SOHBET GÜNCELLE ───────────────────────
    db.prepare(`
      UPDATE ai_sohbetler SET
        mesaj_sayisi = mesaj_sayisi + 2,
        son_mesaj_tarihi = datetime('now'),
        baslik = CASE WHEN mesaj_sayisi = 0 THEN ? ELSE baslik END
      WHERE id = ?
    `).run(mesaj.substring(0, 60) + (mesaj.length > 60 ? '...' : ''), sohbetId);

    return {
      sohbetId,
      yanit: yanit.metin,
      tip: yanit.tip,
      meta: yanit.meta,
      aksiyonPlan: yanit.aksiyonPlan,
    };
  }

  /**
   * MOD TESPİTİ + İŞLEME
   */
  async _mesajIsle(mesaj, gecmis, baglam, kullaniciId) {
    const db = getDb();

    const sistemPromptu = this._sistemPromptu(baglam);
    const gecmisMesajlar = gecmis.map(m =>
      `${m.rol === 'kullanici' ? 'Kullanıcı' : 'Asistan'}: ${m.icerik}`
    ).join('\n');

    const prompt = `${gecmisMesajlar ? `GEÇMİŞ KONUŞMA:\n${gecmisMesajlar}\n\n` : ''}Kullanıcı: ${mesaj}`;

    const aiYanit = await providerManager.metinGonder(sistemPromptu, prompt);

    // JSON parse et
    let parsed;
    try {
      const jsonMatch = aiYanit.metin.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return { metin: aiYanit.metin, tip: 'sohbet', meta: { provider: aiYanit.provider } };
    }

    // ─── MOD: SORGU ────────────────────────────
    if (parsed.mod === 'sorgu' && parsed.sql) {
      const sqlSonuc = guvenliCalistir(db, parsed.sql);

      if (!sqlSonuc.basarili) {
        return {
          metin: `Sorguyu çalıştırırken hata oluştu: ${sqlSonuc.hata}`,
          tip: 'hata',
          meta: { sql: parsed.sql, hata: sqlSonuc.hata },
        };
      }

      // Sonuçları AI'a gönder, insanca özetletir
      const ozetYanit = await providerManager.metinGonder(
        'Sen ElektraTrack sisteminin AI asistanısın. Kullanıcıya sorgu sonuçlarını doğal, anlaşılır Türkçe ile özetle. Tablo formatı kullanma, akıcı cümleler kur. Sayıları ve önemli bilgileri vurgula.',
        `Kullanıcının sorusu: ${mesaj}\n\nSQL: ${parsed.sql}\n\nSonuç (${sqlSonuc.satirSayisi} satır):\n${JSON.stringify(sqlSonuc.satirlar, null, 2)}`
      );

      return {
        metin: ozetYanit.metin,
        tip: 'sorgu',
        meta: {
          sql: parsed.sql,
          satirSayisi: sqlSonuc.satirSayisi,
          satirlar: sqlSonuc.satirlar,
          provider: aiYanit.provider,
        },
      };
    }

    // ─── MOD: KOMUT ────────────────────────────
    if (parsed.mod === 'komut') {
      try {
        const plan = await aiOperasyonService.mesajIsle({
          metin: mesaj, gorseller: [], kullaniciId,
          projeId: baglam.projeId || null, ekipId: baglam.ekipId || null,
        });

        return {
          metin: parsed.yanit || 'Komut algılandı, aksiyon planı hazırlandı.',
          tip: 'komut',
          meta: { provider: aiYanit.provider },
          aksiyonPlan: plan,
        };
      } catch (err) {
        return { metin: `Komut işlenirken hata: ${err.message}`, tip: 'hata', meta: { hata: err.message } };
      }
    }

    // ─── MOD: SOHBET ───────────────────────────
    return {
      metin: parsed.yanit || aiYanit.metin,
      tip: 'sohbet',
      meta: { provider: aiYanit.provider },
    };
  }

  /**
   * SİSTEM PROMPTU — Sohbet modu için
   */
  _sistemPromptu(baglam) {
    return `Sen ElektraTrack adlı elektrik dağıtım müteahhitliği proje takip sisteminin AI asistanısın.

GÖREV: Kullanıcının mesajını analiz et ve 3 moddan birini seç:
1. SORGU — Kullanıcı bilgi istiyor → SQL üret
2. KOMUT — Kullanıcı iş yaptırmak istiyor → komut olarak işaretle
3. SOHBET — Genel konuşma, selamlama, yardım → metin yanıt

${DB_SEMA}

MEVCUT BAĞLAM:
${baglam.sayfaYolu ? `- Sayfa: ${baglam.sayfaYolu}` : ''}
${baglam.projeNo ? `- Aktif proje: ${baglam.projeNo} (${baglam.projeAdi || ''})` : ''}
${baglam.projeId ? `- Proje ID: ${baglam.projeId}` : ''}
${baglam.ekipAdi ? `- Ekip: ${baglam.ekipAdi}` : ''}
${baglam.kullaniciAdi ? `- Kullanıcı: ${baglam.kullaniciAdi}` : ''}

ÇIKTI — KESİNLİKLE bu JSON formatında yanıtla:

SORGU modunda:
{
  "mod": "sorgu",
  "sql": "SELECT ... FROM ... WHERE ...",
  "yanit": "Şu bilgiyi arıyorum..."
}

KOMUT modunda:
{
  "mod": "komut",
  "yanit": "Bu işlemi yapacağım..."
}

SOHBET modunda:
{
  "mod": "sohbet",
  "yanit": "Doğal yanıt metni..."
}

SQL YAZMA KURALLARI:
1. SADECE SELECT kullan — INSERT/UPDATE/DELETE YASAK
2. Tablo ve sütun adlarını yukarıdaki şemadan al
3. Türkçe karakter arama: LIKE '%koşu%' veya LOWER() kullan
4. Tarih filtreleri: date('now'), date('now', '-7 days') vb.
5. Birden fazla tabloyu JOIN ile birleştir
6. Sayısal özetler için SUM, COUNT, AVG, GROUP BY kullan
7. Sonuçları LIMIT 50 ile sınırla
8. Bağlamda proje ID varsa ve kullanıcı "bu proje" derse WHERE proje_id = ${baglam.projeId || 'N/A'} kullan

MOD TESPİT KURALLARI:
- "kaç", "ne kadar", "listele", "göster", "durumu ne", "nerede", "kim" → SORGU
- "ekle", "çıkar", "gönder", "oluştur", "sil", "güncelle", "transfer et" → KOMUT
- "merhaba", "teşekkürler", "nasıl kullanırım", "yardım" → SOHBET
- Belirsizse → SORGU olarak değerlendir (güvenli taraf)`;
  }

  // ─── SOHBET YÖNETİMİ ────────────────────────

  /** Kullanıcının sohbet listesi */
  sohbetListele(kullaniciId, limit = 20) {
    return getDb().prepare(`
      SELECT id, baslik, baglam_tipi, mesaj_sayisi, son_mesaj_tarihi, durum
      FROM ai_sohbetler WHERE kullanici_id = ? AND durum = 'aktif'
      ORDER BY son_mesaj_tarihi DESC LIMIT ?
    `).all(kullaniciId, limit);
  }

  /** Sohbet mesajlarını getir */
  mesajlariGetir(sohbetId, kullaniciId) {
    const sohbet = getDb().prepare('SELECT * FROM ai_sohbetler WHERE id = ? AND kullanici_id = ?')
      .get(sohbetId, kullaniciId);
    if (!sohbet) throw new Error('Sohbet bulunamadı');

    return {
      sohbet,
      mesajlar: getDb().prepare('SELECT * FROM ai_mesajlar WHERE sohbet_id = ? ORDER BY id ASC').all(sohbetId),
    };
  }

  /** Sohbeti sil (arşivle) */
  sohbetSil(sohbetId, kullaniciId) {
    getDb().prepare("UPDATE ai_sohbetler SET durum = 'arsivlendi' WHERE id = ? AND kullanici_id = ?")
      .run(sohbetId, kullaniciId);
  }

  /** Sohbet başlığını güncelle */
  baslikGuncelle(sohbetId, kullaniciId, baslik) {
    getDb().prepare('UPDATE ai_sohbetler SET baslik = ? WHERE id = ? AND kullanici_id = ?')
      .run(baslik, sohbetId, kullaniciId);
  }
}

module.exports = new AiSohbetService();
```

---

## Adım 5 — API Endpoint'leri

### `server/routes/aiSohbet.js`

```javascript
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const aiSohbetService = require('../services/ai/aiSohbetService');

router.use(authMiddleware);

// POST /api/ai-sohbet/mesaj — Mesaj gönder
router.post('/mesaj', async (req, res) => {
  try {
    const { sohbet_id, mesaj, baglam } = req.body;
    if (!mesaj?.trim()) return res.status(400).json({ success: false, error: 'Mesaj boş olamaz' });

    const sonuc = await aiSohbetService.mesajGonder({
      sohbetId: sohbet_id || null,
      mesaj: mesaj.trim(),
      kullaniciId: req.kullanici.id,
      baglam: { ...baglam, kullaniciAdi: req.kullanici.ad_soyad },
    });
    res.json({ success: true, data: sonuc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ai-sohbet/liste — Sohbet listesi
router.get('/liste', (req, res) => {
  try {
    const sohbetler = aiSohbetService.sohbetListele(req.kullanici.id, parseInt(req.query.limit) || 20);
    res.json({ success: true, data: sohbetler });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ai-sohbet/:id — Sohbet mesajları
router.get('/:id', (req, res) => {
  try {
    const data = aiSohbetService.mesajlariGetir(parseInt(req.params.id), req.kullanici.id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/ai-sohbet/:id — Sohbet sil
router.delete('/:id', (req, res) => {
  try {
    aiSohbetService.sohbetSil(parseInt(req.params.id), req.kullanici.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/ai-sohbet/:id/baslik — Başlık güncelle
router.put('/:id/baslik', (req, res) => {
  try {
    aiSohbetService.baslikGuncelle(parseInt(req.params.id), req.kullanici.id, req.body.baslik);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

### Route Kaydı

```javascript
// server/server.js
const aiSohbetRoutes = require('./routes/aiSohbet');
app.use('/api/ai-sohbet', aiSohbetRoutes);
```

---

## Adım 6 — Frontend: Floating Chat Panel

Her sayfada erişilebilir sohbet baloncuğu.

### `client/src/components/ai/AiSohbetPanel.jsx`

```jsx
import React, { useState, useRef, useEffect } from 'react';
import api from '../../utils/api';
import AiOnayPaneli from './AiOnayPaneli';

/**
 * Floating AI Sohbet Paneli
 *
 * Props:
 *   baglam: { tip, id, projeNo, projeId, projeAdi, ekipAdi, sayfaYolu }
 */
export default function AiSohbetPanel({ baglam = {} }) {
  const [acik, setAcik] = useState(false);
  const [mesajlar, setMesajlar] = useState([]);
  const [girdi, setGirdi] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [sohbetId, setSohbetId] = useState(null);
  const [aksiyonPlan, setAksiyonPlan] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [mesajlar]);

  const mesajGonder = async () => {
    if (!girdi.trim() || yukleniyor) return;
    const metin = girdi.trim();
    setGirdi('');

    setMesajlar(prev => [...prev, { rol: 'kullanici', icerik: metin }]);
    setYukleniyor(true);

    try {
      const { data } = await api.post('/api/ai-sohbet/mesaj', {
        sohbet_id: sohbetId, mesaj: metin, baglam,
      });
      const d = data.data;
      setSohbetId(d.sohbetId);

      setMesajlar(prev => [...prev, {
        rol: 'asistan', icerik: d.yanit, tip: d.tip, meta: d.meta,
      }]);

      if (d.aksiyonPlan) setAksiyonPlan(d.aksiyonPlan);
    } catch (err) {
      setMesajlar(prev => [...prev, {
        rol: 'asistan', icerik: `Hata: ${err.response?.data?.error || err.message}`, tip: 'hata',
      }]);
    } finally {
      setYukleniyor(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mesajGonder(); }
  };

  // ─── KAPALI — FLOATING BUTON ─────────────────
  if (!acik) {
    return (
      <button onClick={() => setAcik(true)}
        style={{
          position: 'fixed', bottom: '24px', right: '24px',
          width: '56px', height: '56px', borderRadius: '50%',
          background: '#2563eb', color: 'white', border: 'none',
          fontSize: '24px', cursor: 'pointer', zIndex: 1000,
          boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="AI Asistan"
      >🤖</button>
    );
  }

  // ─── AÇIK — SOHBET PANELİ ────────────────────
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px',
      width: '420px', height: '600px', maxHeight: '80vh',
      background: 'white', borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      display: 'flex', flexDirection: 'column', zIndex: 1000, overflow: 'hidden',
    }}>
      {/* BAŞLIK */}
      <div style={{
        padding: '14px 16px', background: '#2563eb', color: 'white',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>🤖 AI Asistan</div>
          <div style={{ fontSize: '11px', opacity: 0.8 }}>
            {baglam.projeNo ? `📍 ${baglam.projeNo} — ${baglam.projeAdi || ''}` : 'Genel'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => { setMesajlar([]); setSohbetId(null); setAksiyonPlan(null); }}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
              borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>
            ➕ Yeni
          </button>
          <button onClick={() => setAcik(false)}
            style={{ background: 'none', border: 'none', color: 'white', fontSize: '18px', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      </div>

      {/* MESAJLAR */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '12px 16px',
        display: 'flex', flexDirection: 'column', gap: '10px',
      }}>
        {mesajlar.length === 0 && (
          <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '40px', fontSize: '13px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🤖</div>
            Merhaba! Soru sorabilir veya komut verebilirsin.
            <div style={{ marginTop: '12px', fontSize: '12px', color: '#d1d5db' }}>
              Örnekler:<br />
              "Depoda kaç direk var?"<br />
              "Koşu köy projesi ne durumda?"<br />
              "Ekip-2'ye 5 adet N-12 direk gönder"
            </div>
          </div>
        )}

        {mesajlar.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.rol === 'kullanici' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%', padding: '10px 14px', borderRadius: '12px',
              fontSize: '13px', lineHeight: '1.5',
              ...(m.rol === 'kullanici'
                ? { background: '#2563eb', color: 'white', borderBottomRightRadius: '4px' }
                : { background: '#f3f4f6', color: '#1f2937', borderBottomLeftRadius: '4px' }),
              ...(m.tip === 'hata' ? { background: '#fef2f2', color: '#dc2626' } : {}),
            }}>
              {m.icerik}
              {m.tip === 'sorgu' && m.meta?.sql && (
                <details style={{ marginTop: '8px', fontSize: '11px', opacity: 0.7 }}>
                  <summary style={{ cursor: 'pointer' }}>SQL göster</summary>
                  <pre style={{ marginTop: '4px', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{m.meta.sql}</pre>
                  <span>{m.meta.satirSayisi} satır sonuç</span>
                </details>
              )}
            </div>
          </div>
        ))}

        {yukleniyor && (
          <div style={{ display: 'flex', gap: '4px', padding: '8px' }}>
            <span style={{ animation: 'pulse 1s infinite', background: '#d1d5db', width: '8px', height: '8px', borderRadius: '50%' }} />
            <span style={{ animation: 'pulse 1s infinite 0.2s', background: '#d1d5db', width: '8px', height: '8px', borderRadius: '50%' }} />
            <span style={{ animation: 'pulse 1s infinite 0.4s', background: '#d1d5db', width: '8px', height: '8px', borderRadius: '50%' }} />
          </div>
        )}

        {aksiyonPlan && (
          <AiOnayPaneli
            islemId={aksiyonPlan.islemId}
            anlama={aksiyonPlan.anlama}
            aksiyonlar={aksiyonPlan.aksiyonlar}
            uyarilar={aksiyonPlan.uyarilar}
            sorular={aksiyonPlan.sorular}
            onOnayla={() => {
              setAksiyonPlan(null);
              setMesajlar(prev => [...prev, { rol: 'asistan', icerik: '✅ İşlem tamamlandı.', tip: 'sohbet' }]);
            }}
            onReddet={() => {
              setAksiyonPlan(null);
              setMesajlar(prev => [...prev, { rol: 'asistan', icerik: 'İşlem iptal edildi.', tip: 'sohbet' }]);
            }}
            onKapat={() => setAksiyonPlan(null)}
          />
        )}
      </div>

      {/* GİRDİ ALANI */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <textarea value={girdi} onChange={(e) => setGirdi(e.target.value)} onKeyDown={handleKeyDown}
          placeholder="Soru sor veya komut ver..." rows={1}
          style={{ flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '10px',
            fontSize: '13px', resize: 'none', outline: 'none', fontFamily: 'inherit', maxHeight: '80px' }}
          onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'; }}
        />
        <button onClick={mesajGonder} disabled={!girdi.trim() || yukleniyor}
          style={{ width: '40px', height: '40px', borderRadius: '10px',
            background: girdi.trim() ? '#2563eb' : '#e5e7eb', color: 'white',
            border: 'none', cursor: girdi.trim() ? 'pointer' : 'default', fontSize: '16px', flexShrink: 0 }}>
          ➤
        </button>
      </div>
    </div>
  );
}
```

### Panel Entegrasyonu — Layout

```jsx
// Layout bileşeninde (tüm sayfalarda görünür)
import AiSohbetPanel from './components/ai/AiSohbetPanel';
import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';

function AppLayout({ children }) {
  const location = useLocation();

  // Sayfa bağlamını URL'den otomatik çıkar
  const baglam = useMemo(() => {
    const parts = location.pathname.split('/');
    if (parts[1] === 'projeler' && parts[2]) {
      return { tip: 'proje', projeId: parseInt(parts[2]), sayfaYolu: location.pathname };
    }
    if (parts[1] === 'malzemeler') {
      return { tip: 'malzeme', sayfaYolu: location.pathname };
    }
    return { tip: 'genel', sayfaYolu: location.pathname };
  }, [location]);

  return (
    <div>
      {children}
      <AiSohbetPanel baglam={baglam} />
    </div>
  );
}
```

---

## Adım 7 — Tam Sayfa Sohbet Ekranı

### `client/src/pages/AiSohbetPage.jsx`

```jsx
import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import AiOnayPaneli from '../components/ai/AiOnayPaneli';

export default function AiSohbetPage() {
  const [sohbetler, setSohbetler] = useState([]);
  const [seciliSohbetId, setSeciliSohbetId] = useState(null);
  const [mesajlar, setMesajlar] = useState([]);
  const [girdi, setGirdi] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [aksiyonPlan, setAksiyonPlan] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => { yukleSohbetler(); }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [mesajlar]);

  const yukleSohbetler = async () => {
    const { data } = await api.get('/api/ai-sohbet/liste');
    if (data.success) setSohbetler(data.data);
  };

  const sohbetSec = async (id) => {
    setSeciliSohbetId(id);
    const { data } = await api.get(`/api/ai-sohbet/${id}`);
    if (data.success) setMesajlar(data.data.mesajlar);
  };

  const yeniSohbet = () => {
    setSeciliSohbetId(null);
    setMesajlar([]);
    setAksiyonPlan(null);
  };

  const sohbetSil = async (id) => {
    await api.delete(`/api/ai-sohbet/${id}`);
    setSohbetler(prev => prev.filter(s => s.id !== id));
    if (seciliSohbetId === id) yeniSohbet();
  };

  const mesajGonder = async () => {
    if (!girdi.trim() || yukleniyor) return;
    const metin = girdi.trim();
    setGirdi('');
    setMesajlar(prev => [...prev, { rol: 'kullanici', icerik: metin }]);
    setYukleniyor(true);

    try {
      const { data } = await api.post('/api/ai-sohbet/mesaj', {
        sohbet_id: seciliSohbetId, mesaj: metin, baglam: { tip: 'genel' },
      });
      const d = data.data;
      setSeciliSohbetId(d.sohbetId);
      setMesajlar(prev => [...prev, { rol: 'asistan', icerik: d.yanit, tip: d.tip, meta: d.meta }]);
      if (d.aksiyonPlan) setAksiyonPlan(d.aksiyonPlan);
      yukleSohbetler(); // Listeyi güncelle
    } catch (err) {
      setMesajlar(prev => [...prev, {
        rol: 'asistan', icerik: `Hata: ${err.response?.data?.error || err.message}`, tip: 'hata',
      }]);
    } finally { setYukleniyor(false); }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
      {/* SOL — SOHBET LİSTESİ */}
      <div style={{ width: '300px', borderRight: '1px solid #e5e7eb', overflowY: 'auto', background: '#f9fafb' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>🤖 Sohbetler</h3>
          <button onClick={yeniSohbet}
            style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px',
              padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>➕ Yeni</button>
        </div>
        {sohbetler.map(s => (
          <div key={s.id} onClick={() => sohbetSec(s.id)}
            style={{
              padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
              background: seciliSohbetId === s.id ? '#eff6ff' : 'transparent',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>{s.baslik || 'Yeni Sohbet'}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                {new Date(s.son_mesaj_tarihi).toLocaleDateString('tr-TR')} · {s.mesaj_sayisi} mesaj
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); sohbetSil(s.id); }}
              style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: '14px' }}>🗑</button>
          </div>
        ))}
      </div>

      {/* SAĞ — AKTİF SOHBET */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {mesajlar.length === 0 && (
            <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '80px', fontSize: '14px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🤖</div>
              Soru sor, komut ver veya bilgi iste.
            </div>
          )}
          {mesajlar.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.rol === 'kullanici' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '70%', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', lineHeight: '1.6',
                ...(m.rol === 'kullanici'
                  ? { background: '#2563eb', color: 'white', borderBottomRightRadius: '4px' }
                  : { background: '#f3f4f6', color: '#1f2937', borderBottomLeftRadius: '4px' }),
              }}>
                {m.icerik}
                {m.tip === 'sorgu' && m.meta?.sql && (
                  <details style={{ marginTop: '8px', fontSize: '12px', opacity: 0.7 }}>
                    <summary style={{ cursor: 'pointer' }}>SQL göster</summary>
                    <pre style={{ marginTop: '4px', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{m.meta.sql}</pre>
                  </details>
                )}
              </div>
            </div>
          ))}
          {yukleniyor && <div style={{ color: '#9ca3af', fontSize: '13px' }}>⏳ Düşünüyor...</div>}

          {aksiyonPlan && (
            <AiOnayPaneli islemId={aksiyonPlan.islemId} anlama={aksiyonPlan.anlama}
              aksiyonlar={aksiyonPlan.aksiyonlar} uyarilar={aksiyonPlan.uyarilar} sorular={aksiyonPlan.sorular}
              onOnayla={() => { setAksiyonPlan(null); setMesajlar(prev => [...prev, { rol: 'asistan', icerik: '✅ Tamamlandı.' }]); }}
              onReddet={() => { setAksiyonPlan(null); setMesajlar(prev => [...prev, { rol: 'asistan', icerik: 'İptal edildi.' }]); }}
              onKapat={() => setAksiyonPlan(null)} />
          )}
        </div>

        {/* GİRDİ */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '10px' }}>
          <textarea value={girdi} onChange={(e) => setGirdi(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mesajGonder(); } }}
            placeholder="Soru sor veya komut ver..." rows={1}
            style={{ flex: 1, padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: '10px',
              fontSize: '14px', resize: 'none', outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={mesajGonder} disabled={!girdi.trim() || yukleniyor}
            style={{ padding: '12px 20px', background: girdi.trim() ? '#2563eb' : '#e5e7eb', color: 'white',
              border: 'none', borderRadius: '10px', cursor: girdi.trim() ? 'pointer' : 'default', fontSize: '15px' }}>
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Route Kaydı (Frontend)

```jsx
// App.jsx veya router config
import AiSohbetPage from './pages/AiSohbetPage';

<Route path="/ai-sohbet" element={<AiSohbetPage />} />
```

---

## Adım 8 — Akış Örnekleri

### Sorgu Modu

```
Kullanıcı: "Depoda kaç A tipi direk var?"

→ AI mod: sorgu
→ SQL: SELECT ad, stok_miktari FROM malzemeler WHERE ad LIKE '%A tipi%direk%'
→ Sonuç: [{ ad: "A tipi beton direk N-12", stok_miktari: 47 }]
→ AI: "Depoda 47 adet A tipi beton direk (N-12) var."
```

### Çoklu Tablo Sorgusu

```
Kullanıcı: "Koşu köy projesi ne durumda?"

→ SQL: SELECT p.proje_no, p.musteri_adi, p.durum,
         pa.asama_adi, pa.durum as asama_durum
       FROM projeler p
       LEFT JOIN proje_asamalari pa ON pa.proje_id = p.id AND pa.durum = 'aktif'
       WHERE p.musteri_adi LIKE '%Koşu%köy%'
→ AI: "Koşu köy (YB-2025-003) yapım aşamasında."
```

### Bağlam Kullanımı

```
[Sayfa: /projeler/5 → baglam.projeId = 5]
Kullanıcı: "Bu projeye bu ay kaç malzeme gönderildi?"

→ SQL: ... WHERE mh.proje_id = 5 AND mh.tarih >= date('now', 'start of month')
→ AI: "Bu ay 12 direk, 300m kablo, 4 sigorta gönderilmiş."
```

### Hibrit — Sorgudan Komuta Geçiş

```
Kullanıcı: "Depoda ne kadar N-12 direk var?"
AI: "23 adet." (sorgu)

Kullanıcı: "5 tanesini Koşu köy'e ekip-2 ile gönder"
AI: [komut → AiOnayPaneli açılır]
    📤 Depo Çıkış: N-12 × 5 → Koşu köy, Ekip-2
    [✅ Onayla]

Kullanıcı: "Şimdi kaç kaldı?"
AI: "18 adet." (güncel stok sorgusu)
```

---

## Kontrol Listesi

**Veritabanı:**
- [ ] `ai_sohbetler` tablosu oluşturuldu
- [ ] `ai_mesajlar` tablosu oluşturuldu

**SQL Güvenlik:**
- [ ] Sadece SELECT izni çalışıyor
- [ ] INSERT/UPDATE/DELETE engelleniyor
- [ ] Çoklu statement engelleniyor
- [ ] Hassas sütunlar maskeleniyor
- [ ] LIMIT 100 otomatik ekleniyor

**Sohbet Servisi:**
- [ ] `mesajGonder()` çalışıyor
- [ ] Mod tespiti doğru (sorgu/komut/sohbet)
- [ ] Sorgu: SQL → güvenlik → çalıştırma → özetleme
- [ ] Komut: aiOperasyonService'e yönlendirme → AiOnayPaneli
- [ ] Son 10 mesaj context'e ekleniyor
- [ ] Sohbet DB'ye kaydediliyor
- [ ] Bağlam bilgisi doğru iletiliyor

**API:**
- [ ] POST /api/ai-sohbet/mesaj
- [ ] GET /api/ai-sohbet/liste
- [ ] GET /api/ai-sohbet/:id
- [ ] DELETE /api/ai-sohbet/:id
- [ ] PUT /api/ai-sohbet/:id/baslik

**Frontend:**
- [ ] Floating panel (🤖) tüm sayfalarda görünüyor
- [ ] Mesaj gönder/al çalışıyor
- [ ] Komut → AiOnayPaneli inline
- [ ] Sorgu → SQL detay (opsiyonel)
- [ ] Sayfa bağlamı otomatik algılanıyor
- [ ] Tam sayfa (/ai-sohbet) çalışıyor
- [ ] Sohbet geçmişi listesi
- [ ] Sohbet silme

**Test:**
- [ ] "Merhaba" → Sohbet modu
- [ ] "Depoda kaç direk var?" → Sorgu modu, SQL, sonuç
- [ ] "3 direk çıkar ekip-1'e" → Komut modu, AiOnayPaneli
- [ ] Proje sayfasında "durum ne?" → Bağlam kullanır
- [ ] Sorgudan komuta geçiş
- [ ] Eski sohbete devam
