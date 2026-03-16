import { useState, useRef } from 'react'
import { Sparkles, Loader2, CheckCircle, AlertCircle, Image, Trash2 } from 'lucide-react'
import api from '@/api/client'
import { useBonoOlustur } from '@/hooks/useBonolar'
import { cn } from '@/lib/utils'

export default function BonoGiris({ onBasarili }) {
  const [dosya, setDosya] = useState(null)
  const [onizleme, setOnizleme] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState('')
  const [sonuc, setSonuc] = useState(null)
  const [kalemler, setKalemler] = useState([])
  const [bonoInfo, setBonoInfo] = useState({ bono_no: '', bono_tarihi: '', kurum: '', teslim_alan: '', aciklama: '' })
  const [eslestiriliyor, setEslestiriliyor] = useState(false)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const fileInputRef = useRef(null)
  const bonoOlustur = useBonoOlustur()

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
    setKalemler([])
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
      const res = await fetch('/api/bonolar/parse', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Analiz hatasi')
      if (json.data?.parse_error) throw new Error('AI goruntuyu okuyamadi. Daha net bir gorsel yukleyin.')

      const data = json.data
      setSonuc(data)
      setBonoInfo({
        bono_no: data.bono_no || '',
        bono_tarihi: data.bono_tarihi || new Date().toISOString().split('T')[0],
        kurum: data.kurum || 'EDAS',
        teslim_alan: data.teslim_alan || '',
        aciklama: data.aciklama || '',
      })

      const liste = (data.kalemler || []).map((k, i) => ({
        _id: i,
        malzeme_kodu: k.malzeme_kodu || '',
        poz_no: k.poz_no || '',
        malzeme_adi: k.malzeme_adi || '',
        birim: k.birim || 'Ad',
        miktar: k.miktar || 1,
        _secili: true,
      }))
      setKalemler(liste)

      if (liste.length > 0) katalogEslestir(liste)
    } catch (err) {
      setHata(err.message || 'Analiz sirasinda hata olustu')
    } finally {
      setYukleniyor(false)
    }
  }

  const katalogEslestir = async (liste) => {
    setEslestiriliyor(true)
    try {
      const eslesmeRes = await api.post('/malzeme-katalog/eslestir', { kalemler: liste })
      const eslesmeler = eslesmeRes?.data || []
      setKalemler(prev => prev.map((k, i) => {
        const e = eslesmeler[i]?.eslesme
        if (e) {
          return {
            ...k,
            malzeme_kodu: e.malzeme_kodu || k.malzeme_kodu,
            poz_no: e.poz_birlesik || k.poz_no,
            malzeme_adi: e.malzeme_cinsi || e.malzeme_tanimi_sap || k.malzeme_adi,
            birim: e.olcu || k.birim,
            _katalog_eslesme: true,
          }
        }
        return { ...k, _katalog_eslesme: false }
      }))
    } catch { /* opsiyonel */ }
    setEslestiriliyor(false)
  }

  const handleKalemDegistir = (id, alan, deger) => {
    setKalemler(prev => prev.map(k => k._id === id ? { ...k, [alan]: deger } : k))
  }

  const handleKalemSil = (id) => {
    setKalemler(prev => prev.filter(k => k._id !== id))
  }

  const handleKalemSecToggle = (id) => {
    setKalemler(prev => prev.map(k => k._id === id ? { ...k, _secili: !k._secili } : k))
  }

  const handleOnayla = async () => {
    const seciliKalemler = kalemler.filter(k => k._secili && k.malzeme_adi)
    if (seciliKalemler.length === 0) {
      setHata('En az bir malzeme secilmelidir')
      return
    }
    if (!bonoInfo.bono_no) {
      setHata('Bono no zorunludur')
      return
    }
    if (!bonoInfo.bono_tarihi) {
      setHata('Bono tarihi zorunludur')
      return
    }

    setKaydediliyor(true)
    try {
      await bonoOlustur.mutateAsync({
        ...bonoInfo,
        kalemler: seciliKalemler.map(({ _id, _secili, _katalog_eslesme, ...rest }) => rest),
      })
      onBasarili?.()
    } catch (err) {
      setHata(err.message || 'Bono kaydedilirken hata olustu')
    } finally {
      setKaydediliyor(false)
    }
  }

  const seciliSayisi = kalemler.filter(k => k._secili).length

  return (
    <div className="space-y-4">
      {/* Dosya yukleme */}
      {!sonuc && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Bono gorselini yukleyin, AI analiz ederek malzemeleri otomatik cikaracaktir.
          </p>
          <div
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors',
              dosya ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/50 hover:bg-muted/30'
            )}
          >
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleDosyaSec} className="hidden" />
            {onizleme ? (
              <img src={onizleme} alt="Bono onizleme" className="max-h-64 rounded-lg object-contain" />
            ) : (
              <>
                <Image className="mb-2 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">Bono gorselini yuklemek icin tiklayin</p>
                <p className="mt-1 text-xs text-muted-foreground/70">JPG, PNG formatlarinda</p>
              </>
            )}
          </div>
          {dosya && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{dosya.name}</span>
              <button
                onClick={handleAnaliz}
                disabled={yukleniyor}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {yukleniyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {yukleniyor ? 'Analiz ediliyor...' : 'AI ile Analiz Et'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Hata */}
      {hata && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {hata}
        </div>
      )}

      {/* Sonuc - Bono bilgileri */}
      {sonuc && (
        <>
          <div className="rounded-lg border border-input bg-muted/30 p-4">
            <h4 className="mb-3 text-sm font-semibold">Bono Bilgileri</h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="text-xs text-muted-foreground">Bono No *</label>
                <input
                  value={bonoInfo.bono_no}
                  onChange={e => setBonoInfo({ ...bonoInfo, bono_no: e.target.value })}
                  className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tarih *</label>
                <input
                  type="date"
                  value={bonoInfo.bono_tarihi}
                  onChange={e => setBonoInfo({ ...bonoInfo, bono_tarihi: e.target.value })}
                  className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Kurum</label>
                <input
                  value={bonoInfo.kurum}
                  onChange={e => setBonoInfo({ ...bonoInfo, kurum: e.target.value })}
                  className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Teslim Alan</label>
                <input
                  value={bonoInfo.teslim_alan}
                  onChange={e => setBonoInfo({ ...bonoInfo, teslim_alan: e.target.value })}
                  className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs text-muted-foreground">Aciklama</label>
              <input
                value={bonoInfo.aciklama}
                onChange={e => setBonoInfo({ ...bonoInfo, aciklama: e.target.value })}
                className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Kalemler tablosu */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold">
                Malzeme Kalemleri
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({seciliSayisi}/{kalemler.length} secili)
                </span>
              </h4>
              {eslestiriliyor && (
                <span className="flex items-center gap-1 text-xs text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" /> Katalog eslestiriliyor...
                </span>
              )}
            </div>
            <div className="overflow-hidden rounded-lg border border-input">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-input bg-muted/50">
                      <th className="px-2 py-2 w-8">
                        <input
                          type="checkbox"
                          checked={seciliSayisi === kalemler.length}
                          onChange={() => {
                            const tumSecili = seciliSayisi === kalemler.length
                            setKalemler(prev => prev.map(k => ({ ...k, _secili: !tumSecili })))
                          }}
                          className="rounded"
                        />
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">Malzeme Kodu</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">Poz No</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">Malzeme Adi</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">Birim</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">Miktar</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-20">Eslesme</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {kalemler.map((k) => (
                      <tr key={k._id} className={cn(
                        'border-b border-input/50 transition-colors',
                        !k._secili && 'opacity-40'
                      )}>
                        <td className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={k._secili}
                            onChange={() => handleKalemSecToggle(k._id)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={k.malzeme_kodu}
                            onChange={e => handleKalemDegistir(k._id, 'malzeme_kodu', e.target.value)}
                            className="w-24 rounded border border-input bg-background px-1.5 py-1 text-xs font-mono"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={k.poz_no}
                            onChange={e => handleKalemDegistir(k._id, 'poz_no', e.target.value)}
                            className="w-28 rounded border border-input bg-background px-1.5 py-1 text-xs font-mono"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={k.malzeme_adi}
                            onChange={e => handleKalemDegistir(k._id, 'malzeme_adi', e.target.value)}
                            className="w-full min-w-[200px] rounded border border-input bg-background px-1.5 py-1 text-xs"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={k.birim}
                            onChange={e => handleKalemDegistir(k._id, 'birim', e.target.value)}
                            className="w-14 rounded border border-input bg-background px-1.5 py-1 text-xs"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            value={k.miktar}
                            onChange={e => handleKalemDegistir(k._id, 'miktar', Number(e.target.value) || 0)}
                            className="w-16 rounded border border-input bg-background px-1.5 py-1 text-xs"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {k._katalog_eslesme === true && <CheckCircle className="inline h-4 w-4 text-emerald-500" />}
                          {k._katalog_eslesme === false && <AlertCircle className="inline h-4 w-4 text-amber-500" />}
                        </td>
                        <td className="px-2 py-1.5">
                          <button onClick={() => handleKalemSil(k._id)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {kalemler.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                          Parse sonucunda malzeme bulunamadi
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Aksiyon butonlari */}
          <div className="flex items-center justify-between border-t border-input pt-4">
            <button
              onClick={() => { setSonuc(null); setKalemler([]); setDosya(null); setOnizleme(null); setHata('') }}
              className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Yeniden Yukle
            </button>
            <button
              onClick={handleOnayla}
              disabled={kaydediliyor || seciliSayisi === 0}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {kaydediliyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {kaydediliyor ? 'Kaydediliyor...' : `Onayla ve Kaydet (${seciliSayisi} kalem)`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
