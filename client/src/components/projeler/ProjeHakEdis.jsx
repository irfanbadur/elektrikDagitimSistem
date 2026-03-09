import { useProjeKesif, useProjeKesifOzet } from '@/hooks/useProjeKesif'
import { BarChart3, Package, TrendingUp, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ProjeHakEdis({ projeId }) {
  const { data: kesifler, isLoading } = useProjeKesif(projeId)
  const { data: ozet } = useProjeKesifOzet(projeId)

  const toplamTutar = kesifler?.reduce((t, k) => t + (k.miktar || 0) * (k.birim_fiyat || 0), 0) || 0
  const alinanTutar = kesifler?.filter(k => k.durum === 'alindi' || k.durum === 'sahaya_verildi').reduce((t, k) => t + (k.miktar || 0) * (k.birim_fiyat || 0), 0) || 0

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Hak Edis</h3>
        <p className="text-sm text-muted-foreground">Kesif listesi uzerinden hak edis ozeti</p>
      </div>

      {/* Ozet Kartlari */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-input bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Package className="h-3.5 w-3.5" />Kesif Tutari</div>
          <p className="mt-1 text-lg font-bold">{toplamTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</p>
        </div>
        <div className="rounded-lg border border-input bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5" />Alinan Tutar</div>
          <p className="mt-1 text-lg font-bold text-emerald-600">{alinanTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</p>
        </div>
        <div className="rounded-lg border border-input bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" />Gerceklesme</div>
          <p className="mt-1 text-lg font-bold text-blue-600">{toplamTutar > 0 ? Math.round(alinanTutar / toplamTutar * 100) : 0}%</p>
        </div>
        <div className="rounded-lg border border-input bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><BarChart3 className="h-3.5 w-3.5" />Kalan</div>
          <p className="mt-1 text-lg font-bold text-amber-600">{(toplamTutar - alinanTutar).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</p>
        </div>
      </div>

      {/* Kesif - Hak Edis Karsilastirma Tablosu */}
      <div className="overflow-hidden rounded-lg border border-input bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-input bg-muted/50">
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Poz No</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Malzeme</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Birim</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">Kesif Miktari</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">Alinan</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">Fark</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">Birim Fiyat</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-input/50">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-3 py-2.5"><div className="skeleton h-4 w-full rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : !kesifler?.length ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center">
                    <BarChart3 className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Once Kesif sekmesinden malzeme listesi olusturun</p>
                  </td>
                </tr>
              ) : (
                <>
                  {kesifler.map((k) => {
                    const alinan = k.alinan_miktar || 0
                    const fark = k.miktar - alinan
                    const tutar = k.miktar * (k.birim_fiyat || 0)
                    return (
                      <tr key={k.id} className="border-b border-input/50 hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono text-xs text-blue-600">{k.poz_no || '-'}</td>
                        <td className="px-3 py-2 text-xs font-medium">{k.malzeme_adi}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{k.birim}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums">{k.miktar?.toLocaleString('tr-TR')}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-emerald-600 font-medium">{alinan > 0 ? alinan.toLocaleString('tr-TR') : '-'}</td>
                        <td className={cn('px-3 py-2 text-right text-xs tabular-nums font-medium', fark > 0 ? 'text-amber-600' : fark === 0 ? 'text-emerald-600' : 'text-red-600')}>
                          {fark !== 0 ? fark.toLocaleString('tr-TR') : '-'}
                        </td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums">{k.birim_fiyat ? k.birim_fiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '-'}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums font-medium">{tutar > 0 ? tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '-'}</td>
                      </tr>
                    )
                  })}
                  {/* Toplam Satiri */}
                  <tr className="bg-muted/50 font-semibold">
                    <td colSpan={7} className="px-3 py-2 text-right text-xs">Toplam:</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">{toplamTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
