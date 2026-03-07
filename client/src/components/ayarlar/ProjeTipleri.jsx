import { useState } from 'react'
import { Plus, X, ChevronDown, ChevronRight, Save, Trash2, GripVertical } from 'lucide-react'
import { useIsTipleri, useIsTipiOlustur, useIsTipiGuncelle, useIsTipiSil } from '@/hooks/useIsTipleri'
import { useRoller } from '@/hooks/useYonetim'
import { cn } from '@/lib/utils'

const RENKLER = ['#6366f1','#8b5cf6','#0ea5e9','#f59e0b','#10b981','#3b82f6','#14b8a6','#f43f5e','#ec4899','#84cc16']
const IKONLAR = ['🚀','📐','📋','🔧','💰','✅','🏁','📍','📦','🗺️','🔴','📊','🔍','📝','⚡','🏗️']

function kodUret(adi) {
  return adi
    .toLowerCase()
    .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
    .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

export default function ProjeTipleri() {
  const { data: tipler, isLoading } = useIsTipleri()
  const { data: rollerRes } = useRoller()
  const roller = rollerRes?.data || []
  const olustur = useIsTipiOlustur()
  const guncelle = useIsTipiGuncelle()
  const sil = useIsTipiSil()

  const [seciliId, setSeciliId] = useState(null)
  const [yeniMod, setYeniMod] = useState(false)
  const [form, setForm] = useState({ ad: '', kod: '', aciklama: '', fazlar: [] })
  const [acikFazlar, setAcikFazlar] = useState({})
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const tipSec = (tip) => {
    setSeciliId(tip.id)
    setYeniMod(false)
    setForm({
      ad: tip.ad,
      kod: tip.kod,
      aciklama: tip.aciklama || '',
      fazlar: tip.fazlar.map(f => ({
        sira: f.sira,
        faz_adi: f.faz_adi,
        faz_kodu: f.faz_kodu,
        ikon: f.ikon,
        renk: f.renk,
        sorumlu_rol_id: f.sorumlu_rol_id || '',
        tahmini_gun: f.tahmini_gun || '',
        adimlar: f.adimlar.map(a => ({
          sira: a.sira,
          adim_adi: a.adim_adi,
          adim_kodu: a.adim_kodu,
          tahmini_gun: a.tahmini_gun || '',
        }))
      }))
    })
    setAcikFazlar({})
  }

  const yeniBaslat = () => {
    setSeciliId(null)
    setYeniMod(true)
    setForm({ ad: '', kod: '', aciklama: '', fazlar: [] })
    setAcikFazlar({})
  }

  const [kaydetHata, setKaydetHata] = useState('')

  const handleKaydet = async () => {
    if (!form.ad || !form.kod) return
    setKaydediliyor(true)
    setKaydetHata('')
    try {
      if (yeniMod) {
        const sonuc = await olustur.mutateAsync({ kod: form.kod, ad: form.ad, aciklama: form.aciklama })
        // API client unwraps response.data → sonuc = { success, data }
        const yeniId = sonuc?.data?.id ?? sonuc?.id
        if (yeniId) {
          setSeciliId(yeniId)
          setYeniMod(false)
        }
      } else {
        await guncelle.mutateAsync({ id: seciliId, ad: form.ad, aciklama: form.aciklama, fazlar: form.fazlar })
      }
    } catch (err) {
      setKaydetHata(err.message || 'Kaydetme sırasında bir hata oluştu')
    } finally {
      setKaydediliyor(false)
    }
  }

  const handleSil = () => {
    if (!seciliId) return
    if (!confirm('Bu iş tipini silmek istediğinize emin misiniz?')) return
    sil.mutate(seciliId, { onSuccess: () => { setSeciliId(null); setYeniMod(false) } })
  }

  // Faz ekleme/silme
  const fazEkle = () => {
    const yeniSira = form.fazlar.length + 1
    setForm({
      ...form,
      fazlar: [...form.fazlar, {
        sira: yeniSira,
        faz_adi: '',
        faz_kodu: '',
        ikon: '📋',
        renk: RENKLER[(yeniSira - 1) % RENKLER.length],
        sorumlu_rol_id: '',
        tahmini_gun: '',
        adimlar: []
      }]
    })
    setAcikFazlar(p => ({ ...p, [yeniSira - 1]: true }))
  }

  const fazSil = (idx) => {
    const fazAdi = form.fazlar[idx]?.faz_adi || 'Bu faz'
    if (!confirm(`"${fazAdi}" fazını silmek istediğinize emin misiniz? Bu fazdaki tüm adımlar da silinecektir.`)) return
    const yeni = form.fazlar.filter((_, i) => i !== idx).map((f, i) => ({ ...f, sira: i + 1 }))
    setForm({ ...form, fazlar: yeni })
  }

  const fazGuncelle = (idx, field, value) => {
    const yeni = [...form.fazlar]
    yeni[idx] = { ...yeni[idx], [field]: value }
    if (field === 'faz_adi' && !yeni[idx]._kodManuel) {
      yeni[idx].faz_kodu = kodUret(value)
    }
    setForm({ ...form, fazlar: yeni })
  }

  // Adım ekleme/silme
  const adimEkle = (fazIdx) => {
    const yeni = [...form.fazlar]
    const yeniSira = yeni[fazIdx].adimlar.length + 1
    yeni[fazIdx] = {
      ...yeni[fazIdx],
      adimlar: [...yeni[fazIdx].adimlar, { sira: yeniSira, adim_adi: '', adim_kodu: '', tahmini_gun: '' }]
    }
    setForm({ ...form, fazlar: yeni })
  }

  const adimSil = (fazIdx, adimIdx) => {
    const yeni = [...form.fazlar]
    yeni[fazIdx] = {
      ...yeni[fazIdx],
      adimlar: yeni[fazIdx].adimlar.filter((_, i) => i !== adimIdx).map((a, i) => ({ ...a, sira: i + 1 }))
    }
    setForm({ ...form, fazlar: yeni })
  }

  const adimGuncelle = (fazIdx, adimIdx, field, value) => {
    const yeni = [...form.fazlar]
    const adimlar = [...yeni[fazIdx].adimlar]
    adimlar[adimIdx] = { ...adimlar[adimIdx], [field]: value }
    if (field === 'adim_adi') {
      adimlar[adimIdx].adim_kodu = kodUret(value)
    }
    yeni[fazIdx] = { ...yeni[fazIdx], adimlar }
    setForm({ ...form, fazlar: yeni })
  }

  const toggleFaz = (idx) => {
    setAcikFazlar(p => ({ ...p, [idx]: !p[idx] }))
  }

  if (isLoading) return <div className="skeleton h-64 w-full" />

  const toplam = form.fazlar.reduce((s, f) => s + f.adimlar.length, 0)

  return (
    <div className="flex gap-6 h-[calc(100vh-250px)] min-h-[500px]">
      {/* Sol Panel — İş Tipi Listesi */}
      <div className="w-64 flex-shrink-0 rounded-lg border border-border bg-card overflow-hidden flex flex-col">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold">İş Tipleri</h3>
          <button onClick={yeniBaslat} className="p-1.5 rounded-md bg-primary text-white hover:bg-primary/90">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {tipler?.map(tip => (
            <button
              key={tip.id}
              onClick={() => tipSec(tip)}
              className={cn(
                'w-full text-left px-3 py-2.5 text-sm border-b border-border/50 hover:bg-muted transition-colors',
                seciliId === tip.id && 'bg-primary/10 border-l-2 border-l-primary'
              )}
            >
              <div className="font-medium">{tip.ad}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                <span className="font-mono bg-muted px-1 rounded">{tip.kod}</span>
                <span className="ml-2">{tip.fazlar.length} faz</span>
              </div>
            </button>
          ))}
          {(!tipler || tipler.length === 0) && (
            <p className="p-4 text-sm text-muted-foreground">Henüz iş tipi yok</p>
          )}
        </div>
      </div>

      {/* Sağ Panel — Düzenleme */}
      <div className="flex-1 rounded-lg border border-border bg-card overflow-hidden flex flex-col">
        {!seciliId && !yeniMod ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Sol panelden bir iş tipi seçin veya yeni oluşturun
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {yeniMod ? 'Yeni İş Tipi' : form.ad}
              </h3>
              <div className="flex gap-2">
                {!yeniMod && (
                  <button onClick={handleSil} className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={handleKaydet}
                  disabled={kaydediliyor || !form.ad || !form.kod}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>

            {/* Hata mesajı */}
            {kaydetHata && (
              <div className="mx-4 mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {kaydetHata}
              </div>
            )}

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* İş tipi bilgileri */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">İş Tipi Adı</label>
                  <input
                    value={form.ad}
                    onChange={e => {
                      const ad = e.target.value
                      setForm(f => ({ ...f, ad, kod: yeniMod ? kodUret(ad).toUpperCase() : f.kod }))
                    }}
                    className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    placeholder="Örn: Küçük Ek Tesis"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Kod</label>
                  <input
                    value={form.kod}
                    onChange={e => setForm(f => ({ ...f, kod: e.target.value.toUpperCase() }))}
                    disabled={!yeniMod}
                    className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-muted disabled:text-muted-foreground font-mono"
                    placeholder="KET"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Açıklama</label>
                <input
                  value={form.aciklama}
                  onChange={e => setForm(f => ({ ...f, aciklama: e.target.value }))}
                  className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="İş tipi açıklaması"
                />
              </div>

              {/* Fazlar */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold">
                    Fazlar ({form.fazlar.length} faz, {toplam} adım)
                  </h4>
                  <button onClick={fazEkle} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary/10 text-primary rounded-md hover:bg-primary/20">
                    <Plus className="h-3.5 w-3.5" /> Faz Ekle
                  </button>
                </div>

                <div className="space-y-2">
                  {form.fazlar.map((faz, fi) => (
                    <div key={fi} className={cn('rounded-lg border overflow-hidden', acikFazlar[fi] ? 'border-primary/30 bg-primary/5' : 'border-border')}>
                      {/* Faz başlık */}
                      <div
                        className={cn('flex items-center gap-2 px-3 py-2.5 cursor-pointer', acikFazlar[fi] ? 'bg-primary/10 hover:bg-primary/15' : 'bg-muted/50 hover:bg-muted')}
                        onClick={() => toggleFaz(fi)}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: faz.renk }}
                        />
                        <span className="text-xs font-mono text-muted-foreground w-5">{faz.sira}.</span>
                        <span className="text-sm mr-1">{faz.ikon}</span>
                        <span className="flex-1 text-sm font-medium">{faz.faz_adi || '(Boş faz)'}</span>
                        <span className="text-xs text-muted-foreground">{faz.adimlar.length} adım</span>
                        {acikFazlar[fi] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>

                      {/* Faz detay */}
                      {acikFazlar[fi] && (
                        <div className="border-t border-border bg-white space-y-3" style={{ padding: '16px 32px' }}>
                          <div className="flex items-end gap-3">
                            <div className="flex-1">
                              <label className="block text-xs text-muted-foreground mb-1">Faz Adı</label>
                              <input
                                value={faz.faz_adi}
                                onChange={e => fazGuncelle(fi, 'faz_adi', e.target.value)}
                                className="w-full rounded-md border border-input bg-white px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs text-muted-foreground mb-1">Sorumlu Rol</label>
                              <select
                                value={faz.sorumlu_rol_id}
                                onChange={e => fazGuncelle(fi, 'sorumlu_rol_id', e.target.value ? parseInt(e.target.value) : null)}
                                className="w-full rounded-md border border-input bg-white px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                              >
                                <option value="">Seçiniz</option>
                                {roller?.map(r => {
                                  const kisilar = r.kullanicilar?.map(k => k.ad_soyad).join(', ')
                                  return (
                                    <option key={r.id} value={r.id}>
                                      {r.rol_adi}{kisilar ? ` — ${kisilar}` : ''}
                                    </option>
                                  )
                                })}
                              </select>
                            </div>
                            <div style={{ width: '80px', flexShrink: 0 }}>
                              <label className="block text-xs text-muted-foreground mb-1">Gün</label>
                              <input
                                type="number"
                                value={faz.tahmini_gun}
                                onChange={e => fazGuncelle(fi, 'tahmini_gun', e.target.value ? parseInt(e.target.value) : null)}
                                className="w-full rounded-md border border-input bg-white px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                              />
                            </div>
                            <button
                              onClick={() => fazSil(fi)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-md border border-red-200 shrink-0"
                              title="Fazı Sil"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Fazı Sil
                            </button>
                          </div>

                          <div className="flex gap-2 items-center">
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">İkon</label>
                              <div className="flex gap-1 flex-wrap">
                                {IKONLAR.map(i => (
                                  <button
                                    key={i}
                                    onClick={() => fazGuncelle(fi, 'ikon', i)}
                                    className={cn(
                                      'w-7 h-7 rounded text-sm flex items-center justify-center border',
                                      faz.ikon === i ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted'
                                    )}
                                  >{i}</button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Renk</label>
                              <div className="flex gap-1">
                                {RENKLER.map(r => (
                                  <button
                                    key={r}
                                    onClick={() => fazGuncelle(fi, 'renk', r)}
                                    className={cn(
                                      'w-6 h-6 rounded-full border-2',
                                      faz.renk === r ? 'border-gray-800 scale-110' : 'border-transparent'
                                    )}
                                    style={{ backgroundColor: r }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Adımlar */}
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-2 block">Adımlar</label>
                            <div className="space-y-1.5">
                              {faz.adimlar.map((adim, ai) => (
                                <div key={ai} className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground w-5">{adim.sira}.</span>
                                  <input
                                    value={adim.adim_adi}
                                    onChange={e => adimGuncelle(fi, ai, 'adim_adi', e.target.value)}
                                    placeholder="Adım adı"
                                    className="flex-1 rounded border border-input bg-white px-2 py-1 text-sm outline-none focus:border-primary"
                                  />
                                  <input
                                    type="number"
                                    value={adim.tahmini_gun}
                                    onChange={e => adimGuncelle(fi, ai, 'tahmini_gun', e.target.value ? parseInt(e.target.value) : null)}
                                    placeholder="Gün"
                                    className="w-16 rounded border border-input bg-white px-2 py-1 text-sm outline-none focus:border-primary"
                                  />
                                  <button
                                    onClick={() => adimSil(fi, ai)}
                                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                              {faz.adimlar.length === 0 && (
                                <p className="text-xs text-muted-foreground py-1">Henüz adım eklenmemiş</p>
                              )}
                            </div>
                            <div className="flex justify-end pt-2">
                              <button
                                onClick={() => adimEkle(fi)}
                                className="flex items-center gap-1 px-2 py-0.5 text-xs text-primary hover:bg-primary/10 rounded"
                              >
                                <Plus className="h-3 w-3" /> Adım Ekle
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {form.fazlar.length === 0 && !yeniMod && (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Henüz faz tanımlanmamış. Kaydet'e basıldığında varsayılan fazlar oluşturulur.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
