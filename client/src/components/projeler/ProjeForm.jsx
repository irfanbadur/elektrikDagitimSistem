import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowLeftRight, Save, X, Sparkles } from 'lucide-react'
import { useProje, useProjeOlustur, useProjeGuncelle } from '@/hooks/useProjeler'
import api from '@/api/client'
import { useBolgeler } from '@/hooks/useBolgeler'
import { useEkipler } from '@/hooks/useEkipler'
import { useIsTipleri } from '@/hooks/useIsTipleri'
import { usePersonelListesi } from '@/hooks/usePersonel'
import { PROJE_DURUMLARI, ONCELIK_LABELS } from '@/utils/constants'
import { CardSkeleton } from '@/components/shared/LoadingSkeleton'
import YerTeslimModal from './YerTeslimModal'
import { cn } from '@/lib/utils'

const BOS_FORM = {
  proje_no: '',
  proje_tipi: '',
  musteri_adi: '',
  bolge_id: '',
  mahalle: '',
  adres: '',
  durum: 'teslim_alindi',
  oncelik: 'normal',
  ekip_id: '',
  tahmini_sure_gun: '',
  baslama_tarihi: '',
  bitis_tarihi: '',
  teslim_tarihi: '',
  tamamlanma_yuzdesi: 0,
  notlar: '',
  teslim_eden: '',
  teslim_alan_id: '',
}

