import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Link2, X } from 'lucide-react'
import api from '@/api/client'

// Malzeme katalogdan aranabilir input (abone kablosu vb. için)
export default function KatalogAramaInput({ value, onChange, placeholder, className }) {
  const [focused, setFocused] = useState(false)
  const [sonuclar, setSonuclar] = useState([])
  const [araniyor, setAraniyor] = useState(false)
  const [eslesmis, setEslesmis] = useState(null)
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

  const handleSec = (item) => {
    const adi = item.malzeme_cinsi || item.malzeme_tanimi_sap || ''
    onChange(adi)
    setEslesmis(adi)
    setFocused(false)
    setSonuclar([])
  }

  const handleInputChange = (e) => {
    const val = e.target.value
    onChange(val)
    setEslesmis(null)
    aramaYap(val)
  }

  const handleFocus = () => {
    setFocused(true)
    if (value && value.length >= 1 && !eslesmis) {
      aramaYap(value)
    }
  }

  const showDropdown = focused && value && value.length >= 1 && !eslesmis && (araniyor || sonuclar.length > 0)

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
        width: Math.max(rect.width, 600),
        zIndex: 9999,
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [showDropdown])

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value || ''}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={(e) => { if (e.key === 'Escape') setFocused(false) }}
        className={className}
        placeholder={placeholder}
      />
      {eslesmis && (
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-600">
          <Link2 className="h-2.5 w-2.5" />
          <span>Katalog: {eslesmis}</span>
          <button type="button" onClick={() => setEslesmis(null)} className="ml-1 rounded-full p-0.5 hover:bg-red-50 hover:text-red-500">
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      )}
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
                  <th className="px-2 py-1 text-left font-medium text-muted-foreground">SAP Tanım</th>
                  <th className="px-2 py-1 text-left font-medium text-muted-foreground">Birim</th>
                </tr>
              </thead>
              <tbody>
                {sonuclar.slice(0, 15).map((item) => (
                  <tr key={item.id} onMouseDown={() => handleSec(item)} className="cursor-pointer border-b border-input/30 hover:bg-primary/5">
                    <td className="px-2 py-1 font-mono text-blue-600 whitespace-nowrap">{item.malzeme_kodu || item.poz_birlesik || '-'}</td>
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
    </div>
  )
}
