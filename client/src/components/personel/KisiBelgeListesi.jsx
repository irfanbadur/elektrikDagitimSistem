import { FileText, Trash2 } from 'lucide-react'
import { useKisininBelgeleri, useBelgeSil } from '@/hooks/useOrganizasyon'
import { BELGE_DURUM_RENKLERI, BELGE_KATEGORILERI } from '@/utils/constants'
import { formatTarih } from '@/utils/formatters'

const DURUM_LABEL = {
  gecerli: 'Geçerli',
  suresiz: 'Süresiz',
  yakinda_dolacak: 'Yakında Dolacak',
  suresi_dolmus: 'Süresi Dolmuş',
}

export default function KisiBelgeListesi({ kullaniciId }) {
  const { data: belgeler, isLoading } = useKisininBelgeleri(kullaniciId)
  const belgeSil = useBelgeSil()

  if (isLoading) return <div className="animate-pulse h-20 bg-gray-100 rounded" />

  const liste = belgeler || []

  if (liste.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-muted-foreground">
        Henüz kayıtlı belge yok.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {liste.map((b) => (
        <div key={b.id} className="flex items-start justify-between rounded-lg border border-border bg-white p-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50">
              <FileText className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{b.belge_adi}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${BELGE_DURUM_RENKLERI[b.belge_durum] || 'bg-gray-100 text-gray-600'}`}>
                  {DURUM_LABEL[b.belge_durum] || b.belge_durum}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {BELGE_KATEGORILERI[b.kategori] || b.kategori}
                {b.belge_no && ` - No: ${b.belge_no}`}
              </p>
              {b.bitis_tarihi && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Bitiş: {formatTarih(b.bitis_tarihi)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              if (confirm('Bu belgeyi silmek istediğinize emin misiniz?')) {
                belgeSil.mutate(b.id)
              }
            }}
            className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
            title="Belgeyi sil"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
