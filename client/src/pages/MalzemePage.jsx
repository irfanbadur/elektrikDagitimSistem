import { useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import {
  Warehouse,
  HardHat,
  ArrowRightLeft,
  Plus,
  Package,
  Sparkles,
} from 'lucide-react'
import MainLayout from '@/components/layout/MainLayout'
import DepoStok from '@/components/malzeme/DepoStok'
import DepoForm from '@/components/malzeme/DepoForm'
import TransferModal from '@/components/malzeme/TransferModal'
import MalzemeHareketleri from '@/components/malzeme/MalzemeHareketleri'
import MalzemeForm from '@/components/malzeme/MalzemeForm'
import StokListesi from '@/components/malzeme/StokListesi'
import BonoParseModal from '@/components/malzeme/BonoParseModal'
import { useDepolar } from '@/hooks/useDepolar'
import { cn } from '@/lib/utils'

const DEPO_TIP_IKON = {
  ana_depo: Warehouse,
  taseron: HardHat,
  saha_depo: Package,
}

function MalzemeTabView() {
  const { data: depolar, isLoading } = useDepolar()
  const [aktifTab, setAktifTab] = useState(null)
  const [depoFormAcik, setDepoFormAcik] = useState(false)
  const [transferBilgi, setTransferBilgi] = useState(null)
  const [bonoModalAcik, setBonoModalAcik] = useState(false)
  const navigate = useNavigate()

  // ilk yüklemede ilk depoyu seç
  const aktifDepoId = aktifTab === 'hareketler'
    ? null
    : aktifTab ?? depolar?.[0]?.id ?? null

  const aktifDepo = depolar?.find((d) => d.id === aktifDepoId)

  const sekmeler = [
    ...(depolar || []).map((d) => ({
      id: d.id,
      label: d.depo_adi,
      tip: d.depo_tipi,
    })),
    { id: 'hareketler', label: 'Hareketler', tip: 'hareketler' },
  ]

  return (
    <div>
      {/* Baslik */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Malzeme Yonetimi</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Depo ve taseron bazli stok takibi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDepoFormAcik(true)}
            className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <Plus className="h-4 w-4" />
            Taseron/Depo Ekle
          </button>
          <button
            onClick={() => setBonoModalAcik(true)}
            className="flex items-center gap-2 rounded-md border border-primary bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20"
          >
            <Sparkles className="h-4 w-4" />
            Bono Ekle
          </button>
          <button
            onClick={() => navigate('/malzeme/yeni')}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Yeni Malzeme
          </button>
        </div>
      </div>

      {/* Depo Formu */}
      {depoFormAcik && (
        <DepoForm onKapat={() => setDepoFormAcik(false)} />
      )}

      {/* Tab Bar */}
      {isLoading ? (
        <div className="mb-6 flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-10 w-32 rounded" />
          ))}
        </div>
      ) : (
        <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
          {sekmeler.map((s) => {
            const aktif =
              aktifTab === 'hareketler'
                ? s.id === 'hareketler'
                : s.id === (aktifTab ?? depolar?.[0]?.id)
            const Icon =
              s.tip === 'hareketler'
                ? ArrowRightLeft
                : DEPO_TIP_IKON[s.tip] || Package
            return (
              <button
                key={s.id}
                onClick={() => setAktifTab(s.id)}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors',
                  aktif
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {s.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Tab Icerik */}
      {aktifTab === 'hareketler' ? (
        <MalzemeHareketleri />
      ) : aktifDepo ? (
        <DepoStok
          key={aktifDepo.id}
          depoId={aktifDepo.id}
          depoAdi={aktifDepo.depo_adi}
          onTransfer={(malzeme) =>
            setTransferBilgi({ ...malzeme, kaynakDepoId: aktifDepo.id })
          }
        />
      ) : !isLoading ? (
        <div className="rounded-lg border border-input bg-card p-12 text-center">
          <Warehouse className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">Henuz depo bulunmuyor</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            &quot;Taseron/Depo Ekle&quot; butonuyla ilk deponuzu olusturun.
          </p>
        </div>
      ) : null}

      {/* Transfer Modal */}
      {transferBilgi && (
        <TransferModal
          depolar={depolar}
          kaynakDepoId={transferBilgi.kaynakDepoId}
          malzeme={transferBilgi}
          onKapat={() => setTransferBilgi(null)}
        />
      )}

      {/* Bono Parse Modal */}
      {bonoModalAcik && (
        <BonoParseModal
          onKapat={() => setBonoModalAcik(false)}
          onBasarili={() => setBonoModalAcik(false)}
        />
      )}
    </div>
  )
}

export default function MalzemePage() {
  return (
    <MainLayout title="Malzeme">
      <Routes>
        <Route index element={<MalzemeTabView />} />
        <Route path="yeni" element={<MalzemeForm />} />
        <Route path="hareketler" element={<MalzemeHareketleri />} />
        <Route path="genel" element={<StokListesi />} />
        <Route path=":id" element={<StokListesi />} />
        <Route path=":id/duzenle" element={<MalzemeForm />} />
      </Routes>
    </MainLayout>
  )
}
