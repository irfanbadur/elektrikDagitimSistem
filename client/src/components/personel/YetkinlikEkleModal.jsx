import { useState } from 'react'
import { X } from 'lucide-react'
import { useYetkinlikTanimlari, useYetkinlikEkle } from '@/hooks/useOrganizasyon'
import { YETKINLIK_SEVIYELERI } from '@/utils/constants'

export default function YetkinlikEkleModal({ kullaniciId, acik, onKapat }) {
  const { data: tanimlar } = useYetkinlikTanimlari()
  const yetkinlikEkle = useYetkinlikEkle()

  const [form, setForm] = useState({
    yetkinlik_id: '',
    seviye: 'orta',
    notlar: '',
  })

  if (!acik) return null

  const handleGonder = (e) => {
    e.preventDefault()
    yetkinlikEkle.mutate(
      {
        kullanici_id: kullaniciId,
        yetkinlik_id: parseInt(form.yetkinlik_id),
        seviye: form.seviye,
        notlar: form.notlar || null,
      },
      {
        onSuccess: () => {
          setForm({ yetkinlik_id: '', seviye: 'orta', notlar: '' })
          onKapat()
        },
      }
    )
  }

  // Kategorilere göre grupla
  const gruplu = {}
  for (const t of tanimlar || []) {
    if (!gruplu[t.kategori]) gruplu[t.kategori] = []
    gruplu[t.kategori].push(t)
  }

  const KATEGORI_LABEL = { teknik: 'Teknik', idari: 'İdari', yazilim: 'Yazılım', diger: 'Diğer' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onKapat} />
      <div className="relative z-50 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <button onClick={onKapat} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>
        <h3 className="text-lg font-semibold mb-4">Yetkinlik Ekle</h3>

        <form onSubmit={handleGonder} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Yetkinlik</label>
            <select
              value={form.yetkinlik_id}
              onChange={(e) => setForm({ ...form, yetkinlik_id: e.target.value })}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Yetkinlik seçin...</option>
              {Object.entries(gruplu).map(([kat, liste]) => (
                <optgroup key={kat} label={KATEGORI_LABEL[kat] || kat}>
                  {liste.map((t) => (
                    <option key={t.id} value={t.id}>{t.ad}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seviye</label>
            <select
              value={form.seviye}
              onChange={(e) => setForm({ ...form, seviye: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {Object.entries(YETKINLIK_SEVIYELERI).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notlar (opsiyonel)</label>
            <textarea
              value={form.notlar}
              onChange={(e) => setForm({ ...form, notlar: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {yetkinlikEkle.error && (
            <p className="text-sm text-red-600">{yetkinlikEkle.error.message}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onKapat} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              İptal
            </button>
            <button
              type="submit"
              disabled={yetkinlikEkle.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {yetkinlikEkle.isPending ? 'Ekleniyor...' : 'Yetkinlik Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
