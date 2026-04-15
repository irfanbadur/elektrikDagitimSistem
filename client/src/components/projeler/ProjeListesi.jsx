import { useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, Pencil, Trash2, X, CheckSquare, FileSpreadsheet } from 'lucide-react'
import { useProjeler, useProjeSil, useTopluProjeSil } from '@/hooks/useProjeler'
import { useIsTipleri } from '@/hooks/useIsTipleri'
import { useBolgeler } from '@/hooks/useBolgeler'
import { useDonguSablonlari } from '@/hooks/useDongu'
import { useAuth } from '@/context/AuthContext'
import DataTable from '@/components/shared/DataTable'
import { ProjeDurumBadge, OncelikBadge } from '@/components/shared/StatusBadge'
import MalzemeTalepModal from './MalzemeTalepModal'
import YerTeslimXlsxModal from './YerTeslimXlsxModal'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { TableSkeleton } from '@/components/shared/LoadingSkeleton'
import { PROJE_DURUMLARI } from '@/utils/constants'
import { cn } from '@/lib/utils'

export default function ProjeListesi() {
  const navigate = useNavigate()
  const { izinVar } = useAuth()
  const silmeYetkisi = izinVar('projeler', 'silme')

  const [filtreler, setFiltreler] = useState({ durum: '', bolge_id: '', tip: '' })
  const { data: projeler, isLoading } = useProjeler(filtreler)
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
        accessorKey: 'aktif_sorumlu_adi',
        header: 'Sorumlu',
        cell: ({ row }) => row.original.aktif_sorumlu_adi || row.original.aktif_sorumlu_rol_adi || <span className="text-muted-foreground">-</span>,
      },
      {
        accessorKey: 'durum',
        header: 'Durum',
        cell: ({ row }) => {
          const p = row.original
          return (
            <ProjeDurumBadge
              durum={p.durum}
              asamaAdi={p.aktif_asama_adi}
              asamaRenk={p.aktif_asama_renk}
              asamaIkon={p.aktif_asama_ikon}
              fazAdi={p.aktif_faz_adi}
              adimAdi={p.aktif_adim_adi}
              adimRenk={p.aktif_adim_renk}
              adimIkon={p.aktif_adim_ikon}
              sorumluRolAdi={p.aktif_sorumlu_rol_adi}
            />
          )
        },
      },
      {
        accessorKey: 'kesif_ilerleme_yuzdesi',
        header: 'İlerleme',
        cell: ({ row }) => {
          const v = row.original.kesif_ilerleme_yuzdesi || 0
          const kalem = row.original.kesif_kalem_sayisi || 0
          return (
            <div className="flex items-center gap-2">
              <div className="h-2 w-16 rounded-full bg-gray-200">
                <div
                  className={cn(
                    'h-2 rounded-full',
                    v >= 100 ? 'bg-emerald-500' : v >= 50 ? 'bg-primary' : v > 0 ? 'bg-amber-500' : 'bg-gray-300'
                  )}
                  style={{ width: `${Math.min(v, 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">%{v}</span>
              {kalem === 0 && <span className="text-[10px] text-red-400" title="Keşif yok">!</span>}
            </div>
          )
        },
      },
      {
        accessorKey: 'teslim_tarihi',
        header: 'Yer Teslim',
        cell: ({ getValue }) => {
          const v = getValue()
          return v ? <span className="text-xs">{v.slice(0, 10)}</span> : <span className="text-muted-foreground">-</span>
        },
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
    [navigate, silmeYetkisi, projeler, seciliIdler, tumunuSec, secimDegistir]
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
