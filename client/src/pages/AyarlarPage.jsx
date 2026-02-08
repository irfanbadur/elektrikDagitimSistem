import { useState } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import FirmaBilgileri from '@/components/ayarlar/FirmaBilgileri'
import BolgeYonetimi from '@/components/ayarlar/BolgeYonetimi'
import ProjeTipleri from '@/components/ayarlar/ProjeTipleri'
import { cn } from '@/lib/utils'

const sekmeler = [
  { id: 'firma', label: 'Firma Bilgileri' },
  { id: 'bolgeler', label: 'Bolge Yonetimi' },
  { id: 'tipler', label: 'Proje Tipleri' },
]

export default function AyarlarPage() {
  const [aktifSekme, setAktifSekme] = useState('firma')

  return (
    <MainLayout title="Ayarlar">
      <div className="mb-6 flex gap-1 border-b border-border">
        {sekmeler.map(s => (
          <button
            key={s.id}
            onClick={() => setAktifSekme(s.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors',
              aktifSekme === s.id
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {aktifSekme === 'firma' && <FirmaBilgileri />}
      {aktifSekme === 'bolgeler' && <BolgeYonetimi />}
      {aktifSekme === 'tipler' && <ProjeTipleri />}
    </MainLayout>
  )
}
