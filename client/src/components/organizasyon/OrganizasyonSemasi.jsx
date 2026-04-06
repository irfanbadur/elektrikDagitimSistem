import { useState } from 'react'
import { Search, Users, AlertCircle } from 'lucide-react'
import { useOrganizasyonAgaci } from '@/hooks/useOrganizasyon'
import OrgDugum from './OrgDugum'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'

export default function OrganizasyonSemasi() {
  const { data: agac, isLoading, error } = useOrganizasyonAgaci()
  const [aramaMetni, setAramaMetni] = useState('')

  if (isLoading) return <PageSkeleton />
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p>Organizasyon ağacı yüklenemedi.</p>
      </div>
    )
  }

  const kokDugumler = agac || []

  // Basit arama filtresi — eşleşen düğümleri recursive bul
  const filtrele = (dugumler, metin) => {
    if (!metin) return dugumler
    const kucukMetin = metin.toLowerCase()

    const eslesiyor = (dugum) => {
      const kendisiEslesiyor =
        dugum.ad_soyad?.toLowerCase().includes(kucukMetin) ||
        dugum.pozisyon_adi?.toLowerCase().includes(kucukMetin)
      const altlarEslesiyor = dugum.altlar?.some(eslesiyor) || false
      return kendisiEslesiyor || altlarEslesiyor
    }

    const filtreli = (dugumler) =>
      dugumler
        .filter(eslesiyor)
        .map((d) => ({ ...d, altlar: filtreli(d.altlar || []) }))

    return filtreli(dugumler)
  }

  const gosterilecek = filtrele(kokDugumler, aramaMetni)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Organizasyon Şeması</h2>
        </div>
        <div className="relative w-64">
          <input
            type="text"
            placeholder="İsim veya pozisyon ara..."
            value={aramaMetni}
            onChange={(e) => setAramaMetni(e.target.value)}
            className="w-full rounded-md border border-border bg-background pl-3 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {gosterilecek.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-muted-foreground">
          {aramaMetni
            ? 'Aramayla eşleşen personel bulunamadı.'
            : 'Henüz organizasyon ağacı oluşturulmamış. Kullanıcılara pozisyon ve üst yönetici atayarak ağacı oluşturabilirsiniz.'}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-4">
          {gosterilecek.map((dugum) => (
            <OrgDugum key={dugum.id} dugum={dugum} />
          ))}
        </div>
      )}
    </div>
  )
}
