import { useState } from 'react'
import { StickyNote, Plus, Edit, Trash2, X, Check } from 'lucide-react'
import { useProjeNotlari, useProjeNotOlustur, useProjeNotGuncelle, useProjeNotSil } from '@/hooks/useProjeDetay'
import { formatTarihSaat } from '@/utils/formatters'
import ConfirmDialog from '@/components/shared/ConfirmDialog'

export default function ProjeDetayNotlar({ projeId }) {
  const { data: notlar, isLoading } = useProjeNotlari(projeId)
  const olustur = useProjeNotOlustur()
  const guncelle = useProjeNotGuncelle()
  const sil = useProjeNotSil()

  const [formAcik, setFormAcik] = useState(false)
  const [duzenleId, setDuzenleId] = useState(null)
  const [baslik, setBaslik] = useState('')
  const [icerik, setIcerik] = useState('')
  const [silmeId, setSilmeId] = useState(null)

  const resetForm = () => {
    setFormAcik(false)
    setDuzenleId(null)
    setBaslik('')
    setIcerik('')
  }

  const handleKaydet = () => {
    if (!icerik.trim()) return
    if (duzenleId) {
      guncelle.mutate({ projeId, id: duzenleId, baslik, icerik }, { onSuccess: resetForm })
    } else {
      olustur.mutate({ projeId, baslik, icerik }, { onSuccess: resetForm })
    }
  }

  const handleDuzenle = (not) => {
    setDuzenleId(not.id)
    setBaslik(not.baslik || '')
    setIcerik(not.icerik)
    setFormAcik(true)
  }

  const handleSil = () => {
    if (!silmeId) return
    sil.mutate({ projeId, id: silmeId }, { onSuccess: () => setSilmeId(null) })
  }

  return (
    <div className="space-y-4">
      {/* Add / Edit form */}
      {formAcik ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 font-semibold">
            {duzenleId ? 'Notu Duzenle' : 'Yeni Not'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Baslik (opsiyonel)</label>
              <input
                type="text"
                value={baslik}
                onChange={(e) => setBaslik(e.target.value)}
                placeholder="Not basligi..."
                className="w-full rounded-md border border-input px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Icerik</label>
              <textarea
                value={icerik}
                onChange={(e) => setIcerik(e.target.value)}
                placeholder="Not icerigi..."
                rows={4}
                className="w-full rounded-md border border-input px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleKaydet}
                disabled={!icerik.trim() || olustur.isPending || guncelle.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {duzenleId ? 'Guncelle' : 'Kaydet'}
              </button>
              <button
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                <X className="h-4 w-4" />
                Iptal
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setFormAcik(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Yeni Not Ekle
        </button>
      )}

      {/* Notes list */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <StickyNote className="h-4 w-4" />
          Notlar
        </h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Yukleniyor...</p>
        ) : !notlar || notlar.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henuz not eklenmemis.</p>
        ) : (
          <div className="space-y-3">
            {notlar.map((not) => (
              <div key={not.id} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {not.baslik && <p className="font-medium">{not.baslik}</p>}
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{not.icerik}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {not.yazar} &middot; {formatTarihSaat(not.olusturma_tarihi)}
                      {not.guncelleme_tarihi !== not.olusturma_tarihi && (
                        <span> &middot; duzenlendi</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDuzenle(not)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Duzenle"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setSilmeId(not.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      title="Sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!silmeId}
        onClose={() => setSilmeId(null)}
        onConfirm={handleSil}
        title="Notu Sil"
        message="Bu notu silmek istediginize emin misiniz?"
        confirmText="Sil"
        cancelText="Iptal"
        variant="destructive"
      />
    </div>
  )
}
