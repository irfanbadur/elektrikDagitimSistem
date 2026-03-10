import { useState } from 'react'
import { MapPin, Link2, Unlink, Trash2, Plus } from 'lucide-react'
import { useProjeDirekler, useProjeDirekGuncelle, useProjeDirekSil } from '@/hooks/useProjeDirekler'
import { cn } from '@/lib/utils'

const TIPI_LABELS = {
  direk: 'Direk',
  kablo: 'Kablo',
  trafo: 'Trafo',
  pano: 'Pano',
  agdirek: 'AG Direk',
}

function DirekSatiri({ kalem: k, onGuncelle, onSil }) {
  return (
    <tr className="border-b border-input/50 hover:bg-muted/30 transition-colors group">
      <td className="px-3 py-2 text-xs font-medium">{k.kisa_adi || '-'}</td>
      <td className="px-3 py-2 text-xs">
        {k.katalog_adi ? (
          <div className="flex items-center gap-1 text-emerald-600">
            <Link2 className="h-3 w-3" />
            <span>{k.katalog_adi}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-amber-600">
            <Unlink className="h-3 w-3" />
            <span className="text-muted-foreground">Eslesmedi</span>
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-xs">{TIPI_LABELS[k.tipi] || k.tipi}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{k.arasi_kablo || '-'}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{k.notlar || '-'}</td>
      <td className="px-3 py-2 text-right">
        <button onClick={onSil} className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600" title="Sil">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
}

export default function ProjeDirekler({ projeId }) {
  const { data: direkler, isLoading } = useProjeDirekler(projeId)
  const guncelle = useProjeDirekGuncelle(projeId)
  const sil = useProjeDirekSil(projeId)

  const eslesme = direkler?.length > 0
    ? Math.round(direkler.filter(d => d.katalog_adi).length / direkler.length * 100)
    : 0

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Kroki Direk Listesi
          </h3>
          <p className="text-sm text-muted-foreground">Krokideki direkler ve katalog eslesmeleri</p>
        </div>
        {direkler?.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{direkler.length} direk</span>
            <span className={cn('text-xs font-medium', eslesme >= 80 ? 'text-emerald-600' : eslesme >= 50 ? 'text-amber-600' : 'text-red-600')}>
              %{eslesme} katalog eslesmesi
            </span>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-input bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-input bg-muted/50">
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Krokideki Adi</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Katalog Eslesmesi</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Tipi</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Arasi Kablo</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Not</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground w-12"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-input/50">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-3 py-2.5"><div className="skeleton h-4 w-full rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : !direkler?.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-12 text-center">
                    <MapPin className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">Direk listesi bos</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">Yer teslim krokisinden otomatik olarak veya projeden duzenlenebilir</p>
                  </td>
                </tr>
              ) : (
                direkler.map((k) => (
                  <DirekSatiri
                    key={k.id}
                    kalem={k}
                    onGuncelle={(data) => guncelle.mutate({ id: k.id, ...k, ...data })}
                    onSil={() => sil.mutate(k.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
