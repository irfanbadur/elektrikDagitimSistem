import { useState, useRef } from 'react'
import { Camera, Upload, Trash2, X, Maximize2 } from 'lucide-react'
import { useProjeFotograflari, useProjeFotoYukle, useProjeFotoSil } from '@/hooks/useProjeDetay'
import { formatTarihSaat } from '@/utils/formatters'
import ConfirmDialog from '@/components/shared/ConfirmDialog'

function formatDosyaBoyutu(bytes) {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function ProjeDetayFotograflar({ projeId }) {
  const { data: fotograflar, isLoading } = useProjeFotograflari(projeId)
  const yukle = useProjeFotoYukle()
  const sil = useProjeFotoSil()
  const fileRef = useRef(null)
  const [aciklama, setAciklama] = useState('')
  const [silmeId, setSilmeId] = useState(null)
  const [buyukFoto, setBuyukFoto] = useState(null)

  const handleYukle = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('dosya', file)
    if (aciklama) formData.append('aciklama', aciklama)
    yukle.mutate({ projeId, formData }, {
      onSuccess: () => {
        setAciklama('')
        if (fileRef.current) fileRef.current.value = ''
      },
    })
  }

  const handleSil = () => {
    if (!silmeId) return
    sil.mutate({ projeId, id: silmeId }, {
      onSuccess: () => setSilmeId(null),
    })
  }

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Upload className="h-4 w-4" />
          Fotograf Yukle
        </h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-sm text-muted-foreground">Fotograf</label>
            <input
              ref={fileRef}
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
              onChange={handleYukle}
              className="w-full rounded-md border border-input px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm text-muted-foreground">Aciklama (opsiyonel)</label>
            <input
              type="text"
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              placeholder="Fotograf aciklamasi..."
              className="w-full rounded-md border border-input px-3 py-2 text-sm"
            />
          </div>
        </div>
        {yukle.isPending && <p className="mt-2 text-sm text-muted-foreground">Yukleniyor...</p>}
      </div>

      {/* Photo grid */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Camera className="h-4 w-4" />
          Fotograflar
        </h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Yukleniyor...</p>
        ) : !fotograflar || fotograflar.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henuz fotograf eklenmemis.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {fotograflar.map((foto) => (
              <div key={foto.id} className="group relative overflow-hidden rounded-lg border border-border">
                <img
                  src={`/api/medya/${foto.id}/dosya`}
                  alt={foto.aciklama || foto.orijinal_adi}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex w-full items-center justify-between p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-white">{foto.orijinal_adi}</p>
                      <p className="text-xs text-white/70">{formatDosyaBoyutu(foto.dosya_boyutu)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setBuyukFoto(foto)}
                        className="rounded p-1 text-white/80 hover:text-white"
                        title="Buyut"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setSilmeId(foto.id)}
                        className="rounded p-1 text-white/80 hover:text-red-400"
                        title="Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {buyukFoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setBuyukFoto(null)}>
          <button
            onClick={() => setBuyukFoto(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={`/api/medya/${buyukFoto.id}/dosya`}
            alt={buyukFoto.aciklama || buyukFoto.orijinal_adi}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-2 text-center text-white">
            <p className="text-sm font-medium">{buyukFoto.orijinal_adi}</p>
            {buyukFoto.aciklama && <p className="text-xs text-white/70">{buyukFoto.aciklama}</p>}
            <p className="text-xs text-white/70">{formatTarihSaat(buyukFoto.yukleme_tarihi)}</p>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!silmeId}
        onClose={() => setSilmeId(null)}
        onConfirm={handleSil}
        title="Fotografi Sil"
        message="Bu fotografi silmek istediginize emin misiniz?"
        confirmText="Sil"
        cancelText="Iptal"
        variant="destructive"
      />
    </div>
  )
}
