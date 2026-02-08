import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, ArrowLeft, Loader2 } from 'lucide-react'
import {
  useMalzeme,
  useMalzemeOlustur,
  useMalzemeGuncelle,
} from '@/hooks/useMalzeme'
import { MALZEME_KATEGORILERI } from '@/utils/constants'

const BIRIMLER = [
  { value: 'metre', label: 'Metre' },
  { value: 'adet', label: 'Adet' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'takim', label: 'Takim' },
  { value: 'kutu', label: 'Kutu' },
  { value: 'top', label: 'Top' },
]

const bosForm = {
  malzeme_kodu: '',
  malzeme_adi: '',
  kategori: '',
  birim: 'adet',
  stok_miktari: '',
  kritik_seviye: '',
  birim_fiyat: '',
  depo_konumu: '',
  notlar: '',
}

export default function MalzemeForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const duzenlemeModu = Boolean(id)

  const { data: mevcutMalzeme, isLoading: yukleniyor } = useMalzeme(id, {
    enabled: duzenlemeModu,
  })
  const malzemeOlustur = useMalzemeOlustur()
  const malzemeGuncelle = useMalzemeGuncelle()

  const [form, setForm] = useState(bosForm)
  const [hatalar, setHatalar] = useState({})

  useEffect(() => {
    if (mevcutMalzeme) {
      setForm({
        malzeme_kodu: mevcutMalzeme.malzeme_kodu || '',
        malzeme_adi: mevcutMalzeme.malzeme_adi || '',
        kategori: mevcutMalzeme.kategori || '',
        birim: mevcutMalzeme.birim || 'adet',
        stok_miktari: mevcutMalzeme.stok_miktari ?? '',
        kritik_seviye: mevcutMalzeme.kritik_seviye ?? '',
        birim_fiyat: mevcutMalzeme.birim_fiyat ?? '',
        depo_konumu: mevcutMalzeme.depo_konumu || '',
        notlar: mevcutMalzeme.notlar || '',
      })
    }
  }, [mevcutMalzeme])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (hatalar[name]) {
      setHatalar((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const dogrula = () => {
    const yeniHatalar = {}
    if (!form.malzeme_adi.trim()) {
      yeniHatalar.malzeme_adi = 'Malzeme adi zorunludur'
    }
    if (!form.malzeme_kodu.trim()) {
      yeniHatalar.malzeme_kodu = 'Malzeme kodu zorunludur'
    }
    if (!form.kategori) {
      yeniHatalar.kategori = 'Kategori secimi zorunludur'
    }
    setHatalar(yeniHatalar)
    return Object.keys(yeniHatalar).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!dogrula()) return

    const veri = {
      ...form,
      stok_miktari: form.stok_miktari !== '' ? Number(form.stok_miktari) : 0,
      kritik_seviye: form.kritik_seviye !== '' ? Number(form.kritik_seviye) : 0,
      birim_fiyat: form.birim_fiyat !== '' ? Number(form.birim_fiyat) : 0,
    }

    try {
      if (duzenlemeModu) {
        await malzemeGuncelle.mutateAsync({ id: Number(id), ...veri })
      } else {
        await malzemeOlustur.mutateAsync(veri)
      }
      navigate('/malzeme')
    } catch {
      // Hata hook tarafindan yonetilir
    }
  }

  const kaydediliyor = malzemeOlustur.isPending || malzemeGuncelle.isPending

  if (duzenlemeModu && yukleniyor) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-96 w-full rounded" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => navigate('/malzeme')}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Malzeme Listesine Don
        </button>
        <h1 className="text-2xl font-bold">
          {duzenlemeModu ? 'Malzeme Duzenle' : 'Yeni Malzeme'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {duzenlemeModu
            ? 'Malzeme bilgilerini guncelleyin'
            : 'Yeni malzeme kaydı olusturun'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-input bg-card p-6 shadow-sm">
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Malzeme Kodu */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Malzeme Kodu <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="malzeme_kodu"
              value={form.malzeme_kodu}
              onChange={handleChange}
              placeholder="orn: KBL-001"
              className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
                hatalar.malzeme_kodu ? 'border-red-500' : 'border-input'
              } bg-background`}
            />
            {hatalar.malzeme_kodu && (
              <p className="mt-1 text-xs text-red-500">{hatalar.malzeme_kodu}</p>
            )}
          </div>

          {/* Malzeme Adi */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Malzeme Adi <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="malzeme_adi"
              value={form.malzeme_adi}
              onChange={handleChange}
              placeholder="Malzeme adini girin"
              className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
                hatalar.malzeme_adi ? 'border-red-500' : 'border-input'
              } bg-background`}
            />
            {hatalar.malzeme_adi && (
              <p className="mt-1 text-xs text-red-500">{hatalar.malzeme_adi}</p>
            )}
          </div>

          {/* Kategori */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Kategori <span className="text-red-500">*</span>
            </label>
            <select
              name="kategori"
              value={form.kategori}
              onChange={handleChange}
              className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
                hatalar.kategori ? 'border-red-500' : 'border-input'
              } bg-background`}
            >
              <option value="">Kategori secin</option>
              {Object.entries(MALZEME_KATEGORILERI).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            {hatalar.kategori && (
              <p className="mt-1 text-xs text-red-500">{hatalar.kategori}</p>
            )}
          </div>

          {/* Birim */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Birim</label>
            <select
              name="birim"
              value={form.birim}
              onChange={handleChange}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {BIRIMLER.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          {/* Stok Miktari */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Stok Miktari
            </label>
            <input
              type="number"
              name="stok_miktari"
              value={form.stok_miktari}
              onChange={handleChange}
              min="0"
              step="0.01"
              placeholder="0"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Kritik Seviye */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Kritik Seviye
            </label>
            <input
              type="number"
              name="kritik_seviye"
              value={form.kritik_seviye}
              onChange={handleChange}
              min="0"
              step="0.01"
              placeholder="0"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Stok bu seviyenin altina dustugunde uyari verilir
            </p>
          </div>

          {/* Birim Fiyat */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Birim Fiyat (TL)
            </label>
            <input
              type="number"
              name="birim_fiyat"
              value={form.birim_fiyat}
              onChange={handleChange}
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Depo Konumu */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Depo Konumu
            </label>
            <input
              type="text"
              name="depo_konumu"
              value={form.depo_konumu}
              onChange={handleChange}
              placeholder="orn: A-3-Raf-2"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Notlar */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">Notlar</label>
            <textarea
              name="notlar"
              value={form.notlar}
              onChange={handleChange}
              rows={4}
              placeholder="Ek aciklama veya not..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-input pt-4">
          <button
            type="button"
            onClick={() => navigate('/malzeme')}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Iptal
          </button>
          <button
            type="submit"
            disabled={kaydediliyor}
            className="flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {kaydediliyor ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {duzenlemeModu ? 'Guncelle' : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  )
}
