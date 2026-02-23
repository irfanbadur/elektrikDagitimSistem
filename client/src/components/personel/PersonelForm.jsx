import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import api from '@/api/client'
import { GOREV_TIPLERI, KAN_GRUPLARI } from '@/utils/constants'
import { cn } from '@/lib/utils'

const bosForm = {
  ad_soyad: '',
  telefon: '',
  telegram_id: '',
  telegram_kullanici_adi: '',
  gorev: '',
  ekip_id: '',
  pozisyon_id: '',
  ust_kullanici_id: '',
  tc_kimlik: '',
  dogum_tarihi: '',
  ise_giris_tarihi: '',
  kan_grubu: '',
  acil_kisi: '',
  acil_telefon: '',
  adres: '',
  notlar: '',
}

export default function PersonelForm({ personel = null }) {
  const navigate = useNavigate()
  const duzenleModu = !!personel

  const qc = useQueryClient()

  const personelOlustur = useMutation({
    mutationFn: (data) => api.post('/organizasyon/personel', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personel'] })
      qc.invalidateQueries({ queryKey: ['organizasyon'] })
    },
  })
  const personelGuncelle = useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/organizasyon/personel/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personel'] })
      qc.invalidateQueries({ queryKey: ['organizasyon'] })
    },
  })

  const { data: unvanlarRaw } = useQuery({
    queryKey: ['organizasyon', 'unvanlar'],
    queryFn: () => api.get('/organizasyon/unvanlar'),
  })
  const { data: ekiplerRaw } = useQuery({
    queryKey: ['ekipler'],
    queryFn: () => api.get('/ekipler'),
    select: (res) => res?.data,
  })
  const { data: kullanicilarRaw } = useQuery({
    queryKey: ['organizasyon', 'personel'],
    queryFn: () => api.get('/organizasyon/personel'),
  })

  const unvanlar = Array.isArray(unvanlarRaw) ? unvanlarRaw : []
  const ekipler = Array.isArray(ekiplerRaw) ? ekiplerRaw : []
  const kullanicilar = Array.isArray(kullanicilarRaw) ? kullanicilarRaw : []

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
        pozisyon_id: personel.pozisyon_id || '',
        ust_kullanici_id: personel.ust_kullanici_id || '',
        tc_kimlik: personel.tc_kimlik || '',
        dogum_tarihi: personel.dogum_tarihi || '',
        ise_giris_tarihi: personel.ise_giris_tarihi || '',
        kan_grubu: personel.kan_grubu || '',
        acil_kisi: personel.acil_kisi || '',
        acil_telefon: personel.acil_telefon || '',
        adres: personel.adres || '',
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
      pozisyon_id: form.pozisyon_id || null,
      ust_kullanici_id: form.ust_kullanici_id || null,
      telegram_id: form.telegram_id || null,
      telegram_kullanici_adi: form.telegram_kullanici_adi || null,
      tc_kimlik: form.tc_kimlik || null,
      dogum_tarihi: form.dogum_tarihi || null,
      ise_giris_tarihi: form.ise_giris_tarihi || null,
      kan_grubu: form.kan_grubu || null,
      acil_kisi: form.acil_kisi || null,
      acil_telefon: form.acil_telefon || null,
      adres: form.adres || null,
    }

    const mutation = duzenleModu ? personelGuncelle : personelOlustur
    const mutationData = duzenleModu
      ? { id: personel.id, ...payload }
      : payload

    mutation.mutate(mutationData, {
      onSuccess: () => navigate('/personel'),
      onError: () => setGonderildi(false),
    })
  }

  const isSubmitting = personelOlustur.isPending || personelGuncelle.isPending

  const inputCls = 'w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'

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
            {duzenleModu ? 'Personel Düzenle' : 'Yeni Personel Ekle'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {duzenleModu
              ? `"${personel.ad_soyad}" personelini düzenliyorsunuz.`
              : 'Yeni bir personel eklemek için formu doldurun.'}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Temel Bilgiler */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Temel Bilgiler
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                placeholder="Örn: Ahmet Yılmaz"
                className={cn(inputCls, hatalar.ad_soyad && 'border-red-500 focus:ring-red-200 focus:border-red-500')}
              />
              {hatalar.ad_soyad && (
                <p className="mt-1 text-xs text-red-500">{hatalar.ad_soyad}</p>
              )}
            </div>

            {/* Telefon */}
            <div>
              <label htmlFor="telefon" className="mb-1.5 block text-sm font-medium">Telefon</label>
              <input id="telefon" name="telefon" type="text" value={form.telefon} onChange={handleChange} placeholder="0532 123 45 67" className={inputCls} />
            </div>

            {/* TC Kimlik */}
            <div>
              <label htmlFor="tc_kimlik" className="mb-1.5 block text-sm font-medium">TC Kimlik No</label>
              <input id="tc_kimlik" name="tc_kimlik" type="text" value={form.tc_kimlik} onChange={handleChange} placeholder="11 haneli TC kimlik" maxLength={11} className={inputCls} />
            </div>

            {/* Doğum Tarihi */}
            <div>
              <label htmlFor="dogum_tarihi" className="mb-1.5 block text-sm font-medium">Doğum Tarihi</label>
              <input id="dogum_tarihi" name="dogum_tarihi" type="date" value={form.dogum_tarihi} onChange={handleChange} className={inputCls} />
            </div>

            {/* İşe Giriş Tarihi */}
            <div>
              <label htmlFor="ise_giris_tarihi" className="mb-1.5 block text-sm font-medium">İşe Giriş Tarihi</label>
              <input id="ise_giris_tarihi" name="ise_giris_tarihi" type="date" value={form.ise_giris_tarihi} onChange={handleChange} className={inputCls} />
            </div>

            {/* Kan Grubu */}
            <div>
              <label htmlFor="kan_grubu" className="mb-1.5 block text-sm font-medium">Kan Grubu</label>
              <select id="kan_grubu" name="kan_grubu" value={form.kan_grubu} onChange={handleChange} className={inputCls}>
                <option value="">Seçiniz...</option>
                {KAN_GRUPLARI.map((kg) => (
                  <option key={kg} value={kg}>{kg}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Pozisyon & Hiyerarşi */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Pozisyon & Organizasyon
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Ünvan (Roller) */}
            <div>
              <label htmlFor="pozisyon_id" className="mb-1.5 block text-sm font-medium">Ünvan</label>
              <select id="pozisyon_id" name="pozisyon_id" value={form.pozisyon_id} onChange={handleChange} className={inputCls}>
                <option value="">Seçiniz...</option>
                {unvanlar.map((r) => (
                  <option key={r.id} value={r.id}>{r.rol_adi}</option>
                ))}
              </select>
            </div>

            {/* Üst Yönetici */}
            <div>
              <label htmlFor="ust_kullanici_id" className="mb-1.5 block text-sm font-medium">Üst Yönetici (Raporlama)</label>
              <select id="ust_kullanici_id" name="ust_kullanici_id" value={form.ust_kullanici_id} onChange={handleChange} className={inputCls}>
                <option value="">Yok / En üst</option>
                {kullanicilar.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.ad_soyad}{k.pozisyon_adi ? ` (${k.pozisyon_adi})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Görev (eski sistem) */}
            <div>
              <label htmlFor="gorev" className="mb-1.5 block text-sm font-medium">Saha Görevi</label>
              <select id="gorev" name="gorev" value={form.gorev} onChange={handleChange} className={inputCls}>
                <option value="">Seçiniz...</option>
                {Object.entries(GOREV_TIPLERI).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Ekip */}
            <div>
              <label htmlFor="ekip_id" className="mb-1.5 block text-sm font-medium">Ekip</label>
              <select id="ekip_id" name="ekip_id" value={form.ekip_id} onChange={handleChange} className={inputCls}>
                <option value="">Seçiniz...</option>
                {ekipler.map((e) => (
                  <option key={e.ekip_id} value={e.ekip_id}>{e.ekip_adi}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* İletişim & Acil Durum */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            İletişim & Acil Durum
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Telegram ID */}
            <div>
              <label htmlFor="telegram_id" className="mb-1.5 block text-sm font-medium">Telegram ID</label>
              <input id="telegram_id" name="telegram_id" type="text" value={form.telegram_id} onChange={handleChange} placeholder="123456789" className={inputCls} />
            </div>

            {/* Telegram Kullanıcı Adı */}
            <div>
              <label htmlFor="telegram_kullanici_adi" className="mb-1.5 block text-sm font-medium">Telegram Kullanıcı Adı</label>
              <input id="telegram_kullanici_adi" name="telegram_kullanici_adi" type="text" value={form.telegram_kullanici_adi} onChange={handleChange} placeholder="ahmetyilmaz" className={inputCls} />
            </div>

            {/* Acil Durum Kişisi */}
            <div>
              <label htmlFor="acil_kisi" className="mb-1.5 block text-sm font-medium">Acil Durumda Aranacak Kişi</label>
              <input id="acil_kisi" name="acil_kisi" type="text" value={form.acil_kisi} onChange={handleChange} placeholder="Yakın adı" className={inputCls} />
            </div>

            {/* Acil Telefon */}
            <div>
              <label htmlFor="acil_telefon" className="mb-1.5 block text-sm font-medium">Acil Durum Telefonu</label>
              <input id="acil_telefon" name="acil_telefon" type="text" value={form.acil_telefon} onChange={handleChange} placeholder="0532 000 00 00" className={inputCls} />
            </div>

            {/* Adres - full width */}
            <div className="sm:col-span-2">
              <label htmlFor="adres" className="mb-1.5 block text-sm font-medium">Adres</label>
              <input id="adres" name="adres" type="text" value={form.adres} onChange={handleChange} placeholder="Ev adresi" className={inputCls} />
            </div>
          </div>
        </div>

        {/* Notlar */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div>
            <label htmlFor="notlar" className="mb-1.5 block text-sm font-medium">Notlar</label>
            <textarea
              id="notlar"
              name="notlar"
              value={form.notlar}
              onChange={handleChange}
              rows={3}
              placeholder="Personel hakkında ek notlar..."
              className={cn(inputCls, 'resize-none')}
            />
          </div>
        </div>

        {/* Hata Mesajı */}
        {(personelOlustur.isError || personelGuncelle.isError) && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3">
            <p className="text-sm text-red-700">
              İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.
            </p>
          </div>
        )}

        {/* Butonlar */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/personel')}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            İptal
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
