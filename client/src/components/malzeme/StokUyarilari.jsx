import { Link } from 'react-router-dom'
import { AlertTriangle, PackageX, ArrowRight } from 'lucide-react'
import { useKritikMalzemeler } from '@/hooks/useMalzeme'
import { MALZEME_KATEGORILERI } from '@/utils/constants'
import { formatSayi } from '@/utils/formatters'
import { cn } from '@/lib/utils'

export default function StokUyarilari() {
  const { data: kritikMalzemeler, isLoading } = useKritikMalzemeler()

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-8 w-48 rounded" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-24 w-full rounded" />
        ))}
      </div>
    )
  }

  if (!kritikMalzemeler?.length) {
    return (
      <div className="rounded-lg border border-input bg-card p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <PackageX className="h-6 w-6 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold">Stok Durumu Iyi</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Kritik seviyenin altinda malzeme bulunmuyor.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-4 w-4 text-red-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Kritik Stok Uyarilari</h2>
          <p className="text-sm text-muted-foreground">
            {kritikMalzemeler.length} malzeme kritik seviyenin altinda
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {kritikMalzemeler.map((malzeme) => {
          const yuzde =
            malzeme.kritik_seviye > 0
              ? Math.round(
                  (malzeme.stok_miktari / malzeme.kritik_seviye) * 100
                )
              : 0
          const stokTukendi = malzeme.stok_miktari === 0
          const cokKritik = yuzde <= 25

          return (
            <div
              key={malzeme.id}
              className={cn(
                'rounded-lg border p-4',
                stokTukendi
                  ? 'border-red-300 bg-red-50'
                  : cokKritik
                    ? 'border-orange-300 bg-orange-50'
                    : 'border-amber-300 bg-amber-50'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      className={cn(
                        'h-4 w-4 shrink-0',
                        stokTukendi
                          ? 'text-red-600'
                          : cokKritik
                            ? 'text-orange-600'
                            : 'text-amber-600'
                      )}
                    />
                    <h3 className="font-semibold">{malzeme.malzeme_adi}</h3>
                    <span className="font-mono text-xs text-muted-foreground">
                      {malzeme.malzeme_kodu}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Mevcut Stok: </span>
                      <span
                        className={cn(
                          'font-bold',
                          stokTukendi ? 'text-red-700' : 'text-orange-700'
                        )}
                      >
                        {formatSayi(malzeme.stok_miktari)} {malzeme.birim}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Kritik Seviye:{' '}
                      </span>
                      <span className="font-medium">
                        {formatSayi(malzeme.kritik_seviye)} {malzeme.birim}
                      </span>
                    </div>
                    {malzeme.kategori && (
                      <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium">
                        {MALZEME_KATEGORILERI[malzeme.kategori] ||
                          malzeme.kategori}
                      </span>
                    )}
                  </div>

                  {/* Stok Seviye Cubugu */}
                  <div className="mt-2.5">
                    <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/60">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          stokTukendi
                            ? 'bg-red-500'
                            : cokKritik
                              ? 'bg-orange-500'
                              : 'bg-amber-500'
                        )}
                        style={{ width: `${Math.min(yuzde, 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Kritik seviyenin %{yuzde} kadarı mevcut
                    </p>
                  </div>
                </div>

                <Link
                  to={`/malzeme/${malzeme.id}`}
                  className={cn(
                    'ml-4 flex shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium',
                    stokTukendi
                      ? 'bg-red-200 text-red-800 hover:bg-red-300'
                      : 'bg-orange-200 text-orange-800 hover:bg-orange-300'
                  )}
                >
                  Detay
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {stokTukendi && (
                <div className="mt-3 rounded-md bg-red-200/60 px-3 py-1.5 text-xs font-medium text-red-800">
                  Stok tamamen tukenmis! Acil tedarik gereklidir.
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
