import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Plus, Trash2, Link2, Unlink } from 'lucide-react'
import api from '@/api/client'
import { cn } from '@/lib/utils'

// Katalog adından Kg/Km oranını çıkar (ör: "ROSE AWG 4 (59.15Kg/Km)" → 59.15)
export function extractKgKmOran(text) {
  if (!text) return null
  const match = text.match(/(\d+[.,]?\d*)\s*kg\s*\/\s*km/i)
  if (!match) return null
  return parseFloat(match[1].replace(',', '.'))
}

const MT_BIRIMLER = ['mt', 'm', 'metre', 'meter']
const KG_BIRIMLER = ['kg', 'kilogram']
export const isMtBirim = (b) => MT_BIRIMLER.includes((b || '').toLowerCase())
export const isKgBirim = (b) => KG_BIRIMLER.includes((b || '').toLowerCase())

// Tek satır oluşturma fonksiyonu
let _satirIdCounter = 0
export function createSatir(data = {}) {
  return {
    _id: Date.now() + (++_satirIdCounter),
    malzeme_adi: data.malzeme_adi || '',
    birim: data.birim || 'Ad',
    miktar: data.miktar || 1,
    poz_no: data.poz_no || '',
    malzeme_kodu: data.malzeme_kodu || '',
    notlar: data.notlar || '',
    katalog_eslesme: data.katalog_eslesme || null,
    _eslesmedi: data._eslesmedi || false,
    _birim_secenekleri: data._birim_secenekleri || null,
    _kg_km_oran: data._kg_km_oran || null,
  }
}

