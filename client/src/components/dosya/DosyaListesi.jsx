import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import api from '@/api/client'
import DosyaOnizleme from './DosyaOnizleme'
import DosyaYukleModal from './DosyaYukleModal'

// Alan tanımları
const ALAN_BILGI = {
  proje:    { etiket: 'Projeler',      ikon: '📁', renk: '#2563eb' },
  personel: { etiket: 'Personel',      ikon: '👤', renk: '#8b5cf6' },
  ekipman:  { etiket: 'Ekipman',       ikon: '🔧', renk: '#f59e0b' },
  ihale:    { etiket: 'Ihale',         ikon: '📋', renk: '#10b981' },
  isg:      { etiket: 'ISG',           ikon: '🛡️', renk: '#f43f5e' },
  firma:    { etiket: 'Firma',         ikon: '🏢', renk: '#6366f1' },
  muhasebe: { etiket: 'Muhasebe',      ikon: '💰', renk: '#84cc16' },
  kurum:    { etiket: 'Kurum Yazisma', ikon: '📨', renk: '#0ea5e9' },
}

const KATEGORI_IKON = {
  fotograf: '📸', cizim: '📐', belge: '📄', tablo: '📊',
  harita: '🗺️', arsiv: '📦', diger: '📎',
}

function boyutFormatla(byte) {
  if (!byte) return '—'
  if (byte < 1024) return byte + ' B'
  if (byte < 1024 * 1024) return (byte / 1024).toFixed(1) + ' KB'
  return (byte / (1024 * 1024)).toFixed(1) + ' MB'
}

function tarihFormatla(tarih) {
  if (!tarih) return '—'
  const d = new Date(tarih)
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Ortak dosya listesi bileseni
 *
 * Kullanim:
 *   <DosyaListesi filtreler={{ alan: 'proje', proje_id: 5 }} yuklemeBilgi={{ alan: 'proje', projeNo: 'YB-2025-001', projeId: 5 }} />
 *   <DosyaListesi filtreler={{ alan: 'personel', kaynak_tipi: 'personel', kaynak_id: 1 }} yuklemeBilgi={{ alan: 'personel', personelKodu: 'PER-001' }} />
 *   <DosyaListesi /> (filtresiz, merkezi sayfa)
 */
export default function DosyaListesi({
  filtreler = {},
  yuklemeBilgi = {},
  baslik = null,
  kompakt = false,
  gizleAlanFiltre = false,
  gizleYukleButon = false,
}) {
  const { izinVar } = useAuth()

  const [dosyalar, setDosyalar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [secilenDosya, setSecilenDosya] = useState(null)
  const [yukleModalAcik, setYukleModalAcik] = useState(false)
  const [toplam, setToplam] = useState(0)
  const [sayfa, setSayfa] = useState(0)

  const [ekFiltre, setEkFiltre] = useState({
    kategori: '',
    etiket: '',
    arama: '',
  })

  const verileriYukle = useCallback(async () => {
    setYukleniyor(true)
    try {
      const params = new URLSearchParams()

      if (filtreler.alan) params.set('alan', filtreler.alan)
      if (filtreler.alt_alan) params.set('alt_alan', filtreler.alt_alan)
      if (filtreler.proje_id) params.set('proje_id', filtreler.proje_id)
      if (filtreler.kaynak_tipi) params.set('kaynak_tipi', filtreler.kaynak_tipi)
      if (filtreler.kaynak_id) params.set('kaynak_id', filtreler.kaynak_id)
      if (filtreler.veri_paketi_id) params.set('veri_paketi_id', filtreler.veri_paketi_id)

      if (ekFiltre.kategori) params.set('kategori', ekFiltre.kategori)
      if (ekFiltre.etiket) params.set('etiket', ekFiltre.etiket)

      params.set('limit', '50')
      params.set('offset', String(sayfa * 50))

      let url
      if (filtreler.alan) {
        url = `/dosya/alan/${filtreler.alan}?${params}`
      } else {
        url = `/dosya?${params}`
      }

      const json = await api.get(url)
      if (json.success) {
        setDosyalar(json.data)
        setToplam(json.data.length)
      }
    } catch (err) {
      console.error('Dosya yukleme hatasi:', err)
    } finally {
      setYukleniyor(false)
    }
  }, [filtreler, ekFiltre, sayfa])

  useEffect(() => { verileriYukle() }, [verileriYukle])

  // Client-side arama
  const filtrelenmis = dosyalar.filter(d => {
    if (!ekFiltre.arama) return true
    const ara = ekFiltre.arama.toLowerCase()
    return (
      (d.dosya_adi || '').toLowerCase().includes(ara) ||
      (d.baslik || '').toLowerCase().includes(ara) ||
      (d.notlar || '').toLowerCase().includes(ara) ||
      (d.orijinal_adi || '').toLowerCase().includes(ara)
    )
  })

  return (
    <div>
      {/* Baslik + Yukle butonu */}
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
                + Dosya Yukle
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filtre cubugu */}
      <div style={{
        display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap',
      }}>
        <input
          value={ekFiltre.arama}
          onChange={(e) => setEkFiltre({ ...ekFiltre, arama: e.target.value })}
          placeholder="Dosya ara..."
          style={{
            padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: '8px',
            fontSize: '13px', flex: kompakt ? '1' : '0 0 220px',
          }}
        />

        <select
          value={ekFiltre.kategori}
          onChange={(e) => setEkFiltre({ ...ekFiltre, kategori: e.target.value })}
          style={{
            padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: '8px',
            fontSize: '13px', color: '#374151', background: 'white',
          }}
        >
          <option value="">Tum Tipler</option>
          <option value="fotograf">Fotograf</option>
          <option value="cizim">Cizim</option>
          <option value="belge">Belge</option>
          <option value="tablo">Tablo</option>
          <option value="harita">Harita</option>
          <option value="arsiv">Arsiv</option>
        </select>

        <input
          value={ekFiltre.etiket}
          onChange={(e) => setEkFiltre({ ...ekFiltre, etiket: e.target.value })}
          placeholder="Etiket..."
          style={{
            padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: '8px',
            fontSize: '13px', width: '120px',
          }}
        />
      </div>

      {/* Dosya listesi */}
      {yukleniyor ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
          Yukleniyor...
        </div>
      ) : filtrelenmis.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
          <div>Dosya bulunamadi</div>
        </div>
      ) : (
        <div style={{
          border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden',
        }}>
          {/* Tablo basligi */}
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
            {!kompakt && <span>Yukleyen</span>}
            {!kompakt && <span></span>}
          </div>

          {/* Dosya satirlari */}
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

      {/* Sayfalama */}
      {toplam >= 50 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
          <button
            disabled={sayfa === 0}
            onClick={() => setSayfa(s => s - 1)}
            style={{
              padding: '6px 12px', fontSize: '13px', border: '1px solid #d1d5db',
              borderRadius: '6px', cursor: sayfa === 0 ? 'default' : 'pointer',
              background: 'white', color: sayfa === 0 ? '#d1d5db' : '#374151',
            }}
          >
            Onceki
          </button>
          <span style={{ padding: '6px 8px', fontSize: '13px', color: '#6b7280' }}>
            Sayfa {sayfa + 1}
          </span>
          <button
            onClick={() => setSayfa(s => s + 1)}
            style={{
              padding: '6px 12px', fontSize: '13px', border: '1px solid #d1d5db',
              borderRadius: '6px', cursor: 'pointer', background: 'white', color: '#374151',
            }}
          >
            Sonraki
          </button>
        </div>
      )}

      {/* Onizleme modal */}
      {secilenDosya && (
        <DosyaOnizleme
          dosya={secilenDosya}
          onKapat={() => setSecilenDosya(null)}
        />
      )}

      {/* Yukleme modal */}
      {yukleModalAcik && (
        <DosyaYukleModal
          yuklemeBilgi={yuklemeBilgi}
          onKapat={() => setYukleModalAcik(false)}
          onBasarili={() => { setYukleModalAcik(false); verileriYukle() }}
        />
      )}
    </div>
  )
}

