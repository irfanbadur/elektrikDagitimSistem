import { useState } from 'react'
import { ChevronRight, ChevronDown, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

const KATEGORI_RENK = {
  yonetim: 'border-red-200 bg-red-50',
  koordinasyon: 'border-blue-200 bg-blue-50',
  teknik: 'border-purple-200 bg-purple-50',
  saha: 'border-green-200 bg-green-50',
  destek: 'border-gray-200 bg-gray-50',
}

export default function OrgDugum({ dugum, derinlik = 0 }) {
  const [acik, setAcik] = useState(derinlik < 2)
  const navigate = useNavigate()
  const altSayisi = dugum.altlar?.length || 0

  return (
    <div className={cn('ml-0', derinlik > 0 && 'ml-6 border-l border-gray-200 pl-4')}>
      <div
        className={cn(
          'group flex items-center gap-2 rounded-lg border p-2.5 mb-1.5 transition-colors',
          KATEGORI_RENK[dugum.kategori] || 'border-gray-200 bg-white'
        )}
      >
        {altSayisi > 0 ? (
          <button onClick={() => setAcik(!acik)} className="shrink-0 text-gray-400 hover:text-gray-600">
            {acik ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
          <User className="h-4 w-4 text-gray-500" />
        </div>

        <div className="min-w-0 flex-1">
          <button
            onClick={() => navigate(`/personel/${dugum.id}`)}
            className="text-sm font-medium text-gray-900 hover:text-primary hover:underline"
          >
            {dugum.ad_soyad}
          </button>
          <p className="text-xs text-gray-500">{dugum.pozisyon_adi || 'Pozisyon belirtilmemiş'}</p>
        </div>

        {altSayisi > 0 && (
          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs text-gray-500 shadow-sm">
            {altSayisi}
          </span>
        )}
      </div>

      {acik && altSayisi > 0 && (
        <div>
          {dugum.altlar.map((alt) => (
            <OrgDugum key={alt.id} dugum={alt} derinlik={derinlik + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
