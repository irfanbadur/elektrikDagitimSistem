import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Edit,
  Trash2,
  ChevronRight,
  MapPin,
  Calendar,
  Users,
  FileText,
  Package,
  BarChart3,
  Clock,
  ChevronDown,
  StickyNote,
  GitBranch,
  Wrench,
} from 'lucide-react'
import { useProje, useProjeSil, useProjeDurumDegistir, useProjeDurumGecmisi } from '@/hooks/useProjeler'
import { useProjeAsamalari, useProjeFazlar } from '@/hooks/useDongu'
import { ProjeDurumBadge, OncelikBadge } from '@/components/shared/StatusBadge'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { CardSkeleton, TableSkeleton } from '@/components/shared/LoadingSkeleton'
import ProjeDurumTimeline from './ProjeDurumTimeline'
import ProjeDetayBirlesikDokumanlar from './ProjeDetayBirlesikDokumanlar'
import ProjeDetayNotlar from './ProjeDetayNotlar'
import ProjeDongu from './ProjeDongu'
import ProjeKesif from './ProjeKesif'
import ProjeHakEdis from './ProjeHakEdis'
import ProjeDemontaj from './ProjeDemontaj'
import { PROJE_DURUMLARI } from '@/utils/constants'
import { formatTarih, formatYuzde } from '@/utils/formatters'
import { cn } from '@/lib/utils'

const TABS = [
  { key: 'detay', label: 'Detay', icon: FileText },
  { key: 'dongu', label: 'Dongu', icon: GitBranch },
  { key: 'kesif', label: 'Kesif', icon: Package },
  { key: 'demontaj', label: 'Demontaj', icon: Wrench },
  { key: 'hak_edis', label: 'Hak Edis', icon: BarChart3 },
  { key: 'dokumanlar', label: 'Dokumanlar', icon: FileText },
  { key: 'raporlar', label: 'Raporlar', icon: BarChart3 },
  { key: 'gecmis', label: 'Gecmis', icon: Clock },
  { key: 'notlar', label: 'Notlar', icon: StickyNote },
]

