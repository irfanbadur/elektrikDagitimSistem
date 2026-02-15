import { useState, useRef } from 'react'
import { FolderOpen, Upload, Trash2, Download, File } from 'lucide-react'
import { useProjeDosyalari, useProjeDosyaYukle, useProjeDosyaSil } from '@/hooks/useProjeDetay'
import { formatTarihSaat } from '@/utils/formatters'
import ConfirmDialog from '@/components/shared/ConfirmDialog'

const CAD_TIPI_RENKLERI = {
  dwg: 'text-red-600',
  dxf: 'text-red-500',
  dgn: 'text-blue-600',
  rvt: 'text-indigo-600',
  ifc: 'text-purple-500',
  pdf: 'text-red-500',
  kmz: 'text-green-600',
  kml: 'text-green-500',
  shp: 'text-teal-500',
  zip: 'text-yellow-600',
}

function formatDosyaBoyutu(bytes) {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function ProjeDetayProjeDosyalari({ projeId }) {
  const { data: dosyalar, isLoading } = useProjeDosyalari(projeId)
  const yukle = useProjeDosyaYukle()
  const sil = useProjeDosyaSil()
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
          Proje Dosyasi Yukle (CAD / Harita)
        </h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-sm text-muted-foreground">Dosya</label>
            <input
              ref={fileRef}
              type="file"
              accept=".dwg,.dxf,.dgn,.dwf,.rvt,.ifc,.pdf,.png,.jpg,.jpeg,.tif,.tiff,.kmz,.kml,.shp,.zip"
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
              placeholder="Dosya aciklamasi..."
              className="w-full rounded-md border border-input px-3 py-2 text-sm"
            />
          </div>
        </div>
        {yukle.isPending && <p className="mt-2 text-sm text-muted-foreground">Yukleniyor...</p>}
      </div>

      {/* File list */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <FolderOpen className="h-4 w-4" />
          Proje Dosyalari
        </h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Yukleniyor...</p>
        ) : !dosyalar || dosyalar.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henuz proje dosyasi eklenmemis.</p>
        ) : (
          <div className="space-y-2">
            {dosyalar.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div className="flex items-center gap-3">
                  <File className={`h-5 w-5 ${CAD_TIPI_RENKLERI[doc.dosya_tipi] || 'text-gray-400'}`} />
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
                    href={`/api/projeler/${projeId}/proje-dosyalari/${doc.id}/indir`}
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
        title="Dosyayi Sil"
        message="Bu dosyayi silmek istediginize emin misiniz?"
        confirmText="Sil"
        cancelText="Iptal"
        variant="destructive"
      />
    </div>
  )
}
