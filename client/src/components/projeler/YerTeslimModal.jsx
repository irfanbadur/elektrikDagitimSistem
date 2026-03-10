import { useState, useRef, useEffect } from 'react'
import { X, Sparkles, Loader2, CheckCircle, AlertCircle, Image, Plus, Trash2, Link2, Unlink } from 'lucide-react'
import { useDepoKatalog } from '@/hooks/useDepoKatalog'
import api from '@/api/client'
import { cn } from '@/lib/utils'

// Katalog adından Kg/Km oranını çıkar (ör: "ROSE AWG 4 (59.15Kg/Km)" → 59.15)
function extractKgKmOran(text) {
  if (!text) return null
  const match = text.match(/(\d+[.,]?\d*)\s*kg\s*\/\s*km/i)
  if (!match) return null
  return parseFloat(match[1].replace(',', '.'))
}

const MT_BIRIMLER = ['mt', 'm', 'metre', 'meter']
const KG_BIRIMLER = ['kg', 'kilogram']
const isMtBirim = (b) => MT_BIRIMLER.includes((b || '').toLowerCase())
const isKgBirim = (b) => KG_BIRIMLER.includes((b || '').toLowerCase())

function DemontajSatirDuzenle({ kalem, index, onChange, onSil }) {
  const [focused, setFocused] = useState(false)
  const [aramaDebounced, setAramaDebounced] = useState('')
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  // Debounce malzeme_adi for catalog search
  useEffect(() => {
    const t = setTimeout(() => setAramaDebounced(kalem.malzeme_adi), 300)
    return () => clearTimeout(t)
  }, [kalem.malzeme_adi])

  // Click outside to close dropdown
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) && inputRef.current && !inputRef.current.contains(e.target))
        setFocused(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const { data: sonuclar, isLoading: araniyor } = useDepoKatalog(
    focused && aramaDebounced.length >= 1 && !kalem.katalog_eslesme ? { arama: aramaDebounced } : null
  )

  const handleKatalogSec = (item) => {
    const katalogBirim = item.olcu || ''
    const orijinalBirim = kalem.birim || 'Ad'
    const birimFarkli = katalogBirim && orijinalBirim &&
      katalogBirim.toLowerCase().replace(/\./g, '') !== orijinalBirim.toLowerCase().replace(/\./g, '')
    const katalogText = `${item.malzeme_cinsi || ''} ${item.malzeme_tanimi_sap || ''}`
    const kgKmOran = birimFarkli ? extractKgKmOran(katalogText) : null
    onChange(index, {
      ...kalem,
      malzeme_adi: item.malzeme_cinsi || item.malzeme_tanimi_sap || kalem.malzeme_adi,
      malzeme_kodu: item.malzeme_kodu || '',
      poz_no: item.poz_birlesik || '',
      birim: birimFarkli ? orijinalBirim : (katalogBirim || kalem.birim),
      katalog_eslesme: item.malzeme_cinsi || item.malzeme_tanimi_sap,
      _eslesmedi: false,
      _birim_secenekleri: birimFarkli ? [orijinalBirim, katalogBirim] : null,
      _kg_km_oran: kgKmOran,
    })
    setFocused(false)
  }

  const handleMalzemeAdiDegistir = (e) => {
    onChange(index, { ...kalem, malzeme_adi: e.target.value, katalog_eslesme: null, _eslesmedi: false, _birim_secenekleri: null, _kg_km_oran: null })
  }

  const showDropdown = focused && aramaDebounced.length >= 1 && !kalem.katalog_eslesme

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
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => { if (e.key === 'Escape') setFocused(false) }}
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium hover:border-input focus:border-primary focus:outline-none"
          placeholder="Malzeme adi yazin..."
        />
        {showDropdown && (
          <div ref={dropdownRef} className="absolute left-0 top-full z-50 mt-1 max-h-48 w-[450px] overflow-y-auto rounded-lg border border-input bg-card shadow-xl">
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
                    <th className="px-2 py-1 text-left font-medium text-muted-foreground">Birim</th>
                  </tr>
                </thead>
                <tbody>
                  {sonuclar.slice(0, 20).map((item) => (
                    <tr key={item.id} onMouseDown={() => handleKatalogSec(item)} className="cursor-pointer border-b border-input/30 hover:bg-primary/5">
                      <td className="px-2 py-1 font-mono text-blue-600 whitespace-nowrap">{item.poz_birlesik || '-'}</td>
                      <td className="px-2 py-1">{item.malzeme_cinsi || item.malzeme_tanimi_sap || '-'}</td>
                      <td className="px-2 py-1 text-muted-foreground">{item.olcu || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
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
        <input value={kalem.birim || 'Ad'} onChange={(e) => onChange(index, { ...kalem, birim: e.target.value })} className="w-12 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-center hover:border-input focus:border-primary focus:outline-none" />
      </td>
      <td className="px-2 py-1.5">
        <input type="number" value={kalem.miktar || ''} onChange={(e) => onChange(index, { ...kalem, miktar: Number(e.target.value) || 0 })} className="w-14 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-center hover:border-input focus:border-primary focus:outline-none" />
      </td>
      <td className="px-2 py-1.5 text-right">
        <button onClick={() => onSil(index)} className="rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600">
          <Trash2 className="h-3 w-3" />
        </button>
      </td>
    </tr>
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
      setSonuc(json.data)

      // Demontaj listesini state'e al ve katalog eşleştirmesi yap
      const liste = (json.data.demontaj_listesi || []).map(d => ({
        malzeme_adi: d.malzeme_adi || '',
        birim: d.birim || 'Ad',
        miktar: d.miktar || 1,
        poz_no: d.poz_no || '',
        malzeme_kodu: '',
        notlar: d.notlar || '',
        katalog_eslesme: null,
        _eslesmedi: false,
      }))
      setDemontajListesi(liste)

      // Katalog eşleştirme
      if (liste.length > 0) {
        setEslestiriliyor(true)
        try {
          const eslesmeRes = await api.post('/depo-katalog/eslestir', { kalemler: liste })
          const eslesmeler = eslesmeRes?.data || []
          setDemontajListesi(prev => prev.map((k, i) => {
            const e = eslesmeler[i]?.eslesme
            if (e) {
              const katalogBirim = e.olcu || ''
              const orijinalBirim = k.birim || 'Ad'
              const birimFarkli = katalogBirim && orijinalBirim &&
                katalogBirim.toLowerCase().replace(/\./g, '') !== orijinalBirim.toLowerCase().replace(/\./g, '')
              const kgKmOran = birimFarkli ? extractKgKmOran(`${e.malzeme_cinsi || ''} ${e.malzeme_tanimi_sap || ''}`) : null
              return {
                ...k,
                malzeme_kodu: e.malzeme_kodu || '',
                poz_no: e.poz_birlesik || k.poz_no,
                birim: birimFarkli ? orijinalBirim : (katalogBirim || k.birim),
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
    } catch (err) {
      setHata(err.message || 'Analiz sirasinda hata olustu')
    } finally {
      setYukleniyor(false)
    }
  }

  const handleDemontajDegistir = (index, yeni) => {
    setDemontajListesi(prev => prev.map((k, i) => i === index ? yeni : k))
  }

  const handleDemontajSil = (index) => {
    setDemontajListesi(prev => prev.filter((_, i) => i !== index))
  }

  const handleDemontajEkle = () => {
    setDemontajListesi(prev => [...prev, { malzeme_adi: '', birim: 'Ad', miktar: 1, poz_no: '', malzeme_kodu: '', notlar: '', katalog_eslesme: null, _eslesmedi: false }])
  }

  const handleOnayla = () => {
    onSonuc({ ...sonuc, demontaj_listesi: demontajListesi, _dosya: dosya })
  }

  const eslesmeOrani = demontajListesi.length > 0
    ? Math.round(demontajListesi.filter(d => d.katalog_eslesme).length / demontajListesi.length * 100)
    : 0

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
                Tutanak analiz edildi. Demontaj listesini duzenleyip onaylayin.
              </div>

              {/* Temel Bilgiler (kisa ozet) */}
              <div className="rounded-lg border border-input p-4">
                <h4 className="mb-3 text-sm font-semibold">Temel Bilgiler</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Proje Tipi:</span> <strong>{sonuc.proje_tipi || '-'}</strong></div>
                  <div><span className="text-muted-foreground">Proje Adi:</span> <strong>{sonuc.proje_adi || sonuc.musteri_adi || '-'}</strong></div>
                  <div><span className="text-muted-foreground">Mahalle:</span> <strong>{sonuc.mahalle || '-'}</strong></div>
                  <div><span className="text-muted-foreground">Oncelik:</span> <strong>{sonuc.oncelik || 'normal'}</strong></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Adres:</span> <strong>{sonuc.adres || '-'}</strong></div>
                </div>
              </div>

              {/* Yer Teslim Yapanlar */}
              {(sonuc.yer_teslim_yapan || sonuc.yer_teslim_alan) && (
                <div className="rounded-lg border border-input p-4">
                  <h4 className="mb-3 text-sm font-semibold">Yer Teslim Bilgileri</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {sonuc.yer_teslim_yapan && (
                      <div><span className="text-muted-foreground">Teslim Yapan:</span> <strong>{sonuc.yer_teslim_yapan.ad_soyad || '-'}</strong>{sonuc.yer_teslim_yapan.unvan && <span className="text-xs text-muted-foreground"> ({sonuc.yer_teslim_yapan.unvan})</span>}</div>
                    )}
                    {sonuc.yer_teslim_alan && (
                      <div><span className="text-muted-foreground">Teslim Alan:</span> <strong>{sonuc.yer_teslim_alan.ad_soyad || '-'}</strong>{sonuc.yer_teslim_alan.unvan && <span className="text-xs text-muted-foreground"> ({sonuc.yer_teslim_alan.unvan})</span>}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Demontaj Listesi - Düzenlenebilir */}
              <div className="rounded-lg border border-input p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h4 className="text-sm font-semibold">Demontaj Listesi</h4>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{demontajListesi.length} kalem</span>
                    {eslestiriliyor ? (
                      <span className="flex items-center gap-1 text-xs text-primary"><Loader2 className="h-3 w-3 animate-spin" />Katalog eslestiriliyor...</span>
                    ) : demontajListesi.length > 0 && (
                      <span className={cn('text-xs font-medium', eslesmeOrani >= 80 ? 'text-emerald-600' : eslesmeOrani >= 50 ? 'text-amber-600' : 'text-red-600')}>
                        %{eslesmeOrani} katalog eslesmesi
                      </span>
                    )}
                  </div>
                  <button onClick={handleDemontajEkle} className="flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20">
                    <Plus className="h-3 w-3" />Ekle
                  </button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-input bg-card">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-input bg-muted/50">
                        <th className="w-8 px-2 py-2 text-center font-medium text-muted-foreground">#</th>
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground">Malzeme</th>
                        <th className="w-16 px-2 py-2 text-center font-medium text-muted-foreground">Birim</th>
                        <th className="w-16 px-2 py-2 text-center font-medium text-muted-foreground">Miktar</th>
                        <th className="w-8 px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {demontajListesi.length === 0 ? (
                        <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Demontaj kalemi yok</td></tr>
                      ) : (
                        demontajListesi.map((k, i) => (
                          <DemontajSatirDuzenle key={i} kalem={k} index={i} onChange={handleDemontajDegistir} onSil={handleDemontajSil} />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">Malzeme adini yazmaya baslayin, depo katalogdan otomatik eslestirme yapilacaktir.</p>
              </div>

              {/* Notlar */}
              {sonuc.notlar && (
                <div className="rounded-lg border border-input p-4">
                  <h4 className="mb-2 text-sm font-semibold">Ek Notlar</h4>
                  <p className="text-sm text-muted-foreground">{sonuc.notlar}</p>
                </div>
              )}
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
