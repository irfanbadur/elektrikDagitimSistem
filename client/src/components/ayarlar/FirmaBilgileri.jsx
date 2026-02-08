import { useState, useEffect } from 'react'
import { Save, Building2 } from 'lucide-react'
import { useAyarlar, useAyarlarGuncelle } from '@/hooks/useAyarlar'

export default function FirmaBilgileri() {
  const { data: ayarlar, isLoading } = useAyarlar()
  const guncelle = useAyarlarGuncelle()
  const [form, setForm] = useState({})
  const [kaydedildi, setKaydedildi] = useState(false)

  useEffect(() => {
    if (ayarlar) {
      const obj = {}
      // ayarlar is either an array of {anahtar, deger} or an object
      if (Array.isArray(ayarlar)) {
        ayarlar.forEach(a => { obj[a.anahtar] = a.deger })
      } else {
        Object.assign(obj, ayarlar)
      }
      setForm(obj)
    }
  }, [ayarlar])

  const handleSubmit = (e) => {
    e.preventDefault()
    guncelle.mutate(form, {
      onSuccess: () => {
        setKaydedildi(true)
        setTimeout(() => setKaydedildi(false), 3000)
      }
    })
  }

  const alanlar = [
    { key: 'firma_adi', label: 'Firma Adı', type: 'text' },
    { key: 'firma_il', label: 'İl', type: 'text' },
    { key: 'firma_telefon', label: 'Telefon', type: 'text' },
    { key: 'firma_adres', label: 'Adres', type: 'textarea' },
    { key: 'dagitim_sirketi', label: 'Dağıtım Şirketi', type: 'text' },
    { key: 'para_birimi', label: 'Para Birimi', type: 'text' },
    { key: 'calisan_proje_tipleri', label: 'Proje Tipleri (virgülle ayırın)', type: 'text' },
  ]

  if (isLoading) return <div className="space-y-4">{Array.from({length:5}).map((_,i) => <div key={i} className="skeleton h-12 w-full" />)}</div>

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Building2 className="h-6 w-6 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Firma Bilgileri</h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6">
        {alanlar.map(alan => (
          <div key={alan.key}>
            <label className="mb-1 block text-sm font-medium">{alan.label}</label>
            {alan.type === 'textarea' ? (
              <textarea value={form[alan.key] || ''} onChange={e => setForm(f => ({...f, [alan.key]: e.target.value}))} rows={3} className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            ) : (
              <input type="text" value={form[alan.key] || ''} onChange={e => setForm(f => ({...f, [alan.key]: e.target.value}))} className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            )}
          </div>
        ))}
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={guncelle.isPending} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-blue-700 disabled:opacity-50">
            <Save className="h-4 w-4" /> {guncelle.isPending ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
          {kaydedildi && <span className="text-sm text-green-600">Ayarlar kaydedildi!</span>}
        </div>
      </form>
    </div>
  )
}
