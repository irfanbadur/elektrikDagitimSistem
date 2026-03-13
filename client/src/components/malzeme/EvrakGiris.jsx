import { useState, useRef, useEffect } from 'react'
import {
  Sparkles, Loader2, CheckCircle, AlertCircle, Image, Trash2,
  Upload, FileText, X, AlertTriangle, Camera, Columns3, ChevronUp, ChevronDown, Check,
} from 'lucide-react'
import api from '@/api/client'
import { useHareketKaydet } from '@/hooks/useHareketler'
import { cn } from '@/lib/utils'

const KABUL_EDILEN = 'image/jpeg,image/png,image/webp,application/pdf'

// Tüm sütun tanımları - kullanıcı bunları aç/kapa yapabilir
const TUM_SUTUNLAR = [
  { key: 'sira_no', label: 'No', varsayilan: true, genislik: 'w-10', sabit: true },
  { key: 'malzeme_kodu', label: 'Malzeme Kodu', varsayilan: true, genislik: 'w-24' },
  { key: 'poz_no', label: 'Poz No', varsayilan: true, genislik: 'w-28' },
  { key: 'malzeme_adi_belge', label: 'Belge Adı', varsayilan: false, genislik: 'min-w-[150px]' },
  { key: 'malzeme_tanimi_sap', label: 'SAP Tanımı', varsayilan: true, genislik: 'min-w-[180px]' },
  { key: 'malzeme_cinsi', label: 'Malzeme Cinsi', varsayilan: true, genislik: 'min-w-[180px]' },
  { key: 'birim', label: 'Birim', varsayilan: true, genislik: 'w-14' },
  { key: 'miktar_bono', label: 'Bono Mkt', varsayilan: true, genislik: 'w-16', tip: 'bono' },
  { key: 'miktar_irsaliye', label: 'İrs. Mkt', varsayilan: true, genislik: 'w-16', tip: 'irsaliye' },
  { key: 'kaynak', label: 'Kaynak', varsayilan: true, genislik: 'w-20' },
  { key: 'eslesme', label: 'Eşleşme', varsayilan: true, genislik: 'w-16' },
]

