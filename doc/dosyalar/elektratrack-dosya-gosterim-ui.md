# ElektraTrack — Dosya Gösterim Katmanı (Frontend UI)

## Amaç

Dosyaların uygulamada nerede ve nasıl gösterileceğini tanımlar.

**İki katmanlı yaklaşım:**
1. **Modül içi sekmeler** → Her modülün detay sayfasında "Belgeler/Dosyalar" sekmesi
2. **Merkezi Dosya Yönetimi** → Sidebar'da ayrı menü, çapraz sorgu + yönetim

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  MODÜL İÇİ SEKME                    MERKEZİ DOSYA YÖNETİMİ         │
│  ────────────────                    ──────────────────────          │
│  Personel > Ahmet > [Belgeler]       📂 Dosya Yönetimi (menü)      │
│  Ekipman > Vinç-001 > [Belgeler]     ├── Alan kartları (8 alan)     │
│  Proje > YB-001 > [Dosyalar]        ├── Süresi dolan belgeler      │
│  İhale > IH-001 > [Dosyalar]        ├── Global arama/filtre        │
│  İSG > Denetim > [Dosyalar]         ├── İstatistikler               │
│                                      ├── Firma belgeleri             │
│  → O kaydın kendi dosyaları          └── Şablonlar                   │
│  → Aynı DosyaListesi bileşeni                                       │
│                                      → Tüm dosyalar tek yerden       │
│                                      → Çapraz sorgular               │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Ön koşul:** `elektratrack-dosya-sistemi-v2.md`'deki backend (DB, servis, API) hazır olmalı.

---

## Adım 1 — Ortak Dosya Listesi Bileşeni

Hem modül içi sekmelerde hem merkezi sayfada kullanılan tek bileşen. Tekrar yazmak yok — her yerde aynı bileşen, farklı `filtreler` prop'u ile çağrılır.

### `client/src/components/dosya/DosyaListesi.jsx`

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import DosyaOnizleme from './DosyaOnizleme';
import DosyaYukleModal from './DosyaYukleModal';

// ─── ALAN TANIMLARI ──────────────────────────────
const ALAN_BILGI = {
  proje:    { etiket: 'Projeler',      ikon: '📁', renk: '#2563eb' },
  personel: { etiket: 'Personel',      ikon: '👤', renk: '#8b5cf6' },
  ekipman:  { etiket: 'Ekipman',       ikon: '🔧', renk: '#f59e0b' },
  ihale:    { etiket: 'İhale',         ikon: '📋', renk: '#10b981' },
  isg:      { etiket: 'İSG',           ikon: '🛡️', renk: '#f43f5e' },
  firma:    { etiket: 'Firma',         ikon: '🏢', renk: '#6366f1' },
  muhasebe: { etiket: 'Muhasebe',      ikon: '💰', renk: '#84cc16' },
  kurum:    { etiket: 'Kurum Yazışma', ikon: '📨', renk: '#0ea5e9' },
};

const KATEGORI_IKON = {
  fotograf: '📸', cizim: '📐', belge: '📄', tablo: '📊',
  harita: '🗺️', arsiv: '📦', diger: '📎',
};

// ─── BOYUT FORMATLAMA ────────────────────────────
function boyutFormatla(byte) {
  if (!byte) return '—';
  if (byte < 1024) return byte + ' B';
  if (byte < 1024 * 1024) return (byte / 1024).toFixed(1) + ' KB';
  return (byte / (1024 * 1024)).toFixed(1) + ' MB';
}

