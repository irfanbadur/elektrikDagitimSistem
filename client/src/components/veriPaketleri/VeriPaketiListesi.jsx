import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useVeriPaketleri } from '@/hooks/useVeriPaketleri'
import { formatTarihSaat } from '@/utils/formatters'
import { PageSkeleton as LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { Package, MapPin, Camera, FileText, ChevronRight } from 'lucide-react'

const PAKET_TIP_LABELS = {
  direk_tespit: 'Direk Tespit',
  montaj_oncesi: 'Montaj Oncesi',
  montaj_sonrasi: 'Montaj Sonrasi',
  hasar_tespit: 'Hasar Tespit',
  malzeme_tespit: 'Malzeme Tespit',
  ilerleme_raporu: 'Ilerleme Raporu',
  guzergah_tespit: 'Guzergah Tespit',
  diger: 'Diger',
}

const DURUM_RENKLERI = {
  devam_ediyor: 'bg-yellow-100 text-yellow-800',
  tamamlandi: 'bg-green-100 text-green-800',
  iptal: 'bg-red-100 text-red-800',
}

export default function VeriPaketiListesi() {
  const [filters, setFilters] = useState({})
  const { data, isLoading } = useVeriPaketleri(filters)
  const paketler = data?.data || []

  if (isLoading) return <LoadingSkeleton />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Veri Paketleri</h2>
        <div className="flex gap-2">
          <select
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            onChange={(e) => setFilters(f => ({ ...f, tip: e.target.value || undefined }))}
          >
            <option value="">Tum Tipler</option>
            {Object.entries(PAKET_TIP_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            onChange={(e) => setFilters(f => ({ ...f, durum: e.target.value || undefined }))}
          >
            <option value="">Tum Durumlar</option>
            <option value="devam_ediyor">Devam Ediyor</option>
            <option value="tamamlandi">Tamamlandi</option>
            <option value="iptal">Iptal</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {paketler.length === 0 ? (
          <p className="py-8 text-center text-gray-500">Veri paketi bulunamadi.</p>
        ) : (
          paketler.map((paket) => (
            <Link
              key={paket.id}
              to={`/veri-paketleri/${paket.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{paket.paket_no}</span>
                    <span className="text-sm text-gray-500">|</span>
                    <span className="text-sm">{PAKET_TIP_LABELS[paket.paket_tipi] || paket.paket_tipi}</span>
                    {paket.proje_no && (
                      <>
                        <span className="text-sm text-gray-500">|</span>
                        <span className="text-sm text-primary">{paket.proje_no}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Camera className="h-3.5 w-3.5" /> {paket.foto_sayisi} foto
                    </span>
                    {paket.latitude && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {paket.latitude?.toFixed(4)}, {paket.longitude?.toFixed(4)}
                      </span>
                    )}
                    {paket.ekip_adi && <span>{paket.ekip_adi}</span>}
                    <span>{formatTarihSaat(paket.olusturma_tarihi)}</span>
                  </div>
                  {paket.notlar && (
                    <p className="mt-1.5 flex items-center gap-1 text-sm text-gray-600">
                      <FileText className="h-3.5 w-3.5" /> {paket.notlar.substring(0, 100)}{paket.notlar.length > 100 ? '...' : ''}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${DURUM_RENKLERI[paket.durum] || 'bg-gray-100'}`}>
                    {paket.durum === 'tamamlandi' ? 'Tamamlandi' : paket.durum === 'devam_ediyor' ? 'Devam Ediyor' : 'Iptal'}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
