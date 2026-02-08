import { Users } from 'lucide-react'

export default function EkipDurumlari({ data }) {
  if (!data || data.length === 0) return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Ekip Durumları</h3>
      <p className="text-sm text-muted-foreground">Ekip verisi bulunamadı</p>
    </div>
  )

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold flex items-center gap-2">
        <Users className="h-5 w-5 text-muted-foreground" />
        Ekip Durumları
      </h3>
      <div className="space-y-3">
        {data.map((ekip) => (
          <div key={ekip.ekip_id} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/30">
            <div className={`h-3 w-3 rounded-full ${ekip.rapor_geldi ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{ekip.ekip_adi}</span>
                {ekip.bolge_adi && <span className="text-xs text-muted-foreground">- {ekip.bolge_adi}</span>}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                {ekip.aktif_proje && <span>{ekip.aktif_proje}</span>}
                {ekip.kisi_sayisi > 0 && <span>{ekip.kisi_sayisi} kişi</span>}
                <span>{ekip.rapor_geldi ? 'Rapor geldi' : 'Rapor bekleniyor'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
