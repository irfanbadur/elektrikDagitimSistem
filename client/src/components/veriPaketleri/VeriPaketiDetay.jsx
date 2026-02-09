import { useParams, Link } from 'react-router-dom'
import { useVeriPaketi } from '@/hooks/useVeriPaketleri'
import { formatTarihSaat } from '@/utils/formatters'
import { PageSkeleton as LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { ArrowLeft, Package, MapPin, Camera, FileText, Bot } from 'lucide-react'

export default function VeriPaketiDetay() {
  const { id } = useParams()
  const { data, isLoading } = useVeriPaketi(id)
  const paket = data?.data

  if (isLoading) return <LoadingSkeleton />
  if (!paket) return <p className="py-8 text-center text-gray-500">Paket bulunamadi.</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/veri-paketleri" className="rounded-lg p-1.5 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-lg font-semibold">{paket.paket_no} | {paket.paket_tipi}</h2>
          <p className="text-sm text-gray-500">
            {paket.proje_no && `Proje: ${paket.proje_no} | `}
            {paket.ekip_adi && `Ekip: ${paket.ekip_adi} | `}
            {paket.personel_adi || ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Camera className="h-4 w-4" /> Fotograflar
          </div>
          <p className="mt-1 text-2xl font-bold">{paket.foto_sayisi}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <MapPin className="h-4 w-4" /> Konum
          </div>
          <p className="mt-1 text-sm font-medium">
            {paket.latitude ? `${paket.latitude.toFixed(4)}, ${paket.longitude.toFixed(4)}` : 'Konum yok'}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Package className="h-4 w-4" /> Durum
          </div>
          <p className="mt-1 text-sm font-medium capitalize">{paket.durum}</p>
          <p className="text-xs text-gray-400">{formatTarihSaat(paket.olusturma_tarihi)}</p>
        </div>
      </div>

      {paket.notlar && (
        <div className="rounded-lg border bg-white p-4">
          <h3 className="flex items-center gap-2 font-medium"><FileText className="h-4 w-4" /> Notlar</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{paket.notlar}</p>
        </div>
      )}

      {paket.medyalar && paket.medyalar.length > 0 && (
        <div className="rounded-lg border bg-white p-4">
          <h3 className="mb-3 font-medium">Fotograflar ({paket.medyalar.length})</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {paket.medyalar.map((medya) => (
              <div key={medya.id} className="group relative overflow-hidden rounded-lg border">
                <img
                  src={`/api/medya/${medya.id}/thumbnail`}
                  alt={medya.aciklama || 'Fotograf'}
                  className="aspect-square w-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  <div className="flex items-center gap-1.5 text-xs text-white">
                    {medya.latitude && <MapPin className="h-3 w-3" />}
                    {medya.ai_analiz && <Bot className="h-3 w-3" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {paket.analizler && paket.analizler.length > 0 && (
        <div className="rounded-lg border bg-white p-4">
          <h3 className="mb-3 flex items-center gap-2 font-medium"><Bot className="h-4 w-4" /> AI Analiz Sonuclari</h3>
          <div className="space-y-3">
            {paket.analizler.map((analiz) => (
              <div key={analiz.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Katman {analiz.analiz_katmani} - {analiz.analiz_tipi}
                  </span>
                  {analiz.guven_skoru && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                      Guven: %{Math.round(analiz.guven_skoru * 100)}
                    </span>
                  )}
                </div>
                {analiz.genel_aciklama && (
                  <p className="mt-1.5 text-sm text-gray-600">{analiz.genel_aciklama}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
