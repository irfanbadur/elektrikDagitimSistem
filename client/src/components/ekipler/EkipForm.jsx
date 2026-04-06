import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Loader2, UserPlus, X, Users } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useEkip, useEkipOlustur, useEkipGuncelle } from '@/hooks/useEkipler'
import { usePersonelListesi, usePersonelEkipAta } from '@/hooks/usePersonel'
import { useBolgeler } from '@/hooks/useBolgeler'
import { useIsTipleri } from '@/hooks/useIsTipleri'
import api from '@/api/client'
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
  varsayilan_is_tipi_id: '',
  arac_plaka: '',
  durum: 'aktif',
  notlar: '',
}

export default function EkipForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const duzenleModu = !!id

  const { data: ekip, isLoading: ekipLoading } = useEkip(id)
  const ekipOlustur = useEkipOlustur()
  const ekipGuncelle = useEkipGuncelle()
  const { data: personelListesi = [] } = usePersonelListesi()
  const { data: bolgeler } = useBolgeler()
  const { data: isTipleri } = useIsTipleri()
  const personelEkipAta = usePersonelEkipAta()
  const { data: departmanlarRaw } = useQuery({
    queryKey: ['departmanlar'],
    queryFn: () => api.get('/departmanlar'),
  })
  const { data: rollerRaw } = useQuery({
    queryKey: ['yonetim', 'roller'],
    queryFn: () => api.get('/yonetim/roller'),
  })
  const departmanlarAll = departmanlarRaw?.data || []
  const rollerAll = rollerRaw?.data || []

  // Ekip başı adayları: sadece Saha-Operasyon departmanındaki kullanıcılar
  const sahaDepId = departmanlarAll.find(d => d.departman_kodu === 'saha_operasyon')?.id
  const ekipBasiRolId = rollerAll.find(r => r.rol_kodu === 'ekip_basi')?.id
  const ekipBasiAdaylari = sahaDepId
    ? personelListesi.filter(p => Number(p.departman_id) === Number(sahaDepId))
    : personelListesi

  const [form, setForm] = useState(bosForm)
  const [hatalar, setHatalar] = useState({})
  const [personelEkleAcik, setPersonelEkleAcik] = useState(false)

  useEffect(() => {
    if (ekip) {
      setForm({
        ekip_adi: ekip.ekip_adi || '',
        ekip_kodu: ekip.ekip_kodu || '',
        ekip_basi_id: ekip.ekip_basi_id || '',
        varsayilan_bolge_id: ekip.varsayilan_bolge_id || '',
        varsayilan_is_tipi_id: ekip.varsayilan_is_tipi_id || '',
        arac_plaka: ekip.arac_plaka || '',
        durum: ekip.durum || 'aktif',
        notlar: ekip.notlar || '',
      })
    }
  }, [ekip])

  const handleChange = (e) => {
    const { name, value } = e.target

    // Ekip başı seçildiğinde rolü kontrol et
    if (name === 'ekip_basi_id' && value) {
      const secilen = personelListesi.find(p => p.id === Number(value))
      if (secilen && Number(secilen.rol_id) !== Number(ekipBasiRolId)) {
        const onay = confirm(
          `"${secilen.ad_soyad}" şu anda "${secilen.pozisyon_adi || 'atanmamış'}" rolünde.\n\nEkip Başı olarak atamak rolünü de "Ekip Başı" olarak değiştirecektir. Onaylıyor musunuz?`
        )
        if (!onay) return
        // Rolü Ekip Başı olarak güncelle
        if (ekipBasiRolId) {
          api.put(`/organizasyon/personel/${secilen.id}`, { rol_id: ekipBasiRolId })
        }
      }
    }

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

    if (!dogrula()) return

    const payload = {
      ...form,
      ekip_basi_id: form.ekip_basi_id || null,
      varsayilan_bolge_id: form.varsayilan_bolge_id || null,
      varsayilan_is_tipi_id: form.varsayilan_is_tipi_id || null,
    }

    const mutation = duzenleModu ? ekipGuncelle : ekipOlustur
    const mutationData = duzenleModu ? { id: ekip.id, ...payload } : payload

    mutation.mutateAsync(mutationData).then(() => navigate('/ekipler'))
  }

  const handlePersonelEkle = (personelId) => {
    personelEkipAta.mutate({ id: personelId, ekip_id: parseInt(id) })
    setPersonelEkleAcik(false)
  }

  const handlePersonelCikar = (personelId) => {
    personelEkipAta.mutate({ id: personelId, ekip_id: null })
  }

  const isSubmitting = ekipOlustur.isPending || ekipGuncelle.isPending

  // Ekipteki personeller
  const ekipPersonelleri = ekip?.personeller || []
  const ekipPersonelIds = ekipPersonelleri.map(p => p.id)

  // Atanabilir personeller (Saha-Operasyon departmanında, bu ekipte olmayan aktif personeller)
  const atanabilirPersoneller = personelListesi.filter(p =>
    !ekipPersonelIds.includes(p.id) && p.durum !== 'pasif' && p.departman_id === sahaDepId
  )

  if (duzenleModu && ekipLoading) {
    return <div className="py-8 text-center text-muted-foreground">Yukleniyor...</div>
  }

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
              ? `"${ekip?.ekip_adi}" ekibini duzenliyorsunuz.`
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
              Ekip Başı <span className="text-xs font-normal text-muted-foreground">(Saha-Operasyon)</span>
            </label>
            <select
              id="ekip_basi_id"
              name="ekip_basi_id"
              value={form.ekip_basi_id}
              onChange={handleChange}
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="">Seçiniz...</option>
              {ekipBasiAdaylari.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.ad_soyad}{p.pozisyon_adi ? ` — ${p.pozisyon_adi}` : ''}
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
                <option key={b.id} value={b.id}>
                  {b.bolge_adi}
                </option>
              ))}
            </select>
          </div>

          {/* Varsayilan Is Tipi */}
          <div>
            <label htmlFor="varsayilan_is_tipi_id" className="mb-1.5 block text-sm font-medium">
              Varsayilan Is Tipi
            </label>
            <select
              id="varsayilan_is_tipi_id"
              name="varsayilan_is_tipi_id"
              value={form.varsayilan_is_tipi_id}
              onChange={handleChange}
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="">Seciniz...</option>
              {isTipleri?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.ad} ({t.fazlar?.length || 0} faz)
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
              {ekipOlustur.error?.message || ekipGuncelle.error?.message || 'Islem sirasinda bir hata olustu.'}
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

      {/* Personel Yönetimi - sadece düzenleme modunda */}
      {duzenleModu && (
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Ekip Personeli</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {ekipPersonelleri.length}
              </span>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setPersonelEkleAcik(!personelEkleAcik)}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
              >
                <UserPlus className="h-4 w-4" />
                Personel Ekle
              </button>

              {/* Personel seçim dropdown */}
              {personelEkleAcik && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setPersonelEkleAcik(false)} />
                  <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-lg border border-border bg-white p-2 shadow-lg">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Personel Sec</span>
                      <button onClick={() => setPersonelEkleAcik(false)} className="rounded p-0.5 hover:bg-gray-100">
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                    {atanabilirPersoneller.length === 0 ? (
                      <p className="py-3 text-center text-xs text-muted-foreground">Eklenebilir personel yok</p>
                    ) : (
                      <div className="max-h-60 space-y-0.5 overflow-y-auto">
                        {atanabilirPersoneller.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handlePersonelEkle(p.id)}
                            disabled={personelEkipAta.isPending}
                            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-blue-50 disabled:opacity-50"
                          >
                            <span className="font-medium">{p.ad_soyad}</span>
                            <span className="text-xs text-muted-foreground">{p.pozisyon_adi || p.unvan || '-'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {ekipPersonelleri.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Bu ekipte henuz personel yok.</p>
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">Ad Soyad</th>
                    <th className="px-4 py-2 text-left font-medium">Gorev</th>
                    <th className="px-4 py-2 text-left font-medium">Telefon</th>
                    <th className="px-4 py-2 text-right font-medium">Islem</th>
                  </tr>
                </thead>
                <tbody>
                  {ekipPersonelleri.map(p => (
                    <tr key={p.id} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">{p.ad_soyad}</td>
                      <td className="px-4 py-2 text-muted-foreground">{p.pozisyon_adi || p.gorev || '-'}</td>
                      <td className="px-4 py-2 text-muted-foreground">{p.telefon || '-'}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handlePersonelCikar(p.id)}
                          disabled={personelEkipAta.isPending}
                          className="rounded-md p-1 text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          title="Ekipten cikar"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
