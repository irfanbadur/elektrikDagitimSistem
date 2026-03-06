import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, Pencil, Trash2 } from 'lucide-react'
import { useProjeler, useProjeSil } from '@/hooks/useProjeler'
import { useIsTipleri } from '@/hooks/useIsTipleri'
import { useBolgeler } from '@/hooks/useBolgeler'
import { useDonguSablonlari } from '@/hooks/useDongu'
import DataTable from '@/components/shared/DataTable'
import { ProjeDurumBadge, OncelikBadge } from '@/components/shared/StatusBadge'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { TableSkeleton } from '@/components/shared/LoadingSkeleton'
import { PROJE_DURUMLARI } from '@/utils/constants'
import { cn } from '@/lib/utils'

export default function ProjeListesi() {
  const navigate = useNavigate()
  const [filtreler, setFiltreler] = useState({ durum: '', bolge_id: '', tip: '' })
  const { data: projeler, isLoading } = useProjeler(filtreler)
  const { data: bolgeler } = useBolgeler()
  const { data: isTipleri } = useIsTipleri()
  const { data: sablonlar } = useDonguSablonlari()
  const projeSil = useProjeSil()

  const [silmeDialogAcik, setSilmeDialogAcik] = useState(false)
  const [silinecekProje, setSilinecekProje] = useState(null)

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
    projeSil.mutate(silinecekProje.id, {
      onSettled: () => {
        setSilinecekProje(null)
        setSilmeDialogAcik(false)
      },
    })
  }

  const handleFiltreChange = (key, value) => {
    setFiltreler((prev) => ({ ...prev, [key]: value }))
  }

  const columns = useMemo(
    () => [
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
        header: 'Tip',
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
        header: 'Musteri',
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
        cell: ({ row }) => row.original.aktif_sorumlu_adi || <span className="text-muted-foreground">-</span>,
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
        accessorKey: 'tamamlanma_yuzdesi',
        header: 'Ilerleme',
        cell: ({ getValue }) => {
          const v = getValue() || 0
          return (
            <div className="flex items-center gap-2">
              <div className="h-2 w-16 rounded-full bg-gray-200">
                <div
                  className={cn(
                    'h-2 rounded-full',
                    v >= 100
                      ? 'bg-emerald-500'
                      : v >= 50
                        ? 'bg-primary'
                        : 'bg-amber-500'
                  )}
                  style={{ width: `${Math.min(v, 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">%{v}</span>
            </div>
          )
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
    [navigate]
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

      <DataTable
        columns={columns}
        data={projeler || []}
        searchPlaceholder="Proje ara..."
      />

      <ConfirmDialog
        open={silmeDialogAcik}
        onClose={() => {
          setSilmeDialogAcik(false)
          setSilinecekProje(null)
        }}
        onConfirm={handleSil}
        title="Projeyi Sil"
        message={`"${silinecekProje?.proje_no}" numarali projeyi silmek istediginize emin misiniz? Bu islem geri alinamaz.`}
        confirmText="Sil"
        cancelText="Iptal"
        variant="destructive"
      />
    </div>
  )
}
