import { useState } from 'react'
import { useKatalog, useKatalogKategoriler } from '@/hooks/useKatalog'
import { PageSkeleton as LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { Wrench, Search } from 'lucide-react'

const KATEGORI_ICONS = {
  konsol: 'L', izolator: 'I', iletken: '~', armatur: 'A', direk: 'D',
  trafo: 'T', pano: 'P', ayirici: 'X', topraklama: 'G', aksesuar: '+',
}

export default function KatalogListesi() {
  const [selectedKategori, setSelectedKategori] = useState(null)
  const [search, setSearch] = useState('')
  const { data: katData, isLoading: katLoading } = useKatalogKategoriler()
  const { data, isLoading } = useKatalog({ kategori: selectedKategori || undefined })

  const kategoriler = katData?.data || []
  const ekipmanlar = (data?.data || []).filter(e =>
    !search || e.ekipman_adi.toLowerCase().includes(search.toLowerCase()) ||
    e.ekipman_kodu?.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading && katLoading) return <LoadingSkeleton />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Ekipman Katalogu</h2>
        <div className="relative">
          <input
            type="text"
            placeholder="Ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-gray-300 py-1.5 pl-3 pr-9 text-sm"
          />
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedKategori(null)}
          className={`rounded-full px-3 py-1 text-sm font-medium transition ${!selectedKategori ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
        >
          Tumu ({kategoriler.reduce((s, k) => s + k.sayi, 0)})
        </button>
        {kategoriler.map((k) => (
          <button
            key={`${k.kategori}-${k.gerilim_sinifi}`}
            onClick={() => setSelectedKategori(k.kategori)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${selectedKategori === k.kategori ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            {k.kategori} ({k.sayi})
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {ekipmanlar.length === 0 ? (
          <p className="py-8 text-center text-gray-500">Ekipman bulunamadi.</p>
        ) : (
          ekipmanlar.map((e) => (
            <div key={e.id} className="flex items-center gap-4 rounded-lg border bg-white p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-lg font-bold text-gray-500">
                {KATEGORI_ICONS[e.kategori] || '?'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{e.ekipman_kodu}</span>
                  <span className="text-gray-400">|</span>
                  <span>{e.ekipman_adi}</span>
                </div>
                <div className="flex gap-3 text-xs text-gray-500">
                  {e.alt_kategori && <span>{e.alt_kategori}</span>}
                  <span className="rounded bg-gray-100 px-1.5">{e.gerilim_sinifi}</span>
                  {e.referans_foto_sayisi > 0 && <span>{e.referans_foto_sayisi} ref. foto</span>}
                </div>
              </div>
              <Wrench className="h-4 w-4 text-gray-400" />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
