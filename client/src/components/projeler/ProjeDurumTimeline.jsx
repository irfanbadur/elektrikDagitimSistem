import { PROJE_DURUMLARI, PROJE_DURUM_RENKLERI } from '@/utils/constants'
import { formatTarihSaat } from '@/utils/formatters'
import { cn } from '@/lib/utils'
import { Clock } from 'lucide-react'

export default function ProjeDurumTimeline({ gecmis }) {
  if (!gecmis || gecmis.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Durum Gecmisi
        </h3>
        <p className="text-sm text-muted-foreground">
          Henuz durum degisikligi yapilmamis.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="mb-4 flex items-center gap-2 font-semibold">
        <Clock className="h-4 w-4 text-muted-foreground" />
        Durum Gecmisi
      </h3>
      <div className="space-y-0">
        {gecmis.map((item, i) => {
          const yeniConfig = PROJE_DURUMLARI[item.yeni_durum]
          const eskiConfig = PROJE_DURUMLARI[item.eski_durum]
          const yeniRenk = PROJE_DURUM_RENKLERI[item.yeni_durum]
          const isFirst = i === 0
          const isLast = i === gecmis.length - 1

          return (
            <div key={item.id || i} className="flex gap-4">
              {/* Timeline line and dot */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'mt-1 h-3 w-3 shrink-0 rounded-full border-2',
                    isFirst
                      ? 'border-primary bg-primary'
                      : 'border-gray-300 bg-white'
                  )}
                />
                {!isLast && (
                  <div className="w-0.5 flex-1 bg-gray-200" />
                )}
              </div>

              {/* Content */}
              <div className={cn('pb-6', isLast && 'pb-0')}>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                      yeniRenk || 'bg-gray-100 text-gray-700'
                    )}
                  >
                    {yeniConfig?.emoji} {yeniConfig?.label || item.yeni_durum}
                  </span>
                  {item.eski_durum && (
                    <span className="text-xs text-muted-foreground">
                      ({eskiConfig?.label || item.eski_durum} durumundan)
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatTarihSaat(item.tarih)}
                  {item.degistiren && (
                    <span> &mdash; {item.degistiren}</span>
                  )}
                </p>
                {item.notlar && (
                  <p className="mt-1 rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                    {item.notlar}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
