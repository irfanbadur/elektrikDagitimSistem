import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, AlertTriangle, Eye, Edit } from 'lucide-react'
import { useMalzemeler } from '@/hooks/useMalzeme'
import DataTable from '@/components/shared/DataTable'
import { MALZEME_KATEGORILERI } from '@/utils/constants'
import { formatSayi, formatParaBirimi } from '@/utils/formatters'
import { cn } from '@/lib/utils'

export default function StokListesi() {
  const navigate = useNavigate()
  const [kategori, setKategori] = useState('')
  const { data: malzemeler, isLoading } = useMalzemeler()

  const filtrelenmis = kategori
    ? malzemeler?.filter((m) => m.kategori === kategori)
    : malzemeler

  const columns = [
    {
      accessorKey: 'malzeme_kodu',
      header: 'Kod',
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{getValue()}</span>
      ),
    },
    {
      accessorKey: 'malzeme_adi',
      header: 'Malzeme Adı',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.stok_miktari <= row.original.kritik_seviye && (
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          )}
          <span className="font-medium">{row.original.malzeme_adi}</span>
        </div>
      ),
    },
    {
      accessorKey: 'kategori',
      header: 'Kategori',
      cell: ({ getValue }) => (
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
          {MALZEME_KATEGORILERI[getValue()] || getValue()}
        </span>
      ),
    },
    {
      accessorKey: 'birim',
      header: 'Birim',
    },
    {
      accessorKey: 'stok_miktari',
      header: 'Stok Miktarı',
      cell: ({ row }) => {
        const kritik =
          row.original.stok_miktari <= row.original.kritik_seviye
        return (
          <span
            className={cn(
              'font-medium',
              kritik ? 'text-red-600' : 'text-foreground'
            )}
          >
            {formatSayi(row.original.stok_miktari)} {row.original.birim}
          </span>
        )
      },
    },
    {
      accessorKey: 'kritik_seviye',
      header: 'Kritik Seviye',
      cell: ({ row }) =>
        `${formatSayi(row.original.kritik_seviye)} ${row.original.birim}`,
    },
    {
      accessorKey: 'birim_fiyat',
      header: 'Birim Fiyat',
      cell: ({ getValue }) => formatParaBirimi(getValue()),
    },
    {
      accessorKey: 'depo_konumu',
      header: 'Depo Konumu',
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">
          {getValue() || '-'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(`/depo/${row.original.id}`)}
            className="rounded p-1.5 hover:bg-muted"
            title="Detay"
          >
            <Eye className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => navigate(`/depo/${row.original.id}/duzenle`)}
            className="rounded p-1.5 hover:bg-muted"
            title="Düzenle"
          >
            <Edit className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Malzeme Stok</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tüm malzeme ve stok bilgilerini görüntüleyin
          </p>
        </div>
        <button
          onClick={() => navigate('/depo/yeni')}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Yeni Malzeme
        </button>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <select
          value={kategori}
          onChange={(e) => setKategori(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Tüm Kategoriler</option>
          {Object.entries(MALZEME_KATEGORILERI).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        {kategori && (
          <button
            onClick={() => setKategori('')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Filtreyi Temizle
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-12 w-full rounded" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtrelenmis || []}
          searchPlaceholder="Malzeme ara..."
        />
      )}
    </div>
  )
}
