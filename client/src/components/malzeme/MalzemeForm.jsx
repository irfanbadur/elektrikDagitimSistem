import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Save, ArrowLeft, Loader2, ArrowRight, Plus, Trash2, Search, Image, X } from 'lucide-react'
import useDropdownNav from '@/hooks/useDropdownNav'
import { useMalzeme, useMalzemeOlustur, useMalzemeGuncelle } from '@/hooks/useMalzeme'
import { useDepolar } from '@/hooks/useDepolar'
import { useHareketKaydet } from '@/hooks/useHareketler'
import { MALZEME_KATEGORILERI } from '@/utils/constants'
import api from '@/api/client'
import { cn } from '@/lib/utils'

const BIRIMLER = [
  { value: 'metre', label: 'Metre' },
  { value: 'adet', label: 'Adet' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'takim', label: 'Takim' },
  { value: 'kutu', label: 'Kutu' },
  { value: 'top', label: 'Top' },
]

// ─── İrsaliye bilgileri boş form ───
const bosIrsaliye = {
  irsaliye_no: '', irsaliye_tarihi: '', sevk_tarihi: '', irsaliye_zamani: '',
  sevk_zamani: '', referans_belge: '', irsaliye_tipi: '', tasiyici_firma: '', arac_plakasi: '',
}

const bosBono = {
  belge_no: '', belge_tarihi: '', giris_tarihi: '', teslim_fisi_no: '',
  tutanak_no: '', teslim_eden: '', teslim_alan: '',
}

const bosAmbar = {
  kocan_etiketi: '', kocan_no: '', teslim_eden: '', teslim_alan: '', fis_no: '',
}

// ─── Taraf seçenekleri ───
const SABIT_TARAFLAR = [
  { key: 'ambar', label: 'Ambar (Kurum)' },
  { key: 'piyasa', label: 'Piyasa' },
]

function tarafListesiOlustur(depolar) {
  const depoSec = (depolar || []).map(d => ({ key: `depo_${d.id}`, label: d.depo_adi, depoId: d.id, depoTipi: d.depo_tipi }))
  return [...depoSec, ...SABIT_TARAFLAR.map(s => ({ ...s, depoId: null, depoTipi: null }))]
}

function tarafLabel(secenekler, key, firma) {
  if (!key) return ''
  if (key === 'piyasa') return firma || 'Piyasa'
  return secenekler.find(s => s.key === key)?.label || key
}

