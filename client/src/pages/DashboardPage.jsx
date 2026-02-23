import MainLayout from '@/components/layout/MainLayout'
import OzetKartlar from '@/components/dashboard/OzetKartlar'
import EkipDurumlari from '@/components/dashboard/EkipDurumlari'
import SonAktiviteler from '@/components/dashboard/SonAktiviteler'
import BolgeDagilimi from '@/components/dashboard/BolgeDagilimi'
import AcikTalepler from '@/components/dashboard/AcikTalepler'
import BelgeUyariKarti from '@/components/dashboard/BelgeUyariKarti'
import { useDashboardOzet, useDashboardAktiviteler, useEkipDurumlari } from '@/hooks/useDashboard'
import { useBekleyenTalepler } from '@/hooks/useTalepler'
import { useKritikMalzemeler } from '@/hooks/useMalzeme'
import { useProjeler } from '@/hooks/useProjeler'

export default function DashboardPage() {
  const { data: ozet, isLoading: ozetLoading } = useDashboardOzet()
  const { data: aktiviteler } = useDashboardAktiviteler(20)
  const { data: ekipDurumlari } = useEkipDurumlari()
  const { data: bekleyenTalepler } = useBekleyenTalepler()
  const { data: kritikStoklar } = useKritikMalzemeler()
  const { data: projeler } = useProjeler()

  return (
    <MainLayout title="Dashboard">
      <div className="space-y-8">
        {ozetLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({length: 5}).map((_, i) => <div key={i} className="skeleton h-24 rounded-lg" />)}
          </div>
        ) : (
          <OzetKartlar data={ozet} />
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          <EkipDurumlari data={ekipDurumlari} />
          <SonAktiviteler data={aktiviteler} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <BolgeDagilimi projeler={projeler} />
          <AcikTalepler talepler={bekleyenTalepler} kritikStoklar={kritikStoklar} />
        </div>
        <BelgeUyariKarti />
      </div>
    </MainLayout>
  )
}
