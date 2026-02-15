import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, X } from 'lucide-react'
import { useProje, useProjeOlustur, useProjeGuncelle } from '@/hooks/useProjeler'
import { useBolgeler } from '@/hooks/useBolgeler'
import { useEkipler } from '@/hooks/useEkipler'
import { useDonguSablonlari } from '@/hooks/useDongu'
import { PROJE_DURUMLARI, ONCELIK_LABELS } from '@/utils/constants'
import { CardSkeleton } from '@/components/shared/LoadingSkeleton'
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
}

export default function ProjeForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const duzenleModu = Boolean(id)

  const { data: proje, isLoading: projeYukleniyor } = useProje(id)
  const { data: bolgeler } = useBolgeler()
  const { data: ekipler } = useEkipler()
  const { data: sablonlar } = useDonguSablonlari()
  const projeOlustur = useProjeOlustur()
  const projeGuncelle = useProjeGuncelle()

  const [form, setForm] = useState(BOS_FORM)
  const [hatalar, setHatalar] = useState({})
  const [gonderiliyor, setGonderiliyor] = useState(false)

  // Proje tipine göre eşleşen döngü şablonu aşamaları
  const eslesmisAsamalar = useMemo(() => {
    if (!sablonlar || !form.proje_tipi) return null
    const sablon = sablonlar.find(
      (s) => s.sablon_kodu.toUpperCase() === form.proje_tipi.toUpperCase()
    )
    return sablon?.asamalar || null
  }, [sablonlar, form.proje_tipi])

  // Proje tipi değiştiğinde durum'u ilk aşama kodu yap (sadece yeni proje modunda)
  useEffect(() => {
    if (!duzenleModu && eslesmisAsamalar && eslesmisAsamalar.length > 0) {
      setForm((prev) => ({ ...prev, durum: eslesmisAsamalar[0].asama_kodu }))
    }
  }, [eslesmisAsamalar, duzenleModu])

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setGonderiliyor(true)

    const payload = {
      ...form,
      bolge_id: form.bolge_id || null,
      ekip_id: form.ekip_id || null,
      tahmini_sure_gun: form.tahmini_sure_gun ? Number(form.tahmini_sure_gun) : null,
      tamamlanma_yuzdesi: Number(form.tamamlanma_yuzdesi),
      baslama_tarihi: form.baslama_tarihi || null,
      bitis_tarihi: form.bitis_tarihi || null,
      teslim_tarihi: form.teslim_tarihi || null,
    }

    const mutation = duzenleModu ? projeGuncelle : projeOlustur
    const mutationData = duzenleModu ? { id, ...payload } : payload

    mutation.mutate(mutationData, {
      onSuccess: () => {
        navigate(duzenleModu ? `/projeler/${id}` : '/projeler')
      },
      onSettled: () => {
        setGonderiliyor(false)
      },
    })
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
          <h2 className="mb-4 text-lg font-semibold">Temel Bilgiler</h2>
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
                <option value="YB">YB</option>
                <option value="KET">KET</option>
                <option value="Tesis">Tesis</option>
              </select>
              {hatalar.proje_tipi && (
                <p className="mt-1 text-xs text-red-500">{hatalar.proje_tipi}</p>
              )}
            </div>

            {/* Musteri Adi */}
            <div>
              <label className="mb-1 block text-sm font-medium">Musteri Adi</label>
              <input
                type="text"
                value={form.musteri_adi}
                onChange={(e) => handleChange('musteri_adi', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Musteri adi"
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
                {eslesmisAsamalar
                  ? eslesmisAsamalar.map((a) => (
                      <option key={a.asama_kodu} value={a.asama_kodu}>
                        {a.ikon} {a.asama_adi}
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
                {ekipler?.map((e) => (
                  <option key={e.ekip_id} value={e.ekip_id}>
                    {e.ekip_adi}
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
    </div>
  )
}
