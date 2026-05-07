import { Link } from 'react-router-dom'
import { Briefcase, ExternalLink } from 'lucide-react'
import { useIhaleOzet } from '@/hooks/useDashboard'
import { cn } from '@/lib/utils'

const tl = (n) => (Number(n) || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })

function YuzdeBari({ yuzde, renk = 'bg-emerald-500' }) {
  const y = Math.max(0, Math.min(100, Number(yuzde) || 0))
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', renk)} style={{ width: `${y}%` }} />
    </div>
  )
}

export default function IhalePanosu() {
  const { data, isLoading } = useIhaleOzet()
  if (isLoading) return <div className="h-32 rounded-lg border border-border bg-card animate-pulse" />
  if (!data) return null

  const { ihaleler = [], toplam = {} } = data
  if (!ihaleler.length) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
        <div className="flex items-center justify-between gap-2 text-sm text-amber-800">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            <span>Henüz ihale tanımlanmamış.</span>
          </div>
          <Link to="/ihaleler" className="rounded bg-amber-600 px-3 py-1 text-xs text-white hover:bg-amber-700">
            İhale Ekle
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold tracking-wide">İHALELER</h3>
          <span className="text-[10px] text-muted-foreground">
            {toplam.aktif_ihale} aktif / {toplam.ihale_sayisi} toplam
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Aktif Toplam Bedel</div>
            <div className="text-lg font-bold tabular-nums text-primary">{tl(toplam.toplam_bedel)} ₺</div>
          </div>
          <Link to="/ihaleler" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Tüm ihaleler">
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        {ihaleler.map(i => (
          <Link key={i.id} to={`/ihaleler/${i.id}`}
            className="block rounded-lg border border-border bg-white px-4 py-3 hover:border-primary hover:shadow-sm transition-all">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate">{i.ihale_adi}</span>
                  {i.is_tipi_kodlari?.map(k => (
                    <span key={k} className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-700 border border-blue-200">{k}</span>
                  ))}
                  <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-medium uppercase',
                    i.durum === 'aktif' ? 'bg-emerald-100 text-emerald-700' :
                    i.durum === 'tamamlandi' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-600')}>{i.durum}</span>
                </div>
                {(i.sozlesme_no || i.yuklenici) && (
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {[i.sozlesme_no, i.yuklenici].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-base font-bold tabular-nums text-primary">{tl(i.sozlesme_bedeli)} ₺</div>
                <div className="text-[10px] text-muted-foreground">{i.proje_sayisi} proje</div>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <div className="mb-0.5 flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Üretilen Keşif</span>
                  <span className="font-medium text-blue-700">%{i.kesif_yuzdesi.toFixed(1)} · {tl(i.toplam_kesif)} ₺</span>
                </div>
                <YuzdeBari yuzde={i.kesif_yuzdesi} renk="bg-blue-500" />
              </div>
              <div>
                <div className="mb-0.5 flex justify-between text-[10px]">
                  <span className="text-muted-foreground">İlerleme · Kalan: {tl(i.kalan_tutar)} ₺</span>
                  <span className="font-medium text-emerald-700">%{i.ilerleme_yuzdesi.toFixed(1)}</span>
                </div>
                <YuzdeBari yuzde={i.ilerleme_yuzdesi} renk="bg-emerald-500" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
