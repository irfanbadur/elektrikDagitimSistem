import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Briefcase, Pencil, Trash2, ExternalLink } from 'lucide-react'
import MainLayout from '@/components/layout/MainLayout'
import { useIhaleler, useIhaleSil } from '@/hooks/useIhaleler'
import IhaleForm from '@/components/ihaleler/IhaleForm'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
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

const DURUM_RENK = {
  aktif: 'bg-emerald-100 text-emerald-700',
  tamamlandi: 'bg-blue-100 text-blue-700',
  iptal: 'bg-slate-100 text-slate-600',
}

export default function IhalelerListePage() {
  const { data: ihaleler, isLoading } = useIhaleler()
  const sil = useIhaleSil()
  const [formAcik, setFormAcik] = useState(false)
  const [duzenle, setDuzenle] = useState(null)
  const [silinecek, setSilinecek] = useState(null)

  return (
    <MainLayout title="İhaleler">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Briefcase className="h-6 w-6 text-primary" /> İhaleler</h1>
            <p className="mt-1 text-sm text-muted-foreground">Toplam {ihaleler?.length || 0} ihale</p>
          </div>
          <button onClick={() => { setDuzenle(null); setFormAcik(true) }}
            className="flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Yeni İhale
          </button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({length: 4}).map((_, i) => <div key={i} className="skeleton h-40 rounded-lg" />)}
          </div>
        ) : !ihaleler?.length ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
            Henüz ihale tanımlanmamış. Yukarıdan ekleyin.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {ihaleler.map(i => (
              <div key={i.id} className="rounded-lg border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <Link to={`/ihaleler/${i.id}`} className="font-semibold text-base hover:text-primary line-clamp-2">
                      {i.ihale_adi}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {i.sozlesme_no && <span className="font-mono">{i.sozlesme_no}</span>}
                      {i.yuklenici && <span className="truncate max-w-[200px]" title={i.yuklenici}>{i.yuklenici}</span>}
                      <span className={cn('rounded px-2 py-0.5 text-[10px] font-medium uppercase', DURUM_RENK[i.durum] || 'bg-slate-100')}>{i.durum}</span>
                    </div>
                    {i.is_tipi_kodlari?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {i.is_tipi_kodlari.map(k => (
                          <span key={k} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-200">{k}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Link to={`/ihaleler/${i.id}`} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Detay">
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                    <button onClick={() => { setDuzenle(i); setFormAcik(true) }}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Düzenle">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setSilinecek(i)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600" title="Sil">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Sözleşme Bedeli</span>
                  <span className="text-lg font-bold text-primary tabular-nums">{tl(i.sozlesme_bedeli)} ₺</span>
                </div>

                <div className="space-y-2">
                  <div>
                    <div className="mb-0.5 flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Üretilen Keşif</span>
                      <span className="font-medium text-blue-700">%{i.kesif_yuzdesi.toFixed(1)} · {tl(i.toplam_kesif)} ₺</span>
                    </div>
                    <YuzdeBari yuzde={i.kesif_yuzdesi} renk="bg-blue-500" />
                  </div>
                  <div>
                    <div className="mb-0.5 flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Hak Ediş İlerleme</span>
                      <span className="font-medium text-emerald-700">%{i.ilerleme_yuzdesi.toFixed(1)} · {tl(i.toplam_ilerleme)} ₺</span>
                    </div>
                    <YuzdeBari yuzde={i.ilerleme_yuzdesi} renk="bg-emerald-500" />
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{i.proje_sayisi} proje</span>
                  <span>Kalan: <strong className="text-foreground">{tl(i.kalan_tutar)} ₺</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {formAcik && <IhaleForm ihale={duzenle} onClose={() => { setFormAcik(false); setDuzenle(null) }} />}

      <ConfirmDialog
        open={!!silinecek}
        title="İhaleyi Sil?"
        message={`"${silinecek?.ihale_adi}" silinecek. Bağlı projelerin "ihale" bağlantısı kaldırılır (projeler silinmez).`}
        onConfirm={() => { if (silinecek) sil.mutate(silinecek.id, { onSuccess: () => setSilinecek(null) }) }}
        onClose={() => setSilinecek(null)}
      />
    </MainLayout>
  )
}
