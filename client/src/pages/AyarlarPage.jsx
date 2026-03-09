import { useState } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import FirmaBilgileri from '@/components/ayarlar/FirmaBilgileri'
import BolgeYonetimi from '@/components/ayarlar/BolgeYonetimi'
import ProjeTipleri from '@/components/ayarlar/ProjeTipleri'
import DepartmanYonetimi from '@/components/ayarlar/DepartmanYonetimi'
import RolYonetimi from '@/components/ayarlar/RolYonetimi'
import KullaniciYonetimi from '@/components/ayarlar/KullaniciYonetimi'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'

const sekmeler = [
  { id: 'firma', label: 'Firma Bilgileri' },
  { id: 'bolgeler', label: 'Bölge Yönetimi' },
  { id: 'tipler', label: 'İş Tipleri' },
  { id: 'departmanlar', label: 'Departmanlar' },
  { id: 'roller', label: 'Rol Yönetimi', modul: 'ayarlar', aksiyon: 'roller' },
  { id: 'kullanicilar', label: 'Kullanıcılar', modul: 'ayarlar', aksiyon: 'kullanicilar' },
]

export default function AyarlarPage() {
  const [aktifSekme, setAktifSekme] = useState('firma')
  const { izinVar } = useAuth()

  const gorunurSekmeler = sekmeler.filter(s => {
    if (!s.modul) return true
    return izinVar(s.modul, s.aksiyon)
  })

  return (
    <MainLayout title="Ayarlar">
      <div className="mb-6 flex gap-3 overflow-x-auto border-b border-border">
        {gorunurSekmeler.map((s, i) => (
          <div key={s.id} className="flex items-center">
            {i > 0 && <div className="mr-3 h-4 w-px bg-border" />}
            <button
              onClick={() => setAktifSekme(s.id)}
              className={cn(
                'whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors',
                aktifSekme === s.id
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {s.label}
            </button>
          </div>
        ))}
      </div>
      {aktifSekme === 'firma' && <FirmaBilgileri />}
      {aktifSekme === 'bolgeler' && <BolgeYonetimi />}
      {aktifSekme === 'tipler' && <ProjeTipleri />}
      {aktifSekme === 'departmanlar' && <DepartmanYonetimi />}
      {aktifSekme === 'roller' && <RolYonetimi />}
      {aktifSekme === 'kullanicilar' && <KullaniciYonetimi />}
    </MainLayout>
  )
}
