import { useState } from 'react'
import { X } from 'lucide-react'
import { useGorevTanimlari, useGorevAta } from '@/hooks/useOrganizasyon'
import { GOREV_KATEGORILERI } from '@/utils/constants'

export default function GorevAtaModal({ kullaniciId, acik, onKapat, projeler = [] }) {
  const { data: tanimlar } = useGorevTanimlari()
  const gorevAta = useGorevAta()

  const [form, setForm] = useState({
    gorev_tanim_id: '',
    proje_id: '',
    baslangic_tarihi: new Date().toISOString().split('T')[0],
    atama_notu: '',
  })

  if (!acik) return null

  const seciliGorev = tanimlar?.find((t) => t.id === parseInt(form.gorev_tanim_id))

  const handleGonder = (e) => {
    e.preventDefault()
    gorevAta.mutate(
      {
        kullanici_id: kullaniciId,
        gorev_tanim_id: parseInt(form.gorev_tanim_id),
        proje_id: form.proje_id ? parseInt(form.proje_id) : null,
        baslangic_tarihi: form.baslangic_tarihi,
        atama_notu: form.atama_notu || null,
      },
      {
        onSuccess: () => {
          setForm({ gorev_tanim_id: '', proje_id: '', baslangic_tarihi: new Date().toISOString().split('T')[0], atama_notu: '' })
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onKapat} />
      <div className="relative z-50 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <button onClick={onKapat} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>
        <h3 className="text-lg font-semibold mb-4">Görev Ata</h3>

        <form onSubmit={handleGonder} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Görev</label>
            <select
              value={form.gorev_tanim_id}
              onChange={(e) => setForm({ ...form, gorev_tanim_id: e.target.value })}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Görev seçin...</option>
              {Object.entries(gruplu).map(([kat, liste]) => (
                <optgroup key={kat} label={GOREV_KATEGORILERI[kat] || kat}>
                  {liste.map((t) => (
                    <option key={t.id} value={t.id}>{t.ad}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {seciliGorev?.zorunlu_proje === 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proje</label>
              <select
                value={form.proje_id}
                onChange={(e) => setForm({ ...form, proje_id: e.target.value })}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Proje seçin...</option>
                {projeler.map((p) => (
                  <option key={p.id} value={p.id}>{p.proje_no} - {p.musteri_adi}</option>
                ))}
              </select>
            </div>
          )}

          {!seciliGorev?.zorunlu_proje && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proje (opsiyonel)</label>
              <select
                value={form.proje_id}
                onChange={(e) => setForm({ ...form, proje_id: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Firma geneli</option>
                {projeler.map((p) => (
                  <option key={p.id} value={p.id}>{p.proje_no} - {p.musteri_adi}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç Tarihi</label>
            <input
              type="date"
              value={form.baslangic_tarihi}
              onChange={(e) => setForm({ ...form, baslangic_tarihi: e.target.value })}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Not (opsiyonel)</label>
            <textarea
              value={form.atama_notu}
              onChange={(e) => setForm({ ...form, atama_notu: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {gorevAta.error && (
            <p className="text-sm text-red-600">{gorevAta.error.message}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onKapat} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              İptal
            </button>
            <button
              type="submit"
              disabled={gorevAta.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {gorevAta.isPending ? 'Atanıyor...' : 'Görev Ata'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