// ─── TARIH FORMATLAMA ────────────────────────────
function tarihFormatla(tarih) {
  if (!tarih) return '—';
  const d = new Date(tarih);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Ortak dosya listesi bileşeni
 *
 * Kullanım örnekleri:
 *
 * Proje detayında:
 *   <DosyaListesi filtreler={{ alan: 'proje', proje_id: 5 }} yuklemeBilgi={{ alan: 'proje', projeNo: 'YB-2025-001', projeId: 5 }} />
 *
 * Personel detayında:
 *   <DosyaListesi filtreler={{ alan: 'personel', kaynak_tipi: 'personel', kaynak_id: 1 }} yuklemeBilgi={{ alan: 'personel', personelKodu: 'PER-001_Ahmet-Yilmaz' }} />
 *
 * Merkezi sayfada (filtresiz):
 *   <DosyaListesi />
 */
export default function DosyaListesi({
  filtreler = {},          // API'ye gönderilecek filtreler
  yuklemeBilgi = {},       // Yeni dosya yüklenirken kullanılacak alan bilgileri
  baslik = null,           // Bölüm başlığı (opsiyonel)
  kompakt = false,         // Kompakt mod (modül içi sekmelerde daha az yer kaplar)
  gizleAlanFiltre = false, // Alan filtresi gösterilsin mi (modül içinde gizle)
  gizleYukleButon = false, // Yükleme butonu gösterilsin mi
}) {
  const { authFetch, izinVar } = useAuth();

  const [dosyalar, setDosyalar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secilenDosya, setSecilenDosya] = useState(null);     // Önizleme
  const [yukleModalAcik, setYukleModalAcik] = useState(false);
  const [toplam, setToplam] = useState(0);
  const [sayfa, setSayfa] = useState(0);

  // Ek filtreler (kullanıcı seçimi)
  const [ekFiltre, setEkFiltre] = useState({
    kategori: '',
    etiket: '',
    arama: '',
  });

  // ─── VERİ YÜKLEME ──────────────────────────────
  const verileriYukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const params = new URLSearchParams();

      // Dışarıdan gelen sabit filtreler
      if (filtreler.alan) params.set('alan', filtreler.alan);
      if (filtreler.alt_alan) params.set('alt_alan', filtreler.alt_alan);
      if (filtreler.proje_id) params.set('proje_id', filtreler.proje_id);
      if (filtreler.kaynak_tipi) params.set('kaynak_tipi', filtreler.kaynak_tipi);
      if (filtreler.kaynak_id) params.set('kaynak_id', filtreler.kaynak_id);
      if (filtreler.veri_paketi_id) params.set('veri_paketi_id', filtreler.veri_paketi_id);

      // Kullanıcının ek filtreleri
      if (ekFiltre.kategori) params.set('kategori', ekFiltre.kategori);
      if (ekFiltre.etiket) params.set('etiket', ekFiltre.etiket);

      params.set('limit', '50');
      params.set('offset', String(sayfa * 50));

      let url;
      if (filtreler.alan) {
        url = `/api/dosya/alan/${filtreler.alan}?${params}`;
      } else {
        url = `/api/dosya?${params}`;
      }

      const res = await authFetch(url);
      const json = await res.json();
      if (json.success) {
        setDosyalar(json.data);
        setToplam(json.data.length);
      }
    } catch (err) {
      console.error('Dosya yükleme hatası:', err);
    } finally {
      setYukleniyor(false);
    }
  }, [filtreler, ekFiltre, sayfa]);

  useEffect(() => { verileriYukle(); }, [verileriYukle]);

  // ─── ARAMA FİLTRESİ (client-side) ──────────────
  const filtrelenmis = dosyalar.filter(d => {
    if (!ekFiltre.arama) return true;
    const ara = ekFiltre.arama.toLowerCase();
    return (
      (d.dosya_adi || '').toLowerCase().includes(ara) ||
      (d.baslik || '').toLowerCase().includes(ara) ||
      (d.notlar || '').toLowerCase().includes(ara) ||
      (d.orijinal_adi || '').toLowerCase().includes(ara)
    );
  });

  // ─── RENDER ─────────────────────────────────────
  return (
    <div>
      {/* ─── BAŞLIK + YÜKLE BUTONU ─────────────── */}
      {(baslik || !gizleYukleButon) && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '12px',
        }}>
          {baslik && <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{baslik}</h3>}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>{toplam} dosya</span>
            {!gizleYukleButon && izinVar('dosyalar', 'yazma') && (
              <button
                onClick={() => setYukleModalAcik(true)}
                style={{
                  padding: '7px 14px', fontSize: '13px', fontWeight: 600,
                  background: '#2563eb', color: 'white',
                  border: 'none', borderRadius: '8px', cursor: 'pointer',
                }}
              >
                + Dosya Yükle
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── FİLTRE ÇUBUĞU ────────────────────── */}
      <div style={{
        display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap',
      }}>
        {/* Arama */}
        <input
          value={ekFiltre.arama}
          onChange={(e) => setEkFiltre({ ...ekFiltre, arama: e.target.value })}
          placeholder="🔍 Dosya ara..."
          style={{
            padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: '8px',
            fontSize: '13px', flex: kompakt ? '1' : '0 0 220px',
          }}
        />

        {/* Kategori filtresi */}
        <select
          value={ekFiltre.kategori}
          onChange={(e) => setEkFiltre({ ...ekFiltre, kategori: e.target.value })}
          style={{
            padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: '8px',
            fontSize: '13px', color: '#374151', background: 'white',
          }}
        >
          <option value="">Tüm Tipler</option>
          <option value="fotograf">📸 Fotoğraf</option>
          <option value="cizim">📐 Çizim</option>
          <option value="belge">📄 Belge</option>
          <option value="tablo">📊 Tablo</option>
          <option value="harita">🗺️ Harita</option>
          <option value="arsiv">📦 Arşiv</option>
        </select>

        {/* Etiket filtresi */}
        <input
          value={ekFiltre.etiket}
          onChange={(e) => setEkFiltre({ ...ekFiltre, etiket: e.target.value })}
          placeholder="🏷️ Etiket..."
          style={{
            padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: '8px',
            fontSize: '13px', width: '120px',
          }}
        />
      </div>

      {/* ─── DOSYA LİSTESİ ────────────────────── */}
      {yukleniyor ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
          Yükleniyor...
        </div>
      ) : filtrelenmis.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
          <div>Dosya bulunamadı</div>
        </div>
      ) : (
        <div style={{
          border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden',
        }}>
          {/* Tablo başlığı */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: kompakt
              ? '1fr 80px 90px'
              : '40px 1fr 100px 80px 90px 100px 40px',
            padding: '8px 12px',
            background: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
            fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase',
          }}>
            {!kompakt && <span></span>}
            <span>Dosya</span>
            {!kompakt && <span>Alan</span>}
            <span>Boyut</span>
            <span>Tarih</span>
            {!kompakt && <span>Yükleyen</span>}
            {!kompakt && <span></span>}
          </div>

          {/* Dosya satırları */}
          {filtrelenmis.map(dosya => (
            <DosyaSatir
              key={dosya.id}
              dosya={dosya}
              kompakt={kompakt}
              onClick={() => setSecilenDosya(dosya)}
            />
          ))}
        </div>
      )}

      {/* ─── ÖNİZLEME MODAL ───────────────────── */}
      {secilenDosya && (
        <DosyaOnizleme
          dosya={secilenDosya}
          onKapat={() => setSecilenDosya(null)}
        />
      )}

      {/* ─── YÜKLEME MODAL ────────────────────── */}
      {yukleModalAcik && (
        <DosyaYukleModal
          yuklemeBilgi={yuklemeBilgi}
          onKapat={() => setYukleModalAcik(false)}
          onBasarili={() => { setYukleModalAcik(false); verileriYukle(); }}
        />
      )}
    </div>
  );
}

