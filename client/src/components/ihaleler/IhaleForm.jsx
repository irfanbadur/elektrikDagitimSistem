import { useState, useEffect } from 'react'
import { X, Save, Loader2 } from 'lucide-react'
import { useIsTipleri } from '@/hooks/useIsTipleri'
import { useIhaleOlustur, useIhaleGuncelle } from '@/hooks/useIhaleler'

const BOS = {
  ihale_adi: '',
  is_adi: '',
  sozlesme_no: '',
  il: '',
  ilce: '',
  yuklenici: '',
  sozlesme_bedeli: '',
  artirim_orani: 10,
  baslangic_tarihi: '',
  bitis_tarihi: '',
  durum: 'aktif',
  notlar: '',
  is_tipi_idleri: [],
  otomatik_proje_bagla: true,
}

export default function IhaleForm({ ihale, onClose }) {
  const { data: isTipleri } = useIsTipleri()
  const olustur = useIhaleOlustur()
  const guncelle = useIhaleGuncelle()
  const [form, setForm] = useState(BOS)

  useEffect(() => {
    if (ihale) {
      setForm({
        ihale_adi: ihale.ihale_adi || '',
        is_adi: ihale.is_adi || '',
        sozlesme_no: ihale.sozlesme_no || '',
        il: ihale.il || '',
        ilce: ihale.ilce || '',
        yuklenici: ihale.yuklenici || '',
        sozlesme_bedeli: ihale.sozlesme_bedeli || '',
        artirim_orani: ihale.artirim_orani ?? 10,
        baslangic_tarihi: (ihale.baslangic_tarihi || '').slice(0, 10),
        bitis_tarihi: (ihale.bitis_tarihi || '').slice(0, 10),
        durum: ihale.durum || 'aktif',
        notlar: ihale.notlar || '',
        is_tipi_idleri: (ihale.is_tipleri || []).map(t => t.id),
        otomatik_proje_bagla: false,
      })
    }
  }, [ihale])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const tipToggle = (id) => {
    setForm(f => ({
      ...f,
      is_tipi_idleri: f.is_tipi_idleri.includes(id)
        ? f.is_tipi_idleri.filter(x => x !== id)
        : [...f.is_tipi_idleri, id],
    }))
  }

  const kaydet = async (e) => {
    e.preventDefault()
    if (!form.ihale_adi.trim()) { alert('İhale adı zorunlu'); return }
    try {
      const payload = {
        ...form,
        sozlesme_bedeli: Number(form.sozlesme_bedeli) || 0,
        artirim_orani: Number(form.artirim_orani) || 0,
      }
      if (ihale) {
        delete payload.otomatik_proje_bagla
        await guncelle.mutateAsync({ id: ihale.id, ...payload })
      } else {
        await olustur.mutateAsync(payload)
      }
      onClose?.()
    } catch (err) {
      alert('Kaydedilemedi: ' + (err.message || ''))
    }
  }

  const yukleniyor = olustur.isPending || guncelle.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-lg font-semibold">{ihale ? 'İhale Düzenle' : 'Yeni İhale'}</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={kaydet} className="px-5 py-4 space-y-3 max-h-[80vh] overflow-y-auto" autoComplete="off">
          <div>
            <label className="mb-1 block text-sm font-medium">İhale Adı *</label>
            <input type="text" value={form.ihale_adi} onChange={e => set('ihale_adi', e.target.value)}
              className="w-full rounded border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Örn: SAMSUN BATI KET YAPI BAĞLANTI YAPIM İŞİ" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">İş Adı</label>
              <input type="text" value={form.is_adi} onChange={e => set('is_adi', e.target.value)}
                className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Sözleşme No</label>
              <input type="text" value={form.sozlesme_no} onChange={e => set('sozlesme_no', e.target.value)}
                className="w-full rounded border border-input bg-white px-3 py-2 text-sm" placeholder="Örn: SA2025/149" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">İl</label>
              <input type="text" value={form.il} onChange={e => set('il', e.target.value)}
                className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">İlçe</label>
              <input type="text" value={form.ilce} onChange={e => set('ilce', e.target.value)}
                className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Yüklenici</label>
            <input type="text" value={form.yuklenici} onChange={e => set('yuklenici', e.target.value)}
              className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Sözleşme Bedeli (₺)</label>
              <input type="number" step="0.01" value={form.sozlesme_bedeli} onChange={e => set('sozlesme_bedeli', e.target.value)}
                className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Artırım Oranı (%)</label>
              <input type="number" step="0.1" value={form.artirim_orani} onChange={e => set('artirim_orani', e.target.value)}
                className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Başlangıç</label>
              <input type="date" value={form.baslangic_tarihi} onChange={e => set('baslangic_tarihi', e.target.value)}
                className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Bitiş</label>
              <input type="date" value={form.bitis_tarihi} onChange={e => set('bitis_tarihi', e.target.value)}
                className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Durum</label>
            <select value={form.durum} onChange={e => set('durum', e.target.value)}
              className="w-full rounded border border-input bg-white px-3 py-2 text-sm">
              <option value="aktif">Aktif</option>
              <option value="tamamlandi">Tamamlandı</option>
              <option value="iptal">İptal</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">İş Tipleri (İhale Kapsamı)</label>
            <div className="flex flex-wrap gap-2">
              {(isTipleri || []).map(t => (
                <button key={t.id} type="button" onClick={() => tipToggle(t.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    form.is_tipi_idleri.includes(t.id)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-muted-foreground border-input hover:bg-muted'
                  }`}>
                  {t.kod}
                </button>
              ))}
            </div>
            {!ihale && form.is_tipi_idleri.length > 0 && (
              <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={form.otomatik_proje_bagla}
                  onChange={e => set('otomatik_proje_bagla', e.target.checked)} />
                Bu iş tipindeki ihalesiz projeleri otomatik bağla
              </label>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Notlar</label>
            <textarea value={form.notlar} onChange={e => set('notlar', e.target.value)} rows={2}
              className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="rounded border border-input px-4 py-2 text-sm hover:bg-muted">İptal</button>
            <button type="submit" disabled={yukleniyor}
              className="flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {yukleniyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
