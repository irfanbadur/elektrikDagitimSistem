import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye } from 'lucide-react'
import { useTalepler } from '@/hooks/useTalepler'
import DataTable from '@/components/shared/DataTable'
import { TalepDurumBadge, OncelikBadge } from '@/components/shared/StatusBadge'
import { TALEP_TIPLERI, TALEP_DURUMLARI } from '@/utils/constants'
import { formatTarih } from '@/utils/formatters'

export default function TalepListesi() {
  const navigate = useNavigate()
  const [filtreler, setFiltreler] = useState({ durum: '', talep_tipi: '' })
  const { data: talepler, isLoading } = useTalepler(filtreler)

  const columns = [
    { accessorKey: 'talep_no', header: 'Talep No', cell: ({ getValue }) => (
      <span className="font-mono text-sm font-medium">{getValue()}</span>
    )},
    { accessorKey: 'talep_tipi', header: 'Tip', cell: ({ getValue }) => TALEP_TIPLERI[getValue()] || getValue() },
    { accessorKey: 'ekip_adi', header: 'Ekip' },
    { accessorKey: 'aciklama', header: 'Açıklama', cell: ({ getValue }) => {
      const v = getValue() || ''
      return <span title={v}>{v.length > 50 ? v.slice(0, 50) + '...' : v}</span>
    }},
    { accessorKey: 'oncelik', header: 'Öncelik', cell: ({ getValue }) => <OncelikBadge oncelik={getValue()} /> },
    { accessorKey: 'durum', header: 'Durum', cell: ({ getValue }) => <TalepDurumBadge durum={getValue()} /> },
    { accessorKey: 'olusturma_tarihi', header: 'Tarih', cell: ({ getValue }) => formatTarih(getValue()) },
    { id: 'actions', header: '', cell: ({ row }) => (
      <button onClick={() => navigate(`/talepler/${row.original.id}`)} className="rounded p-1.5 hover:bg-muted">
        <Eye className="h-4 w-4 text-muted-foreground" />
      </button>
    )},
  ]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Talepler</h1>
        <button onClick={() => navigate('/talepler/yeni')} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Yeni Talep
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <select value={filtreler.durum} onChange={e => setFiltreler(f => ({...f, durum: e.target.value}))} className="rounded-md border border-input bg-white px-3 py-2 text-sm">
          <option value="">Tüm Durumlar</option>
          {Object.entries(TALEP_DURUMLARI).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={filtreler.talep_tipi} onChange={e => setFiltreler(f => ({...f, talep_tipi: e.target.value}))} className="rounded-md border border-input bg-white px-3 py-2 text-sm">
          <option value="">Tüm Tipler</option>
          {Object.entries(TALEP_TIPLERI).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({length:5}).map((_,i) => <div key={i} className="skeleton h-12 w-full" />)}</div>
      ) : (
        <DataTable columns={columns} data={talepler || []} searchPlaceholder="Talep ara..." />
      )}
    </div>
  )
}
