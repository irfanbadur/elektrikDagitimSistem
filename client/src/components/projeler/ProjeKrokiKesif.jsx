import { useState, useRef, useEffect, useCallback } from 'react'
import useDropdownNav from '@/hooks/useDropdownNav'
import { Plus, Trash2, Search, Package, Check, Clock, MapPin, ArrowRight, ArrowDown, ArrowUp, Minus, X, GitCompareArrows, Eye, Sparkles, Loader2, Upload } from 'lucide-react'
import { useProjeKrokiKesif, useProjeKrokiKesifEkle, useProjeKrokiKesifGuncelle, useProjeKrokiKesifSil, useProjeKrokiKesifOzet, useKesifKarsilastir, useProjeKrokiKesifTopluEkle } from '@/hooks/useProjeKrokiKesif'
import { useDepoKatalog } from '@/hooks/useDepoKatalog'
import { useProjeFazlar } from '@/hooks/useDongu'
import api from '@/api/client'
import { cn } from '@/lib/utils'

const GORUNUM_SECENEKLERI = [
  { key: 'hepsi', label: 'Hepsi' },
  { key: 'yeni_malzeme', label: 'Yeni Malzeme' },
  { key: 'ozet', label: 'Malzeme Ozet' },
]

// Bağlantı noktası ve müşteri tesisi filtresi
function isBaglantiVeyaMusteri(malzemeAdi) {
  if (!malzemeAdi) return false
  const lower = malzemeAdi.toLowerCase().replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
  return lower.includes('baglanti noktasi') || lower.includes('musteri tesisi')
}

// Yeni malzeme filtresi: bağlantı noktası ve müşteri tesisi hariç
function yeniMalzemeFiltre(kesifler) {
  if (!kesifler) return []
  return kesifler.filter(k => !isBaglantiVeyaMusteri(k.malzeme_adi))
}

// Özet: yeni malzeme filtresi + tekrar edenleri topla
function ozetHesapla(kesifler) {
  const filtreli = yeniMalzemeFiltre(kesifler)
  const grupMap = new Map()
  for (const k of filtreli) {
    const anahtar = (k.malzeme_kodu || '') + '||' + (k.malzeme_adi || '').toLowerCase().trim()
    if (grupMap.has(anahtar)) {
      const mevcut = grupMap.get(anahtar)
      mevcut.miktar = (mevcut.miktar || 0) + (k.miktar || 0)
      mevcut._adet = (mevcut._adet || 1) + 1
    } else {
      grupMap.set(anahtar, { ...k, _adet: 1 })
    }
  }
  return Array.from(grupMap.values())
}

const DURUM_MAP = {
  planli: { label: 'Planli', renk: 'bg-slate-100 text-slate-700', icon: Clock },
  depoda_var: { label: 'Depoda Var', renk: 'bg-blue-100 text-blue-700', icon: Package },
  alindi: { label: 'Alindi', renk: 'bg-emerald-100 text-emerald-700', icon: Check },
  sahaya_verildi: { label: 'Sahaya Verildi', renk: 'bg-purple-100 text-purple-700', icon: Check },
}

