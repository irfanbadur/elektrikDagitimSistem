import { useState, useRef, useEffect, useCallback } from 'react'
import useDropdownNav from '@/hooks/useDropdownNav'
import { createPortal } from 'react-dom'
import { Loader2, Plus, Trash2, Link2, Unlink, MapPin } from 'lucide-react'
import api from '@/api/client'
import { cn } from '@/lib/utils'

let _direkIdCounter = 0
export function createDirekSatir(data = {}) {
  return {
    _id: Date.now() + (++_direkIdCounter),
    kisa_adi: data.kisa_adi || '',
    tipi: data.tipi || 'direk',
    arasi_kablo: data.arasi_kablo || '',
    notlar: data.notlar || '',
    katalog_adi: data.katalog_adi || '',
    malzeme_kodu: data.malzeme_kodu || '',
  }
}

const TIPI_LABELS = {
  direk: 'Direk',
  kablo: 'Kablo',
  trafo: 'Trafo',
  pano: 'Pano',
  agdirek: 'AG Direk',
}

// Tek direk satırı - katalog aramalı
function DirekSatirDuzenle({ kalem, index, onChange, onSil }) {
  const [focused, setFocused] = useState(false)
  const [sonuclar, setSonuclar] = useState([])
  const [araniyor, setAraniyor] = useState(false)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)
  const aramaTimer = useRef(null)

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

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) && inputRef.current && !inputRef.current.contains(e.target))
        setFocused(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleKatalogSec = useCallback((item) => {
    onChange(index, {
      ...kalem,
      katalog_adi: item.malzeme_cinsi || item.malzeme_tanimi_sap || '',
      malzeme_kodu: item.malzeme_kodu || '',
    })
    setFocused(false)
    setSonuclar([])
  }, [kalem, index, onChange])

  const gosterilen = sonuclar.slice(0, 20)
  const { seciliIdx, setSeciliIdx, handleKeyDown } = useDropdownNav(gosterilen, handleKatalogSec, () => setFocused(false))

  useEffect(() => { setSeciliIdx(-1) }, [sonuclar, setSeciliIdx])

  const handleKisaAdiDegistir = (e) => {
    onChange(index, { ...kalem, kisa_adi: e.target.value, katalog_adi: '', malzeme_kodu: '' })
    aramaYap(e.target.value)
  }

  const handleFocus = () => {
    setFocused(true)
    if (kalem.kisa_adi && !kalem.katalog_adi) aramaYap(kalem.kisa_adi)
  }

  const showDropdown = focused && kalem.kisa_adi.length >= 1 && !kalem.katalog_adi && (araniyor || sonuclar.length > 0)

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
        width: 450,
        zIndex: 9999,
        ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
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

  return (
    <tr className="border-b border-input/50 group transition-colors hover:bg-muted/50">
      <td className="px-2 py-1.5 text-muted-foreground text-center">{index + 1}</td>
      <td className="px-2 py-1.5 relative">
        <input
          ref={inputRef}
          value={kalem.kisa_adi}
          onChange={handleKisaAdiDegistir}
          onFocus={handleFocus}
          onKeyDown={showDropdown ? handleKeyDown : (e) => { if (e.key === 'Escape') setFocused(false) }}
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium hover:border-input focus:border-primary focus:outline-none"
          placeholder="Direk numarasi..."
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
                    <th className="px-2 py-1 text-left font-medium text-muted-foreground">Kod</th>
                    <th className="px-2 py-1 text-left font-medium text-muted-foreground">Malzeme</th>
                    <th className="px-2 py-1 text-left font-medium text-muted-foreground">Birim</th>
                  </tr>
                </thead>
                <tbody>
                  {gosterilen.map((item, i) => (
                    <tr key={item.id} onMouseDown={() => handleKatalogSec(item)} className={cn('cursor-pointer border-b border-input/30', i === seciliIdx ? 'bg-primary/10' : 'hover:bg-primary/5')}>
                      <td className="px-2 py-1 font-mono text-blue-600 whitespace-nowrap">{item.malzeme_kodu || item.poz_birlesik || '-'}</td>
                      <td className="px-2 py-1">{item.malzeme_cinsi || item.malzeme_tanimi_sap || '-'}</td>
                      <td className="px-2 py-1 text-muted-foreground">{item.olcu || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>,
          document.body
        )}
        {kalem.katalog_adi && (
          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-600">
            <Link2 className="h-2.5 w-2.5" />
            <span>{kalem.katalog_adi}</span>
          </div>
        )}
        {!kalem.katalog_adi && kalem.kisa_adi && kalem._eslesmedi && (
          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-600">
            <Unlink className="h-2.5 w-2.5" />
            <span>Katalogda bulunamadi</span>
          </div>
        )}
      </td>
      <td className="px-2 py-1.5">
        <select
          value={kalem.tipi}
          onChange={(e) => onChange(index, { ...kalem, tipi: e.target.value })}
          className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-input focus:border-primary focus:outline-none"
        >
          {Object.entries(TIPI_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1.5">
        <input
          value={kalem.arasi_kablo || ''}
          onChange={(e) => onChange(index, { ...kalem, arasi_kablo: e.target.value })}
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-input focus:border-primary focus:outline-none"
          placeholder="3x35 AER 50m"
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          value={kalem.notlar || ''}
          onChange={(e) => onChange(index, { ...kalem, notlar: e.target.value })}
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-input focus:border-primary focus:outline-none"
          placeholder="Not..."
        />
      </td>
      <td className="px-2 py-1.5 text-right">
        <button type="button" onClick={() => onSil(index)} className="rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600">
          <Trash2 className="h-3 w-3" />
        </button>
      </td>
    </tr>
  )
}

// Ana tablo
export default function DirekListesiDuzenle({ liste, onChange, eslestiriliyor }) {
  const handleDegistir = (index, yeni) => {
    onChange(liste.map((k, i) => i === index ? yeni : k))
  }
  const handleSil = (index) => {
    onChange(liste.filter((_, i) => i !== index))
  }
  const handleEkle = () => {
    onChange([...liste, createDirekSatir()])
  }

  const eslesmeOrani = liste.length > 0
    ? Math.round(liste.filter(d => d.katalog_adi).length / liste.length * 100)
    : 0

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-primary" />
            Kroki Direk Listesi
          </h4>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{liste.length} direk</span>
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
      <p className="mb-2 text-[10px] text-muted-foreground">Krokideki direk numarasini yazip malzeme katalogdan gercek malzeme adini eslestirebilirsiniz.</p>
      <div className="overflow-x-auto rounded-lg border border-input bg-card">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-input bg-muted/50">
              <th className="w-8 px-2 py-2 text-center font-medium text-muted-foreground">#</th>
              <th className="px-2 py-2 text-left font-medium text-muted-foreground">Krokideki Adi</th>
              <th className="w-20 px-2 py-2 text-left font-medium text-muted-foreground">Tipi</th>
              <th className="w-36 px-2 py-2 text-left font-medium text-muted-foreground">Arasi Kablo</th>
              <th className="w-32 px-2 py-2 text-left font-medium text-muted-foreground">Not</th>
              <th className="w-8 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Kroki diregi yok</td></tr>
            ) : (
              liste.map((k, i) => (
                <DirekSatirDuzenle key={k._id || i} kalem={k} index={i} onChange={handleDegistir} onSil={handleSil} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
