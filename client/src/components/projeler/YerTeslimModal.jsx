import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { X, Sparkles, Loader2, CheckCircle, AlertCircle, Image, ArrowLeftRight, ChevronDown } from 'lucide-react'
import api from '@/api/client'
import { usePersonelListesi } from '@/hooks/usePersonel'
import DemontajListesiDuzenle, { createSatir, extractKgKmOran, isMtBirim, isKgBirim } from './DemontajListesiDuzenle'
import KatalogAramaInput from './KatalogAramaInput'

// Dış kişi (kurum personeli) autocomplete input
function DisKisiInput({ value, onChange, placeholder }) {
  const [acik, setAcik] = useState(false)
  const [sonuclar, setSonuclar] = useState([])
  const [araniyor, setAraniyor] = useState(false)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)
  const timerRef = useRef(null)

  const ara = useCallback((q) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!q || q.length < 2) { setSonuclar([]); setAraniyor(false); return }
    setAraniyor(true)
    timerRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/dis-kisiler/ara', { params: { q } })
        setSonuclar(res?.data || [])
      } catch { setSonuclar([]) }
      setAraniyor(false)
    }, 300)
  }, [])

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) setAcik(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const showDropdown = acik && value?.length >= 2 && (araniyor || sonuclar.length > 0)

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={value || ''}
        onChange={e => { onChange(e.target.value); ara(e.target.value); setAcik(true) }}
        onFocus={() => { if (value?.length >= 2) { ara(value); setAcik(true) } }}
        className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30"
        placeholder={placeholder}
      />
      {showDropdown && (
        <div ref={dropdownRef} className="absolute left-0 right-0 z-20 mt-1 rounded-lg border border-input bg-white shadow-lg max-h-36 overflow-y-auto">
          {araniyor ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Araniyor...</div>
          ) : (
            sonuclar.map(k => (
              <button
                key={k.id}
                type="button"
                onMouseDown={() => { onChange(k.ad_soyad, k); setAcik(false); setSonuclar([]) }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-primary/5 flex items-center justify-between"
              >
                <span className="font-medium">{k.ad_soyad}</span>
                {(k.unvan || k.kurum) && (
                  <span className="text-[10px] text-muted-foreground ml-2">
                    {[k.unvan, k.kurum].filter(Boolean).join(' - ')}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// Personel autocomplete dropdown
function PersonelSecici({ value, onChange, personeller }) {
  const [acik, setAcik] = useState(false)
  const [arama, setArama] = useState('')
  const ref = useRef(null)

  const filtrelenmis = useMemo(() => {
    if (!personeller || personeller.length === 0) return []
    if (!arama.trim()) return personeller
    const q = arama.toLowerCase().trim()
    return personeller.filter(p => p.ad_soyad?.toLowerCase().includes(q))
  }, [personeller, arama])

  const seciliPersonel = personeller?.find(p => p.ad_soyad === value)

  return (
    <div className="relative" ref={ref}>
      <div
        onClick={() => setAcik(!acik)}
        className="mt-0.5 flex items-center justify-between w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium cursor-pointer hover:border-primary/50 focus:outline-none"
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
          {value || 'Personel sec...'}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      {acik && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setAcik(false); setArama('') }} />
          <div className="absolute left-0 right-0 z-20 mt-1 rounded-lg border border-input bg-white shadow-lg max-h-48 overflow-hidden flex flex-col">
            <input
              autoFocus
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="Personel ara..."
              className="border-b border-input px-3 py-2 text-sm focus:outline-none"
            />
            <div className="overflow-y-auto">
              {filtrelenmis.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">Sonuc bulunamadi</div>
              ) : (
                filtrelenmis.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onChange(p.ad_soyad, p)
                      setAcik(false)
                      setArama('')
                    }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-primary/5 ${
                      p.ad_soyad === value ? 'bg-primary/10 font-semibold text-primary' : ''
                    }`}
                  >
                    {p.ad_soyad}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function YerTeslimModal({ onSonuc, onKapat }) {
  const [dosya, setDosya] = useState(null)
  const [onizleme, setOnizleme] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState('')
  const [sonuc, setSonuc] = useState(null)
  const [demontajListesi, setDemontajListesi] = useState([])
  const [eslestiriliyor, setEslestiriliyor] = useState(false)
  const fileInputRef = useRef(null)

  const { data: personelRes } = usePersonelListesi()
  const personeller = useMemo(() => {
    const data = personelRes?.data || personelRes || []
    return Array.isArray(data) ? data : []
  }, [personelRes])

  // Türkçe karakter uyumlu normalizasyon
  const normTR = (s) => (s || '').toUpperCase()
    .replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
    .replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

  // Personel listesinde isim ara (Türkçe uyumlu)
  const findPersonByName = (name) => {
    if (!name || personeller.length === 0) return null
    const n = normTR(name)
    if (!n) return null
    // 1) Tam eşleşme
    let match = personeller.find(p => normTR(p.ad_soyad) === n)
    if (match) return match
    // 2) İçerme
    match = personeller.find(p => {
      const pn = normTR(p.ad_soyad)
      return pn && (pn.includes(n) || n.includes(pn))
    })
    if (match) return match
    // 3) Kelime bazlı
    const kelimeler = n.split(' ').filter(Boolean)
    match = personeller.find(p => {
      const pn = normTR(p.ad_soyad)
      return kelimeler.length > 0 && kelimeler.every(k => pn.includes(k))
    })
    return match
  }

  const handleDosyaSec = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setHata('Sadece gorsel dosyalar yuklenebilir (JPG, PNG)')
      return
    }
    setDosya(file)
    setHata('')
    setSonuc(null)
    setDemontajListesi([])
    const reader = new FileReader()
    reader.onload = (ev) => setOnizleme(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleAnaliz = async () => {
    if (!dosya) return
    setYukleniyor(true)
    setHata('')
    try {
      const formData = new FormData()
      formData.append('dosya', dosya)
      const res = await fetch('/api/yer-teslim/parse', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Analiz hatasi')
      if (json.data?.parse_error) throw new Error('AI goruntuyu okuyamadi. Daha net bir gorsel yukleyin.')

      const data = json.data

      // Teslim yapan/alan taraf tespiti: personelimizde olan = teslim alan (yüklenici)
      const yapanAd = data.yer_teslim_yapan?.ad_soyad || ''
      const alanAd = data.yer_teslim_alan?.ad_soyad || ''
      const yapanUnvan = data.yer_teslim_yapan?.unvan || ''
      const alanUnvan = data.yer_teslim_alan?.unvan || ''

      const alanPersonel = findPersonByName(alanAd)
      const yapanPersonel = findPersonByName(yapanAd)

      // Eğer yapan taraf personelimizde varsa ama alan taraf yoksa -> AI ters yazmış, swap
      if (yapanPersonel && !alanPersonel) {
        data.yer_teslim_yapan = { ad_soyad: alanAd, unvan: alanUnvan }
        data.yer_teslim_alan = { ad_soyad: yapanAd, unvan: yapanUnvan, personel_id: yapanPersonel.id }
      } else if (alanPersonel) {
        // Doğru sırada, personel_id'yi ekle
        data.yer_teslim_alan = { ...data.yer_teslim_alan, personel_id: alanPersonel.id }
      }
      // Eğer ikisi de yoksa veya ikisi de varsa -> olduğu gibi bırak

      // Dış kişiler tablosundan teslim yapan (kurum) tarafını eşleştir
      const yapanAdFinal = data.yer_teslim_yapan?.ad_soyad || ''
      if (yapanAdFinal) {
        try {
          const disKisiRes = await api.get('/dis-kisiler/ara', { params: { q: yapanAdFinal } })
          const disKisiler = disKisiRes?.data || []
          const eslesme = disKisiler.find(k =>
            k.ad_soyad.toLowerCase().trim() === yapanAdFinal.toLowerCase().trim()
          )
          if (eslesme) {
            if (!data.yer_teslim_yapan.unvan && eslesme.unvan) data.yer_teslim_yapan.unvan = eslesme.unvan
            if (eslesme.kurum) data.yer_teslim_yapan.kurum = eslesme.kurum
          }
        } catch {}
      }

      setSonuc(data)

      // Demontaj listesini state'e al ve katalog eşleştirmesi yap
      const liste = (data.demontaj_listesi || []).map((d) => createSatir(d))
      setDemontajListesi(liste)
      katalogEslestir(liste)
    } catch (err) {
      setHata(err.message || 'Analiz sirasinda hata olustu')
    } finally {
      setYukleniyor(false)
    }
  }

  // Toplu katalog eşleştirme
  const katalogEslestir = async (liste) => {
    if (!liste || liste.length === 0) return
    setEslestiriliyor(true)
    try {
      const eslesmeRes = await api.post('/malzeme-katalog/eslestir', { kalemler: liste })
      const eslesmeler = eslesmeRes?.data || []
      setDemontajListesi(prev => prev.map((k, i) => {
        const e = eslesmeler[i]?.eslesme
        if (e) {
          const katalogBirim = e.olcu || ''
          let orijinalBirim = k.birim || 'Ad'
          const kgKmOranHam = extractKgKmOran(`${e.malzeme_cinsi || ''} ${e.malzeme_tanimi_sap || ''}`)
          // Kg/Km oranı varsa ve birim Ad ise → iletken metraj, m olarak kabul et
          if (kgKmOranHam && orijinalBirim.toLowerCase() === 'ad') {
            orijinalBirim = 'm'
          }
          const birimFarkli = katalogBirim && orijinalBirim &&
            katalogBirim.toLowerCase().replace(/\./g, '') !== orijinalBirim.toLowerCase().replace(/\./g, '')
          const kgKmOran = birimFarkli ? kgKmOranHam : null
          let yeniMiktar = k.miktar
          if (kgKmOran && birimFarkli) {
            if (isMtBirim(orijinalBirim) && isKgBirim(katalogBirim)) {
              yeniMiktar = Math.round(k.miktar * kgKmOran / 1000 * 100) / 100
            } else if (isKgBirim(orijinalBirim) && isMtBirim(katalogBirim)) {
              yeniMiktar = Math.round(k.miktar / kgKmOran * 1000 * 100) / 100
            }
          }
          return {
            ...k,
            malzeme_adi: e.malzeme_cinsi || e.malzeme_tanimi_sap || k.malzeme_adi,
            malzeme_kodu: e.malzeme_kodu || '',
            poz_no: e.poz_birlesik || k.poz_no,
            birim: katalogBirim || k.birim,
            miktar: yeniMiktar,
            katalog_eslesme: e.malzeme_cinsi || e.malzeme_tanimi_sap,
            _birim_secenekleri: birimFarkli ? [orijinalBirim, katalogBirim] : null,
            _kg_km_oran: kgKmOran,
          }
        }
        return { ...k, _eslesmedi: true }
      }))
    } catch { /* eşleşme opsiyonel */ }
    setEslestiriliyor(false)
  }

  const handleTeslimSwap = () => {
    setSonuc(prev => ({
      ...prev,
      yer_teslim_yapan: { ad_soyad: prev.yer_teslim_alan?.ad_soyad || '', unvan: prev.yer_teslim_alan?.unvan || '', kurum: prev.yer_teslim_alan?.kurum || '' },
      yer_teslim_alan: { ad_soyad: prev.yer_teslim_yapan?.ad_soyad || '', unvan: prev.yer_teslim_yapan?.unvan || '', personel_id: null },
    }))
  }

  const handleOnayla = () => {
    const gecerliListe = demontajListesi.filter(d => d.malzeme_adi && d.malzeme_adi.trim() !== '')
    onSonuc({ ...sonuc, demontaj_listesi: gecerliListe, direk_listesi: [], _dosya: dosya })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-input px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Yer Teslim Tutanagi ile Proje Olustur</h3>
          </div>
          <button onClick={onKapat} className="rounded p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!sonuc ? (
            /* Upload + Analiz */
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Yer teslim tutanagi/krokisi gorselini yukleyin. AI goruntuyu analiz ederek proje bilgilerini ve demontaj listesini otomatik olarak dolduracak.
              </p>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-input p-8 hover:border-primary hover:bg-primary/5 transition-colors"
              >
                {onizleme ? (
                  <img src={onizleme} alt="Onizleme" className="max-h-64 rounded-lg object-contain" />
                ) : (
                  <>
                    <Image className="mb-3 h-12 w-12 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">Tiklayin veya surukleyin</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">JPG, PNG - Maks 15MB</p>
                  </>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleDosyaSec} className="hidden" />
              </div>
              {dosya && (
                <div className="flex items-center justify-between rounded-lg border border-input bg-muted/30 px-4 py-2">
                  <span className="text-sm">{dosya.name} ({(dosya.size / 1024 / 1024).toFixed(1)} MB)</span>
                  <button onClick={() => { setDosya(null); setOnizleme(null) }} className="text-xs text-red-500 hover:underline">Kaldir</button>
                </div>
              )}
              {hata && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />{hata}
                </div>
              )}
            </div>
          ) : (
            /* Sonuç + Düzenlenebilir Demontaj */
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <CheckCircle className="h-4 w-4 shrink-0" />
                Tutanak analiz edildi. Bilgileri kontrol edip onaylayin.
              </div>

              {/* Temel Bilgiler (düzenlenebilir) */}
              <div className="rounded-lg border border-input p-4">
                <h4 className="mb-3 text-sm font-semibold">Temel Bilgiler</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <label className="text-xs text-muted-foreground">Proje Tipi</label>
                    <input value={sonuc.proje_tipi || ''} onChange={e => setSonuc(p => ({ ...p, proje_tipi: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Proje Adi</label>
                    <input value={sonuc.proje_adi || ''} onChange={e => setSonuc(p => ({ ...p, proje_adi: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Il</label>
                    <input value={sonuc.il || ''} onChange={e => setSonuc(p => ({ ...p, il: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Ilce</label>
                    <input value={sonuc.ilce || ''} onChange={e => setSonuc(p => ({ ...p, ilce: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Mahalle</label>
                    <input value={sonuc.mahalle || ''} onChange={e => setSonuc(p => ({ ...p, mahalle: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Basvuru No</label>
                    <input value={sonuc.basvuru_no || ''} onChange={e => setSonuc(p => ({ ...p, basvuru_no: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Oncelik</label>
                    <select value={sonuc.oncelik || 'normal'} onChange={e => setSonuc(p => ({ ...p, oncelik: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30">
                      <option value="dusuk">Dusuk</option>
                      <option value="normal">Normal</option>
                      <option value="yuksek">Yuksek</option>
                      <option value="acil">Acil</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Telefon</label>
                    <input value={sonuc.telefon || ''} onChange={e => setSonuc(p => ({ ...p, telefon: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground">Adres</label>
                    <input value={sonuc.adres || ''} onChange={e => setSonuc(p => ({ ...p, adres: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                </div>
              </div>

              {/* Baglanti / Tesis Bilgileri (düzenlenebilir) */}
              <div className="rounded-lg border border-input p-4">
                <h4 className="mb-3 text-sm font-semibold">Baglanti / Tesis Bilgileri</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <label className="text-xs text-muted-foreground">Ada / Parsel</label>
                    <input value={sonuc.ada_parsel || ''} onChange={e => setSonuc(p => ({ ...p, ada_parsel: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Tesis</label>
                    <input value={sonuc.tesis || ''} onChange={e => setSonuc(p => ({ ...p, tesis: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Enerji Alinan Direk No</label>
                    <input value={sonuc.enerji_alinan_direk_no || ''} onChange={e => setSonuc(p => ({ ...p, enerji_alinan_direk_no: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Abone Kablosu</label>
                    <KatalogAramaInput
                      value={sonuc.abone_kablosu || ''}
                      onChange={val => setSonuc(p => ({ ...p, abone_kablosu: val }))}
                      placeholder="Orn: 2x10 NYY"
                      className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Abone Kablosu (metre)</label>
                    <input type="number" min="0" step="0.1" value={sonuc.abone_kablosu_metre || ''} onChange={e => setSonuc(p => ({ ...p, abone_kablosu_metre: e.target.value ? Number(e.target.value) : null }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Kesinti Ihtiyaci</label>
                    <select value={sonuc.kesinti_ihtiyaci == null ? '' : sonuc.kesinti_ihtiyaci ? '1' : '0'} onChange={e => setSonuc(p => ({ ...p, kesinti_ihtiyaci: e.target.value === '' ? null : e.target.value === '1' }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30">
                      <option value="">Belirtilmedi</option>
                      <option value="1">Evet</option>
                      <option value="0">Hayir</option>
                    </select>
                  </div>
                </div>
                {/* Izinler */}
                <div className="mt-3">
                  <label className="text-xs text-muted-foreground">Izinler</label>
                  <div className="mt-1 flex flex-wrap gap-3">
                    {[
                      { key: 'karayollari', label: 'Karayollari' },
                      { key: 'kazi_izni', label: 'Kazi Izni' },
                      { key: 'orman', label: 'Orman' },
                      { key: 'muvafakatname', label: 'Muvafakatname' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={sonuc.izinler?.[key] || false}
                          onChange={e => setSonuc(p => ({ ...p, izinler: { ...(p.izinler || {}), [key]: e.target.checked } }))}
                          className="rounded border-input accent-primary"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <input
                    value={sonuc.izinler?.diger || ''}
                    onChange={e => setSonuc(p => ({ ...p, izinler: { ...(p.izinler || {}), diger: e.target.value || null } }))}
                    className="mt-1.5 w-full rounded border border-input bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
                    placeholder="Diger izinler..."
                  />
                </div>
              </div>

              {/* Yer Teslim Yapan / Alan - Düzenlenebilir */}
              <div className="rounded-lg border border-input p-4">
                <h4 className="mb-3 text-sm font-semibold">Yer Teslim Bilgileri</h4>
                <div className="flex items-start gap-3">
                  {/* Teslim Yapan - Dis kisi autocomplete */}
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground font-medium">Teslim Yapan (Kurum)</label>
                    <DisKisiInput
                      value={sonuc.yer_teslim_yapan?.ad_soyad || ''}
                      onChange={(ad, kisi) => setSonuc(p => ({
                        ...p,
                        yer_teslim_yapan: {
                          ...(p.yer_teslim_yapan || {}),
                          ad_soyad: ad,
                          ...(kisi ? { unvan: kisi.unvan || p.yer_teslim_yapan?.unvan, kurum: kisi.kurum } : {}),
                        }
                      }))}
                      placeholder="Ad Soyad"
                    />
                    <input
                      value={sonuc.yer_teslim_yapan?.unvan || ''}
                      onChange={e => setSonuc(p => ({
                        ...p,
                        yer_teslim_yapan: { ...(p.yer_teslim_yapan || {}), unvan: e.target.value }
                      }))}
                      className="mt-1 w-full rounded border border-input bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                      placeholder="Unvan (orn: Kontrol Muhendisi)"
                    />
                    {sonuc.yer_teslim_yapan?.kurum && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        Kurum: {sonuc.yer_teslim_yapan.kurum}
                      </div>
                    )}
                  </div>

                  {/* Swap butonu */}
                  <button
                    type="button"
                    onClick={handleTeslimSwap}
                    className="mt-5 shrink-0 rounded-full border border-input p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary hover:border-primary"
                    title="Teslim yapan ve alani degistir"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                  </button>

                  {/* Teslim Alan - Personel autocomplete */}
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground font-medium">Teslim Alan (Yuklenici)</label>
                    <PersonelSecici
                      value={sonuc.yer_teslim_alan?.ad_soyad || ''}
                      onChange={(ad, personel) => setSonuc(p => ({
                        ...p,
                        yer_teslim_alan: {
                          ...(p.yer_teslim_alan || {}),
                          ad_soyad: ad,
                          personel_id: personel?.id || null,
                        }
                      }))}
                      personeller={personeller}
                    />
                    <input
                      value={sonuc.yer_teslim_alan?.unvan || ''}
                      onChange={e => setSonuc(p => ({
                        ...p,
                        yer_teslim_alan: { ...(p.yer_teslim_alan || {}), unvan: e.target.value }
                      }))}
                      className="mt-1 w-full rounded border border-input bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                      placeholder="Unvan (orn: Yuklenici)"
                    />
                  </div>
                </div>
              </div>

              {/* Demontaj Listesi */}
              <div className="rounded-lg border border-input p-4">
                <DemontajListesiDuzenle
                  liste={demontajListesi}
                  onChange={setDemontajListesi}
                  eslestiriliyor={eslestiriliyor}
                  aciklama="Malzeme adini yazmaya baslayin, malzeme katalogdan otomatik eslestirme yapilacaktir."
                />
              </div>

              {/* Notlar */}
              <div className="rounded-lg border border-input p-4">
                <h4 className="mb-2 text-sm font-semibold">Ek Notlar</h4>
                <textarea
                  value={sonuc.notlar || ''}
                  onChange={e => setSonuc(p => ({ ...p, notlar: e.target.value }))}
                  rows={3}
                  className="w-full rounded border border-input bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
                  placeholder="Ek notlar..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-input px-5 py-4">
          <button onClick={onKapat} className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-muted">Iptal</button>
          {!sonuc ? (
            <button
              onClick={handleAnaliz}
              disabled={!dosya || yukleniyor}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {yukleniyor ? (
                <><Loader2 className="h-4 w-4 animate-spin" />AI Analiz Ediyor...</>
              ) : (
                <><Sparkles className="h-4 w-4" />Analiz Et</>
              )}
            </button>
          ) : (
            <>
              <button onClick={() => { setSonuc(null); setDemontajListesi([]) }} className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-muted">Tekrar Dene</button>
              <button
                onClick={handleOnayla}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <CheckCircle className="h-4 w-4" />
                Onayla ve Forma Aktar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
