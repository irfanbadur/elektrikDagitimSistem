import { Activity } from 'lucide-react'
import { formatGecenSure } from '@/utils/formatters'

const modulIkonlari = {
  proje: '🏗️',
  malzeme: '📦',
  ekip: '👥',
  puantaj: '📋',
  talep: '📨',
  gorev: '✅',
}

export default function SonAktiviteler({ data }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold flex items-center gap-2">
        <Activity className="h-5 w-5 text-muted-foreground" />
        Son Aktiviteler
      </h3>
      {(!data || data.length === 0) ? (
        <p className="text-sm text-muted-foreground">Henüz aktivite yok</p>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {data.map((item) => (
            <div key={item.id} className="flex items-start gap-3 text-sm">
              <span className="text-lg">{modulIkonlari[item.modul] || '📌'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-foreground">{item.detay}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatGecenSure(item.tarih)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
