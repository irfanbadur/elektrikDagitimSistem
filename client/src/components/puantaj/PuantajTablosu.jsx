import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, Edit } from 'lucide-react'
import { usePuantajlar } from '@/hooks/usePuantaj'
import { useEkipler } from '@/hooks/useEkipler'
import DataTable from '@/components/shared/DataTable'
import { IS_KATEGORILERI } from '@/utils/constants'
import { formatTarih } from '@/utils/formatters'
import { bugununTarihi } from '@/utils/formatters'

export default function PuantajTablosu() {
  const navigate = useNavigate()
  const [filtreler, setFiltreler] = useState({ tarih: '', ekip_id: '' })
  const { data: raporlar, isLoading } = usePuantajlar(filtreler)
  const { data: ekipler } = useEkipler()

  const columns = [
    { accessorKey: 'tarih', header: 'Tarih', cell: ({ getValue }) => formatTarih(getValue()) },
    { accessorKey: 'ekip_adi', header: 'Ekip' },
    { accessorKey: 'proje_no', header: 'Proje' },
    { accessorKey: 'bolge_adi', header: 'Bölge' },
    { accessorKey: 'kisi_sayisi', header: 'Kişi', cell: ({ getValue }) => `${getValue()} kişi` },
    { accessorKey: 'baslama_saati', header: 'Başlangıç' },
    { accessorKey: 'bitis_saati', header: 'Bitiş' },
    { accessorKey: 'yapilan_is', header: 'Yapılan İş', cell: ({ getValue }) => {
      const v = getValue() || ''
      return <span title={v}>{v.length > 40 ? v.slice(0, 40) + '...' : v}</span>
    }},
    { accessorKey: 'is_kategorisi', header: 'Kategori', cell: ({ getValue }) => IS_KATEGORILERI[getValue()] || getValue() },
    { id: 'actions', header: '', cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <button onClick={() => navigate(`/puantaj/${row.original.id}`)} className="rounded p-1.5 hover:bg-muted"><Eye className="h-4 w-4 text-muted-foreground" /></button>
        <button onClick={() => navigate(`/puantaj/${row.original.id}/duzenle`)} className="rounded p-1.5 hover:bg-muted"><Edit className="h-4 w-4 text-muted-foreground" /></button>
      </div>
    )},
  ]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Puantaj / Günlük Raporlar</h1>
        <button onClick={() => navigate('/puantaj/yeni')} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Yeni Rapor
        </button>
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <input type="date" value={filtreler.tarih} onChange={e => setFiltreler(f => ({...f, tarih: e.target.value}))} className="rounded-md border border-input bg-white px-3 py-2 text-sm" />
        <select value={filtreler.ekip_id} onChange={e => setFiltreler(f => ({...f, ekip_id: e.target.value}))} className="rounded-md border border-input bg-white px-3 py-2 text-sm">
          <option value="">Tüm Ekipler</option>
          {ekipler?.map(e => <option key={e.id} value={e.id}>{e.ekip_adi}</option>)}
        </select>
      </div>
      {isLoading ? (
        <div className="space-y-3">{Array.from({length:5}).map((_,i) => <div key={i} className="skeleton h-12 w-full" />)}</div>
      ) : (
        <DataTable columns={columns} data={raporlar || []} searchPlaceholder="Rapor ara..." />
      )}
    </div>
  )
}
