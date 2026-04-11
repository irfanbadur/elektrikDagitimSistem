import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, useMapEvents, Polyline, CircleMarker, ImageOverlay, LayersControl, LayerGroup } from 'react-leaflet'
import L from 'leaflet'
import MainLayout from '@/components/layout/MainLayout'
import '@/utils/leafletFix'

// ─── EKIP MARKER İKONU ─────────────────────────────────
function createEkipIcon(ekipKodu, renk = '#2563eb') {
  return L.divIcon({
    className: 'ekip-marker',
    html: `
      <div style="
        display: inline-block;
        background: ${renk};
        color: white;
        padding: 6px 14px;
        border-radius: 16px;
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        border: 2px solid white;
        text-align: center;
        position: relative;
        left: -50%;
        top: -50%;
      ">
        ${ekipKodu}
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

// ─── EKIP RENKLERI ──────────────────────────────────────
const EKIP_RENKLERI = [
  '#2563eb', '#dc2626', '#16a34a', '#9333ea',
  '#ea580c', '#0891b2', '#4f46e5', '#be185d',
]

function getRenk(index) {
  return EKIP_RENKLERI[index % EKIP_RENKLERI.length]
}

// ─── PROJE DURUM ETİKETLERİ ─────────────────────────────
const PROJE_DURUM_LABEL = {
  teslim_alindi: 'Teslim Alindi',
  tasarimda: 'Tasarimda',
  onay_bekliyor: 'Onay Bekliyor',
  malzeme_bekliyor: 'Malzeme Bekliyor',
  programda: 'Programda',
  sahada: 'Sahada',
  montaj_tamam: 'Montaj Tamam',
  tamamlandi: 'Tamamlandi',
  askida: 'Askida',
}

const PROJE_DURUM_RENK = {
  teslim_alindi: '#9ca3af',
  tasarimda: '#a855f7',
  onay_bekliyor: '#f97316',
  malzeme_bekliyor: '#eab308',
  programda: '#3b82f6',
  sahada: '#22c55e',
  montaj_tamam: '#10b981',
  tamamlandi: '#10b981',
  askida: '#ef4444',
}

const GOREV_LABEL = {
  ekip_basi: 'Ekip Basi',
  usta: 'Usta',
  teknisyen: 'Teknisyen',
  cirak: 'Cirak',
  sofor: 'Sofor',
}

// ─── VERİ PAKETİ TİP AYARLARI ──────────────────────────
const PAKET_TIP_AYARLARI = {
  direk_tespit:    { ikon: '\uD83D\uDCCD', renk: '#2563eb', etiket: 'Direk Tespit' },
  direk_montaj:    { ikon: '\uD83D\uDCCD', renk: '#2563eb', etiket: 'Direk Montaj' },
  montaj_oncesi:   { ikon: '\uD83D\uDD27', renk: '#ea580c', etiket: 'Montaj Oncesi' },
  montaj_sonrasi:  { ikon: '\u2705',       renk: '#16a34a', etiket: 'Montaj Sonrasi' },
  kablo_cekimi:    { ikon: '\uD83D\uDD0C', renk: '#f59e0b', etiket: 'Kablo Cekimi' },
  hasar_tespit:    { ikon: '\u26A0\uFE0F', renk: '#dc2626', etiket: 'Hasar Tespit' },
  ariza_tespit:    { ikon: '\u26A0\uFE0F', renk: '#dc2626', etiket: 'Ariza Tespit' },
  malzeme_tespit:  { ikon: '\uD83D\uDCE6', renk: '#9333ea', etiket: 'Malzeme Tespit' },
  ilerleme_raporu: { ikon: '\uD83D\uDCCA', renk: '#0891b2', etiket: 'Ilerleme Raporu' },
  hat_kontrol:     { ikon: '\uD83D\uDCCA', renk: '#0891b2', etiket: 'Hat Kontrol' },
  tesis_kontrol:   { ikon: '\uD83C\uDFED', renk: '#7c3aed', etiket: 'Tesis Kontrol' },
  guzergah_tespit: { ikon: '\uD83D\uDEE4\uFE0F', renk: '#4f46e5', etiket: 'Guzergah Tespit' },
  diger:           { ikon: '\uD83D\uDCF8', renk: '#6b7280', etiket: 'Diger' },
}

function getPaketTipAyar(tip) {
  return PAKET_TIP_AYARLARI[tip] || PAKET_TIP_AYARLARI.diger
}

function createPaketIcon(tip) {
  const ayar = getPaketTipAyar(tip)
  return L.divIcon({
    className: 'paket-marker',
    html: `
      <div style="
        display: inline-flex;
        background: ${ayar.renk};
        width: 28px; height: 28px;
        border-radius: 50%;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        border: 2px solid white;
        position: relative;
        left: -50%;
        top: -50%;
      ">
        ${ayar.ikon}
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

// ─── EKİP KARTI (Popup İçeriği) ─────────────────────────
function EkipKarti({ ekip, detay, yukleniyor, renk }) {
  if (yukleniyor) {
    return (
      <div style={{ padding: '8px', minWidth: '220px' }}>
        <p>Yukleniyor...</p>
      </div>
    )
  }

  const ekipBasi = detay?.personeller?.find(p => p.gorev === 'ekip_basi')
  const ilkProje = detay?.aktifProjeler?.[0]

  return (
    <div style={{ minWidth: '300px', maxWidth: '380px', fontSize: '13px' }}>
      {/* ─── HEADER ─── */}
      <div style={{
        background: renk,
        color: 'white',
        padding: '12px 16px',
        margin: '-14px -20px 12px -20px',
        borderRadius: '12px 12px 0 0',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '17px', fontWeight: '700' }}>
            {ekip.ekip_adi}
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            padding: '2px 8px',
            borderRadius: '10px',
            fontSize: '11px',
            fontWeight: '600',
          }}>
            {ekip.ekip_kodu}
          </div>
        </div>

        <div style={{ marginTop: '6px', fontSize: '12px', opacity: 0.95, lineHeight: '1.6' }}>
          {ekipBasi && (
            <div>Ekip Basi: <strong>{ekipBasi.ad_soyad}</strong></div>
          )}
          {ilkProje && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span>Proje: <strong>{ilkProje.proje_no}</strong></span>
              <span style={{
                background: PROJE_DURUM_RENK[ilkProje.durum] || '#6b7280',
                padding: '1px 7px',
                borderRadius: '8px',
                fontSize: '10px',
                fontWeight: '600',
              }}>
                {PROJE_DURUM_LABEL[ilkProje.durum] || ilkProje.durum}
              </span>
            </div>
          )}
          {!ilkProje && !yukleniyor && (
            <div style={{ opacity: 0.7 }}>Atanmis proje yok</div>
          )}
        </div>

        <div style={{ marginTop: '4px', fontSize: '11px', opacity: 0.75 }}>
          {ekip.personel_sayisi} kisi
          {detay?.aktifProjeler && detay.aktifProjeler.length > 1 &&
            ` \u2022 ${detay.aktifProjeler.length} aktif proje`
          }
        </div>
      </div>

      {/* ─── BODY ─── */}

      {/* Aktif Projeler */}
      {detay?.aktifProjeler && detay.aktifProjeler.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px', color: '#374151' }}>Projeler</div>
          {detay.aktifProjeler.map(p => (
            <div key={p.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 0',
              borderBottom: '1px solid #f3f4f6',
            }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: PROJE_DURUM_RENK[p.durum] || '#6b7280',
              }} />
              <span style={{ fontWeight: 600, color: '#2563eb' }}>{p.proje_no}</span>
              <span style={{ flex: 1, color: '#374151' }}>{p.proje_adi}</span>
              <span style={{
                fontSize: '10px', fontWeight: 500,
                color: PROJE_DURUM_RENK[p.durum] || '#6b7280',
              }}>
                {PROJE_DURUM_LABEL[p.durum] || p.durum}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Personel Listesi */}
      {detay?.personeller && detay.personeller.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px', color: '#374151' }}>Personel</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {detay.personeller.map(p => (
              <span key={p.id} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: p.gorev === 'ekip_basi' ? `${renk}18` : '#f3f4f6',
                border: p.gorev === 'ekip_basi' ? `1px solid ${renk}40` : '1px solid #e5e7eb',
                padding: '3px 8px',
                borderRadius: '12px',
                fontSize: '11px',
              }}>
                <strong>{p.ad_soyad}</strong>
                <span style={{ color: '#9ca3af', fontSize: '10px' }}>
                  {GOREV_LABEL[p.gorev] || p.gorev}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Aktif Gorevler */}
      {detay?.aktifGorevler && detay.aktifGorevler.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px', color: '#374151' }}>Gorevler</div>
          <ul style={{ margin: '0', paddingLeft: '16px', color: '#4b5563' }}>
            {detay.aktifGorevler.map(g => (
              <li key={g.id} style={{ padding: '2px 0' }}>
                {g.proje_no && <span style={{ color: '#2563eb', fontWeight: 600 }}>{g.proje_no}: </span>}
                {g.gorev_basligi}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Bugunku Aktivite */}
      {detay?.bugunOzet && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          padding: '8px 10px',
          borderRadius: '6px',
          marginBottom: '10px',
          display: 'flex',
          gap: '16px',
        }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#166534' }}>
              {detay.bugunOzet.paket_sayisi}
            </div>
            <div style={{ fontSize: '10px', color: '#4ade80' }}>rapor</div>
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#166534' }}>
              {detay.bugunOzet.toplam_foto || 0}
            </div>
            <div style={{ fontSize: '10px', color: '#4ade80' }}>fotograf</div>
          </div>
        </div>
      )}

      {/* Arac Plaka */}
      {detay?.arac_plaka && (
        <div style={{ marginBottom: '6px', color: '#4b5563' }}>
          Arac: <strong>{detay.arac_plaka}</strong>
        </div>
      )}

      {/* Son Konum Zamani */}
      {ekip.son_konum_zamani && (
        <div style={{ color: '#9ca3af', fontSize: '11px', marginTop: '4px', paddingTop: '6px', borderTop: '1px solid #f3f4f6' }}>
          Son konum: {new Date(ekip.son_konum_zamani).toLocaleString('tr-TR')}
          {ekip.son_konum_kaynagi && ` (${ekip.son_konum_kaynagi})`}
        </div>
      )}
    </div>
  )
}

