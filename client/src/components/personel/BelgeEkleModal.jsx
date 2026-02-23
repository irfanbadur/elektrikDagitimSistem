import { useState } from 'react'
import { X } from 'lucide-react'
import { useBelgeTurleri, useBelgeEkle } from '@/hooks/useOrganizasyon'
import { BELGE_KATEGORILERI } from '@/utils/constants'

export default function BelgeEkleModal({ kullaniciId, acik, onKapat }) {
  const { data: turler } = useBelgeTurleri()
  const belgeEkle = useBelgeEkle()

  const [form, setForm] = useState({
    belge_turu_id: '',
    belge_no: '',
    veren_kurum: '',
    baslangic_tarihi: '',
    bitis_tarihi: '',
    notlar: '',
  })

  if (!acik) return null

  const seciliTur = turler?.find((t) => t.id === parseInt(form.belge_turu_id))

  const handleGonder = (e) => {
    e.preventDefault()
    belgeEkle.mutate(
      {
        kullanici_id: kullaniciId,
        belge_turu_id: parseInt(form.belge_turu_id),
        belge_tipi: seciliTur?.kod,
        belge_no: form.belge_no || null,
        veren_kurum: form.veren_kurum || null,
        baslangic_tarihi: form.baslangic_tarihi || null,
        bitis_tarihi: form.bitis_tarihi || null,
        notlar: form.notlar || null,
      },
      {
        onSuccess: () => {
          setForm({ belge_turu_id: '', belge_no: '', veren_kurum: '', baslangic_tarihi: '', bitis_tarihi: '', notlar: '' })
          onKapat()
        },
      }
    )
  }

  // Kategorilere göre grupla
  const gruplu = {}
  for (const t of turler || []) {
    if (!gruplu[t.kategori]) gruplu[t.kategori] = []
    gruplu[t.kategori].push(t)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onKapat} />
      <div className="relative z-50 w-full max-w-md rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <button onClick={onKapat} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>
        <h3 className="text-lg font-semibold mb-4">Belge Ekle</h3>

        <form onSubmit={handleGonder} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Belge Türü</label>
            <select
              value={form.belge_turu_id}
              onChange={(e) => setForm({ ...form, belge_turu_id: e.target.value })}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Belge türü seçin...</option>
              {Object.entries(gruplu).map(([kat, liste]) => (
                <optgroup key={kat} label={BELGE_KATEGORILERI[kat] || kat}>
                  {liste.map((t) => (
                    <option key={t.id} value={t.id}>{t.ad}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Belge No (opsiyonel)</label>
            <input
              type="text"
              value={form.belge_no}
              onChange={(e) => setForm({ ...form, belge_no: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Veren Kurum (opsiyonel)</label>
            <input
              type="text"
              value={form.veren_kurum}
              onChange={(e) => setForm({ ...form, veren_kurum: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç</label>
              <input
                type="date"
                value={form.baslangic_tarihi}
                onChange={(e) => setForm({ ...form, baslangic_tarihi: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş</label>
              <input
                type="date"
                value={form.bitis_tarihi}
                onChange={(e) => setForm({ ...form, bitis_tarihi: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
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

          {belgeEkle.error && (
            <p className="text-sm text-red-600">{belgeEkle.error.message}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onKapat} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              İptal
            </button>
            <button
              type="submit"
              disabled={belgeEkle.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {belgeEkle.isPending ? 'Ekleniyor...' : 'Belge Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
