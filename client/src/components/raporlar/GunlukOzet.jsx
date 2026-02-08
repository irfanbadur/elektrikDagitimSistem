import { useSearchParams } from 'react-router-dom'
import { FileText, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatTarih } from '@/utils/formatters'

export default function GunlukOzet() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tarih = searchParams.get('tarih')

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate('/raporlar')} className="rounded p-1.5 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Günlük Özet Rapor</h1>
          {tarih && <p className="text-sm text-muted-foreground">{formatTarih(tarih)}</p>}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16">
        <div className="rounded-lg bg-primary/10 p-4 mb-4">
          <FileText className="h-8 w-8 text-primary" />
        </div>
        <p className="text-lg font-medium text-muted-foreground">Bu rapor henüz yükleniyor...</p>
        <p className="mt-2 text-sm text-muted-foreground">Günlük özet raporu hazırlanıyor, lütfen bekleyin.</p>
      </div>
    </div>
  )
}