// ─── LIGHTBOX CONTEXT ────────────────────────────────────
const LightboxContext = createContext(null)

// ─── LIGHTBOX BİLEŞENİ ──────────────────────────────────
function Lightbox({ medyalar, aktifIndex, onKapat, onDegistir }) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onKapat()
      if (e.key === 'ArrowLeft') onDegistir(Math.max(0, aktifIndex - 1))
      if (e.key === 'ArrowRight') onDegistir(Math.min(medyalar.length - 1, aktifIndex + 1))
    }
    window.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [aktifIndex, medyalar.length, onKapat, onDegistir])

  const aktif = medyalar[aktifIndex]
  if (!aktif) return null

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onKapat}
    >
      {/* Ust bar */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 24px', color: 'white', zIndex: 2,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span style={{ fontSize: '14px', opacity: 0.8 }}>
          {aktifIndex + 1} / {medyalar.length}
          {aktif.aciklama && <span style={{ marginLeft: '12px' }}>{aktif.aciklama}</span>}
        </span>
        <button
          onClick={onKapat}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none',
            color: 'white', fontSize: '24px', cursor: 'pointer',
            width: '40px', height: '40px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          &times;
        </button>
      </div>

      {/* Sol ok */}
      {aktifIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onDegistir(aktifIndex - 1) }}
          style={{
            position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.15)', border: 'none',
            color: 'white', fontSize: '28px', cursor: 'pointer',
            width: '48px', height: '48px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2,
          }}
        >
          &#8249;
        </button>
      )}

      {/* Fotograf */}
      <img
        src={`/api/medya/${aktif.id}/dosya`}
        alt={aktif.aciklama || ''}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '90vw', maxHeight: '80vh',
          objectFit: 'contain', borderRadius: '4px',
          boxShadow: '0 4px 30px rgba(0,0,0,0.5)',
        }}
      />

      {/* Sag ok */}
      {aktifIndex < medyalar.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onDegistir(aktifIndex + 1) }}
          style={{
            position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.15)', border: 'none',
            color: 'white', fontSize: '28px', cursor: 'pointer',
            width: '48px', height: '48px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2,
          }}
        >
          &#8250;
        </button>
      )}

      {/* Alt thumbnail strip */}
      {medyalar.length > 1 && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', bottom: '16px',
            display: 'flex', gap: '6px',
            padding: '8px 12px',
            background: 'rgba(0,0,0,0.5)',
            borderRadius: '8px',
            overflowX: 'auto',
            maxWidth: '90vw',
          }}
        >
          {medyalar.map((m, i) => (
            <div
              key={m.id}
              onClick={() => onDegistir(i)}
              style={{
                width: '48px', height: '48px', flexShrink: 0,
                borderRadius: '4px', overflow: 'hidden',
                cursor: 'pointer',
                border: i === aktifIndex ? '2px solid white' : '2px solid transparent',
                opacity: i === aktifIndex ? 1 : 0.6,
                transition: 'opacity 0.2s, border-color 0.2s',
              }}
            >
              <img
                src={`/api/medya/${m.id}/thumbnail`}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ))}
        </div>
      )}
    </div>,
    document.body
  )
}

