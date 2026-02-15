import { useState, useRef } from 'react'
import {
  Search, Plus, Edit, Trash2, X, Check, Camera, Upload, ChevronDown, ChevronUp,
} from 'lucide-react'
import {
  useProjeKesifler, useProjeKesifOlustur, useProjeKesifGuncelle,
  useProjeKesifSil, useProjeKesifFotoYukle,
} from '@/hooks/useProjeDetay'
import { formatTarih, formatTarihSaat, bugununTarihi } from '@/utils/formatters'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { cn } from '@/lib/utils'

function KesifForm({ varsayilan, onKaydet, onIptal, isPending }) {
  const [form, setForm] = useState({
    kesif_tarihi: varsayilan?.kesif_tarihi || bugununTarihi(),
    kesif_yapan: varsayilan?.kesif_yapan || '',
    bulgular: varsayilan?.bulgular || '',
    notlar: varsayilan?.notlar || '',
    konum_bilgisi: varsayilan?.konum_bilgisi || '',
    durum: varsayilan?.durum || 'taslak',
  })

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Kesif Tarihi</label>
          <input
            type="date"
            value={form.kesif_tarihi}
            onChange={(e) => setForm({ ...form, kesif_tarihi: e.target.value })}
            className="w-full rounded-md border border-input px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Kesif Yapan</label>
          <input
            type="text"
            value={form.kesif_yapan}
            onChange={(e) => setForm({ ...form, kesif_yapan: e.target.value })}
            placeholder="Kisi adi..."
            className="w-full rounded-md border border-input px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm text-muted-foreground">Bulgular</label>
        <textarea
          value={form.bulgular}
          onChange={(e) => setForm({ ...form, bulgular: e.target.value })}
          placeholder="Sahada tespit edilen bulgular..."
          rows={4}
          className="w-full rounded-md border border-input px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Konum Bilgisi</label>
          <input
            type="text"
            value={form.konum_bilgisi}
            onChange={(e) => setForm({ ...form, konum_bilgisi: e.target.value })}
            placeholder="Konum veya koordinat..."
            className="w-full rounded-md border border-input px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Durum</label>
          <select
            value={form.durum}
            onChange={(e) => setForm({ ...form, durum: e.target.value })}
            className="w-full rounded-md border border-input px-3 py-2 text-sm"
          >
            <option value="taslak">Taslak</option>
            <option value="tamamlandi">Tamamlandi</option>
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm text-muted-foreground">Notlar</label>
        <textarea
          value={form.notlar}
          onChange={(e) => setForm({ ...form, notlar: e.target.value })}
          placeholder="Ek notlar..."
          rows={2}
          className="w-full rounded-md border border-input px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onKaydet(form)}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          Kaydet
        </button>
        <button
          onClick={onIptal}
          className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <X className="h-4 w-4" />
          Iptal
        </button>
      </div>
    </div>
  )
}

