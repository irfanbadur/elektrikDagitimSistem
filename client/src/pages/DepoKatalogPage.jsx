import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Search,
  Columns3,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  Database,
  Package,
  Ruler,
  Tag,
  Check,
} from 'lucide-react'
import MainLayout from '@/components/layout/MainLayout'
import { useDepoKatalog, useDepoKatalogFiltreler, useDepoKatalogIstatistikler } from '@/hooks/useDepoKatalog'
import { cn } from '@/lib/utils'

const SAYFA_BOYUTU_SECENEKLERI = [25, 50, 100, 250, 500]

const TUM_SUTUNLAR = [
  { key: 'malzeme_kodu', label: 'Malzeme Kodu', varsayilan: true },
  { key: 'poz_birlesik', label: 'Poz Birleşik', varsayilan: true },
  { key: 'malzeme_tanimi_sap', label: 'SAP Tanımı', varsayilan: false },
  { key: 'malzeme_cinsi', label: 'Malzeme Cinsi', varsayilan: true },
  { key: 'olcu', label: 'Ölçü', varsayilan: true },
  { key: 'termin', label: 'Termin', varsayilan: true },
  { key: 'ihale_kesfi', label: 'İhale Keşfi', varsayilan: true },
  { key: 'toplam_talep', label: 'Toplam Talep', varsayilan: true },
  { key: 'kategori', label: 'Kategori', varsayilan: false },
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
    setGorunurSutunlar((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const tumunuSec = () => setGorunurSutunlar(TUM_SUTUNLAR.map((s) => s.key))
  const tumunuKaldir = () => setGorunurSutunlar(['malzeme_cinsi'])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAcik(!acik)}
        className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
          acik
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-input bg-background text-foreground hover:bg-muted'
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
        <div className="absolute right-0 z-50 mt-1 w-64 rounded-lg border border-input bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-input px-3 py-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Görünür Sütunlar</span>
            <div className="flex gap-1">
              <button onClick={tumunuSec} className="rounded px-1.5 py-0.5 text-xs text-primary hover:bg-primary/10">Tümü</button>
              <button onClick={tumunuKaldir} className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted">Sıfırla</button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {TUM_SUTUNLAR.map((sutun) => {
              const secili = gorunurSutunlar.includes(sutun.key)
              return (
                <button
                  key={sutun.key}
                  onClick={() => toggleSutun(sutun.key)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
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
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function IstatistikKart({ ikon: Icon, baslik, deger, renk }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-input bg-card px-4 py-3">
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', renk)}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{baslik}</p>
        <p className="text-lg font-bold">{deger ?? '-'}</p>
      </div>
    </div>
  )
}

function HucreDegeri({ sutunKey, malzeme }) {
  const val = malzeme[sutunKey]

  switch (sutunKey) {
    case 'malzeme_kodu':
      return <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{val || '-'}</td>
    case 'poz_birlesik':
      return <td className="px-3 py-2 font-mono text-xs font-medium text-blue-600 dark:text-blue-400">{val || '-'}</td>
    case 'malzeme_tanimi_sap':
      return <td className="px-3 py-2 text-xs">{val || '-'}</td>
    case 'malzeme_cinsi':
      return <td className="px-3 py-2 text-xs font-medium">{val || '-'}</td>
    case 'olcu':
      return (
        <td className="px-3 py-2">
          {val ? (
            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">{val}</span>
          ) : '-'}
        </td>
      )
    case 'termin':
      return (
        <td className="px-3 py-2">
          {val ? (
            <span className={cn(
              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
              val.trim() === 'Şirket'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            )}>{val.trim()}</span>
          ) : '-'}
        </td>
      )
    case 'ihale_kesfi':
    case 'toplam_talep':
      return <td className="px-3 py-2 text-right text-xs tabular-nums">{val ? val.toLocaleString('tr-TR') : '0'}</td>
    case 'kategori':
      return <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px] truncate" title={val}>{val || '-'}</td>
    default:
      return <td className="px-3 py-2 text-xs">{val ?? '-'}</td>
  }
}

export default function DepoKatalogPage() {
  const [arama, setArama] = useState('')
  const [kategori, setKategori] = useState('')
  const [olcu, setOlcu] = useState('')
  const [termin, setTermin] = useState('')
  const [sayfa, setSayfa] = useState(1)
  const [sayfaBoyutu, setSayfaBoyutu] = useState(50)
  const [siralama, setSiralama] = useState({ key: null, yon: 'asc' })
  const [gorunurSutunlar, setGorunurSutunlar] = useState(
    TUM_SUTUNLAR.filter((s) => s.varsayilan).map((s) => s.key)
  )

  const filtreler = useMemo(() => {
    const f = {}
    if (arama) f.arama = arama
    if (kategori) f.kategori = kategori
    if (olcu) f.olcu = olcu
    if (termin) f.termin = termin
    return f
  }, [arama, kategori, olcu, termin])

  // Filtre değişince sayfa 1'e dön
  useEffect(() => { setSayfa(1) }, [arama, kategori, olcu, termin])

  const { data: malzemeler, isLoading, isError } = useDepoKatalog(filtreler)
  const { data: filtreSecenekleri } = useDepoKatalogFiltreler()
  const { data: istatistikler } = useDepoKatalogIstatistikler()

  const aktifFiltreSayisi = [kategori, olcu, termin].filter(Boolean).length

  const filtreleriTemizle = () => {
    setKategori('')
    setOlcu('')
    setTermin('')
    setArama('')
  }

  // Client-side sıralama
  const siraliData = useMemo(() => {
    if (!malzemeler) return []
    if (!siralama.key) return malzemeler
    return [...malzemeler].sort((a, b) => {
      let va = a[siralama.key]
      let vb = b[siralama.key]
      if (va == null) va = ''
      if (vb == null) vb = ''
      if (typeof va === 'number' && typeof vb === 'number') {
        return siralama.yon === 'asc' ? va - vb : vb - va
      }
      va = String(va).toLowerCase()
      vb = String(vb).toLowerCase()
      if (va < vb) return siralama.yon === 'asc' ? -1 : 1
      if (va > vb) return siralama.yon === 'asc' ? 1 : -1
      return 0
    })
  }, [malzemeler, siralama])

  // Pagination
  const toplamSayfa = Math.max(1, Math.ceil((siraliData?.length || 0) / sayfaBoyutu))
  const sayfaData = useMemo(() => {
    const baslangic = (sayfa - 1) * sayfaBoyutu
    return siraliData.slice(baslangic, baslangic + sayfaBoyutu)
  }, [siraliData, sayfa, sayfaBoyutu])

  const handleSirala = (key) => {
    setSiralama((prev) =>
      prev.key === key
        ? { key, yon: prev.yon === 'asc' ? 'desc' : 'asc' }
        : { key, yon: 'asc' }
    )
  }

  const gorunurSutunListesi = TUM_SUTUNLAR.filter((s) => gorunurSutunlar.includes(s.key))

  return (
    <MainLayout title="Malzeme Katalog">
      <div>
        {/* Başlık */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Malzeme Katalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kurum depo malzeme listesi - {siraliData.length.toLocaleString('tr-TR')} kayit
          </p>
        </div>

        {/* İstatistik Kartları */}
        {istatistikler && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <IstatistikKart ikon={Database} baslik="Toplam Malzeme" deger={istatistikler.toplam?.toLocaleString('tr-TR')} renk="bg-blue-500" />
            <IstatistikKart ikon={Tag} baslik="Kategori" deger={istatistikler.kategori_sayisi} renk="bg-purple-500" />
            <IstatistikKart ikon={Package} baslik="Kodlu Malzeme" deger={istatistikler.kodlu_malzeme?.toLocaleString('tr-TR')} renk="bg-emerald-500" />
            <IstatistikKart ikon={Ruler} baslik="Olcu Cesidi" deger={istatistikler.olcu_sayisi} renk="bg-amber-500" />
          </div>
        )}

        {/* Filtre Bar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Malzeme adi, kodu veya poz ara..."
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {arama && (
              <button onClick={() => setArama('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <select value={kategori} onChange={(e) => setKategori(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary max-w-[220px]">
            <option value="">Tum Kategoriler</option>
            {filtreSecenekleri?.kategoriler?.map((k) => (
              <option key={k} value={k}>{k.length > 35 ? k.slice(0, 35) + '...' : k}</option>
            ))}
          </select>

          <select value={olcu} onChange={(e) => setOlcu(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="">Tum Olculer</option>
            {filtreSecenekleri?.olculer?.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>

          <select value={termin} onChange={(e) => setTermin(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="">Tum Terminler</option>
            {filtreSecenekleri?.terminler?.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <SutunSecici gorunurSutunlar={gorunurSutunlar} setGorunurSutunlar={setGorunurSutunlar} />

          {aktifFiltreSayisi > 0 && (
            <button onClick={filtreleriTemizle} className="flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="h-3.5 w-3.5" />
              Temizle ({aktifFiltreSayisi})
            </button>
          )}
        </div>

        {/* Tablo */}
        <div className="overflow-hidden rounded-lg border border-input bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-input bg-muted/50">
                  <th className="w-12 px-3 py-3 text-left text-xs font-semibold text-muted-foreground">#</th>
                  {gorunurSutunListesi.map((sutun) => (
                    <th
                      key={sutun.key}
                      className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => handleSirala(sutun.key)}
                    >
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        {sutun.label}
                        {siralama.key === sutun.key && (
                          siralama.yon === 'asc'
                            ? <ChevronUp className="h-3 w-3 text-primary" />
                            : <ChevronDown className="h-3 w-3 text-primary" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 15 }).map((_, i) => (
                    <tr key={i} className="border-b border-input/50">
                      <td className="px-3 py-2.5"><div className="skeleton h-4 w-6 rounded" /></td>
                      {gorunurSutunlar.map((key) => (
                        <td key={key} className="px-3 py-2.5"><div className="skeleton h-4 w-full rounded" /></td>
                      ))}
                    </tr>
                  ))
                ) : isError ? (
                  <tr>
                    <td colSpan={gorunurSutunlar.length + 1} className="px-3 py-12 text-center">
                      <p className="text-sm font-medium text-red-500">Veriler yuklenirken hata olustu</p>
                    </td>
                  </tr>
                ) : sayfaData.length === 0 ? (
                  <tr>
                    <td colSpan={gorunurSutunlar.length + 1} className="px-3 py-12 text-center">
                      <Package className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
                      <p className="text-sm font-medium text-muted-foreground">Sonuc bulunamadi</p>
                      <p className="mt-1 text-xs text-muted-foreground/70">Filtreleri degistirmeyi deneyin</p>
                    </td>
                  </tr>
                ) : (
                  sayfaData.map((m, idx) => (
                    <tr key={m.id} className="border-b border-input/50 transition-colors hover:bg-muted/30">
                      <td className="px-3 py-2 text-xs text-muted-foreground">{(sayfa - 1) * sayfaBoyutu + idx + 1}</td>
                      {gorunurSutunListesi.map((sutun) => (
                        <HucreDegeri key={sutun.key} sutunKey={sutun.key} malzeme={m} />
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!isLoading && siraliData.length > sayfaBoyutu && (
            <div className="flex items-center justify-between border-t border-input px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Sayfa basina:</span>
                  <select
                    value={sayfaBoyutu}
                    onChange={(e) => { setSayfaBoyutu(Number(e.target.value)); setSayfa(1) }}
                    className="rounded border border-input bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {SAYFA_BOYUTU_SECENEKLERI.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground">
                  {((sayfa - 1) * sayfaBoyutu + 1).toLocaleString('tr-TR')} - {Math.min(sayfa * sayfaBoyutu, siraliData.length).toLocaleString('tr-TR')} / {siraliData.length.toLocaleString('tr-TR')} kayit
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSayfa(1)}
                  disabled={sayfa === 1}
                  className="rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Ilk
                </button>
                <button
                  onClick={() => setSayfa((s) => Math.max(1, s - 1))}
                  disabled={sayfa === 1}
                  className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-3 py-1 text-xs font-medium">
                  {sayfa} / {toplamSayfa}
                </span>
                <button
                  onClick={() => setSayfa((s) => Math.min(toplamSayfa, s + 1))}
                  disabled={sayfa === toplamSayfa}
                  className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setSayfa(toplamSayfa)}
                  disabled={sayfa === toplamSayfa}
                  className="rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Son
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