// ─── VERİ PAKETİ KARTI (Popup İçeriği) ──────────────────
function PaketKarti({ paket, detay, yukleniyor }) {
  const lightboxAc = useContext(LightboxContext)
  const tipAyar = getPaketTipAyar(paket.paket_tipi)

  if (yukleniyor) {
    return <div style={{ padding: '8px', minWidth: '200px' }}>Yukleniyor...</div>
  }

  return (
    <div style={{ minWidth: '260px', maxWidth: '340px', fontSize: '13px' }}>
      {/* Baslik */}
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
          {paket.proje_adi && ` \u2014 ${paket.proje_adi}`}
        </div>
      )}

      {/* Ekip & Personel */}
      <div style={{ marginBottom: '6px' }}>
        {paket.ekip_kodu && <span><strong>Ekip:</strong> {paket.ekip_kodu} </span>}
        {paket.personel_adi && <span>{'\u2022'} {paket.personel_adi}</span>}
      </div>

      {/* Fotograf sayisi */}
      <div style={{ marginBottom: '6px' }}>
        <strong>{paket.foto_sayisi || 0}</strong> fotograf
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
          &ldquo;{paket.notlar}&rdquo;
        </div>
      )}

      {/* Fotograf onizlemeleri */}
      {detay?.medyalar && detay.medyalar.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <strong>Fotograflar:</strong>
          <div style={{
            display: 'flex', gap: '4px', marginTop: '4px',
            overflowX: 'auto',
          }}>
            {detay.medyalar.slice(0, 4).map((m, i) => (
              <div
                key={m.id}
                onClick={(e) => {
                  e.stopPropagation()
                  if (m.dosya_tipi === 'photo' && lightboxAc) {
                    lightboxAc(detay.medyalar.filter(x => x.dosya_tipi === 'photo'), i)
                  }
                }}
                style={{
                  width: '56px', height: '56px',
                  background: '#e5e7eb',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  flexShrink: 0,
                  cursor: m.dosya_tipi === 'photo' ? 'pointer' : 'default',
                  transition: 'transform 0.15s',
                }}
                onMouseEnter={(e) => { if (m.dosya_tipi === 'photo') e.currentTarget.style.transform = 'scale(1.1)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                {m.dosya_tipi === 'photo' ? (
                  <img
                    src={`/api/medya/${m.id}/thumbnail`}
                    alt={m.aciklama || ''}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{
                    width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', color: '#6b7280',
                  }}>
                    {'\uD83D\uDCC4'}
                  </div>
                )}
              </div>
            ))}
            {detay.medyalar.length > 4 && (
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  if (lightboxAc) {
                    lightboxAc(detay.medyalar.filter(x => x.dosya_tipi === 'photo'), 4)
                  }
                }}
                style={{
                  width: '56px', height: '56px',
                  background: '#e5e7eb', borderRadius: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', color: '#6b7280', flexShrink: 0,
                  cursor: 'pointer',
                }}
              >
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
        {paket.durum === 'tamamlandi' ? 'Tamamlandi' :
         paket.durum === 'aktif' ? 'Aktif' : paket.durum || 'Belirsiz'}
      </div>
    </div>
  )
}