export default function ProjeForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const duzenleModu = Boolean(id)

  const { data: proje, isLoading: projeYukleniyor } = useProje(id)
  const { data: bolgeler } = useBolgeler()
  const { data: ekipler } = useEkipler()
  const { data: isTipleri } = useIsTipleri()
  const { data: personelRes } = usePersonelListesi()
  const personeller = personelRes?.data || personelRes || []
  const projeOlustur = useProjeOlustur()
  const projeGuncelle = useProjeGuncelle()

  const [form, setForm] = useState(BOS_FORM)
  const [hatalar, setHatalar] = useState({})
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [genelHata, setGenelHata] = useState('')
  const [yerTeslimAcik, setYerTeslimAcik] = useState(false)
  const [demontajListesi, setDemontajListesi] = useState([])
  const [yerTeslimDosya, setYerTeslimDosya] = useState(null)
  const [yerTeslimEkBilgi, setYerTeslimEkBilgi] = useState(null)

  // Proje tipine göre eşleşen iş tipi fazları
  const eslesmisIsTipi = useMemo(() => {
    if (!isTipleri || !form.proje_tipi) return null
    return isTipleri.find(
      (t) => t.kod.toUpperCase() === form.proje_tipi.toUpperCase()
    ) || null
  }, [isTipleri, form.proje_tipi])

  // Proje tipi değiştiğinde durum'u ilk faz kodu yap (sadece yeni proje modunda)
  useEffect(() => {
    if (!duzenleModu && eslesmisIsTipi && eslesmisIsTipi.fazlar.length > 0) {
      setForm((prev) => ({ ...prev, durum: eslesmisIsTipi.fazlar[0].faz_kodu }))
    }
  }, [eslesmisIsTipi, duzenleModu])

  // Load existing project data for edit mode
  useEffect(() => {
    if (duzenleModu && proje) {
      setForm({
        proje_no: proje.proje_no || '',
        proje_tipi: proje.proje_tipi || '',
        musteri_adi: proje.musteri_adi || '',
        bolge_id: proje.bolge_id || '',
        mahalle: proje.mahalle || '',
        adres: proje.adres || '',
        durum: proje.durum || 'teslim_alindi',
        oncelik: proje.oncelik || 'normal',
        ekip_id: proje.ekip_id || '',
        tahmini_sure_gun: proje.tahmini_sure_gun || '',
        baslama_tarihi: proje.baslama_tarihi ? proje.baslama_tarihi.slice(0, 10) : '',
        bitis_tarihi: proje.bitis_tarihi ? proje.bitis_tarihi.slice(0, 10) : '',
        teslim_tarihi: proje.teslim_tarihi ? proje.teslim_tarihi.slice(0, 10) : '',
        tamamlanma_yuzdesi: proje.tamamlanma_yuzdesi || 0,
        notlar: proje.notlar || '',
        teslim_eden: proje.teslim_eden || '',
        teslim_alan_id: proje.teslim_alan_id || '',
      })
    }
  }, [duzenleModu, proje])

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    // Clear error when field is edited
    if (hatalar[key]) {
      setHatalar((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  // Personel listesinde isim ara (fuzzy)
  const findPersonByName = (name) => {
    if (!name || !Array.isArray(personeller) || personeller.length === 0) return null
    const normalized = name.toLowerCase().trim()
    if (!normalized) return null
    let match = personeller.find(p => p.ad_soyad?.toLowerCase().trim() === normalized)
    if (match) return match
    match = personeller.find(p => {
      const pName = p.ad_soyad?.toLowerCase().trim()
      return pName && (pName.includes(normalized) || normalized.includes(pName))
    })
    return match
  }

  const handleTeslimSwap = () => {
    const currentAlanId = form.teslim_alan_id
    const alanPerson = personeller.find(p => String(p.id) === String(currentAlanId))
    const alanName = alanPerson?.ad_soyad || ''
    const edenPerson = findPersonByName(form.teslim_eden)
    setForm(prev => ({
      ...prev,
      teslim_eden: alanName,
      teslim_alan_id: edenPerson ? edenPerson.id : '',
    }))
  }

  const validate = () => {
    const yeniHatalar = {}
    if (!form.proje_no.trim()) {
      yeniHatalar.proje_no = 'Proje numarasi zorunludur.'
    }
    if (!form.proje_tipi) {
      yeniHatalar.proje_tipi = 'Proje tipi secilmelidir.'
    }
    setHatalar(yeniHatalar)
    return Object.keys(yeniHatalar).length === 0
  }

  const handleYerTeslimSonuc = (sonuc) => {
    setYerTeslimAcik(false)
    const { _dosya, ...data } = sonuc
    setYerTeslimDosya(_dosya || null)
    setDemontajListesi(data.demontaj_listesi || [])
    setYerTeslimEkBilgi({
      yer_teslim_yapan: data.yer_teslim_yapan,
      yer_teslim_alan: data.yer_teslim_alan,
      ek_bilgiler: data.ek_bilgiler,
    })

    // Teslim eden/alan otomatik tespit: personel listesinde olan = teslim alan
    const yapanAd = data.yer_teslim_yapan?.ad_soyad || ''
    const alanAd = data.yer_teslim_alan?.ad_soyad || ''
    const alanPersonel = findPersonByName(alanAd)
    const yapanPersonel = findPersonByName(yapanAd)
    let teslimEden = ''
    let teslimAlanId = ''
    if (alanPersonel) {
      teslimAlanId = alanPersonel.id
      teslimEden = yapanAd
    } else if (yapanPersonel) {
      // Form ters doldurulmuş: yapan aslında bizim personelimiz
      teslimAlanId = yapanPersonel.id
      teslimEden = alanAd
    } else {
      teslimEden = yapanAd
    }

    // Form alanlarını doldur
    setForm((prev) => ({
      ...prev,
      proje_tipi: data.proje_tipi || prev.proje_tipi,
      musteri_adi: data.proje_adi || data.musteri_adi || prev.musteri_adi,
      mahalle: data.mahalle || prev.mahalle,
      adres: data.adres || prev.adres,
      oncelik: data.oncelik || prev.oncelik,
      baslama_tarihi: data.baslama_tarihi || prev.baslama_tarihi,
      bitis_tarihi: data.bitis_tarihi || prev.bitis_tarihi,
      teslim_tarihi: data.teslim_tarihi || prev.teslim_tarihi,
      notlar: [prev.notlar, data.notlar].filter(Boolean).join('\n') || '',
      teslim_eden: teslimEden || prev.teslim_eden,
      teslim_alan_id: teslimAlanId || prev.teslim_alan_id,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setGonderiliyor(true)
    setGenelHata('')

    const payload = {
      ...form,
      bolge_id: form.bolge_id || null,
      ekip_id: form.ekip_id || null,
      tahmini_sure_gun: form.tahmini_sure_gun ? Number(form.tahmini_sure_gun) : null,
      tamamlanma_yuzdesi: Number(form.tamamlanma_yuzdesi),
      baslama_tarihi: form.baslama_tarihi || null,
      bitis_tarihi: form.bitis_tarihi || null,
      teslim_tarihi: form.teslim_tarihi || null,
      teslim_eden: form.teslim_eden || null,
      teslim_alan_id: form.teslim_alan_id || null,
    }

    try {
      if (duzenleModu) {
        await projeGuncelle.mutateAsync({ id, ...payload })
        navigate(`/projeler/${id}`)
      } else {
        const res = await projeOlustur.mutateAsync(payload)
        const yeniProjeId = res?.data?.id

        if (yeniProjeId) {
          // Demontaj listesi varsa kaydet
          if (demontajListesi.length > 0) {
            try {
              await api.post(`/proje-demontaj/${yeniProjeId}/toplu`, { kalemler: demontajListesi })
            } catch (err) {
              console.error('Demontaj kaydetme hatasi:', err)
            }
          }

          // Yer teslim dosyasını kroki adımına kaydet
          if (yerTeslimDosya) {
            try {
              // Projenin ilk adımını (kroki) bul
              const fazRes = await api.get(`/dongu/proje/${yeniProjeId}/faz`)
              const fazlar = fazRes?.data
              const ilkAdim = fazlar?.[0]?.adimlar?.[0]
              if (ilkAdim) {
                const formData = new FormData()
                formData.append('dosya', yerTeslimDosya)
                formData.append('proje_adim_id', ilkAdim.id)
                formData.append('alan', 'proje')
                formData.append('alt_alan', 'kroki')
                formData.append('iliskili_kaynak_tipi', 'proje')
                formData.append('iliskili_kaynak_id', yeniProjeId)
                await fetch('/api/dosya/yukle', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                  body: formData
                })
              }
            } catch (err) {
              console.error('Dosya yukleme hatasi:', err)
            }
          }

          // Yer teslim bilgilerini not olarak kaydet
          if (yerTeslimEkBilgi) {
            try {
              const notParts = []
              if (yerTeslimEkBilgi.yer_teslim_yapan?.ad_soyad)
                notParts.push(`Yer Teslim Yapan: ${yerTeslimEkBilgi.yer_teslim_yapan.ad_soyad}${yerTeslimEkBilgi.yer_teslim_yapan.unvan ? ` (${yerTeslimEkBilgi.yer_teslim_yapan.unvan})` : ''}`)
              if (yerTeslimEkBilgi.yer_teslim_alan?.ad_soyad)
                notParts.push(`Yer Teslim Alan: ${yerTeslimEkBilgi.yer_teslim_alan.ad_soyad}${yerTeslimEkBilgi.yer_teslim_alan.unvan ? ` (${yerTeslimEkBilgi.yer_teslim_alan.unvan})` : ''}`)
              if (yerTeslimEkBilgi.ek_bilgiler)
                notParts.push(yerTeslimEkBilgi.ek_bilgiler)
              if (notParts.length > 0) {
                await api.post(`/projeler/${yeniProjeId}/notlar`, { icerik: notParts.join('\n') }).catch(() => {})
              }
            } catch (err) {
              console.error('Not kaydetme hatasi:', err)
            }
          }

          navigate(`/projeler/${yeniProjeId}`)
        } else {
          navigate('/projeler')
        }
      }
    } catch (err) {
      setGenelHata(err.message || 'Kaydetme sirasinda bir hata olustu.')
    } finally {
      setGonderiliyor(false)
    }
  }

  if (duzenleModu && projeYukleniyor) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <div className="skeleton h-6 w-32" />
        </div>
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">
          {duzenleModu ? 'Proje Duzenle' : 'Yeni Proje'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Temel Bilgiler */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Temel Bilgiler</h2>
            {!duzenleModu && (
              <button
                type="button"
                onClick={() => setYerTeslimAcik(true)}
                className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Yer Teslim Krokisi
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Proje No */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Proje No <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.proje_no}
                onChange={(e) => handleChange('proje_no', e.target.value)}
                className={cn(
                  'w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30',
                  hatalar.proje_no ? 'border-red-400' : 'border-input'
                )}
                placeholder="Orn: YB-2024-001"
              />
              {hatalar.proje_no && (
                <p className="mt-1 text-xs text-red-500">{hatalar.proje_no}</p>
              )}
            </div>

            {/* Proje Tipi */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Proje Tipi <span className="text-red-500">*</span>
              </label>
              <select
                value={form.proje_tipi}
                onChange={(e) => handleChange('proje_tipi', e.target.value)}
                className={cn(
                  'w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30',
                  hatalar.proje_tipi ? 'border-red-400' : 'border-input'
                )}
              >
                <option value="">Seciniz</option>
                {isTipleri?.map((t) => (
                  <option key={t.id} value={t.kod}>{t.ad} ({t.kod})</option>
                ))}
                {(!isTipleri || isTipleri.length === 0) && (
                  <>
                    <option value="YB">YB</option>
                    <option value="KET">KET</option>
                    <option value="Tesis">Tesis</option>
                  </>
                )}
              </select>
              {hatalar.proje_tipi && (
                <p className="mt-1 text-xs text-red-500">{hatalar.proje_tipi}</p>
              )}
            </div>

            {/* Proje Adi */}
            <div>
              <label className="mb-1 block text-sm font-medium">Proje Adi</label>
              <input
                type="text"
                value={form.musteri_adi}
                onChange={(e) => handleChange('musteri_adi', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Proje adi / Musteri adi"
              />
            </div>

            {/* Bolge */}
            <div>
              <label className="mb-1 block text-sm font-medium">Bolge</label>
              <select
                value={form.bolge_id}
                onChange={(e) => handleChange('bolge_id', e.target.value)}
                className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Seciniz</option>
                {bolgeler?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bolge_adi}
                  </option>
                ))}
              </select>
            </div>

            {/* Durum */}
            <div>
              <label className="mb-1 block text-sm font-medium">Durum</label>
              <select
                value={form.durum}
                onChange={(e) => handleChange('durum', e.target.value)}
                className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {eslesmisIsTipi
                  ? eslesmisIsTipi.fazlar.map((f) => (
                      <option key={f.faz_kodu} value={f.faz_kodu}>
                        {f.ikon} {f.faz_adi}
                      </option>
                    ))
                  : Object.entries(PROJE_DURUMLARI).map(([key, val]) => (
                      <option key={key} value={key}>
                        {val.label}
                      </option>
                    ))}
              </select>
            </div>

            {/* Oncelik */}
            <div>
              <label className="mb-1 block text-sm font-medium">Oncelik</label>
              <select
                value={form.oncelik}
                onChange={(e) => handleChange('oncelik', e.target.value)}
                className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {Object.entries(ONCELIK_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Ekip */}
            <div>
              <label className="mb-1 block text-sm font-medium">Ekip</label>
              <select
                value={form.ekip_id}
                onChange={(e) => handleChange('ekip_id', e.target.value)}
                className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Seciniz</option>
                {ekipler?.map((ekip) => (
                  <option key={ekip.id} value={ekip.id}>
                    {ekip.ekip_adi}
                  </option>
                ))}
              </select>
            </div>

            {/* Tahmini Sure */}
            <div>
              <label className="mb-1 block text-sm font-medium">Tahmini Sure (gun)</label>
              <input
                type="number"
                min="0"
                value={form.tahmini_sure_gun}
                onChange={(e) => handleChange('tahmini_sure_gun', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Orn: 30"
              />
            </div>

            {/* Teslim Eden & Alan - swap destekli */}
            <div className="sm:col-span-2">
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Teslim Eden</label>
                  <input
                    type="text"
                    value={form.teslim_eden}
                    onChange={(e) => handleChange('teslim_eden', e.target.value)}
                    className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Kurum yetkilisi"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleTeslimSwap}
                  className="mb-0.5 rounded-md border border-input p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  title="Teslim eden ve alan yer degistir"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </button>
                <div>
                  <label className="mb-1 block text-sm font-medium">Teslim Alan (Personel)</label>
                  <select
                    value={form.teslim_alan_id}
                    onChange={(e) => handleChange('teslim_alan_id', e.target.value)}
                    className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Seciniz</option>
                    {Array.isArray(personeller) && personeller.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.ad_soyad}{p.unvan ? ` - ${p.unvan}` : ''}{p.ekip_adi ? ` (${p.ekip_adi})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Adres Bilgileri */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Adres Bilgileri</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Mahalle</label>
              <input
                type="text"
                value={form.mahalle}
                onChange={(e) => handleChange('mahalle', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Mahalle adi"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Adres</label>
              <textarea
                value={form.adres}
                onChange={(e) => handleChange('adres', e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Acik adres"
              />
            </div>
          </div>
        </div>

        {/* Tarihler */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Tarihler</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Baslama Tarihi</label>
              <input
                type="date"
                value={form.baslama_tarihi}
                onChange={(e) => handleChange('baslama_tarihi', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Bitis Tarihi</label>
              <input
                type="date"
                value={form.bitis_tarihi}
                onChange={(e) => handleChange('bitis_tarihi', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Teslim Tarihi</label>
              <input
                type="date"
                value={form.teslim_tarihi}
                onChange={(e) => handleChange('teslim_tarihi', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>

        {/* Ilerleme ve Notlar */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Ilerleme ve Notlar</h2>
          <div className="space-y-4">
            {/* Tamamlanma Yuzdesi Slider */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Tamamlanma Yuzdesi: %{form.tamamlanma_yuzdesi}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={form.tamamlanma_yuzdesi}
                  onChange={(e) => handleChange('tamamlanma_yuzdesi', Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <span className="w-12 text-right text-sm font-medium">
                  %{form.tamamlanma_yuzdesi}
                </span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-gray-200">
                <div
                  className={cn(
                    'h-2 rounded-full transition-all',
                    form.tamamlanma_yuzdesi >= 100
                      ? 'bg-emerald-500'
                      : form.tamamlanma_yuzdesi >= 50
                        ? 'bg-primary'
                        : 'bg-amber-500'
                  )}
                  style={{ width: `${form.tamamlanma_yuzdesi}%` }}
                />
              </div>
            </div>

            {/* Notlar */}
            <div>
              <label className="mb-1 block text-sm font-medium">Notlar</label>
              <textarea
                value={form.notlar}
                onChange={(e) => handleChange('notlar', e.target.value)}
                rows={4}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Proje ile ilgili notlar..."
              />
            </div>
          </div>
        </div>

        {/* AI Demontaj Listesi Onizleme */}
        {demontajListesi.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Demontaj Listesi (AI)</h2>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">{demontajListesi.length} kalem</span>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">Yer teslim tutanagindan okunan demontaj kalemleri. Proje olusturuldugunda otomatik kaydedilecek.</p>
            <div className="overflow-x-auto rounded-lg border border-input bg-card">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-input bg-muted/50">
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground">#</th>
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground">Malzeme</th>
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground">Birim</th>
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground">Miktar</th>
                  </tr>
                </thead>
                <tbody>
                  {demontajListesi.map((d, i) => (
                    <tr key={i} className="border-b border-input/50">
                      <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-2 py-1.5 font-medium">{d.malzeme_adi}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{d.birim || 'Ad'}</td>
                      <td className="px-2 py-1.5">{d.miktar || 1}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Hata Mesajı */}
        {genelHata && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {genelHata}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <X className="h-4 w-4" />
            Iptal
          </button>
          <button
            type="submit"
            disabled={gonderiliyor}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {gonderiliyor
              ? 'Kaydediliyor...'
              : duzenleModu
                ? 'Guncelle'
                : 'Kaydet'}
          </button>
        </div>
      </form>

      {yerTeslimAcik && (
        <YerTeslimModal onSonuc={handleYerTeslimSonuc} onKapat={() => setYerTeslimAcik(false)} />
      )}
    </div>
  )
}
