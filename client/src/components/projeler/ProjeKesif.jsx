import { useState, useRef, useEffect, useCallback } from 'react'
import useDropdownNav from '@/hooks/useDropdownNav'
import { Plus, Trash2, Search, Package, Check, Clock, X, Columns3, ChevronDown, ChevronUp, Loader2, Combine, FileSpreadsheet } from 'lucide-react'
import { useProjeKesif, useProjeKesifEkle, useProjeKesifGuncelle, useProjeKesifSil, useProjeKesifOzet } from '@/hooks/useProjeKesif'
import { useProje } from '@/hooks/useProjeler'
import { useDepolar } from '@/hooks/useDepolar'
import { useDepoKatalog } from '@/hooks/useDepoKatalog'
import api from '@/api/client'
import { cn } from '@/lib/utils'

const DURUM_MAP = {
  planli: { label: 'Planli', renk: 'bg-slate-100 text-slate-700', icon: Clock },
  depoda_var: { label: 'Depoda Var', renk: 'bg-blue-100 text-blue-700', icon: Package },
  alindi: { label: 'Bono ile Alindi', renk: 'bg-emerald-100 text-emerald-700', icon: Check },
  sahaya_verildi: { label: 'Sahaya Verildi', renk: 'bg-purple-100 text-purple-700', icon: Check },
}

const TUM_SUTUNLAR = [
  { key: 'okunan_deger', label: 'Okunan Değer',  varsayilan: true  },
  { key: 'malzeme_kodu', label: 'Malzeme Kodu',  varsayilan: true  },
  { key: 'malzeme_adi',  label: 'Malzeme Adı',   varsayilan: true,  zorunlu: true },
  { key: 'birim_fiyat',  label: 'Birim Fiyat',   varsayilan: true  },
  { key: 'birim',        label: 'Birim',          varsayilan: true  },
  { key: 'miktar',       label: 'Miktar',         varsayilan: true  },
  { key: 'ilerleme',     label: 'İlerleme',       varsayilan: true  },
  { key: 'kalan',        label: 'Kalan',          varsayilan: true  },
  { key: 'toplam_tutar', label: 'Toplam Tutar',  varsayilan: true  },
  { key: 'alinan_miktar',label: 'Alınan Miktar', varsayilan: false },
  { key: 'durum',        label: 'Durum',          varsayilan: true  },
  { key: 'depo',         label: 'Depo Stok',      varsayilan: true  },
  { key: 'notlar',       label: 'Notlar',         varsayilan: false },
]

