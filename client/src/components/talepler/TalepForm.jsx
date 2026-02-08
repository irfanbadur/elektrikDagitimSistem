import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, X } from 'lucide-react'
import { useTalep, useTalepOlustur, useTalepGuncelle } from '@/hooks/useTalepler'
import { useEkipler } from '@/hooks/useEkipler'
import { useProjeler } from '@/hooks/useProjeler'
import { TALEP_TIPLERI, ONCELIK_LABELS } from '@/utils/constants'

const bosForm = {
  talep_tipi: '',
  ekip_id: '',
  proje_id: '',
  aciklama: '',
  talep_detay: '',
  oncelik: 'normal',
}

export default function TalepForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const duzenlemeModu = Boolean(id)

  const { data: mevcutTalep, isLoading: talepYukleniyor } = useTalep(id, { enabled: duzenlemeModu })
  const { data: ekipler } = useEkipler()
  const { data: projeler } = useProjeler()

  const olustur = useTalepOlustur()
  const guncelle = useTalepGuncelle()

  const [form, setForm] = useState({ ...bosForm })
  const [hatalar, setHatalar] = useState({})

  useEffect(() => {
    if (mevcutTalep) {
      setForm({
        talep_tipi: mevcutTalep.talep_tipi || '',
        ekip_id: mevcutTalep.ekip_id || '',
        proje_id: mevcutTalep.proje_id || '',
        aciklama: mevcutTalep.aciklama || '',
        talep_detay: mevcutTalep.talep_detay || '',
        oncelik: mevcutTalep.oncelik || 'normal',
      })
    }
  }, [mevcutTalep])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    setHatalar(h => ({ ...h, [name]: '' }))
  }

  const dogrula = () => {
    const yeniHatalar = {}
    if (!form.talep_tipi) yeniHatalar.talep_tipi = 'Talep tipi seçimi zorunludur'
    if (!form.aciklama.trim()) yeniHatalar.aciklama = 'Açıklama zorunludur'
    setHatalar(yeniHatalar)
    return Object.keys(yeniHatalar).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!dogrula()) return

    try {
      if (duzenlemeModu) {
        await guncelle.mutateAsync({ id, ...form })
      } else {
        await olustur.mutateAsync(form)
      }
      navigate('/talepler')
    } catch {
      // Hata hook tarafından yönetilir
    }
  }

  const inputClass = 'rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full'

  if (duzenlemeModu && talepYukleniyor) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-10 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {duzenlemeModu ? 'Talep Düzenle' : 'Yeni Talep'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-border bg-card p-6">
        {/* Talep Tipi ve Öncelik */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Talep Tipi *</label>
            <select name="talep_tipi" value={form.talep_tipi} onChange={handleChange} className={inputClass}>
              <option value="">Tip seçin</option>
              {Object.entries(TALEP_TIPLERI).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {hatalar.talep_tipi && <p className="mt-1 text-xs text-red-500">{hatalar.talep_tipi}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Öncelik</label>
            <select name="oncelik" value={form.oncelik} onChange={handleChange} className={inputClass}>
              {Object.entries(ONCELIK_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Ekip ve Proje */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Ekip</label>
            <select name="ekip_id" value={form.ekip_id} onChange={handleChange} className={inputClass}>
              <option value="">Ekip seçin</option>
              {ekipler?.map(e => <option key={e.id} value={e.id}>{e.ekip_adi}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Proje</label>
            <select name="proje_id" value={form.proje_id} onChange={handleChange} className={inputClass}>
              <option value="">Proje seçin</option>
              {projeler?.map(p => <option key={p.id} value={p.id}>{p.proje_no} - {p.proje_adi}</option>)}
            </select>
          </div>
        </div>

        {/* Açıklama */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">Açıklama *</label>
          <textarea name="aciklama" value={form.aciklama} onChange={handleChange} rows={3} className={inputClass} placeholder="Talep açıklamanızı yazın..." />
          {hatalar.aciklama && <p className="mt-1 text-xs text-red-500">{hatalar.aciklama}</p>}
        </div>

        {/* Talep Detayı */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">Detaylı Açıklama</label>
          <textarea name="talep_detay" value={form.talep_detay} onChange={handleChange} rows={5} className={inputClass} placeholder="Talep ile ilgili detaylı bilgileri buraya yazabilirsiniz..." />
        </div>

        {/* Butonlar */}
        <div className="flex items-center gap-3 border-t border-border pt-4">
          <button type="submit" disabled={olustur.isPending || guncelle.isPending} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-blue-700 disabled:opacity-50">
            <Save className="h-4 w-4" />
            {olustur.isPending || guncelle.isPending ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
          <button type="button" onClick={() => navigate('/talepler')} className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
            <X className="h-4 w-4" /> İptal
          </button>
        </div>
      </form>
    </div>
  )
}
