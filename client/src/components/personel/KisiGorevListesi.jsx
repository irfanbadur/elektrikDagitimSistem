import { Briefcase, X } from 'lucide-react'
import { useKisininGorevleri, useGorevSonlandir } from '@/hooks/useOrganizasyon'
import { GOREV_KATEGORILERI } from '@/utils/constants'
import { formatTarih } from '@/utils/formatters'

const KATEGORI_RENK = {
  proje_bazli: 'bg-blue-100 text-blue-700',
  firma_geneli: 'bg-purple-100 text-purple-700',
  gecici: 'bg-orange-100 text-orange-700',
}

export default function KisiGorevListesi({ kullaniciId }) {
  const { data: gorevler, isLoading } = useKisininGorevleri(kullaniciId)
  const gorevSonlandir = useGorevSonlandir()

  if (isLoading) return <div className="animate-pulse h-20 bg-gray-100 rounded" />

  const liste = gorevler || []

  if (liste.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-muted-foreground">
        Henüz atanmış görev yok.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {liste.map((g) => (
        <div key={g.id} className="flex items-start justify-between rounded-lg border border-border bg-white p-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
              <Briefcase className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{g.gorev_adi}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${KATEGORI_RENK[g.kategori] || 'bg-gray-100 text-gray-600'}`}>
                  {GOREV_KATEGORILERI[g.kategori] || g.kategori}
                </span>
              </div>
              {g.proje_no && (
                <p className="text-xs text-muted-foreground mt-0.5">{g.proje_no} ({g.proje_tipi})</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                Başlangıç: {formatTarih(g.baslangic_tarihi)}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (confirm('Bu görevi sonlandırmak istediğinize emin misiniz?')) {
                gorevSonlandir.mutate({ id: g.id })
              }
            }}
            className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
            title="Görevi sonlandır"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
