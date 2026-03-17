import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import api from '@/api/client'
import DosyaOnizleme from './DosyaOnizleme'
import DosyaYukleModal from './DosyaYukleModal'

// ═══════════════════════════════════════════
// SABITLER
// ═══════════════════════════════════════════

const ALAN_BILGI = {
  proje:    { etiket: 'Projeler',      ikon: '📁', renk: '#2563eb' },
  personel: { etiket: 'Personel',      ikon: '👤', renk: '#8b5cf6' },
  ekipman:  { etiket: 'Ekipman',       ikon: '🔧', renk: '#f59e0b' },
  ihale:    { etiket: 'Ihale',         ikon: '📋', renk: '#10b981' },
  isg:      { etiket: 'ISG',           ikon: '🛡️', renk: '#f43f5e' },
  firma:    { etiket: 'Firma',         ikon: '🏢', renk: '#6366f1' },
  muhasebe: { etiket: 'Muhasebe',      ikon: '💰', renk: '#84cc16' },
  kurum:    { etiket: 'Kurum Yazisma', ikon: '📨', renk: '#0ea5e9' },
  depo:     { etiket: 'Depo',          ikon: '📦', renk: '#ea580c' },
}

const KATEGORI_IKON = {
  fotograf: '📸', cizim: '📐', belge: '📄', tablo: '📊',
  harita: '🗺️', arsiv: '📦', diger: '📎',
}

