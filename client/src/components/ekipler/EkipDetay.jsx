import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Users,
  MapPin,
  Car,
  UserCheck,
  FolderOpen,
} from 'lucide-react'
import { useEkip, useEkipSil, useEkipProjeleri } from '@/hooks/useEkipler'
import { EkipDurumBadge } from '@/components/shared/StatusBadge'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { GOREV_TIPLERI } from '@/utils/constants'
import { formatTarih } from '@/utils/formatters'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'

export default function EkipDetay() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: ekip, isLoading, error } = useEkip(id)
  const { data: projeler } = useEkipProjeleri(id)
  const ekipSil = useEkipSil()

  const [silmeDialogAcik, setSilmeDialogAcik] = useState(false)

  const handleSil = () => {
    ekipSil.mutate(id, {
      onSuccess: () => navigate('/ekipler'),
    })
  }

  if (isLoading) return <PageSkeleton />

  if (error || !ekip) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-lg text-muted-foreground">Ekip bulunamadi.</p>
        <button
          onClick={() => navigate('/ekipler')}
          className="mt-4 text-sm text-primary hover:underline"
        >
          Ekip listesine don
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/ekipler')}
            className="mt-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{ekip.ekip_adi}</h1>
              <EkipDurumBadge durum={ekip.durum} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Ekip Kodu: {ekip.ekip_kodu}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/ekipler/${id}/duzenle`)}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Pencil className="h-4 w-4" />
            Duzenle
          </button>
          <button
            onClick={() => setSilmeDialogAcik(true)}
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4" />
            Sil
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <UserCheck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ekip Basi</p>
              <p className="font-semibold">{ekip.ekip_basi_adi || '-'}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <MapPin className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Bolge</p>
              <p className="font-semibold">{ekip.bolge_adi || '-'}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
              <Car className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Arac Plaka</p>
              <p className="font-semibold">{ekip.arac_plaka || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notlar */}
      {ekip.notlar && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Notlar</h3>
          <p className="text-sm whitespace-pre-wrap">{ekip.notlar}</p>
        </div>
      )}

      {/* Personel Listesi */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Personel Listesi</h2>
          <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {ekip.personeller?.length || 0} kisi
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">Ad Soyad</th>
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">Gorev</th>
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">Telefon</th>
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">Durum</th>
              </tr>
            </thead>
            <tbody>
              {ekip.personeller && ekip.personeller.length > 0 ? (
                ekip.personeller.map((personel) => (
                  <tr
                    key={personel.personel_id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate(`/personel/${personel.personel_id}`)}
                  >
                    <td className="px-5 py-3 font-medium">{personel.ad_soyad}</td>
                    <td className="px-5 py-3">
                      {GOREV_TIPLERI[personel.gorev] || personel.gorev || '-'}
                    </td>
                    <td className="px-5 py-3">{personel.telefon || '-'}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          personel.aktif !== false
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {personel.aktif !== false ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                    Bu ekipte henuz personel bulunmuyor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Aktif Projeler */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <FolderOpen className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Aktif Projeler</h2>
          <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {projeler?.length || 0} proje
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">Proje Adi</th>
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">Durum</th>
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">Baslangic</th>
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">Bitis</th>
              </tr>
            </thead>
            <tbody>
              {projeler && projeler.length > 0 ? (
                projeler.map((proje) => (
                  <tr
                    key={proje.proje_id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate(`/projeler/${proje.proje_id}`)}
                  >
                    <td className="px-5 py-3 font-medium">{proje.proje_adi}</td>
                    <td className="px-5 py-3">{proje.durum || '-'}</td>
                    <td className="px-5 py-3">{formatTarih(proje.baslangic_tarihi)}</td>
                    <td className="px-5 py-3">{formatTarih(proje.bitis_tarihi)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                    Bu ekibe atanmis aktif proje bulunmuyor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={silmeDialogAcik}
        onClose={() => setSilmeDialogAcik(false)}
        onConfirm={handleSil}
        title="Ekibi Sil"
        message={`"${ekip.ekip_adi}" ekibini silmek istediginize emin misiniz? Bu islem geri alinamaz.`}
        confirmText="Sil"
        cancelText="Iptal"
        variant="destructive"
      />
    </div>
  )
}
