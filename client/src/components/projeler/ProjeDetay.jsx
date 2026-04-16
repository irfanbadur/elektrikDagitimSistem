import { useState, Component } from 'react'
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
import ProjeDetayNotlar from './ProjeDetayNotlar'
import ProjeDongu from './ProjeDongu'
import ProjeKesif from './ProjeKesif'
import ProjeHakEdis from './ProjeHakEdis'
import ProjeDemontaj from './ProjeDemontaj'
import ProjeDonguBar from './ProjeDonguBar'
import { PROJE_DURUMLARI } from '@/utils/constants'
import { formatTarih, formatYuzde } from '@/utils/formatters'
import { cn } from '@/lib/utils'

class TabErrorBoundary extends Component {
  state = { hasError: false, error: null }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidUpdate(prevProps) {
    if (prevProps.tabKey !== this.props.tabKey) this.setState({ hasError: false, error: null })
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-700">Bu sekme yuklenirken bir hata olustu.</p>
          <p className="mt-1 text-xs text-red-500">{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })} className="mt-3 rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700">Tekrar Dene</button>
        </div>
      )
    }
    return this.props.children
  }
}

const TABS = [
  { key: 'detay', label: 'Detay', icon: FileText },
{ key: 'kesif', label: 'Proje-Kesif', icon: Package },
  { key: 'demontaj', label: 'Demontaj', icon: Wrench },
  { key: 'hak_edis', label: 'Hak Edis', icon: BarChart3 },
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

  const [aktifTab, setAktifTab] = useState('detay')
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
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 w-36 rounded-full bg-gray-200">
                <div
                  className={cn(
                    'h-2 rounded-full transition-all',
                    tamamlanma >= 100
                      ? 'bg-emerald-500'
                      : tamamlanma >= 50
                        ? 'bg-primary'
                        : 'bg-amber-500'
                  )}
                  style={{ width: `${Math.min(tamamlanma, 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium">{formatYuzde(tamamlanma)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/projeler/${id}/duzenle`)}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <Edit className="h-3.5 w-3.5" />
              Duzenle
            </button>

            {/* Durum Degistir dropdown */}
            <div className="relative">
              <button
                onClick={() => setDurumMenuAcik(!durumMenuAcik)}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
              >
                Durum Degistir
                <ChevronDown className="h-3.5 w-3.5" />
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
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Sil
            </button>
          </div>
        </div>

        {/* Bilgi satırı — Proje Tipi, Bölge, Ekip, Tahmini Süre, Tarihler */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border pt-3 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <FileText className="h-3.5 w-3.5" /> <span className="font-medium text-foreground">{proje.proje_tipi || '-'}</span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> <span className="font-medium text-foreground">{proje.bolge_adi || '-'}</span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> <span className="font-medium text-foreground">{proje.ekip_adi || '-'}</span>
          </span>
          {proje.tahmini_sure_gun && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> <span className="font-medium text-foreground">{proje.tahmini_sure_gun} gun</span>
            </span>
          )}
          <span className="text-muted-foreground/30">|</span>
          <span className="text-muted-foreground">Baslama: <span className="font-medium text-foreground">{formatTarih(proje.baslama_tarihi)}</span></span>
          <span className="text-muted-foreground">Bitis: <span className="font-medium text-foreground">{formatTarih(proje.bitis_tarihi)}</span></span>
          <span className="text-muted-foreground">Teslim: <span className="font-medium text-foreground">{formatTarih(proje.teslim_tarihi)}</span></span>
        </div>
      </div>

      {/* Yatay Dongu Bar */}
      <ProjeDonguBar projeId={id} />

      {/* Tabs */}
      <div className="border-b border-border overflow-x-auto">
        <div className="flex gap-3 min-w-max">
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
      <TabErrorBoundary tabKey={aktifTab}>
      <div>
        {aktifTab === 'detay' && (
          <div className="space-y-6">
            {/* Address Info */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="mb-4 font-semibold">Adres Bilgileri</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(proje.il || proje.ilce) && (
                  <div>
                    <p className="text-sm text-muted-foreground">Il / Ilce</p>
                    <p className="mt-0.5 font-medium">{[proje.il, proje.ilce].filter(Boolean).join(' / ') || '-'}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Mahalle</p>
                  <p className="mt-0.5 font-medium">{proje.mahalle || '-'}</p>
                </div>
                {proje.ada_parsel && (
                  <div>
                    <p className="text-sm text-muted-foreground">Ada / Parsel</p>
                    <p className="mt-0.5 font-medium">{proje.ada_parsel}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Adres</p>
                  <p className="mt-0.5 font-medium">{proje.adres || '-'}</p>
                </div>
              </div>
            </div>

            {/* Baglanti / Tesis Bilgileri */}
            {(proje.basvuru_no || proje.telefon || proje.tesis || proje.abone_kablosu || proje.enerji_alinan_direk_no || proje.kesinti_ihtiyaci != null || proje.izinler) && (
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="mb-4 font-semibold">Baglanti / Tesis Bilgileri</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {proje.basvuru_no && (
                    <div>
                      <p className="text-sm text-muted-foreground">Basvuru No</p>
                      <p className="mt-0.5 font-medium">{proje.basvuru_no}</p>
                    </div>
                  )}
                  {proje.telefon && (
                    <div>
                      <p className="text-sm text-muted-foreground">Telefon</p>
                      <p className="mt-0.5 font-medium">{proje.telefon}</p>
                    </div>
                  )}
                  {proje.tesis && (
                    <div>
                      <p className="text-sm text-muted-foreground">Tesis</p>
                      <p className="mt-0.5 font-medium">{proje.tesis}</p>
                    </div>
                  )}
                  {proje.enerji_alinan_direk_no && (
                    <div>
                      <p className="text-sm text-muted-foreground">Enerji Alinan Direk No</p>
                      <p className="mt-0.5 font-medium">{proje.enerji_alinan_direk_no}</p>
                    </div>
                  )}
                  {proje.abone_kablosu && (
                    <div>
                      <p className="text-sm text-muted-foreground">Abone Kablosu</p>
                      <p className="mt-0.5 font-medium">{proje.abone_kablosu}{proje.abone_kablosu_metre ? ` - ${proje.abone_kablosu_metre} m` : ''}</p>
                    </div>
                  )}
                  {proje.kesinti_ihtiyaci != null && (
                    <div>
                      <p className="text-sm text-muted-foreground">Kesinti Ihtiyaci</p>
                      <p className="mt-0.5 font-medium">{proje.kesinti_ihtiyaci ? 'Evet' : 'Hayir'}</p>
                    </div>
                  )}
                </div>
                {(() => {
                  const izinler = proje.izinler ? (typeof proje.izinler === 'string' ? JSON.parse(proje.izinler) : proje.izinler) : null
                  if (!izinler) return null
                  const aktifIzinler = []
                  if (izinler.karayollari) aktifIzinler.push('Karayollari')
                  if (izinler.kazi_izni) aktifIzinler.push('Kazi Izni')
                  if (izinler.orman) aktifIzinler.push('Orman')
                  if (izinler.muvafakatname) aktifIzinler.push('Muvafakatname')
                  if (izinler.diger) aktifIzinler.push(izinler.diger)
                  if (aktifIzinler.length === 0) return null
                  return (
                    <div className="mt-4">
                      <p className="mb-2 text-sm text-muted-foreground">Izinler</p>
                      <div className="flex flex-wrap gap-2">
                        {aktifIzinler.map((izin, i) => (
                          <span key={i} className="rounded bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">{izin}</span>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

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

        {aktifTab === 'notlar' && (
          <ProjeDetayNotlar projeId={id} />
        )}
      </div>
      </TabErrorBoundary>

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