// ─── TEK DOSYA SATIRI ─────────────────────────────
function DosyaSatir({ dosya, kompakt, onClick }) {
  const katIkon = KATEGORI_IKON[dosya.kategori] || '📎';
  const alanBilgi = ALAN_BILGI[dosya.alan];

  // Thumbnail varsa göster
  const thumbUrl = dosya.thumbnail_yolu ? `/uploads/${dosya.thumbnail_yolu}` : null;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: kompakt
          ? '1fr 80px 90px'
          : '40px 1fr 100px 80px 90px 100px 40px',
        padding: '10px 12px',
        borderBottom: '1px solid #f3f4f6',
        cursor: 'pointer',
        transition: 'background 0.1s',
        alignItems: 'center',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {/* Thumbnail / ikon */}
      {!kompakt && (
        <div>
          {thumbUrl ? (
            <img src={thumbUrl} alt="" style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '20px' }}>{katIkon}</span>
          )}
        </div>
      )}

      {/* Dosya adı + başlık + etiketler */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: '13px', fontWeight: 500, color: '#1f2937',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {kompakt && <span style={{ marginRight: '4px' }}>{katIkon}</span>}
          {dosya.baslik || dosya.orijinal_adi || dosya.dosya_adi}
        </div>
        {dosya.etiketler && (
          <div style={{ display: 'flex', gap: '3px', marginTop: '2px', flexWrap: 'wrap' }}>
            {JSON.parse(dosya.etiketler).slice(0, 3).map(tag => (
              <span key={tag} style={{
                fontSize: '10px', padding: '1px 5px', borderRadius: '4px',
                background: '#f3f4f6', color: '#6b7280',
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Alan badge */}
      {!kompakt && alanBilgi && (
        <span style={{
          fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '6px',
          background: `${alanBilgi.renk}12`, color: alanBilgi.renk,
        }}>
          {alanBilgi.ikon} {alanBilgi.etiket}
        </span>
      )}

      {/* Boyut */}
      <span style={{ fontSize: '12px', color: '#6b7280' }}>
        {boyutFormatla(dosya.dosya_boyutu)}
      </span>

      {/* Tarih */}
      <span style={{ fontSize: '12px', color: '#6b7280' }}>
        {tarihFormatla(dosya.olusturma_tarihi)}
      </span>

      {/* Yükleyen */}
      {!kompakt && (
        <span style={{ fontSize: '12px', color: '#6b7280' }}>
          {dosya.yukleyen_adi || '—'}
        </span>
      )}

      {/* İndir butonu */}
      {!kompakt && (
        <a
          href={`/api/dosya/${dosya.id}/indir`}
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: '16px', textDecoration: 'none' }}
          title="İndir"
        >
          ⬇️
        </a>
      )}
    </div>
  );
}
```

---

## Adım 2 — Modül İçi Sekme Kullanımları

Her modülün detay sayfasında `DosyaListesi` bileşeni farklı filtrelerle çağrılır.

### Kullanım Haritası

```
┌─────────────────┬─────────────────────────────────────────────────────────────────┐
│ Modül           │ DosyaListesi Kullanımı                                         │
├─────────────────┼─────────────────────────────────────────────────────────────────┤
│ Proje Detay     │ <DosyaListesi                                                  │
│                 │   filtreler={{ alan: 'proje', proje_id: proje.id }}             │
│                 │   yuklemeBilgi={{ alan: 'proje', projeNo: 'YB-2025-001',       │
│                 │     projeId: proje.id }}                                        │
│                 │   kompakt={false}                                               │
│                 │   gizleAlanFiltre={true}                                        │
│                 │ />                                                              │
├─────────────────┼─────────────────────────────────────────────────────────────────┤
│ Personel Detay  │ <DosyaListesi                                                  │
│                 │   filtreler={{ alan: 'personel',                                │
│                 │     kaynak_tipi: 'personel', kaynak_id: personel.id }}          │
│                 │   yuklemeBilgi={{ alan: 'personel',                             │
│                 │     personelKodu: 'PER-001_Ahmet-Yilmaz' }}                    │
│                 │   kompakt={true}                                                │
│                 │ />                                                              │
├─────────────────┼─────────────────────────────────────────────────────────────────┤
│ Ekipman Detay   │ <DosyaListesi                                                  │
│                 │   filtreler={{ alan: 'ekipman',                                 │
│                 │     kaynak_tipi: 'ekipman', kaynak_id: ekipman.id }}            │
│                 │   yuklemeBilgi={{ alan: 'ekipman',                              │
│                 │     ekipmanKodu: '34-ABC-123_Ford-Ranger' }}                    │
│                 │   kompakt={true}                                                │
│                 │ />                                                              │
├─────────────────┼─────────────────────────────────────────────────────────────────┤
│ İhale Detay     │ <DosyaListesi                                                  │
│                 │   filtreler={{ alan: 'ihale',                                   │
│                 │     kaynak_tipi: 'ihale', kaynak_id: ihale.id }}                │
│                 │   yuklemeBilgi={{ alan: 'ihale',                                │
│                 │     ihaleNo: 'IH-2026-001_Bafra-OG-Hat' }}                     │
│                 │ />                                                              │
├─────────────────┼─────────────────────────────────────────────────────────────────┤
│ İSG Denetim     │ <DosyaListesi                                                  │
│                 │   filtreler={{ alan: 'isg', alt_alan: 'denetim' }}              │
│                 │   yuklemeBilgi={{ alan: 'isg', altAlan: 'denetim' }}            │
│                 │ />                                                              │
├─────────────────┼─────────────────────────────────────────────────────────────────┤
│ Veri Paketi     │ <DosyaListesi                                                  │
│ Detay           │   filtreler={{ veri_paketi_id: paket.id }}                      │
│                 │   kompakt={true}                                                │
│                 │   gizleYukleButon={true}                                        │
│                 │ />                                                              │
├─────────────────┼─────────────────────────────────────────────────────────────────┤
│ Finansal/       │ <DosyaListesi                                                  │
│ Muhasebe        │   filtreler={{ alan: 'muhasebe' }}                              │
│                 │   yuklemeBilgi={{ alan: 'muhasebe' }}                           │
│                 │ />                                                              │
├─────────────────┼─────────────────────────────────────────────────────────────────┤
│ Kurum Yazışma   │ <DosyaListesi                                                  │
│                 │   filtreler={{ alan: 'kurum', alt_alan: 'yedas' }}              │
│                 │   yuklemeBilgi={{ alan: 'kurum', kurumAdi: 'yedas' }}           │
│                 │ />                                                              │
└─────────────────┴─────────────────────────────────────────────────────────────────┘
```

### Örnek: Personel Detay Sayfasında Belgeler Sekmesi

```jsx
// client/src/pages/PersonelDetay.jsx

import DosyaListesi from '../components/dosya/DosyaListesi';

export default function PersonelDetay({ personel }) {
  const [aktifSekme, setAktifSekme] = useState('genel');

  return (
    <div>
      <h1>{personel.ad_soyad}</h1>

      {/* Sekmeler */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e5e7eb', marginBottom: '16px' }}>
        {['genel', 'belgeler', 'projeler'].map(sekme => (
          <button
            key={sekme}
            onClick={() => setAktifSekme(sekme)}
            style={{
              padding: '8px 16px', fontSize: '13px', fontWeight: 600,
              border: 'none', cursor: 'pointer',
              borderBottom: aktifSekme === sekme ? '2px solid #2563eb' : '2px solid transparent',
              color: aktifSekme === sekme ? '#2563eb' : '#6b7280',
              background: 'transparent', marginBottom: '-2px',
            }}
          >
            {sekme === 'genel' && '👤 Genel'}
            {sekme === 'belgeler' && '📄 Belgeler'}
            {sekme === 'projeler' && '📁 Projeler'}
          </button>
        ))}
      </div>

      {/* Belgeler sekmesi */}
      {aktifSekme === 'belgeler' && (
        <DosyaListesi
          baslik="Personel Belgeleri"
          filtreler={{
            alan: 'personel',
            kaynak_tipi: 'personel',
            kaynak_id: personel.id,
          }}
          yuklemeBilgi={{
            alan: 'personel',
            personelKodu: `PER-${String(personel.id).padStart(3,'0')}_${personel.ad_soyad.replace(/\s/g, '-')}`,
            iliskiliKaynakTipi: 'personel',
            iliskiliKaynakId: personel.id,
          }}
          kompakt={true}
          gizleAlanFiltre={true}
        />
      )}

      {/* Diğer sekmeler ... */}
    </div>
  );
}
```

### Örnek: Proje Detay Sayfasında Dosyalar Sekmesi

```jsx
// client/src/pages/ProjeDetay.jsx içinde

{aktifSekme === 'dosyalar' && (
  <DosyaListesi
    baslik="Proje Dosyaları"
    filtreler={{
      alan: 'proje',
      proje_id: proje.id,
    }}
    yuklemeBilgi={{
      alan: 'proje',
      projeNo: proje.proje_no,
      projeId: proje.id,
    }}
    gizleAlanFiltre={true}
  />
)}
```

---

## Adım 3 — Merkezi Dosya Yönetimi Sayfası

Sidebar'daki "📂 Dosya Yönetimi" menüsüne tıklanınca açılır.

### `client/src/pages/DosyaYonetimiPage.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import DosyaListesi from '../components/dosya/DosyaListesi';

// ─── ALAN TANIMLARI ──────────────────────────────
const ALANLAR = [
  { kod: 'proje',    etiket: 'Projeler',        ikon: '📁', renk: '#2563eb', aciklama: 'Saha fotoğrafları, çizimler, proje belgeleri' },
  { kod: 'personel', etiket: 'Personel',         ikon: '👤', renk: '#8b5cf6', aciklama: 'Kimlik, sertifika, sağlık, SGK belgeleri' },
  { kod: 'ekipman',  etiket: 'Ekipman / Araç',   ikon: '🔧', renk: '#f59e0b', aciklama: 'Ruhsat, muayene, bakım, kalibrasyon' },
  { kod: 'ihale',    etiket: 'İhale',            ikon: '📋', renk: '#10b981', aciklama: 'Şartname, teklif, sözleşme, keşif' },
  { kod: 'isg',      etiket: 'İSG',              ikon: '🛡️', renk: '#f43f5e', aciklama: 'Risk değerlendirme, eğitim, denetim, kaza' },
  { kod: 'firma',    etiket: 'Firma Belgeleri',   ikon: '🏢', renk: '#6366f1', aciklama: 'Yetki belgeleri, sigorta, resmi belgeler' },
  { kod: 'muhasebe', etiket: 'Muhasebe',          ikon: '💰', renk: '#84cc16', aciklama: 'Fatura, hak ediş, banka, vergi' },
  { kod: 'kurum',    etiket: 'Kurum Yazışma',     ikon: '📨', renk: '#0ea5e9', aciklama: 'YEDAŞ, belediye, TEDAŞ yazışmaları' },
];

// ─── ALT SEKMELER ────────────────────────────────
const ALT_SEKMELER = ['alanlar', 'suresi_dolan', 'arama', 'istatistik', 'sablonlar'];

export default function DosyaYonetimiPage() {
  const { authFetch } = useAuth();
  const [aktifSekme, setAktifSekme] = useState('alanlar');
  const [seciliAlan, setSeciliAlan] = useState(null);    // Alan kartından tıkla → detay
  const [istatistik, setIstatistik] = useState([]);
  const [suresiDolanlar, setSuresiDolanlar] = useState([]);

  // İstatistik yükle
  useEffect(() => {
    authFetch('/api/dosya/istatistik/alan')
      .then(r => r.json())
      .then(j => { if (j.success) setIstatistik(j.data); });

    authFetch('/api/dosya/suresi-dolan?gun=30')
      .then(r => r.json())
      .then(j => { if (j.success) setSuresiDolanlar(j.data); });
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>
        📂 Dosya Yönetimi
      </h1>

      {/* ─── ÜST SEKMELER ───────────────────── */}
      <div style={{
        display: 'flex', gap: '4px',
        borderBottom: '2px solid #e5e7eb', marginBottom: '20px',
      }}>
        {[
          { kod: 'alanlar',      etiket: '📁 Alanlar' },
          { kod: 'suresi_dolan', etiket: `⚠️ Süresi Dolan (${suresiDolanlar.length})` },
          { kod: 'arama',        etiket: '🔍 Arama' },
          { kod: 'istatistik',   etiket: '📊 İstatistik' },
          { kod: 'sablonlar',    etiket: '📄 Şablonlar' },
        ].map(s => (
          <button
            key={s.kod}
            onClick={() => { setAktifSekme(s.kod); setSeciliAlan(null); }}
            style={{
              padding: '8px 16px', fontSize: '13px', fontWeight: 600,
              border: 'none', cursor: 'pointer', background: 'transparent',
              borderBottom: aktifSekme === s.kod ? '2px solid #2563eb' : '2px solid transparent',
              color: aktifSekme === s.kod ? '#2563eb' : '#6b7280',
              marginBottom: '-2px',
            }}
          >
            {s.etiket}
          </button>
        ))}
      </div>

      {/* ─── ALANLAR SEKMESİ ─────────────────── */}
      {aktifSekme === 'alanlar' && !seciliAlan && (
        <AlanKartlari
          alanlar={ALANLAR}
          istatistik={istatistik}
          onSec={setSeciliAlan}
        />
      )}

      {/* Seçili alana girildiyse dosya listesi */}
      {aktifSekme === 'alanlar' && seciliAlan && (
        <div>
          <button
            onClick={() => setSeciliAlan(null)}
            style={{
              padding: '6px 12px', fontSize: '13px',
              background: '#f3f4f6', border: 'none', borderRadius: '6px',
              cursor: 'pointer', marginBottom: '12px',
            }}
          >
            ← Alanlara Dön
          </button>

          <DosyaListesi
            baslik={`${ALANLAR.find(a => a.kod === seciliAlan)?.ikon} ${ALANLAR.find(a => a.kod === seciliAlan)?.etiket}`}
            filtreler={{ alan: seciliAlan }}
            yuklemeBilgi={{ alan: seciliAlan }}
            gizleAlanFiltre={true}
          />
        </div>
      )}

      {/* ─── SÜRESİ DOLAN BELGELER ──────────── */}
      {aktifSekme === 'suresi_dolan' && (
        <SuresiDolanTablo dosyalar={suresiDolanlar} />
      )}

      {/* ─── GLOBAL ARAMA ────────────────────── */}
      {aktifSekme === 'arama' && (
        <DosyaListesi
          baslik="Tüm Dosyalarda Ara"
          gizleAlanFiltre={false}
          gizleYukleButon={true}
        />
      )}

      {/* ─── İSTATİSTİK ─────────────────────── */}
      {aktifSekme === 'istatistik' && (
        <DosyaIstatistik istatistik={istatistik} alanlar={ALANLAR} />
      )}

      {/* ─── ŞABLONLAR ──────────────────────── */}
      {aktifSekme === 'sablonlar' && (
        <DosyaListesi
          baslik="📄 Şablon Dosyalar"
          filtreler={{ alan: 'sablon' }}
          yuklemeBilgi={{ alan: 'sablon' }}
          gizleAlanFiltre={true}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// ALT BİLEŞENLER
// ═══════════════════════════════════════════════════

// ─── ALAN KARTLARI ────────────────────────────────
function AlanKartlari({ alanlar, istatistik, onSec }) {
  // İstatistikleri alan bazında grupla
  const alanIstat = {};
  for (const row of istatistik) {
    if (!alanIstat[row.alan]) alanIstat[row.alan] = { sayi: 0, boyut: 0 };
    alanIstat[row.alan].sayi += row.dosya_sayisi;
    alanIstat[row.alan].boyut += row.toplam_boyut;
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: '12px',
    }}>
      {alanlar.map(alan => {
        const is = alanIstat[alan.kod] || { sayi: 0, boyut: 0 };

        return (
          <div
            key={alan.kod}
            onClick={() => onSec(alan.kod)}
            style={{
              padding: '16px',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              borderLeft: `4px solid ${alan.renk}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '28px' }}>{alan.ikon}</span>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#1f2937' }}>
                  {alan.etiket}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                  {alan.aciklama}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#6b7280' }}>
              <span>{is.sayi} dosya</span>
              <span>{boyutFormatla(is.boyut)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function boyutFormatla(byte) {
  if (!byte) return '0 B';
  if (byte < 1024) return byte + ' B';
  if (byte < 1024 * 1024) return (byte / 1024).toFixed(1) + ' KB';
  if (byte < 1024 * 1024 * 1024) return (byte / (1024 * 1024)).toFixed(1) + ' MB';
  return (byte / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

// ─── SÜRESİ DOLAN BELGELER TABLOSU ───────────────
function SuresiDolanTablo({ dosyalar }) {
  const bugun = new Date().toISOString().slice(0, 10);

  // Her dosyanın en erken biten tarihini bul
  const satirlar = dosyalar.map(d => {
    const ozel = d.ozel_alanlar ? JSON.parse(d.ozel_alanlar) : {};
    const tarihler = [
      ozel.gecerlilik_bitis,
      ozel.muayene_bitis,
      ozel.kalibrasyon_bitis,
      ozel.sigorta_bitis,
    ].filter(Boolean);

    const enErken = tarihler.sort()[0];
    const dolmus = enErken && enErken < bugun;
    const kalanGun = enErken ? Math.ceil((new Date(enErken) - new Date()) / (1000 * 60 * 60 * 24)) : null;

    return { ...d, enErken, dolmus, kalanGun, ozel };
  }).sort((a, b) => (a.enErken || 'z').localeCompare(b.enErken || 'z'));

  if (satirlar.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        ✅ Süresi dolacak belge bulunmadı (30 gün içi)
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
      {/* Başlık */}
      <div style={{
        display: 'grid', gridTemplateColumns: '60px 1fr 120px 100px 100px 80px',
        padding: '8px 12px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
        fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase',
      }}>
        <span>Durum</span>
        <span>Belge</span>
        <span>Alan</span>
        <span>İlişkili</span>
        <span>Bitiş Tarihi</span>
        <span>Kalan</span>
      </div>

      {/* Satırlar */}
      {satirlar.map(d => (
        <div key={d.id} style={{
          display: 'grid', gridTemplateColumns: '60px 1fr 120px 100px 100px 80px',
          padding: '10px 12px', borderBottom: '1px solid #f3f4f6',
          background: d.dolmus ? '#fef2f2' : 'transparent',
          alignItems: 'center',
        }}>
          {/* Durum */}
          <span style={{ fontSize: '18px' }}>
            {d.dolmus ? '🔴' : d.kalanGun <= 7 ? '🟠' : '🟡'}
          </span>

          {/* Belge adı */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>
              {d.baslik || d.orijinal_adi || d.dosya_adi}
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>
              {d.alt_alan && d.alt_alan.replace(/_/g, ' ')}
            </div>
          </div>

          {/* Alan */}
          <span style={{ fontSize: '12px', color: '#6b7280' }}>
            {ALANLAR.find(a => a.kod === d.alan)?.ikon} {ALANLAR.find(a => a.kod === d.alan)?.etiket}
          </span>

          {/* İlişkili kayıt */}
          <span style={{ fontSize: '12px', color: '#6b7280' }}>
            {d.proje_no || d.yukleyen_adi || '—'}
          </span>

          {/* Bitiş tarihi */}
          <span style={{
            fontSize: '12px', fontWeight: 600,
            color: d.dolmus ? '#dc2626' : d.kalanGun <= 7 ? '#ea580c' : '#6b7280',
          }}>
            {d.enErken}
          </span>

          {/* Kalan gün */}
          <span style={{
            fontSize: '12px', fontWeight: 700,
            color: d.dolmus ? '#dc2626' : d.kalanGun <= 7 ? '#ea580c' : '#6b7280',
          }}>
            {d.dolmus ? 'DOLMUŞ' : `${d.kalanGun} gün`}
          </span>
        </div>
      ))}
    </div>
  );
}

const ALANLAR_REF = [
  { kod: 'proje',    ikon: '📁', etiket: 'Projeler' },
  { kod: 'personel', ikon: '👤', etiket: 'Personel' },
  { kod: 'ekipman',  ikon: '🔧', etiket: 'Ekipman' },
  { kod: 'ihale',    ikon: '📋', etiket: 'İhale' },
  { kod: 'isg',      ikon: '🛡️', etiket: 'İSG' },
  { kod: 'firma',    ikon: '🏢', etiket: 'Firma' },
  { kod: 'muhasebe', ikon: '💰', etiket: 'Muhasebe' },
  { kod: 'kurum',    ikon: '📨', etiket: 'Kurum' },
];

// ─── İSTATİSTİK PANELİ ───────────────────────────
function DosyaIstatistik({ istatistik, alanlar }) {
  // Alan bazlı topla
  const alanToplam = {};
  let genelToplam = { sayi: 0, boyut: 0 };

  for (const row of istatistik) {
    if (!alanToplam[row.alan]) alanToplam[row.alan] = { sayi: 0, boyut: 0, altlar: [] };
    alanToplam[row.alan].sayi += row.dosya_sayisi;
    alanToplam[row.alan].boyut += row.toplam_boyut;
    alanToplam[row.alan].altlar.push({ altAlan: row.alt_alan, sayi: row.dosya_sayisi, boyut: row.toplam_boyut });
    genelToplam.sayi += row.dosya_sayisi;
    genelToplam.boyut += row.toplam_boyut;
  }

  return (
    <div>
      {/* Genel özet */}
      <div style={{
        display: 'flex', gap: '20px', marginBottom: '20px',
        padding: '16px', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd',
      }}>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0369a1' }}>{genelToplam.sayi}</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Toplam Dosya</div>
        </div>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0369a1' }}>{boyutFormatla(genelToplam.boyut)}</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Toplam Boyut</div>
        </div>
      </div>

      {/* Alan bazlı detay */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
        {alanlar.map(alan => {
          const is = alanToplam[alan.kod];
          if (!is) return null;

          return (
            <div key={alan.kod} style={{
              border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px',
              borderLeft: `4px solid ${alan.renk}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>
                  {alan.ikon} {alan.etiket}
                </span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                  {is.sayi} dosya • {boyutFormatla(is.boyut)}
                </span>
              </div>

              {/* Alt alan dağılımı */}
              {is.altlar.map(alt => (
                <div key={alt.altAlan} style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: '12px', color: '#6b7280', padding: '2px 0',
                }}>
                  <span>{alt.altAlan?.replace(/_/g, ' ') || 'genel'}</span>
                  <span>{alt.sayi} dosya ({boyutFormatla(alt.boyut)})</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## Adım 4 — Sidebar Menü Güncellemesi

`AppLayout.jsx`'deki menü tanımlarına Dosya Yönetimi eklenir:

```javascript
const MENU_ITEMS = [
  { label: 'Dashboard',        path: '/',               icon: '🏠',  herZaman: true },
  { label: 'Projeler',         path: '/projeler',       icon: '📁',  modul: 'projeler',     aksiyon: 'okuma' },
  { label: 'Ekipler',          path: '/ekipler',        icon: '👥',  modul: 'ekipler',      aksiyon: 'okuma' },
  { label: 'Personel',         path: '/personel',       icon: '👤',  modul: 'personel',     aksiyon: 'okuma' },
  { label: 'Veri Paketleri',   path: '/veri-paketi',    icon: '📦',  modul: 'veri_paketi',  aksiyon: 'okuma' },
  { label: 'Saha Harita',      path: '/saha',           icon: '🗺️',  modul: 'saha_harita',  aksiyon: 'okuma' },
  { label: 'Saha Mesaj',       path: '/saha-mesaj',     icon: '💬',  modul: 'saha_mesaj',   aksiyon: 'yazma' },

  // ─── YENİ: Dosya Yönetimi ─────────────────
  { label: 'Dosya Yönetimi',   path: '/dosya-yonetimi', icon: '📂',  modul: 'dosyalar',     aksiyon: 'okuma' },

  { label: 'Malzeme/Depo',     path: '/malzeme',        icon: '🏪',  modul: 'malzeme',      aksiyon: 'okuma' },
  { label: 'Finansal',         path: '/finansal',       icon: '💰',  modul: 'finansal',     aksiyon: 'okuma' },
  { label: 'İSG',              path: '/isg',            icon: '🛡️',  modul: 'isg',          aksiyon: 'okuma' },
  { label: 'Raporlar',         path: '/raporlar',       icon: '📊',  modul: 'raporlar',     aksiyon: 'genel' },
  { label: 'Ayarlar',          path: '/ayarlar',        icon: '⚙️',  modul: 'ayarlar',      aksiyon: 'genel' },
];
```

### Route Ekleme

```jsx
// App.jsx'e ekle
import DosyaYonetimiPage from './pages/DosyaYonetimiPage';

<Route path="/dosya-yonetimi" element={
  <ProtectedRoute modul="dosyalar" aksiyon="okuma">
    <DosyaYonetimiPage />
  </ProtectedRoute>
} />
```

---

## Beklenen Görünüm

### Merkezi Dosya Yönetimi — Alanlar Sekmesi

```
┌──────────────────────────────────────────────────────────────────┐
│ 📂 Dosya Yönetimi                                               │
│ [📁 Alanlar] [⚠️ Süresi Dolan (4)] [🔍 Arama] [📊 İstatistik] [📄 Şablonlar] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─── Projeler ──────────┐  ┌─── Personel ──────────┐          │
│  │ 📁                    │  │ 👤                      │          │
│  │ Saha fotoğrafları,    │  │ Kimlik, sertifika,      │          │
│  │ çizimler, proje       │  │ sağlık, SGK belgeleri   │          │
│  │ belgeleri              │  │                         │          │
│  │ 142 dosya • 1.2 GB    │  │ 67 dosya • 340 MB       │          │
│  └────────────────────────┘  └─────────────────────────┘          │
│                                                                  │
│  ┌─── Ekipman/Araç ─────┐  ┌─── İhale ──────────────┐          │
│  │ 🔧                    │  │ 📋                      │          │
│  │ Ruhsat, muayene,      │  │ Şartname, teklif,       │          │
│  │ bakım, kalibrasyon    │  │ sözleşme, keşif         │          │
│  │ 23 dosya • 180 MB     │  │ 35 dosya • 220 MB       │          │
│  └────────────────────────┘  └─────────────────────────┘          │
│                                                                  │
│  ┌─── İSG ───────────────┐  ┌─── Firma Belgeleri ───┐          │
│  │ 🛡️                    │  │ 🏢                      │          │
│  │ Risk, eğitim,         │  │ Yetki belgeleri,        │          │
│  │ denetim, kaza         │  │ sigorta, resmi          │          │
│  │ 28 dosya • 95 MB      │  │ 15 dosya • 45 MB        │          │
│  └────────────────────────┘  └─────────────────────────┘          │
│                                                                  │
│  ┌─── Muhasebe ──────────┐  ┌─── Kurum Yazışma ─────┐          │
│  │ 💰                    │  │ 📨                      │          │
│  │ Fatura, hak ediş,     │  │ YEDAŞ, belediye,        │          │
│  │ banka, vergi          │  │ TEDAŞ yazışmaları       │          │
│  │ 89 dosya • 310 MB     │  │ 42 dosya • 155 MB       │          │
│  └────────────────────────┘  └─────────────────────────┘          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Merkezi — Süresi Dolan Belgeler

```
┌──────────────────────────────────────────────────────────────────┐
│ 📂 Dosya Yönetimi                                               │
│ [📁 Alanlar] [⚠️ Süresi Dolan (4)] [🔍 Arama] [📊 İstatistik] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Durum │ Belge                    │ Alan     │ Bitiş     │ Kalan  │
│───────┼──────────────────────────┼──────────┼───────────┼────────│
│ 🔴    │ Sağlık Raporu            │ 👤 Per.  │ 2026-01-15│ DOLMUŞ │
│       │ Ali Demir                │          │           │        │
│───────┼──────────────────────────┼──────────┼───────────┼────────│
│ 🟠    │ OG Ehliyet Belgesi       │ 👤 Per.  │ 2026-03-01│ 5 gün  │
│       │ Ahmet Yılmaz             │          │           │        │
│───────┼──────────────────────────┼──────────┼───────────┼────────│
│ 🟡    │ Araç Muayene             │ 🔧 Ekip. │ 2026-03-10│ 14 gün │
│       │ 34-ABC-123 Ford Ranger   │          │           │        │
│───────┼──────────────────────────┼──────────┼───────────┼────────│
│ 🟡    │ İşveren Soruml. Sigorta  │ 🏢 Firma │ 2026-03-18│ 22 gün │
│       │ Firma genel              │          │           │        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Modül İçi — Personel Detay > Belgeler Sekmesi

```
┌──────────────────────────────────────────────────────────────────┐
│ 👤 Ahmet Yılmaz                                                 │
│ [Genel] [📄 Belgeler] [📁 Projeler]                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Personel Belgeleri                      12 dosya  [+ Dosya Yükle]│
│ ┌────────────────────────────────────────────────────────────┐   │
│ │ 🔍 Dosya ara...   │ Tüm Tipler ▾ │ 🏷️ Etiket...         │   │
│ ├────────────────────────────────────────────────────────────┤   │
│ │ 📸│ Kimlik ön       │ 0.8 MB │ 15.01.2026              │   │
│ │ 📸│ Kimlik arka     │ 0.7 MB │ 15.01.2026              │   │
│ │ 📄│ Sağlık raporu   │ 1.2 MB │ 10.01.2026  ⚠️ 30 gün  │   │
│ │ 📄│ OG ehliyet belg.│ 0.5 MB │ 08.01.2026              │   │
│ │ 📄│ Yüksekte çalışma│ 0.4 MB │ 05.01.2026              │   │
│ │ 📄│ İlk yardım sert.│ 0.3 MB │ 03.01.2026              │   │
│ │ 📄│ SGK giriş bild. │ 0.2 MB │ 01.01.2026              │   │
│ │ ...                                                        │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Bileşen Hiyerarşisi Özeti

```
📂 DosyaYonetimiPage (merkezi sayfa)
├── AlanKartlari           → 8 alan kartı
├── DosyaListesi           → Seçili alanın dosyaları
├── SuresiDolanTablo       → Süresi dolan belgeler
├── DosyaIstatistik        → Alan/boyut istatistikleri
└── DosyaListesi           → Şablonlar

👤 PersonelDetay
└── [Belgeler sekmesi]
    └── DosyaListesi       → filtreler={{ alan:'personel', kaynak_id:X }}

📁 ProjeDetay
└── [Dosyalar sekmesi]
    └── DosyaListesi       → filtreler={{ alan:'proje', proje_id:X }}

🔧 EkipmanDetay
└── [Belgeler sekmesi]
    └── DosyaListesi       → filtreler={{ alan:'ekipman', kaynak_id:X }}

📋 IhaleDetay
└── [Dosyalar sekmesi]
    └── DosyaListesi       → filtreler={{ alan:'ihale', kaynak_id:X }}

📦 VeriPaketiDetay
└── DosyaListesi           → filtreler={{ veri_paketi_id:X }}
```

**Tek bileşen (`DosyaListesi`)**, farklı `filtreler` prop'uyla her yerde çalışır.

---

## Kontrol Listesi

**Ortak Bileşen:**
- [ ] `DosyaListesi.jsx` oluşturuldu
- [ ] Arama, kategori filtresi, etiket filtresi çalışıyor
- [ ] Dosya satırında: ikon, ad, etiket, alan badge, boyut, tarih, yükleyen, indir
- [ ] Thumbnail önizlemesi çalışıyor (fotoğraflar için)
- [ ] Dosyaya tıklayınca önizleme modalı açılıyor
- [ ] "Dosya Yükle" butonu yetkiye göre gösteriliyor

**Modül İçi Sekmeler:**
- [ ] Proje detay > "Dosyalar" sekmesi → `DosyaListesi` alan=proje çalışıyor
- [ ] Personel detay > "Belgeler" sekmesi → `DosyaListesi` alan=personel çalışıyor
- [ ] Ekipman detay > "Belgeler" sekmesi → `DosyaListesi` alan=ekipman çalışıyor
- [ ] İhale detay > "Dosyalar" sekmesi → `DosyaListesi` alan=ihale çalışıyor
- [ ] Veri paketi detay → `DosyaListesi` veri_paketi_id çalışıyor

**Merkezi Dosya Yönetimi Sayfası:**
- [ ] Sidebar'da "📂 Dosya Yönetimi" menüsü eklendi
- [ ] Route `/dosya-yonetimi` eklendi
- [ ] "Alanlar" sekmesi → 8 alan kartı gösteriliyor, tıklayınca dosya listesi
- [ ] "Süresi Dolan" sekmesi → Renk kodlu tablo çalışıyor (🔴🟠🟡)
- [ ] "Arama" sekmesi → Tüm dosyalarda global arama çalışıyor
- [ ] "İstatistik" sekmesi → Alan/alt alan bazlı sayı ve boyut
- [ ] "Şablonlar" sekmesi → Şablon dosyaların listesi
