import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Phone,
  Briefcase,
  Users,
  User,
  FileText,
  Star,
  Plus,
  ChevronUp,
  Building,
} from 'lucide-react'
import { usePersonelDetay, usePersonelSil } from '@/hooks/usePersonel'
import { useUstZincir } from '@/hooks/useOrganizasyon'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { GOREV_TIPLERI } from '@/utils/constants'
import { formatTarih } from '@/utils/formatters'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import KisiGorevListesi from './KisiGorevListesi'
import KisiBelgeListesi from './KisiBelgeListesi'
import KisiYetkinlikListesi from './KisiYetkinlikListesi'
import GorevAtaModal from './GorevAtaModal'
import BelgeEkleModal from './BelgeEkleModal'
import YetkinlikEkleModal from './YetkinlikEkleModal'

const TABS = [
  { key: 'genel', label: 'Genel', icon: User },
  { key: 'gorevler', label: 'Görevler', icon: Briefcase },
  { key: 'belgeler', label: 'Belgeler', icon: FileText },
  { key: 'yetkinlikler', label: 'Yetkinlikler', icon: Star },
]

export default function PersonelDetay() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: personel, isLoading, error } = usePersonelDetay(id)
  const { data: ustZincir } = useUstZincir(id)
  const personelSil = usePersonelSil()

  const [aktifTab, setAktifTab] = useState('genel')
  const [silmeDialogAcik, setSilmeDialogAcik] = useState(false)
  const [gorevModalAcik, setGorevModalAcik] = useState(false)
  const [belgeModalAcik, setBelgeModalAcik] = useState(false)
  const [yetkinlikModalAcik, setYetkinlikModalAcik] = useState(false)

  // Projeler listesi (görev atama modal için)
  const [projeler, setProjeler] = useState([])
  useEffect(() => {
    fetch('/api/projeler')
      .then((r) => r.json())
      .then((data) => setProjeler(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const handleSil = () => {
    personelSil.mutate(id, {
      onSuccess: () => navigate('/personel'),
    })
  }

  if (isLoading) return <PageSkeleton />

  if (error || !personel) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-lg text-muted-foreground">Personel bulunamadı.</p>
        <button
          onClick={() => navigate('/personel')}
          className="mt-4 text-sm text-primary hover:underline"
        >
          Personel listesine dön
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
                  personel.durum === 'aktif'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {personel.durum === 'aktif' ? 'Aktif' : 'Pasif'}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              {personel.pozisyon_adi && (
                <span className="flex items-center gap-1">
                  <Building className="h-3.5 w-3.5" />
                  {personel.pozisyon_adi}
                  {personel.pozisyon_seviye && <span className="text-xs">(Seviye {personel.pozisyon_seviye})</span>}
                </span>
              )}
              {!personel.pozisyon_adi && (
                <span>{GOREV_TIPLERI[personel.gorev] || personel.gorev || 'Görev belirtilmemiş'}</span>
              )}
            </div>
            {/* Üst zincir */}
            {ustZincir && ustZincir.length > 0 && (
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <ChevronUp className="h-3 w-3" />
                {ustZincir.map((u, i) => (
                  <span key={u.id}>
                    {i > 0 && ' > '}
                    <button
                      onClick={() => navigate(`/personel/${u.id}`)}
                      className="hover:text-primary hover:underline"
                    >
                      {u.ad_soyad}
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/personel/${id}/duzenle`)}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Pencil className="h-4 w-4" />
            Düzenle
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
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
              <Building className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pozisyon</p>
              <p className="font-semibold">{personel.pozisyon_adi || GOREV_TIPLERI[personel.gorev] || personel.gorev || '-'}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Üst Yönetici</p>
              <p className="font-semibold">{personel.ust_kullanici_adi || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border">
        <div className="flex gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setAktifTab(tab.key)}
                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  aktifTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-foreground'
                }`}
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
        {aktifTab === 'genel' && (
          <div className="rounded-lg border border-border bg-card">
            <div className="divide-y divide-border">
              <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3">
                <span className="text-sm text-muted-foreground">Ad Soyad</span>
                <span className="sm:col-span-2 text-sm font-medium">{personel.ad_soyad}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3">
                <span className="text-sm text-muted-foreground">Telefon</span>
                <span className="sm:col-span-2 text-sm font-medium">{personel.telefon || '-'}</span>
              </div>
              {personel.email && (
                <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3">
                  <span className="text-sm text-muted-foreground">E-posta</span>
                  <span className="sm:col-span-2 text-sm font-medium">{personel.email}</span>
                </div>
              )}
              {personel.ise_giris_tarihi && (
                <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3">
                  <span className="text-sm text-muted-foreground">İşe Giriş Tarihi</span>
                  <span className="sm:col-span-2 text-sm font-medium">{formatTarih(personel.ise_giris_tarihi)}</span>
                </div>
              )}
              {personel.kan_grubu && (
                <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3">
                  <span className="text-sm text-muted-foreground">Kan Grubu</span>
                  <span className="sm:col-span-2 text-sm font-medium">{personel.kan_grubu}</span>
                </div>
              )}
              {personel.acil_kisi && (
                <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3">
                  <span className="text-sm text-muted-foreground">Acil Durumda Aranacak</span>
                  <span className="sm:col-span-2 text-sm font-medium">
                    {personel.acil_kisi} {personel.acil_telefon && `(${personel.acil_telefon})`}
                  </span>
                </div>
              )}
              {personel.adres && (
                <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3">
                  <span className="text-sm text-muted-foreground">Adres</span>
                  <span className="sm:col-span-2 text-sm font-medium">{personel.adres}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3">
                <span className="text-sm text-muted-foreground">Pozisyon</span>
                <span className="sm:col-span-2 text-sm font-medium">
                  {personel.pozisyon_adi || '-'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3">
                <span className="text-sm text-muted-foreground">Üst Yönetici</span>
                <span className="sm:col-span-2 text-sm font-medium">
                  {personel.ust_kullanici_adi || '-'}
                </span>
              </div>
              {personel.olusturma_tarihi && (
                <div className="grid grid-cols-1 sm:grid-cols-3 px-5 py-3">
                  <span className="text-sm text-muted-foreground">Kayıt Tarihi</span>
                  <span className="sm:col-span-2 text-sm font-medium">
                    {formatTarih(personel.olusturma_tarihi)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {aktifTab === 'gorevler' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={() => setGorevModalAcik(true)}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Görev Ata
              </button>
            </div>
            <KisiGorevListesi kullaniciId={parseInt(id)} />
          </div>
        )}

        {aktifTab === 'belgeler' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={() => setBelgeModalAcik(true)}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Belge Ekle
              </button>
            </div>
            <KisiBelgeListesi kullaniciId={parseInt(id)} />
          </div>
        )}

        {aktifTab === 'yetkinlikler' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={() => setYetkinlikModalAcik(true)}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Yetkinlik Ekle
              </button>
            </div>
            <KisiYetkinlikListesi kullaniciId={parseInt(id)} />
          </div>
        )}
      </div>

      {/* Notlar */}
      {personel.notlar && aktifTab === 'genel' && (
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
        message={`"${personel.ad_soyad}" personelini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
        confirmText="Sil"
        cancelText="İptal"
        variant="destructive"
      />

      <GorevAtaModal
        kullaniciId={parseInt(id)}
        acik={gorevModalAcik}
        onKapat={() => setGorevModalAcik(false)}
        projeler={projeler}
      />

      <BelgeEkleModal
        kullaniciId={parseInt(id)}
        acik={belgeModalAcik}
        onKapat={() => setBelgeModalAcik(false)}
      />

      <YetkinlikEkleModal
        kullaniciId={parseInt(id)}
        acik={yetkinlikModalAcik}
        onKapat={() => setYetkinlikModalAcik(false)}
      />
    </div>
  )
}
