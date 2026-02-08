import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, X } from 'lucide-react'
import { usePuantaj, usePuantajOlustur, usePuantajGuncelle } from '@/hooks/usePuantaj'
import { useEkipler } from '@/hooks/useEkipler'
import { useProjeler } from '@/hooks/useProjeler'
import { useBolgeler } from '@/hooks/useBolgeler'
import { IS_KATEGORILERI, HAVA_DURUMLARI } from '@/utils/constants'
import { bugununTarihi } from '@/utils/formatters'

const bosForm = {
  tarih: '',
  ekip_id: '',
  proje_id: '',
  bolge_id: '',
  kisi_sayisi: '',
  calisan_listesi: '',
  baslama_saati: '',
  bitis_saati: '',
  yapilan_is: '',
  is_kategorisi: '',
  hava_durumu: '',
  enerji_kesintisi: false,
  kesinti_detay: '',
  arac_km_baslangic: '',
  arac_km_bitis: '',
  notlar: '',
}

export default function PuantajForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const duzenlemeModu = Boolean(id)

  const { data: mevcutRapor, isLoading: raporYukleniyor } = usePuantaj(id, { enabled: duzenlemeModu })
  const { data: ekipler } = useEkipler()
  const { data: projeler } = useProjeler()
  const { data: bolgeler } = useBolgeler()

  const olustur = usePuantajOlustur()
  const guncelle = usePuantajGuncelle()

  const [form, setForm] = useState({ ...bosForm, tarih: bugununTarihi() })
  const [hatalar, setHatalar] = useState({})

  useEffect(() => {
    if (mevcutRapor) {
      setForm({
        tarih: mevcutRapor.tarih || '',
        ekip_id: mevcutRapor.ekip_id || '',
        proje_id: mevcutRapor.proje_id || '',
        bolge_id: mevcutRapor.bolge_id || '',
        kisi_sayisi: mevcutRapor.kisi_sayisi || '',
        calisan_listesi: mevcutRapor.calisan_listesi || '',
        baslama_saati: mevcutRapor.baslama_saati || '',
        bitis_saati: mevcutRapor.bitis_saati || '',
        yapilan_is: mevcutRapor.yapilan_is || '',
        is_kategorisi: mevcutRapor.is_kategorisi || '',
        hava_durumu: mevcutRapor.hava_durumu || '',
        enerji_kesintisi: mevcutRapor.enerji_kesintisi || false,
        kesinti_detay: mevcutRapor.kesinti_detay || '',
        arac_km_baslangic: mevcutRapor.arac_km_baslangic || '',
        arac_km_bitis: mevcutRapor.arac_km_bitis || '',
        notlar: mevcutRapor.notlar || '',
      })
    }
  }, [mevcutRapor])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
    setHatalar(h => ({ ...h, [name]: '' }))
  }

  const dogrula = () => {
    const yeniHatalar = {}
    if (!form.ekip_id) yeniHatalar.ekip_id = 'Ekip seçimi zorunludur'
    if (!form.yapilan_is.trim()) yeniHatalar.yapilan_is = 'Yapılan iş açıklaması zorunludur'
    if (!form.tarih) yeniHatalar.tarih = 'Tarih zorunludur'
    setHatalar(yeniHatalar)
    return Object.keys(yeniHatalar).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!dogrula()) return

    const veri = {
      ...form,
      kisi_sayisi: form.kisi_sayisi ? Number(form.kisi_sayisi) : null,
      arac_km_baslangic: form.arac_km_baslangic ? Number(form.arac_km_baslangic) : null,
      arac_km_bitis: form.arac_km_bitis ? Number(form.arac_km_bitis) : null,
    }

    try {
      if (duzenlemeModu) {
        await guncelle.mutateAsync({ id, ...veri })
      } else {
        await olustur.mutateAsync(veri)
      }
      navigate('/puantaj')
    } catch {
      // Hata hook tarafından yönetilir
    }
  }

  const inputClass = 'rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full'

  if (duzenlemeModu && raporYukleniyor) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-10 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {duzenlemeModu ? 'Rapor Düzenle' : 'Yeni Günlük Rapor'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-border bg-card p-6">
        {/* Tarih ve Ekip */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Tarih *</label>
            <input type="date" name="tarih" value={form.tarih} onChange={handleChange} className={inputClass} />
            {hatalar.tarih && <p className="mt-1 text-xs text-red-500">{hatalar.tarih}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Ekip *</label>
            <select name="ekip_id" value={form.ekip_id} onChange={handleChange} className={inputClass}>
              <option value="">Ekip seçin</option>
              {ekipler?.map(e => <option key={e.id} value={e.id}>{e.ekip_adi}</option>)}
            </select>
            {hatalar.ekip_id && <p className="mt-1 text-xs text-red-500">{hatalar.ekip_id}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Proje</label>
            <select name="proje_id" value={form.proje_id} onChange={handleChange} className={inputClass}>
              <option value="">Proje seçin</option>
              {projeler?.map(p => <option key={p.id} value={p.id}>{p.proje_no} - {p.proje_adi}</option>)}
            </select>
          </div>
        </div>

        {/* Bölge ve Kişi Sayısı */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Bölge</label>
            <select name="bolge_id" value={form.bolge_id} onChange={handleChange} className={inputClass}>
              <option value="">Bölge seçin</option>
              {bolgeler?.map(b => <option key={b.id} value={b.id}>{b.bolge_adi}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Kişi Sayısı</label>
            <input type="number" name="kisi_sayisi" value={form.kisi_sayisi} onChange={handleChange} min="1" className={inputClass} placeholder="Çalışan kişi sayısı" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">İş Kategorisi</label>
            <select name="is_kategorisi" value={form.is_kategorisi} onChange={handleChange} className={inputClass}>
              <option value="">Kategori seçin</option>
              {Object.entries(IS_KATEGORILERI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        {/* Çalışan Listesi */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">Çalışan Listesi</label>
          <textarea name="calisan_listesi" value={form.calisan_listesi} onChange={handleChange} rows={2} className={inputClass} placeholder="Virgül ile ayırarak isimleri girin (Ahmet Yılmaz, Mehmet Demir, ...)" />
        </div>

        {/* Saatler */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Başlama Saati</label>
            <input type="time" name="baslama_saati" value={form.baslama_saati} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Bitiş Saati</label>
            <input type="time" name="bitis_saati" value={form.bitis_saati} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Hava Durumu</label>
            <select name="hava_durumu" value={form.hava_durumu} onChange={handleChange} className={inputClass}>
              <option value="">Seçin</option>
              {Object.entries(HAVA_DURUMLARI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        {/* Yapılan İş */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">Yapılan İş *</label>
          <textarea name="yapilan_is" value={form.yapilan_is} onChange={handleChange} rows={4} className={inputClass} placeholder="Gün içinde yapılan işlerin detaylı açıklaması..." />
          {hatalar.yapilan_is && <p className="mt-1 text-xs text-red-500">{hatalar.yapilan_is}</p>}
        </div>

        {/* Enerji Kesintisi */}
        <div className="rounded-md border border-border p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="enerji_kesintisi" checked={form.enerji_kesintisi} onChange={handleChange} className="h-4 w-4 rounded border-gray-300" />
            Enerji Kesintisi Var
          </label>
          {form.enerji_kesintisi && (
            <div className="mt-3">
              <label className="mb-1.5 block text-sm font-medium">Kesinti Detayı</label>
              <input type="text" name="kesinti_detay" value={form.kesinti_detay} onChange={handleChange} className={inputClass} placeholder="Kesinti süresi ve etkilenen alanlar..." />
            </div>
          )}
        </div>

        {/* Araç KM */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Araç KM (Başlangıç)</label>
            <input type="number" name="arac_km_baslangic" value={form.arac_km_baslangic} onChange={handleChange} className={inputClass} placeholder="Başlangıç km" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Araç KM (Bitiş)</label>
            <input type="number" name="arac_km_bitis" value={form.arac_km_bitis} onChange={handleChange} className={inputClass} placeholder="Bitiş km" />
          </div>
        </div>

        {/* Notlar */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">Notlar</label>
          <textarea name="notlar" value={form.notlar} onChange={handleChange} rows={3} className={inputClass} placeholder="Ek notlar, özel durumlar..." />
        </div>

        {/* Butonlar */}
        <div className="flex items-center gap-3 border-t border-border pt-4">
          <button type="submit" disabled={olustur.isPending || guncelle.isPending} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-blue-700 disabled:opacity-50">
            <Save className="h-4 w-4" />
            {olustur.isPending || guncelle.isPending ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
          <button type="button" onClick={() => navigate('/puantaj')} className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
            <X className="h-4 w-4" /> İptal
          </button>
        </div>
      </form>
    </div>
  )
}
