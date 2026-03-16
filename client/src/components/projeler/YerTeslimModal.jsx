import { useState, useRef } from 'react'
import { X, Sparkles, Loader2, CheckCircle, AlertCircle, Image, ArrowLeftRight } from 'lucide-react'
import api from '@/api/client'
import DemontajListesiDuzenle, { createSatir, extractKgKmOran, isMtBirim, isKgBirim } from './DemontajListesiDuzenle'
import DirekListesiDuzenle, { createDirekSatir } from './DirekListesiDuzenle'
import KatalogAramaInput from './KatalogAramaInput'

export default function YerTeslimModal({ onSonuc, onKapat }) {
  const [dosya, setDosya] = useState(null)
  const [onizleme, setOnizleme] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState('')
  const [sonuc, setSonuc] = useState(null)
  const [demontajListesi, setDemontajListesi] = useState([])
  const [direkListesi, setDirekListesi] = useState([])
  const [eslestiriliyor, setEslestiriliyor] = useState(false)
  const [direkEslestiriliyor, setDirekEslestiriliyor] = useState(false)
  const fileInputRef = useRef(null)

  const handleDosyaSec = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setHata('Sadece gorsel dosyalar yuklenebilir (JPG, PNG)')
      return
    }
    setDosya(file)
    setHata('')
    setSonuc(null)
    setDemontajListesi([])
    const reader = new FileReader()
    reader.onload = (ev) => setOnizleme(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleAnaliz = async () => {
    if (!dosya) return
    setYukleniyor(true)
    setHata('')
    try {
      const formData = new FormData()
      formData.append('dosya', dosya)
      const res = await fetch('/api/yer-teslim/parse', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Analiz hatasi')
      if (json.data?.parse_error) throw new Error('AI goruntuyu okuyamadi. Daha net bir gorsel yukleyin.')
      setSonuc(json.data)

      // Demontaj listesini state'e al ve katalog eşleştirmesi yap
      const liste = (json.data.demontaj_listesi || []).map((d) => createSatir(d))
      setDemontajListesi(liste)
      katalogEslestir(liste)

      // Direk listesini state'e al ve katalog eşleştirmesi yap
      const direkler = (json.data.direk_listesi || []).map((d) => createDirekSatir(d))
      setDirekListesi(direkler)
      direkKatalogEslestir(direkler)
    } catch (err) {
      setHata(err.message || 'Analiz sirasinda hata olustu')
    } finally {
      setYukleniyor(false)
    }
  }

  // Toplu katalog eşleştirme
  const katalogEslestir = async (liste) => {
    if (!liste || liste.length === 0) return
    setEslestiriliyor(true)
    try {
      const eslesmeRes = await api.post('/malzeme-katalog/eslestir', { kalemler: liste })
      const eslesmeler = eslesmeRes?.data || []
      setDemontajListesi(prev => prev.map((k, i) => {
        const e = eslesmeler[i]?.eslesme
        if (e) {
          const katalogBirim = e.olcu || ''
          const orijinalBirim = k.birim || 'Ad'
          const birimFarkli = katalogBirim && orijinalBirim &&
            katalogBirim.toLowerCase().replace(/\./g, '') !== orijinalBirim.toLowerCase().replace(/\./g, '')
          const kgKmOran = birimFarkli ? extractKgKmOran(`${e.malzeme_cinsi || ''} ${e.malzeme_tanimi_sap || ''}`) : null
          let yeniMiktar = k.miktar
          if (kgKmOran && birimFarkli) {
            if (isMtBirim(orijinalBirim) && isKgBirim(katalogBirim)) {
              yeniMiktar = Math.round(k.miktar * kgKmOran / 1000 * 100) / 100
            } else if (isKgBirim(orijinalBirim) && isMtBirim(katalogBirim)) {
              yeniMiktar = Math.round(k.miktar / kgKmOran * 1000 * 100) / 100
            }
          }
          return {
            ...k,
            malzeme_adi: e.malzeme_cinsi || e.malzeme_tanimi_sap || k.malzeme_adi,
            malzeme_kodu: e.malzeme_kodu || '',
            poz_no: e.poz_birlesik || k.poz_no,
            birim: katalogBirim || k.birim,
            miktar: yeniMiktar,
            katalog_eslesme: e.malzeme_cinsi || e.malzeme_tanimi_sap,
            _birim_secenekleri: birimFarkli ? [orijinalBirim, katalogBirim] : null,
            _kg_km_oran: kgKmOran,
          }
        }
        return { ...k, _eslesmedi: true }
      }))
    } catch { /* eşleşme opsiyonel */ }
    setEslestiriliyor(false)
  }

  // Direk listesi katalog eşleştirme
  const direkKatalogEslestir = async (liste) => {
    if (!liste || liste.length === 0) return
    setDirekEslestiriliyor(true)
    try {
      const kalemler = liste.map(d => ({ malzeme_adi: d.kisa_adi }))
      const eslesmeRes = await api.post('/malzeme-katalog/eslestir', { kalemler })
      const eslesmeler = eslesmeRes?.data || []
      setDirekListesi(prev => prev.map((k, i) => {
        const e = eslesmeler[i]?.eslesme
        if (e) {
          return {
            ...k,
            katalog_adi: e.malzeme_cinsi || e.malzeme_tanimi_sap || '',
            malzeme_kodu: e.malzeme_kodu || '',
          }
        }
        return { ...k, _eslesmedi: true }
      }))
    } catch { /* opsiyonel */ }
    setDirekEslestiriliyor(false)
  }

  const handleOnayla = () => {
    const gecerliListe = demontajListesi.filter(d => d.malzeme_adi && d.malzeme_adi.trim() !== '')
    const gecerliDirekler = direkListesi.filter(d => d.kisa_adi && d.kisa_adi.trim() !== '')
    onSonuc({ ...sonuc, demontaj_listesi: gecerliListe, direk_listesi: gecerliDirekler, _dosya: dosya })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-input px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Yer Teslim Tutanagi ile Proje Olustur</h3>
          </div>
          <button onClick={onKapat} className="rounded p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!sonuc ? (
            /* Upload + Analiz */
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Yer teslim tutanagi/krokisi gorselini yukleyin. AI goruntuyu analiz ederek proje bilgilerini ve demontaj listesini otomatik olarak dolduracak.
              </p>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-input p-8 hover:border-primary hover:bg-primary/5 transition-colors"
              >
                {onizleme ? (
                  <img src={onizleme} alt="Onizleme" className="max-h-64 rounded-lg object-contain" />
                ) : (
                  <>
                    <Image className="mb-3 h-12 w-12 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">Tiklayin veya surukleyin</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">JPG, PNG - Maks 15MB</p>
                  </>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleDosyaSec} className="hidden" />
              </div>
              {dosya && (
                <div className="flex items-center justify-between rounded-lg border border-input bg-muted/30 px-4 py-2">
                  <span className="text-sm">{dosya.name} ({(dosya.size / 1024 / 1024).toFixed(1)} MB)</span>
                  <button onClick={() => { setDosya(null); setOnizleme(null) }} className="text-xs text-red-500 hover:underline">Kaldir</button>
                </div>
              )}
              {hata && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />{hata}
                </div>
              )}
            </div>
          ) : (
            /* Sonuç + Düzenlenebilir Demontaj */
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <CheckCircle className="h-4 w-4 shrink-0" />
                Tutanak analiz edildi. Demontaj listesini duzenleyip onaylayin.
              </div>

              {/* Temel Bilgiler (düzenlenebilir) */}
              <div className="rounded-lg border border-input p-4">
                <h4 className="mb-3 text-sm font-semibold">Temel Bilgiler</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <label className="text-xs text-muted-foreground">Proje Tipi</label>
                    <input value={sonuc.proje_tipi || ''} onChange={e => setSonuc(p => ({ ...p, proje_tipi: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Proje Adi</label>
                    <input value={sonuc.proje_adi || ''} onChange={e => setSonuc(p => ({ ...p, proje_adi: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Il</label>
                    <input value={sonuc.il || ''} onChange={e => setSonuc(p => ({ ...p, il: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Ilce</label>
                    <input value={sonuc.ilce || ''} onChange={e => setSonuc(p => ({ ...p, ilce: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Mahalle</label>
                    <input value={sonuc.mahalle || ''} onChange={e => setSonuc(p => ({ ...p, mahalle: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Basvuru No</label>
                    <input value={sonuc.basvuru_no || ''} onChange={e => setSonuc(p => ({ ...p, basvuru_no: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Oncelik</label>
                    <select value={sonuc.oncelik || 'normal'} onChange={e => setSonuc(p => ({ ...p, oncelik: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30">
                      <option value="dusuk">Dusuk</option>
                      <option value="normal">Normal</option>
                      <option value="yuksek">Yuksek</option>
                      <option value="acil">Acil</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Telefon</label>
                    <input value={sonuc.telefon || ''} onChange={e => setSonuc(p => ({ ...p, telefon: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground">Adres</label>
                    <input value={sonuc.adres || ''} onChange={e => setSonuc(p => ({ ...p, adres: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                </div>
              </div>

              {/* Baglanti / Tesis Bilgileri (düzenlenebilir) */}
              <div className="rounded-lg border border-input p-4">
                <h4 className="mb-3 text-sm font-semibold">Baglanti / Tesis Bilgileri</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <label className="text-xs text-muted-foreground">Ada / Parsel</label>
                    <input value={sonuc.ada_parsel || ''} onChange={e => setSonuc(p => ({ ...p, ada_parsel: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Tesis</label>
                    <input value={sonuc.tesis || ''} onChange={e => setSonuc(p => ({ ...p, tesis: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Enerji Alinan Direk No</label>
                    <input value={sonuc.enerji_alinan_direk_no || ''} onChange={e => setSonuc(p => ({ ...p, enerji_alinan_direk_no: e.target.value }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Abone Kablosu</label>
                    <KatalogAramaInput
                      value={sonuc.abone_kablosu || ''}
                      onChange={val => setSonuc(p => ({ ...p, abone_kablosu: val }))}
                      placeholder="Orn: 2x10 NYY"
                      className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Abone Kablosu (metre)</label>
                    <input type="number" min="0" step="0.1" value={sonuc.abone_kablosu_metre || ''} onChange={e => setSonuc(p => ({ ...p, abone_kablosu_metre: e.target.value ? Number(e.target.value) : null }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Kesinti Ihtiyaci</label>
                    <select value={sonuc.kesinti_ihtiyaci == null ? '' : sonuc.kesinti_ihtiyaci ? '1' : '0'} onChange={e => setSonuc(p => ({ ...p, kesinti_ihtiyaci: e.target.value === '' ? null : e.target.value === '1' }))} className="mt-0.5 w-full rounded border border-input bg-white px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30">
                      <option value="">Belirtilmedi</option>
                      <option value="1">Evet</option>
                      <option value="0">Hayir</option>
                    </select>
                  </div>
                </div>
                {/* Izinler */}
                <div className="mt-3">
                  <label className="text-xs text-muted-foreground">Izinler</label>
                  <div className="mt-1 flex flex-wrap gap-3">
                    {[
                      { key: 'karayollari', label: 'Karayollari' },
                      { key: 'kazi_izni', label: 'Kazi Izni' },
                      { key: 'orman', label: 'Orman' },
                      { key: 'muvafakatname', label: 'Muvafakatname' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={sonuc.izinler?.[key] || false}
                          onChange={e => setSonuc(p => ({ ...p, izinler: { ...(p.izinler || {}), [key]: e.target.checked } }))}
                          className="rounded border-input accent-primary"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <input
                    value={sonuc.izinler?.diger || ''}
                    onChange={e => setSonuc(p => ({ ...p, izinler: { ...(p.izinler || {}), diger: e.target.value || null } }))}
                    className="mt-1.5 w-full rounded border border-input bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
                    placeholder="Diger izinler..."
                  />
                </div>
              </div>

              {/* Yer Teslim Yapanlar */}
              {(sonuc.yer_teslim_yapan || sonuc.yer_teslim_alan) && (
                <div className="rounded-lg border border-input p-4">
                  <h4 className="mb-3 text-sm font-semibold">Yer Teslim Bilgileri</h4>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex-1 rounded-lg border border-input bg-muted/30 px-3 py-2">
                      <span className="text-xs text-muted-foreground">Teslim Yapan</span>
                      <div className="mt-0.5 font-semibold">{sonuc.yer_teslim_yapan?.ad_soyad || '-'}</div>
                      {sonuc.yer_teslim_yapan?.unvan && <span className="text-xs text-muted-foreground">{sonuc.yer_teslim_yapan.unvan}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSonuc(prev => ({
                        ...prev,
                        yer_teslim_yapan: { ...prev.yer_teslim_yapan, ad_soyad: prev.yer_teslim_alan?.ad_soyad || '', unvan: prev.yer_teslim_alan?.unvan || '' },
                        yer_teslim_alan: { ...prev.yer_teslim_alan, ad_soyad: prev.yer_teslim_yapan?.ad_soyad || '', unvan: prev.yer_teslim_yapan?.unvan || '' },
                      }))}
                      className="shrink-0 rounded-full border border-input p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary hover:border-primary"
                      title="Teslim yapan ve alanı değiştir"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                    </button>
                    <div className="flex-1 rounded-lg border border-input bg-muted/30 px-3 py-2">
                      <span className="text-xs text-muted-foreground">Teslim Alan</span>
                      <div className="mt-0.5 font-semibold">{sonuc.yer_teslim_alan?.ad_soyad || '-'}</div>
                      {sonuc.yer_teslim_alan?.unvan && <span className="text-xs text-muted-foreground">{sonuc.yer_teslim_alan.unvan}</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Direk Listesi */}
              {direkListesi.length > 0 && (
                <div className="rounded-lg border border-input p-4">
                  <DirekListesiDuzenle
                    liste={direkListesi}
                    onChange={setDirekListesi}
                    eslestiriliyor={direkEslestiriliyor}
                  />
                </div>
              )}

              {/* Demontaj Listesi - Ortak bileşen */}
              <div className="rounded-lg border border-input p-4">
                <DemontajListesiDuzenle
                  liste={demontajListesi}
                  onChange={setDemontajListesi}
                  eslestiriliyor={eslestiriliyor}
                  aciklama="Malzeme adini yazmaya baslayin, malzeme katalogdan otomatik eslestirme yapilacaktir."
                />
              </div>

              {/* Notlar */}
              <div className="rounded-lg border border-input p-4">
                <h4 className="mb-2 text-sm font-semibold">Ek Notlar</h4>
                <textarea
                  value={sonuc.notlar || ''}
                  onChange={e => setSonuc(p => ({ ...p, notlar: e.target.value }))}
                  rows={3}
                  className="w-full rounded border border-input bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
                  placeholder="Ek notlar..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-input px-5 py-4">
          <button onClick={onKapat} className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-muted">Iptal</button>
          {!sonuc ? (
            <>
              <button
                onClick={handleAnaliz}
                disabled={!dosya || yukleniyor}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {yukleniyor ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />AI Analiz Ediyor...</>
                ) : (
                  <><Sparkles className="h-4 w-4" />Analiz Et</>
                )}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setSonuc(null); setDemontajListesi([]) }} className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-muted">Tekrar Dene</button>
              <button
                onClick={handleOnayla}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <CheckCircle className="h-4 w-4" />
                Onayla ve Forma Aktar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
