import { useState, useRef } from 'react'
import { FileText, Upload, Trash2, Download, File } from 'lucide-react'
import { useProjeDokumanlari, useProjeDokumanYukle, useProjeDokumanSil } from '@/hooks/useProjeDetay'
import { formatTarihSaat } from '@/utils/formatters'
import ConfirmDialog from '@/components/shared/ConfirmDialog'

const DOSYA_TIPI_IKONLARI = {
  pdf: 'text-red-500',
  doc: 'text-blue-500',
  docx: 'text-blue-500',
  xls: 'text-green-500',
  xlsx: 'text-green-500',
  ppt: 'text-orange-500',
  pptx: 'text-orange-500',
  txt: 'text-gray-500',
  csv: 'text-green-600',
}

function formatDosyaBoyutu(bytes) {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function ProjeDetayDokumanlar({ projeId }) {
  const { data: dokumanlar, isLoading } = useProjeDokumanlari(projeId)
  const yukle = useProjeDokumanYukle()
  const sil = useProjeDokumanSil()
  const fileRef = useRef(null)
  const [aciklama, setAciklama] = useState('')
  const [silmeId, setSilmeId] = useState(null)

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
          Dokuman Yukle
        </h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-sm text-muted-foreground">Dosya</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods"
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
              placeholder="Dokuman aciklamasi..."
              className="w-full rounded-md border border-input px-3 py-2 text-sm"
            />
          </div>
        </div>
        {yukle.isPending && <p className="mt-2 text-sm text-muted-foreground">Yukleniyor...</p>}
      </div>

      {/* Document list */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <FileText className="h-4 w-4" />
          Dokumanlar
        </h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Yukleniyor...</p>
        ) : !dokumanlar || dokumanlar.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henuz dokuman eklenmemis.</p>
        ) : (
          <div className="space-y-2">
            {dokumanlar.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div className="flex items-center gap-3">
                  <File className={`h-5 w-5 ${DOSYA_TIPI_IKONLARI[doc.dosya_tipi] || 'text-gray-400'}`} />
                  <div>
                    <p className="text-sm font-medium">{doc.orijinal_adi || doc.dosya_adi}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDosyaBoyutu(doc.dosya_boyutu)} &middot; {doc.dosya_tipi?.toUpperCase()} &middot; {formatTarihSaat(doc.olusturma_tarihi)}
                    </p>
                    {doc.aciklama && <p className="mt-0.5 text-xs text-muted-foreground">{doc.aciklama}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={`/api/projeler/${projeId}/dokumanlar/${doc.id}/indir`}
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Indir"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => setSilmeId(doc.id)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    title="Sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
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
        title="Dokumani Sil"
        message="Bu dokumani silmek istediginize emin misiniz?"
        confirmText="Sil"
        cancelText="Iptal"
        variant="destructive"
      />
    </div>
  )
}
