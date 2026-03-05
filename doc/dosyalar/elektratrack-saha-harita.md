# ElektraTrack — Saha Harita Modülü — Uygulama Kılavuzu

## Amaç

Sidebar'a "Saha" menüsü ekle. Açıldığında tam sayfa harita gösterilsin.  
Harita üzerinde ekiplerin çalıştığı koordinatlarda etiketli marker'lar bulunsun.  
Marker'a tıklandığında ekip kartı (popup) açılsın.

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
// Tüm ekiplerin göründüğü şekilde haritayı yakınlaştır
function FitBounds({ ekipler }) {
  const map = useMap();

  useEffect(() => {
    const konumluEkipler = ekipler.filter(e => e.son_latitude && e.son_longitude);
    if (konumluEkipler.length === 0) return;

    if (konumluEkipler.length === 1) {
      map.setView(
        [konumluEkipler[0].son_latitude, konumluEkipler[0].son_longitude],
        13
      );
    } else {
      const bounds = L.latLngBounds(
        konumluEkipler.map(e => [e.son_latitude, e.son_longitude])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [ekipler, map]);

  return null;
}

// ═══════════════════════════════════════════════════════════
// ANA SAHA SAYFASI
// ═══════════════════════════════════════════════════════════
export default function SahaPage() {
  const [ekipler, setEkipler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);

  // Varsayılan merkez: Samsun
  const varsayilanMerkez = [41.2867, 36.3300];
  const varsayilanZoom = 10;

  // API'den ekip verilerini çek
  const verileriYukle = useCallback(async () => {
    try {
      const res = await fetch('/api/saha/ekipler');
      const json = await res.json();
      if (json.success) {
        setEkipler(json.data);
      } else {
        setHata(json.error || 'Veri yüklenemedi');
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

  // Konumlu ekip sayısı
  const konumluEkipSayisi = ekipler.filter(e => e.son_latitude && e.son_longitude).length;

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
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
            🗺️ Saha Görünümü
          </h1>
          <p style={{ margin: '2px 0 0', color: '#6b7280', fontSize: '13px' }}>
            {ekipler.length} ekip toplam
            {konumluEkipSayisi > 0 && ` • ${konumluEkipSayisi} ekip haritada`}
            {konumluEkipSayisi === 0 && ' • Henüz konum atanmamış'}
          </p>
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
            {ekipler.map((ekip, index) => (
              <EkipMarker
                key={ekip.id}
                ekip={ekip}
                renk={getRenk(index)}
              />
            ))}

            {/* Haritayı tüm ekiplere sığdır */}
            <FitBounds ekipler={ekipler} />
          </MapContainer>
        )}

        {/* Sağ alt: Ekip listesi küçük panel */}
        {!yukleniyor && ekipler.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            padding: '12px',
            maxHeight: '200px',
            overflowY: 'auto',
            zIndex: 1000,
            minWidth: '200px',
          }}>
            <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '13px' }}>
              Ekipler
            </div>
            {ekipler.map((ekip, index) => (
              <div
                key={ekip.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 0',
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
.ekip-marker {
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
│  🗺️ Saha Görünümü                                    [🔄 Yenile]│
│  3 ekip toplam • 3 ekip haritada                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                      H A R İ T A                                │
│                   (OpenStreetMap)                                │
│                                                                  │
│         ┌──────────┐                                            │
│         │  EK-01   │  ← Renkli etiket (marker)                 │
│         └──────────┘                                            │
│                                                                  │
│                           ┌──────────┐                          │
│                           │  EK-02   │                          │
│                           └──────────┘                          │
│                                                                  │
│    ┌──────────┐                                ┌──────────────┐ │
│    │  EK-03   │                                │ Ekipler      │ │
│    └──────────┘                                │ 🔵 EK-01 4kişi│ │
│                                                │ 🔴 EK-02 3kişi│ │
│                                                │ 🟢 EK-03 5kişi│ │
│                                                └──────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

EK-01'e tıklandığında:
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
```

---

## Kontrol Listesi

Geliştirme tamamlandığında kontrol et:

- [ ] `npm install leaflet react-leaflet` — client'ta çalıştırıldı
- [ ] Leaflet CSS yükleniyor (harita karoları düzgün görünüyor)
- [ ] Leaflet marker ikon düzeltmesi uygulandı
- [ ] Ekipler tablosuna `son_latitude`, `son_longitude`, `son_konum_zamani`, `son_konum_kaynagi` sütunları eklendi
- [ ] En az 1-2 ekibe test koordinatı girildi (Samsun bölgesi)
- [ ] `GET /api/saha/ekipler` endpoint'i çalışıyor ve ekipleri döndürüyor
- [ ] `GET /api/saha/ekipler/:id` endpoint'i detaylı ekip kartı döndürüyor
- [ ] Sidebar'da "Saha" menüsü var ve `/saha` route'una gidiyor
- [ ] Harita açılıyor, OpenStreetMap karoları görünüyor
- [ ] Ekip marker'ları renkli etiketlerle haritada görünüyor
- [ ] Marker'a tıklayınca ekip kartı (popup) açılıyor
- [ ] Ekip kartında personel, aktif görevler, bugünkü aktivite gösteriliyor
- [ ] Harita otomatik olarak tüm ekiplere sığdırılıyor (fitBounds)
- [ ] Sağ alt köşede ekip listesi paneli görünüyor

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
