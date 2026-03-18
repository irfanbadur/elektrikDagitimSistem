import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, Loader2, X, CheckCircle, AlertCircle, FileSpreadsheet, Search, Link2, Unlink, ChevronDown, Trash2 } from 'lucide-react'
import api from '@/api/client'
import { extractKgKmOran, isMtBirim, isKgBirim } from './DemontajListesiDuzenle'
import { cn } from '@/lib/utils'

// Katalog seçim dropdown'u — unmatched kalemler için, Excel adıyla otomatik arama başlatır
function KatalogSecDropdown({ excelAdi, onSec }) {
  const [acik, setAcik] = useState(false)
  const [arama, setArama] = useState('')
  const [sonuclar, setSonuclar] = useState([])
  const [araniyor, setAraniyor] = useState(false)
  const dropdownRef = useRef(null)
  const aramaRef = useRef(null)
  const aramaTimer = useRef(null)
  const buttonRef = useRef(null)
  const [dropdownPos, setDropdownPos] = useState(null)

  const aramaYap = useCallback((text) => {
    if (aramaTimer.current) clearTimeout(aramaTimer.current)
    if (!text || text.length < 1) { setSonuclar([]); setAraniyor(false); return }
    setAraniyor(true)
    aramaTimer.current = setTimeout(async () => {
      try {
        const res = await api.get('/malzeme-katalog', { params: { arama: text } })
        setSonuclar(res?.data || [])
      } catch { setSonuclar([]) }
      setAraniyor(false)
    }, 300)
  }, [])

  useEffect(() => () => { if (aramaTimer.current) clearTimeout(aramaTimer.current) }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) setAcik(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleAc = () => {
    if (!acik) {
      setAcik(true)
      const q = excelAdi || ''
      setArama(q)
      if (q) aramaYap(q)
      setTimeout(() => aramaRef.current?.focus(), 50)
    } else {
      setAcik(false)
    }
  }

  useEffect(() => {
    if (!acik || !buttonRef.current) { setDropdownPos(null); return }
    const rect = buttonRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < 260 && rect.top > spaceBelow
    setDropdownPos({
      position: 'fixed',
      left: rect.left,
      width: 600,
      zIndex: 9999,
      ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    })
  }, [acik])

  const handleSec = (item) => {
    onSec(item)
    setAcik(false)
  }

  return (
    <div className="inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleAc}
        className="flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
      >
        <Search className="h-3 w-3" />
        Katalog Seç
        <ChevronDown className={cn('h-3 w-3 transition-transform', acik && 'rotate-180')} />
      </button>

      {acik && dropdownPos && createPortal(
        <div ref={dropdownRef} style={dropdownPos} className="rounded-lg border border-input bg-card shadow-xl overflow-hidden">
          <div className="border-b border-input p-2 bg-muted/30">
            <input
              ref={aramaRef}
              value={arama}
              onChange={e => { setArama(e.target.value); aramaYap(e.target.value) }}
              placeholder="Katalogda ara..."
              className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:border-primary"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {araniyor ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                <Loader2 className="inline h-3 w-3 animate-spin mr-1" />Araniyor...
              </div>
            ) : !arama ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">Aramak için yazmaya başlayın</div>
            ) : sonuclar.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">Katalogda bulunamadı</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm">
                  <tr className="border-b border-input">
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-muted-foreground">Poz</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-muted-foreground">Malzeme</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-muted-foreground">SAP Tanım</th>
                    <th className="px-2 py-1.5 text-center text-[10px] font-medium text-muted-foreground">Birim</th>
                  </tr>
                </thead>
                <tbody>
                  {sonuclar.slice(0, 20).map(item => (
                    <tr
                      key={item.id}
                      onMouseDown={() => handleSec(item)}
                      className="cursor-pointer border-b border-input/30 hover:bg-primary/5 transition-colors"
                    >
                      <td className="px-2 py-1.5 font-mono text-blue-600 whitespace-nowrap">{item.poz_birlesik || '-'}</td>
                      <td className="px-2 py-1.5">{item.malzeme_cinsi || '-'}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{item.malzeme_tanimi_sap || '-'}</td>
                      <td className="px-2 py-1.5 text-center text-muted-foreground">{item.olcu || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// Tablo satırı — matched (yeşil) / unmatched (amber) görsel ayrımı
function KesifKalemSatir({ kalem, index, onChange, onSil }) {
  const eslesti = !!kalem.katalog_eslesme

  const handleKatalogSec = (item) => {
    const katalogBirim = item.olcu || ''
    let orijinalBirim = kalem.birim || 'Ad'
    const kgKmOranHam = extractKgKmOran(`${item.malzeme_cinsi || ''} ${item.malzeme_tanimi_sap || ''}`)
    if (kgKmOranHam && orijinalBirim.toLowerCase() === 'ad') orijinalBirim = 'm'
    const birimFarkli = katalogBirim && orijinalBirim &&
      katalogBirim.toLowerCase().replace(/\./g, '') !== orijinalBirim.toLowerCase().replace(/\./g, '')
    const kgKmOran = birimFarkli ? kgKmOranHam : null
    let yeniMiktar = kalem.miktar
    if (kgKmOran && birimFarkli) {
      if (isMtBirim(orijinalBirim) && isKgBirim(katalogBirim))
        yeniMiktar = Math.round(kalem.miktar * kgKmOran / 1000 * 100) / 100
      else if (isKgBirim(orijinalBirim) && isMtBirim(katalogBirim))
        yeniMiktar = Math.round(kalem.miktar / kgKmOran * 1000 * 100) / 100
    }
    onChange(index, {
      ...kalem,
      malzeme_adi: item.malzeme_cinsi || item.malzeme_tanimi_sap || kalem.malzeme_adi,
      malzeme_kodu: item.malzeme_kodu || '',
      poz_no: item.poz_birlesik || '',
      birim: katalogBirim || kalem.birim,
      miktar: yeniMiktar,
      katalog_eslesme: item.malzeme_cinsi || item.malzeme_tanimi_sap,
      _eslesmedi: false,
    })
  }

  const handleEslesmeKaldir = () => {
    onChange(index, {
      ...kalem,
      malzeme_adi: kalem._excel_adi || kalem.malzeme_adi,
      malzeme_kodu: '',
      poz_no: '',
      katalog_eslesme: null,
      _eslesmedi: true,
    })
  }

  return (
    <tr className={cn(
      'border-b border-input/50 group transition-colors',
      eslesti ? 'hover:bg-emerald-50/20' : 'bg-amber-50/10 hover:bg-amber-50/30'
    )}>
      <td className="w-8 px-2 py-2 text-center text-xs text-muted-foreground">{index + 1}</td>

      {/* Malzeme sütunu */}
      <td className="px-2 py-2">
        <div className="flex items-start gap-1.5">
          {eslesti
            ? <Link2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
            : <Unlink className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
          }
          <div className="min-w-0 flex-1">
            {/* Excel orijinal adı — katalog adından farklıysa göster */}
            {kalem._excel_adi && kalem._excel_adi !== kalem.malzeme_adi && (
              <div className="text-[10px] text-muted-foreground truncate">Excel: {kalem._excel_adi}</div>
            )}
            {eslesti ? (
              <div className="text-xs font-medium text-emerald-700">{kalem.katalog_eslesme}</div>
            ) : (
              <div className="text-xs text-foreground">{kalem._excel_adi || kalem.malzeme_adi}</div>
            )}
          </div>
        </div>
      </td>

      {/* Kod sütunu */}
      <td className="w-24 px-2 py-2">
        <span className="text-[10px] font-mono text-muted-foreground">{kalem.malzeme_kodu || '-'}</span>
      </td>

      {/* Birim sütunu */}
      <td className="w-16 px-2 py-2 text-center">
        <input
          value={kalem.birim || 'Ad'}
          onChange={e => onChange(index, { ...kalem, birim: e.target.value })}
          className="w-12 rounded border border-transparent bg-transparent px-1 py-0.5 text-center text-xs hover:border-input focus:border-primary focus:outline-none"
        />
      </td>

      {/* Miktar sütunu */}
      <td className="w-16 px-2 py-2 text-center">
        <input
          type="number"
          value={kalem.miktar || ''}
          onChange={e => onChange(index, { ...kalem, miktar: Number(e.target.value) || 0 })}
          className="w-14 rounded border border-transparent bg-transparent px-1 py-0.5 text-center text-xs hover:border-input focus:border-primary focus:outline-none"
        />
      </td>

      {/* Katalog aksiyon sütunu */}
      <td className="w-28 px-2 py-2">
        {!eslesti ? (
          <KatalogSecDropdown
            excelAdi={kalem._excel_adi || kalem.malzeme_adi}
            onSec={handleKatalogSec}
          />
        ) : (
          <button
            type="button"
            onClick={handleEslesmeKaldir}
            className="flex items-center gap-0.5 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
            title="Eşleşmeyi kaldır ve yeniden seç"
          >
            <X className="h-3 w-3" />
            Değiştir
          </button>
        )}
      </td>

      {/* Sil sütunu */}
      <td className="w-8 px-1 py-2 text-center">
        <button
          type="button"
          onClick={() => onSil(index)}
          className="rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-opacity"
          title="Satırı sil"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
}

export default function KesifParseModal({ projeId, dosyaId, dosyaAdi, onKapat, onBasarili }) {
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hataMsg, setHataMsg] = useState('')
  const [kalemler, setKalemler] = useState([])
  const [eslestiriliyor, setEslestiriliyor] = useState(false)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [kaynak, setKaynak] = useState('')
  const parsed = kalemler.length > 0

  const eslesmisler = kalemler.filter(k => k.katalog_eslesme)
  const eslesmemisler = kalemler.filter(k => !k.katalog_eslesme)

  const handleAnaliz = async () => {
    setYukleniyor(true)
    setHataMsg('')
    try {
      const res = await api.post(`/proje-kesif/${projeId}/parse-xls`, { dosya_id: dosyaId })
      const data = res.data || res
      setKaynak(data.kaynak || '')
      const liste = (data.kalemler || []).map(k => ({
        _id: Date.now() + Math.random(),
        malzeme_adi: k.malzeme_adi || '',
        _excel_adi: k.malzeme_adi || '',   // orijinal Excel adını koru
        malzeme_kodu: k.malzeme_kodu || '',
        poz_no: k.poz_no || '',
        birim: k.birim || 'Ad',
        miktar: k.miktar || 0,
        katalog_eslesme: null,
        _eslesmedi: false,
      }))
      setKalemler(liste)
      if (liste.length > 0) katalogEslestir(liste)
    } catch (err) {
      setHataMsg(err.message || 'XLS analizi sirasinda hata olustu')
    } finally {
      setYukleniyor(false)
    }
  }

  const katalogEslestir = async (liste) => {
    setEslestiriliyor(true)
    try {
      const eslesmeRes = await api.post('/malzeme-katalog/eslestir', { kalemler: liste })
      const eslesmeler = eslesmeRes?.data || eslesmeRes || []
      setKalemler(prev => prev.map((k, i) => {
        const e = eslesmeler[i]?.eslesme
        if (e) {
          const katalogBirim = e.olcu || ''
          let orijinalBirim = k.birim || 'Ad'
          const kgKmOranHam = extractKgKmOran(`${e.malzeme_cinsi || ''} ${e.malzeme_tanimi_sap || ''}`)
          if (kgKmOranHam && orijinalBirim.toLowerCase() === 'ad') orijinalBirim = 'm'
          const birimFarkli = katalogBirim && orijinalBirim &&
            katalogBirim.toLowerCase().replace(/\./g, '') !== orijinalBirim.toLowerCase().replace(/\./g, '')
          const kgKmOran = birimFarkli ? kgKmOranHam : null
          let yeniMiktar = k.miktar
          if (kgKmOran && birimFarkli) {
            if (isMtBirim(orijinalBirim) && isKgBirim(katalogBirim))
              yeniMiktar = Math.round(k.miktar * kgKmOran / 1000 * 100) / 100
            else if (isKgBirim(orijinalBirim) && isMtBirim(katalogBirim))
              yeniMiktar = Math.round(k.miktar / kgKmOran * 1000 * 100) / 100
          }
          return {
            ...k,
            malzeme_adi: e.malzeme_cinsi || e.malzeme_tanimi_sap || k.malzeme_adi,
            malzeme_kodu: e.malzeme_kodu || '',
            poz_no: e.poz_birlesik || k.poz_no,
            birim: katalogBirim || k.birim,
            miktar: yeniMiktar,
            katalog_eslesme: e.malzeme_cinsi || e.malzeme_tanimi_sap,
            _eslesmedi: false,
          }
        }
        return { ...k, _eslesmedi: true }
      }))
    } catch { /* eslestirme opsiyonel */ }
    setEslestiriliyor(false)
  }

  const handleDegistir = (index, yeni) => {
    setKalemler(prev => prev.map((k, i) => i === index ? yeni : k))
  }

  const handleSil = (index) => {
    setKalemler(prev => prev.filter((_, i) => i !== index))
  }

  const handleKaydet = async () => {
    const gecerliListe = kalemler.filter(k => k.malzeme_adi && k.malzeme_adi.trim())
    if (gecerliListe.length === 0) return
    setKaydediliyor(true)
    try {
      await api.post(`/proje-kesif/${projeId}/toplu`, {
        kalemler: gecerliListe.map(k => ({
          malzeme_kodu: k.malzeme_kodu || null,
          poz_no: k.poz_no || null,
          malzeme_adi: k.malzeme_adi,
          birim: k.birim || 'Ad',
          miktar: k.miktar || 0,
          birim_fiyat: 0,
        }))
      })
      onBasarili?.()
      onKapat()
    } catch (err) {
      setHataMsg(err.message || 'Kaydetme hatasi')
    } finally {
      setKaydediliyor(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onKapat}>
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-card shadow-xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-input px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Keşif XLS Parse</h3>
          </div>
          <button onClick={onKapat} className="rounded p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!parsed ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                XLS/XLSX dosyasını analiz ederek keşif malzeme listesini otomatik olarak doldurun.
              </p>
              <div className="flex items-center gap-3 rounded-lg border border-input bg-muted/30 px-4 py-3">
                <FileSpreadsheet className="h-8 w-8 text-green-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{dosyaAdi}</p>
                  <p className="text-xs text-muted-foreground">Analiz edilecek dosya</p>
                </div>
              </div>
              {hataMsg && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />{hataMsg}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Özet bar */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700">
                  <CheckCircle className="h-4 w-4" />
                  <span><strong>{eslesmisler.length}</strong> kalem katalogla eşleşti</span>
                </div>
                {eslesmemisler.length > 0 && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-700">
                    <Unlink className="h-4 w-4" />
                    <span><strong>{eslesmemisler.length}</strong> kalem manuel seçim bekliyor</span>
                  </div>
                )}
                {eslestiriliyor && (
                  <div className="flex items-center gap-1.5 text-xs text-primary">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Katalog eşleştiriliyor...
                  </div>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {kaynak === 'deterministik' ? 'Otomatik parse' : 'AI analizi'} · {kalemler.length} kalem
                </span>
              </div>

              {hataMsg && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{hataMsg}
                </div>
              )}

              {/* Tablo */}
              <div className="overflow-x-auto rounded-lg border border-input bg-card">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-input bg-muted/50">
                      <th className="w-8 px-2 py-2 text-center font-medium text-muted-foreground">#</th>
                      <th className="px-2 py-2 text-left font-medium text-muted-foreground">Malzeme</th>
                      <th className="w-24 px-2 py-2 text-left font-medium text-muted-foreground">Kod</th>
                      <th className="w-16 px-2 py-2 text-center font-medium text-muted-foreground">Birim</th>
                      <th className="w-16 px-2 py-2 text-center font-medium text-muted-foreground">Miktar</th>
                      <th className="w-28 px-2 py-2 font-medium text-muted-foreground">Katalog</th>
                      <th className="w-8 px-1 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {kalemler.map((k, i) => (
                      <KesifKalemSatir key={k._id || i} kalem={k} index={i} onChange={handleDegistir} onSil={handleSil} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-input px-5 py-4">
          <button onClick={onKapat} className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-muted">İptal</button>
          {!parsed ? (
            <button
              onClick={handleAnaliz}
              disabled={yukleniyor}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {yukleniyor
                ? <><Loader2 className="h-4 w-4 animate-spin" />Analiz Ediliyor...</>
                : <><Sparkles className="h-4 w-4" />Analiz Et</>}
            </button>
          ) : (
            <>
              <button
                onClick={() => { setKalemler([]); setHataMsg('') }}
                className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-muted"
              >
                Tekrar Dene
              </button>
              <button
                onClick={handleKaydet}
                disabled={kaydediliyor}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {kaydediliyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {kaydediliyor ? 'Kaydediliyor...' : `${kalemler.filter(k => k.malzeme_adi?.trim()).length} Kalemi Kaydet`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
