# ElektraTrack — Saha Harita Modülü — Uygulama Kılavuzu

## Amaç

Sidebar'a "Saha" menüsü ekle. Açıldığında tam sayfa harita gösterilsin.  
Harita üzerinde iki katman gösterilsin:

1. **Ekipler** — Ekiplerin çalıştığı koordinatlarda renkli etiketli marker'lar. Tıklanınca ekip kartı (popup).
2. **Veri Paketleri** — Saha fotoğraf/rapor konumları. Tıklanınca paket özeti (popup).

**Teknoloji:** Leaflet.js + OpenStreetMap (tamamen ücretsiz, API key gerekmez)

---

## Adım 1 — Paket Kurulumu

```bash
cd client
npm install leaflet react-leaflet
```

> NOT: Başka paket gerekmez. `leaflet-draw`, `markercluster` vb. ileride eklenebilir ama şimdi gerekmez.

---

## Adım 2 — Veritabanı Değişiklikleri

Mevcut `ekipler` tablosuna konum sütunları ekle. Bu ALTER komutlarını veritabanı başlatma/migration dosyasına ekle:

```sql
-- Ekipler tablosuna konum alanları ekle (zaten varsa hata vermez, try-catch ile)
ALTER TABLE ekipler ADD COLUMN son_latitude REAL;
ALTER TABLE ekipler ADD COLUMN son_longitude REAL;
ALTER TABLE ekipler ADD COLUMN son_konum_zamani DATETIME;
ALTER TABLE ekipler ADD COLUMN son_konum_kaynagi TEXT;  -- 'manuel', 'telegram', 'veri_paketi'
```

> **ÖNEMLİ:** SQLite'da `ALTER TABLE ADD COLUMN` sütun zaten varsa hata verir.
> Kodu şöyle yaz:

```javascript
// server/db/database.js veya migration dosyasında
function addColumnIfNotExists(db, table, column, type) {
  const columns = db.pragma(`table_info(${table})`);
  const exists = columns.some(c => c.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    console.log(`✅ ${table}.${column} sütunu eklendi`);
  }
}

// Çağır:
addColumnIfNotExists(db, 'ekipler', 'son_latitude', 'REAL');
addColumnIfNotExists(db, 'ekipler', 'son_longitude', 'REAL');
addColumnIfNotExists(db, 'ekipler', 'son_konum_zamani', 'DATETIME');
addColumnIfNotExists(db, 'ekipler', 'son_konum_kaynagi', 'TEXT');
```

### Test Verisi — Ekiplere Koordinat Ata

