import { Star } from 'lucide-react'
import { useKisininYetkinlikleri } from '@/hooks/useOrganizasyon'
import { YETKINLIK_SEVIYELERI } from '@/utils/constants'

const SEVIYE_PUAN = { baslangic: 1, orta: 2, ileri: 3, uzman: 4 }

function YildizRating({ seviye }) {
  const puan = SEVIYE_PUAN[seviye] || 0
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= puan ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`}
        />
      ))}
      <span className="ml-1.5 text-xs text-muted-foreground">
        {YETKINLIK_SEVIYELERI[seviye]?.label || seviye}
      </span>
    </div>
  )
}

export default function KisiYetkinlikListesi({ kullaniciId }) {
  const { data: yetkinlikler, isLoading } = useKisininYetkinlikleri(kullaniciId)

  if (isLoading) return <div className="animate-pulse h-20 bg-gray-100 rounded" />

  const liste = yetkinlikler || []

  if (liste.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-muted-foreground">
        Henüz kayıtlı yetkinlik yok.
      </div>
    )
  }

  // Kategorilere göre grupla
  const gruplu = {}
  for (const y of liste) {
    const kat = y.kategori || 'diger'
    if (!gruplu[kat]) gruplu[kat] = []
    gruplu[kat].push(y)
  }

  const KATEGORI_LABEL = { teknik: 'Teknik', idari: 'İdari', yazilim: 'Yazılım', diger: 'Diğer' }

  return (
    <div className="space-y-4">
      {Object.entries(gruplu).map(([kat, liste]) => (
        <div key={kat}>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {KATEGORI_LABEL[kat] || kat}
          </h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {liste.map((y) => (
              <div key={y.id} className="flex items-center justify-between rounded-lg border border-border bg-white p-2.5">
                <span className="text-sm font-medium">{y.yetkinlik_adi}</span>
                <YildizRating seviye={y.seviye} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