// ─── Satır: malzeme adı ile katalog arama ───
function MalzemeSatiri({ kalem, index, onDegistir, onSil, verenTipi, verenLabel }) {
  const [katalogAcik, setKatalogAcik] = useState(false)
  const [katalogSonuc, setKatalogSonuc] = useState([])
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
        const r = await api.get('/malzeme-katalog/stoklu-ara', { params: { arama: text, veren_tipi: verenTipi || '' } })
        const liste = Array.isArray(r) ? r : (r?.data || [])
        setKatalogSonuc(liste)
        setKatalogAcik(liste.length > 0)
      } catch { setKatalogSonuc([]) }
      setAraniyor(false)
    }, 300)
  }

  const sec = useCallback((item) => {
    const stoklar = item.depo_stoklar || []
    const ilkDepo = stoklar[0] || null
    onDegistir(index, {
      ...kalem,
      malzeme_kodu: item.malzeme_kodu || kalem.malzeme_kodu,
      malzeme_adi: item.malzeme_cinsi || item.malzeme_tanimi_sap || kalem.malzeme_adi,
      birim: item.olcu || kalem.birim,
      poz_no: item.poz_birlesik || kalem.poz_no,
      depo_stoklar: stoklar,
      secili_depo_id: ilkDepo?.depo_id || null,
      secili_depo_adi: ilkDepo?.depo_adi || '',
      depo_miktar: ilkDepo?.miktar || 0,
    })
    setKatalogAcik(false)
  }, [index, kalem, onDegistir])

  const gosterilen = katalogSonuc.slice(0, 15)
  const { seciliIdx, setSeciliIdx, handleKeyDown } = useDropdownNav(gosterilen, sec, () => setKatalogAcik(false))

  // Arama değiştiğinde seçimi sıfırla
  useEffect(() => { setSeciliIdx(-1) }, [katalogSonuc, setSeciliIdx])

  const inputCls = 'w-full rounded border border-transparent bg-transparent px-2 py-1.5 text-xs hover:border-input focus:border-primary focus:outline-none'

  return (
    <tr className="border-b border-input/50 group hover:bg-muted/20 transition-colors">
      <td className="w-8 px-2 py-1.5 text-center text-xs text-muted-foreground">{index + 1}</td>
      <td className="w-24 px-1 py-1.5">
        <input value={kalem.malzeme_kodu || ''} onChange={e => onDegistir(index, { ...kalem, malzeme_kodu: e.target.value })} className={inputCls} placeholder="-" />
      </td>
      <td className="px-1 py-1.5 relative" style={{ overflow: 'visible' }}>
        <input ref={inputRef} value={kalem.malzeme_adi || ''} onChange={e => { onDegistir(index, { ...kalem, malzeme_adi: e.target.value }); ara(e.target.value) }}
          onFocus={() => { if ((kalem.malzeme_adi || '').length >= 2) ara(kalem.malzeme_adi) }}
          onKeyDown={katalogAcik ? handleKeyDown : undefined}
          className={inputCls} placeholder="Malzeme adı..." />
        {katalogAcik && (araniyor || gosterilen.length > 0) && (
          <div ref={dropRef} className="absolute left-0 top-full z-50 mt-1 max-h-48 w-[650px] overflow-y-auto rounded-lg border border-border bg-white shadow-xl ring-1 ring-black/5">
            {araniyor ? <div className="px-3 py-3 text-center text-xs text-muted-foreground"><Loader2 className="inline h-3 w-3 animate-spin mr-1" />Aranıyor...</div> : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/90"><tr className="border-b border-border">
                  <th className="px-2 py-1 text-left font-medium text-muted-foreground">Kod</th>
                  <th className="px-2 py-1 text-left font-medium text-muted-foreground">Malzeme</th>
                  <th className="px-2 py-1 text-center font-medium text-muted-foreground">Birim</th>
                  <th className="px-2 py-1 text-left font-medium text-muted-foreground">Depo</th>
                  <th className="px-2 py-1 text-right font-medium text-muted-foreground">Stok</th>
                </tr></thead>
                <tbody>{gosterilen.map((item, i) => (
                  <tr key={item.id} onMouseDown={() => sec(item)} className={cn('cursor-pointer border-b border-border/30 transition-colors', i === seciliIdx ? 'bg-primary/10' : 'hover:bg-primary/5')}>
                    <td className="px-2 py-1 font-mono text-blue-600">{item.malzeme_kodu || '-'}</td>
                    <td className="px-2 py-1">{item.malzeme_cinsi || item.malzeme_tanimi_sap || '-'}</td>
                    <td className="px-2 py-1 text-center text-muted-foreground">{item.olcu || '-'}</td>
                    <td className="px-2 py-1 text-muted-foreground">{(item.depo_stoklar || []).map(s => s.depo_adi).join(', ') || '-'}</td>
                    <td className="px-2 py-1 text-right font-semibold">{item.toplam_stok || 0}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        )}
      </td>
      <td className="w-16 px-1 py-1.5">
        <input value={kalem.birim || 'Ad'} onChange={e => onDegistir(index, { ...kalem, birim: e.target.value })} className={cn(inputCls, 'text-center w-14')} />
      </td>
      <td className="w-20 px-1 py-1.5">
        <input type="number" value={kalem.miktar || ''} onChange={e => onDegistir(index, { ...kalem, miktar: Number(e.target.value) || 0 })} className={cn(inputCls, 'text-center w-16')} />
      </td>
      {/* Veren Depo */}
      <td className="w-32 px-1 py-1.5">
        {verenTipi === 'ana_depo' ? (
          (kalem.depo_stoklar || []).length > 1 ? (
            <select value={kalem.secili_depo_id || ''} onChange={e => {
              const depoId = Number(e.target.value)
              const secilen = kalem.depo_stoklar.find(s => s.depo_id === depoId)
              onDegistir(index, { ...kalem, secili_depo_id: depoId, secili_depo_adi: secilen?.depo_adi || '', depo_miktar: secilen?.miktar || 0 })
            }} className="w-full rounded border border-input bg-background px-1 py-1 text-xs">
              {kalem.depo_stoklar.map(s => <option key={s.depo_id} value={s.depo_id}>{s.depo_adi} ({s.miktar})</option>)}
            </select>
          ) : (
            <span className="px-2 text-xs text-muted-foreground">{kalem.secili_depo_adi || '-'}</span>
          )
        ) : (
          <span className="px-2 text-xs text-muted-foreground">{verenLabel || '-'}</span>
        )}
      </td>
      {/* Depo Stok Miktarı */}
      <td className="w-16 px-1 py-1.5 text-center">
        {verenTipi === 'ana_depo' ? (
          <span className={cn('text-xs font-medium', (kalem.depo_miktar || 0) > 0 ? 'text-emerald-600' : 'text-muted-foreground')}>
            {kalem.depo_miktar || 0}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">----</span>
        )}
      </td>
      <td className="w-8 px-1 py-1.5 text-center">
        <button onClick={() => onSil(index)} className="rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-opacity">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
}

// ─── Ana Bileşen ───
export default function MalzemeForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const duzenlemeModu = Boolean(id)

  if (duzenlemeModu) return <MalzemeDuzenleForm />

  const { data: depolar } = useDepolar()
  const hareketKaydet = useHareketKaydet()

  // Taraf seçimi
  const [veren, setVeren] = useState('')
  const [alan, setAlan] = useState('')
  const [firmaAdi, setFirmaAdi] = useState('')

  // Belge bilgileri
  const [irsaliye, setIrsaliye] = useState(bosIrsaliye)
  const [bono, setBono] = useState(bosBono)
  const [ambar, setAmbar] = useState(bosAmbar)

  // Malzeme listesi
  const [kalemler, setKalemler] = useState([])

  // Belge dosyaları
  const [irsaliyeDosya, setIrsaliyeDosya] = useState(null)
  const [irsaliyeOnizleme, setIrsaliyeOnizleme] = useState(null)
  const [bonoDosya, setBonoDosya] = useState(null)
  const [bonoOnizleme, setBonoOnizleme] = useState(null)
  const [ambarDosya, setAmbarDosya] = useState(null)
  const [ambarOnizleme, setAmbarOnizleme] = useState(null)
  const irsaliyeRef = useRef(null)
  const bonoRef = useRef(null)
  const ambarRef = useRef(null)

  const secenekler = tarafListesiOlustur(depolar)
  const secimTamam = veren && alan && veren !== alan
  const piyasaSecili = veren === 'piyasa' || alan === 'piyasa'

  const verenSec = secenekler.find(s => s.key === veren)
  const alanSec = secenekler.find(s => s.key === alan)
  let hareketYon = 'giris'
  if (verenSec?.depoTipi === 'ana_depo') hareketYon = 'cikis'
  else if (alanSec?.depoTipi === 'ana_depo') hareketYon = 'giris'
  else if (verenSec?.depoId && alanSec?.depoId) hareketYon = 'transfer'

  const handleIrsaliyeDegistir = (e) => {
    const { name, value } = e.target
    setIrsaliye(prev => ({ ...prev, [name]: value }))
  }

  const handleBonoDegistir = (e) => {
    const { name, value } = e.target
    setBono(prev => ({ ...prev, [name]: value }))
  }

  const handleKalemDegistir = (idx, yeni) => setKalemler(prev => prev.map((k, i) => i === idx ? yeni : k))
  const handleKalemSil = (idx) => setKalemler(prev => prev.filter((_, i) => i !== idx))
  const handleKalemEkle = () => setKalemler(prev => [...prev, { _id: Date.now(), malzeme_kodu: '', malzeme_adi: '', birim: 'Ad', miktar: 0, poz_no: '' }])

  const handleBelgeSec = (e, tip) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      if (tip === 'irsaliye') { setIrsaliyeDosya(file); setIrsaliyeOnizleme(ev.target.result) }
      else if (tip === 'ambar') { setAmbarDosya(file); setAmbarOnizleme(ev.target.result) }
      else { setBonoDosya(file); setBonoOnizleme(ev.target.result) }
    }
    reader.readAsDataURL(file)
  }

  const handleAmbarDegistir = (e) => {
    const { name, value } = e.target
    setAmbar(prev => ({ ...prev, [name]: value }))
  }

  // Kaydet
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const handleKaydet = async () => {
    const gecerliKalemler = kalemler.filter(k => k.malzeme_adi?.trim())
    if (gecerliKalemler.length === 0) return
    setKaydediliyor(true)
    try {
      const formData = new FormData()
      const hareketData = {
        hareket_tipi: hareketYon,
        kaynak_depo_id: verenSec?.depoId || null,
        hedef_depo_id: alanSec?.depoId || null,
        irsaliye_bilgi: (irsaliye.irsaliye_no || irsaliye.irsaliye_tarihi) ? irsaliye : null,
        bono_bilgi: (bono.belge_no || bono.belge_tarihi) ? bono : null,
        ambar_bilgi: (ambar.kocan_no || ambar.fis_no) ? ambar : null,
        kalemler: gecerliKalemler.map((k, i) => ({
          sira_no: i + 1,
          malzeme_kodu: k.malzeme_kodu || null,
          malzeme_adi: k.malzeme_adi,
          birim: k.birim || 'Ad',
          miktar: k.miktar || 0,
          miktar_irsaliye: k.miktar || 0,
          poz_no: k.poz_no || null,
        })),
        teslim_eden: tarafLabel(secenekler, veren, firmaAdi),
        teslim_alan: tarafLabel(secenekler, alan, firmaAdi),
      }
      formData.append('hareket_data', JSON.stringify(hareketData))
      if (irsaliyeDosya) formData.append('irsaliye_dosyalari', irsaliyeDosya)
      if (bonoDosya) formData.append('bono_dosyalari', bonoDosya)

      const res = await fetch('/api/hareketler/kaydet', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Kaydetme hatası')
      navigate('/depo')
    } catch (err) {
      alert(err.message || 'Kaydetme hatası')
    } finally {
      setKaydediliyor(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <button onClick={() => navigate('/depo')} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Depoya Dön
        </button>
        <h1 className="text-2xl font-bold">Yeni Hareket</h1>
        <p className="mt-1 text-sm text-muted-foreground">İrsaliye belgesi ile malzeme girişi/çıkışı yapın</p>
      </div>

      {/* ─── Veren → Alan Seçimi ─── */}
      <div className="space-y-4 rounded-lg border border-input bg-card shadow-sm" style={{ padding: '24px 32px' }}>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-medium">Veren</label>
            <select value={veren} onChange={e => { setVeren(e.target.value); if (e.target.value === alan) setAlan('') }}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none">
              <option value="">Seçin...</option>
              {secenekler.map(s => <option key={s.key} value={s.key} disabled={s.key === alan}>{s.label}</option>)}
            </select>
          </div>
          <div className="flex h-[42px] items-center"><ArrowRight className={cn('h-5 w-5', secimTamam ? 'text-primary' : 'text-muted-foreground/40')} /></div>
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-medium">Alan</label>
            <select value={alan} onChange={e => { setAlan(e.target.value); if (e.target.value === veren) setVeren('') }}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none">
              <option value="">Seçin...</option>
              {secenekler.map(s => <option key={s.key} value={s.key} disabled={s.key === veren}>{s.label}</option>)}
            </select>
          </div>
        </div>
        {piyasaSecili && (
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Firma Adı</label>
            <input value={firmaAdi} onChange={e => setFirmaAdi(e.target.value)} placeholder="Tedarikçi / alıcı firma adı"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
          </div>
        )}
        {secimTamam && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span className="font-semibold">{tarafLabel(secenekler, veren, firmaAdi)}</span>
            <ArrowRight className="h-4 w-4 text-primary" />
            <span className="font-semibold">{tarafLabel(secenekler, alan, firmaAdi)}</span>
          </div>
        )}
      </div>

      {secimTamam && (
        <>
          {/* ─── Belge Yükleme: İrsaliye + Bono + Ambar ─── */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            {/* İrsaliye Belgesi */}
            <div className="rounded-lg border border-input bg-card p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold">İrsaliye Belgesi</h3>
              {irsaliyeOnizleme ? (
                <div className="relative inline-block">
                  <img src={irsaliyeOnizleme} alt="İrsaliye" className="max-h-28 rounded-lg border border-input object-contain" />
                  <button onClick={() => { setIrsaliyeDosya(null); setIrsaliyeOnizleme(null) }}
                    className="absolute -right-2 -top-2 rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : (
                <div onClick={() => irsaliyeRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-input p-4 hover:border-primary hover:bg-primary/5 transition-colors">
                  <Image className="mb-1 h-6 w-6 text-muted-foreground/40" />
                  <p className="text-[10px] text-muted-foreground">İrsaliye yükle</p>
                </div>
              )}
              <input ref={irsaliyeRef} type="file" accept="image/*" onChange={e => handleBelgeSec(e, 'irsaliye')} className="hidden" />
            </div>

            {/* Bono Belgesi */}
            <div className="rounded-lg border border-input bg-card p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold">Bono Belgesi</h3>
              {bonoOnizleme ? (
                <div className="relative inline-block">
                  <img src={bonoOnizleme} alt="Bono" className="max-h-28 rounded-lg border border-input object-contain" />
                  <button onClick={() => { setBonoDosya(null); setBonoOnizleme(null) }}
                    className="absolute -right-2 -top-2 rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : (
                <div onClick={() => bonoRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-input p-4 hover:border-primary hover:bg-primary/5 transition-colors">
                  <Image className="mb-1 h-6 w-6 text-muted-foreground/40" />
                  <p className="text-[10px] text-muted-foreground">Bono yükle</p>
                </div>
              )}
              <input ref={bonoRef} type="file" accept="image/*" onChange={e => handleBelgeSec(e, 'bono')} className="hidden" />
            </div>

            {/* Ambar Teslim Tesellüm Formu */}
            <div className="rounded-lg border border-input bg-card p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold">Ambar T.T. Formu</h3>
              {ambarOnizleme ? (
                <div className="relative inline-block">
                  <img src={ambarOnizleme} alt="Ambar" className="max-h-28 rounded-lg border border-input object-contain" />
                  <button onClick={() => { setAmbarDosya(null); setAmbarOnizleme(null) }}
                    className="absolute -right-2 -top-2 rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : (
                <div onClick={() => ambarRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-input p-4 hover:border-primary hover:bg-primary/5 transition-colors">
                  <Image className="mb-1 h-6 w-6 text-muted-foreground/40" />
                  <p className="text-[10px] text-muted-foreground">Ambar formu yükle</p>
                </div>
              )}
              <input ref={ambarRef} type="file" accept="image/*" onChange={e => handleBelgeSec(e, 'ambar')} className="hidden" />
            </div>
          </div>

          {/* ─── İrsaliye + Bono + Ambar Bilgileri ─── */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            {/* İrsaliye Bilgileri (sol) */}
            <div className="rounded-lg border border-input bg-card shadow-sm" style={{ padding: '16px 20px' }}>
              <h3 className="mb-3 text-sm font-semibold">İrsaliye Bilgileri</h3>
              <div className="space-y-4">
                {[
                  { name: 'irsaliye_no', label: 'İrsaliye No' },
                  { name: 'irsaliye_tarihi', label: 'İrs. Tarihi', type: 'date' },
                  { name: 'sevk_tarihi', label: 'Sevk Tarihi', type: 'date' },
                  { name: 'irsaliye_zamani', label: 'İrs. Zamanı', type: 'time' },
                  { name: 'sevk_zamani', label: 'Sevk Zamanı', type: 'time' },
                  { name: 'referans_belge', label: 'Ref. Belge' },
                  { name: 'irsaliye_tipi', label: 'İrs. Tipi' },
                  { name: 'tasiyici_firma', label: 'Taşıyıcı' },
                  { name: 'arac_plakasi', label: 'Araç Plaka' },
                ].map(f => (
                  <div key={f.name} className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                    <label className="w-24 shrink-0 text-xs text-muted-foreground text-right">{f.label}</label>
                    <input type={f.type || 'text'} name={f.name} value={irsaliye[f.name] || ''} onChange={handleIrsaliyeDegistir}
                      className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none" />
                  </div>
                ))}
              </div>
            </div>

            {/* Bono Bilgileri (sağ) */}
            <div className="rounded-lg border border-input bg-card shadow-sm" style={{ padding: '16px 20px' }}>
              <h3 className="mb-3 text-sm font-semibold">Bono Bilgileri</h3>
              <div className="space-y-4">
                {[
                  { name: 'belge_no', label: 'Belge No' },
                  { name: 'belge_tarihi', label: 'Belge Tarihi', type: 'date' },
                  { name: 'giris_tarihi', label: 'Giriş Tarihi', type: 'date' },
                  { name: 'teslim_fisi_no', label: 'Teslim Fişi No' },
                  { name: 'tutanak_no', label: 'Tutanak No' },
                  { name: 'teslim_eden', label: 'Teslim Eden' },
                  { name: 'teslim_alan', label: 'Teslim Alan' },
                ].map(f => (
                  <div key={f.name} className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                    <label className="w-24 shrink-0 text-xs text-muted-foreground text-right">{f.label}</label>
                    <input type={f.type || 'text'} name={f.name} value={bono[f.name] || ''} onChange={handleBonoDegistir}
                      className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none" />
                  </div>
                ))}
              </div>
            </div>

            {/* Ambar T.T. Bilgileri */}
            <div className="rounded-lg border border-input bg-card shadow-sm" style={{ padding: '16px 20px' }}>
              <h3 className="mb-3 text-sm font-semibold">Ambar T.T. Bilgileri</h3>
              <div className="space-y-4">
                {[
                  { name: 'kocan_etiketi', label: 'Koçan Etiketi' },
                  { name: 'kocan_no', label: 'Koçan No' },
                  { name: 'teslim_eden', label: 'Teslim Eden' },
                  { name: 'teslim_alan', label: 'Teslim Alan' },
                  { name: 'fis_no', label: 'Fiş No' },
                ].map(f => (
                  <div key={f.name} className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                    <label className="w-24 shrink-0 text-xs text-muted-foreground text-right">{f.label}</label>
                    <input type="text" name={f.name} value={ambar[f.name] || ''} onChange={handleAmbarDegistir}
                      className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Malzeme Listesi ─── */}
          <div className="mt-6 rounded-lg border border-input bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Malzeme Listesi ({kalemler.length} kalem)</h3>
              <button onClick={handleKalemEkle} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90">
                <Plus className="h-3.5 w-3.5" />Ekle
              </button>
            </div>
            <div className="rounded-lg border border-input" style={{ overflow: 'visible' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-border bg-muted/70">
                    <th className="w-8 px-2 py-2.5 text-center font-semibold text-muted-foreground">#</th>
                    <th className="w-24 px-2 py-2.5 text-left font-semibold text-muted-foreground">Kod</th>
                    <th className="px-2 py-2.5 text-left font-semibold text-muted-foreground">Malzeme</th>
                    <th className="w-16 px-2 py-2.5 text-center font-semibold text-muted-foreground">Birim</th>
                    <th className="w-20 px-2 py-2.5 text-center font-semibold text-muted-foreground">Miktar</th>
                    <th className="w-32 px-2 py-2.5 text-left font-semibold text-muted-foreground">Veren Depo</th>
                    <th className="w-16 px-2 py-2.5 text-center font-semibold text-muted-foreground">Stok</th>
                    <th className="w-8 px-1 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {kalemler.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-xs">
                      Henüz malzeme eklenmedi. AI ile analiz edin veya manuel ekleyin.
                    </td></tr>
                  ) : kalemler.map((k, i) => (
                    <MalzemeSatiri key={k._id || i} kalem={k} index={i} onDegistir={handleKalemDegistir} onSil={handleKalemSil} verenTipi={verenSec?.depoTipi || veren} verenLabel={tarafLabel(secenekler, veren, firmaAdi)} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Kaydet ─── */}
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={() => navigate('/depo')} className="rounded-lg border border-input px-4 py-2.5 text-sm font-medium hover:bg-muted">İptal</button>
            <button onClick={handleKaydet} disabled={kaydediliyor || kalemler.filter(k => k.malzeme_adi?.trim()).length === 0}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              {kaydediliyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {kaydediliyor ? 'Kaydediliyor...' : `${kalemler.filter(k => k.malzeme_adi?.trim()).length} Kalemi Kaydet`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Düzenleme Formu (mevcut malzeme düzenleme) ───
function MalzemeDuzenleForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { data: mevcutMalzeme, isLoading: yukleniyor } = useMalzeme(id, { enabled: true })
  const malzemeGuncelle = useMalzemeGuncelle()
  const [form, setForm] = useState({ malzeme_kodu: '', malzeme_adi: '', kategori: '', birim: 'adet', stok_miktari: '', kritik_seviye: '', birim_fiyat: '', depo_konumu: '', notlar: '' })
  const [hatalar, setHatalar] = useState({})

  useEffect(() => {
    if (mevcutMalzeme) setForm({
      malzeme_kodu: mevcutMalzeme.malzeme_kodu || '', malzeme_adi: mevcutMalzeme.malzeme_adi || '',
      kategori: mevcutMalzeme.kategori || '', birim: mevcutMalzeme.birim || 'adet',
      stok_miktari: mevcutMalzeme.stok_miktari ?? '', kritik_seviye: mevcutMalzeme.kritik_seviye ?? '',
      birim_fiyat: mevcutMalzeme.birim_fiyat ?? '', depo_konumu: mevcutMalzeme.depo_konumu || '', notlar: mevcutMalzeme.notlar || '',
    })
  }, [mevcutMalzeme])

  const handleChange = (e) => { setForm(prev => ({ ...prev, [e.target.name]: e.target.value })); if (hatalar[e.target.name]) setHatalar(prev => ({ ...prev, [e.target.name]: '' })) }
  const dogrula = () => { const h = {}; if (!form.malzeme_adi.trim()) h.malzeme_adi = 'Zorunlu'; if (!form.malzeme_kodu.trim()) h.malzeme_kodu = 'Zorunlu'; if (!form.kategori) h.kategori = 'Zorunlu'; setHatalar(h); return !Object.keys(h).length }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!dogrula()) return
    try {
      await malzemeGuncelle.mutateAsync({ id: Number(id), ...form, stok_miktari: Number(form.stok_miktari) || 0, kritik_seviye: Number(form.kritik_seviye) || 0, birim_fiyat: Number(form.birim_fiyat) || 0 })
      navigate('/depo')
    } catch {}
  }

  if (yukleniyor) return <div className="skeleton h-96 w-full rounded" />

  const inputCls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <div>
      <div className="mb-6">
        <button onClick={() => navigate('/depo')} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Depoya Dön</button>
        <h1 className="text-2xl font-bold">Malzeme Düzenle</h1>
      </div>
      <form onSubmit={handleSubmit} className="mx-auto max-w-4xl rounded-lg border border-input bg-card shadow-sm" style={{ padding: '24px 32px' }}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div><label className="mb-1.5 block text-sm font-medium">Malzeme Kodu *</label><input name="malzeme_kodu" value={form.malzeme_kodu} onChange={handleChange} className={cn(inputCls, hatalar.malzeme_kodu && 'border-red-500')} /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Malzeme Adı *</label><input name="malzeme_adi" value={form.malzeme_adi} onChange={handleChange} className={cn(inputCls, hatalar.malzeme_adi && 'border-red-500')} /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Kategori *</label><select name="kategori" value={form.kategori} onChange={handleChange} className={cn(inputCls, hatalar.kategori && 'border-red-500')}><option value="">Seçin</option>{Object.entries(MALZEME_KATEGORILERI).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className="mb-1.5 block text-sm font-medium">Birim</label><select name="birim" value={form.birim} onChange={handleChange} className={inputCls}>{BIRIMLER.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}</select></div>
          <div><label className="mb-1.5 block text-sm font-medium">Stok Miktarı</label><input type="number" name="stok_miktari" value={form.stok_miktari} onChange={handleChange} className={inputCls} /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Kritik Seviye</label><input type="number" name="kritik_seviye" value={form.kritik_seviye} onChange={handleChange} className={inputCls} /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Birim Fiyat (TL)</label><input type="number" name="birim_fiyat" value={form.birim_fiyat} onChange={handleChange} className={inputCls} /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Depo Konumu</label><input name="depo_konumu" value={form.depo_konumu} onChange={handleChange} className={inputCls} /></div>
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-input pt-4">
          <button type="button" onClick={() => navigate('/depo')} className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted">İptal</button>
          <button type="submit" disabled={malzemeGuncelle.isPending} className="flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
            {malzemeGuncelle.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Güncelle
          </button>
        </div>
      </form>
    </div>
  )
}