// Tek dosya satiri
function DosyaSatir({ dosya, kompakt, onClick }) {
  const katIkon = KATEGORI_IKON[dosya.kategori] || '📎'
  const alanBilgi = ALAN_BILGI[dosya.alan]

  const thumbUrl = dosya.thumbnail_yolu ? `/api/dosya/${dosya.id}/thumb` : null

  // Etiketleri parse et
  let etiketler = []
  if (dosya.etiketler) {
    try {
      etiketler = typeof dosya.etiketler === 'string' ? JSON.parse(dosya.etiketler) : dosya.etiketler
    } catch { /* */ }
  }

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

      {/* Dosya adi + baslik + etiketler */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: '13px', fontWeight: 500, color: '#1f2937',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {kompakt && <span style={{ marginRight: '4px' }}>{katIkon}</span>}
          {dosya.baslik || dosya.orijinal_adi || dosya.dosya_adi}
        </div>
        {etiketler.length > 0 && (
          <div style={{ display: 'flex', gap: '3px', marginTop: '2px', flexWrap: 'wrap' }}>
            {etiketler.slice(0, 3).map(tag => (
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
      {!kompakt && (
        <span style={alanBilgi ? {
          fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '6px',
          background: `${alanBilgi.renk}12`, color: alanBilgi.renk,
        } : { fontSize: '12px', color: '#9ca3af' }}>
          {alanBilgi ? `${alanBilgi.ikon} ${alanBilgi.etiket}` : '—'}
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

      {/* Yukleyen */}
      {!kompakt && (
        <span style={{ fontSize: '12px', color: '#6b7280' }}>
          {dosya.yukleyen_adi || '—'}
        </span>
      )}

      {/* Indir butonu */}
      {!kompakt && (
        <a
          href={`/api/dosya/${dosya.id}/indir`}
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: '16px', textDecoration: 'none', textAlign: 'center' }}
          title="Indir"
        >
          ⬇️
        </a>
      )}
    </div>
  )
}