function SutunSecici({ gorunurSutunlar, setGorunurSutunlar }) {
  const [acik, setAcik] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setAcik(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleSutun = (key) => {
    const sutun = TUM_SUTUNLAR.find(s => s.key === key)
    if (sutun?.sabit) return
    setGorunurSutunlar(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }
  const tumunuSec = () => setGorunurSutunlar(TUM_SUTUNLAR.map(s => s.key))
  const sifirla = () => setGorunurSutunlar(TUM_SUTUNLAR.filter(s => s.varsayilan).map(s => s.key))

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAcik(!acik)}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
          acik ? 'border-primary bg-primary/5 text-primary' : 'border-input bg-background hover:bg-muted'
        )}
      >
        <Columns3 className="h-3.5 w-3.5" />
        Sutunlar
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
          {gorunurSutunlar.length}/{TUM_SUTUNLAR.length}
        </span>
        {acik ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {acik && (
        <div className="absolute right-0 z-50 mt-1 w-56 rounded-lg border border-input bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-input px-3 py-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Gorunur Sutunlar</span>
            <div className="flex gap-1">
              <button onClick={tumunuSec} className="rounded px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/10">Tumu</button>
              <button onClick={sifirla} className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted">Sifirla</button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {TUM_SUTUNLAR.map(sutun => {
              const secili = gorunurSutunlar.includes(sutun.key)
              return (
                <button
                  key={sutun.key}
                  onClick={() => toggleSutun(sutun.key)}
                  disabled={sutun.sabit}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors',
                    sutun.sabit ? 'opacity-50 cursor-not-allowed' :
                    secili ? 'text-foreground hover:bg-muted' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <div className={cn(
                    'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors',
                    secili ? 'border-primary bg-primary text-white' : 'border-input bg-background'
                  )}>
                    {secili && <Check className="h-2.5 w-2.5" />}
                  </div>
                  {sutun.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function DosyaOnizleme({ dosya, onSil }) {
  const [src, setSrc] = useState(null)
  if (!src && dosya.type.startsWith('image/')) {
    const reader = new FileReader()
    reader.onload = (e) => setSrc(e.target.result)
    reader.readAsDataURL(dosya)
  }
  return (
    <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-input bg-muted">
      {dosya.type.startsWith('image/') && src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center">
          <FileText className="h-6 w-6 text-muted-foreground" />
          <span className="mt-0.5 text-[9px] text-muted-foreground">PDF</span>
        </div>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onSil() }}
        className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white shadow-sm"
      >
        <X className="h-3 w-3" />
      </button>
      <div className="absolute bottom-0 left-0 right-0 truncate bg-black/50 px-1 text-[8px] text-white">
        {dosya.name}
      </div>
    </div>
  )
}

function DosyaYuklemeAlani({ etiket, dosyalar, onChange, onCameraCapture, onSil, inputRef, cameraRef }) {
  return (
    <div className="flex-1 min-w-0">
      <label className="mb-1.5 block text-sm font-medium">{etiket}</label>
      <div
        className={cn(
          'rounded-lg border-2 border-dashed p-3 transition-colors',
          dosyalar.length > 0 ? 'border-primary/40 bg-primary/5' : 'border-input'
        )}
      >
        {/* Gizli inputlar */}
        <input
          ref={inputRef}
          type="file"
          accept={KABUL_EDILEN}
          multiple
          onChange={onChange}
          className="hidden"
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onCameraCapture}
          className="hidden"
        />

        {dosyalar.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {dosyalar.map((d, i) => (
              <DosyaOnizleme key={i} dosya={d} onSil={() => onSil(i)} />
            ))}
          </div>
        ) : (
          <div
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center py-4"
          >
            <Image className="mb-1 h-8 w-8 text-muted-foreground/40" />
            <p className="text-xs font-medium text-muted-foreground">Gorsel veya PDF yukle</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground/70">JPG, PNG, PDF</p>
          </div>
        )}

        {/* Aksiyon butonlari */}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-muted active:bg-muted/80"
          >
            <Camera className="h-4 w-4" />
            <span className="hidden xs:inline">Fotograf Cek</span>
            <span className="xs:hidden">Cek</span>
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-muted active:bg-muted/80"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden xs:inline">Dosya Sec</span>
            <span className="xs:hidden">Sec</span>
          </button>
        </div>
      </div>
      {dosyalar.length > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">{dosyalar.length} dosya eklendi</p>
      )}
    </div>
  )
}

export default function EvrakGiris({ onBasarili, hareketYon = 'giris', karsiTarafAdi = '', karsiTarafTipi = '', kaynakDepoId = null, hedefDepoId = null, verenAdi = '', alanAdi = '' }) {
  const [bonoDosyalar, setBonoDosyalar] = useState([])
  const [irsaliyeDosyalar, setIrsaliyeDosyalar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [analizDurum, setAnalizDurum] = useState('')
  const [hataMsg, setHataMsg] = useState('')
  const [sonuc, setSonuc] = useState(null)
  const [kalemler, setKalemler] = useState([])
  const [bonoInfo, setBonoInfo] = useState({ bono_no: '', bono_tarihi: '', kurum: '', teslim_alan: '', aciklama: '' })
  const [irsaliyeInfo, setIrsaliyeInfo] = useState({ irsaliye_no: '', irsaliye_tarihi: '', firma: '', teslim_alan: '', aciklama: '' })
  const [eslestiriliyor, setEslestiriliyor] = useState(false)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [gorunurSutunlar, setGorunurSutunlar] = useState(
    TUM_SUTUNLAR.filter(s => s.varsayilan).map(s => s.key)
  )

  const bonoInputRef = useRef(null)
  const bonoCameraRef = useRef(null)
  const irsaliyeInputRef = useRef(null)
  const irsaliyeCameraRef = useRef(null)
  const hareketKaydet = useHareketKaydet()

  const handleDosyaEkle = (e, setter) => {
    const files = Array.from(e.target.files || [])
    const valid = files.filter(f => f.type.startsWith('image/') || f.type === 'application/pdf')
    if (valid.length < files.length) setHataMsg('Sadece gorsel ve PDF dosyalar desteklenir')
    setter(prev => [...prev, ...valid])
    e.target.value = ''
  }

  const handleKameraCek = (e, setter) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setter(prev => [...prev, file])
    }
    e.target.value = ''
  }

  const handleDosyaSil = (setter, index) => {
    setter(prev => prev.filter((_, i) => i !== index))
  }

  const handleAnaliz = async () => {
    if (bonoDosyalar.length === 0 && irsaliyeDosyalar.length === 0) {
      setHataMsg('En az bir dosya yuklenmelidir')
      return
    }
    setYukleniyor(true)
    setHataMsg('')
    setAnalizDurum('Belgeler sunucuya yukleniyor...')
    try {
      const formData = new FormData()
      bonoDosyalar.forEach(f => formData.append('bono_dosyalari', f))
      irsaliyeDosyalar.forEach(f => formData.append('irsaliye_dosyalari', f))

      const toplamSayfa = bonoDosyalar.length + irsaliyeDosyalar.length
      setAnalizDurum(`${toplamSayfa} sayfa AI ile analiz ediliyor... (sayfa basina ~15sn)`)

      // Her sayfa icin ~20sn + biraz tampon = min 5dk timeout
      const timeoutMs = Math.max(toplamSayfa * 30000, 120000)
      const res = await fetch('/api/hareketler/parse', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData,
        signal: AbortSignal.timeout(timeoutMs),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Analiz hatasi')
      if (json.data?.parse_error) throw new Error('AI belgeleri okuyamadi. Daha net gorseller yukleyin.')

      const data = json.data
      setSonuc(data)

      // Bono bilgilerini doldur
      const bb = data.bono_bilgi || {}
      setBonoInfo({
        bono_no: bb.bono_no || '',
        bono_tarihi: bb.bono_tarihi || new Date().toISOString().split('T')[0],
        kurum: bb.kurum || 'EDAS',
        teslim_alan: bb.teslim_alan || '',
        aciklama: bb.aciklama || '',
      })

      // Irsaliye bilgilerini doldur
      const ib = data.irsaliye_bilgi || {}
      setIrsaliyeInfo({
        irsaliye_no: ib.irsaliye_no || '',
        irsaliye_tarihi: ib.irsaliye_tarihi || '',
        firma: ib.firma || '',
        teslim_alan: ib.teslim_alan || '',
        aciklama: ib.aciklama || '',
      })

      const liste = (data.kalemler || []).map((k, i) => ({
        _id: i,
        _sira: k.sira_no || i + 1,
        malzeme_kodu: k.malzeme_kodu || '',
        poz_no: k.poz_no || '',
        malzeme_adi_belge: k.malzeme_adi || '',
        malzeme_tanimi_sap: '',
        malzeme_cinsi: '',
        malzeme_adi: k.malzeme_adi || '',
        birim: k.birim || 'Ad',
        miktar_bono: k.miktar_bono || 0,
        miktar_irsaliye: k.miktar_irsaliye || 0,
        kaynak: k.kaynak || 'bono',
        uyumsuzluk: k.uyumsuzluk || false,
        _secili: true,
      }))
      setKalemler(liste)

      if (liste.length > 0) katalogEslestir(liste)
    } catch (err) {
      if (err.name === 'TimeoutError') {
        setHataMsg('Analiz zaman asimina ugradi. Daha az sayfa ile deneyin veya gorselleri kucultun.')
      } else {
        setHataMsg(err.message || 'Analiz sirasinda hata olustu')
      }
    } finally {
      setYukleniyor(false)
      setAnalizDurum('')
    }
  }

  const katalogEslestir = async (liste) => {
    setEslestiriliyor(true)
    try {
      const eslesmeRes = await api.post('/malzeme-katalog/eslestir', { kalemler: liste })
      const eslesmeler = eslesmeRes?.data || []
      setKalemler(prev => prev.map((k, i) => {
        const e = eslesmeler[i]?.eslesme
        if (e) {
          return {
            ...k,
            malzeme_kodu: e.malzeme_kodu || k.malzeme_kodu,
            poz_no: e.poz_birlesik || k.poz_no,
            malzeme_tanimi_sap: e.malzeme_tanimi_sap || '',
            malzeme_cinsi: e.malzeme_cinsi || '',
            malzeme_adi: e.malzeme_cinsi || e.malzeme_tanimi_sap || k.malzeme_adi,
            birim: e.olcu || k.birim,
            _katalog_eslesme: true,
          }
        }
        return { ...k, _katalog_eslesme: false }
      }))
    } catch { /* opsiyonel */ }
    setEslestiriliyor(false)
  }

  const handleKalemDegistir = (id, alan, deger) => {
    setKalemler(prev => prev.map(k => k._id === id ? { ...k, [alan]: deger } : k))
  }

  const handleKalemSil = (id) => {
    setKalemler(prev => prev.filter(k => k._id !== id))
  }

  const handleKalemSecToggle = (id) => {
    setKalemler(prev => prev.map(k => k._id === id ? { ...k, _secili: !k._secili } : k))
  }

  const handleOnayla = async () => {
    const seciliKalemler = kalemler.filter(k => k._secili && k.malzeme_adi)
    if (seciliKalemler.length === 0) {
      setHataMsg('En az bir malzeme secilmelidir')
      return
    }

    const hasBono = bonoDosyalar.length > 0
    const hasIrsaliye = irsaliyeDosyalar.length > 0

    if (hasBono && !bonoInfo.bono_no) {
      setHataMsg('Bono no zorunludur')
      return
    }
    if (hasIrsaliye && !irsaliyeInfo.irsaliye_no) {
      setHataMsg('Irsaliye no zorunludur')
      return
    }
    if (!bonoInfo.bono_tarihi && !irsaliyeInfo.irsaliye_tarihi) {
      setHataMsg('Tarih zorunludur')
      return
    }

    setKaydediliyor(true)
    try {
      const formData = new FormData()

      // Hareket verilerini JSON olarak ekle
      formData.append('hareket_data', JSON.stringify({
        hareket_tipi: hareketYon,
        karsi_taraf_adi: karsiTarafAdi,
        karsi_taraf_tipi: karsiTarafTipi,
        veren_adi: verenAdi,
        alan_adi: alanAdi,
        kaynak_depo_id: kaynakDepoId,
        hedef_depo_id: hedefDepoId,
        bono_bilgi: hasBono ? bonoInfo : null,
        irsaliye_bilgi: hasIrsaliye ? irsaliyeInfo : null,
        teslim_alan: bonoInfo.teslim_alan || irsaliyeInfo.teslim_alan || null,
        teslim_eden: bonoInfo.teslim_eden || irsaliyeInfo.sevk_eden || null,
        kalemler: seciliKalemler.map(({ _id, _sira, _secili, _katalog_eslesme, uyumsuzluk, malzeme_adi_belge, ...rest }) => ({
          ...rest,
          sira_no: _sira,
          malzeme_adi: rest.malzeme_adi || rest.malzeme_cinsi || rest.malzeme_tanimi_sap || malzeme_adi_belge || '',
        })),
      }))

      // Dosyaları ekle
      bonoDosyalar.forEach(f => formData.append('bono_dosyalari', f))
      irsaliyeDosyalar.forEach(f => formData.append('irsaliye_dosyalari', f))

      await hareketKaydet.mutateAsync(formData)
      onBasarili?.()
    } catch (err) {
      setHataMsg(err.message || 'Kaydetme sirasinda hata olustu')
    } finally {
      setKaydediliyor(false)
    }
  }

  const handleSifirla = () => {
    setSonuc(null)
    setKalemler([])
    setBonoDosyalar([])
    setIrsaliyeDosyalar([])
    setHataMsg('')
    setBonoInfo({ bono_no: '', bono_tarihi: '', kurum: '', teslim_alan: '', aciklama: '' })
    setIrsaliyeInfo({ irsaliye_no: '', irsaliye_tarihi: '', firma: '', teslim_alan: '', aciklama: '' })
  }

  const seciliSayisi = kalemler.filter(k => k._secili).length
  const uyumsuzSayisi = kalemler.filter(k => k.uyumsuzluk).length
  const hasBono = bonoDosyalar.length > 0
  const hasIrsaliye = irsaliyeDosyalar.length > 0

  return (
    <div className="space-y-4">
      {/* Dosya yukleme alanlari */}
      {!sonuc && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Bono ve/veya irsaliye belgelerini yukleyin. Fotograf cekerek veya galeriden secebilirsiniz.
            Birden fazla gorsel ve PDF desteklenir. Her iki belge tipi yuklendiginde AI capraz karsilastirmali analiz yapar.
          </p>

          <div className="flex flex-col gap-4 md:flex-row">
            <DosyaYuklemeAlani
              etiket="Bono Belgeleri"
              dosyalar={bonoDosyalar}
              onChange={(e) => handleDosyaEkle(e, setBonoDosyalar)}
              onCameraCapture={(e) => handleKameraCek(e, setBonoDosyalar)}
              onSil={(i) => handleDosyaSil(setBonoDosyalar, i)}
              inputRef={bonoInputRef}
              cameraRef={bonoCameraRef}
            />
            <DosyaYuklemeAlani
              etiket="Irsaliye Belgeleri"
              dosyalar={irsaliyeDosyalar}
              onChange={(e) => handleDosyaEkle(e, setIrsaliyeDosyalar)}
              onCameraCapture={(e) => handleKameraCek(e, setIrsaliyeDosyalar)}
              onSil={(i) => handleDosyaSil(setIrsaliyeDosyalar, i)}
              inputRef={irsaliyeInputRef}
              cameraRef={irsaliyeCameraRef}
            />
          </div>

          {(hasBono || hasIrsaliye) && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-muted-foreground">
                {bonoDosyalar.length > 0 && `${bonoDosyalar.length} bono`}
                {bonoDosyalar.length > 0 && irsaliyeDosyalar.length > 0 && ' + '}
                {irsaliyeDosyalar.length > 0 && `${irsaliyeDosyalar.length} irsaliye`}
                {' belgesi secildi'}
              </span>
              <button
                onClick={handleAnaliz}
                disabled={yukleniyor}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50 sm:w-auto"
              >
                {yukleniyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {yukleniyor
                  ? (analizDurum || `Analiz ediliyor...`)
                  : 'AI ile Analiz Et'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Hata */}
      {hataMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {hataMsg}
        </div>
      )}

      {/* Sonuc */}
      {sonuc && (
        <>
          {/* Belge bilgileri - yan yana */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Bono Bilgileri */}
            {hasBono && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-4">
                <h4 className="mb-3 text-sm font-semibold text-blue-800">Bono Bilgileri</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Bono No *</label>
                    <input
                      value={bonoInfo.bono_no}
                      onChange={e => setBonoInfo({ ...bonoInfo, bono_no: e.target.value })}
                      className="mt-0.5 w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Tarih *</label>
                    <input
                      type="date"
                      value={bonoInfo.bono_tarihi}
                      onChange={e => setBonoInfo({ ...bonoInfo, bono_tarihi: e.target.value })}
                      className="mt-0.5 w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Kurum</label>
                    <input
                      value={bonoInfo.kurum}
                      onChange={e => setBonoInfo({ ...bonoInfo, kurum: e.target.value })}
                      className="mt-0.5 w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Teslim Alan</label>
                    <input
                      value={bonoInfo.teslim_alan}
                      onChange={e => setBonoInfo({ ...bonoInfo, teslim_alan: e.target.value })}
                      className="mt-0.5 w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Irsaliye Bilgileri */}
            {hasIrsaliye && (
              <div className="rounded-lg border border-orange-200 bg-orange-50/30 p-4">
                <h4 className="mb-3 text-sm font-semibold text-orange-800">Irsaliye Bilgileri</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Irsaliye No *</label>
                    <input
                      value={irsaliyeInfo.irsaliye_no}
                      onChange={e => setIrsaliyeInfo({ ...irsaliyeInfo, irsaliye_no: e.target.value })}
                      className="mt-0.5 w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Tarih</label>
                    <input
                      type="date"
                      value={irsaliyeInfo.irsaliye_tarihi}
                      onChange={e => setIrsaliyeInfo({ ...irsaliyeInfo, irsaliye_tarihi: e.target.value })}
                      className="mt-0.5 w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Firma</label>
                    <input
                      value={irsaliyeInfo.firma}
                      onChange={e => setIrsaliyeInfo({ ...irsaliyeInfo, firma: e.target.value })}
                      className="mt-0.5 w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Teslim Alan</label>
                    <input
                      value={irsaliyeInfo.teslim_alan}
                      onChange={e => setIrsaliyeInfo({ ...irsaliyeInfo, teslim_alan: e.target.value })}
                      className="mt-0.5 w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Parse meta bilgisi */}
          {sonuc._meta && (bonoDosyalar.length > 1 || irsaliyeDosyalar.length > 1) && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-700">
              <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {sonuc._meta.bono_sayfa > 0 && `${sonuc._meta.bono_parse_basarili}/${sonuc._meta.bono_sayfa} bono sayfasi okundu`}
              {sonuc._meta.bono_sayfa > 0 && sonuc._meta.irsaliye_sayfa > 0 && ' · '}
              {sonuc._meta.irsaliye_sayfa > 0 && `${sonuc._meta.irsaliye_parse_basarili}/${sonuc._meta.irsaliye_sayfa} irsaliye sayfasi okundu`}
              {' · '}{kalemler.length} kalem bulundu
            </div>
          )}

          {/* Uyumsuzluk uyarisi */}
          {uyumsuzSayisi > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {uyumsuzSayisi} kalemde bono-irsaliye miktar uyumsuzlugu tespit edildi.
            </div>
          )}

          {/* Kalemler tablosu */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">
                Malzeme Kalemleri
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({seciliSayisi}/{kalemler.length} secili)
                </span>
              </h4>
              <div className="flex items-center gap-2">
                {eslestiriliyor && (
                  <span className="flex items-center gap-1 text-xs text-primary">
                    <Loader2 className="h-3 w-3 animate-spin" /> Katalog eslestiriliyor...
                  </span>
                )}
                <SutunSecici gorunurSutunlar={gorunurSutunlar} setGorunurSutunlar={setGorunurSutunlar} />
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-input">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-input bg-muted/50">
                      <th className="px-2 py-2 w-8">
                        <input
                          type="checkbox"
                          checked={kalemler.length > 0 && seciliSayisi === kalemler.length}
                          onChange={() => {
                            const tumSecili = seciliSayisi === kalemler.length
                            setKalemler(prev => prev.map(k => ({ ...k, _secili: !tumSecili })))
                          }}
                          className="rounded"
                        />
                      </th>
                      {gorunurSutunlar.includes('sira_no') && (
                        <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground w-10">No</th>
                      )}
                      {gorunurSutunlar.includes('malzeme_kodu') && (
                        <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">Malzeme Kodu</th>
                      )}
                      {gorunurSutunlar.includes('poz_no') && (
                        <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">Poz No</th>
                      )}
                      {gorunurSutunlar.includes('malzeme_adi_belge') && (
                        <th className="px-2 py-2 text-left text-xs font-semibold text-purple-600">Belge Adi</th>
                      )}
                      {gorunurSutunlar.includes('malzeme_tanimi_sap') && (
                        <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">SAP Tanimi</th>
                      )}
                      {gorunurSutunlar.includes('malzeme_cinsi') && (
                        <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">Malzeme Cinsi</th>
                      )}
                      {gorunurSutunlar.includes('birim') && (
                        <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">Birim</th>
                      )}
                      {gorunurSutunlar.includes('miktar_bono') && hasBono && (
                        <th className="px-2 py-2 text-left text-xs font-semibold text-blue-600">Bono Mkt</th>
                      )}
                      {gorunurSutunlar.includes('miktar_irsaliye') && hasIrsaliye && (
                        <th className="px-2 py-2 text-left text-xs font-semibold text-orange-600">Irs. Mkt</th>
                      )}
                      {gorunurSutunlar.includes('kaynak') && (
                        <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">Kaynak</th>
                      )}
                      {gorunurSutunlar.includes('eslesme') && (
                        <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-16">Eslesme</th>
                      )}
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {kalemler.map((k) => (
                      <tr key={k._id} className={cn(
                        'border-b border-input/50 transition-colors',
                        !k._secili && 'opacity-40',
                        k.uyumsuzluk && 'bg-amber-50/50'
                      )}>
                        <td className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={k._secili}
                            onChange={() => handleKalemSecToggle(k._id)}
                            className="rounded"
                          />
                        </td>
                        {gorunurSutunlar.includes('sira_no') && (
                          <td className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
                            {k._sira}
                          </td>
                        )}
                        {gorunurSutunlar.includes('malzeme_kodu') && (
                          <td className="px-2 py-1.5">
                            <input
                              value={k.malzeme_kodu}
                              onChange={e => handleKalemDegistir(k._id, 'malzeme_kodu', e.target.value)}
                              className="w-24 rounded border border-input bg-background px-1.5 py-1 text-xs font-mono"
                            />
                          </td>
                        )}
                        {gorunurSutunlar.includes('poz_no') && (
                          <td className="px-2 py-1.5">
                            <input
                              value={k.poz_no}
                              onChange={e => handleKalemDegistir(k._id, 'poz_no', e.target.value)}
                              className="w-28 rounded border border-input bg-background px-1.5 py-1 text-xs font-mono"
                            />
                          </td>
                        )}
                        {gorunurSutunlar.includes('malzeme_adi_belge') && (
                          <td className="px-2 py-1.5">
                            <span className="block min-w-[150px] text-xs text-purple-700" title={k.malzeme_adi_belge}>
                              {k.malzeme_adi_belge}
                            </span>
                          </td>
                        )}
                        {gorunurSutunlar.includes('malzeme_tanimi_sap') && (
                          <td className="px-2 py-1.5">
                            <input
                              value={k.malzeme_tanimi_sap}
                              onChange={e => handleKalemDegistir(k._id, 'malzeme_tanimi_sap', e.target.value)}
                              className={cn(
                                'w-full min-w-[180px] rounded border px-1.5 py-1 text-xs',
                                k._katalog_eslesme ? 'border-emerald-300 bg-emerald-50/50' : 'border-input bg-background'
                              )}
                            />
                          </td>
                        )}
                        {gorunurSutunlar.includes('malzeme_cinsi') && (
                          <td className="px-2 py-1.5">
                            <input
                              value={k.malzeme_cinsi}
                              onChange={e => handleKalemDegistir(k._id, 'malzeme_cinsi', e.target.value)}
                              className={cn(
                                'w-full min-w-[180px] rounded border px-1.5 py-1 text-xs',
                                k._katalog_eslesme ? 'border-emerald-300 bg-emerald-50/50' : 'border-input bg-background'
                              )}
                            />
                          </td>
                        )}
                        {gorunurSutunlar.includes('birim') && (
                          <td className="px-2 py-1.5">
                            <input
                              value={k.birim}
                              onChange={e => handleKalemDegistir(k._id, 'birim', e.target.value)}
                              className="w-14 rounded border border-input bg-background px-1.5 py-1 text-xs"
                            />
                          </td>
                        )}
                        {gorunurSutunlar.includes('miktar_bono') && hasBono && (
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              value={k.miktar_bono}
                              onChange={e => handleKalemDegistir(k._id, 'miktar_bono', Number(e.target.value) || 0)}
                              className={cn(
                                'w-16 rounded border px-1.5 py-1 text-xs',
                                k.uyumsuzluk ? 'border-amber-400 bg-amber-50' : 'border-input bg-background'
                              )}
                            />
                          </td>
                        )}
                        {gorunurSutunlar.includes('miktar_irsaliye') && hasIrsaliye && (
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              value={k.miktar_irsaliye}
                              onChange={e => handleKalemDegistir(k._id, 'miktar_irsaliye', Number(e.target.value) || 0)}
                              className={cn(
                                'w-16 rounded border px-1.5 py-1 text-xs',
                                k.uyumsuzluk ? 'border-amber-400 bg-amber-50' : 'border-input bg-background'
                              )}
                            />
                          </td>
                        )}
                        {gorunurSutunlar.includes('kaynak') && (
                          <td className="px-2 py-1.5">
                            <span className={cn(
                              'inline-block rounded-full px-2 py-0.5 text-[10px] font-medium',
                              k.kaynak === 'her_ikisi' && 'bg-emerald-100 text-emerald-700',
                              k.kaynak === 'bono' && 'bg-blue-100 text-blue-700',
                              k.kaynak === 'irsaliye' && 'bg-orange-100 text-orange-700',
                            )}>
                              {k.kaynak === 'her_ikisi' ? 'Her ikisi' : k.kaynak === 'bono' ? 'Bono' : 'Irsaliye'}
                            </span>
                            {k.uyumsuzluk && (
                              <AlertTriangle className="ml-1 inline h-3 w-3 text-amber-500" />
                            )}
                          </td>
                        )}
                        {gorunurSutunlar.includes('eslesme') && (
                          <td className="px-2 py-1.5 text-center">
                            {k._katalog_eslesme === true && <CheckCircle className="inline h-4 w-4 text-emerald-500" />}
                            {k._katalog_eslesme === false && <AlertCircle className="inline h-4 w-4 text-amber-500" />}
                          </td>
                        )}
                        <td className="px-2 py-1.5">
                          <button onClick={() => handleKalemSil(k._id)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {kalemler.length === 0 && (
                      <tr>
                        <td colSpan={gorunurSutunlar.length + 2} className="px-4 py-8 text-center text-sm text-muted-foreground">
                          Parse sonucunda malzeme bulunamadi
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Aksiyon butonlari */}
          <div className="flex flex-col-reverse gap-2 border-t border-input pt-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={handleSifirla}
              className="rounded-lg border border-input px-4 py-2.5 text-sm font-medium hover:bg-muted active:bg-muted/80"
            >
              Yeniden Yukle
            </button>
            <button
              onClick={handleOnayla}
              disabled={kaydediliyor || seciliSayisi === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50 sm:w-auto"
            >
              {kaydediliyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {kaydediliyor ? 'Kaydediliyor...' : `Onayla ve Kaydet (${seciliSayisi} kalem)`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