export default function ProjeDetay() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: proje, isLoading } = useProje(id)
  const { data: durumGecmisi } = useProjeDurumGecmisi(id)
  const { data: projeAsamalari } = useProjeAsamalari(id)
  const { data: projeFazlar } = useProjeFazlar(id)
  const projeSil = useProjeSil()
  const durumDegistir = useProjeDurumDegistir()

  const [aktifTab, setAktifTab] = useState('dokumanlar')
  const [silmeDialogAcik, setSilmeDialogAcik] = useState(false)
  const [durumMenuAcik, setDurumMenuAcik] = useState(false)

  const handleSil = () => {
    projeSil.mutate(id, {
      onSuccess: () => navigate('/projeler'),
    })
  }

  const handleDurumDegistir = (yeniDurum) => {
    durumDegistir.mutate(
      { id, durum: yeniDurum },
      {
        onSettled: () => setDurumMenuAcik(false),
      }
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="skeleton h-4 w-16" />
          <ChevronRight className="h-4 w-4" />
          <div className="skeleton h-4 w-24" />
        </div>
        <CardSkeleton />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <TableSkeleton rows={4} cols={3} />
      </div>
    )
  }

  if (!proje) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg text-muted-foreground">Proje bulunamadi.</p>
        <button
          onClick={() => navigate('/projeler')}
          className="mt-4 text-sm text-primary hover:underline"
        >
          Proje listesine don
        </button>
      </div>
    )
  }

  const tamamlanma = proje.tamamlanma_yuzdesi || 0

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/projeler" className="hover:text-foreground">
          Projeler
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">{proje.proje_no}</span>
      </nav>

      {/* Header */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold">{proje.proje_no}</h1>
              <span className="rounded bg-gray-100 px-2.5 py-0.5 text-xs font-medium">
                {proje.proje_tipi}
              </span>
              <ProjeDurumBadge
                durum={proje.durum}
                asamaAdi={proje.aktif_asama_adi}
                asamaRenk={proje.aktif_asama_renk}
                asamaIkon={proje.aktif_asama_ikon}
                fazAdi={proje.aktif_faz_adi}
                adimAdi={proje.aktif_adim_adi}
                adimRenk={proje.aktif_adim_renk}
                adimIkon={proje.aktif_adim_ikon}
                sorumluRolAdi={proje.aktif_sorumlu_rol_adi}
              />
              <OncelikBadge oncelik={proje.oncelik} />
            </div>
            {proje.musteri_adi && (
              <p className="mt-2 text-lg text-muted-foreground">
                {proje.musteri_adi}
              </p>
            )}
            {/* Progress bar */}
            <div className="mt-4 flex items-center gap-3">
              <div className="h-2.5 w-48 rounded-full bg-gray-200">
                <div
                  className={cn(
                    'h-2.5 rounded-full transition-all',
                    tamamlanma >= 100
                      ? 'bg-emerald-500'
                      : tamamlanma >= 50
                        ? 'bg-primary'
                        : 'bg-amber-500'
                  )}
                  style={{ width: `${Math.min(tamamlanma, 100)}%` }}
                />
              </div>
              <span className="text-sm font-medium">{formatYuzde(tamamlanma)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/projeler/${id}/duzenle`)}
              className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Edit className="h-4 w-4" />
              Duzenle
            </button>

            {/* Durum Degistir dropdown */}
            <div className="relative">
              <button
                onClick={() => setDurumMenuAcik(!durumMenuAcik)}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                Durum Degistir
                <ChevronDown className="h-4 w-4" />
              </button>
              {durumMenuAcik && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setDurumMenuAcik(false)}
                  />
                  <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-border bg-white py-1 shadow-lg">
                    {projeFazlar && projeFazlar.length > 0
                      ? projeFazlar.map((faz) => (
                          <div key={faz.faz_kodu}>
                            <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase bg-muted/30">
                              {faz.ikon} {faz.faz_adi}
                            </div>
                            {faz.adimlar.map((a) => (
                              <button
                                key={a.id}
                                onClick={() => handleDurumDegistir(a.faz_kodu)}
                                disabled={a.faz_kodu === proje.durum}
                                className={cn(
                                  'flex w-full items-center gap-2 px-4 py-1.5 text-left text-sm hover:bg-muted',
                                  a.faz_kodu === proje.durum && 'bg-muted/50 text-muted-foreground opacity-50'
                                )}
                              >
                                <span className="text-xs text-muted-foreground">{a.adim_sira}.</span>
                                <span>{a.adim_adi}</span>
                              </button>
                            ))}
                          </div>
                        ))
                      : projeAsamalari && projeAsamalari.length > 0
                      ? projeAsamalari.map((a) => (
                          <button
                            key={a.asama_kodu}
                            onClick={() => handleDurumDegistir(a.asama_kodu)}
                            disabled={a.asama_kodu === proje.durum}
                            className={cn(
                              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted',
                              a.asama_kodu === proje.durum && 'bg-muted/50 text-muted-foreground opacity-50'
                            )}
                          >
                            <span>{a.ikon}</span>
                            <span>{a.asama_adi}</span>
                          </button>
                        ))
                      : Object.entries(PROJE_DURUMLARI).map(([key, val]) => (
                          <button
                            key={key}
                            onClick={() => handleDurumDegistir(key)}
                            disabled={key === proje.durum}
                            className={cn(
                              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted',
                              key === proje.durum && 'bg-muted/50 text-muted-foreground opacity-50'
                            )}
                          >
                            <span>{val.emoji}</span>
                            <span>{val.label}</span>
                          </button>
                        ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setSilmeDialogAcik(true)}
              className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Sil
            </button>
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            Proje Tipi
          </div>
          <p className="mt-1 font-medium">{proje.proje_tipi || '-'}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            Bolge
          </div>
          <p className="mt-1 font-medium">{proje.bolge_adi || '-'}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            Ekip
          </div>
          <p className="mt-1 font-medium">{proje.ekip_adi || '-'}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Tahmini Sure
          </div>
          <p className="mt-1 font-medium">
            {proje.tahmini_sure_gun ? `${proje.tahmini_sure_gun} gun` : '-'}
          </p>
        </div>
      </div>

      {/* Date row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Baslama Tarihi</p>
          <p className="mt-1 font-medium">{formatTarih(proje.baslama_tarihi)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Bitis Tarihi</p>
          <p className="mt-1 font-medium">{formatTarih(proje.bitis_tarihi)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Teslim Tarihi</p>
          <p className="mt-1 font-medium">{formatTarih(proje.teslim_tarihi)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setAktifTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                  aktifTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {aktifTab === 'detay' && (
          <div className="space-y-6">
            {/* Address Info */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="mb-4 font-semibold">Adres Bilgileri</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Mahalle</p>
                  <p className="mt-0.5 font-medium">{proje.mahalle || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Adres</p>
                  <p className="mt-0.5 font-medium">{proje.adres || '-'}</p>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="mb-4 font-semibold">Notlar</h3>
              {proje.notlar ? (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {proje.notlar}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Henuz not eklenmemis.
                </p>
              )}
            </div>
          </div>
        )}

        {aktifTab === 'dongu' && (
          <ProjeDongu projeId={id} projeTipi={proje?.proje_tipi} projeNo={proje?.proje_no} />
        )}

        {aktifTab === 'raporlar' && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="mb-4 font-semibold">Raporlar</h3>
            {proje.raporlar && proje.raporlar.length > 0 ? (
              <div className="space-y-3">
                {proje.raporlar.map((rapor, i) => (
                  <div
                    key={rapor.id || i}
                    className="flex items-start justify-between rounded-md border border-border p-3"
                  >
                    <div>
                      <p className="font-medium">{rapor.baslik || `Rapor #${i + 1}`}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTarih(rapor.tarih)} &mdash; {rapor.olusturan || '-'}
                      </p>
                    </div>
                    {rapor.dosya_url && (
                      <a
                        href={rapor.dosya_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Goruntule
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Bu projeye ait rapor bulunamadi.
              </p>
            )}
          </div>
        )}

        {aktifTab === 'gecmis' && (
          <ProjeDurumTimeline gecmis={durumGecmisi} />
        )}

        {aktifTab === 'kesif' && (
          <ProjeKesif projeId={id} />
        )}

        {aktifTab === 'demontaj' && (
          <ProjeDemontaj projeId={id} />
        )}

        {aktifTab === 'hak_edis' && (
          <ProjeHakEdis projeId={id} />
        )}

        {aktifTab === 'dokumanlar' && (
          <ProjeDetayBirlesikDokumanlar projeId={id} />
        )}

        {aktifTab === 'notlar' && (
          <ProjeDetayNotlar projeId={id} />
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={silmeDialogAcik}
        onClose={() => setSilmeDialogAcik(false)}
        onConfirm={handleSil}
        title="Projeyi Sil"
        message={`"${proje.proje_no}" numarali projeyi silmek istediginize emin misiniz? Bu islem geri alinamaz ve projeye ait tum veriler silinecektir.`}
        confirmText="Sil"
        cancelText="Iptal"
        variant="destructive"
      />
    </div>
  )
}