function SutunSecici({ gorunurSutunlar, setGorunurSutunlar }) {
  const [acik, setAcik] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAcik(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleSutun = (key) => {
    const sutun = TUM_SUTUNLAR.find(s => s.key === key)
    if (sutun?.zorunlu) return
    setGorunurSutunlar(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAcik(!acik)}
        className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
          acik ? 'border-primary bg-primary/5 text-primary' : 'border-input bg-background text-foreground hover:bg-muted'
        )}
      >
        <Columns3 className="h-4 w-4" />
        Sütunlar
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
          {gorunurSutunlar.length}/{TUM_SUTUNLAR.length}
        </span>
        {acik ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {acik && (
        <div className="absolute right-0 z-50 mt-1 w-56 rounded-lg border border-input bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-input px-3 py-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Görünür Sütunlar</span>
            <div className="flex gap-1">
              <button
                onClick={() => setGorunurSutunlar(TUM_SUTUNLAR.map(s => s.key))}
                className="rounded px-1.5 py-0.5 text-xs text-primary hover:bg-primary/10"
              >Tümü</button>
              <button
                onClick={() => setGorunurSutunlar(TUM_SUTUNLAR.filter(s => s.zorunlu || s.varsayilan).map(s => s.key))}
                className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
              >Sıfırla</button>
            </div>
          </div>
          <div className="p-1">
            {TUM_SUTUNLAR.map(sutun => {
              const secili = gorunurSutunlar.includes(sutun.key)
              return (
                <button
                  key={sutun.key}
                  onClick={() => toggleSutun(sutun.key)}
                  disabled={sutun.zorunlu}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                    sutun.zorunlu ? 'cursor-not-allowed opacity-50' : '',
                    secili ? 'text-foreground hover:bg-muted' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <div className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                    secili ? 'border-primary bg-primary text-white' : 'border-input bg-background'
                  )}>
                    {secili && <Check className="h-3 w-3" />}
                  </div>
                  {sutun.label}
                  {sutun.zorunlu && <span className="ml-auto text-[10px] text-muted-foreground">zorunlu</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const BIRLESTIR_RENKLER = [
  { bg: 'bg-blue-50', border: 'border-l-blue-500', check: 'border-blue-500 bg-blue-500', label: 'bg-blue-100 text-blue-700' },
  { bg: 'bg-amber-50', border: 'border-l-amber-500', check: 'border-amber-500 bg-amber-500', label: 'bg-amber-100 text-amber-700' },
  { bg: 'bg-emerald-50', border: 'border-l-emerald-500', check: 'border-emerald-500 bg-emerald-500', label: 'bg-emerald-100 text-emerald-700' },
  { bg: 'bg-purple-50', border: 'border-l-purple-500', check: 'border-purple-500 bg-purple-500', label: 'bg-purple-100 text-purple-700' },
  { bg: 'bg-rose-50', border: 'border-l-rose-500', check: 'border-rose-500 bg-rose-500', label: 'bg-rose-100 text-rose-700' },
  { bg: 'bg-cyan-50', border: 'border-l-cyan-500', check: 'border-cyan-500 bg-cyan-500', label: 'bg-cyan-100 text-cyan-700' },
]

function BirlestirSecici({ kesifler, onBirlestir, seciliCinsler, setSeciliCinsler }) {
  const [acik, setAcik] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setAcik(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const cinsSayilari = {}
  ;(kesifler || []).forEach(k => {
    const c = (k.okunan_deger || '').split(' — ').pop()
    if (c) cinsSayilari[c] = (cinsSayilari[c] || 0) + 1
  })
  const cinsler = Object.keys(cinsSayilari).filter(c => cinsSayilari[c] > 1).sort()

  // Seçili cinslere index bazlı renk ata
  const seciliDizi = [...seciliCinsler]
  const cinsRenkMap = {}
  seciliDizi.forEach((c, i) => { cinsRenkMap[c] = BIRLESTIR_RENKLER[i % BIRLESTIR_RENKLER.length] })

  const toggleCins = (c) => setSeciliCinsler(prev => {
    const yeni = new Set(prev)
    yeni.has(c) ? yeni.delete(c) : yeni.add(c)
    return yeni
  })

  const handleBirlestir = () => {
    if (seciliCinsler.size === 0) return
    onBirlestir([...seciliCinsler])
    setSeciliCinsler(new Set())
    setAcik(false)
  }

  if (!cinsler.length) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAcik(!acik)}
        className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
          seciliCinsler.size > 0 ? 'border-amber-400 bg-amber-50 text-amber-700' : acik ? 'border-primary bg-primary/5 text-primary' : 'border-input bg-background text-foreground hover:bg-muted'
        )}
      >
        <Combine className="h-4 w-4" />
        Birleştir
        {seciliCinsler.size > 0 && <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-xs font-semibold">{seciliCinsler.size}</span>}
        {acik ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {acik && (
        <div className="absolute right-0 z-50 mt-1 w-64 rounded-lg border border-input bg-card shadow-lg">
          <div className="border-b border-input px-3 py-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Malzeme Cinsine Göre Birleştir</span>
          </div>
          <div className="p-1">
            {cinsler.map(c => {
              const secili = seciliCinsler.has(c)
              const renk = cinsRenkMap[c]
              const adet = (kesifler || []).filter(k => (k.okunan_deger || '').split(' — ').pop() === c).length
              return (
                <button
                  key={c}
                  onClick={() => toggleCins(c)}
                  className={cn('flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                    secili && renk ? renk.label : 'hover:bg-muted'
                  )}
                >
                  <div className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                    secili && renk ? renk.check + ' text-white' : 'border-input bg-background'
                  )}>
                    {secili && <Check className="h-3 w-3" />}
                  </div>
                  <span className="flex-1">{c}</span>
                  <span className="text-xs text-muted-foreground">{adet} satır</span>
                </button>
              )
            })}
          </div>
          {seciliCinsler.size > 0 && (
            <div className="border-t border-input p-2">
              <button
                onClick={handleBirlestir}
                className="w-full rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 transition-colors"
              >
                Seçilenleri Birleştir ({seciliCinsler.size} cins)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function KesifOzet({ projeId }) {
  const { data: ozet } = useProjeKesifOzet(projeId)
  if (!ozet) return null

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border border-input bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">Toplam Kalem</p>
        <p className="text-lg font-bold">{ozet.toplam_kalem || 0}</p>
      </div>
      <div className="rounded-lg border border-input bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">Alinan</p>
        <p className="text-lg font-bold text-emerald-600">{ozet.alinan_kalem || 0}</p>
      </div>
      <div className="rounded-lg border border-input bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">Depoda Var</p>
        <p className="text-lg font-bold text-blue-600">{ozet.depoda_var_kalem || 0}</p>
      </div>
      <div className="rounded-lg border border-input bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">Bekleyen</p>
        <p className="text-lg font-bold text-amber-600">{ozet.planli_kalem || 0}</p>
      </div>
    </div>
  )
}

function KatalogSecici({ onSec, onKapat }) {
  const [arama, setArama] = useState('')
  const { data: katalog, isLoading } = useDepoKatalog(arama ? { arama } : {})
  const [secilen, setSecilen] = useState([])

  const toggleSec = useCallback((item) => {
    setSecilen(prev =>
      prev.find(s => s.id === item.id)
        ? prev.filter(s => s.id !== item.id)
        : [...prev, item]
    )
  }, [])

  const gosterilenKatalog = (katalog || []).slice(0, 100)
  const { seciliIdx, setSeciliIdx, handleKeyDown: katalogKeyDown } = useDropdownNav(gosterilenKatalog, toggleSec, onKapat)

  useEffect(() => { setSeciliIdx(-1) }, [katalog, setSeciliIdx])

  const handleEkle = () => {
    const kalemler = secilen.map(s => ({
      malzeme_kodu: s.malzeme_kodu,
      poz_no: s.poz_birlesik,
      malzeme_adi: s.malzeme_cinsi,
      birim: s.olcu || 'Ad',
      miktar: 0,
      birim_fiyat: 0,
    }))
    onSec(kalemler)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 flex max-h-[80vh] w-full max-w-3xl flex-col rounded-lg bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-input px-4 py-3">
          <h3 className="font-semibold">Katalogdan Malzeme Sec</h3>
          <button onClick={onKapat} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="border-b border-input px-4 py-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Malzeme adi veya poz ara..."
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              onKeyDown={katalogKeyDown}
              className="w-full rounded-lg border border-input bg-background py-2 pl-3 pr-9 text-sm focus:border-primary focus:outline-none"
              autoFocus
            />
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          {secilen.length > 0 && (
            <p className="mt-2 text-xs text-primary font-medium">{secilen.length} malzeme secildi</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Yukleniyor...</div>
          ) : !katalog?.length ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Arama yapin...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr className="border-b border-input">
                  <th className="w-10 px-3 py-2"></th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Poz No</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Malzeme</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">SAP Tanım</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Birim</th>
                </tr>
              </thead>
              <tbody>
                {gosterilenKatalog.map((item, i) => {
                  const secili = secilen.find(s => s.id === item.id)
                  return (
                    <tr
                      key={item.id}
                      onClick={() => toggleSec(item)}
                      className={cn('border-b border-input/50 cursor-pointer transition-colors', secili ? 'bg-primary/5' : i === seciliIdx ? 'bg-primary/10' : 'hover:bg-muted/30')}
                    >
                      <td className="px-3 py-2">
                        <div className={cn('flex h-4 w-4 items-center justify-center rounded border', secili ? 'border-primary bg-primary text-white' : 'border-input')}>
                          {secili && <Check className="h-3 w-3" />}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-blue-600">{item.poz_birlesik || '-'}</td>
                      <td className="px-3 py-2 text-xs">{item.malzeme_cinsi}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{item.malzeme_tanimi_sap || '-'}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{item.olcu || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-input px-4 py-3">
          <button onClick={onKapat} className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-muted">Iptal</button>
          <button
            onClick={handleEkle}
            disabled={secilen.length === 0}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {secilen.length} Malzeme Ekle
          </button>
        </div>
      </div>
    </div>
  )
}

function DuzenlenebilirHucre({ deger, onKaydet, type = 'number', className: cls }) {
  const [duzenle, setDuzenle] = useState(false)
  const [val, setVal] = useState(deger)
  const inputRef = useRef(null)

  useEffect(() => { if (duzenle && inputRef.current) inputRef.current.focus() }, [duzenle])

  const kaydet = () => {
    setDuzenle(false)
    const yeni = type === 'number' ? Number(val) || 0 : val
    if (yeni !== deger) onKaydet(yeni)
  }

  if (!duzenle) {
    return (
      <div
        onClick={() => { setVal(deger); setDuzenle(true) }}
        className={cn('flex h-full w-full min-h-[28px] min-w-[60px] cursor-pointer items-center rounded px-2 py-1 hover:bg-primary/10 hover:ring-1 hover:ring-primary/30', cls)}
        title="Duzenlemek icin tikla"
      >
        {type === 'number' && deger ? deger.toLocaleString('tr-TR', deger % 1 !== 0 ? { minimumFractionDigits: 2 } : {}) : (deger || '-')}
      </div>
    )
  }

  return (
    <input
      ref={inputRef}
      type={type}
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={kaydet}
      onKeyDown={e => { if (e.key === 'Enter') kaydet(); if (e.key === 'Escape') setDuzenle(false) }}
      className="w-full min-w-[60px] rounded border border-primary bg-background px-2 py-1 text-xs text-left focus:outline-none"
    />
  )
}

// Malzeme adı hücresi — tıklanınca arama moduna geçer, tooltip ile mevcut değer gösterilir
function MalzemeAdiHucre({ deger, onKaydet }) {
  const [duzenle, setDuzenle] = useState(false)
  const [arama, setArama] = useState('')
  const [sonuclar, setSonuclar] = useState([])
  const [araniyor, setAraniyor] = useState(false)
  const inputRef = useRef(null)
  const dropRef = useRef(null)
  const timer = useRef(null)

  useEffect(() => {
    if (duzenle && inputRef.current) inputRef.current.focus()
  }, [duzenle])

  useEffect(() => {
    const h = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target) && inputRef.current && !inputRef.current.contains(e.target)) {
        setDuzenle(false)
        setSonuclar([])
      }
    }
    document.addEventListener('mousedown', h)
    return () => { document.removeEventListener('mousedown', h); if (timer.current) clearTimeout(timer.current) }
  }, [])

  const ara = (text) => {
    if (timer.current) clearTimeout(timer.current)
    if (!text || text.length < 2) { setSonuclar([]); return }
    setAraniyor(true)
    timer.current = setTimeout(async () => {
      try {
        const r = await api.get('/malzeme-katalog', { params: { arama: text } })
        setSonuclar(Array.isArray(r) ? r : (r?.data || []))
      } catch { setSonuclar([]) }
      setAraniyor(false)
    }, 300)
  }

  const handleSec = useCallback((item) => {
    onKaydet({
      malzeme_adi: item.malzeme_cinsi || item.malzeme_tanimi_sap || deger,
      malzeme_kodu: item.malzeme_kodu || '',
      poz_no: item.poz_birlesik || '',
      birim: item.olcu || '',
    })
    setDuzenle(false)
    setSonuclar([])
  }, [deger, onKaydet])

  const gosterilen = sonuclar.slice(0, 15)
  const { seciliIdx, setSeciliIdx, handleKeyDown } = useDropdownNav(gosterilen, handleSec, () => { setDuzenle(false); setSonuclar([]) })
  useEffect(() => { setSeciliIdx(-1) }, [sonuclar, setSeciliIdx])

  const handleAc = () => {
    setArama(deger || '')
    setDuzenle(true)
    ara(deger || '')
  }

  if (!duzenle) {
    return (
      <div onClick={handleAc} className="cursor-pointer rounded px-1 py-0.5 hover:bg-primary/10 hover:ring-1 hover:ring-primary/30 min-h-[24px]" title="Düzenlemek için tıkla">
        {deger || '-'}
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Mevcut değer tooltip */}
      <div className="absolute bottom-full left-0 mb-1 max-w-[400px] rounded bg-slate-800 px-2 py-1 text-[10px] text-white shadow-lg z-50 whitespace-nowrap overflow-hidden text-ellipsis">
        Mevcut: {deger || '-'}
      </div>
      <input
        ref={inputRef}
        value={arama}
        onChange={e => { setArama(e.target.value); ara(e.target.value) }}
        onKeyDown={gosterilen.length > 0 ? handleKeyDown : (e) => { if (e.key === 'Escape') { setDuzenle(false); setSonuclar([]) } }}
        className="w-full rounded border border-primary bg-background px-2 py-0.5 text-xs focus:outline-none"
        placeholder="Katalogda ara..."
      />
      {(araniyor || gosterilen.length > 0) && (
        <div ref={dropRef} className="absolute left-0 top-full z-50 mt-1 max-h-48 w-[550px] overflow-y-auto rounded-lg border border-border bg-white shadow-xl ring-1 ring-black/5">
          {araniyor ? (
            <div className="px-3 py-3 text-center text-xs text-muted-foreground"><Loader2 className="inline h-3 w-3 animate-spin mr-1" />Aranıyor...</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/90">
                <tr className="border-b border-border">
                  <th className="px-2 py-1 text-left font-medium text-muted-foreground">Poz</th>
                  <th className="px-2 py-1 text-left font-medium text-muted-foreground">Kod</th>
                  <th className="px-2 py-1 text-left font-medium text-muted-foreground">Malzeme</th>
                  <th className="px-2 py-1 text-center font-medium text-muted-foreground">Birim</th>
                </tr>
              </thead>
              <tbody>
                {gosterilen.map((item, i) => (
                  <tr key={item.id} onMouseDown={() => handleSec(item)}
                    className={cn('cursor-pointer border-b border-border/30 transition-colors', i === seciliIdx ? 'bg-primary/10' : 'hover:bg-primary/5')}>
                    <td className="px-2 py-1 font-mono text-blue-600 whitespace-nowrap">{item.poz_birlesik || '-'}</td>
                    <td className="px-2 py-1 font-mono text-muted-foreground">{item.malzeme_kodu || '-'}</td>
                    <td className="px-2 py-1">{item.malzeme_cinsi || item.malzeme_tanimi_sap || '-'}</td>
                    <td className="px-2 py-1 text-center text-muted-foreground">{item.olcu || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function KesifSatiri({ kalem: k, siraNo, secili, birlestirRenk, onSecimDegistir, durum, onGuncelle, onDurumDegistir, onSil, gorSutun, onEnterSonraki, depolar, seciliDepoId }) {
  // Inline katalog arama — malzeme adı hücresinde
  const [katalogAcik, setKatalogAcik] = useState(false)
  const [katalogSonuc, setKatalogSonuc] = useState([])
  const [aramaText, setAramaText] = useState(null)
  const [araniyor, setAraniyor] = useState(false)
  const timer = useRef(null)
  const dropRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const h = (e) => { if (dropRef.current && !dropRef.current.contains(e.target) && inputRef.current && !inputRef.current.contains(e.target)) setKatalogAcik(false) }
    document.addEventListener('mousedown', h)
    return () => { document.removeEventListener('mousedown', h); if (timer.current) clearTimeout(timer.current) }
  }, [])

  const ara = (text) => {
    if (timer.current) clearTimeout(timer.current)
    if (!text || text.length < 2) { setKatalogSonuc([]); setKatalogAcik(false); return }
    setAraniyor(true)
    timer.current = setTimeout(async () => {
      try {
        const r = await api.get('/malzeme-katalog', { params: { arama: text } })
        const liste = Array.isArray(r) ? r : (r?.data || [])
        setKatalogSonuc(liste)
        setKatalogAcik(liste.length > 0)
      } catch { setKatalogSonuc([]) }
      setAraniyor(false)
    }, 300)
  }

  const handleKatalogSec = useCallback((item) => {
    if (!item) return
    onGuncelle({
      malzeme_adi: item.malzeme_cinsi || item.malzeme_tanimi_sap || k.malzeme_adi,
      malzeme_kodu: item.malzeme_kodu || '',
      birim: item.olcu || k.birim,
    })
    setKatalogAcik(false)
    setAramaText(null)
    // Seçim sonrası alt satıra geç
    setTimeout(() => onEnterSonraki?.(), 50)
  }, [k, onGuncelle])

  const gosterilen = katalogSonuc.slice(0, 15)
  const { seciliIdx, setSeciliIdx, handleKeyDown } = useDropdownNav(gosterilen, handleKatalogSec, () => setKatalogAcik(false))
  useEffect(() => { setSeciliIdx(-1) }, [katalogSonuc, setSeciliIdx])

  const editCls = 'w-full rounded border border-transparent bg-transparent px-2 py-1 text-xs hover:border-input focus:border-primary focus:outline-none'

  return (
    <tr className={cn('border-b border-input/50 group hover:bg-muted/20 transition-colors', k.kapsayici && 'bg-sky-50 font-semibold', secili && 'bg-primary/5', birlestirRenk && `${birlestirRenk.bg} border-l-4 ${birlestirRenk.border}`)}>
      <td className="px-1.5 py-1.5 text-center text-xs text-muted-foreground w-8">{siraNo}</td>
      <td className="px-1 py-1.5 text-center w-8">
        <input type="checkbox" checked={secili} onChange={e => onSecimDegistir(e.target.checked)} className="h-3.5 w-3.5 rounded border-gray-300 accent-primary cursor-pointer" />
      </td>
      {gorSutun('okunan_deger') && (
        <td className="px-2 py-1.5">
          <span className="px-2 text-xs font-medium text-foreground" title={k.okunan_deger || '-'}>{k.okunan_deger || '-'}</span>
        </td>
      )}
      {gorSutun('malzeme_kodu') && (
        <td className="px-2 py-1.5">
          <input value={k.malzeme_kodu || ''} onChange={e => onGuncelle({ malzeme_kodu: e.target.value })} className={cn(editCls, 'font-mono w-24')} placeholder="-" />
        </td>
      )}
      {gorSutun('malzeme_adi') && (
        <td className="px-2 py-1.5 relative" style={{ overflow: 'visible' }}>
          <input ref={inputRef} value={aramaText !== null ? aramaText : (k.malzeme_adi || '')}
            onChange={e => { setAramaText(e.target.value); ara(e.target.value) }}
            onFocus={() => { setAramaText(k.malzeme_adi || ''); if ((k.malzeme_adi || '').length >= 2) ara(k.malzeme_adi) }}
            onBlur={() => { if (!katalogAcik) setAramaText(null) }}
            onKeyDown={katalogAcik ? handleKeyDown : (e) => { if (e.key === 'Enter') { e.preventDefault(); onEnterSonraki?.() } }}
            className={cn(editCls, 'font-medium')} placeholder="Malzeme adı..." />
          {katalogAcik && (araniyor || gosterilen.length > 0) && (
            <div ref={dropRef} className="absolute left-0 top-full z-50 mt-1 max-h-48 w-[550px] overflow-y-auto rounded-lg border border-border bg-white shadow-xl ring-1 ring-black/5">
              {araniyor ? <div className="px-3 py-3 text-center text-xs text-muted-foreground"><Loader2 className="inline h-3 w-3 animate-spin mr-1" />Aranıyor...</div> : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/90"><tr className="border-b border-border">
                    <th className="px-2 py-1 text-left font-medium text-muted-foreground">Poz</th>
                    <th className="px-2 py-1 text-left font-medium text-muted-foreground">Kod</th>
                    <th className="px-2 py-1 text-left font-medium text-muted-foreground">Malzeme</th>
                    <th className="px-2 py-1 text-center font-medium text-muted-foreground">Birim</th>
                  </tr></thead>
                  <tbody>{gosterilen.map((item, i) => (
                    <tr key={item.id} onMouseDown={() => handleKatalogSec(item)}
                      className={cn('cursor-pointer border-b border-border/30 transition-colors', i === seciliIdx ? 'bg-primary/10' : 'hover:bg-primary/5')}>
                      <td className="px-2 py-1 font-mono text-blue-600">{item.poz_birlesik || '-'}</td>
                      <td className="px-2 py-1 font-mono text-muted-foreground">{item.malzeme_kodu || '-'}</td>
                      <td className="px-2 py-1">{item.malzeme_cinsi || item.malzeme_tanimi_sap || '-'}</td>
                      <td className="px-2 py-1 text-center text-muted-foreground">{item.olcu || '-'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          )}
        </td>
      )}
      {gorSutun('birim_fiyat') && (
        <td className="px-2 py-1.5 text-center text-xs tabular-nums text-muted-foreground">
          {(k.birim_fiyat || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
        </td>
      )}
      {gorSutun('birim') && (
        <td className="px-2 py-1.5">
          <input value={k.birim || 'Ad'} onChange={e => onGuncelle({ birim: e.target.value })} className={cn(editCls, 'text-center w-14')} />
        </td>
      )}
      {gorSutun('miktar') && (
        <td className="px-2 py-1.5">
          {k.kapsayici ? (
            <span className={cn(editCls, 'text-center w-16 block tabular-nums text-sky-700')}>{(k._hesaplananMiktar ?? k.miktar ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
          ) : (
            <input type="number" value={k.miktar || ''} onChange={e => onGuncelle({ miktar: Number(e.target.value) || 0 })} className={cn(editCls, 'text-center w-16')} />
          )}
        </td>
      )}
      {gorSutun('ilerleme') && (
        <td className="px-2 py-1.5">
          {k.kapsayici ? (
            <span className={cn(editCls, 'text-center w-16 block tabular-nums text-sky-700')}>{(k._hesaplananIlerleme ?? k.ilerleme ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
          ) : (
            <input type="number" value={k.ilerleme || ''} max={k.miktar || 0}
              onChange={e => { const v = Math.min(Number(e.target.value) || 0, k.miktar || 0); onGuncelle({ ilerleme: v }) }}
              className={cn(editCls, 'text-center w-16')} />
          )}
        </td>
      )}
      {gorSutun('kalan') && (
        <td className="px-2 py-1.5 text-center text-xs tabular-nums font-medium">
          {(() => { const m = k.kapsayici ? (k._hesaplananMiktar ?? k.miktar ?? 0) : (k.miktar || 0); const i = k.kapsayici ? (k._hesaplananIlerleme ?? k.ilerleme ?? 0) : (k.ilerleme || 0); return Math.max(m - i, 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 }) })()}
        </td>
      )}
      {gorSutun('toplam_tutar') && (
        <td className="px-3 py-1.5 text-left text-xs tabular-nums font-medium">
          {(((k.kapsayici ? (k._hesaplananMiktar ?? k.miktar ?? 0) : (k.miktar || 0)) * (k.birim_fiyat || 0))).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
        </td>
      )}
      {gorSutun('alinan_miktar') && (
        <td className="px-2 py-1.5 text-center text-xs tabular-nums">
          {k.alinan_miktar ? <span className="font-medium text-emerald-600">{k.alinan_miktar}</span> : <span className="text-muted-foreground">-</span>}
        </td>
      )}
      {gorSutun('durum') && (
        <td className="px-2 py-1.5">
          <select value={k.durum} onChange={(e) => onDurumDegistir(e.target.value)}
            className={cn('rounded-full px-2 py-0.5 text-xs font-medium border-0 cursor-pointer', durum.renk)}>
            {Object.entries(DURUM_MAP).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
          </select>
        </td>
      )}
      {gorSutun('depo') && (
        <td className="px-2 py-1.5 text-xs text-center">
          {seciliDepoId && k.malzeme_kodu ? (
            <span className={k.depo_stok > 0 ? 'text-emerald-600 font-medium' : 'text-red-500'}>
              {k.depo_stok ?? 0}
            </span>
          ) : <span className="text-muted-foreground">-</span>}
        </td>
      )}
      {gorSutun('notlar') && (
        <td className="px-2 py-1.5">
          <input value={k.notlar || ''} onChange={e => onGuncelle({ notlar: e.target.value })} className={cn(editCls, 'max-w-[150px]')} placeholder="Not..." />
        </td>
      )}
      <td className="px-2 py-1.5 text-right">
        <button onClick={onSil} className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-opacity" title="Sil">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
}

function KesifFormSatiri({ onKaydet, onIptal, gorSutun }) {
  const [form, setForm] = useState({ malzeme_adi: '', malzeme_kodu: '', poz_no: '', birim: 'Ad', miktar: '', birim_fiyat: '', notlar: '' })
  const [arama, setArama] = useState('')
  const [aramaDebounced, setAramaDebounced] = useState('')
  const [dropdownAcik, setDropdownAcik] = useState(false)
  const [secildi, setSecildi] = useState(false)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (secildi) return
    const t = setTimeout(() => setAramaDebounced(arama), 300)
    return () => clearTimeout(t)
  }, [arama, secildi])

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) && inputRef.current && !inputRef.current.contains(e.target)) {
        setDropdownAcik(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const { data: sonuclar, isLoading: araniyor } = useDepoKatalog(
    aramaDebounced.length >= 2 ? { arama: aramaDebounced } : null
  )

  const handleAramaChange = (e) => {
    const val = e.target.value
    setArama(val)
    setSecildi(false)
    setDropdownAcik(val.length >= 2)
    if (!val) {
      setForm({ malzeme_adi: '', malzeme_kodu: '', poz_no: '', birim: 'Ad', miktar: form.miktar, birim_fiyat: form.birim_fiyat, notlar: form.notlar })
    }
  }

  const handleSec = useCallback((item) => {
    setForm(prev => ({
      ...prev,
      malzeme_kodu: item.malzeme_kodu || '',
      poz_no: item.poz_birlesik || '',
      malzeme_adi: item.malzeme_cinsi || item.malzeme_tanimi_sap || '',
      birim: item.olcu || 'Ad',
    }))
    setArama(item.malzeme_cinsi || item.malzeme_tanimi_sap || '')
    setSecildi(true)
    setDropdownAcik(false)
  }, [])

  const gosterilen = (sonuclar || []).slice(0, 50)
  const { seciliIdx, setSeciliIdx, handleKeyDown: dropdownKeyDown } = useDropdownNav(gosterilen, handleSec, () => setDropdownAcik(false))

  useEffect(() => { setSeciliIdx(-1) }, [sonuclar, setSeciliIdx])

  return (
    <tr className="border-b border-input bg-primary/5">
      <td className="px-1.5 py-2 text-center text-xs text-muted-foreground">+</td>
      <td className="px-1 py-2" />
      {gorSutun('okunan_deger') && (
        <td className="px-3 py-2">
          <span className="px-2 text-xs text-muted-foreground">-</span>
        </td>
      )}
      {gorSutun('malzeme_kodu') && (
        <td className="px-3 py-2">
          <input value={form.malzeme_kodu} readOnly tabIndex={-1} placeholder="Kod" className="w-full rounded border border-input bg-muted/50 px-2 py-1 text-xs text-muted-foreground" />
        </td>
      )}
      {gorSutun('malzeme_adi') && (
        <td className="px-3 py-2">
          <div className="relative">
            <div className="relative">
              <input
                ref={inputRef}
                value={arama}
                onChange={handleAramaChange}
                onFocus={() => { if (arama.length >= 2 && !secildi) setDropdownAcik(true) }}
                onKeyDown={dropdownAcik ? dropdownKeyDown : undefined}
                placeholder="Malzeme ara (min 2 harf)..."
                className="w-full rounded border border-input bg-background py-1 pl-2 pr-7 text-xs focus:border-primary focus:outline-none"
                autoFocus
              />
              <Search className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            </div>
            {dropdownAcik && (
              <div ref={dropdownRef} className="absolute left-0 top-full z-50 mt-1 max-h-60 w-[500px] overflow-y-auto rounded-lg border border-input bg-card shadow-xl">
                {araniyor ? (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">Araniyor...</div>
                ) : !sonuclar?.length ? (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">Sonuc bulunamadi</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm">
                      <tr className="border-b border-input">
                        <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Poz No</th>
                        <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Malzeme Cinsi</th>
                        <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">SAP Tanımı</th>
                        <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Birim</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gosterilen.map((item, i) => (
                        <tr
                          key={item.id}
                          onClick={() => handleSec(item)}
                          className={cn('cursor-pointer border-b border-input/30 transition-colors', i === seciliIdx ? 'bg-primary/10' : 'hover:bg-primary/5')}
                        >
                          <td className="px-2 py-1.5 font-mono text-blue-600 whitespace-nowrap">{item.poz_birlesik || '-'}</td>
                          <td className="px-2 py-1.5">{item.malzeme_cinsi || '-'}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{item.malzeme_tanimi_sap || '-'}</td>
                          <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{item.olcu || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </td>
      )}
      {gorSutun('birim_fiyat') && (
        <td className="px-3 py-2 text-center text-xs text-muted-foreground">-</td>
      )}
      {gorSutun('birim') && (
        <td className="px-3 py-2">
          <input value={form.birim} readOnly tabIndex={-1} className="w-16 rounded border border-input bg-muted/50 px-2 py-1 text-xs text-muted-foreground" />
        </td>
      )}
      {gorSutun('miktar') && (
        <td className="px-3 py-2">
          <input type="number" value={form.miktar} onChange={e => setForm({ ...form, miktar: e.target.value })} placeholder="0" className="w-20 rounded border border-input bg-background px-2 py-1 text-xs" />
        </td>
      )}
      {gorSutun('ilerleme') && (
        <td className="px-3 py-2">
          <input type="number" value={form.ilerleme || ''} onChange={e => setForm({ ...form, ilerleme: e.target.value })} placeholder="0" className="w-20 rounded border border-input bg-background px-2 py-1 text-xs" />
        </td>
      )}
      {gorSutun('kalan') && <td className="px-3 py-2 text-xs text-muted-foreground">-</td>}
      {gorSutun('toplam_tutar') && <td className="px-3 py-2 text-xs text-muted-foreground">-</td>}
      {gorSutun('alinan_miktar') && <td className="px-3 py-2 text-xs text-muted-foreground">-</td>}
      {gorSutun('durum') && <td className="px-3 py-2 text-xs text-muted-foreground">Planli</td>}
      {gorSutun('depo') && <td className="px-3 py-2 text-xs text-muted-foreground">-</td>}
      {gorSutun('notlar') && (
        <td className="px-3 py-2">
          <input value={form.notlar} onChange={e => setForm({ ...form, notlar: e.target.value })} placeholder="Not..." className="w-full rounded border border-input bg-background px-2 py-1 text-xs" />
        </td>
      )}
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <button
            onClick={() => { if (form.malzeme_adi) onKaydet({ ...form, miktar: Number(form.miktar) || 0, birim_fiyat: Number(form.birim_fiyat) || 0 }) }}
            disabled={!form.malzeme_adi}
            className="rounded bg-primary px-2 py-1 text-xs text-white hover:bg-primary/90 disabled:opacity-50"
          >Kaydet</button>
          <button onClick={onIptal} className="rounded border border-input px-2 py-1 text-xs hover:bg-muted">Iptal</button>
        </div>
      </td>
    </tr>
  )
}

export default function ProjeKesif({ projeId }) {
  const { data: depolar } = useDepolar()
  const { data: proje } = useProje(projeId)
  const [seciliDepoId, setSeciliDepoId] = useState('')

  // İş tipinin varsayılan deposunu yükle
  useEffect(() => {
    if (!proje?.is_tipi_id || seciliDepoId) return
    api.get(`/is-tipleri/${proje.is_tipi_id}`).then(r => {
      const tip = r?.data || r
      if (tip?.depo_id) setSeciliDepoId(String(tip.depo_id))
    }).catch(() => {})
  }, [proje?.is_tipi_id])

  const { data: kesifler, isLoading } = useProjeKesif(projeId, seciliDepoId)
  const ekle = useProjeKesifEkle(projeId)
  const guncelle = useProjeKesifGuncelle(projeId, seciliDepoId)
  const sil = useProjeKesifSil(projeId)

  const [yeniSatir, setYeniSatir] = useState(false)
  const [seciliIdler, setSeciliIdler] = useState(new Set())
  const [birlestirCinsler, setBirlestirCinsler] = useState(new Set())
  const [dxfDosya, setDxfDosya] = useState(null) // { dosyaId, dosyaAdi, adimAdi }
  const [dxfYukleniyor, setDxfYukleniyor] = useState(false)

  // Yaşam döngüsündeki DXF dosyasını bul
  useEffect(() => {
    if (!projeId) return
    api.get(`/dongu/proje/${projeId}/faz`).then(r => {
      const fazlar = r?.data || r || []
      for (const faz of fazlar) {
        for (const adim of (faz.adimlar || [])) {
          api.get(`/dosya/adim/${adim.id}`).then(dr => {
            const dosyalar = dr?.data || dr || []
            const dxf = dosyalar.find(d => (d.dosya_adi||'').endsWith('.dxf') || (d.orijinal_adi||'').endsWith('.dxf'))
            if (dxf && !dxfDosya) {
              setDxfDosya({ dosyaId: dxf.id, dosyaAdi: dxf.orijinal_adi || dxf.dosya_adi, adimAdi: adim.adim_adi })
            }
          }).catch(() => {})
        }
      }
    }).catch(() => {})
  }, [projeId])

  // DXF'ten keşif oluştur — mevcut listeyi temizleyip yeniden oluşturur
  const handleDxfKesifOlustur = async () => {
    if (!dxfDosya) return
    if (kesifler?.length > 0 && !window.confirm('Mevcut keşif listesi silinip DXF\'ten yeniden oluşturulacak. Devam edilsin mi?')) return
    setDxfYukleniyor(true)
    try {
      // Önce mevcut listeyi temizle
      if (kesifler?.length > 0) {
        for (const k of kesifler) {
          await sil.mutateAsync(k.id)
        }
      }
      // DXF'ten elemanları çek, aynı okunan değerleri birleştir
      const r = await api.get(`/dosya/${dxfDosya.dosyaId}/dxf-elemanlar`)
      const data = r?.data || r
      if (data?.elemanlar?.length > 0) {
        const birlesik = new Map()
        for (const el of data.elemanlar) {
          const okunanDeger = [el.tip || el.etiket, el.sembolAdi].filter(Boolean).join(' — ')
          if (okunanDeger) {
            birlesik.set(okunanDeger, (birlesik.get(okunanDeger) || 0) + 1)
          }
        }
        for (const [okunanDeger, miktar] of birlesik) {
          await ekle.mutateAsync({
            malzeme_adi: '',
            malzeme_kodu: '',
            poz_no: '',
            birim: 'Ad',
            miktar,
            birim_fiyat: 0,
            notlar: '',
            okunan_deger: okunanDeger,
          })
        }
      }
    } catch (err) { alert(err.message || 'DXF keşif oluşturma hatası') }
    finally { setDxfYukleniyor(false) }
  }

  const [excelAktariliyor, setExcelAktariliyor] = useState(false)
  const handleExcelAktar = async (tip = 'ilerleme') => {
    if (!kesifler?.length) return alert('Keşif listesi boş')
    setExcelAktariliyor(true)
    try {
      const r = await api.post(`/proje-kesif/${projeId}/excel-aktar`, { tip })
      const d = r?.data || r
      alert(`${d.yazilanSatir || 0} kalem ${tip === 'ilerleme' ? 'ilerleme' : 'miktar'} olarak Excel'e aktarıldı.\nDosya: ihale/YB-KET/`)
    } catch (err) { alert(err?.response?.data?.error || err.message || 'Excel aktarma hatası') }
    finally { setExcelAktariliyor(false) }
  }

  const [gorunurSutunlar, setGorunurSutunlar] = useState(() => {
    try {
      const saved = localStorage.getItem('proje_kesif_sutunlar')
      if (saved) {
        let parsed = JSON.parse(saved)
        // poz_no → okunan_deger migration
        if (parsed.includes('poz_no')) parsed = parsed.map(k => k === 'poz_no' ? 'okunan_deger' : k)
        // Bilinmeyen key'leri kaldır, eksik varsayılanları ekle
        const gecerliKeys = TUM_SUTUNLAR.map(s => s.key)
        parsed = parsed.filter(k => gecerliKeys.includes(k))
        if (!parsed.includes('okunan_deger')) parsed.unshift('okunan_deger')
        if (!parsed.includes('depo')) {
          const durumIdx = parsed.indexOf('durum')
          parsed.splice(durumIdx >= 0 ? durumIdx + 1 : parsed.length, 0, 'depo')
        }
        if (!parsed.includes('ilerleme')) {
          const miktarIdx = parsed.indexOf('miktar')
          parsed.splice(miktarIdx >= 0 ? miktarIdx + 1 : parsed.length, 0, 'ilerleme')
        }
        if (!parsed.includes('kalan')) {
          const ilerlemeIdx = parsed.indexOf('ilerleme')
          parsed.splice(ilerlemeIdx >= 0 ? ilerlemeIdx + 1 : parsed.length, 0, 'kalan')
        }
        if (!parsed.includes('birim_fiyat')) {
          const kalanIdx = parsed.indexOf('kalan')
          parsed.splice(ilerlemeIdx >= 0 ? ilerlemeIdx + 1 : parsed.length, 0, 'birim_fiyat')
        }
        if (!parsed.includes('toplam_tutar')) {
          const bfIdx = parsed.indexOf('birim_fiyat')
          parsed.splice(bfIdx >= 0 ? bfIdx + 1 : parsed.length, 0, 'toplam_tutar')
        }
        return parsed
      }
    } catch {}
    return TUM_SUTUNLAR.filter(s => s.varsayilan).map(s => s.key)
  })

  useEffect(() => {
    try { localStorage.setItem('proje_kesif_sutunlar', JSON.stringify(gorunurSutunlar)) } catch {}
  }, [gorunurSutunlar])

  const tabloRef = useRef(null)
  const gorSutun = (key) => gorunurSutunlar.includes(key)
  const toplamSutun = gorunurSutunlar.length + 3 // +1 actions +2 (#, checkbox)

  const handleKaydet = async (data) => {
    await ekle.mutateAsync(data)
    setYeniSatir(false)
  }

  const handleBirlestir = async (cinsler) => {
    if (!kesifler?.length || !cinsler.length) return
    const toplamSatir = kesifler.filter(k => {
      const cins = (k.okunan_deger || '').split(' — ').pop()
      return cinsler.includes(cins)
    }).length
    if (!window.confirm(`${cinsler.join(', ')} cinslerindeki ${toplamSatir} satır birleştirilecek. Devam edilsin mi?`)) return

    for (const cins of cinsler) {
      const satirlar = kesifler.filter(k => (k.okunan_deger || '').split(' — ').pop() === cins)
      if (satirlar.length <= 1) continue
      const toplamMiktar = satirlar.reduce((s, k) => s + (k.miktar || 0), 0)
      // İlk satırı güncelle, diğerlerini sil
      await guncelle.mutateAsync({ id: satirlar[0].id, ...satirlar[0], miktar: toplamMiktar, okunan_deger: cins })
      for (let i = 1; i < satirlar.length; i++) {
        await sil.mutateAsync(satirlar[i].id)
      }
    }
  }

  const handleDurumDegistir = (id, kalem, yeniDurum) => {
    guncelle.mutate({ id, ...kalem, durum: yeniDurum })
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Proje-Kesif Listesi</h3>
      </div>

      <KesifOzet projeId={projeId} />

      <div className="mb-2 flex items-center gap-2">
        {dxfDosya && (
          <button onClick={handleDxfKesifOlustur} disabled={dxfYukleniyor}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors">
            {dxfYukleniyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {dxfDosya.adimAdi} &gt; {dxfDosya.dosyaAdi}'den Keşif Oluştur
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {kesifler?.length > 0 && (
            <div className="relative group">
              <button disabled={excelAktariliyor}
                onClick={() => handleExcelAktar('ilerleme')}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors">
                {excelAktariliyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                Excel'e Aktar
              </button>
            </div>
          )}
          <SutunSecici gorunurSutunlar={gorunurSutunlar} setGorunurSutunlar={setGorunurSutunlar} />
          <BirlestirSecici kesifler={kesifler} onBirlestir={handleBirlestir} seciliCinsler={birlestirCinsler} setSeciliCinsler={setBirlestirCinsler} />
          {seciliIdler.size > 0 && (
            <button onClick={async () => {
              if (!window.confirm(`${seciliIdler.size} malzeme silinecek. Emin misiniz?`)) return
              for (const id of seciliIdler) { await sil.mutateAsync(id) }
              setSeciliIdler(new Set())
            }} className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100">
              <Trash2 className="h-4 w-4" />
              Secilenleri Sil ({seciliIdler.size})
            </button>
          )}
          <button onClick={() => setYeniSatir(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Ekle
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-input bg-card" ref={tabloRef}>
        <div className="overflow-x-auto" style={{ overflow: 'visible' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-input bg-muted/50">
                <th className="w-8 px-1.5 py-3 text-center text-xs font-semibold text-muted-foreground">#</th>
                <th className="w-8 px-1 py-3 text-center">
                  <input type="checkbox"
                    checked={kesifler?.length > 0 && seciliIdler.size === kesifler.length}
                    onChange={e => {
                      if (e.target.checked) setSeciliIdler(new Set(kesifler.map(k => k.id)))
                      else setSeciliIdler(new Set())
                    }}
                    className="h-3.5 w-3.5 rounded border-gray-300 accent-primary cursor-pointer"
                  />
                </th>
                {gorSutun('okunan_deger') && <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Okunan Değer</th>}
                {gorSutun('malzeme_kodu') && <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Malzeme Kodu</th>}
                {gorSutun('malzeme_adi') && <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Malzeme Adı</th>}
                {gorSutun('birim_fiyat') && <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Birim Fiyat</th>}
                {gorSutun('birim') && <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Birim</th>}
                {gorSutun('miktar') && <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Miktar</th>}
                {gorSutun('ilerleme') && <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">İlerleme</th>}
                {gorSutun('kalan') && <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Kalan</th>}
                {gorSutun('toplam_tutar') && <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Toplam Tutar</th>}
                {gorSutun('alinan_miktar') && <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground">Alınan Miktar</th>}
                {gorSutun('durum') && <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Durum</th>}
                {gorSutun('depo') && (
                  <th className="px-2 py-2">
                    <select value={seciliDepoId} onChange={e => setSeciliDepoId(e.target.value)}
                      className="rounded border border-input bg-background px-2 py-1 text-xs font-semibold text-muted-foreground focus:border-primary focus:outline-none">
                      <option value="">Depo Seç</option>
                      {(depolar || []).map(d => <option key={d.id} value={d.id}>{d.depo_adi}</option>)}
                    </select>
                  </th>
                )}
                {gorSutun('notlar') && <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Notlar</th>}
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {yeniSatir && <KesifFormSatiri onKaydet={handleKaydet} onIptal={() => setYeniSatir(false)} gorSutun={gorSutun} />}

              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-input/50">
                    {Array.from({ length: toplamSutun }).map((_, j) => (
                      <td key={j} className="px-3 py-2.5"><div className="skeleton h-4 w-full rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : !kesifler?.length && !yeniSatir ? (
                <tr>
                  <td colSpan={toplamSutun} className="px-3 py-12 text-center">
                    <Package className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">Kesif listesi bos</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">Katalogdan veya manuel olarak malzeme ekleyin</p>
                  </td>
                </tr>
              ) : (
                kesifler?.map((k, idx) => {
                  // Kapsayıcı satır hesaplaması: alt satırların (birim_agirlik × miktar) toplamı
                  if (k.kapsayici) {
                    const prefix = k.poz_no || k.okunan_deger || ''
                    const altSatirlar = kesifler.filter(a => !a.kapsayici && a.poz_no?.startsWith(prefix) && a.poz_no !== prefix)
                    k._hesaplananMiktar = altSatirlar.reduce((t, a) => t + (a.birim_agirlik || 0) * (a.miktar || 0), 0)
                    k._hesaplananIlerleme = altSatirlar.reduce((t, a) => t + (a.birim_agirlik || 0) * (a.ilerleme || 0), 0)
                  }
                  const durum = DURUM_MAP[k.durum] || DURUM_MAP.planli
                  const cins = (k.okunan_deger || '').split(' — ').pop()
                  const birlestirIdx = [...birlestirCinsler].indexOf(cins)
                  const birlestirRenk = birlestirIdx >= 0 ? BIRLESTIR_RENKLER[birlestirIdx % BIRLESTIR_RENKLER.length] : null
                  return (
                    <KesifSatiri
                      key={k.id}
                      kalem={k}
                      siraNo={idx + 1}
                      secili={seciliIdler.has(k.id)}
                      birlestirRenk={birlestirRenk}
                      onSecimDegistir={(checked) => setSeciliIdler(prev => {
                        const yeni = new Set(prev)
                        checked ? yeni.add(k.id) : yeni.delete(k.id)
                        return yeni
                      })}
                      durum={durum}
                      gorSutun={gorSutun}
                      onGuncelle={(data) => guncelle.mutate({ id: k.id, ...k, ...data })}
                      onDurumDegistir={(d) => handleDurumDegistir(k.id, k, d)}
                      onSil={() => sil.mutate(k.id)}
                      depolar={depolar}
                      seciliDepoId={seciliDepoId}
                      onEnterSonraki={() => {
                        if (!tabloRef.current) return
                        const rows = tabloRef.current.querySelectorAll('tbody tr')
                        const idx = kesifler.findIndex(x => x.id === k.id)
                        const nextRow = rows[idx + 1 + (yeniSatir ? 1 : 0)]
                        const input = nextRow?.querySelector('input[placeholder="Malzeme adı..."]')
                        input?.focus()
                      }}
                    />
                  )
                })
              )}
            </tbody>
            {/* Genel Toplam */}
            {kesifler?.length > 0 && gorSutun('toplam_tutar') && (
              <tfoot className="sticky bottom-0 bg-muted/95 backdrop-blur-sm border-t-2 border-primary/20">
                <tr>
                  <td colSpan={2} />
                  {gorSutun('okunan_deger') && <td />}
                  {gorSutun('malzeme_kodu') && <td />}
                  {gorSutun('malzeme_adi') && (
                    <td className="px-3 py-2 text-xs font-bold text-right">TOPLAM</td>
                  )}
                  {gorSutun('birim_fiyat') && <td />}
                  {gorSutun('birim') && <td />}
                  {gorSutun('miktar') && <td />}
                  {gorSutun('ilerleme') && <td />}
                  {gorSutun('kalan') && (
                    <td className="px-3 py-2 text-left text-sm font-bold text-amber-600 tabular-nums">
                      {kesifler.reduce((t, k) => { const m = k.kapsayici ? (k._hesaplananMiktar ?? k.miktar ?? 0) : (k.miktar || 0); const i = k.kapsayici ? (k._hesaplananIlerleme ?? k.ilerleme ?? 0) : (k.ilerleme || 0); return t + Math.max(m - i, 0) * (k.birim_fiyat || 0) }, 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                    </td>
                  )}
                  {gorSutun('toplam_tutar') && (
                    <td className="px-3 py-2 text-left text-sm font-bold text-primary tabular-nums">
                      {kesifler.reduce((t, k) => { const m = k.kapsayici ? (k._hesaplananMiktar ?? k.miktar ?? 0) : (k.miktar || 0); return t + m * (k.birim_fiyat || 0) }, 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                    </td>
                  )}
                  {gorSutun('alinan_miktar') && <td />}
                  {gorSutun('durum') && <td />}
                  {gorSutun('depo') && <td />}
                  {gorSutun('notlar') && <td />}
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

    </div>
  )
}
