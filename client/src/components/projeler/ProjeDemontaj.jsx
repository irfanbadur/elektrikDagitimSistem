import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, Search, Package, Check, Clock, Wrench, FileSpreadsheet, Loader2, ExternalLink, RefreshCw } from 'lucide-react'
import { useProjeDemontaj, useProjeDemontajEkle, useProjeDemontajGuncelle, useProjeDemontajSil, useProjeDemontajOzet } from '@/hooks/useProjeDemontaj'
import { useDepoKatalog } from '@/hooks/useDepoKatalog'
import api from '@/api/client'
import { cn } from '@/lib/utils'

const DURUM_MAP = {
  planli: { label: 'Planli', renk: 'bg-slate-100 text-slate-700', icon: Clock },
  devam_ediyor: { label: 'Devam Ediyor', renk: 'bg-blue-100 text-blue-700', icon: Wrench },
  tamamlandi: { label: 'Tamamlandi', renk: 'bg-emerald-100 text-emerald-700', icon: Check },
}

function DemontajOzet({ projeId }) {
  const { data: ozet } = useProjeDemontajOzet(projeId)
  if (!ozet) return null

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border border-input bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">Toplam Kalem</p>
        <p className="text-lg font-bold">{ozet.toplam_kalem || 0}</p>
      </div>
      <div className="rounded-lg border border-input bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">Tamamlanan</p>
        <p className="text-lg font-bold text-emerald-600">{ozet.tamamlanan_kalem || 0}</p>
      </div>
      <div className="rounded-lg border border-input bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">Devam Eden</p>
        <p className="text-lg font-bold text-blue-600">{ozet.devam_eden_kalem || 0}</p>
      </div>
      <div className="rounded-lg border border-input bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">Bekleyen</p>
        <p className="text-lg font-bold text-amber-600">{ozet.bekleyen_kalem || 0}</p>
      </div>
    </div>
  )
}

function DuzenlenebilirHucre({ deger, onKaydet, type = 'number' }) {
  const [duzenle, setDuzenle] = useState(false)
  const [val, setVal] = useState(deger)
  const inputRef = useRef(null)

  useEffect(() => { if (duzenle && inputRef.current) inputRef.current.focus() }, [duzenle])

  const kaydet = () => {
    setDuzenle(false)
    const yeni = type === 'number' ? Number(val) || 0 : val
    if (yeni !== deger) onKaydet(yeni)
  }

  if (!duzenle) {
    return (
      <div
        onClick={() => { setVal(deger); setDuzenle(true) }}
        className="flex h-full w-full min-h-[28px] min-w-[60px] cursor-pointer items-center rounded px-2 py-1 hover:bg-primary/10 hover:ring-1 hover:ring-primary/30"
        title="Duzenlemek icin tikla"
      >
        {type === 'number' && deger ? deger.toLocaleString('tr-TR') : (deger || '-')}
      </div>
    )
  }

  return (
    <input
      ref={inputRef}
      type={type}
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={kaydet}
      onKeyDown={e => { if (e.key === 'Enter') kaydet(); if (e.key === 'Escape') setDuzenle(false) }}
      className="w-full min-w-[60px] rounded border border-primary bg-background px-2 py-1 text-xs text-left focus:outline-none"
    />
  )
}