// ─── EKIP MARKER BİLEŞENİ ───────────────────────────────
function EkipMarker({ ekip, renk }) {
  const [detay, setDetay] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(false)

  const handleClick = useCallback(async () => {
    if (detay) return
    setYukleniyor(true)
    try {
      const res = await fetch(`/api/saha/ekipler/${ekip.id}`)
      const json = await res.json()
      if (json.success) {
        setDetay(json.data)
      }
    } catch (err) {
      console.error('Ekip detay hatasi:', err)
    } finally {
      setYukleniyor(false)
    }
  }, [ekip.id, detay])

  if (!ekip.son_latitude || !ekip.son_longitude) return null

  return (
    <Marker
      position={[ekip.son_latitude, ekip.son_longitude]}
      icon={createEkipIcon(ekip.ekip_kodu, renk)}
      eventHandlers={{ click: handleClick }}
    >
      <Tooltip direction="top" offset={[0, -10]} permanent={false}>
        <strong>{ekip.ekip_adi}</strong>
        <br />
        {ekip.personel_sayisi} kisi
        {ekip.aktif_proje_sayisi > 0 && ` \u2022 ${ekip.aktif_proje_sayisi} proje`}
      </Tooltip>

      <Popup maxWidth={400} minWidth={300} closeButton={true}>
        <EkipKarti ekip={ekip} detay={detay} yukleniyor={yukleniyor} renk={renk} />
      </Popup>
    </Marker>
  )
}

// ─── VERİ PAKETİ MARKER BİLEŞENİ ────────────────────────
function PaketMarker({ paket, offset = 0 }) {
  const [detay, setDetay] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(false)

  const handleClick = useCallback(async () => {
    if (detay) return
    setYukleniyor(true)
    try {
      const res = await fetch(`/api/saha/veri-paketleri/${paket.id}`)
      const json = await res.json()
      if (json.success) setDetay(json.data)
    } catch (err) {
      console.error('Paket detay hatasi:', err)
    } finally {
      setYukleniyor(false)
    }
  }, [paket.id, detay])

  if (!paket.latitude || !paket.longitude) return null

  const tipAyar = getPaketTipAyar(paket.paket_tipi)

  // Ayni konumdaki paketleri hafif kaydir
  const angle = (offset * 137.5) * (Math.PI / 180)
  const radius = offset * 0.00015
  const lat = paket.latitude + Math.cos(angle) * radius
  const lng = paket.longitude + Math.sin(angle) * radius

  return (
    <Marker
      position={[lat, lng]}
      icon={createPaketIcon(paket.paket_tipi)}
      eventHandlers={{ click: handleClick }}
    >
      <Tooltip direction="top" offset={[0, -10]}>
        <strong>{paket.paket_no || `VP-${paket.id}`}</strong>
        <br />
        {tipAyar.etiket} {'\u2022'} {paket.foto_sayisi || 0} foto
        {paket.ekip_kodu && <><br />{paket.ekip_kodu}</>}
      </Tooltip>

      <Popup maxWidth={360} minWidth={260}>
        <PaketKarti paket={paket} detay={detay} yukleniyor={yukleniyor} />
      </Popup>
    </Marker>
  )
}

