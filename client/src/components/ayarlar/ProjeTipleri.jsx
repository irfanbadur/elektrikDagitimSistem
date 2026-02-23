import { useState, useEffect } from 'react'
import { Plus, X, Tag } from 'lucide-react'
import { useAyarlar, useAyarlarGuncelle } from '@/hooks/useAyarlar'

export default function ProjeTipleri() {
  const { data: ayarlar, isLoading } = useAyarlar()
  const guncelle = useAyarlarGuncelle()
  const [tipler, setTipler] = useState([])
  const [yeniTip, setYeniTip] = useState('')
  const [kaydedildi, setKaydedildi] = useState(false)

  useEffect(() => {
    if (ayarlar) {
      let tipStr = ''
      if (Array.isArray(ayarlar)) {
        const found = ayarlar.find(a => a.anahtar === 'calisan_proje_tipleri')
        tipStr = found?.deger || ''
      } else {
        tipStr = ayarlar.calisan_proje_tipleri || ''
      }
      setTipler(tipStr.split(',').map(t => t.trim()).filter(Boolean))
    }
  }, [ayarlar])

  const handleEkle = () => {
    const tip = yeniTip.trim().toUpperCase()
    if (tip && !tipler.includes(tip)) {
      const yeniListe = [...tipler, tip]
      setTipler(yeniListe)
      setYeniTip('')
      kaydet(yeniListe)
    }
  }

  const handleSil = (tip) => {
    const yeniListe = tipler.filter(t => t !== tip)
    setTipler(yeniListe)
    kaydet(yeniListe)
  }

  const kaydet = (liste) => {
    guncelle.mutate({ calisan_proje_tipleri: liste.join(',') }, {
      onSuccess: () => { setKaydedildi(true); setTimeout(() => setKaydedildi(false), 3000) }
    })
  }

  if (isLoading) return <div className="skeleton h-32 w-full max-w-md" />

  return (
    <div className="max-w-md">
      <div className="mb-6 flex items-center gap-3">
        <Tag className="h-6 w-6 text-muted-foreground" />
        <h2 className="text-xl font-semibold">İş Tipleri</h2>
      </div>
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          {tipler.map(tip => (
            <span key={tip} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              {tip}
              <button onClick={() => handleSil(tip)} className="ml-1 rounded-full p-0.5 hover:bg-primary/20">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {tipler.length === 0 && <p className="text-sm text-muted-foreground">Henüz tip tanımlanmamış</p>}
        </div>
        <div className="flex gap-2">
          <input value={yeniTip} onChange={e => setYeniTip(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEkle()} placeholder="Yeni tip adı" className="flex-1 rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
          <button onClick={handleEkle} className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Ekle
          </button>
        </div>
        {kaydedildi && <p className="mt-3 text-sm text-green-600">Kaydedildi!</p>}
      </div>
    </div>
  )
}
