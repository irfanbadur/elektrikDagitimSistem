import { useState, useCallback } from 'react'

/**
 * Dropdown klavye navigasyonu hook'u
 * @param {Array} items - Dropdown'daki öğeler
 * @param {Function} onSelect - Öğe seçildiğinde çağrılır
 * @param {Function} onClose - Dropdown kapandığında çağrılır
 * @returns {{ seciliIdx, setSeciliIdx, handleKeyDown }}
 */
export default function useDropdownNav(items, onSelect, onClose) {
  const [seciliIdx, setSeciliIdx] = useState(-1)

  const handleKeyDown = useCallback((e) => {
    const len = items?.length || 0
    if (len === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSeciliIdx(prev => (prev + 1) % len)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSeciliIdx(prev => (prev <= 0 ? len - 1 : prev - 1))
    } else if (e.key === 'Enter' && seciliIdx >= 0 && seciliIdx < len) {
      e.preventDefault()
      onSelect(items[seciliIdx])
      setSeciliIdx(-1)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose?.()
      setSeciliIdx(-1)
    }
  }, [items, seciliIdx, onSelect, onClose])

  return { seciliIdx, setSeciliIdx, handleKeyDown }
}
