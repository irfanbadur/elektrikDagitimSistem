import { useSearchParams } from 'react-router-dom'
import { Package, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function MalzemeRaporu() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const ay = searchParams.get('ay')

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate('/raporlar')} className="rounded p-1.5 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Malzeme Kullanım Raporu</h1>
          {ay && <p className="text-sm text-muted-foreground">Dönem: {ay}</p>}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16">
        <div className="rounded-lg bg-primary/10 p-4 mb-4">
          <Package className="h-8 w-8 text-primary" />
        </div>
        <p className="text-lg font-medium text-muted-foreground">Bu rapor henüz yükleniyor...</p>
        <p className="mt-2 text-sm text-muted-foreground">Malzeme kullanım raporu hazırlanıyor, lütfen bekleyin.</p>
      </div>
    </div>
  )
}