Haritada görebilmek için mevcut ekiplere örnek koordinatlar gir.  
Samsun bölgesi koordinatları kullan (firma Samsun'da):

```sql
-- Örnek: Mevcut ekiplerin koordinatlarını güncelle
-- Bu koordinatlar Samsun ilçelerini temsil ediyor

UPDATE ekipler SET 
  son_latitude = 41.5667, son_longitude = 35.9000,
  son_konum_zamani = datetime('now'), son_konum_kaynagi = 'manuel'
WHERE ekip_kodu = 'EK-01';   -- veya id = 1

UPDATE ekipler SET 
  son_latitude = 41.2000, son_longitude = 36.4167,
  son_konum_zamani = datetime('now'), son_konum_kaynagi = 'manuel'
WHERE ekip_kodu = 'EK-02';   -- veya id = 2

UPDATE ekipler SET 
  son_latitude = 41.3500, son_longitude = 36.6333,
  son_konum_zamani = datetime('now'), son_konum_kaynagi = 'manuel'
WHERE ekip_kodu = 'EK-03';   -- veya id = 3

-- Kaç ekip varsa hepsine benzersiz koordinat ver.
-- Yoksa en azından birkaç ekibe el ile koordinat gir ki haritada görünsün.
```

> **Alternatif:** Bu UPDATE'leri API üzerinden de yapabilirsin (Adım 3'teki PUT endpoint'i ile).

### Veri Paketleri Tablosuna Koordinat Ekle

Veri paketlerinin haritada görünmesi için koordinat sütunları gerekli.
Mevcut `veri_paketleri` tablosunda `latitude` ve `longitude` yoksa ekle:

```javascript
// Aynı addColumnIfNotExists fonksiyonu ile:
addColumnIfNotExists(db, 'veri_paketleri', 'latitude', 'REAL');
addColumnIfNotExists(db, 'veri_paketleri', 'longitude', 'REAL');
```

### Test Verisi — Veri Paketlerine Koordinat Ata

```sql
-- Mevcut veri paketlerine örnek koordinatlar gir (Samsun bölgesi)
-- Gerçek kullanımda bu koordinatlar Telegram'dan gelen GPS verisinden gelecek

-- EK-01 ekibinin çalıştığı bölgede (Bafra civarı)
UPDATE veri_paketleri SET 
  latitude = 41.5690, longitude = 35.9020
WHERE id = 1;

UPDATE veri_paketleri SET 
  latitude = 41.5710, longitude = 35.9055
WHERE id = 2;

-- EK-02 ekibinin çalıştığı bölgede (Çarşamba civarı)
UPDATE veri_paketleri SET 
  latitude = 41.2050, longitude = 36.4200
WHERE id = 3;

-- EK-03 ekibinin çalıştığı bölgede (Terme civarı)
UPDATE veri_paketleri SET 
  latitude = 41.3520, longitude = 36.6380
WHERE id = 4;

-- Eğer veri paketi yoksa test verisi oluştur:
INSERT OR IGNORE INTO veri_paketleri (id, paket_no, paket_tipi, latitude, longitude, foto_sayisi, durum, ekip_id, olusturma_tarihi)
VALUES 
  (1, 'VP-2026-0001', 'direk_tespit', 41.5690, 35.9020, 3, 'tamamlandi', 1, datetime('now', '-2 hours')),
  (2, 'VP-2026-0002', 'montaj_sonrasi', 41.5710, 35.9055, 5, 'tamamlandi', 1, datetime('now', '-1 hours')),
  (3, 'VP-2026-0003', 'hasar_tespit', 41.2050, 36.4200, 2, 'tamamlandi', 2, datetime('now', '-3 hours')),
  (4, 'VP-2026-0004', 'ilerleme_raporu', 41.3520, 36.6380, 4, 'tamamlandi', 3, datetime('now'));
```

---

## Adım 3 — Backend API

`server/routes/` dizininde saha route dosyası oluştur.  
Mevcut route yapısına uyumlu olsun (ör: `server/routes/saha.js` veya mevcut router dosyasına ekle).

### `server/routes/saha.js`

```javascript
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// ─────────────────────────────────────────────────────────
// GET /api/saha/ekipler — Tüm ekiplerin konum + özet bilgisi
// Haritadaki marker'lar bu endpoint'ten beslenir
// ─────────────────────────────────────────────────────────
router.get('/ekipler', (req, res) => {
  try {
    const db = getDb();

    const ekipler = db.prepare(`
      SELECT 
        e.id,
        e.ekip_adi,
        e.ekip_kodu,
        e.durum,
        e.son_latitude,
        e.son_longitude,
        e.son_konum_zamani,
        e.son_konum_kaynagi,
        
        -- Ekipteki personel sayısı
        (SELECT COUNT(*) FROM personel p 
         WHERE p.ekip_id = e.id AND p.aktif = 1
        ) AS personel_sayisi,
        
        -- Ekip başı adı
        (SELECT p.ad_soyad FROM personel p 
         WHERE p.ekip_id = e.id AND p.gorev = 'ekip_basi' AND p.aktif = 1 
         LIMIT 1
        ) AS ekip_basi_adi,
        
        -- Aktif proje sayısı
        (SELECT COUNT(DISTINCT g.proje_id) FROM gorevler g 
         WHERE g.ekip_id = e.id AND g.durum IN ('atandi', 'devam_ediyor')
        ) AS aktif_proje_sayisi,
        
        -- Bugünkü ilerleme (veri paketi sayısı)
        (SELECT COUNT(*) FROM veri_paketleri vp 
         WHERE vp.ekip_id = e.id 
         AND date(vp.olusturma_tarihi) = date('now')
        ) AS bugun_paket_sayisi

      FROM ekipler e
      WHERE e.durum = 'aktif'
      ORDER BY e.ekip_kodu
    `).all();

    res.json({
      success: true,
      data: ekipler,
      merkez: { lat: 41.2867, lng: 36.3300 },  // Samsun merkez
      zoom: 10
    });
  } catch (error) {
    console.error('Saha ekipler hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/saha/ekipler/:id — Tek ekibin detaylı kartı
// Marker'a tıklandığında çağrılır
// ─────────────────────────────────────────────────────────
router.get('/ekipler/:id', (req, res) => {
  try {
    const db = getDb();
    const ekipId = req.params.id;

    // Ekip temel bilgisi
    const ekip = db.prepare(`
      SELECT 
        e.*,
        e.son_latitude, e.son_longitude, e.son_konum_zamani
      FROM ekipler e
      WHERE e.id = ?
    `).get(ekipId);

    if (!ekip) {
      return res.status(404).json({ success: false, error: 'Ekip bulunamadı' });
    }

    // Ekipteki personeller
    const personeller = db.prepare(`
      SELECT id, ad_soyad, gorev, telefon, aktif
      FROM personel
      WHERE ekip_id = ? AND aktif = 1
      ORDER BY gorev DESC, ad_soyad
    `).all(ekipId);

    // Aktif görevler/projeler
    const aktifGorevler = db.prepare(`
      SELECT 
        g.id, g.gorev_basligi, g.durum, g.oncelik,
        p.proje_no, p.proje_adi
      FROM gorevler g
      LEFT JOIN projeler p ON g.proje_id = p.id
      WHERE g.ekip_id = ? AND g.durum IN ('atandi', 'devam_ediyor')
      ORDER BY g.oncelik DESC
    `).all(ekipId);

    // Bugünkü aktivite özeti
    const bugunOzet = db.prepare(`
      SELECT 
        COUNT(*) as paket_sayisi,
        SUM(foto_sayisi) as toplam_foto
      FROM veri_paketleri
      WHERE ekip_id = ? AND date(olusturma_tarihi) = date('now')
    `).get(ekipId);

    // Son 5 veri paketi
    const sonPaketler = db.prepare(`
      SELECT id, paket_no, paket_tipi, foto_sayisi, durum, 
             olusturma_tarihi, notlar
      FROM veri_paketleri
      WHERE ekip_id = ?
      ORDER BY olusturma_tarihi DESC
      LIMIT 5
    `).all(ekipId);

    res.json({
      success: true,
      data: {
        ...ekip,
        personeller,
        aktifGorevler,
        bugunOzet: {
          paket_sayisi: bugunOzet?.paket_sayisi || 0,
          toplam_foto: bugunOzet?.toplam_foto || 0
        },
        sonPaketler
      }
    });
  } catch (error) {
    console.error('Saha ekip detay hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────
// PUT /api/saha/ekipler/:id/konum — Ekip konumunu güncelle
// Web arayüzünden veya Telegram'dan konum atama
// ─────────────────────────────────────────────────────────
router.put('/ekipler/:id/konum', (req, res) => {
  try {
    const db = getDb();
    const { lat, lng, kaynak } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ success: false, error: 'lat ve lng gerekli' });
    }

    db.prepare(`
      UPDATE ekipler SET
        son_latitude = ?,
        son_longitude = ?,
        son_konum_zamani = datetime('now'),
        son_konum_kaynagi = ?
      WHERE id = ?
    `).run(lat, lng, kaynak || 'manuel', req.params.id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/saha/veri-paketleri — Konumlu veri paketleri
// Haritadaki fotoğraf/rapor marker'ları bu endpoint'ten beslenir
// Filtre: ?proje_id=&ekip_id=&tarih_baslangic=&tarih_bitis=
// ─────────────────────────────────────────────────────────
router.get('/veri-paketleri', (req, res) => {
  try {
    const db = getDb();
    const { proje_id, ekip_id, tarih_baslangic, tarih_bitis } = req.query;

    let where = ['vp.latitude IS NOT NULL', 'vp.longitude IS NOT NULL'];
    let params = [];

    if (proje_id) {
      where.push('vp.proje_id = ?');
      params.push(proje_id);
    }
    if (ekip_id) {
      where.push('vp.ekip_id = ?');
      params.push(ekip_id);
    }
    if (tarih_baslangic) {
      where.push('date(vp.olusturma_tarihi) >= date(?)');
      params.push(tarih_baslangic);
    }
    if (tarih_bitis) {
      where.push('date(vp.olusturma_tarihi) <= date(?)');
      params.push(tarih_bitis);
    }

    const paketler = db.prepare(`
      SELECT 
        vp.id,
        vp.paket_no,
        vp.paket_tipi,
        vp.latitude,
        vp.longitude,
        vp.foto_sayisi,
        vp.durum,
        vp.notlar,
        vp.olusturma_tarihi,

        -- Proje bilgisi
        p.proje_no,
        p.proje_adi,

        -- Ekip bilgisi
        e.ekip_adi,
        e.ekip_kodu,

        -- Personel (oluşturan)
        pr.ad_soyad AS personel_adi

      FROM veri_paketleri vp
      LEFT JOIN projeler p ON vp.proje_id = p.id
      LEFT JOIN ekipler e ON vp.ekip_id = e.id
      LEFT JOIN personel pr ON vp.personel_id = pr.id
      WHERE ${where.join(' AND ')}
      ORDER BY vp.olusturma_tarihi DESC
      LIMIT 200
    `).all(...params);

    res.json({ success: true, data: paketler });
  } catch (error) {
    console.error('Saha veri paketleri hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/saha/veri-paketleri/:id — Tek paketin detayı
// Marker'a tıklandığında çağrılır
// ─────────────────────────────────────────────────────────
router.get('/veri-paketleri/:id', (req, res) => {
  try {
    const db = getDb();
    const paketId = req.params.id;

    const paket = db.prepare(`
      SELECT 
        vp.*,
        p.proje_no, p.proje_adi,
        e.ekip_adi, e.ekip_kodu,
        pr.ad_soyad AS personel_adi
      FROM veri_paketleri vp
      LEFT JOIN projeler p ON vp.proje_id = p.id
      LEFT JOIN ekipler e ON vp.ekip_id = e.id
      LEFT JOIN personel pr ON vp.personel_id = pr.id
      WHERE vp.id = ?
    `).get(paketId);

    if (!paket) {
      return res.status(404).json({ success: false, error: 'Veri paketi bulunamadı' });
    }

    // Paketin fotoğrafları
    const medyalar = db.prepare(`
      SELECT id, dosya_adi, dosya_tipi, dosya_boyutu, 
             genislik, yukseklik, latitude, longitude,
             aciklama, yukleme_tarihi
      FROM medya
      WHERE veri_paketi_id = ?
      ORDER BY yukleme_tarihi
    `).all(paketId);

    res.json({
      success: true,
      data: { ...paket, medyalar }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

### Route'u Kaydet

`server/server.js` veya `server/routes/index.js` dosyasına ekle:

```javascript
const sahaRoutes = require('./routes/saha');
app.use('/api/saha', sahaRoutes);
```

> **Mevcut yapıya uyum:** Projedeki mevcut route kayıt yöntemine bak.
> Eğer `app.use('/api/ekipler', ekiplerRoutes)` gibi bir yapı varsa aynısını takip et.
> Eğer tüm route'lar tek dosyada tanımlıysa, saha endpoint'lerini oraya ekle.

---

## Adım 4 — Frontend: Leaflet CSS Yükleme

Leaflet'in CSS'i yüklenmezse harita karo parçaları bozuk görünür. 

**Seçenek A — `index.html`'e ekle (en basit):**

`client/index.html` dosyasının `<head>` bölümüne:

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
```

**Seçenek B — `main.jsx` veya `App.jsx`'te import:**

```javascript
import 'leaflet/dist/leaflet.css';
```

**Her iki yöntem de çalışır.** Seçenek A daha garantili (CDN'den gelir).

### Leaflet Marker İkon Düzeltmesi

React-Leaflet ile Vite/Webpack kullanıldığında Leaflet'in varsayılan marker ikonları kırılır.
Bu global düzeltmeyi uygula:

```javascript
// client/src/utils/leafletFix.js

import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Leaflet varsayılan ikon yollarını düzelt
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});
```

Bu dosyayı `SahaPage.jsx`'te import et:

```javascript
import '../utils/leafletFix';  // Dosyanın başında, bir kere
```

---

## Adım 5 — Frontend: Saha Sayfası

### Sidebar'a Menü Ekle

Mevcut sidebar bileşeninde menü listesi nerede tanımlıysa oraya ekle:

```javascript
// Mevcut menü öğeleri arasına ekle (Veri Paketleri'nden sonra, Raporlar'dan önce)
{
  label: 'Saha',
  icon: '🗺️',        // veya mevcut ikon sistemi ne ise onu kullan (ör: MapIcon)
  path: '/saha',
  // aktif: true
}
```

### Route Tanımı

Mevcut React Router yapısına ekle:

```jsx
// App.jsx veya routes dosyasında
import SahaPage from './pages/SahaPage';

// <Routes> içinde:
<Route path="/saha" element={<SahaPage />} />
```

### `client/src/pages/SahaPage.jsx` — Ana Sayfa

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ─── EKIP MARKER İKONU ─────────────────────────────────
// Renkli daire + ekip kodu etiketi olan özel marker
function createEkipIcon(ekipKodu, renk = '#2563eb') {
  return L.divIcon({
    className: 'ekip-marker',     // CSS sınıfı (aşağıda tanımlı)
    html: `
      <div style="
        background: ${renk};
        color: white;
        padding: 4px 10px;
        border-radius: 16px;
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        border: 2px solid white;
        text-align: center;
        transform: translate(-50%, -50%);
      ">
        ${ekipKodu}
      </div>
    `,
    iconSize: [0, 0],             // divIcon boyutu (CSS ile kontrol edilecek)
    iconAnchor: [0, 0],           // Merkezleme transform ile yapılıyor
  });
}

// ─── EKIP RENKLERI ──────────────────────────────────────
// Her ekibe farklı renk ata
const EKIP_RENKLERI = [
  '#2563eb',  // Mavi
  '#dc2626',  // Kırmızı
  '#16a34a',  // Yeşil
  '#9333ea',  // Mor
  '#ea580c',  // Turuncu
  '#0891b2',  // Cyan
  '#4f46e5',  // İndigo
  '#be185d',  // Pembe
];

function getRenk(index) {
  return EKIP_RENKLERI[index % EKIP_RENKLERI.length];
}

// ─── EKİP KARTI (Popup İçeriği) ─────────────────────────
function EkipKarti({ ekip, detay, yukleniyor }) {
  if (yukleniyor) {
    return (
      <div style={{ padding: '8px', minWidth: '220px' }}>
        <p>Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div style={{ minWidth: '280px', maxWidth: '360px', fontSize: '13px' }}>
      {/* Başlık */}
      <div style={{
        background: '#1e40af',
        color: 'white',
        padding: '10px 14px',
        margin: '-14px -20px 10px -20px',
        borderRadius: '12px 12px 0 0',
      }}>
        <div style={{ fontSize: '16px', fontWeight: '700' }}>
          {ekip.ekip_adi}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '2px' }}>
          {ekip.ekip_kodu} • {ekip.personel_sayisi} kişi
        </div>
      </div>

      {/* Ekip Başı */}
      {detay?.personeller && (
        <div style={{ marginBottom: '8px' }}>
          <strong>Ekip Başı:</strong>{' '}
          {detay.personeller.find(p => p.gorev === 'ekip_basi')?.ad_soyad || '-'}
        </div>
      )}

      {/* Personel Listesi */}
      {detay?.personeller && detay.personeller.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <strong>Personel:</strong>
          <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
            {detay.personeller.map(p => (
              <li key={p.id}>
                {p.ad_soyad}
                <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '4px' }}>
                  ({p.gorev})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Aktif Görevler */}
      {detay?.aktifGorevler && detay.aktifGorevler.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <strong>Aktif Görevler:</strong>
          <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
            {detay.aktifGorevler.map(g => (
              <li key={g.id}>
                {g.proje_no && <span style={{ color: '#2563eb', fontWeight: 600 }}>{g.proje_no}: </span>}
                {g.gorev_basligi}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Bugünkü Aktivite */}
      {detay?.bugunOzet && (
        <div style={{
          background: '#f3f4f6',
          padding: '8px 10px',
          borderRadius: '6px',
          marginBottom: '8px'
        }}>
          <strong>Bugün:</strong>{' '}
          {detay.bugunOzet.paket_sayisi} rapor, {detay.bugunOzet.toplam_foto || 0} fotoğraf
        </div>
      )}

      {/* Son Konum Zamanı */}
      {ekip.son_konum_zamani && (
        <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '6px' }}>
          📍 Son konum: {new Date(ekip.son_konum_zamani).toLocaleString('tr-TR')}
          {ekip.son_konum_kaynagi && ` (${ekip.son_konum_kaynagi})`}
        </div>
      )}
    </div>
  );
}

// ─── HAREKETLİ MARKER BİLEŞENİ ──────────────────────────
// Marker'a tıklandığında API'den detay çeker
function EkipMarker({ ekip, renk, onDetayYukle }) {
  const [detay, setDetay] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  const handleClick = useCallback(async () => {
    if (detay) return; // Zaten yüklüyse tekrar çekme
    setYukleniyor(true);
    try {
      const res = await fetch(`/api/saha/ekipler/${ekip.id}`);
      const json = await res.json();
      if (json.success) {
        setDetay(json.data);
      }
    } catch (err) {
      console.error('Ekip detay hatası:', err);
    } finally {
      setYukleniyor(false);
    }
  }, [ekip.id, detay]);

  // Koordinatı yoksa gösterme
  if (!ekip.son_latitude || !ekip.son_longitude) return null;

  return (
    <Marker
      position={[ekip.son_latitude, ekip.son_longitude]}
      icon={createEkipIcon(ekip.ekip_kodu, renk)}
      eventHandlers={{ click: handleClick }}
    >
      {/* Hover etiketi — ekip adı */}
      <Tooltip 
        direction="top" 
        offset={[0, -10]} 
        permanent={false}
      >
        <strong>{ekip.ekip_adi}</strong>
        <br />
        {ekip.personel_sayisi} kişi
        {ekip.aktif_proje_sayisi > 0 && ` • ${ekip.aktif_proje_sayisi} proje`}
      </Tooltip>

      {/* Tıklayınca açılan kart */}
      <Popup
        maxWidth={380}
        minWidth={280}
        closeButton={true}
      >
        <EkipKarti ekip={ekip} detay={detay} yukleniyor={yukleniyor} />
      </Popup>
    </Marker>
  );
}

// ─── HARİTA SINIRLARINI AYARLA ──────────────────────────
// Tüm ekip + paket noktalarının göründüğü şekilde haritayı yakınlaştır
function FitBounds({ ekipler, paketler }) {
  const map = useMap();

  useEffect(() => {
    const noktalar = [];

    // Ekip konumları
    ekipler
      .filter(e => e.son_latitude && e.son_longitude)
      .forEach(e => noktalar.push([e.son_latitude, e.son_longitude]));

    // Paket konumları
    (paketler || [])
      .filter(p => p.latitude && p.longitude)
      .forEach(p => noktalar.push([p.latitude, p.longitude]));

    if (noktalar.length === 0) return;

    if (noktalar.length === 1) {
      map.setView(noktalar[0], 13);
    } else {
      const bounds = L.latLngBounds(noktalar);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [ekipler, paketler, map]);

  return null;
}

// ─── VERİ PAKETİ İKON ve RENKLERİ ──────────────────────
const PAKET_TIP_AYARLARI = {
  direk_tespit:    { ikon: '📍', renk: '#2563eb', etiket: 'Direk Tespit' },
  montaj_oncesi:   { ikon: '🔧', renk: '#ea580c', etiket: 'Montaj Öncesi' },
  montaj_sonrasi:  { ikon: '✅', renk: '#16a34a', etiket: 'Montaj Sonrası' },
  hasar_tespit:    { ikon: '⚠️', renk: '#dc2626', etiket: 'Hasar Tespit' },
  malzeme_tespit:  { ikon: '📦', renk: '#9333ea', etiket: 'Malzeme Tespit' },
  ilerleme_raporu: { ikon: '📊', renk: '#0891b2', etiket: 'İlerleme Raporu' },
  guzergah_tespit: { ikon: '🛤️', renk: '#4f46e5', etiket: 'Güzergah Tespit' },
  diger:           { ikon: '📸', renk: '#6b7280', etiket: 'Diğer' },
};

function getPaketTipAyar(tip) {
  return PAKET_TIP_AYARLARI[tip] || PAKET_TIP_AYARLARI.diger;
}

function createPaketIcon(tip) {
  const ayar = getPaketTipAyar(tip);
  return L.divIcon({
    className: 'paket-marker',
    html: `
      <div style="
        background: ${ayar.renk};
        width: 28px; height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        border: 2px solid white;
        transform: translate(-50%, -50%);
      ">
        ${ayar.ikon}
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

// ─── VERİ PAKETİ KARTI (Popup İçeriği) ──────────────────
function PaketKarti({ paket, detay, yukleniyor }) {
  const tipAyar = getPaketTipAyar(paket.paket_tipi);

  if (yukleniyor) {
    return <div style={{ padding: '8px', minWidth: '200px' }}>Yükleniyor...</div>;
  }

  return (
    <div style={{ minWidth: '260px', maxWidth: '340px', fontSize: '13px' }}>
      {/* Başlık */}
      <div style={{
        background: tipAyar.renk,
        color: 'white',
        padding: '10px 14px',
        margin: '-14px -20px 10px -20px',
        borderRadius: '12px 12px 0 0',
      }}>
        <div style={{ fontSize: '15px', fontWeight: '700' }}>
          {tipAyar.ikon} {paket.paket_no || `VP-${paket.id}`}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '2px' }}>
          {tipAyar.etiket}
        </div>
      </div>

      {/* Proje */}
      {paket.proje_no && (
        <div style={{ marginBottom: '6px' }}>
          <strong>Proje:</strong> {paket.proje_no}
          {paket.proje_adi && ` — ${paket.proje_adi}`}
        </div>
      )}

      {/* Ekip & Personel */}
      <div style={{ marginBottom: '6px' }}>
        {paket.ekip_kodu && <span><strong>Ekip:</strong> {paket.ekip_kodu} </span>}
        {paket.personel_adi && <span>• {paket.personel_adi}</span>}
      </div>

      {/* Fotoğraf sayısı */}
      <div style={{ marginBottom: '6px' }}>
        <strong>📸 {paket.foto_sayisi || 0}</strong> fotoğraf
        <span style={{ color: '#6b7280', marginLeft: '8px' }}>
          {new Date(paket.olusturma_tarihi).toLocaleString('tr-TR')}
        </span>
      </div>

      {/* Notlar */}
      {paket.notlar && (
        <div style={{
          background: '#f3f4f6',
          padding: '8px 10px',
          borderRadius: '6px',
          marginBottom: '8px',
          fontStyle: 'italic',
          color: '#374151',
        }}>
          "{paket.notlar}"
        </div>
      )}

      {/* Fotoğraf önizlemeleri (detay yüklendiğinde) */}
      {detay?.medyalar && detay.medyalar.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <strong>Fotoğraflar:</strong>
          <div style={{
            display: 'flex', gap: '4px', marginTop: '4px',
            overflowX: 'auto',
          }}>
            {detay.medyalar.slice(0, 4).map(m => (
              <div key={m.id} style={{
                width: '56px', height: '56px',
                background: '#e5e7eb',
                borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', color: '#6b7280', flexShrink: 0,
              }}>
                {m.dosya_tipi === 'photo' ? '🖼️' : '📄'}
              </div>
            ))}
            {detay.medyalar.length > 4 && (
              <div style={{
                width: '56px', height: '56px',
                background: '#e5e7eb', borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', color: '#6b7280', flexShrink: 0,
              }}>
                +{detay.medyalar.length - 4}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Durum */}
      <div style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '11px',
        fontWeight: 600,
        background: paket.durum === 'tamamlandi' ? '#dcfce7' : '#fef3c7',
        color: paket.durum === 'tamamlandi' ? '#166534' : '#92400e',
      }}>
        {paket.durum === 'tamamlandi' ? '✅ Tamamlandı' :
         paket.durum === 'aktif' ? '🔄 Aktif' : paket.durum || 'Belirsiz'}
      </div>
    </div>
  );
}

// ─── VERİ PAKETİ MARKER BİLEŞENİ ────────────────────────
function PaketMarker({ paket }) {
  const [detay, setDetay] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  const handleClick = useCallback(async () => {
    if (detay) return;
    setYukleniyor(true);
    try {
      const res = await fetch(`/api/saha/veri-paketleri/${paket.id}`);
      const json = await res.json();
      if (json.success) setDetay(json.data);
    } catch (err) {
      console.error('Paket detay hatası:', err);
    } finally {
      setYukleniyor(false);
    }
  }, [paket.id, detay]);

  if (!paket.latitude || !paket.longitude) return null;

  const tipAyar = getPaketTipAyar(paket.paket_tipi);

  return (
    <Marker
      position={[paket.latitude, paket.longitude]}
      icon={createPaketIcon(paket.paket_tipi)}
      eventHandlers={{ click: handleClick }}
    >
      <Tooltip direction="top" offset={[0, -10]}>
        <strong>{paket.paket_no || `VP-${paket.id}`}</strong>
        <br />
        {tipAyar.etiket} • 📸 {paket.foto_sayisi || 0}
        {paket.ekip_kodu && <><br />{paket.ekip_kodu}</>}
      </Tooltip>

      <Popup maxWidth={360} minWidth={260}>
        <PaketKarti paket={paket} detay={detay} yukleniyor={yukleniyor} />
      </Popup>
    </Marker>
  );
}

// ═══════════════════════════════════════════════════════════
// ANA SAHA SAYFASI
// ═══════════════════════════════════════════════════════════
export default function SahaPage() {
  const [ekipler, setEkipler] = useState([]);
  const [paketler, setPaketler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);

  // Katman görünürlüğü — kullanıcı açıp kapatabilir
  const [katmanlar, setKatmanlar] = useState({
    ekipler: true,
    veriPaketleri: true,
  });

  // Varsayılan merkez: Samsun
  const varsayilanMerkez = [41.2867, 36.3300];
  const varsayilanZoom = 10;

  // API'den ekip + veri paketi verilerini çek
  const verileriYukle = useCallback(async () => {
    try {
      const [ekipRes, paketRes] = await Promise.all([
        fetch('/api/saha/ekipler'),
        fetch('/api/saha/veri-paketleri'),
      ]);

      const ekipJson = await ekipRes.json();
      const paketJson = await paketRes.json();

      if (ekipJson.success) setEkipler(ekipJson.data);
      if (paketJson.success) setPaketler(paketJson.data);

      if (!ekipJson.success && !paketJson.success) {
        setHata('Veri yüklenemedi');
      }
    } catch (err) {
      setHata('Sunucuya bağlanılamadı');
      console.error('Saha veri hatası:', err);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  // İlk yükleme + 30sn'de bir yenileme
  useEffect(() => {
    verileriYukle();
    const interval = setInterval(verileriYukle, 30000);
    return () => clearInterval(interval);
  }, [verileriYukle]);

  // Konumlu sayılar
  const konumluEkipSayisi = ekipler.filter(e => e.son_latitude && e.son_longitude).length;
  const konumluPaketSayisi = paketler.filter(p => p.latitude && p.longitude).length;

  // Katman toggle fonksiyonu
  const katmanToggle = (key) => {
    setKatmanlar(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ─── ÜST BAR ───────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: '1px solid #e5e7eb',
        background: 'white',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
            🗺️ Saha Görünümü
          </h1>
          <p style={{ margin: '2px 0 0', color: '#6b7280', fontSize: '13px' }}>
            {konumluEkipSayisi} ekip haritada
            {konumluPaketSayisi > 0 && ` • ${konumluPaketSayisi} veri paketi`}
          </p>
        </div>

        {/* Katman kontrolleri */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={katmanlar.ekipler}
              onChange={() => katmanToggle('ekipler')}
            />
            👥 Ekipler
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={katmanlar.veriPaketleri}
              onChange={() => katmanToggle('veriPaketleri')}
            />
            📸 Veri Paketleri
          </label>
        </div>

        <button
          onClick={verileriYukle}
          style={{
            padding: '8px 16px',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          🔄 Yenile
        </button>
      </div>

      {/* ─── HATA DURUMU ───────────────────────────── */}
      {hata && (
        <div style={{
          padding: '12px 20px',
          background: '#fef2f2',
          color: '#991b1b',
          borderBottom: '1px solid #fecaca',
        }}>
          ⚠️ {hata}
        </div>
      )}

      {/* ─── HARİTA ────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative' }}>
        {yukleniyor ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: '#6b7280',
          }}>
            Harita yükleniyor...
          </div>
        ) : (
          <MapContainer
            center={varsayilanMerkez}
            zoom={varsayilanZoom}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            {/* Harita karoları — ÜCRETSİZ, API KEY YOK */}
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            {/* Ekip marker'ları */}
            {katmanlar.ekipler && ekipler.map((ekip, index) => (
              <EkipMarker
                key={`ekip-${ekip.id}`}
                ekip={ekip}
                renk={getRenk(index)}
              />
            ))}

            {/* Veri Paketi marker'ları */}
            {katmanlar.veriPaketleri && paketler.map(paket => (
              <VeriPaketMarker
                key={`paket-${paket.id}`}
                paket={paket}
              />
            ))}

            {/* Haritayı tüm noktalara sığdır */}
            <FitBounds ekipler={ekipler} paketler={paketler} />
          </MapContainer>
        )}

        {/* Sağ alt: Özet panel */}
        {!yukleniyor && (ekipler.length > 0 || paketler.length > 0) && (
          <div style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            padding: '12px',
            maxHeight: '280px',
            overflowY: 'auto',
            zIndex: 1000,
            minWidth: '220px',
          }}>
            {/* Ekipler */}
            {ekipler.length > 0 && (
              <>
                <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '13px' }}>
                  👥 Ekipler ({konumluEkipSayisi})
                </div>
                {ekipler.map((ekip, index) => (
                  <div
                    key={ekip.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '3px 0',
                      fontSize: '12px',
                    }}
                  >
                    <span style={{
                      width: '10px', height: '10px',
                      borderRadius: '50%',
                      background: getRenk(index),
                      display: 'inline-block',
                      flexShrink: 0,
                    }} />
                    <span style={{ fontWeight: 500 }}>{ekip.ekip_kodu}</span>
                    <span style={{ color: '#6b7280' }}>
                      {ekip.son_latitude ? `${ekip.personel_sayisi} kişi` : 'konum yok'}
                    </span>
                  </div>
                ))}
              </>
            )}

            {/* Veri Paketleri Özeti */}
            {konumluPaketSayisi > 0 && (
              <>
                <div style={{
                  fontWeight: 600,
                  marginTop: ekipler.length > 0 ? '10px' : '0',
                  marginBottom: '6px',
                  paddingTop: ekipler.length > 0 ? '8px' : '0',
                  borderTop: ekipler.length > 0 ? '1px solid #e5e7eb' : 'none',
                  fontSize: '13px',
                }}>
                  📸 Veri Paketleri ({konumluPaketSayisi})
                </div>
                {/* Tip bazlı özet */}
                {Object.entries(
                  paketler.reduce((acc, p) => {
                    const tip = p.paket_tipi || 'diger';
                    acc[tip] = (acc[tip] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([tip, sayi]) => {
                  const ayar = getPaketTipAyar(tip);
                  return (
                    <div
                      key={tip}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '3px 0',
                        fontSize: '12px',
                      }}
                    >
                      <span>{ayar.ikon}</span>
                      <span>{ayar.etiket}</span>
                      <span style={{ color: '#6b7280' }}>({sayi})</span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Adım 6 — CSS (Opsiyonel Düzeltmeler)

`client/src/index.css` veya global CSS dosyasına ekle:

```css
/* Leaflet Popup ve Marker düzeltmeleri */
.ekip-marker,
.paket-marker {
  background: none !important;
  border: none !important;
}

/* Leaflet popup stil düzeltmesi */
.leaflet-popup-content-wrapper {
  border-radius: 12px !important;
  padding: 4px !important;
}

.leaflet-popup-content {
  margin: 14px 20px !important;
  line-height: 1.5 !important;
}

/* Popup ok işareti */
.leaflet-popup-tip {
  background: white !important;
}

/* Harita konteyner yüksekliği */
.leaflet-container {
  height: 100%;
  width: 100%;
  z-index: 1;
}
```

---

## Beklenen Görünüm

```
┌──────────────────────────────────────────────────────────────────┐
│  🗺️ Saha Görünümü    ☑ 👥 Ekipler  ☑ 📸 Veri Paketleri  [🔄 Yenile]│
│  3 ekip haritada • 4 veri paketi                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                      H A R İ T A                                │
│                   (OpenStreetMap)                                │
│                                                                  │
│         ┌──────────┐                                            │
│         │  EK-01   │  ← Renkli etiket (ekip marker)            │
│         └──────────┘                                            │
│            📍  ✅    ← Tip ikonlu daireler (veri paketi marker) │
│                                                                  │
│                           ┌──────────┐                          │
│                           │  EK-02   │                          │
│                           └──────────┘                          │
│               ⚠️          ← Hasar tespit paketi (kırmızı daire)│
│                                                                  │
│    ┌──────────┐                                ┌──────────────┐ │
│    │  EK-03   │                                │ 👥 Ekipler(3)│ │
│    └──────────┘  📊                            │ 🔵 EK-01 4kişi│ │
│                                                │ 🔴 EK-02 3kişi│ │
│                                                │ 🟢 EK-03 5kişi│ │
│                                                │──────────────│ │
│                                                │ 📸 Veri Pktr(4)│ │
│                                                │ 📍 Direk Tes(1)│ │
│                                                │ ✅ Montaj Son(1)│ │
│                                                │ ⚠️ Hasar Tes(1)│ │
│                                                │ 📊 İlerleme (1)│ │
│                                                └──────────────┘ │
└──────────────────────────────────────────────────────────────────┘

EK-01'e tıklandığında (Ekip Kartı):
┌───────────────────────────────────┐
│ ▓▓▓▓ Ekip 1 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ✕ │
│ EK-01 • 4 kişi                    │
├───────────────────────────────────┤
│ Ekip Başı: Ahmet Yıldız          │
│                                   │
│ Personel:                         │
│ • Ahmet Yıldız (ekip_basi)       │
│ • Mehmet Kaya (usta)              │
│ • Ali Demir (kalfa)               │
│ • Veli Çelik (işçi)              │
│                                   │
│ Aktif Görevler:                   │
│ • YB-2025-001: Bafra hat çekimi  │
│ • KET-2025-011: Alaçam trafo     │
│                                   │
│ ┌─────────────────────────────┐  │
│ │ Bugün: 3 rapor, 7 fotoğraf │  │
│ └─────────────────────────────┘  │
│                                   │
│ 📍 Son konum: 08.02.2026 14:30   │
│    (telegram)                     │
└───────────────────────────────────┘

📍 Veri paketi marker'ına tıklandığında (Paket Kartı):
┌───────────────────────────────────┐
│ ▓▓ 📍 VP-2026-0001 ▓▓▓▓▓▓▓▓▓▓ ✕ │
│ Direk Tespit                      │
├───────────────────────────────────┤
│ Proje: YB-2025-001 — Bafra YB    │
│ Ekip: EK-01 (Ekip 1)             │
│ Gönderen: Ahmet Yıldız           │
│                                   │
│ 📸 3 fotoğraf                     │
│ 📝 "3 nolu direk montaj tamamlandı│
│     izolatörler takıldı"         │
│                                   │
│ ┌────────────────────────────┐   │
│ │ [foto1]  [foto2]  [foto3] │   │
│ └────────────────────────────┘   │
│                                   │
│ 📅 09.02.2026 11:30              │
│ 📍 41.5690, 35.9020              │
└───────────────────────────────────┘
```

---

## Kontrol Listesi

Geliştirme tamamlandığında kontrol et:

**Altyapı:**
- [ ] `npm install leaflet react-leaflet` — client'ta çalıştırıldı
- [ ] Leaflet CSS yükleniyor (harita karoları düzgün görünüyor)
- [ ] Leaflet marker ikon düzeltmesi uygulandı

**Veritabanı:**
- [ ] Ekipler tablosuna `son_latitude`, `son_longitude`, `son_konum_zamani`, `son_konum_kaynagi` sütunları eklendi
- [ ] Veri paketleri tablosuna `latitude`, `longitude` sütunları eklendi (yoksa)
- [ ] En az 2-3 ekibe test koordinatı girildi (Samsun bölgesi)
- [ ] En az 3-4 veri paketine test koordinatı girildi

**Backend API:**
- [ ] `GET /api/saha/ekipler` → Ekipleri konum + özet ile döndürüyor
- [ ] `GET /api/saha/ekipler/:id` → Detaylı ekip kartı döndürüyor
- [ ] `PUT /api/saha/ekipler/:id/konum` → Ekip konumunu güncelliyor
- [ ] `GET /api/saha/veri-paketleri` → Konumlu paketleri döndürüyor (filtre destekli)
- [ ] `GET /api/saha/veri-paketleri/:id` → Paket detay + fotoğraf listesi döndürüyor

**Frontend:**
- [ ] Sidebar'da "Saha" menüsü var ve `/saha` route'una gidiyor
- [ ] Harita açılıyor, OpenStreetMap karoları görünüyor
- [ ] Ekip marker'ları renkli etiketlerle haritada görünüyor
- [ ] Ekip marker'a tıklayınca ekip kartı (popup) açılıyor
- [ ] Veri paketi marker'ları tip ikonlu dairelerle haritada görünüyor
- [ ] Paket marker'a tıklayınca paket kartı (popup) açılıyor
- [ ] Üst bar'daki checkbox'larla katmanlar açılıp kapatılabiliyor
- [ ] Harita otomatik olarak tüm noktalara sığdırılıyor (fitBounds)
- [ ] Sağ alt köşede ekip + paket özet paneli görünüyor
- [ ] 30 saniyede bir otomatik yenileme çalışıyor

---

## İleri Aşama (Şimdi yapılmayacak)

Sonraki geliştirmeler için notlar:

1. **Proje marker'ları** — Projeleri haritada göster, ilerleme yüzdesi ile renklendir
2. **Hat güzergahları** — Polyline ile kablo hatlarını çiz
3. **Direk noktaları** — Her direği marker ile göster, durumuna göre renk ver
4. **Güzergah çizim aracı** — Harita üzerine tıklayarak hat çiz, direk ekle
5. **Ekip konum geçmişi** — Son 24 saatteki hareketleri çizgi ile göster
6. **Hasar/olay marker'ları** — Arıza, hasar, kesinti noktalarını göster
7. **Isı haritası** — İş yoğunluğu heat map
8. **Offline tile** — İnternet olmadan harita gösterme
