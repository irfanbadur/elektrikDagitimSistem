import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Phone,
  Send,
  Briefcase,
  Users,
  User,
} from 'lucide-react'
import { usePersonelDetay, usePersonelSil } from '@/hooks/usePersonel'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { GOREV_TIPLERI } from '@/utils/constants'
import { formatTarih } from '@/utils/formatters'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'

export default function PersonelDetay() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: personel, isLoading, error } = usePersonelDetay(id)
  const personelSil = usePersonelSil()

  const [silmeDialogAcik, setSilmeDialogAcik] = useState(false)

  const handleSil = () => {
    personelSil.mutate(id, {
      onSuccess: () => navigate('/personel'),
    })
  }

  if (isLoading) return <PageSkeleton />

  if (error || !personel) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-lg text-muted-foreground">Personel bulunamadi.</p>
        <button
          onClick={() => navigate('/personel')}
          className="mt-4 text-sm text-primary hover:underline"
        >
          Personel listesine don
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
            onClick={() => navigate('/personel')}
            className="mt-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{personel.ad_soyad}</h1>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  personel.aktif !== false
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {personel.aktif !== false ? 'Aktif' : 'Pasif'}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {GOREV_TIPLERI[personel.gorev] || personel.gorev || 'Gorev belirtilmemis'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/personel/${id}/duzenle`)}
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Phone className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Telefon</p>
              <p className="font-semibold">{personel.telefon || '-'}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50">
              <Send className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Telegram</p>
              <p className="font-semibold">
                {personel.telegram_kullanici_adi
                  ? `@${personel.telegram_kullanici_adi}`
                  : '-'}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
              <Briefcase className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Gorev</p>
              <p className="font-semibold">
                {GOREV_TIPLERI[personel.gorev] || personel.gorev || '-'}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ekip</p>
              <p className="font-semibold">{personel.ekip_adi || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detay Bilgileri */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <User className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Detay Bilgileri</h2>
        </div>
        <div className="divide-y divide-border">
          <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3">
            <span className="text-sm text-muted-foreground">Ad Soyad</span>
            <span className="sm:col-span-2 text-sm font-medium">{personel.ad_soyad}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3">
            <span className="text-sm text-muted-foreground">Telefon</span>
            <span className="sm:col-span-2 text-sm font-medium">{personel.telefon || '-'}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3">
            <span className="text-sm text-muted-foreground">Telegram ID</span>
            <span className="sm:col-span-2 text-sm font-medium">{personel.telegram_id || '-'}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3">
            <span className="text-sm text-muted-foreground">Telegram Kullanici Adi</span>
            <span className="sm:col-span-2 text-sm font-medium">
              {personel.telegram_kullanici_adi ? `@${personel.telegram_kullanici_adi}` : '-'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3">
            <span className="text-sm text-muted-foreground">Gorev</span>
            <span className="sm:col-span-2 text-sm font-medium">
              {GOREV_TIPLERI[personel.gorev] || personel.gorev || '-'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3">
            <span className="text-sm text-muted-foreground">Ekip</span>
            <span className="sm:col-span-2 text-sm font-medium">
              {personel.ekip_adi ? (
                <button
                  onClick={() => navigate(`/ekipler/${personel.ekip_id}`)}
                  className="text-primary hover:underline"
                >
                  {personel.ekip_adi}
                </button>
              ) : (
                '-'
              )}
            </span>
          </div>
          {personel.olusturma_tarihi && (
            <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3">
              <span className="text-sm text-muted-foreground">Kayit Tarihi</span>
              <span className="sm:col-span-2 text-sm font-medium">
                {formatTarih(personel.olusturma_tarihi)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Notlar */}
      {personel.notlar && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Notlar</h3>
          <p className="text-sm whitespace-pre-wrap">{personel.notlar}</p>
        </div>
      )}

      <ConfirmDialog
        open={silmeDialogAcik}
        onClose={() => setSilmeDialogAcik(false)}
        onConfirm={handleSil}
        title="Personeli Sil"
        message={`"${personel.ad_soyad}" personelini silmek istediginize emin misiniz? Bu islem geri alinamaz.`}
        confirmText="Sil"
        cancelText="Iptal"
        variant="destructive"
      />
    </div>
  )
}