// ─── HARİTA SINIRLARINI AYARLA ──────────────────────────
function FitBounds({ ekipler, paketler, projeCizimleri }) {
  const map = useMap()
  const ilkYukleme = useRef(true)

  useEffect(() => {
    if (!ilkYukleme.current) return // Sadece ilk yüklemede çalış
    const noktalar = []

    ekipler
      .filter(e => e.son_latitude && e.son_longitude)
      .forEach(e => noktalar.push([e.son_latitude, e.son_longitude]))

    ;(paketler || [])
      .filter(p => p.latitude && p.longitude)
      .forEach(p => noktalar.push([p.latitude, p.longitude]))

    ;(projeCizimleri || []).forEach(c => {
      (c.noktalar || []).forEach(n => { if (n.lat && n.lng) noktalar.push([n.lat, n.lng]) })
      ;(c.cizgiler || []).forEach(cz => { (cz.noktalar || []).forEach(p => noktalar.push(p)) })
    })

    if (noktalar.length === 0) return
    ilkYukleme.current = false

    if (noktalar.length === 1) {
      map.setView(noktalar[0], 13)
    } else {
      const bounds = L.latLngBounds(noktalar)
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [ekipler, paketler, projeCizimleri, map])

  return null
}

// ─── PROJE DXF ÇİZİM KATMANI ────────────────────────────
// ─── DXF OFFSCREEN RENDER → HARITA IMAGE OVERLAY ────────
const DXF_FONTS = ['/fonts/NotoSans.ttf', '/fonts/B_CAD.ttf', '/fonts/T_ROMANS.ttf']

// ─── Tüm DXF'leri tek 2D canvas'a compositing ile birleştir ───
function TumProjelerDxfOverlay({ projeCizimleri }) {
  const map = useMap()
  const overlayRef = useRef(null)
  const imagesRef = useRef([]) // [{img, bounds}]
  const [hazir, setHazir] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(false)

  useEffect(() => {
    const cizimleriYukle = projeCizimleri.filter(c => c.dosyaId && c.bounds)
    if (!cizimleriYukle.length) return
    let cancelled = false

    const yukle = async () => {
      setYukleniyor(true)
      try {
        const [{ DxfViewer }, three] = await Promise.all([import('dxf-viewer'), import('three')])

        const SIZE = 4096
        const container = document.createElement('div')
        container.style.cssText = `width:${SIZE}px;height:${SIZE}px;position:absolute;left:-9999px;top:-9999px`
        document.body.appendChild(container)

        const renderer = new three.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
        renderer.setSize(SIZE, SIZE)
        renderer.setClearColor(0x000000, 0)
        container.appendChild(renderer.domElement)

        const images = []

        // Her DXF'i sırayla render et ve PNG olarak sakla
        for (const cizim of cizimleriYukle) {
          if (cancelled) break
          try {
            const viewer = new DxfViewer(container, {
              clearColor: new three.Color(0x000000), clearAlpha: 0,
              autoResize: false, colorCorrection: true, renderer,
            })

            const response = await fetch(`/api/dosya/${cizim.dosyaId}/dosya`)
            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            await viewer.Load({ url, fonts: DXF_FONTS })
            URL.revokeObjectURL(url)

            if (viewer.bounds && viewer.origin) {
              const b = viewer.bounds, o = viewer.origin
              const dxfW = b.maxX - b.minX, dxfH = b.maxY - b.minY
              let rw, rh
              if (dxfW > dxfH) { rw = SIZE; rh = Math.max(Math.round(SIZE * dxfH / dxfW), 512) }
              else { rh = SIZE; rw = Math.max(Math.round(SIZE * dxfW / dxfH), 512) }
              renderer.setSize(rw, rh)
              container.style.width = rw + 'px'
              container.style.height = rh + 'px'
              viewer.FitView(b.minX - o.x, b.maxX - o.x, b.minY - o.y, b.maxY - o.y)
              renderer.setClearColor(0x000000, 0)
              viewer.Render()

              const img = new Image()
              img.src = renderer.domElement.toDataURL('image/png')
              await new Promise(r => { img.onload = r; img.onerror = r })
              images.push({ img, bounds: cizim.bounds })
            }
            viewer.Clear()
          } catch (err) { console.error('[Saha DXF]', cizim.projeNo, err) }
        }

        renderer.dispose()
        document.body.removeChild(container)

        if (!cancelled && images.length) {
          imagesRef.current = images
          setHazir(true)
        }
      } catch (err) { console.error('[Saha DXF overlay]', err) }
      finally { if (!cancelled) setYukleniyor(false) }
    }

    yukle()
    return () => { cancelled = true; imagesRef.current = [] }
  }, [projeCizimleri.map(c => c.dosyaId).join(',')])

  // Tek 2D canvas overlay — tüm projeleri compositing ile çiz
  useEffect(() => {
    if (!hazir || !imagesRef.current.length) return

    const canvas = document.createElement('canvas')
    canvas.style.position = 'absolute'
    canvas.style.pointerEvents = 'none'

    const DxfOverlay = L.Layer.extend({
      onAdd(m) {
        this._map = m
        m.getPanes().overlayPane.appendChild(canvas)
        m.on('moveend', this._render, this)
        this._render()
      },
      onRemove(m) {
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
        m.off('moveend', this._render, this)
      },
      _render() {
        if (!this._map) return
        const mapSize = this._map.getSize()
        const dpr = window.devicePixelRatio || 1
        canvas.width = mapSize.x * dpr
        canvas.height = mapSize.y * dpr
        canvas.style.width = mapSize.x + 'px'
        canvas.style.height = mapSize.y + 'px'

        // Canvas'ı harita origin'e hizala
        const mapOrigin = this._map.getPixelOrigin()
        const panePos = this._map.getPane('overlayPane').style.transform
        // leaflet pane translate'ini yakala
        const match = panePos?.match(/translate3d\((-?\d+)px,\s*(-?\d+)px/)
        const tx = match ? parseInt(match[1]) : 0
        const ty = match ? parseInt(match[2]) : 0
        canvas.style.left = -tx + 'px'
        canvas.style.top = -ty + 'px'

        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Her projeyi çiz
        for (const { img, bounds } of imagesRef.current) {
          const nw = this._map.latLngToLayerPoint(L.latLng(bounds.northEast[0], bounds.southWest[1]))
          const se = this._map.latLngToLayerPoint(L.latLng(bounds.southWest[0], bounds.northEast[1]))
          const dx = (nw.x + tx) * dpr
          const dy = (nw.y + ty) * dpr
          const dw = (se.x - nw.x) * dpr
          const dh = (se.y - nw.y) * dpr
          ctx.drawImage(img, dx, dy, dw, dh)
        }
      }
    })

    const overlay = new DxfOverlay()
    overlay.addTo(map)
    overlayRef.current = overlay

    return () => {
      if (overlayRef.current) { map.removeLayer(overlayRef.current); overlayRef.current = null }
    }
  }, [hazir, map])

  if (yukleniyor && !hazir) {
    return <CircleMarker center={[41.5, 36.1]} radius={8} pathOptions={{ color: '#6366f1', fillOpacity: 0.3 }}>
      <Tooltip permanent>DXF çizimleri yükleniyor...</Tooltip>
    </CircleMarker>
  }
  return null
}

// ─── Proje Marker (sadece etiket + kart) ────────────────
function ProjeMarkerKarti({ cizim }) {
  if (!cizim.bounds) return null
  const merkez = [(cizim.bounds.southWest[0] + cizim.bounds.northEast[0]) / 2, (cizim.bounds.southWest[1] + cizim.bounds.northEast[1]) / 2]
  const referans = (cizim.noktalar?.[0]) ? [cizim.noktalar[0].lat, cizim.noktalar[0].lng] : merkez
  const storageKey = `saha_marker_${cizim.projeId}`
  const [markerPos, setMarkerPos] = useState(() => {
    try { const s = localStorage.getItem(storageKey); if (s) return JSON.parse(s) } catch {}
    return merkez
  })
  const markerRef = useRef(null)

  const sinirla = (marker) => {
    if (!marker) return
    const pos = marker.getLatLng()
    const refLatLng = L.latLng(referans[0], referans[1])
    const mesafe = refLatLng.distanceTo(pos)
    if (mesafe > 150) {
      const dLat = pos.lat - referans[0], dLng = pos.lng - referans[1]
      const ratio = 150 / mesafe
      marker.setLatLng(L.latLng(referans[0] + dLat * ratio, referans[1] + dLng * ratio))
    }
  }

  const handleDrag = useCallback((e) => { sinirla(e.target) }, [referans])
  const handleDragEnd = useCallback((e) => {
    sinirla(e.target)
    const pos = e.target.getLatLng()
    const yeni = [pos.lat, pos.lng]
    setMarkerPos(yeni)
    try { localStorage.setItem(storageKey, JSON.stringify(yeni)) } catch {}
  }, [referans, storageKey])

  return (
    <Marker ref={markerRef} position={markerPos} icon={projeMarkerIcon(cizim.projeNo)} draggable={true}
      eventHandlers={{ drag: handleDrag, dragend: handleDragEnd }}>
      <Popup maxWidth={280} minWidth={240}>
        <ProjeKarti cizim={cizim} />
      </Popup>
      <Tooltip direction="top" offset={[0, -10]}>{cizim.projeNo}</Tooltip>
    </Marker>
  )
}

// ─── PROJE MARKER İKONU ──────────────────────────────────
function projeMarkerIcon(projeNo) {
  return L.divIcon({
    className: 'proje-cizim-marker',
    html: `<div style="
      display:inline-flex;align-items:center;gap:4px;
      background:#4f46e5;color:white;padding:2px 8px;border-radius:4px;
      font-size:11px;font-weight:600;white-space:nowrap;
      box-shadow:0 2px 4px rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.3);
    ">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 21h18M9 8h6M9 12h6M9 16h6M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16"/></svg>
      ${projeNo}
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

// ─── PROJE KARTI (Accordion) ─────────────────────────────
const DURUM_RENK = {
  baslama: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Başlama' },
  devam_ediyor: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Devam Ediyor' },
  tamamlandi: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Tamamlandı' },
}

function ProjeKarti({ cizim }) {
  const [acik, setAcik] = useState(false)
  const durum = DURUM_RENK[cizim.durum] || DURUM_RENK.baslama

  return (
    <div style={{ margin: -8 }}>
      {/* Header — her zaman görünür */}
      <div
        onClick={() => setAcik(p => !p)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#4f46e5', color: 'white', borderRadius: acik ? '6px 6px 0 0' : '6px', gap: 6 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{cizim.projeNo}</span>
          <span style={{ fontSize: 11, opacity: 0.85 }}>{cizim.musteri_adi || cizim.mahalle || ''}</span>
        </div>
        <span style={{ fontSize: 16, transition: 'transform 0.2s', transform: acik ? 'rotate(180deg)' : 'rotate(0)' }}>▾</span>
      </div>

      {/* Body — accordion */}
      {acik && (
        <div style={{ padding: '8px 10px', fontSize: 12, lineHeight: 1.6, background: '#f8fafc', borderRadius: '0 0 6px 6px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
            <div><span style={{ color: '#6b7280' }}>Tip:</span> <b>{cizim.projeTipi}</b></div>
            <div><span style={{ color: '#6b7280' }}>Durum:</span> <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: durum.bg === 'bg-blue-50' ? '#dbeafe' : durum.bg === 'bg-amber-50' ? '#fef3c7' : '#d1fae5', color: durum.text === 'text-blue-700' ? '#1d4ed8' : durum.text === 'text-amber-700' ? '#b45309' : '#047857' }}>{durum.label}</span></div>
            {cizim.mahalle && <div><span style={{ color: '#6b7280' }}>Mahalle:</span> {cizim.mahalle}</div>}
            {cizim.ilce && <div><span style={{ color: '#6b7280' }}>İlçe:</span> {cizim.ilce}</div>}
            {cizim.bolge_adi && <div><span style={{ color: '#6b7280' }}>Bölge:</span> {cizim.bolge_adi}</div>}
            {cizim.ekip_adi && <div><span style={{ color: '#6b7280' }}>Ekip:</span> {cizim.ekip_adi}</div>}
            {cizim.aktif_faz && <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#6b7280' }}>Aşama:</span> {cizim.aktif_faz} → {cizim.aktif_adim}</div>}
            {cizim.baslama_tarihi && <div><span style={{ color: '#6b7280' }}>Başlangıç:</span> {cizim.baslama_tarihi}</div>}
            {cizim.bitis_tarihi && <div><span style={{ color: '#6b7280' }}>Bitiş:</span> {cizim.bitis_tarihi}</div>}
          </div>
          {cizim.notlar && <div style={{ marginTop: 6, padding: '4px 6px', background: '#f1f5f9', borderRadius: 4, fontSize: 11, color: '#475569' }}>{cizim.notlar}</div>}
          <a href={`/projeler/${cizim.projeId}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8, padding: '6px 0', background: '#4f46e5', color: 'white', borderRadius: 4, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
          >
            Projeye Git →
          </a>
        </div>
      )}
    </div>
  )
}

// ─── HARİTA TIKLAMA — KONUM ATAMA ───────────────────────
function MapClickHandler({ seciliEkipId, onKonumAta }) {
  useMapEvents({
    click(e) {
      if (seciliEkipId) {
        onKonumAta(seciliEkipId, e.latlng.lat, e.latlng.lng)
      }
    },
  })
  return null
}

// ═══════════════════════════════════════════════════════════
// ANA SAHA SAYFASI
// ═══════════════════════════════════════════════════════════
export default function SahaPage() {
  const [ekipler, setEkipler] = useState([])
  const [paketler, setPaketler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState(null)
  const [seciliEkipId, setSeciliEkipId] = useState(null)

  // Lightbox state
  const [lightboxData, setLightboxData] = useState(null)
  const lightboxAc = useCallback((medyalar, index) => {
    setLightboxData({ medyalar, index })
  }, [])
  const lightboxKapat = useCallback(() => setLightboxData(null), [])
  const lightboxDegistir = useCallback((index) => {
    setLightboxData(prev => prev ? { ...prev, index } : null)
  }, [])

  const [katmanlar, setKatmanlar] = useState({
    ekipler: true,
    veriPaketleri: true,
    projeCizimleri: true,
  })
  const [projeCizimleri, setProjeCizimleri] = useState([]) // { projeId, projeNo, dosyaId, cizgiler, noktalar }

  const varsayilanMerkez = [41.2867, 36.3300]
  const varsayilanZoom = 10

  const verileriYukle = useCallback(async () => {
    try {
      const [ekipRes, paketRes] = await Promise.all([
        fetch('/api/saha/ekipler'),
        fetch('/api/saha/veri-paketleri'),
      ])

      const ekipJson = await ekipRes.json()
      const paketJson = await paketRes.json()

      if (ekipJson.success) setEkipler(ekipJson.data)
      if (paketJson.success) setPaketler(paketJson.data)

      if (ekipJson.success || paketJson.success) {
        setHata(null)
      } else {
        setHata('Veri yuklenemedi')
      }

      // Proje DXF çizimlerini yükle
      try {
        const cizimRes = await fetch('/api/saha/proje-cizimleri')
        const cizimJson = await cizimRes.json()
        if (cizimJson.success && cizimJson.data?.length > 0) {
          // Her DXF dosyası için harita verilerini çek (paralel)
          const cizimler = await Promise.all(
            cizimJson.data.map(async (p) => {
              try {
                const r = await fetch(`/api/dosya/${p.dosya_id}/dxf-harita`)
                const j = await r.json()
                if (j.success && j.data) {
                  return {
                    projeId: p.id, projeNo: p.proje_no, projeTipi: p.proje_tipi,
                    musteri_adi: p.musteri_adi, mahalle: p.mahalle, durum: p.durum,
                    il: p.il, ilce: p.ilce, bolge_adi: p.bolge_adi, ekip_adi: p.ekip_adi,
                    aktif_faz: p.aktif_faz, aktif_adim: p.aktif_adim,
                    baslama_tarihi: p.baslama_tarihi, bitis_tarihi: p.bitis_tarihi,
                    notlar: p.notlar, dosyaId: p.dosya_id, ...j.data
                  }
                }
              } catch {}
              return null
            })
          )
          setProjeCizimleri(cizimler.filter(Boolean).filter(c => c.cizgiler?.length > 0 || c.noktalar?.length > 0))
        }
      } catch {}
    } catch (err) {
      setHata('Sunucuya baglanilamadi')
      console.error('Saha veri hatasi:', err)
    } finally {
      setYukleniyor(false)
    }
  }, [])

  const konumAta = useCallback(async (ekipId, lat, lng) => {
    try {
      const res = await fetch(`/api/saha/ekipler/${ekipId}/konum`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, kaynak: 'manuel' }),
      })
      const json = await res.json()
      if (json.success) {
        setSeciliEkipId(null)
        verileriYukle()
      }
    } catch (err) {
      console.error('Konum atama hatasi:', err)
    }
  }, [verileriYukle])

  useEffect(() => {
    verileriYukle()
  }, [verileriYukle])

  const konumluEkipSayisi = ekipler.filter(e => e.son_latitude && e.son_longitude).length
  const konumluPaketSayisi = paketler.filter(p => p.latitude && p.longitude).length
  const seciliEkip = seciliEkipId ? ekipler.find(e => e.id === seciliEkipId) : null

  const katmanToggle = (key) => {
    setKatmanlar(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <LightboxContext.Provider value={lightboxAc}>
    <MainLayout title="Saha Gorunumu">
      <div className="-m-6 flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
        {/* Ust bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-white px-5 py-3">
          <div className="mr-auto">
            <h1 className="text-lg font-bold text-foreground">
              Saha Gorunumu
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {konumluEkipSayisi} ekip haritada
              {konumluPaketSayisi > 0 && ` \u2022 ${konumluPaketSayisi} veri paketi`}
            </p>
          </div>

          {/* Katman kontrolleri */}
          <label className="flex cursor-pointer items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={katmanlar.ekipler}
              onChange={() => katmanToggle('ekipler')}
              className="accent-primary"
            />
            Ekipler
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={katmanlar.veriPaketleri}
              onChange={() => katmanToggle('veriPaketleri')}
              className="accent-primary"
            />
            Veri Paketleri
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={katmanlar.projeCizimleri}
              onChange={() => katmanToggle('projeCizimleri')}
              className="accent-primary"
            />
            Proje Çizimleri {projeCizimleri.length > 0 && <span className="text-muted-foreground">({projeCizimleri.length})</span>}
          </label>

          <button
            onClick={verileriYukle}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            Yenile
          </button>
        </div>

        {/* Hata durumu */}
        {hata && (
          <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800">
            {hata}
          </div>
        )}

        {/* Konum atama modu bildirimi */}
        {seciliEkip && (
          <div className="flex items-center justify-between border-b border-blue-200 bg-blue-50 px-5 py-2.5 text-sm text-blue-800">
            <span>
              <strong>{seciliEkip.ekip_kodu}</strong> icin haritaya tiklayarak konum belirleyin
            </span>
            <button
              onClick={() => setSeciliEkipId(null)}
              className="rounded bg-blue-200 px-3 py-1 text-xs font-medium text-blue-800 hover:bg-blue-300 transition-colors"
            >
              Iptal
            </button>
          </div>
        )}

        {/* Harita */}
        <div className={`relative flex-1 ${seciliEkipId ? 'cursor-crosshair' : ''}`}>
          {yukleniyor ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Harita yukleniyor...
            </div>
          ) : (
            <MapContainer
              center={varsayilanMerkez}
              zoom={varsayilanZoom}
              maxZoom={22}
              style={{ height: '100%', width: '100%' }}
              zoomControl={true}
            >
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="Harita">
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    maxZoom={22}
                    maxNativeZoom={19}
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Uydu">
                  <TileLayer
                    url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                    maxZoom={22}
                    maxNativeZoom={21}
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Uydu + Etiket">
                  <TileLayer
                    url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                    maxZoom={22}
                    maxNativeZoom={21}
                  />
                </LayersControl.BaseLayer>
              </LayersControl>

              {/* Ekip markerlari */}
              {katmanlar.ekipler && ekipler.map((ekip, index) => (
                <EkipMarker
                  key={`ekip-${ekip.id}`}
                  ekip={ekip}
                  renk={getRenk(index)}
                />
              ))}

              {/* Veri Paketi markerlari */}
              {katmanlar.veriPaketleri && (() => {
                // Ayni konumdaki paketleri grupla ve offset hesapla
                const konumSayaci = {}
                return paketler.map(paket => {
                  const key = `${paket.latitude?.toFixed(5)},${paket.longitude?.toFixed(5)}`
                  konumSayaci[key] = (konumSayaci[key] || 0)
                  const offset = konumSayaci[key]
                  konumSayaci[key]++
                  return (
                    <PaketMarker
                      key={`paket-${paket.id}`}
                      paket={paket}
                      offset={offset}
                    />
                  )
                })
              })()}

              {/* Proje DXF çizimleri — tek vektörel canvas */}
              {katmanlar.projeCizimleri && projeCizimleri.length > 0 && (
                <TumProjelerDxfOverlay projeCizimleri={projeCizimleri} />
              )}
              {katmanlar.projeCizimleri && projeCizimleri.map((cizim) => (
                <ProjeMarkerKarti key={`mk-${cizim.dosyaId}`} cizim={cizim} />
              ))}

              <FitBounds ekipler={ekipler} paketler={paketler} projeCizimleri={katmanlar.projeCizimleri ? projeCizimleri : []} />
              <MapClickHandler seciliEkipId={seciliEkipId} onKonumAta={konumAta} />
            </MapContainer>
          )}

          {/* Sag alt: Ozet paneli */}
          {!yukleniyor && (ekipler.length > 0 || paketler.length > 0) && (
            <div className="absolute bottom-5 right-5 z-[1000] min-w-[220px] max-h-[300px] overflow-y-auto rounded-lg bg-white p-3 shadow-lg">
              {/* Ekipler */}
              {ekipler.length > 0 && (
                <>
                  <div className="mb-1.5 text-xs font-semibold text-foreground">
                    Ekipler ({konumluEkipSayisi})
                  </div>
                  {ekipler.map((ekip, index) => (
                    <div
                      key={ekip.id}
                      className="flex items-center gap-2 py-1.5 text-xs"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: getRenk(index) }}
                      />
                      <span className="font-medium">{ekip.ekip_kodu}</span>
                      <span className="flex-1 text-muted-foreground">
                        {ekip.son_latitude ? `${ekip.personel_sayisi} kisi` : 'konum yok'}
                      </span>
                      <button
                        onClick={() => setSeciliEkipId(seciliEkipId === ekip.id ? null : ekip.id)}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                          seciliEkipId === ekip.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700'
                        }`}
                      >
                        {seciliEkipId === ekip.id ? 'Secili' : 'Konum Ata'}
                      </button>
                    </div>
                  ))}
                </>
              )}

              {/* Veri Paketleri Ozeti */}
              {konumluPaketSayisi > 0 && (
                <>
                  <div className={`text-xs font-semibold text-foreground mb-1.5 ${ekipler.length > 0 ? 'mt-2.5 pt-2.5 border-t border-border' : ''}`}>
                    Veri Paketleri ({konumluPaketSayisi})
                  </div>
                  {Object.entries(
                    paketler.reduce((acc, p) => {
                      const tip = p.paket_tipi || 'diger'
                      acc[tip] = (acc[tip] || 0) + 1
                      return acc
                    }, {})
                  ).map(([tip, sayi]) => {
                    const ayar = getPaketTipAyar(tip)
                    return (
                      <div
                        key={tip}
                        className="flex items-center gap-2 py-1 text-xs"
                      >
                        <span>{ayar.ikon}</span>
                        <span>{ayar.etiket}</span>
                        <span className="text-muted-foreground">({sayi})</span>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {lightboxData && (
        <Lightbox
          medyalar={lightboxData.medyalar}
          aktifIndex={lightboxData.index}
          onKapat={lightboxKapat}
          onDegistir={lightboxDegistir}
        />
      )}
    </MainLayout>
    </LightboxContext.Provider>
  )
}
