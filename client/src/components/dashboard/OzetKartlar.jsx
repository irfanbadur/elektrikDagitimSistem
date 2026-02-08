import { FolderKanban, Users, MessageSquare, AlertTriangle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const kartTanimlari = [
  { key: 'aktif_proje', label: 'Aktif Proje', icon: FolderKanban, renk: 'text-blue-600 bg-blue-50' },
  { key: 'sahada_kisi', label: 'Sahada Personel', icon: Users, renk: 'text-green-600 bg-green-50' },
  { key: 'bekleyen_talep', label: 'Bekleyen Talep', icon: MessageSquare, renk: 'text-orange-600 bg-orange-50' },
  { key: 'kritik_stok_sayisi', label: 'Kritik Stok', icon: AlertTriangle, renk: 'text-red-600 bg-red-50' },
  { key: 'bugun_tamamlanan', label: 'Bugün Biten', icon: CheckCircle, renk: 'text-emerald-600 bg-emerald-50' },
]

export default function OzetKartlar({ data }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {kartTanimlari.map(({ key, label, icon: Icon, renk }) => (
        <div key={key} className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">{label}</span>
            <div className={cn('rounded-lg p-2', renk)}>
              <Icon className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold">{data?.[key] ?? '-'}</p>
        </div>
      ))}
    </div>
  )
}
