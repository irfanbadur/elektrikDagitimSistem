import { useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, Pencil, Trash2, X, CheckSquare, FileSpreadsheet, AlertTriangle, Clock, Check } from 'lucide-react'
import { useProjeler, useProjeSil, useTopluProjeSil } from '@/hooks/useProjeler'
import { useIsTipleri } from '@/hooks/useIsTipleri'
import { useBolgeler } from '@/hooks/useBolgeler'
import { useDonguSablonlari } from '@/hooks/useDongu'
import { useAuth } from '@/context/AuthContext'
import DataTable from '@/components/shared/DataTable'
import { OncelikBadge } from '@/components/shared/StatusBadge'
import MalzemeTalepModal from './MalzemeTalepModal'
import YerTeslimXlsxModal from './YerTeslimXlsxModal'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { TableSkeleton } from '@/components/shared/LoadingSkeleton'
import { PROJE_DURUMLARI } from '@/utils/constants'
import { cn } from '@/lib/utils'

// Proje tamamlanmış mı? Durum kodlarına bakar
const TAMAMLANDI_DURUMLAR = new Set([
  'tamamlandi', 'kabul', 'kabul_edildi', 'enerjilendi', 'kapali', 'iptal',
])

function projeDurumu(proje) {
  // Tarihleri parse et
  const bas = proje.baslama_tarihi ? new Date(proje.baslama_tarihi) : null
  const bit = proje.bitis_tarihi ? new Date(proje.bitis_tarihi) : null
  // Bugün (saat sıfırlanmış)
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0)
  // Tamamlanma kontrolü
  const tamamlandi = (Number(proje.tamamlanma_yuzdesi) >= 100)
    || TAMAMLANDI_DURUMLAR.has(String(proje.durum || '').toLowerCase())
    || String(proje.aktif_adim_durum || '').toLowerCase() === 'tamamlandi'
  if (tamamlandi) return 'tamamlandi'
  if (bit && bit < bugun) return 'gecikti'        // bitiş geçmiş + tamamlanmadı
  if (bas && bit && bas <= bugun && bugun <= bit) return 'devam'
  if (bas && bas > bugun) return 'beklemede'
  return 'belirsiz'
}

// Durum sütunu yerine bu adımlar için ayrı sütunlar — her hücre o adıma yüklenmiş dosya sayısını gösterir
const ADIM_SUTUNLARI = [
  { kod: 'cbs_altlik',         baslik: 'CBS altlık' },
  { kod: 'mevcut_durum_proje', baslik: 'Mevcut Durum' },
  { kod: 'yeni_durum_proje',   baslik: 'Yeni Durum' },
  { kod: 'demontaj_krokisi',   baslik: 'Demontaj Krokisi' },
  { kod: 'metraj',             baslik: 'Metraj' },
  { kod: 'hak_edis_krokisi',   baslik: 'Hak Ediş Krokisi' },
  { kod: 'gecici_kabul',       baslik: 'Geçici Kabul' },
  { kod: 'eksik_giderim',      baslik: 'EVP' },
  { kod: 'kabul_tutanaklar',   baslik: 'BHP' },
]

function projeAdimlari(proje) {
  if (proje.__adimlar) return proje.__adimlar
  try {
    proje.__adimlar = proje.adimlar_json ? JSON.parse(proje.adimlar_json) : []
  } catch { proje.__adimlar = [] }
  return proje.__adimlar
}

function AdimDosyaSayisiHucresi({ proje, kod }) {
  const adim = projeAdimlari(proje).find(a => a.adim_kodu === kod)
  if (!adim) return <span className="text-muted-foreground/40">-</span>
  const sayi = Number(adim.dosya_sayisi || 0)
  if (sayi === 0) {
    return <span className="text-muted-foreground/30 text-xs tabular-nums">0</span>
  }
  return (
    <span className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-semibold tabular-nums">
      {sayi}
    </span>
  )
}