function KesifKart({ kesif, projeId, onDuzenle, onSil }) {
  const [acik, setAcik] = useState(false)
  const [fotoYukleniyor, setFotoYukleniyor] = useState(false)
  const fileRef = useRef(null)
  const fotoYukle = useProjeKesifFotoYukle()

  const handleFotoYukle = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoYukleniyor(true)
    const formData = new FormData()
    formData.append('dosya', file)
    fotoYukle.mutate({ projeId, kesifId: kesif.id, formData }, {
      onSettled: () => {
        setFotoYukleniyor(false)
        if (fileRef.current) fileRef.current.value = ''
      },
    })
  }

  return (
    <div className="rounded-md border border-border">
      <div
        className="flex cursor-pointer items-center justify-between p-3 hover:bg-muted/50"
        onClick={() => setAcik(!acik)}
      >
        <div className="flex items-center gap-3">
          <span className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
            kesif.durum === 'tamamlandi' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
          )}>
            {kesif.durum === 'tamamlandi' ? 'Tamamlandi' : 'Taslak'}
          </span>
          <div>
            <p className="text-sm font-medium">{formatTarih(kesif.kesif_tarihi)}</p>
            <p className="text-xs text-muted-foreground">
              {kesif.kesif_yapan || 'Belirtilmemis'}
              {kesif.foto_sayisi > 0 && <span> &middot; {kesif.foto_sayisi} fotograf</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onDuzenle(kesif); }}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Duzenle"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSil(kesif.id); }}
            className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
            title="Sil"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {acik ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {acik && (
        <div className="border-t border-border p-3">
          {kesif.bulgular && (
            <div className="mb-3">
              <p className="text-xs font-medium text-muted-foreground">Bulgular</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{kesif.bulgular}</p>
            </div>
          )}
          {kesif.konum_bilgisi && (
            <div className="mb-3">
              <p className="text-xs font-medium text-muted-foreground">Konum</p>
              <p className="mt-0.5 text-sm">{kesif.konum_bilgisi}</p>
            </div>
          )}
          {kesif.notlar && (
            <div className="mb-3">
              <p className="text-xs font-medium text-muted-foreground">Notlar</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{kesif.notlar}</p>
            </div>
          )}
          <p className="mb-3 text-xs text-muted-foreground">
            Olusturulma: {formatTarihSaat(kesif.olusturma_tarihi)}
          </p>

          {/* Photo upload for this survey */}
          <div className="rounded-md border border-dashed border-border p-3">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Kesif Fotografi Ekle</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp"
              onChange={handleFotoYukle}
              className="mt-2 w-full rounded-md border border-input px-3 py-1.5 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary/10 file:px-2 file:py-0.5 file:text-xs file:font-medium file:text-primary"
            />
            {fotoYukleniyor && <p className="mt-1 text-xs text-muted-foreground">Yukleniyor...</p>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProjeDetayKesif({ projeId }) {
  const { data: kesifler, isLoading } = useProjeKesifler(projeId)
  const olustur = useProjeKesifOlustur()
  const guncelle = useProjeKesifGuncelle()
  const sil = useProjeKesifSil()

  const [formAcik, setFormAcik] = useState(false)
  const [duzenleKesif, setDuzenleKesif] = useState(null)
  const [silmeId, setSilmeId] = useState(null)

  const handleKaydet = (form) => {
    if (duzenleKesif) {
      guncelle.mutate({ projeId, id: duzenleKesif.id, ...form }, {
        onSuccess: () => { setFormAcik(false); setDuzenleKesif(null); },
      })
    } else {
      olustur.mutate({ projeId, ...form }, {
        onSuccess: () => setFormAcik(false),
      })
    }
  }

  const handleDuzenle = (kesif) => {
    setDuzenleKesif(kesif)
    setFormAcik(true)
  }

  const handleSil = () => {
    if (!silmeId) return
    sil.mutate({ projeId, id: silmeId }, { onSuccess: () => setSilmeId(null) })
  }

  return (
    <div className="space-y-4">
      {/* Form */}
      {formAcik ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 font-semibold">
            {duzenleKesif ? 'Kesfi Duzenle' : 'Yeni Kesif Kaydi'}
          </h3>
          <KesifForm
            varsayilan={duzenleKesif}
            onKaydet={handleKaydet}
            onIptal={() => { setFormAcik(false); setDuzenleKesif(null); }}
            isPending={olustur.isPending || guncelle.isPending}
          />
        </div>
      ) : (
        <button
          onClick={() => setFormAcik(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Yeni Kesif
        </button>
      )}

      {/* Survey list */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Search className="h-4 w-4" />
          Kesif Kayitlari
        </h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Yukleniyor...</p>
        ) : !kesifler || kesifler.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henuz kesif kaydi eklenmemis.</p>
        ) : (
          <div className="space-y-2">
            {kesifler.map((kesif) => (
              <KesifKart
                key={kesif.id}
                kesif={kesif}
                projeId={projeId}
                onDuzenle={handleDuzenle}
                onSil={(id) => setSilmeId(id)}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!silmeId}
        onClose={() => setSilmeId(null)}
        onConfirm={handleSil}
        title="Kesif Kaydini Sil"
        message="Bu kesif kaydini ve ait tum fotograflari silmek istediginize emin misiniz?"
        confirmText="Sil"
        cancelText="Iptal"
        variant="destructive"
      />
    </div>
  )
}
