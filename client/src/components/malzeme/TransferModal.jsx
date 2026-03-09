import { useState } from 'react'
import { ArrowRightLeft, Loader2, X } from 'lucide-react'
import { useMalzemeHareketOlustur } from '@/hooks/useMalzeme'

export default function TransferModal({ depolar, kaynakDepoId, malzeme, onKapat }) {
  const [form, setForm] = useState({
    hedef_depo_id: '',
    miktar: '',
    teslim_eden: '',
    teslim_alan: '',
    belge_no: '',
    notlar: '',
  })

  const hareketOlustur = useMalzemeHareketOlustur()

  const hedefDepolar = depolar?.filter((d) => d.id !== kaynakDepoId) || []

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.hedef_depo_id || !form.miktar) return
    try {
      await hareketOlustur.mutateAsync({
        malzeme_id: malzeme.malzeme_id,
        miktar: Number(form.miktar),
        hareket_tipi: 'transfer',
        kaynak_depo_id: kaynakDepoId,
        hedef_depo_id: Number(form.hedef_depo_id),
        teslim_eden: form.teslim_eden,
        teslim_alan: form.teslim_alan,
        belge_no: form.belge_no,
        notlar: form.notlar,
      })
      onKapat()
    } catch {
      // Hata hook tarafindan yonetilir
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border border-input bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold">Malzeme Transferi</h2>
          </div>
          <button onClick={onKapat} className="rounded p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 rounded-md bg-muted/50 p-3">
          <p className="text-sm font-medium">{malzeme.malzeme_adi}</p>
          <p className="text-xs text-muted-foreground">
            Mevcut stok: {malzeme.mevcut_miktar}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Hedef Depo/Taseron <span className="text-red-500">*</span>
            </label>
            <select
              value={form.hedef_depo_id}
              onChange={(e) =>
                setForm((p) => ({ ...p, hedef_depo_id: e.target.value }))
              }
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Hedef secin</option>
              {hedefDepolar.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.depo_adi}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Miktar <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={form.miktar}
              onChange={(e) =>
                setForm((p) => ({ ...p, miktar: e.target.value }))
              }
              required
              min="0.01"
              max={malzeme.mevcut_miktar}
              step="0.01"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Teslim Eden</label>
              <input
                type="text"
                value={form.teslim_eden}
                onChange={(e) =>
                  setForm((p) => ({ ...p, teslim_eden: e.target.value }))
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Teslim Alan</label>
              <input
                type="text"
                value={form.teslim_alan}
                onChange={(e) =>
                  setForm((p) => ({ ...p, teslim_alan: e.target.value }))
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Belge No</label>
            <input
              type="text"
              value={form.belge_no}
              onChange={(e) =>
                setForm((p) => ({ ...p, belge_no: e.target.value }))
              }
              placeholder="Irsaliye / zimmet no"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Notlar</label>
            <textarea
              value={form.notlar}
              onChange={(e) =>
                setForm((p) => ({ ...p, notlar: e.target.value }))
              }
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onKapat}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Iptal
            </button>
            <button
              type="submit"
              disabled={hareketOlustur.isPending}
              className="flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {hareketOlustur.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRightLeft className="h-4 w-4" />
              )}
              Transfer Et
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