function TarihHucresi({ proje, alan }) {
  const v = alan === 'baslama' ? proje.baslama_tarihi : proje.bitis_tarihi
  if (!v) return <span className="text-muted-foreground">-</span>
  const tarih = String(v).slice(0, 10)
  const durum = projeDurumu(proje)
  if (durum === 'devam') {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 border border-orange-300">
        <Clock className="h-3 w-3" /> {tarih}
      </span>
    )
  }
  if (durum === 'gecikti' && alan === 'bitis') {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold bg-red-100 text-red-800 border border-red-400 animate-pulse">
        <AlertTriangle className="h-3 w-3 text-red-600 animate-bounce" /> {tarih}
      </span>
    )
  }
  if (durum === 'gecikti' && alan === 'baslama') {
    return <span className="text-xs text-red-600">{tarih}</span>
  }
  if (durum === 'tamamlandi') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
        <Check className="h-3 w-3" /> {tarih}
      </span>
    )
  }
  return <span className="text-xs">{tarih}</span>
}

export default function ProjeListesi() {
  const navigate = useNavigate()
  const { izinVar } = useAuth()
  const silmeYetkisi = izinVar('projeler', 'silme')

  const [filtreler, setFiltreler] = useState({ durum: '', bolge_id: '', tip: '', yer_teslim: '' })
  // Artırım yüzdesi (Excel KET-YB özet sayfasındaki %10 markup'ı taklit eder)
  // Sözleşme keşfi etkilenmez; sadece fiyat ve ilerleme değerleri çarpılır.
  const [artirimYuzdesi, setArtirimYuzdesi] = useState(() => {
    const v = Number(localStorage.getItem('proje_artirim_yuzdesi'))
    return Number.isFinite(v) && v >= 0 ? v : 10
  })
  const carpan = 1 + (Number(artirimYuzdesi) || 0) / 100
  // %10 (default) için Excel-uyumlu birebir hesap (her satırı +%10 yuvarlı fiyatla çarpar)
  // Diğer % için matematiksel `raw × carpan` (yaklaşık)
  const isExcel10 = Number(artirimYuzdesi) === 10
  const tutarHesapla = (p) => {
    const t = isExcel10 ? Number(p.kesif_toplam_tutar_artirimli) : (Number(p.kesif_toplam_tutar) || 0) * carpan
    return t || 0
  }
  const ilerlemeHesapla = (p) => {
    const i = isExcel10 ? Number(p.kesif_ilerleme_tutar_artirimli) : (Number(p.kesif_ilerleme_tutar) || 0) * carpan
    return i || 0
  }
  const { data: rawProjeler, isLoading } = useProjeler(filtreler)
  // Yer teslim client-side filtre
  const projeler = useMemo(() => {
    if (!rawProjeler || !filtreler.yer_teslim) return rawProjeler
    if (filtreler.yer_teslim === 'var') return rawProjeler.filter(p => !!p.teslim_tarihi)
    if (filtreler.yer_teslim === 'yok') return rawProjeler.filter(p => !p.teslim_tarihi)
    return rawProjeler
  }, [rawProjeler, filtreler.yer_teslim])
  const { data: bolgeler } = useBolgeler()
  const { data: isTipleri } = useIsTipleri()
  const { data: sablonlar } = useDonguSablonlari()
  const projeSil = useProjeSil()
  const topluSil = useTopluProjeSil()

  const [silmeDialogAcik, setSilmeDialogAcik] = useState(false)
  const [silinecekProje, setSilinecekProje] = useState(null)
  const [silmeHatasi, setSilmeHatasi] = useState(null)

  // Checkbox seçim state
  const [seciliIdler, setSeciliIdler] = useState(new Set())
  const [topluSilmeDialogAcik, setTopluSilmeDialogAcik] = useState(false)
  const [malzemeTalepModalAcik, setMalzemeTalepModalAcik] = useState(false)
  const [yerTeslimXlsxModalAcik, setYerTeslimXlsxModalAcik] = useState(false)

  const secimDegistir = useCallback((id) => {
    setSeciliIdler((prev) => {
      const yeni = new Set(prev)
      if (yeni.has(id)) yeni.delete(id)
      else yeni.add(id)
      return yeni
    })
  }, [])

  const tumunuSec = useCallback(() => {
    if (!projeler) return
    if (seciliIdler.size === projeler.length) {
      setSeciliIdler(new Set())
    } else {
      setSeciliIdler(new Set(projeler.map((p) => p.id)))
    }
  }, [projeler, seciliIdler.size])

  const secimiTemizle = useCallback(() => {
    setSeciliIdler(new Set())
  }, [])

  // Tüm şablonlardaki tekrarsız aşamalar (filtre için)
  const tumAsamalar = useMemo(() => {
    if (!sablonlar) return null
    const map = new Map()
    for (const s of sablonlar) {
      for (const a of s.asamalar || []) {
        if (!map.has(a.asama_kodu)) {
          map.set(a.asama_kodu, { kod: a.asama_kodu, adi: a.asama_adi, ikon: a.ikon })
        }
      }
    }
    return map.size > 0 ? Array.from(map.values()) : null
  }, [sablonlar])

  const handleSil = () => {
    if (!silinecekProje) return
    setSilmeHatasi(null)
    projeSil.mutate(silinecekProje.id, {
      onSuccess: () => {
        setSilinecekProje(null)
        setSilmeDialogAcik(false)
        // Silinen proje seçiliyse seçimden çıkar
        setSeciliIdler((prev) => {
          const yeni = new Set(prev)
          yeni.delete(silinecekProje.id)
          return yeni
        })
      },
      onError: (err) => {
        setSilmeHatasi(err.message || 'Proje silinirken bir hata olustu')
      },
    })
  }

  const handleTopluSil = () => {
    setSilmeHatasi(null)
    topluSil.mutate([...seciliIdler], {
      onSuccess: () => {
        setSeciliIdler(new Set())
        setTopluSilmeDialogAcik(false)
      },
      onError: (err) => {
        setSilmeHatasi(err.response?.data?.error || err.message || 'Toplu silme sirasinda hata olustu')
      },
    })
  }

  const handleFiltreChange = (key, value) => {
    setFiltreler((prev) => ({ ...prev, [key]: value }))
  }

  const columns = useMemo(
    () => [
      // Checkbox sütunu
      ...[
            {
              id: 'secim',
              header: () => (
                <input
                  type="checkbox"
                  checked={projeler?.length > 0 && seciliIdler.size === projeler.length}
                  ref={(el) => {
                    if (el) el.indeterminate = seciliIdler.size > 0 && seciliIdler.size < (projeler?.length || 0)
                  }}
                  onChange={tumunuSec}
                  className="h-4 w-4 rounded border-gray-300 text-primary accent-primary cursor-pointer"
                />
              ),
              cell: ({ row }) => (
                <input
                  type="checkbox"
                  checked={seciliIdler.has(row.original.id)}
                  onChange={(e) => {
                    e.stopPropagation()
                    secimDegistir(row.original.id)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 rounded border-gray-300 text-primary accent-primary cursor-pointer"
                />
              ),
              enableSorting: false,
              size: 40,
            },
          ],
      {
        accessorKey: 'excel_sira',
        header: '#',
        cell: ({ row }) => {
          const s = row.original.excel_sira
          return s != null
            ? <span className="text-xs tabular-nums text-muted-foreground">{s}</span>
            : <span className="text-xs text-muted-foreground/40">-</span>
        },
        size: 36,
      },
      {
        accessorKey: 'proje_no',
        header: 'Proje No',
        cell: ({ row }) => (
          <button
            onClick={() => navigate(`/projeler/${row.original.id}`)}
            className="font-medium text-primary hover:underline"
          >
            {row.original.proje_no}
          </button>
        ),
      },
      {
        accessorKey: 'proje_tipi',
        header: 'Tür',
        cell: ({ getValue }) => (
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium">
            {getValue()}
          </span>
        ),
      },
      {
        accessorKey: 'bolge_adi',
        header: 'Bolge',
        cell: ({ row }) => row.original.bolge_adi || '-',
      },
      {
        accessorKey: 'musteri_adi',
        header: 'Proje Adı',
        cell: ({ row }) => row.original.musteri_adi || '-',
      },
      {
        accessorKey: 'ekip_adi',
        header: 'Ekip',
        cell: ({ row }) => row.original.ekip_adi
          ? <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{row.original.ekip_adi}</span>
          : <span className="text-muted-foreground">-</span>,
      },
      {
        accessorKey: 'kesif_ilerleme_tutar',
        header: 'İlerleme',
        cell: ({ row }) => {
          const tutar = ilerlemeHesapla(row.original)
          const raw = Number(row.original.kesif_ilerleme_tutar) || 0
          const toplam = Number(row.original.kesif_toplam_tutar) || 0
          const yuzde = toplam > 0 && raw > 0 ? Math.round((raw * 100) / toplam) : 0
          if (!tutar) return <span className="text-muted-foreground">-</span>
          return (
            <div className="flex flex-col leading-tight">
              <span className="tabular-nums font-medium text-blue-700">
                {tutar.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺
              </span>
              {yuzde > 0 && <span className="text-[10px] text-muted-foreground">%{yuzde}</span>}
            </div>
          )
        },
      },
      {
        accessorKey: 'kesif_toplam_tutar',
        header: 'Fiyat',
        cell: ({ row }) => {
          const tutar = tutarHesapla(row.original)
          if (!tutar) return <span className="text-muted-foreground">-</span>
          return <span className="tabular-nums font-medium text-emerald-700">
            {tutar.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺
          </span>
        },
      },
      {
        accessorKey: 'sozlesme_kesfi',
        header: 'Sözleşme Keşfi',
        cell: ({ row }) => {
          const tutar = Number(row.original.sozlesme_kesfi) || 0
          if (!tutar) return <span className="text-muted-foreground">-</span>
          return <span className="tabular-nums text-slate-700">
            {tutar.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺
          </span>
        },
      },
      ...ADIM_SUTUNLARI.map(({ kod, baslik }) => ({
        id: `adim_${kod}`,
        header: () => (
          <div
            className="text-[11px] font-medium normal-case tracking-normal whitespace-nowrap"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            title={baslik}
          >
            {baslik}
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-center">
            <AdimDosyaSayisiHucresi proje={row.original} kod={kod} />
          </div>
        ),
        meta: {
          thClassName: 'px-1 py-2 align-bottom text-center',
          thStyle: { width: 32, minWidth: 32, maxWidth: 32, height: 130 },
          tdClassName: 'px-0 py-2 text-center',
          tdStyle: { width: 32, minWidth: 32, maxWidth: 32 },
        },
      })),
      {
        accessorKey: 'teslim_tarihi',
        header: 'Yer Teslim',
        cell: ({ getValue }) => {
          const v = getValue()
          return v ? <span className="text-xs">{v.slice(0, 10)}</span> : <span className="text-muted-foreground">-</span>
        },
      },
      {
        accessorKey: 'baslama_tarihi',
        header: 'Başlangıç',
        cell: ({ row }) => <TarihHucresi proje={row.original} alan="baslama" />,
      },
      {
        accessorKey: 'bitis_tarihi',
        header: 'Bitiş',
        cell: ({ row }) => <TarihHucresi proje={row.original} alan="bitis" />,
      },
      {
        accessorKey: 'oncelik',
        header: 'Oncelik',
        cell: ({ getValue }) => <OncelikBadge oncelik={getValue()} />,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/projeler/${row.original.id}`)
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Goruntule"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/projeler/${row.original.id}/duzenle`)
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Duzenle"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSilinecekProje(row.original)
                setSilmeDialogAcik(true)
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
              title="Sil"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [navigate, silmeYetkisi, projeler, seciliIdler, tumunuSec, secimDegistir, carpan, isExcel10]
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Projeler</h1>
        </div>
        <TableSkeleton rows={8} cols={7} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projeler</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Toplam {projeler?.length || 0} proje
          </p>
        </div>
        <button
          onClick={() => navigate('/projeler/yeni')}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Yeni Proje
        </button>
      </div>

      {/* Artırım yüzdesi seçici (Excel KET-YB özet sayfasındaki %10 markup taklidi) */}
      <div className="flex items-center gap-2 rounded-lg border border-input bg-muted/20 px-3 py-2 max-w-fit">
        <span className="text-xs text-muted-foreground">Fiyat artırım yüzdesi:</span>
        <input
          type="number" step="0.5" min="0" max="100"
          value={artirimYuzdesi}
          onChange={e => {
            const v = Number(e.target.value)
            setArtirimYuzdesi(v)
            try { localStorage.setItem('proje_artirim_yuzdesi', String(v)) } catch {}
          }}
          className="w-16 rounded border border-input bg-white px-2 py-1 text-sm text-right tabular-nums focus:border-primary focus:outline-none"
        />
        <span className="text-xs text-muted-foreground">%</span>
        <span className="text-[10px] text-muted-foreground italic">(Sözleşme keşfi etkilenmez)</span>
      </div>

      {/* Özet kartları — seçim varsa SEÇİLEN projelerin, yoksa TÜM filtrelenmiş projelerin toplamı */}
      {(projeler?.length || 0) > 0 && (() => {
        // %10'da Excel-uyumlu (artırımlı kolon), diğer % için raw × carpan
        const fiyatBul = tutarHesapla
        const ilerlemeBul = ilerlemeHesapla
        const sozlesmeBul = (p) => Number(p.sozlesme_kesfi) || 0
        const seciliMod = seciliIdler.size > 0
        const kapsam = seciliMod ? projeler.filter(p => seciliIdler.has(p.id)) : projeler
        const toplamTutar = kapsam.reduce((t, p) => t + fiyatBul(p), 0)
        const ilerlemeTutar = kapsam.reduce((t, p) => t + ilerlemeBul(p), 0)
        const sozlesmeTutar = kapsam.reduce((t, p) => t + sozlesmeBul(p), 0)
        const yuzde = toplamTutar > 0 ? Math.round((ilerlemeTutar / toplamTutar) * 100) : 0
        const fmt = (n) => n.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) + ' ₺'
        const renkSinifi = seciliMod
          ? { kart: 'border-primary/40 bg-primary/5', baslikRenk: 'text-primary' }
          : { kart: 'border-input bg-card', baslikRenk: 'text-muted-foreground' }
        return (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className={cn('rounded-lg border px-4 py-3', renkSinifi.kart)}>
              <p className={cn('text-xs', renkSinifi.baslikRenk)}>
                {seciliMod ? `Seçili Proje (${kapsam.length})` : 'Proje Sayısı'}
              </p>
              <p className="text-xl font-bold tabular-nums">{kapsam.length}</p>
              {seciliMod && (
                <p className="text-[10px] text-muted-foreground">tüm filtre: {projeler.length}</p>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">Sözleşme Toplamı</p>
              <p className="text-xl font-bold tabular-nums text-slate-700">{fmt(sozlesmeTutar)}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">Toplam Tutar</p>
              <p className="text-xl font-bold tabular-nums text-emerald-700">{fmt(toplamTutar)}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">İlerleme</p>
              <p className="text-xl font-bold tabular-nums text-blue-700">{fmt(ilerlemeTutar)}</p>
              <p className="text-[10px] text-muted-foreground">%{yuzde}</p>
            </div>
          </div>
        )
      })()}

      <div className="flex flex-wrap gap-3">
        <select
          value={filtreler.tip}
          onChange={(e) => handleFiltreChange('tip', e.target.value)}
          className="rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Tüm Tipler</option>
          {(isTipleri || []).map(t => (
            <option key={t.id} value={t.kod}>{t.ad}</option>
          ))}
        </select>
        <select
          value={filtreler.durum}
          onChange={(e) => handleFiltreChange('durum', e.target.value)}
          className="rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Tum Durumlar</option>
          {tumAsamalar
            ? tumAsamalar.map((a) => (
                <option key={a.kod} value={a.kod}>
                  {a.ikon} {a.adi}
                </option>
              ))
            : Object.entries(PROJE_DURUMLARI).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.label}
                </option>
              ))}
        </select>
        <select
          value={filtreler.bolge_id}
          onChange={(e) => handleFiltreChange('bolge_id', e.target.value)}
          className="rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Tum Bolgeler</option>
          {bolgeler?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.bolge_adi}
            </option>
          ))}
        </select>
        <select
          value={filtreler.yer_teslim}
          onChange={(e) => handleFiltreChange('yer_teslim', e.target.value)}
          className="rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Yer Teslim (Hepsi)</option>
          <option value="var">Yer Teslimi Var</option>
          <option value="yok">Yer Teslimi Yok</option>
        </select>
      </div>

      {/* Toplu islem bar - secim varsa goster */}
      {seciliIdler.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <CheckSquare className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">
            {seciliIdler.size} proje secildi
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={secimiTemizle}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Secimi Temizle
            </button>
            <button
              onClick={() => setYerTeslimXlsxModalAcik(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Yer Teslim XLSX ({seciliIdler.size})
            </button>
            <button
              onClick={() => setMalzemeTalepModalAcik(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Malzeme Talebi ({seciliIdler.size})
            </button>
            {silmeYetkisi && (
              <button
                onClick={() => setTopluSilmeDialogAcik(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Secilenleri Sil ({seciliIdler.size})
              </button>
            )}
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={projeler || []}
        searchPlaceholder="Proje ara..."
        pagination={false}
        stickyHeader
        rowNumber
      />

      {silmeHatasi && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-red-200 bg-red-50 p-4 shadow-lg">
          <div className="flex items-start gap-2">
            <span className="text-sm font-medium text-red-800">{silmeHatasi}</span>
            <button onClick={() => setSilmeHatasi(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Yer Teslim XLSX Modal */}
      {yerTeslimXlsxModalAcik && (
        <YerTeslimXlsxModal
          projeler={(projeler || []).filter((p) => seciliIdler.has(p.id))}
          onKapat={() => setYerTeslimXlsxModalAcik(false)}
        />
      )}

      {/* Malzeme Talebi Modal */}
      {malzemeTalepModalAcik && (
        <MalzemeTalepModal
          projeler={(projeler || []).filter((p) => seciliIdler.has(p.id))}
          onKapat={() => setMalzemeTalepModalAcik(false)}
        />
      )}

      {/* Tekli silme dialog */}
      <ConfirmDialog
        open={silmeDialogAcik}
        onClose={() => {
          if (!projeSil.isPending) {
            setSilmeDialogAcik(false)
            setSilinecekProje(null)
            setSilmeHatasi(null)
          }
        }}
        onConfirm={handleSil}
        title="Projeyi Sil"
        message={silmeHatasi
          ? `${silmeHatasi}`
          : `"${silinecekProje?.proje_no}" numarali projeyi silmek istediginize emin misiniz? Bu islem geri alinamaz.`
        }
        confirmText={projeSil.isPending ? 'Siliniyor...' : 'Sil'}
        cancelText="Iptal"
        variant="destructive"
        loading={projeSil.isPending}
      />

      {/* Toplu silme dialog */}
      <ConfirmDialog
        open={topluSilmeDialogAcik}
        onClose={() => {
          if (!topluSil.isPending) {
            setTopluSilmeDialogAcik(false)
          }
        }}
        onConfirm={handleTopluSil}
        title="Toplu Proje Silme"
        message={`${seciliIdler.size} adet projeyi silmek istediginize emin misiniz? Bu islem geri alinamaz ve tum iliskili veriler (kesifler, demontajlar, direkler, asamalar vb.) kalici olarak silinecektir.`}
        confirmText={topluSil.isPending ? 'Siliniyor...' : `${seciliIdler.size} Projeyi Sil`}
        cancelText="Iptal"
        variant="destructive"
        loading={topluSil.isPending}
      />
    </div>
  )
}
