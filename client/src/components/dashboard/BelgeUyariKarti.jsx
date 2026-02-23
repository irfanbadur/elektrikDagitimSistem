import { FileWarning, AlertTriangle, FileX, FileCheck } from 'lucide-react'
import { useSuresiDolmusBelgeler, useSuresiDolacakBelgeler, useEksikZorunluBelgeler } from '@/hooks/useOrganizasyon'

export default function BelgeUyariKarti() {
  const { data: dolmus } = useSuresiDolmusBelgeler()
  const { data: dolacak } = useSuresiDolacakBelgeler(30)
  const { data: eksik } = useEksikZorunluBelgeler()

  const dolmusSayi = dolmus?.length || 0
  const dolacakSayi = dolacak?.length || 0
  const eksikSayi = eksik?.length || 0
  const toplam = dolmusSayi + dolacakSayi + eksikSayi

  if (toplam === 0) return null

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <FileWarning className="h-5 w-5 text-amber-500" />
        <h3 className="text-sm font-semibold">Belge Durumu</h3>
      </div>

      <div className="space-y-3">
        {dolmusSayi > 0 && (
          <div className="flex items-start gap-2">
            <FileX className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-700">Süresi Dolmuş ({dolmusSayi})</p>
              <div className="mt-1 space-y-0.5">
                {(dolmus || []).slice(0, 3).map((b) => (
                  <p key={b.id} className="text-xs text-muted-foreground">
                    {b.ad_soyad} - {b.belge_adi} ({b.gecen_gun} gün geçmiş)
                  </p>
                ))}
                {dolmusSayi > 3 && (
                  <p className="text-xs text-muted-foreground">+{dolmusSayi - 3} daha...</p>
                )}
              </div>
            </div>
          </div>
        )}

        {dolacakSayi > 0 && (
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-700">30 Gün İçinde Dolacak ({dolacakSayi})</p>
              <div className="mt-1 space-y-0.5">
                {(dolacak || []).slice(0, 3).map((b) => (
                  <p key={b.id} className="text-xs text-muted-foreground">
                    {b.ad_soyad} - {b.belge_adi} ({b.kalan_gun} gün kaldı)
                  </p>
                ))}
                {dolacakSayi > 3 && (
                  <p className="text-xs text-muted-foreground">+{dolacakSayi - 3} daha...</p>
                )}
              </div>
            </div>
          </div>
        )}

        {eksikSayi > 0 && (
          <div className="flex items-start gap-2">
            <FileCheck className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-orange-700">Eksik Zorunlu Belge ({eksikSayi})</p>
              <div className="mt-1 space-y-0.5">
                {(eksik || []).slice(0, 3).map((b, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    {b.ad_soyad} - {b.belge_adi} eksik
                  </p>
                ))}
                {eksikSayi > 3 && (
                  <p className="text-xs text-muted-foreground">+{eksikSayi - 3} daha...</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
