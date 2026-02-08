import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { usePersonelOlustur, usePersonelGuncelle } from '@/hooks/usePersonel'
import { useEkipler } from '@/hooks/useEkipler'
import { GOREV_TIPLERI } from '@/utils/constants'
import { cn } from '@/lib/utils'

const bosForm = {
  ad_soyad: '',
  telefon: '',
  telegram_id: '',
  telegram_kullanici_adi: '',
  gorev: '',
  ekip_id: '',
  notlar: '',
}

export default function PersonelForm({ personel = null }) {
  const navigate = useNavigate()
  const duzenleModu = !!personel

  const personelOlustur = usePersonelOlustur()
  const personelGuncelle = usePersonelGuncelle()
  const { data: ekipler } = useEkipler()

  const [form, setForm] = useState(bosForm)
  const [hatalar, setHatalar] = useState({})
  const [gonderildi, setGonderildi] = useState(false)

  useEffect(() => {
    if (personel) {
      setForm({
        ad_soyad: personel.ad_soyad || '',
        telefon: personel.telefon || '',
        telegram_id: personel.telegram_id || '',
        telegram_kullanici_adi: personel.telegram_kullanici_adi || '',
        gorev: personel.gorev || '',
        ekip_id: personel.ekip_id || '',
        notlar: personel.notlar || '',
      })
    }
  }, [personel])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (hatalar[name]) {
      setHatalar((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const dogrula = () => {
    const yeniHatalar = {}
    if (!form.ad_soyad.trim()) {
      yeniHatalar.ad_soyad = 'Ad Soyad zorunludur.'
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
      ekip_id: form.ekip_id || null,
      telegram_id: form.telegram_id || null,
      telegram_kullanici_adi: form.telegram_kullanici_adi || null,
    }

    const mutation = duzenleModu ? personelGuncelle : personelOlustur
    const mutationData = duzenleModu
      ? { id: personel.personel_id, ...payload }
      : payload

    mutation.mutate(mutationData, {
      onSuccess: () => navigate('/personel'),
      onError: () => setGonderildi(false),
    })
  }

  const isSubmitting = personelOlustur.isPending || personelGuncelle.isPending

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/personel')}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">
            {duzenleModu ? 'Personel Duzenle' : 'Yeni Personel Ekle'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {duzenleModu
              ? `"${personel.ad_soyad}" personelini duzenliyorsunuz.`
              : 'Yeni bir personel eklemek icin formu doldurun.'}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Ad Soyad */}
          <div>
            <label htmlFor="ad_soyad" className="mb-1.5 block text-sm font-medium">
              Ad Soyad <span className="text-red-500">*</span>
            </label>
            <input
              id="ad_soyad"
              name="ad_soyad"
              type="text"
              value={form.ad_soyad}
              onChange={handleChange}
              placeholder="Orn: Ahmet Yilmaz"
              className={cn(
                'w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
                hatalar.ad_soyad && 'border-red-500 focus:ring-red-200 focus:border-red-500'
              )}
            />
            {hatalar.ad_soyad && (
              <p className="mt-1 text-xs text-red-500">{hatalar.ad_soyad}</p>
            )}
          </div>

          {/* Telefon */}
          <div>
            <label htmlFor="telefon" className="mb-1.5 block text-sm font-medium">
              Telefon
            </label>
            <input
              id="telefon"
              name="telefon"
              type="text"
              value={form.telefon}
              onChange={handleChange}
              placeholder="Orn: 0532 123 45 67"
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Telegram ID */}
          <div>
            <label htmlFor="telegram_id" className="mb-1.5 block text-sm font-medium">
              Telegram ID
            </label>
            <input
              id="telegram_id"
              name="telegram_id"
              type="text"
              value={form.telegram_id}
              onChange={handleChange}
              placeholder="Orn: 123456789"
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Telegram Kullanici Adi */}
          <div>
            <label htmlFor="telegram_kullanici_adi" className="mb-1.5 block text-sm font-medium">
              Telegram Kullanici Adi
            </label>
            <input
              id="telegram_kullanici_adi"
              name="telegram_kullanici_adi"
              type="text"
              value={form.telegram_kullanici_adi}
              onChange={handleChange}
              placeholder="Orn: ahmetyilmaz"
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Gorev */}
          <div>
            <label htmlFor="gorev" className="mb-1.5 block text-sm font-medium">
              Gorev
            </label>
            <select
              id="gorev"
              name="gorev"
              value={form.gorev}
              onChange={handleChange}
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="">Seciniz...</option>
              {Object.entries(GOREV_TIPLERI).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Ekip */}
          <div>
            <label htmlFor="ekip_id" className="mb-1.5 block text-sm font-medium">
              Ekip
            </label>
            <select
              id="ekip_id"
              name="ekip_id"
              value={form.ekip_id}
              onChange={handleChange}
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="">Seciniz...</option>
              {ekipler?.map((e) => (
                <option key={e.ekip_id} value={e.ekip_id}>
                  {e.ekip_adi}
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
              placeholder="Personel hakkinda ek notlar..."
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
            />
          </div>
        </div>

        {/* Hata Mesaji */}
        {(personelOlustur.isError || personelGuncelle.isError) && (
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
            onClick={() => navigate('/personel')}
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
