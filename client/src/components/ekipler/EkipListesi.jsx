import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, Pencil, Trash2, Users } from 'lucide-react'
import { useEkipler, useEkipSil } from '@/hooks/useEkipler'
import DataTable from '@/components/shared/DataTable'
import { EkipDurumBadge } from '@/components/shared/StatusBadge'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { TableSkeleton } from '@/components/shared/LoadingSkeleton'

export default function EkipListesi() {
  const navigate = useNavigate()
  const { data: ekipler, isLoading } = useEkipler()
  const ekipSil = useEkipSil()

  const [silmeDialogAcik, setSilmeDialogAcik] = useState(false)
  const [silinecekEkip, setSilinecekEkip] = useState(null)

  const handleSil = () => {
    if (!silinecekEkip) return
    ekipSil.mutate(silinecekEkip.ekip_id, {
      onSettled: () => {
        setSilinecekEkip(null)
        setSilmeDialogAcik(false)
      },
    })
  }

  const columns = useMemo(
    () => [
      {
        accessorKey: 'ekip_kodu',
        header: 'Ekip Kodu',
        cell: ({ row }) => (
          <span className="font-medium text-primary">{row.original.ekip_kodu}</span>
        ),
      },
      {
        accessorKey: 'ekip_adi',
        header: 'Ekip Adı',
        cell: ({ row }) => (
          <span className="font-medium">{row.original.ekip_adi}</span>
        ),
      },
      {
        accessorKey: 'ekip_basi',
        header: 'Ekip Başı',
        cell: ({ row }) => row.original.ekip_basi_adi || '-',
      },
      {
        accessorKey: 'bolge_adi',
        header: 'Bolge',
        cell: ({ row }) => row.original.bolge_adi || '-',
      },
      {
        accessorKey: 'arac_plaka',
        header: 'Arac Plaka',
        cell: ({ row }) => row.original.arac_plaka || '-',
      },
      {
        accessorKey: 'durum',
        header: 'Durum',
        cell: ({ row }) => <EkipDurumBadge durum={row.original.durum} />,
      },
      {
        accessorKey: 'personel_sayisi',
        header: 'Personel',
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{row.original.personel_sayisi ?? 0}</span>
          </div>
        ),
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
                navigate(`/ekipler/${row.original.ekip_id}`)
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Goruntule"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/ekipler/${row.original.ekip_id}/duzenle`)
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Duzenle"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSilinecekEkip(row.original)
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
          <h1 className="text-2xl font-bold">Ekipler</h1>
        </div>
        <TableSkeleton rows={6} cols={7} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ekipler</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Toplam {ekipler?.length || 0} ekip
          </p>
        </div>
        <button
          onClick={() => navigate('/ekipler/yeni')}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Yeni Ekip
        </button>
      </div>

      <DataTable
        columns={columns}
        data={ekipler || []}
        searchPlaceholder="Ekip ara..."
      />

      <ConfirmDialog
        open={silmeDialogAcik}
        onClose={() => {
          setSilmeDialogAcik(false)
          setSilinecekEkip(null)
        }}
        onConfirm={handleSil}
        title="Ekibi Sil"
        message={`"${silinecekEkip?.ekip_adi}" ekibini silmek istediginize emin misiniz? Bu islem geri alinamaz.`}
        confirmText="Sil"
        cancelText="Iptal"
        variant="destructive"
      />
    </div>
  )
}
