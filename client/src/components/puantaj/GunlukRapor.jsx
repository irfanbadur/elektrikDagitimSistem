import { useNavigate, useParams } from 'react-router-dom'
import { Edit, ArrowLeft, Clock, Users, MapPin, CloudSun, Car } from 'lucide-react'
import { usePuantaj } from '@/hooks/usePuantaj'
import { IS_KATEGORILERI, HAVA_DURUMLARI } from '@/utils/constants'
import { formatTarih } from '@/utils/formatters'

function BilgiSatiri({ etiket, deger, icon: Icon }) {
  if (!deger && deger !== 0) return null
  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
      <div>
        <p className="text-xs font-medium text-muted-foreground">{etiket}</p>
        <p className="text-sm">{deger}</p>
      </div>
    </div>
  )
}

export default function GunlukRapor() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { data: rapor, isLoading } = usePuantaj(id)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-64 w-full" />
      </div>
    )
  }

  if (!rapor) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg font-medium text-muted-foreground">Rapor bulunamadı</p>
        <button onClick={() => navigate('/puantaj')} className="mt-4 text-sm text-primary hover:underline">
          Listeye dön
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Başlık */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/puantaj')} className="rounded p-1.5 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Günlük Rapor</h1>
            <p className="text-sm text-muted-foreground">{formatTarih(rapor.tarih)}</p>
          </div>
        </div>
        <button onClick={() => navigate(`/puantaj/${id}/duzenle`)} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-blue-700">
          <Edit className="h-4 w-4" /> Düzenle
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Genel Bilgiler */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Genel Bilgiler</h2>
          <div className="divide-y divide-border">
            <BilgiSatiri etiket="Tarih" deger={formatTarih(rapor.tarih)} />
            <BilgiSatiri etiket="Ekip" deger={rapor.ekip_adi} icon={Users} />
            <BilgiSatiri etiket="Proje" deger={rapor.proje_no ? `${rapor.proje_no} - ${rapor.proje_adi || ''}` : null} />
            <BilgiSatiri etiket="Bölge" deger={rapor.bolge_adi} icon={MapPin} />
            <BilgiSatiri etiket="İş Kategorisi" deger={IS_KATEGORILERI[rapor.is_kategorisi] || rapor.is_kategorisi} />
          </div>
        </div>

        {/* Çalışma Detayları */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Çalışma Detayları</h2>
          <div className="divide-y divide-border">
            <BilgiSatiri etiket="Kişi Sayısı" deger={rapor.kisi_sayisi ? `${rapor.kisi_sayisi} kişi` : null} icon={Users} />
            <BilgiSatiri etiket="Başlama Saati" deger={rapor.baslama_saati} icon={Clock} />
            <BilgiSatiri etiket="Bitiş Saati" deger={rapor.bitis_saati} icon={Clock} />
            <BilgiSatiri etiket="Hava Durumu" deger={HAVA_DURUMLARI[rapor.hava_durumu] || rapor.hava_durumu} icon={CloudSun} />
          </div>
        </div>

        {/* Çalışan Listesi */}
        {rapor.calisan_listesi && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Çalışan Listesi</h2>
            <p className="text-sm leading-relaxed">{rapor.calisan_listesi}</p>
          </div>
        )}

        {/* Yapılan İş */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Yapılan İş</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{rapor.yapilan_is}</p>
        </div>

        {/* Enerji Kesintisi */}
        {rapor.enerji_kesintisi && (
          <div className="rounded-lg border border-orange-300 bg-orange-50 p-6">
            <h2 className="mb-4 text-lg font-semibold text-orange-800">Enerji Kesintisi</h2>
            <p className="text-sm text-orange-700">{rapor.kesinti_detay || 'Enerji kesintisi yaşandı.'}</p>
          </div>
        )}

        {/* Araç Bilgileri */}
        {(rapor.arac_km_baslangic || rapor.arac_km_bitis) && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Araç Bilgileri</h2>
            <div className="divide-y divide-border">
              <BilgiSatiri etiket="KM Başlangıç" deger={rapor.arac_km_baslangic} icon={Car} />
              <BilgiSatiri etiket="KM Bitiş" deger={rapor.arac_km_bitis} icon={Car} />
              {rapor.arac_km_baslangic && rapor.arac_km_bitis && (
                <BilgiSatiri etiket="Toplam Mesafe" deger={`${rapor.arac_km_bitis - rapor.arac_km_baslangic} km`} />
              )}
            </div>
          </div>
        )}

        {/* Notlar */}
        {rapor.notlar && (
          <div className="rounded-lg border border-border bg-card p-6 lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold">Notlar</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{rapor.notlar}</p>
          </div>
        )}
      </div>
    </div>
  )
}
