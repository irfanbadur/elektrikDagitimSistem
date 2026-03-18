import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, Search, Package, Check, Clock, X, Columns3, ChevronDown, ChevronUp } from 'lucide-react'
import { useProjeKesif, useProjeKesifEkle, useProjeKesifGuncelle, useProjeKesifSil, useProjeKesifOzet } from '@/hooks/useProjeKesif'
import { useDepoKatalog } from '@/hooks/useDepoKatalog'
import { cn } from '@/lib/utils'

const DURUM_MAP = {
  planli: { label: 'Planli', renk: 'bg-slate-100 text-slate-700', icon: Clock },
  depoda_var: { label: 'Depoda Var', renk: 'bg-blue-100 text-blue-700', icon: Package },
  alindi: { label: 'Bono ile Alindi', renk: 'bg-emerald-100 text-emerald-700', icon: Check },
  sahaya_verildi: { label: 'Sahaya Verildi', renk: 'bg-purple-100 text-purple-700', icon: Check },
}

const TUM_SUTUNLAR = [
  { key: 'poz_no',       label: 'Poz No',        varsayilan: true  },
  { key: 'malzeme_kodu', label: 'Malzeme Kodu',  varsayilan: true  },
  { key: 'malzeme_adi',  label: 'Malzeme Adı',   varsayilan: true,  zorunlu: true },
  { key: 'birim',        label: 'Birim',          varsayilan: true  },
  { key: 'miktar',       label: 'Miktar',         varsayilan: true  },
  { key: 'birim_fiyat',  label: 'Birim Fiyat',   varsayilan: false },
  { key: 'toplam_tutar', label: 'Toplam Tutar',  varsayilan: false },
  { key: 'alinan_miktar',label: 'Alınan Miktar', varsayilan: false },
  { key: 'durum',        label: 'Durum',          varsayilan: true  },
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

  const toggleSec = (item) => {
    setSecilen(prev =>
      prev.find(s => s.id === item.id)
        ? prev.filter(s => s.id !== item.id)
        : [...prev, item]
    )
  }

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
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Malzeme adi veya poz ara..."
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
              autoFocus
            />
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
                {katalog.slice(0, 100).map((item) => {
                  const secili = secilen.find(s => s.id === item.id)
                  return (
                    <tr
                      key={item.id}
                      onClick={() => toggleSec(item)}
                      className={cn('border-b border-input/50 cursor-pointer transition-colors', secili ? 'bg-primary/5' : 'hover:bg-muted/30')}
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

function KesifSatiri({ kalem: k, durum, onGuncelle, onDurumDegistir, onSil, gorSutun }) {
  return (
    <tr className="border-b border-input/50 hover:bg-muted/30 transition-colors">
      {gorSutun('poz_no') && (
        <td className="px-3 py-2 font-mono text-xs text-blue-600">{k.poz_no || '-'}</td>
      )}
      {gorSutun('malzeme_kodu') && (
        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{k.malzeme_kodu || '-'}</td>
      )}
      {gorSutun('malzeme_adi') && (
        <td className="px-3 py-2 text-xs font-medium">{k.malzeme_adi}</td>
      )}
      {gorSutun('birim') && (
        <td className="px-3 py-2 text-xs text-muted-foreground">{k.birim}</td>
      )}
      {gorSutun('miktar') && (
        <td className="px-3 py-2 text-left text-xs tabular-nums">
          <DuzenlenebilirHucre deger={k.miktar || 0} onKaydet={(v) => onGuncelle({ miktar: v })} />
        </td>
      )}
      {gorSutun('birim_fiyat') && (
        <td className="px-3 py-2 text-left text-xs tabular-nums">
          <DuzenlenebilirHucre deger={k.birim_fiyat || 0} onKaydet={(v) => onGuncelle({ birim_fiyat: v })} />
        </td>
      )}
      {gorSutun('toplam_tutar') && (
        <td className="px-3 py-2 text-right text-xs tabular-nums font-medium">
          {((k.miktar || 0) * (k.birim_fiyat || 0)).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
        </td>
      )}
      {gorSutun('alinan_miktar') && (
        <td className="px-3 py-2 text-center text-xs tabular-nums">
          {k.alinan_miktar
            ? <span className="font-medium text-emerald-600">{k.alinan_miktar}</span>
            : <span className="text-muted-foreground">-</span>
          }
        </td>
      )}
      {gorSutun('durum') && (
        <td className="px-3 py-2">
          <select
            value={k.durum}
            onChange={(e) => onDurumDegistir(e.target.value)}
            className={cn('rounded-full px-2 py-0.5 text-xs font-medium border-0 cursor-pointer', durum.renk)}
          >
            {Object.entries(DURUM_MAP).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </td>
      )}
      {gorSutun('notlar') && (
        <td className="px-3 py-2 text-xs max-w-[150px]">
          <DuzenlenebilirHucre deger={k.notlar || ''} onKaydet={(v) => onGuncelle({ notlar: v })} type="text" />
        </td>
      )}
      <td className="px-3 py-2 text-right">
        <button
          onClick={onSil}
          className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
          title="Sil"
        >
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

  const handleSec = (item) => {
    setForm({
      ...form,
      malzeme_kodu: item.malzeme_kodu || '',
      poz_no: item.poz_birlesik || '',
      malzeme_adi: item.malzeme_cinsi || item.malzeme_tanimi_sap || '',
      birim: item.olcu || 'Ad',
    })
    setArama(item.malzeme_cinsi || item.malzeme_tanimi_sap || '')
    setSecildi(true)
    setDropdownAcik(false)
  }

  return (
    <tr className="border-b border-input bg-primary/5">
      {gorSutun('poz_no') && (
        <td className="px-3 py-2">
          <input value={form.poz_no} readOnly tabIndex={-1} placeholder="Poz no" className="w-full rounded border border-input bg-muted/50 px-2 py-1 text-xs text-muted-foreground" />
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
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                value={arama}
                onChange={handleAramaChange}
                onFocus={() => { if (arama.length >= 2 && !secildi) setDropdownAcik(true) }}
                placeholder="Malzeme ara (min 2 harf)..."
                className="w-full rounded border border-input bg-background py-1 pl-7 pr-2 text-xs focus:border-primary focus:outline-none"
                autoFocus
              />
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
                      {sonuclar.slice(0, 50).map((item) => (
                        <tr
                          key={item.id}
                          onClick={() => handleSec(item)}
                          className="cursor-pointer border-b border-input/30 hover:bg-primary/5 transition-colors"
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
      {gorSutun('birim_fiyat') && (
        <td className="px-3 py-2">
          <input type="number" value={form.birim_fiyat} onChange={e => setForm({ ...form, birim_fiyat: e.target.value })} placeholder="0" className="w-20 rounded border border-input bg-background px-2 py-1 text-xs" />
        </td>
      )}
      {gorSutun('toplam_tutar') && <td className="px-3 py-2 text-xs text-muted-foreground">-</td>}
      {gorSutun('alinan_miktar') && <td className="px-3 py-2 text-xs text-muted-foreground">-</td>}
      {gorSutun('durum') && <td className="px-3 py-2 text-xs text-muted-foreground">Planli</td>}
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
  const { data: kesifler, isLoading } = useProjeKesif(projeId)
  const ekle = useProjeKesifEkle(projeId)
  const guncelle = useProjeKesifGuncelle(projeId)
  const sil = useProjeKesifSil(projeId)

  const [yeniSatir, setYeniSatir] = useState(false)
  const [katalogAcik, setKatalogAcik] = useState(false)

  const [gorunurSutunlar, setGorunurSutunlar] = useState(() => {
    try {
      const saved = localStorage.getItem('proje_kesif_sutunlar')
      if (saved) return JSON.parse(saved)
    } catch {}
    return TUM_SUTUNLAR.filter(s => s.varsayilan).map(s => s.key)
  })

  useEffect(() => {
    try { localStorage.setItem('proje_kesif_sutunlar', JSON.stringify(gorunurSutunlar)) } catch {}
  }, [gorunurSutunlar])

  const gorSutun = (key) => gorunurSutunlar.includes(key)
  const toplamSutun = gorunurSutunlar.length + 1 // +1 for actions

  const handleKaydet = async (data) => {
    await ekle.mutateAsync(data)
    setYeniSatir(false)
  }

  const handleKatalogSec = async (kalemler) => {
    for (const k of kalemler) {
      await ekle.mutateAsync(k)
    }
    setKatalogAcik(false)
  }

  const handleDurumDegistir = (id, kalem, yeniDurum) => {
    guncelle.mutate({ id, ...kalem, durum: yeniDurum })
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Proje-Kesif Listesi</h3>
        <div className="flex gap-2">
          <SutunSecici gorunurSutunlar={gorunurSutunlar} setGorunurSutunlar={setGorunurSutunlar} />
          <button onClick={() => setKatalogAcik(true)} className="flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm font-medium hover:bg-muted">
            <Search className="h-4 w-4" />
            Katalogdan Sec
          </button>
          <button onClick={() => setYeniSatir(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Manuel Ekle
          </button>
        </div>
      </div>

      <KesifOzet projeId={projeId} />

      <div className="overflow-hidden rounded-lg border border-input bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-input bg-muted/50">
                {gorSutun('poz_no') && <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Poz No</th>}
                {gorSutun('malzeme_kodu') && <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Malzeme Kodu</th>}
                {gorSutun('malzeme_adi') && <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Malzeme Adı</th>}
                {gorSutun('birim') && <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Birim</th>}
                {gorSutun('miktar') && <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Miktar</th>}
                {gorSutun('birim_fiyat') && <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Birim Fiyat</th>}
                {gorSutun('toplam_tutar') && <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">Toplam Tutar</th>}
                {gorSutun('alinan_miktar') && <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground">Alınan Miktar</th>}
                {gorSutun('durum') && <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Durum</th>}
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
                kesifler?.map((k) => {
                  const durum = DURUM_MAP[k.durum] || DURUM_MAP.planli
                  return (
                    <KesifSatiri
                      key={k.id}
                      kalem={k}
                      durum={durum}
                      gorSutun={gorSutun}
                      onGuncelle={(data) => guncelle.mutate({ id: k.id, ...k, ...data })}
                      onDurumDegistir={(d) => handleDurumDegistir(k.id, k, d)}
                      onSil={() => sil.mutate(k.id)}
                    />
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {katalogAcik && <KatalogSecici onSec={handleKatalogSec} onKapat={() => setKatalogAcik(false)} />}
    </div>
  )
}