function DemontajSatiri({ kalem: k, durum, onGuncelle, onDurumDegistir, onSil }) {
  return (
    <tr className="border-b border-input/50 hover:bg-muted/30 transition-colors">
      <td className="px-3 py-2 font-mono text-xs text-blue-600">{k.poz_no || '-'}</td>
      <td className="px-3 py-2 text-xs font-medium">{k.malzeme_adi}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{k.birim}</td>
      <td className="px-3 py-2 text-left text-xs tabular-nums">
        <DuzenlenebilirHucre deger={k.miktar || 0} onKaydet={(v) => onGuncelle({ miktar: v })} />
      </td>
      <td className="px-3 py-2">
        <select
          value={k.durum}
          onChange={(e) => onDurumDegistir(e.target.value)}
          className={cn('rounded-full px-2 py-0.5 text-xs font-medium border-0 cursor-pointer', durum.renk)}
        >
          {Object.entries(DURUM_MAP).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-right">
        <button onClick={onSil} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600" title="Sil">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
}

function DemontajFormSatiri({ onKaydet, onIptal }) {
  const [form, setForm] = useState({ malzeme_adi: '', malzeme_kodu: '', poz_no: '', birim: 'Ad', miktar: '' })
  const [arama, setArama] = useState('')
  const [aramaDebounced, setAramaDebounced] = useState('')
  const [dropdownAcik, setDropdownAcik] = useState(false)
  const [secildi, setSecildi] = useState(false)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (secildi) return
    const t = setTimeout(() => setAramaDebounced(arama), 300)
    return () => clearTimeout(t)
  }, [arama, secildi])

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) && inputRef.current && !inputRef.current.contains(e.target)) {
        setDropdownAcik(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const { data: sonuclar, isLoading: araniyor } = useDepoKatalog(
    aramaDebounced.length >= 2 ? { arama: aramaDebounced } : null
  )

  const handleAramaChange = (e) => {
    const val = e.target.value
    setArama(val)
    setSecildi(false)
    setDropdownAcik(val.length >= 2)
    if (!val) setForm({ malzeme_adi: '', malzeme_kodu: '', poz_no: '', birim: 'Ad', miktar: form.miktar })
  }

  const handleSec = (item) => {
    setForm({ ...form, malzeme_kodu: item.malzeme_kodu || '', poz_no: item.poz_birlesik || '', malzeme_adi: item.malzeme_cinsi || item.malzeme_tanimi_sap || '', birim: item.olcu || 'Ad' })
    setArama(item.malzeme_cinsi || item.malzeme_tanimi_sap || '')
    setSecildi(true)
    setDropdownAcik(false)
  }

  // Serbest giriş de mümkün (katalogda olmayan malzeme)
  const handleSerbestKaydet = () => {
    const adi = secildi ? form.malzeme_adi : arama.trim()
    if (!adi) return
    onKaydet({ ...form, malzeme_adi: adi, miktar: Number(form.miktar) || 0 })
  }

  return (
    <tr className="border-b border-input bg-primary/5">
      <td className="px-3 py-2">
        <input value={form.poz_no} onChange={e => setForm({...form, poz_no: e.target.value})} placeholder="Poz no" className="w-full rounded border border-input bg-background px-2 py-1 text-xs" />
      </td>
      <td className="px-3 py-2">
        <div className="relative">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={arama}
              onChange={handleAramaChange}
              onFocus={() => { if (arama.length >= 2 && !secildi) setDropdownAcik(true) }}
              placeholder="Malzeme adi yazin..."
              className="w-full rounded border border-input bg-background py-1 pl-7 pr-2 text-xs focus:border-primary focus:outline-none"
              autoFocus
            />
          </div>
          {dropdownAcik && (
            <div ref={dropdownRef} className="absolute left-0 top-full z-50 mt-1 max-h-60 w-[500px] overflow-y-auto rounded-lg border border-input bg-card shadow-xl">
              {araniyor ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">Araniyor...</div>
              ) : !sonuclar?.length ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">Katalogda bulunamadi - serbest girilebilir</div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm">
                    <tr className="border-b border-input">
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Poz No</th>
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Malzeme Cinsi</th>
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">SAP Tanım</th>
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Birim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sonuclar.slice(0, 50).map((item) => (
                      <tr key={item.id} onClick={() => handleSec(item)} className="cursor-pointer border-b border-input/30 hover:bg-primary/5 transition-colors">
                        <td className="px-2 py-1.5 font-mono text-blue-600 whitespace-nowrap">{item.poz_birlesik || '-'}</td>
                        <td className="px-2 py-1.5">{item.malzeme_cinsi || '-'}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{item.malzeme_tanimi_sap || '-'}</td>
                        <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{item.olcu || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <input value={form.birim} onChange={e => setForm({...form, birim: e.target.value})} className="w-16 rounded border border-input bg-background px-2 py-1 text-xs" />
      </td>
      <td className="px-3 py-2">
        <input type="number" value={form.miktar} onChange={e => setForm({...form, miktar: e.target.value})} placeholder="0" className="w-20 rounded border border-input bg-background px-2 py-1 text-xs" />
      </td>
      <td className="px-3 py-2"></td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <button onClick={handleSerbestKaydet} disabled={!arama.trim()} className="rounded bg-primary px-2 py-1 text-xs text-white hover:bg-primary/90 disabled:opacity-50">Kaydet</button>
          <button onClick={onIptal} className="rounded border border-input px-2 py-1 text-xs hover:bg-muted">Iptal</button>
        </div>
      </td>
    </tr>
  )
}

export default function ProjeDemontaj({ projeId }) {
  const { data: demontajlar, isLoading } = useProjeDemontaj(projeId)
  const ekle = useProjeDemontajEkle(projeId)
  const guncelle = useProjeDemontajGuncelle(projeId)
  const sil = useProjeDemontajSil(projeId)

  const [yeniSatir, setYeniSatir] = useState(false)
  const [tutanakYukleniyor, setTutanakYukleniyor] = useState(false)
  const [tutanakDosya, setTutanakDosya] = useState(null)
  const [tutanakAyarAcik, setTutanakAyarAcik] = useState(false)
  const [tutanakDosyaAdi, setTutanakDosyaAdi] = useState('')

  const handleKaydet = async (data) => {
    await ekle.mutateAsync(data)
    setYeniSatir(false)
  }

  const handleDurumDegistir = (id, kalem, yeniDurum) => {
    guncelle.mutate({ id, ...kalem, durum: yeniDurum })
  }

  const handleTutanakAc = () => {
    if (!tutanakDosyaAdi) setTutanakDosyaAdi(`${projeId}_demontaj-tutanagi`)
    setTutanakAyarAcik(true)
  }

  const handleTutanakOlustur = async () => {
    setTutanakAyarAcik(false)
    setTutanakYukleniyor(true)
    try {
      const res = await api.post(`/proje-demontaj/${projeId}/tutanak-olustur`, {
        dosya_adi: tutanakDosyaAdi || undefined
      })
      const data = res?.data || res
      setTutanakDosya(data)
      if (data.dosya_adi) setTutanakDosyaAdi(data.dosya_adi.replace(/\.xlsx$/i, ''))
    } catch (err) {
      console.error('Tutanak oluşturma hatası:', err)
    } finally {
      setTutanakYukleniyor(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Demontaj Listesi</h3>
          <p className="text-sm text-muted-foreground">Projede sokulmesi gereken malzemeler</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Tutanak Oluştur/Güncelle */}
          <div className="relative">
            <button
              onClick={tutanakYukleniyor ? undefined : handleTutanakAc}
              disabled={tutanakYukleniyor}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
            >
              {tutanakYukleniyor ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Oluşturuluyor...</>
              ) : tutanakDosya ? (
                <><RefreshCw className="h-4 w-4" />Tutanağı Güncelle</>
              ) : (
                <><FileSpreadsheet className="h-4 w-4" />Tutanak Oluştur</>
              )}
            </button>
            {/* Dosya adı ayar paneli */}
            {tutanakAyarAcik && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setTutanakAyarAcik(false)} />
                <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-lg border border-input bg-card p-4 shadow-xl">
                  <h4 className="mb-3 text-sm font-semibold">Tutanak Ayarları</h4>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Dosya Adı</label>
                    <div className="flex items-center gap-1">
                      <input
                        value={tutanakDosyaAdi}
                        onChange={e => setTutanakDosyaAdi(e.target.value)}
                        className="flex-1 rounded border border-input px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                        placeholder="dosya-adi"
                      />
                      <span className="text-xs text-muted-foreground">.xlsx</span>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button onClick={() => setTutanakAyarAcik(false)} className="rounded px-3 py-1.5 text-xs hover:bg-muted">İptal</button>
                    <button onClick={handleTutanakOlustur} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                      {tutanakDosya ? 'Güncelle' : 'Oluştur'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          {/* Tutanak dosya linki */}
          {tutanakDosya && (
            <a
              href={`/api/dosya/${tutanakDosya.dosya_id}/indir`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg border border-input px-3 py-2 text-sm text-primary hover:bg-primary/5 transition-colors"
              title="Tutanağı indir"
            >
              <ExternalLink className="h-4 w-4" />
              İndir
            </a>
          )}
          <button onClick={() => setYeniSatir(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Ekle
          </button>
        </div>
      </div>

      <DemontajOzet projeId={projeId} />

      <div className="overflow-hidden rounded-lg border border-input bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-input bg-muted/50">
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Poz No</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Malzeme</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Birim</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Miktar</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Durum</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground w-16"></th>
              </tr>
            </thead>
            <tbody>
              {yeniSatir && <DemontajFormSatiri onKaydet={handleKaydet} onIptal={() => setYeniSatir(false)} />}

              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-input/50">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-3 py-2.5"><div className="skeleton h-4 w-full rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : !demontajlar?.length && !yeniSatir ? (
                <tr>
                  <td colSpan={6} className="px-3 py-12 text-center">
                    <Wrench className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">Demontaj listesi bos</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">Manuel olarak veya yer teslim tutanagindan malzeme ekleyin</p>
                  </td>
                </tr>
              ) : (
                demontajlar?.map((k) => {
                  const durum = DURUM_MAP[k.durum] || DURUM_MAP.planli
                  return (
                    <DemontajSatiri key={k.id} kalem={k} durum={durum} onGuncelle={(data) => guncelle.mutate({ id: k.id, ...k, ...data })} onDurumDegistir={(d) => handleDurumDegistir(k.id, k, d)} onSil={() => sil.mutate(k.id)} />
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
