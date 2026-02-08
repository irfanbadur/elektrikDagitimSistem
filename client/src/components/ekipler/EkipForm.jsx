import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { useEkipOlustur, useEkipGuncelle } from '@/hooks/useEkipler'
import { usePersonelListesi } from '@/hooks/usePersonel'
import { useBolgeler } from '@/hooks/useBolgeler'
import { cn } from '@/lib/utils'

const DURUM_SECENEKLERI = [
  { value: 'aktif', label: 'Aktif' },
  { value: 'izinli', label: 'Izinli' },
  { value: 'pasif', label: 'Pasif' },
]

const bosForm = {
  ekip_adi: '',
  ekip_kodu: '',
  ekip_basi_id: '',
  varsayilan_bolge_id: '',
  arac_plaka: '',
  durum: 'aktif',
  notlar: '',
}

export default function EkipForm({ ekip = null }) {
  const navigate = useNavigate()
  const duzenleModu = !!ekip

  const ekipOlustur = useEkipOlustur()
  const ekipGuncelle = useEkipGuncelle()
  const { data: personelListesi } = usePersonelListesi()
  const { data: bolgeler } = useBolgeler()

  const [form, setForm] = useState(bosForm)
  const [hatalar, setHatalar] = useState({})
  const [gonderildi, setGonderildi] = useState(false)

  useEffect(() => {
    if (ekip) {
      setForm({
        ekip_adi: ekip.ekip_adi || '',
        ekip_kodu: ekip.ekip_kodu || '',
        ekip_basi_id: ekip.ekip_basi_id || '',
        varsayilan_bolge_id: ekip.varsayilan_bolge_id || '',
        arac_plaka: ekip.arac_plaka || '',
        durum: ekip.durum || 'aktif',
        notlar: ekip.notlar || '',
      })
    }
  }, [ekip])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (hatalar[name]) {
      setHatalar((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const dogrula = () => {
    const yeniHatalar = {}
    if (!form.ekip_adi.trim()) {
      yeniHatalar.ekip_adi = 'Ekip adi zorunludur.'
    }
    if (!form.ekip_kodu.trim()) {
      yeniHatalar.ekip_kodu = 'Ekip kodu zorunludur.'
    }
    setHatalar(yeniHatalar)
    return Object.keys(yeniHatalar).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setGonderildi(true)

    if (!dogrula()) {
      setGonderildi(false)
      return
    }

    const payload = {
      ...form,
      ekip_basi_id: form.ekip_basi_id || null,
      varsayilan_bolge_id: form.varsayilan_bolge_id || null,
    }

    const mutation = duzenleModu ? ekipGuncelle : ekipOlustur
    const mutationData = duzenleModu ? { id: ekip.ekip_id, ...payload } : payload

    mutation.mutate(mutationData, {
      onSuccess: () => navigate('/ekipler'),
      onError: () => setGonderildi(false),
    })
  }

  const isSubmitting = ekipOlustur.isPending || ekipGuncelle.isPending

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/ekipler')}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">
            {duzenleModu ? 'Ekip Duzenle' : 'Yeni Ekip Olustur'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {duzenleModu
              ? `"${ekip.ekip_adi}" ekibini duzenliyorsunuz.`
              : 'Yeni bir ekip olusturmak icin formu doldurun.'}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Ekip Adi */}
          <div>
            <label htmlFor="ekip_adi" className="mb-1.5 block text-sm font-medium">
              Ekip Adi <span className="text-red-500">*</span>
            </label>
            <input
              id="ekip_adi"
              name="ekip_adi"
              type="text"
              value={form.ekip_adi}
              onChange={handleChange}
              placeholder="Orn: Anadolu Ekibi"
              className={cn(
                'w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
                hatalar.ekip_adi && 'border-red-500 focus:ring-red-200 focus:border-red-500'
              )}
            />
            {hatalar.ekip_adi && (
              <p className="mt-1 text-xs text-red-500">{hatalar.ekip_adi}</p>
            )}
          </div>

          {/* Ekip Kodu */}
          <div>
            <label htmlFor="ekip_kodu" className="mb-1.5 block text-sm font-medium">
              Ekip Kodu <span className="text-red-500">*</span>
            </label>
            <input
              id="ekip_kodu"
              name="ekip_kodu"
              type="text"
              value={form.ekip_kodu}
              onChange={handleChange}
              placeholder="Orn: EK-001"
              className={cn(
                'w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
                hatalar.ekip_kodu && 'border-red-500 focus:ring-red-200 focus:border-red-500'
              )}
            />
            {hatalar.ekip_kodu && (
              <p className="mt-1 text-xs text-red-500">{hatalar.ekip_kodu}</p>
            )}
          </div>

          {/* Ekip Basi */}
          <div>
            <label htmlFor="ekip_basi_id" className="mb-1.5 block text-sm font-medium">
              Ekip Basi
            </label>
            <select
              id="ekip_basi_id"
              name="ekip_basi_id"
              value={form.ekip_basi_id}
              onChange={handleChange}
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="">Seciniz...</option>
              {personelListesi?.map((p) => (
                <option key={p.personel_id} value={p.personel_id}>
                  {p.ad_soyad}
                </option>
              ))}
            </select>
          </div>

          {/* Bolge */}
          <div>
            <label htmlFor="varsayilan_bolge_id" className="mb-1.5 block text-sm font-medium">
              Varsayilan Bolge
            </label>
            <select
              id="varsayilan_bolge_id"
              name="varsayilan_bolge_id"
              value={form.varsayilan_bolge_id}
              onChange={handleChange}
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="">Seciniz...</option>
              {bolgeler?.map((b) => (
                <option key={b.bolge_id} value={b.bolge_id}>
                  {b.bolge_adi}
                </option>
              ))}
            </select>
          </div>

          {/* Arac Plaka */}
          <div>
            <label htmlFor="arac_plaka" className="mb-1.5 block text-sm font-medium">
              Arac Plaka
            </label>
            <input
              id="arac_plaka"
              name="arac_plaka"
              type="text"
              value={form.arac_plaka}
              onChange={handleChange}
              placeholder="Orn: 34 ABC 123"
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Durum */}
          <div>
            <label htmlFor="durum" className="mb-1.5 block text-sm font-medium">
              Durum
            </label>
            <select
              id="durum"
              name="durum"
              value={form.durum}
              onChange={handleChange}
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              {DURUM_SECENEKLERI.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notlar - full width */}
          <div className="sm:col-span-2">
            <label htmlFor="notlar" className="mb-1.5 block text-sm font-medium">
              Notlar
            </label>
            <textarea
              id="notlar"
              name="notlar"
              value={form.notlar}
              onChange={handleChange}
              rows={4}
              placeholder="Ekip hakkinda ek notlar..."
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
            />
          </div>
        </div>

        {/* Hata Mesaji */}
        {(ekipOlustur.isError || ekipGuncelle.isError) && (
          <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3">
            <p className="text-sm text-red-700">
              Islem sirasinda bir hata olustu. Lutfen tekrar deneyin.
            </p>
          </div>
        )}

        {/* Butonlar */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-6">
          <button
            type="button"
            onClick={() => navigate('/ekipler')}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Iptal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  )
}
