import { AlertCircle } from 'lucide-react'
import { OncelikBadge } from '@/components/shared/StatusBadge'

export default function AcikTalepler({ talepler, kritikStoklar }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-red-500" />
        Acil / Önemli
      </h3>
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {talepler && talepler.length > 0 && talepler.map(t => (
          <div key={t.id} className="flex items-start gap-2 rounded-md border border-border p-2.5 text-sm">
            <OncelikBadge oncelik={t.oncelik} />
            <div className="flex-1 min-w-0">
              <p className="font-medium">{t.aciklama}</p>
              <p className="text-xs text-muted-foreground">{t.ekip_adi || 'Ekip belirtilmemiş'}</p>
            </div>
          </div>
        ))}
        {kritikStoklar && kritikStoklar.length > 0 && kritikStoklar.map(m => (
          <div key={m.id} className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-2.5 text-sm">
            <span className="text-orange-500">⚠️</span>
            <div>
              <p className="font-medium text-orange-700">{m.malzeme_adi}</p>
              <p className="text-xs text-orange-600">Stok: {m.stok_miktari} {m.birim} (Kritik: {m.kritik_seviye})</p>
            </div>
          </div>
        ))}
        {(!talepler || talepler.length === 0) && (!kritikStoklar || kritikStoklar.length === 0) && (
          <p className="text-sm text-muted-foreground">Acil durum yok</p>
        )}
      </div>
    </div>
  )
}