function KrokiKesifOzet({ projeId }) {
  const { data: ozet } = useProjeKrokiKesifOzet(projeId)
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

function DuzenlenebilirHucre({ deger, onKaydet, type = 'number' }) {
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
        className="flex h-full w-full min-h-[28px] min-w-[60px] cursor-pointer items-center rounded px-2 py-1 hover:bg-primary/10 hover:ring-1 hover:ring-primary/30"
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

function KesifSatiri({ kalem: k, durum, onGuncelle, onDurumDegistir, onSil }) {
  return (
    <tr className="border-b border-input/50 hover:bg-muted/30 transition-colors">
      <td className="px-3 py-2 font-mono text-xs text-blue-600">{k.poz_no || '-'}</td>
      <td className="px-3 py-2 text-xs font-medium">{k.malzeme_adi}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{k.birim}</td>
      <td className="px-3 py-2 text-left text-xs tabular-nums">
        <DuzenlenebilirHucre deger={k.miktar || 0} onKaydet={(v) => onGuncelle({ miktar: v })} />
      </td>
      <td className="px-3 py-2 text-left text-xs tabular-nums">
        <DuzenlenebilirHucre deger={k.birim_fiyat || 0} onKaydet={(v) => onGuncelle({ birim_fiyat: v })} />
      </td>
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
      <td className="px-3 py-2 text-right">
        <button onClick={onSil} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600" title="Sil">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
}

function KesifFormSatiri({ onKaydet, onIptal }) {
  const [form, setForm] = useState({ malzeme_adi: '', malzeme_kodu: '', poz_no: '', birim: 'Ad', miktar: '', birim_fiyat: '' })
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
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) && inputRef.current && !inputRef.current.contains(e.target))
        setDropdownAcik(false)
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
    if (!val) setForm({ malzeme_adi: '', malzeme_kodu: '', poz_no: '', birim: 'Ad', miktar: form.miktar, birim_fiyat: form.birim_fiyat })
  }

  const handleSec = useCallback((item) => {
    setForm(prev => ({ ...prev, malzeme_kodu: item.malzeme_kodu || '', poz_no: item.poz_birlesik || '', malzeme_adi: item.malzeme_cinsi || item.malzeme_tanimi_sap || '', birim: item.olcu || 'Ad' }))
    setArama(item.malzeme_cinsi || item.malzeme_tanimi_sap || '')
    setSecildi(true)
    setDropdownAcik(false)
  }, [])

  const gosterilen = (sonuclar || []).slice(0, 50)
  const { seciliIdx, setSeciliIdx, handleKeyDown: dropdownKeyDown } = useDropdownNav(gosterilen, handleSec, () => setDropdownAcik(false))

  useEffect(() => { setSeciliIdx(-1) }, [sonuclar, setSeciliIdx])

  const handleSerbestKaydet = () => {
    const adi = secildi ? form.malzeme_adi : arama.trim()
    if (!adi) return
    onKaydet({ ...form, malzeme_adi: adi, miktar: Number(form.miktar) || 1, birim_fiyat: Number(form.birim_fiyat) || 0 })
  }

  return (
    <tr className="border-b border-input bg-primary/5">
      <td className="px-3 py-2">
        <input value={form.poz_no} onChange={e => setForm({...form, poz_no: e.target.value})} placeholder="Poz no" className="w-full rounded border border-input bg-background px-2 py-1 text-xs" />
      </td>
      <td className="px-3 py-2">
        <div className="relative">
          <div className="relative">
            <input
              ref={inputRef}
              value={arama}
              onChange={handleAramaChange}
              onFocus={() => { if (arama.length >= 2 && !secildi) setDropdownAcik(true) }}
              onKeyDown={dropdownAcik ? dropdownKeyDown : undefined}
              placeholder="Malzeme adi yazin..."
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
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">Katalogda bulunamadi - serbest girilebilir</div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm">
                    <tr className="border-b border-input">
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Poz No</th>
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Malzeme Cinsi</th>
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Birim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gosterilen.map((item, i) => (
                      <tr key={item.id} onClick={() => handleSec(item)} className={cn('cursor-pointer border-b border-input/30 transition-colors', i === seciliIdx ? 'bg-primary/10' : 'hover:bg-primary/5')}>
                        <td className="px-2 py-1.5 font-mono text-blue-600 whitespace-nowrap">{item.poz_birlesik || '-'}</td>
                        <td className="px-2 py-1.5">{item.malzeme_cinsi || '-'}</td>
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
      <td className="px-3 py-2">
        <input value={form.birim} onChange={e => setForm({...form, birim: e.target.value})} className="w-16 rounded border border-input bg-background px-2 py-1 text-xs" />
      </td>
      <td className="px-3 py-2">
        <input type="number" value={form.miktar} onChange={e => setForm({...form, miktar: e.target.value})} placeholder="1" className="w-20 rounded border border-input bg-background px-2 py-1 text-xs" />
      </td>
      <td className="px-3 py-2">
        <input type="number" value={form.birim_fiyat} onChange={e => setForm({...form, birim_fiyat: e.target.value})} placeholder="0" className="w-20 rounded border border-input bg-background px-2 py-1 text-xs" />
      </td>
      <td className="px-3 py-2"></td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <button onClick={handleSerbestKaydet} disabled={!arama.trim()} className="rounded bg-primary px-2 py-1 text-xs text-white hover:bg-primary/90 disabled:opacity-50">Kaydet</button>
          <button onClick={onIptal} className="rounded border border-input px-2 py-1 text-xs hover:bg-muted">Iptal</button>
        </div>
      </td>
    </tr>
  )
}

// Karsilastirma paneli
function KesifKarsilastirma({ projeId }) {
  const { data, isLoading } = useKesifKarsilastir(projeId)

  if (isLoading) return <div className="py-4 text-center text-sm text-muted-foreground">Karsilastirma yukleniyor...</div>
  if (!data || !data.karsilastirma?.length) {
    return (
      <div className="rounded-lg border border-input bg-card p-6 text-center">
        <GitCompareArrows className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Karsilastirma icin her iki kesif listesinde de veri olmalidir</p>
      </div>
    )
  }

  const { karsilastirma, kroki_toplam, proje_toplam, eslesen } = data

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-xs text-blue-600">Kroki Kesif</p>
          <p className="text-lg font-bold text-blue-700">{kroki_toplam} kalem</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs text-emerald-600">Eslesen</p>
          <p className="text-lg font-bold text-emerald-700">{eslesen} kalem</p>
        </div>
        <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
          <p className="text-xs text-violet-600">Proje Kesif</p>
          <p className="text-lg font-bold text-violet-700">{proje_toplam} kalem</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-input bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-input bg-muted/50">
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Malzeme</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Birim</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-blue-600">Kroki</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-violet-600">Proje</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground">Fark</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Durum</th>
              </tr>
            </thead>
            <tbody>
              {karsilastirma.map((k, i) => (
                <tr key={i} className={cn(
                  'border-b border-input/50 transition-colors',
                  k.durum === 'sadece_kroki' ? 'bg-amber-50/50' :
                  k.durum === 'sadece_proje' ? 'bg-violet-50/50' :
                  k.fark !== 0 ? 'bg-orange-50/30' : ''
                )}>
                  <td className="px-3 py-2 text-xs font-medium">{k.malzeme_adi}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{k.birim}</td>
                  <td className="px-3 py-2 text-center text-xs tabular-nums font-medium text-blue-700">{k.kroki_miktar || '-'}</td>
                  <td className="px-3 py-2 text-center text-xs tabular-nums font-medium text-violet-700">{k.proje_miktar || '-'}</td>
                  <td className="px-3 py-2 text-center text-xs tabular-nums font-medium">
                    {k.fark > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-emerald-600"><ArrowUp className="h-3 w-3" />+{k.fark}</span>
                    ) : k.fark < 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-red-600"><ArrowDown className="h-3 w-3" />{k.fark}</span>
                    ) : (
                      <span className="text-muted-foreground"><Minus className="inline h-3 w-3" /></span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {k.durum === 'eslesti' && k.fark === 0 && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">Esit</span>
                    )}
                    {k.durum === 'eslesti' && k.fark !== 0 && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-700">Farkli</span>
                    )}
                    {k.durum === 'sadece_kroki' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">Sadece Kroki</span>
                    )}
                    {k.durum === 'sadece_proje' && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-700">Sadece Proje</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function ProjeKrokiKesif({ projeId }) {
  const { data: kesifler, isLoading, isError } = useProjeKrokiKesif(projeId)
  const ekle = useProjeKrokiKesifEkle(projeId)
  const guncelle = useProjeKrokiKesifGuncelle(projeId)
  const sil = useProjeKrokiKesifSil(projeId)
  const topluEkle = useProjeKrokiKesifTopluEkle(projeId)
  const { data: fazlar } = useProjeFazlar(projeId)

  const [yeniSatir, setYeniSatir] = useState(false)
  const [karsilastirmaAcik, setKarsilastirmaAcik] = useState(false)
  const [gorunum, setGorunum] = useState('hepsi')
  const [parseYukleniyor, setParseYukleniyor] = useState(false)
  const [parseHata, setParseHata] = useState('')
  const fileInputRef = useRef(null)

  const handleKaydet = async (data) => {
    await ekle.mutateAsync(data)
    setYeniSatir(false)
  }

  const handleDurumDegistir = (id, kalem, yeniDurum) => {
    guncelle.mutate({ id, ...kalem, durum: yeniDurum })
  }

  // Görünüme göre listeyi filtrele
  const gorunumListesi = gorunum === 'hepsi' ? (kesifler || [])
    : gorunum === 'yeni_malzeme' ? yeniMalzemeFiltre(kesifler)
    : ozetHesapla(kesifler)

  const isOzet = gorunum === 'ozet'

  // Krokiden keşif çıkar
  const krokidenKesifCikar = async (dosya) => {
    setParseYukleniyor(true)
    setParseHata('')
    try {
      // 1. AI ile parse et
      const formData = new FormData()
      formData.append('dosya', dosya)
      const res = await fetch('/api/yer-teslim/parse', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Analiz hatasi')
      if (json.data?.parse_error) throw new Error('AI goruntuyu okuyamadi. Daha net bir gorsel yukleyin.')

      const direkListesi = json.data.direk_listesi || []
      const demontajListesi = json.data.demontaj_listesi || []

      // 2. Katalog eşleştirme (direkler)
      let direkEslesmeler = []
      if (direkListesi.length > 0) {
        try {
          const esRes = await api.post('/malzeme-katalog/eslestir', { kalemler: direkListesi.map(d => ({ malzeme_adi: d.kisa_adi })) })
          direkEslesmeler = esRes?.data || []
        } catch { /* opsiyonel */ }
      }

      // 3. Kroki keşif kalemleri oluştur
      const kalemler = []

      // Direklerden
      for (let i = 0; i < direkListesi.length; i++) {
        const d = direkListesi[i]
        const eslesme = direkEslesmeler[i]?.eslesme
        kalemler.push({
          malzeme_kodu: eslesme?.malzeme_kodu || null,
          poz_no: eslesme?.poz_birlesik || null,
          malzeme_adi: eslesme?.malzeme_cinsi || eslesme?.malzeme_tanimi_sap || d.kisa_adi,
          birim: eslesme?.olcu || 'Ad',
          miktar: 1,
          notlar: d.notlar || null,
          kaynak: 'kroki',
        })
      }

      // Demontajdan
      for (const d of demontajListesi) {
        if (d.malzeme_adi) {
          kalemler.push({
            malzeme_kodu: null,
            poz_no: d.poz_no || null,
            malzeme_adi: d.malzeme_adi,
            birim: d.birim || 'Ad',
            miktar: d.miktar || 1,
            notlar: null,
            kaynak: 'demontaj',
          })
        }
      }

      // 4. Demontaj kalemlerine katalog eşleştirme
      const demontajKalemleri = kalemler.filter(k => k.kaynak === 'demontaj')
      if (demontajKalemleri.length > 0) {
        try {
          const esRes = await api.post('/malzeme-katalog/eslestir', { kalemler: demontajKalemleri })
          const eslesmeler = esRes?.data || []
          let idx = 0
          for (let i = 0; i < kalemler.length; i++) {
            if (kalemler[i].kaynak === 'demontaj') {
              const e = eslesmeler[idx]?.eslesme
              if (e) {
                kalemler[i].malzeme_kodu = e.malzeme_kodu || kalemler[i].malzeme_kodu
                kalemler[i].poz_no = e.poz_birlesik || kalemler[i].poz_no
                kalemler[i].malzeme_adi = e.malzeme_cinsi || e.malzeme_tanimi_sap || kalemler[i].malzeme_adi
                kalemler[i].birim = e.olcu || kalemler[i].birim
              }
              idx++
            }
          }
        } catch { /* opsiyonel */ }
      }

      if (kalemler.length === 0) throw new Error('Krokiden malzeme cikarilamamistir.')

      // 5. Toplu kaydet
      await topluEkle.mutateAsync({ kalemler })
    } catch (err) {
      setParseHata(err.message || 'Kesif cikarma sirasinda hata olustu')
    } finally {
      setParseYukleniyor(false)
    }
  }

  // Krokiden Keşif Çıkar butonu handler
  const handleKrokidenKesifCikar = async () => {
    setParseHata('')

    // Döngüde kroki adımı var mı kontrol et
    if (fazlar?.length) {
      for (const faz of fazlar) {
        const krokiAdim = (faz.adimlar || []).find(a => a.adim_kodu === 'kroki')
        if (krokiAdim?.id) {
          try {
            const dosyaRes = await api.get(`/dosya/adim/${krokiAdim.id}`)
            const dosyalar = dosyaRes?.data || dosyaRes || []
            const gorsel = dosyalar.find(d => d.mime_tipi?.startsWith('image/'))
            if (gorsel) {
              // Görseli indir ve parse et
              setParseYukleniyor(true)
              try {
                const blob = await fetch(`/api/dosya/${gorsel.id}/dosya`, {
                  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                }).then(r => r.blob())
                const file = new File([blob], gorsel.orijinal_adi || 'kroki.jpg', { type: gorsel.mime_tipi })
                await krokidenKesifCikar(file)
              } catch (err) {
                setParseHata(err.message || 'Gorsel indirme hatasi')
                setParseYukleniyor(false)
              }
              return
            }
          } catch { /* dosya yoksa devam */ }
        }
      }
    }

    // Kroki görseli bulunamadı → dosya seçtir
    fileInputRef.current?.click()
  }

  const handleDosyaSec = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setParseHata('Sadece gorsel dosyalar yuklenebilir (JPG, PNG)')
      return
    }
    krokidenKesifCikar(file)
    e.target.value = ''
  }

  return (
    <div>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleDosyaSec} className="hidden" />

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            Kroki-Kesif
          </h3>
          <p className="text-sm text-muted-foreground">Krokiden parse edilen malzeme kesif listesi</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setKarsilastirmaAcik(!karsilastirmaAcik)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              karsilastirmaAcik ? 'border-primary bg-primary/10 text-primary' : 'border-input hover:bg-muted'
            )}
          >
            <GitCompareArrows className="h-4 w-4" />
            Karsilastir
          </button>
          <button onClick={() => setYeniSatir(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Ekle
          </button>
        </div>
      </div>

      <KrokiKesifOzet projeId={projeId} />

      {/* Görünüm seçenekleri */}
      <div className="mb-4 flex items-center gap-2">
        <Eye className="h-4 w-4 text-muted-foreground" />
        <div className="flex rounded-lg border border-input overflow-hidden">
          {GORUNUM_SECENEKLERI.map(s => (
            <button
              key={s.key}
              onClick={() => setGorunum(s.key)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors border-r border-input last:border-r-0',
                gorunum === s.key ? 'bg-primary text-white' : 'hover:bg-muted'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        {gorunum !== 'hepsi' && (
          <span className="text-xs text-muted-foreground">{gorunumListesi.length} kalem</span>
        )}
      </div>

      {karsilastirmaAcik && (
        <div className="mb-6">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <GitCompareArrows className="h-4 w-4 text-primary" />
            Kroki-Kesif vs Proje-Kesif Karsilastirmasi
          </h4>
          <KesifKarsilastirma projeId={projeId} />
        </div>
      )}

      {/* Parse hata mesajı */}
      {parseHata && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <X className="h-4 w-4 flex-shrink-0" />
          {parseHata}
          <button onClick={() => setParseHata('')} className="ml-auto text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-input bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-input bg-muted/50">
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Poz No</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Malzeme</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Birim</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Miktar</th>
                {isOzet && <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Tekrar</th>}
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Birim Fiyat</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Durum</th>
                {!isOzet && <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground w-16"></th>}
              </tr>
            </thead>
            <tbody>
              {yeniSatir && <KesifFormSatiri onKaydet={handleKaydet} onIptal={() => setYeniSatir(false)} />}

              {isLoading || parseYukleniyor ? (
                <>
                  {parseYukleniyor && (
                    <tr>
                      <td colSpan={isOzet ? 7 : 7} className="px-3 py-8 text-center">
                        <Loader2 className="mx-auto mb-2 h-8 w-8 text-primary animate-spin" />
                        <p className="text-sm font-medium text-primary">Kroki AI ile analiz ediliyor...</p>
                        <p className="mt-1 text-xs text-muted-foreground">Bu islem birkaç dakika surebilir</p>
                      </td>
                    </tr>
                  )}
                  {isLoading && !parseYukleniyor && Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-input/50">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-3 py-2.5"><div className="skeleton h-4 w-full rounded" /></td>
                      ))}
                    </tr>
                  ))}
                </>
              ) : isError ? (
                <tr>
                  <td colSpan={isOzet ? 7 : 7} className="px-3 py-12 text-center">
                    <p className="text-sm text-red-500">Veriler yuklenirken bir hata olustu. Sayfayi yenileyin.</p>
                  </td>
                </tr>
              ) : !kesifler?.length && !yeniSatir ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center">
                    <MapPin className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">Kroki kesif listesi bos</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">Yer teslim krokisinden otomatik olusturulur veya manuel eklenir</p>
                    <button
                      onClick={handleKrokidenKesifCikar}
                      disabled={parseYukleniyor}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Sparkles className="h-4 w-4" />
                      Krokiden Kesif Cikar
                    </button>
                  </td>
                </tr>
              ) : gorunumListesi.length === 0 ? (
                <tr>
                  <td colSpan={isOzet ? 7 : 7} className="px-3 py-8 text-center">
                    <p className="text-sm text-muted-foreground">Bu gorunumde gosterilecek malzeme yok</p>
                  </td>
                </tr>
              ) : isOzet ? (
                gorunumListesi.map((k, i) => {
                  const durum = DURUM_MAP[k.durum] || DURUM_MAP.planli
                  return (
                    <tr key={i} className="border-b border-input/50 hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 font-mono text-xs text-blue-600">{k.poz_no || '-'}</td>
                      <td className="px-3 py-2 text-xs font-medium">{k.malzeme_adi}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{k.birim}</td>
                      <td className="px-3 py-2 text-xs tabular-nums font-medium">{k.miktar}</td>
                      <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{k._adet > 1 ? `${k._adet}x` : '-'}</td>
                      <td className="px-3 py-2 text-xs tabular-nums">{k.birim_fiyat || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', durum.renk)}>{durum.label}</span>
                      </td>
                    </tr>
                  )
                })
              ) : (
                gorunumListesi.map((k) => {
                  const durum = DURUM_MAP[k.durum] || DURUM_MAP.planli
                  return (
                    <KesifSatiri
                      key={k.id}
                      kalem={k}
                      durum={durum}
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
    </div>
  )
}
