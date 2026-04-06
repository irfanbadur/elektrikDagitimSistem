import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Save, ArrowLeft, Loader2, FileText, PenLine, ArrowRight, Search } from 'lucide-react'
import api from '@/api/client'
import {
  useMalzeme,
  useMalzemeOlustur,
  useMalzemeGuncelle,
} from '@/hooks/useMalzeme'
import { useDepolar } from '@/hooks/useDepolar'
import { MALZEME_KATEGORILERI } from '@/utils/constants'
import { cn } from '@/lib/utils'
import EvrakGiris from './EvrakGiris'

const BIRIMLER = [
  { value: 'metre', label: 'Metre' },
  { value: 'adet', label: 'Adet' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'takim', label: 'Takim' },
  { value: 'kutu', label: 'Kutu' },
  { value: 'top', label: 'Top' },
]

const bosForm = {
  malzeme_kodu: '',
  malzeme_adi: '',
  kategori: '',
  birim: 'adet',
  stok_miktari: '',
  kritik_seviye: '',
  birim_fiyat: '',
  depo_konumu: '',
  notlar: '',
}

const TABS = [
  { key: 'evrak', label: 'Evrak ile', icon: FileText },
  { key: 'manuel', label: 'Manuel', icon: PenLine },
]

// Manuel malzeme giris formu
function ManuelGiris() {
  const navigate = useNavigate()
  const malzemeOlustur = useMalzemeOlustur()
  const [form, setForm] = useState(bosForm)
  const [hatalar, setHatalar] = useState({})

  // Katalog arama autocomplete
  const [katalogSonuclar, setKatalogSonuclar] = useState([])
  const [katalogAcik, setKatalogAcik] = useState(false)
  const [katalogAraniyor, setKatalogAraniyor] = useState(false)
  const aramaTimer = useRef(null)
  const katalogRef = useRef(null)
  const inputRef = useRef(null)

  const katalogAra = useCallback((text) => {
    if (aramaTimer.current) clearTimeout(aramaTimer.current)
    if (!text || text.length < 2) { setKatalogSonuclar([]); setKatalogAcik(false); return }
    setKatalogAraniyor(true)
    aramaTimer.current = setTimeout(async () => {
      try {
        const res = await api.get('/malzeme-katalog', { params: { arama: text } })
        setKatalogSonuclar(res?.data || [])
        setKatalogAcik(true)
      } catch { setKatalogSonuclar([]) }
      setKatalogAraniyor(false)
    }, 300)
  }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (katalogRef.current && !katalogRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) setKatalogAcik(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => { document.removeEventListener('mousedown', handleClick); if (aramaTimer.current) clearTimeout(aramaTimer.current) }
  }, [])

  const handleKatalogSec = (item) => {
    setForm(prev => ({
      ...prev,
      malzeme_kodu: item.malzeme_kodu || prev.malzeme_kodu,
      malzeme_adi: item.malzeme_cinsi || item.malzeme_tanimi_sap || prev.malzeme_adi,
      birim: (item.olcu || 'adet').toLowerCase(),
    }))
    setKatalogAcik(false)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (hatalar[name]) {
      setHatalar((prev) => ({ ...prev, [name]: '' }))
    }
    // Malzeme adı veya kodu yazıldığında katalogda ara
    if (name === 'malzeme_adi' || name === 'malzeme_kodu') {
      katalogAra(value)
    }
  }

  const dogrula = () => {
    const yeniHatalar = {}
    if (!form.malzeme_adi.trim()) yeniHatalar.malzeme_adi = 'Malzeme adi zorunludur'
    if (!form.malzeme_kodu.trim()) yeniHatalar.malzeme_kodu = 'Malzeme kodu zorunludur'
    if (!form.kategori) yeniHatalar.kategori = 'Kategori secimi zorunludur'
    setHatalar(yeniHatalar)
    return Object.keys(yeniHatalar).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!dogrula()) return
    const veri = {
      ...form,
      stok_miktari: form.stok_miktari !== '' ? Number(form.stok_miktari) : 0,
      kritik_seviye: form.kritik_seviye !== '' ? Number(form.kritik_seviye) : 0,
      birim_fiyat: form.birim_fiyat !== '' ? Number(form.birim_fiyat) : 0,
    }
    try {
      await malzemeOlustur.mutateAsync(veri)
      navigate('/depo')
    } catch { /* hook yonetir */ }
  }

  const kaydediliyor = malzemeOlustur.isPending

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl rounded-lg border border-input bg-card shadow-sm" style={{ padding: '24px 32px' }}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Malzeme Kodu <span className="text-red-500">*</span>
          </label>
          <input type="text" name="malzeme_kodu" value={form.malzeme_kodu} onChange={handleChange} placeholder="orn: KBL-001"
            className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${hatalar.malzeme_kodu ? 'border-red-500' : 'border-input'} bg-background`} />
          {hatalar.malzeme_kodu && <p className="mt-1 text-xs text-red-500">{hatalar.malzeme_kodu}</p>}
        </div>
        <div className="relative">
          <label className="mb-1.5 block text-sm font-medium">
            Malzeme Adi <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input ref={inputRef} type="text" name="malzeme_adi" value={form.malzeme_adi} onChange={handleChange}
              onFocus={() => { if (form.malzeme_adi.length >= 2) katalogAra(form.malzeme_adi) }}
              placeholder="Katalogdan arayın veya serbest girin..."
              className={`w-full rounded-md border pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${hatalar.malzeme_adi ? 'border-red-500' : 'border-input'} bg-background`} />
          </div>
          {katalogAcik && (katalogAraniyor || katalogSonuclar.length > 0) && (
            <div ref={katalogRef} className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-white shadow-xl ring-1 ring-black/5">
              {katalogAraniyor ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                  <Loader2 className="inline h-3 w-3 animate-spin mr-1" />Aranıyor...
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm">
                    <tr className="border-b border-border">
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Kod</th>
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Malzeme</th>
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">SAP Tanım</th>
                      <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">Birim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {katalogSonuclar.slice(0, 20).map(item => (
                      <tr key={item.id} onMouseDown={() => handleKatalogSec(item)}
                        className="cursor-pointer border-b border-border/30 hover:bg-primary/5 transition-colors">
                        <td className="px-2 py-1.5 font-mono text-blue-600 whitespace-nowrap">{item.malzeme_kodu || '-'}</td>
                        <td className="px-2 py-1.5">{item.malzeme_cinsi || '-'}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{item.malzeme_tanimi_sap || '-'}</td>
                        <td className="px-2 py-1.5 text-center text-muted-foreground">{item.olcu || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {hatalar.malzeme_adi && <p className="mt-1 text-xs text-red-500">{hatalar.malzeme_adi}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Kategori <span className="text-red-500">*</span>
          </label>
          <select name="kategori" value={form.kategori} onChange={handleChange}
            className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${hatalar.kategori ? 'border-red-500' : 'border-input'} bg-background`}>
            <option value="">Kategori secin</option>
            {Object.entries(MALZEME_KATEGORILERI).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          {hatalar.kategori && <p className="mt-1 text-xs text-red-500">{hatalar.kategori}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Birim</label>
          <select name="birim" value={form.birim} onChange={handleChange}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            {BIRIMLER.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Stok Miktari</label>
          <input type="number" name="stok_miktari" value={form.stok_miktari} onChange={handleChange} min="0" step="0.01" placeholder="0"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Kritik Seviye</label>
          <input type="number" name="kritik_seviye" value={form.kritik_seviye} onChange={handleChange} min="0" step="0.01" placeholder="0"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <p className="mt-1 text-xs text-muted-foreground">Stok bu seviyenin altina dustugunde uyari verilir</p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Birim Fiyat (TL)</label>
          <input type="number" name="birim_fiyat" value={form.birim_fiyat} onChange={handleChange} min="0" step="0.01" placeholder="0.00"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Depo Konumu</label>
          <input type="text" name="depo_konumu" value={form.depo_konumu} onChange={handleChange} placeholder="orn: A-3-Raf-2"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium">Notlar</label>
          <textarea name="notlar" value={form.notlar} onChange={handleChange} rows={3} placeholder="Ek aciklama veya not..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3 border-t border-input pt-4">
        <button type="button" onClick={() => navigate('/depo')}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted">Iptal</button>
        <button type="submit" disabled={kaydediliyor}
          className="flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {kaydediliyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Kaydet
        </button>
      </div>
    </form>
  )
}

// Duzenleme modu (sadece manuel form)
function MalzemeDuzenleForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { data: mevcutMalzeme, isLoading: yukleniyor } = useMalzeme(id, { enabled: true })
  const malzemeGuncelle = useMalzemeGuncelle()
  const [form, setForm] = useState(bosForm)
  const [hatalar, setHatalar] = useState({})

  useEffect(() => {
    if (mevcutMalzeme) {
      setForm({
        malzeme_kodu: mevcutMalzeme.malzeme_kodu || '',
        malzeme_adi: mevcutMalzeme.malzeme_adi || '',
        kategori: mevcutMalzeme.kategori || '',
        birim: mevcutMalzeme.birim || 'adet',
        stok_miktari: mevcutMalzeme.stok_miktari ?? '',
        kritik_seviye: mevcutMalzeme.kritik_seviye ?? '',
        birim_fiyat: mevcutMalzeme.birim_fiyat ?? '',
        depo_konumu: mevcutMalzeme.depo_konumu || '',
        notlar: mevcutMalzeme.notlar || '',
      })
    }
  }, [mevcutMalzeme])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (hatalar[name]) setHatalar((prev) => ({ ...prev, [name]: '' }))
  }

  const dogrula = () => {
    const yeniHatalar = {}
    if (!form.malzeme_adi.trim()) yeniHatalar.malzeme_adi = 'Malzeme adi zorunludur'
    if (!form.malzeme_kodu.trim()) yeniHatalar.malzeme_kodu = 'Malzeme kodu zorunludur'
    if (!form.kategori) yeniHatalar.kategori = 'Kategori secimi zorunludur'
    setHatalar(yeniHatalar)
    return Object.keys(yeniHatalar).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!dogrula()) return
    const veri = {
      ...form,
      stok_miktari: form.stok_miktari !== '' ? Number(form.stok_miktari) : 0,
      kritik_seviye: form.kritik_seviye !== '' ? Number(form.kritik_seviye) : 0,
      birim_fiyat: form.birim_fiyat !== '' ? Number(form.birim_fiyat) : 0,
    }
    try {
      await malzemeGuncelle.mutateAsync({ id: Number(id), ...veri })
      navigate('/depo')
    } catch { /* hook yonetir */ }
  }

  const kaydediliyor = malzemeGuncelle.isPending

  if (yukleniyor) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-96 w-full rounded" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <button onClick={() => navigate('/depo')}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Depoya Don
        </button>
        <h1 className="text-2xl font-bold">Malzeme Duzenle</h1>
        <p className="mt-1 text-sm text-muted-foreground">Malzeme bilgilerini guncelleyin</p>
      </div>
      <form onSubmit={handleSubmit} className="mx-auto max-w-4xl rounded-lg border border-input bg-card shadow-sm" style={{ padding: '24px 32px' }}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Malzeme Kodu <span className="text-red-500">*</span></label>
            <input type="text" name="malzeme_kodu" value={form.malzeme_kodu} onChange={handleChange} placeholder="orn: KBL-001"
              className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${hatalar.malzeme_kodu ? 'border-red-500' : 'border-input'} bg-background`} />
            {hatalar.malzeme_kodu && <p className="mt-1 text-xs text-red-500">{hatalar.malzeme_kodu}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Malzeme Adi <span className="text-red-500">*</span></label>
            <input type="text" name="malzeme_adi" value={form.malzeme_adi} onChange={handleChange} placeholder="Malzeme adini girin"
              className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${hatalar.malzeme_adi ? 'border-red-500' : 'border-input'} bg-background`} />
            {hatalar.malzeme_adi && <p className="mt-1 text-xs text-red-500">{hatalar.malzeme_adi}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Kategori <span className="text-red-500">*</span></label>
            <select name="kategori" value={form.kategori} onChange={handleChange}
              className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${hatalar.kategori ? 'border-red-500' : 'border-input'} bg-background`}>
              <option value="">Kategori secin</option>
              {Object.entries(MALZEME_KATEGORILERI).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            {hatalar.kategori && <p className="mt-1 text-xs text-red-500">{hatalar.kategori}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Birim</label>
            <select name="birim" value={form.birim} onChange={handleChange}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {BIRIMLER.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Stok Miktari</label>
            <input type="number" name="stok_miktari" value={form.stok_miktari} onChange={handleChange} min="0" step="0.01" placeholder="0"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Kritik Seviye</label>
            <input type="number" name="kritik_seviye" value={form.kritik_seviye} onChange={handleChange} min="0" step="0.01" placeholder="0"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Birim Fiyat (TL)</label>
            <input type="number" name="birim_fiyat" value={form.birim_fiyat} onChange={handleChange} min="0" step="0.01" placeholder="0.00"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Depo Konumu</label>
            <input type="text" name="depo_konumu" value={form.depo_konumu} onChange={handleChange} placeholder="orn: A-3-Raf-2"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">Notlar</label>
            <textarea name="notlar" value={form.notlar} onChange={handleChange} rows={3} placeholder="Ek aciklama veya not..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-input pt-4">
          <button type="button" onClick={() => navigate('/depo')}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted">Iptal</button>
          <button type="submit" disabled={kaydediliyor}
            className="flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {kaydediliyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guncelle
          </button>
        </div>
      </form>
    </div>
  )
}

// Sabit taraflar (DB dışı)
const SABIT_TARAFLAR = [
  { key: 'ambar', label: 'Ambar (Kurum)' },
  { key: 'piyasa', label: 'Piyasa' },
]

function tarafListesiOlustur(depolar) {
  const depoSecenekleri = (depolar || []).map(d => ({
    key: `depo_${d.id}`,
    label: d.depo_adi,
    depoId: d.id,
    depoTipi: d.depo_tipi,
  }))
  const sabitSecenekler = SABIT_TARAFLAR.map(s => ({
    ...s,
    depoId: null,
    depoTipi: null,
  }))
  return [...depoSecenekleri, ...sabitSecenekler]
}

function tarafLabel(secenekler, key, firmaAdi) {
  if (!key) return ''
  if (key === 'piyasa') return firmaAdi || 'Piyasa'
  return secenekler.find(s => s.key === key)?.label || key
}

function HareketYonSecici({ veren, setVeren, alan, setAlan, firmaAdi, setFirmaAdi, depolar }) {
  const secenekler = tarafListesiOlustur(depolar)
  const piyasaSecili = veren === 'piyasa' || alan === 'piyasa'
  const verenLabel = tarafLabel(secenekler, veren, firmaAdi)
  const alanLabel = tarafLabel(secenekler, alan, firmaAdi)
  const secimTamam = veren && alan && veren !== alan

  return (
    <div className="space-y-4 rounded-lg border border-input bg-card p-4 shadow-sm">
      <div className="flex items-end gap-3">
        {/* Veren */}
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium">Veren</label>
          <select
            value={veren}
            onChange={e => {
              setVeren(e.target.value)
              if (e.target.value === alan) setAlan('')
            }}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">Secin...</option>
            {secenekler.map(s => (
              <option key={s.key} value={s.key} disabled={s.key === alan}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Ok */}
        <div className="flex h-[42px] items-center">
          <ArrowRight className={cn(
            'h-5 w-5 transition-colors',
            secimTamam ? 'text-primary' : 'text-muted-foreground/40'
          )} />
        </div>

        {/* Alan */}
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium">Alan</label>
          <select
            value={alan}
            onChange={e => {
              setAlan(e.target.value)
              if (e.target.value === veren) setVeren('')
            }}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">Secin...</option>
            {secenekler.map(s => (
              <option key={s.key} value={s.key} disabled={s.key === veren}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Piyasa seçiliyse firma adı */}
      {piyasaSecili && (
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Firma Adi</label>
          <input
            value={firmaAdi}
            onChange={e => setFirmaAdi(e.target.value)}
            placeholder="Tedarikci / alici firma adi"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
      )}

      {/* Ozet */}
      {secimTamam && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
          <span className="font-semibold">{verenLabel}</span>
          <ArrowRight className="h-4 w-4 text-primary" />
          <span className="font-semibold">{alanLabel}</span>
        </div>
      )}
    </div>
  )
}

export default function MalzemeForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const duzenlemeModu = Boolean(id)

  // Duzenleme modunda direkt form goster
  if (duzenlemeModu) return <MalzemeDuzenleForm />

  const { data: depolar } = useDepolar()
  const aktifTab = searchParams.get('tab') || 'evrak'
  const [veren, setVeren] = useState('')
  const [alan, setAlan] = useState('')
  const [firmaAdi, setFirmaAdi] = useState('')

  const handleTabDegistir = (key) => {
    setSearchParams({ tab: key })
  }

  const secimTamam = veren && alan && veren !== alan
  const secenekler = tarafListesiOlustur(depolar)

  // Hareket yonunu otomatik belirle
  // Ana depo alan ise giris, veren ise cikis, ikisi de depo ise transfer
  const verenSecenek = secenekler.find(s => s.key === veren)
  const alanSecenek = secenekler.find(s => s.key === alan)
  let hareketYon = 'giris'
  if (verenSecenek?.depoTipi === 'ana_depo') hareketYon = 'cikis'
  else if (alanSecenek?.depoTipi === 'ana_depo') hareketYon = 'giris'
  else if (verenSecenek?.depoId && alanSecenek?.depoId) hareketYon = 'transfer'

  // Taraf etiketleri
  const verenAdi = tarafLabel(secenekler, veren, firmaAdi)
  const alanAdi = tarafLabel(secenekler, alan, firmaAdi)

  // Karsi taraf: ana depo olmayan taraf
  const karsiTarafKey = hareketYon === 'cikis' ? alan : veren
  const karsiTarafAdi = tarafLabel(secenekler, karsiTarafKey, firmaAdi)
  const karsiTarafTipi = karsiTarafKey?.startsWith('depo_') ? 'depo' : karsiTarafKey || ''

  // Depo ID'leri (server'a gonderilecek)
  const verenDepoId = verenSecenek?.depoId || null
  const alanDepoId = alanSecenek?.depoId || null

  return (
    <div>
      <div className="mb-6">
        <button onClick={() => navigate('/depo')}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Depoya Don
        </button>
        <h1 className="text-2xl font-bold">Yeni Hareket</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mal girisi veya cikisi icin hareket olusturun
        </p>
      </div>

      {/* Veren → Alan Secimi */}
      <HareketYonSecici
        veren={veren} setVeren={setVeren}
        alan={alan} setAlan={setAlan}
        firmaAdi={firmaAdi} setFirmaAdi={setFirmaAdi}
        depolar={depolar}
      />

      {/* Secim tamam ise malzeme giris yontemi */}
      {secimTamam && (
        <>
          {/* Tab Bar */}
          <div className="mt-6 mb-4 flex gap-1 border-b border-border">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const aktif = aktifTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabDegistir(tab.key)}
                  className={cn(
                    'flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors',
                    aktif
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Tab Icerik */}
          {aktifTab === 'evrak' && (
            <div className="rounded-lg border border-input bg-card p-6 shadow-sm">
              <EvrakGiris
                onBasarili={() => navigate('/depo')}
                hareketYon={hareketYon}
                karsiTarafAdi={karsiTarafAdi}
                karsiTarafTipi={karsiTarafTipi}
                kaynakDepoId={verenDepoId}
                hedefDepoId={alanDepoId}
                verenAdi={verenAdi}
                alanAdi={alanAdi}
              />
            </div>
          )}
          {aktifTab === 'manuel' && <ManuelGiris />}
        </>
      )}
    </div>
  )
}