// --- Tek satır bileşeni (katalog arama, birim dönüşüm dahil) ---
function DemontajSatirDuzenle({ kalem, index, onChange, onSil }) {
  const [focused, setFocused] = useState(false)
  const [sonuclar, setSonuclar] = useState([])
  const [araniyor, setAraniyor] = useState(false)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)
  const aramaTimer = useRef(null)

  // Debounced catalog search
  const aramaYap = useCallback((text) => {
    if (aramaTimer.current) clearTimeout(aramaTimer.current)
    if (!text || text.length < 1) { setSonuclar([]); setAraniyor(false); return }
    setAraniyor(true)
    aramaTimer.current = setTimeout(async () => {
      try {
        const res = await api.get('/malzeme-katalog', { params: { arama: text } })
        setSonuclar(res?.data || [])
      } catch { setSonuclar([]) }
      setAraniyor(false)
    }, 300)
  }, [])

  useEffect(() => {
    return () => { if (aramaTimer.current) clearTimeout(aramaTimer.current) }
  }, [])

  // Click outside to close dropdown
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) && inputRef.current && !inputRef.current.contains(e.target))
        setFocused(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleKatalogSec = (item) => {
    const katalogBirim = item.olcu || ''
    let orijinalBirim = kalem.birim || 'Ad'
    const katalogText = `${item.malzeme_cinsi || ''} ${item.malzeme_tanimi_sap || ''}`
    const kgKmOranHam = extractKgKmOran(katalogText)
    // Kg/Km oranı varsa ve birim Ad ise → iletken metraj, m olarak kabul et
    if (kgKmOranHam && orijinalBirim.toLowerCase() === 'ad') {
      orijinalBirim = 'm'
    }
    const birimFarkli = katalogBirim && orijinalBirim &&
      katalogBirim.toLowerCase().replace(/\./g, '') !== orijinalBirim.toLowerCase().replace(/\./g, '')
    const kgKmOran = birimFarkli ? kgKmOranHam : null
    let yeniMiktar = kalem.miktar
    if (kgKmOran && birimFarkli) {
      if (isMtBirim(orijinalBirim) && isKgBirim(katalogBirim)) {
        yeniMiktar = Math.round(kalem.miktar * kgKmOran / 1000 * 100) / 100
      } else if (isKgBirim(orijinalBirim) && isMtBirim(katalogBirim)) {
        yeniMiktar = Math.round(kalem.miktar / kgKmOran * 1000 * 100) / 100
      }
    }
    onChange(index, {
      ...kalem,
      malzeme_adi: item.malzeme_cinsi || item.malzeme_tanimi_sap || kalem.malzeme_adi,
      malzeme_kodu: item.malzeme_kodu || '',
      poz_no: item.poz_birlesik || '',
      birim: katalogBirim || kalem.birim,
      miktar: yeniMiktar,
      katalog_eslesme: item.malzeme_cinsi || item.malzeme_tanimi_sap,
      _eslesmedi: false,
      _birim_secenekleri: birimFarkli ? [orijinalBirim, katalogBirim] : null,
      _kg_km_oran: kgKmOran,
    })
    setFocused(false)
    setSonuclar([])
  }

  const handleMalzemeAdiDegistir = (e) => {
    const val = e.target.value
    onChange(index, { ...kalem, malzeme_adi: val, katalog_eslesme: null, _eslesmedi: false, _birim_secenekleri: null, _kg_km_oran: null })
    aramaYap(val)
  }

  const handleInputFocus = () => {
    setFocused(true)
    if (kalem.malzeme_adi && kalem.malzeme_adi.length >= 1 && !kalem.katalog_eslesme) {
      aramaYap(kalem.malzeme_adi)
    }
  }

  const showDropdown = focused && kalem.malzeme_adi.length >= 1 && !kalem.katalog_eslesme && (araniyor || sonuclar.length > 0)

  // Dropdown pozisyonu (portal ile fixed)
  const [dropdownPos, setDropdownPos] = useState(null)

  useEffect(() => {
    if (!showDropdown || !inputRef.current) { setDropdownPos(null); return }
    const update = () => {
      if (!inputRef.current) return
      const rect = inputRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const maxH = 192
      const openUp = spaceBelow < maxH + 8 && rect.top > spaceBelow
      setDropdownPos({
        position: 'fixed',
        left: rect.left,
        width: 600,
        zIndex: 9999,
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      })
    }
    update()
    const scrollEl = inputRef.current.closest('[class*="overflow"]')
    scrollEl?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      scrollEl?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [showDropdown])

  // Kg/Km dönüşüm hesapla
  const donusum = (() => {
    if (!kalem._kg_km_oran || !kalem._birim_secenekleri) return null
    const [b1, b2] = kalem._birim_secenekleri
    const mtBirim = isMtBirim(b1) ? b1 : isMtBirim(b2) ? b2 : null
    const kgBirim = isKgBirim(b1) ? b1 : isKgBirim(b2) ? b2 : null
    if (!mtBirim || !kgBirim) return null
    const curIsMt = isMtBirim(kalem.birim)
    const mtMiktar = curIsMt ? kalem.miktar : Math.round(kalem.miktar / kalem._kg_km_oran * 1000 * 100) / 100
    const kgMiktar = curIsMt ? Math.round(kalem.miktar * kalem._kg_km_oran / 1000 * 100) / 100 : kalem.miktar
    return { mtBirim, kgBirim, mtMiktar, kgMiktar }
  })()

  return (
    <tr className="border-b border-input/50 group transition-colors hover:bg-muted/50">
      <td className="px-2 py-1.5 text-muted-foreground text-center">{index + 1}</td>
      <td className="px-2 py-1.5 relative">
        <input
          ref={inputRef}
          value={kalem.malzeme_adi}
          onChange={handleMalzemeAdiDegistir}
          onFocus={handleInputFocus}
          onKeyDown={(e) => { if (e.key === 'Escape') setFocused(false) }}
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium hover:border-input focus:border-primary focus:outline-none"
          placeholder="Malzeme adi yazin..."
        />
        {showDropdown && dropdownPos && createPortal(
          <div ref={dropdownRef} style={dropdownPos} className="max-h-48 overflow-y-auto rounded-lg border border-input bg-card shadow-xl">
            {araniyor ? (
              <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                <Loader2 className="inline h-3 w-3 animate-spin mr-1" />Araniyor...
              </div>
            ) : !sonuclar?.length ? (
              <div className="px-3 py-3 text-center text-xs text-muted-foreground">Sonuc bulunamadi</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm">
                  <tr className="border-b border-input">
                    <th className="px-2 py-1 text-left font-medium text-muted-foreground">Poz</th>
                    <th className="px-2 py-1 text-left font-medium text-muted-foreground">Malzeme</th>
                    <th className="px-2 py-1 text-left font-medium text-muted-foreground">SAP Tanım</th>
                    <th className="px-2 py-1 text-left font-medium text-muted-foreground">Birim</th>
                  </tr>
                </thead>
                <tbody>
                  {sonuclar.slice(0, 20).map((item) => (
                    <tr key={item.id} onMouseDown={() => handleKatalogSec(item)} className="cursor-pointer border-b border-input/30 hover:bg-primary/5">
                      <td className="px-2 py-1 font-mono text-blue-600 whitespace-nowrap">{item.poz_birlesik || '-'}</td>
                      <td className="px-2 py-1">{item.malzeme_cinsi || '-'}</td>
                      <td className="px-2 py-1 text-muted-foreground">{item.malzeme_tanimi_sap || '-'}</td>
                      <td className="px-2 py-1 text-muted-foreground">{item.olcu || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>,
          document.body
        )}
        {kalem.katalog_eslesme && (
          <div className="mt-0.5 space-y-0.5 text-[10px]">
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-1 text-emerald-600">
                <Link2 className="h-2.5 w-2.5" />
                <span>Katalog: {kalem.katalog_eslesme}</span>
              </div>
              {kalem._birim_secenekleri && !donusum && (
                <div className="ml-auto flex items-center gap-1">
                  <span className="text-muted-foreground">Birim:</span>
                  {kalem._birim_secenekleri.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => onChange(index, { ...kalem, birim: b })}
                      className={cn(
                        'rounded px-1.5 py-0.5 font-semibold transition-colors',
                        kalem.birim === b
                          ? 'bg-primary text-white'
                          : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
                      )}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {donusum && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Dönüşüm:</span>
                <button
                  type="button"
                  onClick={() => onChange(index, { ...kalem, birim: donusum.mtBirim, miktar: donusum.mtMiktar })}
                  className={cn(
                    'rounded px-1.5 py-0.5 font-semibold transition-colors',
                    isMtBirim(kalem.birim)
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
                  )}
                >
                  {donusum.mtMiktar} {donusum.mtBirim}
                </button>
                <span className="text-muted-foreground">≈</span>
                <button
                  type="button"
                  onClick={() => onChange(index, { ...kalem, birim: donusum.kgBirim, miktar: donusum.kgMiktar })}
                  className={cn(
                    'rounded px-1.5 py-0.5 font-semibold transition-colors',
                    isKgBirim(kalem.birim)
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
                  )}
                >
                  {donusum.kgMiktar} {donusum.kgBirim}
                </button>
                <span className="text-muted-foreground/60">({kalem._kg_km_oran} Kg/Km)</span>
              </div>
            )}
          </div>
        )}
        {!kalem.katalog_eslesme && kalem._eslesmedi && (
          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-600">
            <Unlink className="h-2.5 w-2.5" />
            <span>Katalogda bulunamadi</span>
          </div>
        )}
      </td>
      <td className="px-2 py-1.5">
        <span className="text-[10px] font-mono text-muted-foreground">{kalem.malzeme_kodu || '-'}</span>
      </td>
      <td className="px-2 py-1.5">
        <input value={kalem.birim || 'Ad'} onChange={(e) => onChange(index, { ...kalem, birim: e.target.value })} className="w-12 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-center hover:border-input focus:border-primary focus:outline-none" />
      </td>
      <td className="px-2 py-1.5">
        <input type="number" value={kalem.miktar || ''} onChange={(e) => onChange(index, { ...kalem, miktar: Number(e.target.value) || 0 })} className="w-14 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-center hover:border-input focus:border-primary focus:outline-none" />
      </td>
      <td className="px-2 py-1.5 text-right">
        <button type="button" onClick={() => onSil(index)} className="rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600">
          <Trash2 className="h-3 w-3" />
        </button>
      </td>
    </tr>
  )
}

// --- Ana tablo bileşeni ---
export default function DemontajListesiDuzenle({ liste, onChange, baslik, aciklama, eslestiriliyor }) {
  const handleDegistir = (index, yeni) => {
    onChange(liste.map((k, i) => i === index ? yeni : k))
  }
  const handleSil = (index) => {
    onChange(liste.filter((_, i) => i !== index))
  }
  const handleEkle = () => {
    onChange([...liste, createSatir()])
  }

  const eslesmeOrani = liste.length > 0
    ? Math.round(liste.filter(d => d.katalog_eslesme).length / liste.length * 100)
    : 0

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-semibold">{baslik || 'Demontaj Listesi'}</h4>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{liste.length} kalem</span>
          {eslestiriliyor ? (
            <span className="flex items-center gap-1 text-xs text-primary"><Loader2 className="h-3 w-3 animate-spin" />Katalog eslestiriliyor...</span>
          ) : liste.length > 0 && (
            <span className={cn('text-xs font-medium', eslesmeOrani >= 80 ? 'text-emerald-600' : eslesmeOrani >= 50 ? 'text-amber-600' : 'text-red-600')}>
              %{eslesmeOrani} katalog eslesmesi
            </span>
          )}
        </div>
        <button type="button" onClick={handleEkle} className="flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20">
          <Plus className="h-3 w-3" />Ekle
        </button>
      </div>
      {aciklama && <p className="mb-2 text-[10px] text-muted-foreground">{aciklama}</p>}
      <div className="overflow-x-auto rounded-lg border border-input bg-card">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-input bg-muted/50">
              <th className="w-8 px-2 py-2 text-center font-medium text-muted-foreground">#</th>
              <th className="px-2 py-2 text-left font-medium text-muted-foreground">Malzeme</th>
              <th className="w-24 px-2 py-2 text-left font-medium text-muted-foreground">Malzeme Kodu</th>
              <th className="w-16 px-2 py-2 text-center font-medium text-muted-foreground">Birim</th>
              <th className="w-16 px-2 py-2 text-center font-medium text-muted-foreground">Miktar</th>
              <th className="w-8 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Demontaj kalemi yok</td></tr>
            ) : (
              liste.map((k, i) => (
                <DemontajSatirDuzenle key={k._id || i} kalem={k} index={i} onChange={handleDegistir} onSil={handleSil} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
