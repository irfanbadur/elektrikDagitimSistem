import { useState } from 'react'
import { Save, Loader2, X } from 'lucide-react'
import { useDepoOlustur } from '@/hooks/useDepolar'

const bosForm = {
  depo_adi: '',
  depo_tipi: 'taseron',
  sorumlu: '',
  telefon: '',
  adres: '',
  notlar: '',
}

export default function DepoForm({ onKapat, onBasarili }) {
  const [form, setForm] = useState(bosForm)
  const depoOlustur = useDepoOlustur()

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.depo_adi.trim()) return
    try {
      await depoOlustur.mutateAsync(form)
      setForm(bosForm)
      onBasarili?.()
      onKapat?.()
    } catch {
      // Hata hook tarafindan yonetilir
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-input bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Yeni Taseron/Depo Ekle</h2>
        <button onClick={onKapat} className="rounded p-1 hover:bg-muted">
          <X className="h-5 w-5" />
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Depo/Taseron Adi <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="depo_adi"
              value={form.depo_adi}
              onChange={handleChange}
              required
              placeholder="orn: Taseron ABC"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Tip</label>
            <select
              name="depo_tipi"
              value={form.depo_tipi}
              onChange={handleChange}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="taseron">Taseron</option>
              <option value="saha_depo">Saha Depo</option>
              <option value="ana_depo">Ana Depo</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Sorumlu</label>
            <input
              type="text"
              name="sorumlu"
              value={form.sorumlu}
              onChange={handleChange}
              placeholder="Sorumlu kisi"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Telefon</label>
            <input
              type="text"
              name="telefon"
              value={form.telefon}
              onChange={handleChange}
              placeholder="0555 xxx xx xx"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">Adres</label>
            <input
              type="text"
              name="adres"
              value={form.adres}
              onChange={handleChange}
              placeholder="Depo/taseron adresi"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onKapat}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Iptal
          </button>
          <button
            type="submit"
            disabled={depoOlustur.isPending}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {depoOlustur.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Kaydet
          </button>
        </div>
      </form>
    </div>
  )
}
