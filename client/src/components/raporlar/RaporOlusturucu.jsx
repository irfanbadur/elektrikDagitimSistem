import { useState } from 'react'
import { FileText, Package, FolderKanban, Users, Download, BarChart3 } from 'lucide-react'
import { bugununTarihi } from '@/utils/formatters'

const raporlar = [
  { id: 'gunluk-ozet', baslik: 'Günlük Özet', aciklama: 'Tüm ekiplerin günlük çalışma durumu', icon: FileText, tarihTipi: 'date' },
  { id: 'haftalik', baslik: 'Haftalık Rapor', aciklama: 'Haftalık puantaj ve iş özeti', icon: BarChart3, tarihTipi: 'date' },
  { id: 'malzeme-kullanim', baslik: 'Malzeme Kullanım', aciklama: 'Aylık malzeme giriş/çıkış raporu', icon: Package, tarihTipi: 'month' },
  { id: 'proje-durumu', baslik: 'Proje Durumu', aciklama: 'Tüm projelerin güncel durum raporu', icon: FolderKanban, tarihTipi: null },
  { id: 'ekip-performans', baslik: 'Ekip Performans', aciklama: 'Ekip bazlı performans raporu', icon: Users, tarihTipi: 'month' },
]

export default function RaporOlusturucu() {
  const [seciliTarihler, setSeciliTarihler] = useState({})

  const handleExcelIndir = (raporId) => {
    const tarih = seciliTarihler[raporId] || ''
    let url = `/api/raporlar/${raporId}?format=excel`
    if (tarih) {
      if (raporId === 'gunluk-ozet') url += `&tarih=${tarih}`
      else if (raporId === 'haftalik') url += `&hafta_baslangic=${tarih}`
      else if (raporId.includes('malzeme') || raporId.includes('performans')) url += `&ay=${tarih}`
    }
    window.open(url, '_blank')
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Raporlar</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {raporlar.map(rapor => {
          const Icon = rapor.icon
          return (
            <div key={rapor.id} className="rounded-lg border border-border bg-card p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-4">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{rapor.baslik}</h3>
                  <p className="text-sm text-muted-foreground">{rapor.aciklama}</p>
                </div>
              </div>
              {rapor.tarihTipi && (
                <div className="mb-4">
                  <input
                    type={rapor.tarihTipi}
                    value={seciliTarihler[rapor.id] || ''}
                    onChange={e => setSeciliTarihler(s => ({...s, [rapor.id]: e.target.value}))}
                    className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                  />
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => handleExcelIndir(rapor.id)} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                  <Download className="h-4 w-4" /> Excel İndir
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
