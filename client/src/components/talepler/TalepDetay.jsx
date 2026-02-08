import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Edit, CheckCircle, XCircle, Clock, UserCheck } from 'lucide-react'
import { useTalep, useTalepDurumDegistir } from '@/hooks/useTalepler'
import { TalepDurumBadge, OncelikBadge } from '@/components/shared/StatusBadge'
import { TALEP_TIPLERI, TALEP_DURUMLARI } from '@/utils/constants'
import { formatTarih } from '@/utils/formatters'
import ConfirmDialog from '@/components/shared/ConfirmDialog'

const durumGecisleri = [
  { durum: 'inceleniyor', etiket: 'İncelemeye Al', icon: Clock, renk: 'bg-blue-600 hover:bg-blue-700' },
  { durum: 'atandi', etiket: 'Ata', icon: UserCheck, renk: 'bg-purple-600 hover:bg-purple-700' },
  { durum: 'tamamlandi', etiket: 'Tamamla', icon: CheckCircle, renk: 'bg-green-600 hover:bg-green-700' },
  { durum: 'reddedildi', etiket: 'Reddet', icon: XCircle, renk: 'bg-red-600 hover:bg-red-700' },
]

function DetayAlani({ etiket, deger }) {
  if (!deger && deger !== 0) return null
  return (
    <div className="py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{etiket}</p>
      <p className="mt-1 text-sm">{deger}</p>
    </div>
  )
}

export default function TalepDetay() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { data: talep, isLoading } = useTalep(id)
  const durumDegistir = useTalepDurumDegistir()
  const [onayDialog, setOnayDialog] = useState({ acik: false, durum: '', etiket: '' })

  const handleDurumDegistir = async () => {
    try {
      await durumDegistir.mutateAsync({ id, durum: onayDialog.durum })
      setOnayDialog({ acik: false, durum: '', etiket: '' })
    } catch {
      // Hata hook tarafından yönetilir
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-64 w-full" />
      </div>
    )
  }

  if (!talep) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg font-medium text-muted-foreground">Talep bulunamadı</p>
        <button onClick={() => navigate('/talepler')} className="mt-4 text-sm text-primary hover:underline">
          Listeye dön
        </button>
      </div>
    )
  }

  const uygunGecisler = durumGecisleri.filter(g => g.durum !== talep.durum)

  return (
    <div>
      {/* Başlık */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/talepler')} className="rounded p-1.5 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Talep #{talep.talep_no}</h1>
              <TalepDurumBadge durum={talep.durum} />
            </div>
            <p className="text-sm text-muted-foreground">
              {TALEP_TIPLERI[talep.talep_tipi] || talep.talep_tipi} - {formatTarih(talep.olusturma_tarihi)}
            </p>
          </div>
        </div>
        <button onClick={() => navigate(`/talepler/${id}/duzenle`)} className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
          <Edit className="h-4 w-4" /> Düzenle
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sol: Detay Bilgileri */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Talep Bilgileri</h2>
            <div className="divide-y divide-border">
              <DetayAlani etiket="Talep No" deger={talep.talep_no} />
              <DetayAlani etiket="Talep Tipi" deger={TALEP_TIPLERI[talep.talep_tipi] || talep.talep_tipi} />
              <DetayAlani etiket="Ekip" deger={talep.ekip_adi} />
              <DetayAlani etiket="Proje" deger={talep.proje_no ? `${talep.proje_no} - ${talep.proje_adi || ''}` : null} />
              <DetayAlani etiket="Talep Eden" deger={talep.talep_eden} />
              <DetayAlani etiket="Oluşturma Tarihi" deger={formatTarih(talep.olusturma_tarihi)} />
            </div>
          </div>

          {/* Açıklama */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Açıklama</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{talep.aciklama}</p>
          </div>

          {/* Detay */}
          {talep.talep_detay && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold">Detay</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{talep.talep_detay}</p>
            </div>
          )}

          {/* Çözüm */}
          {talep.cozum_aciklama && (
            <div className="rounded-lg border border-green-300 bg-green-50 p-6">
              <h2 className="mb-4 text-lg font-semibold text-green-800">Çözüm</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-green-700">{talep.cozum_aciklama}</p>
            </div>
          )}
        </div>

        {/* Sağ: Durum ve İşlemler */}
        <div className="space-y-6">
          {/* Öncelik ve Durum */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Durum Bilgisi</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Öncelik</p>
                <div className="mt-1"><OncelikBadge oncelik={talep.oncelik} /></div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Durum</p>
                <div className="mt-1"><TalepDurumBadge durum={talep.durum} /></div>
              </div>
              {talep.atanan_kisi && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Atanan Kişi</p>
                  <p className="mt-1 text-sm">{talep.atanan_kisi}</p>
                </div>
              )}
            </div>
          </div>

          {/* Durum Geçiş Butonları */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Durum Değiştir</h2>
            <div className="space-y-2">
              {uygunGecisler.map(gecis => {
                const Icon = gecis.icon
                return (
                  <button
                    key={gecis.durum}
                    onClick={() => setOnayDialog({ acik: true, durum: gecis.durum, etiket: gecis.etiket })}
                    disabled={durumDegistir.isPending}
                    className={`flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${gecis.renk}`}
                  >
                    <Icon className="h-4 w-4" /> {gecis.etiket}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={onayDialog.acik}
        onClose={() => setOnayDialog({ acik: false, durum: '', etiket: '' })}
        onConfirm={handleDurumDegistir}
        title="Durum Değişikliği"
        message={`Bu talebin durumunu "${TALEP_DURUMLARI[onayDialog.durum] || onayDialog.etiket}" olarak değiştirmek istediğinize emin misiniz?`}
        confirmText="Değiştir"
        loading={durumDegistir.isPending}
      />
    </div>
  )
}
