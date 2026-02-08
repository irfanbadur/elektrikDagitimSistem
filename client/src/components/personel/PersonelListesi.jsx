import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, Pencil, Trash2 } from 'lucide-react'
import { usePersonelListesi, usePersonelSil } from '@/hooks/usePersonel'
import DataTable from '@/components/shared/DataTable'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { GOREV_TIPLERI } from '@/utils/constants'
import { TableSkeleton } from '@/components/shared/LoadingSkeleton'

export default function PersonelListesi() {
  const navigate = useNavigate()
  const { data: personeller, isLoading } = usePersonelListesi()
  const personelSil = usePersonelSil()

  const [silmeDialogAcik, setSilmeDialogAcik] = useState(false)
  const [silinecekPersonel, setSilinecekPersonel] = useState(null)

  const handleSil = () => {
    if (!silinecekPersonel) return
    personelSil.mutate(silinecekPersonel.personel_id, {
      onSettled: () => {
        setSilinecekPersonel(null)
        setSilmeDialogAcik(false)
      },
    })
  }

  const columns = useMemo(
    () => [
      {
        accessorKey: 'ad_soyad',
        header: 'Ad Soyad',
        cell: ({ row }) => (
          <span className="font-medium">{row.original.ad_soyad}</span>
        ),
      },
      {
        accessorKey: 'telefon',
        header: 'Telefon',
        cell: ({ row }) => row.original.telefon || '-',
      },
      {
        accessorKey: 'gorev',
        header: 'Gorev',
        cell: ({ row }) => (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            {GOREV_TIPLERI[row.original.gorev] || row.original.gorev || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'ekip_adi',
        header: 'Ekip',
        cell: ({ row }) => row.original.ekip_adi || '-',
      },
      {
        accessorKey: 'aktif',
        header: 'Durum',
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              row.original.aktif !== false
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {row.original.aktif !== false ? 'Aktif' : 'Pasif'}
          </span>
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
                navigate(`/personel/${row.original.personel_id}`)
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Goruntule"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/personel/${row.original.personel_id}/duzenle`)
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Duzenle"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSilinecekPersonel(row.original)
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
          <h1 className="text-2xl font-bold">Personel</h1>
        </div>
        <TableSkeleton rows={6} cols={5} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Personel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Toplam {personeller?.length || 0} personel
          </p>
        </div>
        <button
          onClick={() => navigate('/personel/yeni')}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Yeni Personel
        </button>
      </div>

      <DataTable
        columns={columns}
        data={personeller || []}
        searchPlaceholder="Personel ara..."
      />

      <ConfirmDialog
        open={silmeDialogAcik}
        onClose={() => {
          setSilmeDialogAcik(false)
          setSilinecekPersonel(null)
        }}
        onConfirm={handleSil}
        title="Personeli Sil"
        message={`"${silinecekPersonel?.ad_soyad}" personelini silmek istediginize emin misiniz? Bu islem geri alinamaz.`}
        confirmText="Sil"
        cancelText="Iptal"
        variant="destructive"
      />
    </div>
  )
}