const UZANTI_IKON = {
  pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗', csv: '📗',
  jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️',
  dwg: '📐', dxf: '📐', zip: '📦', rar: '📦',
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

function dosyaIkonu(dosya) {
  const uzanti = (dosya.orijinal_adi || dosya.dosya_adi || '').split('.').pop().toLowerCase()
  return UZANTI_IKON[uzanti] || KATEGORI_IKON[dosya.kategori] || '📄'
}

// ═══════════════════════════════════════════
// ANA BILESEN
// ═══════════════════════════════════════════

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
  const [silOnay, setSilOnay] = useState(null)
  const [siliniyor, setSiliniyor] = useState(false)
  const [seciliIdler, setSeciliIdler] = useState(new Set())
  const [hata, setHata] = useState(null)
  const [gorunum, setGorunum] = useState('liste') // 'liste' | 'grid'
  const [arama, setArama] = useState('')

  // Klasor navigasyonu — alt_alan parcalarindan yol izleme
  const [aktifYol, setAktifYol] = useState([]) // ['gelen', 'Ambar_Ana_Depo_2026-03-11']

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
      params.set('limit', '500')
      params.set('offset', '0')

      const url = filtreler.alan
        ? `/dosya/alan/${filtreler.alan}?${params}`
        : `/dosya?${params}`

      const json = await api.get(url)
      if (json.success) setDosyalar(json.data)
    } catch (err) {
      console.error('Dosya yukleme hatasi:', err)
    } finally {
      setYukleniyor(false)
    }
  }, [filtreler])

  useEffect(() => { verileriYukle() }, [verileriYukle])
  useEffect(() => { setSeciliIdler(new Set()) }, [dosyalar, aktifYol])
  useEffect(() => { setAktifYol([]) }, [filtreler.alan])

  // ─── Klasor agaci olustur ───
  const { klasorler, dosyalarBurada } = useMemo(() => {
    const yolStr = aktifYol.join('/')
    const klasorMap = {}
    const buradakiDosyalar = []

    for (const d of dosyalar) {
      // Sanal placeholder dosyaları atla (sadece klasör oluşturmak için)
      if (d._sanal && d.alt_alan?.endsWith('/placeholder')) {
        const parcalar = (d.alt_alan || '').split('/')
        const klasorAdi = parcalar[0]
        if (!yolStr && klasorAdi) {
          if (!klasorMap[klasorAdi]) klasorMap[klasorAdi] = { ad: klasorAdi, dosyaSayisi: 0, toplamBoyut: 0 }
        }
        continue
      }
      const altAlan = d.alt_alan || ''

      // Arama filtresi
      if (arama) {
        const ara = arama.toLowerCase()
        const eslesiyor =
          (d.dosya_adi || '').toLowerCase().includes(ara) ||
          (d.baslik || '').toLowerCase().includes(ara) ||
          (d.orijinal_adi || '').toLowerCase().includes(ara)
        if (!eslesiyor) continue
      }

      // Eger arama yapiliyorsa flat goster
      if (arama) {
        buradakiDosyalar.push(d)
        continue
      }

      // Klasor navigasyonu
      if (yolStr && !altAlan.startsWith(yolStr)) continue
      const kalanYol = yolStr ? altAlan.slice(yolStr.length + 1) : altAlan
      if (!kalanYol) {
        buradakiDosyalar.push(d)
        continue
      }
      const parcalar = kalanYol.split('/')
      const ilkKlasor = parcalar[0]
      if (parcalar.length === 1 && !ilkKlasor) {
        buradakiDosyalar.push(d)
      } else {
        if (!klasorMap[ilkKlasor]) klasorMap[ilkKlasor] = { ad: ilkKlasor, dosyaSayisi: 0, toplamBoyut: 0 }
        klasorMap[ilkKlasor].dosyaSayisi++
        klasorMap[ilkKlasor].toplamBoyut += d.dosya_boyutu || 0
      }
    }

    const siraliKlasorler = Object.values(klasorMap).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'))
    return { klasorler: siraliKlasorler, dosyalarBurada: buradakiDosyalar }
  }, [dosyalar, aktifYol, arama])

  // ─── Islemler ───
  const handleDosyaSil = async (dosyaId) => {
    setSiliniyor(true)
    setHata(null)
    try {
      await api.delete(`/dosya/${dosyaId}?fiziksel=true`)
      setSilOnay(null)
      verileriYukle()
    } catch (err) {
      setHata('Dosya silinirken hata: ' + err.message)
    } finally {
      setSiliniyor(false)
    }
  }

  const handleTopluSil = async () => {
    if (seciliIdler.size === 0) return
    setSiliniyor(true)
    setHata(null)
    try {
      await api.post('/dosya/toplu-sil', { ids: [...seciliIdler], fiziksel: true })
      setSilOnay(null)
      setSeciliIdler(new Set())
      verileriYukle()
    } catch (err) {
      setHata('Toplu silme hatasi: ' + err.message)
    } finally {
      setSiliniyor(false)
    }
  }

  const handleKlasorSil = async (klasorAdi) => {
    setSiliniyor(true)
    setHata(null)
    const altAlanPrefix = aktifYol.length > 0 ? `${aktifYol.join('/')}/${klasorAdi}` : klasorAdi
    try {
      await api.post('/dosya/klasor-sil', { alan: filtreler.alan, alt_alan: altAlanPrefix, fiziksel: true })
      setSilOnay(null)
      verileriYukle()
    } catch (err) {
      setHata('Klasor silme hatasi: ' + err.message)
    } finally {
      setSiliniyor(false)
    }
  }

  const handleTopluIndir = () => {
    const seciliDosyalar = dosyalarBurada.filter(d => seciliIdler.has(d.id))
    for (const d of seciliDosyalar) {
      const link = document.createElement('a')
      link.href = `/api/dosya/${d.id}/indir`
      link.download = d.orijinal_adi || d.dosya_adi
      link.click()
    }
  }

  const toggleSecim = (id) => {
    setSeciliIdler(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const tumunuSec = () => {
    if (seciliIdler.size === dosyalarBurada.length) setSeciliIdler(new Set())
    else setSeciliIdler(new Set(dosyalarBurada.map(d => d.id)))
  }

  const klasoreGir = (klasorAdi) => {
    setAktifYol(prev => [...prev, klasorAdi])
    setSeciliIdler(new Set())
  }

  const yolaDon = (index) => {
    setAktifYol(prev => prev.slice(0, index))
    setSeciliIdler(new Set())
  }

  const toplamDosya = dosyalarBurada.length + klasorler.reduce((t, k) => t + k.dosyaSayisi, 0)

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════

  const S = styles

  return (
    <div style={S.container}>
      {/* ─── UST CUBUK ─── */}
      <div style={S.toolbar}>
        <div style={S.toolbarLeft}>
          {/* Breadcrumb */}
          <div style={S.breadcrumb}>
            <button
              onClick={() => yolaDon(0)}
              style={{ ...S.breadcrumbItem, fontWeight: aktifYol.length === 0 ? 700 : 400 }}
            >
              {filtreler.alan ? `${ALAN_BILGI[filtreler.alan]?.ikon || '📂'} ${ALAN_BILGI[filtreler.alan]?.etiket || filtreler.alan}` : '📂 Tum Dosyalar'}
            </button>
            {aktifYol.map((parca, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#9ca3af', fontSize: '12px' }}>/</span>
                <button
                  onClick={() => yolaDon(i + 1)}
                  style={{ ...S.breadcrumbItem, fontWeight: i === aktifYol.length - 1 ? 700 : 400 }}
                >
                  {parca.replace(/_/g, ' ')}
                </button>
              </span>
            ))}
          </div>
          <span style={S.dosyaSayisi}>{toplamDosya} oge</span>
        </div>

        <div style={S.toolbarRight}>
          {/* Arama */}
          <input
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="Ara..."
            style={S.aramaInput}
          />
          {/* Gorunum */}
          <div style={S.gorunumToggle}>
            <button
              onClick={() => setGorunum('liste')}
              style={{ ...S.gorunumBtn, background: gorunum === 'liste' ? '#e0e7ff' : 'transparent', color: gorunum === 'liste' ? '#3730a3' : '#6b7280' }}
              title="Liste"
            >☰</button>
            <button
              onClick={() => setGorunum('grid')}
              style={{ ...S.gorunumBtn, background: gorunum === 'grid' ? '#e0e7ff' : 'transparent', color: gorunum === 'grid' ? '#3730a3' : '#6b7280' }}
              title="Grid"
            >▦</button>
          </div>
          {/* Yukle */}
          {!gizleYukleButon && (
            <button onClick={() => setYukleModalAcik(true)} style={S.yukleBtn}>
              + Yukle
            </button>
          )}
        </div>
      </div>

      {/* ─── SECIM CUBUGU ─── */}
      {seciliIdler.size > 0 && (
        <div style={S.secimCubugu}>
          <span style={{ fontWeight: 600 }}>{seciliIdler.size} dosya secildi</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={handleTopluIndir} style={S.secimBtn}>
              ⬇️ Indir
            </button>
            <button onClick={() => setSilOnay({ tip: 'toplu', sayisi: seciliIdler.size })} style={{ ...S.secimBtn, background: '#dc2626', color: 'white' }}>
              🗑 Sil
            </button>
            <button onClick={() => setSeciliIdler(new Set())} style={S.secimBtnGhost}>
              ✕ Vazgec
            </button>
          </div>
        </div>
      )}

      {/* ─── HATA ─── */}
      {hata && (
        <div style={S.hata}>
          <span>{hata}</span>
          <button onClick={() => setHata(null)} style={S.hataDismiss}>✕</button>
        </div>
      )}

      {/* ─── ICERIK ─── */}
      {yukleniyor ? (
        <div style={S.bos}>Yukleniyor...</div>
      ) : klasorler.length === 0 && dosyalarBurada.length === 0 ? (
        <div style={S.bos}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>📂</div>
          <div>Bu konumda dosya veya klasor yok</div>
        </div>
      ) : gorunum === 'grid' ? (
        <GridGorunum
          klasorler={klasorler}
          dosyalar={dosyalarBurada}
          seciliIdler={seciliIdler}
          onKlasorAc={klasoreGir}
          onKlasorSil={(ad) => setSilOnay({ tip: 'klasor', klasorAdi: ad })}
          onDosyaTikla={setSecilenDosya}
          onSecimToggle={toggleSecim}
          onDosyaSil={(d) => setSilOnay({ tip: 'dosya', id: d.id, etiket: d.baslik || d.orijinal_adi })}
        />
      ) : (
        <ListeGorunum
          klasorler={klasorler}
          dosyalar={dosyalarBurada}
          seciliIdler={seciliIdler}
          onKlasorAc={klasoreGir}
          onKlasorSil={(ad) => setSilOnay({ tip: 'klasor', klasorAdi: ad })}
          onDosyaTikla={setSecilenDosya}
          onSecimToggle={toggleSecim}
          onTumunuSec={tumunuSec}
          onDosyaSil={(d) => setSilOnay({ tip: 'dosya', id: d.id, etiket: d.baslik || d.orijinal_adi })}
        />
      )}

      {/* ─── SIL ONAY ─── */}
      {silOnay && (
        <div style={S.modalOverlay} onClick={() => !siliniyor && setSilOnay(null)}>
          <div style={S.modalKutu} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#dc2626', marginBottom: '8px' }}>
              {silOnay.tip === 'klasor' ? 'Klasoru Sil' : silOnay.tip === 'toplu' ? 'Secili Dosyalari Sil' : 'Dosyayi Sil'}
            </div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>
              {silOnay.tip === 'klasor'
                ? <><strong>{silOnay.klasorAdi?.replace(/_/g, ' ')}</strong> klasoru ve icindeki tum dosyalar kalici olarak silinecek.</>
                : silOnay.tip === 'toplu'
                ? <><strong>{silOnay.sayisi}</strong> dosya kalici olarak silinecek.</>
                : <><strong>{silOnay.etiket}</strong> dosyasi kalici olarak silinecek.</>
              }
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setSilOnay(null)} disabled={siliniyor} style={S.modalIptal}>Vazgec</button>
              <button
                disabled={siliniyor}
                onClick={() => {
                  if (silOnay.tip === 'dosya') handleDosyaSil(silOnay.id)
                  else if (silOnay.tip === 'toplu') handleTopluSil()
                  else handleKlasorSil(silOnay.klasorAdi)
                }}
                style={{ ...S.modalSil, opacity: siliniyor ? 0.5 : 1 }}
              >
                {siliniyor ? 'Siliniyor...' : 'Sil'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onizleme */}
      {secilenDosya && (
        <DosyaOnizleme dosya={secilenDosya} onKapat={() => setSecilenDosya(null)} />
      )}

      {/* Yukle modal */}
      {yukleModalAcik && (
        <DosyaYukleModal
          yuklemeBilgi={{ ...yuklemeBilgi, altAlan: aktifYol.join('/') || yuklemeBilgi.altAlan }}
          onKapat={() => setYukleModalAcik(false)}
          onBasarili={() => { setYukleModalAcik(false); verileriYukle() }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// GRID GORUNUM
// ═══════════════════════════════════════════

function GridGorunum({ klasorler, dosyalar, seciliIdler, onKlasorAc, onKlasorSil, onDosyaTikla, onSecimToggle, onDosyaSil }) {
  const S = styles
  return (
    <div style={S.gridContainer}>
      {/* Klasorler */}
      {klasorler.map(k => (
        <div
          key={`k-${k.ad}`}
          onDoubleClick={() => onKlasorAc(k.ad)}
          style={S.gridKlasor}
          onMouseEnter={e => { e.currentTarget.style.background = '#f0f9ff'; e.currentTarget.style.borderColor = '#93c5fd' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e5e7eb' }}
        >
          <div style={{ fontSize: '36px', marginBottom: '6px' }}>📁</div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#1f2937', textAlign: 'center', wordBreak: 'break-word', lineHeight: '1.3' }}>
            {k.ad.replace(/_/g, ' ')}
          </div>
          <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>
            {k.dosyaSayisi} dosya · {boyutFormatla(k.toplamBoyut)}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onKlasorSil(k.ad) }}
            style={S.gridSilBtn}
            title="Klasoru sil"
          >🗑</button>
        </div>
      ))}

      {/* Dosyalar */}
      {dosyalar.map(d => {
        const secili = seciliIdler.has(d.id)
        const thumbUrl = d.thumbnail_yolu ? `/api/dosya/${d.id}/thumb` : null
        return (
          <div
            key={`d-${d.id}`}
            onClick={() => onSecimToggle(d.id)}
            onDoubleClick={() => onDosyaTikla(d)}
            style={{ ...S.gridDosya, borderColor: secili ? '#3b82f6' : '#e5e7eb', background: secili ? '#eff6ff' : '#fff' }}
            onMouseEnter={e => { if (!secili) { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#d1d5db' } }}
            onMouseLeave={e => { if (!secili) { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e5e7eb' } }}
          >
            {secili && <div style={S.gridCheckmark}>✓</div>}
            <div style={{ fontSize: '32px', marginBottom: '4px' }}>
              {thumbUrl
                ? <img src={thumbUrl} alt="" style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover' }} />
                : dosyaIkonu(d)
              }
            </div>
            <div style={{ fontSize: '11px', fontWeight: 500, color: '#1f2937', textAlign: 'center', wordBreak: 'break-word', lineHeight: '1.3', maxHeight: '32px', overflow: 'hidden' }}>
              {d.baslik || d.orijinal_adi || d.dosya_adi}
            </div>
            <div style={{ fontSize: '10px', color: '#9ca3af' }}>{boyutFormatla(d.dosya_boyutu)}</div>
            <div style={S.gridDosyaActions}>
              <a href={`/api/dosya/${d.id}/indir`} onClick={e => e.stopPropagation()} title="Indir" style={{ fontSize: '14px', textDecoration: 'none' }}>⬇️</a>
              <button onClick={(e) => { e.stopPropagation(); onDosyaSil(d) }} title="Sil" style={S.gridSilBtn}>🗑</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════
// LISTE GORUNUM
// ═══════════════════════════════════════════

function ListeGorunum({ klasorler, dosyalar, seciliIdler, onKlasorAc, onKlasorSil, onDosyaTikla, onSecimToggle, onTumunuSec, onDosyaSil }) {
  const S = styles
  return (
    <div style={S.listeContainer}>
      {/* Baslik satiri */}
      <div style={S.listeBaslik}>
        <div style={{ width: '32px', textAlign: 'center' }}>
          {dosyalar.length > 0 && (
            <input
              type="checkbox"
              checked={seciliIdler.size === dosyalar.length && dosyalar.length > 0}
              onChange={onTumunuSec}
              style={S.checkbox}
            />
          )}
        </div>
        <div style={{ flex: 1 }}>Ad</div>
        <div style={{ width: '90px' }}>Boyut</div>
        <div style={{ width: '100px' }}>Tarih</div>
        <div style={{ width: '100px' }}>Yukleyen</div>
        <div style={{ width: '72px' }}></div>
      </div>

      {/* Klasor satirlari */}
      {klasorler.map(k => (
        <div
          key={`k-${k.ad}`}
          onDoubleClick={() => onKlasorAc(k.ad)}
          style={S.listeSatir}
          onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{ width: '32px' }}></div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => onKlasorAc(k.ad)}>
            <span style={{ fontSize: '22px' }}>📁</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>{k.ad.replace(/_/g, ' ')}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af' }}>{k.dosyaSayisi} dosya</div>
            </div>
          </div>
          <div style={{ width: '90px', fontSize: '12px', color: '#6b7280' }}>{boyutFormatla(k.toplamBoyut)}</div>
          <div style={{ width: '100px' }}></div>
          <div style={{ width: '100px' }}></div>
          <div style={{ width: '72px', display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
            <button onClick={() => onKlasorSil(k.ad)} title="Sil" style={S.listeSilBtn}>🗑</button>
          </div>
        </div>
      ))}

      {/* Dosya satirlari */}
      {dosyalar.map(d => {
        const secili = seciliIdler.has(d.id)
        const thumbUrl = d.thumbnail_yolu ? `/api/dosya/${d.id}/thumb` : null
        return (
          <div
            key={`d-${d.id}`}
            style={{ ...S.listeSatir, background: secili ? '#eff6ff' : 'transparent' }}
            onMouseEnter={e => { if (!secili) e.currentTarget.style.background = '#f9fafb' }}
            onMouseLeave={e => { if (!secili) e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{ width: '32px', textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={secili}
                onChange={() => onSecimToggle(d.id)}
                style={S.checkbox}
              />
            </div>
            <div
              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', minWidth: 0 }}
              onClick={() => onDosyaTikla(d)}
            >
              {thumbUrl
                ? <img src={thumbUrl} alt="" style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }} />
                : <span style={{ fontSize: '20px', flexShrink: 0 }}>{dosyaIkonu(d)}</span>
              }
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {d.baslik || d.orijinal_adi || d.dosya_adi}
                </div>
              </div>
            </div>
            <div style={{ width: '90px', fontSize: '12px', color: '#6b7280' }}>{boyutFormatla(d.dosya_boyutu)}</div>
            <div style={{ width: '100px', fontSize: '12px', color: '#6b7280' }}>{tarihFormatla(d.olusturma_tarihi)}</div>
            <div style={{ width: '100px', fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.yukleyen_adi || '—'}</div>
            <div style={{ width: '72px', display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
              <a href={`/api/dosya/${d.id}/indir`} onClick={e => e.stopPropagation()} title="Indir" style={{ fontSize: '15px', textDecoration: 'none' }}>⬇️</a>
              <button onClick={() => onDosyaSil(d)} title="Sil" style={S.listeSilBtn}>🗑</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════
// STILLER
// ═══════════════════════════════════════════

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },

  // Toolbar
  toolbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 0', marginBottom: '8px', flexWrap: 'wrap', gap: '8px',
  },
  toolbarLeft: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  toolbarRight: { display: 'flex', alignItems: 'center', gap: '8px' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' },
  breadcrumbItem: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: '14px', color: '#374151', padding: '4px 6px', borderRadius: '4px',
  },
  dosyaSayisi: { fontSize: '12px', color: '#9ca3af' },
  aramaInput: {
    padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '8px',
    fontSize: '13px', width: '180px', outline: 'none',
  },
  gorunumToggle: {
    display: 'flex', border: '1px solid #d1d5db', borderRadius: '6px', overflow: 'hidden',
  },
  gorunumBtn: {
    border: 'none', padding: '5px 10px', cursor: 'pointer', fontSize: '14px',
    background: 'transparent', lineHeight: 1,
  },
  yukleBtn: {
    padding: '6px 14px', fontSize: '13px', fontWeight: 600,
    background: '#2563eb', color: 'white',
    border: 'none', borderRadius: '8px', cursor: 'pointer',
  },

  // Secim cubugu
  secimCubugu: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 14px', marginBottom: '8px',
    background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px',
    fontSize: '13px', color: '#1e40af',
  },
  secimBtn: {
    padding: '4px 12px', fontSize: '12px', fontWeight: 600,
    background: '#2563eb', color: 'white',
    border: 'none', borderRadius: '6px', cursor: 'pointer',
  },
  secimBtnGhost: {
    padding: '4px 12px', fontSize: '12px', fontWeight: 500,
    background: 'white', color: '#6b7280',
    border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer',
  },

  // Hata
  hata: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 14px', marginBottom: '8px',
    background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
    fontSize: '13px', color: '#dc2626',
  },
  hataDismiss: { border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700 },

  // Bos
  bos: { padding: '60px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' },

  // Grid
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: '10px', padding: '4px',
  },
  gridKlasor: {
    position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '16px 10px 12px', border: '1px solid #e5e7eb', borderRadius: '10px',
    cursor: 'pointer', background: '#fff', transition: 'all 0.15s',
  },
  gridDosya: {
    position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '14px 8px 10px', border: '2px solid #e5e7eb', borderRadius: '10px',
    cursor: 'pointer', background: '#fff', transition: 'all 0.15s',
  },
  gridCheckmark: {
    position: 'absolute', top: '6px', left: '6px',
    width: '20px', height: '20px', borderRadius: '50%',
    background: '#3b82f6', color: 'white', fontSize: '12px', fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  gridSilBtn: {
    position: 'absolute', top: '4px', right: '4px',
    border: 'none', background: 'transparent', cursor: 'pointer',
    fontSize: '13px', color: '#d1d5db', padding: '2px',
    borderRadius: '4px', opacity: 0.6,
  },
  gridDosyaActions: {
    position: 'absolute', bottom: '4px', right: '4px',
    display: 'flex', gap: '2px', opacity: 0.5,
  },

  // Liste
  listeContainer: {
    border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden',
  },
  listeBaslik: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 14px', background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase',
  },
  listeSatir: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 14px', borderBottom: '1px solid #f3f4f6',
    transition: 'background 0.1s',
  },
  listeSilBtn: {
    border: 'none', background: 'transparent', cursor: 'pointer',
    fontSize: '14px', color: '#d1d5db', padding: '2px', borderRadius: '4px',
  },
  checkbox: { cursor: 'pointer', width: '15px', height: '15px', accentColor: '#2563eb' },

  // Modal
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modalKutu: {
    background: 'white', borderRadius: '12px', padding: '28px', width: '420px', maxWidth: '90vw',
    boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
  },
  modalIptal: {
    padding: '8px 20px', fontSize: '13px', fontWeight: 500,
    border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', background: 'white',
  },
  modalSil: {
    padding: '8px 20px', fontSize: '13px', fontWeight: 700,
    border: 'none', borderRadius: '8px', cursor: 'pointer',
    background: '#dc2626', color: 'white',
  },
}
