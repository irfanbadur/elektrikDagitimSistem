import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Trash2, BarChart3, Ruler, MapPin, FileSpreadsheet, Upload, Loader2, ExternalLink, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useHakEdisMetraj, useHakEdisMetrajOzet, useHakEdisMetrajEkle, useHakEdisMetrajGuncelle, useHakEdisMetrajSil } from '@/hooks/useHakEdisMetraj'
import api from '@/api/client'
import { cn } from '@/lib/utils'

// ── Sabitler (popup'tan taşındı) ──
const DURUM_SECENEKLERI = ['Yeni', 'Mevcut', 'Demontaj']
const DURUM_RENK = { Yeni: 'text-emerald-600', Mevcut: 'text-blue-600', Demontaj: 'text-red-600' }

const TUR_SECENEKLERI = [
  'Agac Direk', 'AG Direk', 'Musterek Direk', 'Trafo Diregi',
  'Buyuk Aralikli Swallow Direk', 'Buyuk Aralikli Pigeon Direk', 'Buyuk Aralikli Raven Direk',
  'Civatali Trafo Diregi', 'Civatali Buyuk Aralikli Direk',
  'Civatali 3/0 Tek Devre Direk', 'Civatali 3/0 Cift Devre Direk',
  'Civatali 477 Cift Devre Direk', 'Civatali 477 Dort Devre Direk', 'Betonarme Direkler',
]

const TIP_TUR_MAP = {
  '9-O': 'Agac Direk', '12-O': 'Agac Direk',
  '8I': 'AG Direk', '10I': 'AG Direk', '10U': 'AG Direk', '12I': 'AG Direk', '12U': 'AG Direk',
  'K1': 'AG Direk', 'K1+2': 'AG Direk', 'K2': 'AG Direk', 'K2+2': 'AG Direk', 'K3': 'AG Direk', 'K4': 'AG Direk', 'K5': 'AG Direk',
  '10I"': 'Musterek Direk', '12I"': 'Musterek Direk', 'K1"': 'Musterek Direk', 'K2"': 'Musterek Direk',
  'T15': 'Trafo Diregi', 'T25': 'Trafo Diregi', 'T35': 'Trafo Diregi', 'T50': 'Trafo Diregi',
  'D10': 'Buyuk Aralikli Swallow Direk', 'D12': 'Buyuk Aralikli Swallow Direk', 'D14': 'Buyuk Aralikli Swallow Direk',
}
const BILINEN_TIPLER = Object.keys(TIP_TUR_MAP)

// ── Tek malzeme satırı: ad tıkla→arama, miktar düzenle, sil ──
function MalzemeSatirDuzenle({ malzeme, onAdiDegistir, onKisaIsimDegistir, onMiktarDegistir, onGorunurDegistir, onSil }) {
  const [duzenle, setDuzenle] = useState(false)
  const [aramaVal, setAramaVal] = useState('')
  const [sonuclar, setSonuclar] = useState([])
  const [araniyor, setAraniyor] = useState(false)
  const [secIdx, setSecIdx] = useState(-1)
  const timerRef = useRef(null)

  const araFunc = (text) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!text || text.length < 2) { setSonuclar([]); return }
    setAraniyor(true)
    timerRef.current = setTimeout(async () => {
      try {
        const r = await api.get('/malzeme-katalog', { params: { arama: text } })
        setSonuclar((Array.isArray(r) ? r : (r?.data || [])).slice(0, 8))
      } catch { setSonuclar([]) }
      setAraniyor(false)
    }, 300)
  }
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])
  useEffect(() => { setSecIdx(-1) }, [sonuclar])

  const secVeKapat = (item) => {
    onAdiDegistir(item.malzeme_cinsi || item.malzeme_tanimi_sap || '')
    setDuzenle(false); setSonuclar([])
  }

  const handleKeyDown = (e) => {
    if (!sonuclar.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSecIdx(p => Math.min(p + 1, sonuclar.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSecIdx(p => Math.max(p - 1, 0)) }
    else if (e.key === 'Enter' && secIdx >= 0) { e.preventDefault(); secVeKapat(sonuclar[secIdx]) }
    else if (e.key === 'Escape') { setDuzenle(false); setSonuclar([]) }
  }

  if (duzenle) {
    return (
      <div className="relative border-b border-border/10 py-0.5">
        <div className="flex items-center gap-1">
          <input value={aramaVal} onChange={e => { setAramaVal(e.target.value); araFunc(e.target.value) }}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => { setDuzenle(false); setSonuclar([]) }, 200)}
            autoFocus placeholder="Malzeme ara..."
            className="flex-1 rounded border border-primary bg-white px-1 py-0.5 text-[10px] focus:outline-none" />
          <button onClick={() => { setDuzenle(false); setSonuclar([]) }} className="text-muted-foreground text-[10px] px-1">✕</button>
        </div>
        {(araniyor || sonuclar.length > 0) && (
          <div className="absolute left-0 top-full z-50 mt-0.5 w-full max-h-32 overflow-y-auto rounded border border-border bg-white shadow-lg">
            {araniyor ? <div className="px-2 py-1 text-[10px] text-muted-foreground">Araniyor...</div> : (
              sonuclar.map((item, i) => (
                <button key={item.id} onMouseDown={e => { e.preventDefault(); secVeKapat(item) }}
                  className={cn("flex w-full items-center gap-1 px-2 py-1 text-[10px] text-left border-b border-border/20", i === secIdx ? 'bg-primary/10' : 'hover:bg-primary/5')}>
                  <span className="font-mono text-blue-600 w-14 shrink-0 truncate">{item.malzeme_kodu || '-'}</span>
                  <span className="flex-1 truncate">{item.malzeme_cinsi || item.malzeme_tanimi_sap}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-1 text-[10px] py-0.5 border-b border-border/10", malzeme.gorunur === false && "opacity-50")}>
      <input type="checkbox" checked={malzeme.gorunur !== false}
        onChange={e => onGorunurDegistir(e.target.checked)}
        title="Sahnede göster" className="h-3 w-3 accent-primary cursor-pointer shrink-0" />
      <input value={malzeme.kisaIsim || ''} onChange={e => onKisaIsimDegistir(e.target.value)}
        placeholder="kısa" title="Kısa isim (sprite text'te görünür)"
        className="w-16 rounded border border-input bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-700 focus:outline-none focus:border-amber-400" />
      <span className="flex-1 truncate cursor-pointer hover:text-primary hover:underline" title={`${malzeme.adi} — tıkla değiştir`}
        onClick={() => { setDuzenle(true); setAramaVal(malzeme.adi) }}>{malzeme.adi}</span>
      <input type="number" value={malzeme.miktar} min={1}
        onChange={e => onMiktarDegistir(Number(e.target.value) || 1)}
        className="w-10 rounded border border-input px-0.5 py-0.5 text-center text-[10px]" />
      <button onClick={onSil} className="text-red-400 hover:text-red-600 p-0.5 shrink-0"><Trash2 className="h-2.5 w-2.5" /></button>
    </div>
  )
}

// ── Otomatik malzeme kuralları ──
function hesaplaOtoMalzemeler(tip, yakinlar) {
  const oto = []
  const hasPotans = /\(P\)/i.test(tip || '')
  if (hasPotans) oto.push({ adi: 'T-AG-5(L3=150cm)', miktar: 1, birim: 'Ad', gorunur: false })
  if (yakinlar?.armatur) oto.push({ adi: 'ARM. LED KOR. SINIF 1 S15/8/1', miktar: 1, birim: 'Ad', gorunur: false })
  if (yakinlar?.koruma) {
    oto.push({ adi: '2m Galvanizli 65x65x7 Kosebent', miktar: 1, birim: 'Ad', gorunur: false })
    oto.push({ adi: '95 mm2 Galvanizli Celik Iletken ve gomulmesi', miktar: 5, birim: 'm', gorunur: false })
  }
  if (yakinlar?.isletme) {
    oto.push({ adi: '2m Galvanizli 65x65x7 Kosebent', miktar: 1, birim: 'Ad', gorunur: false })
    oto.push({ adi: '95 mm2 NAYY kablo ve gomulmesi', miktar: 30, birim: 'm', gorunur: false })
  }
  return oto
}

// ── Direk accordion satırı ──
function DirekDetay({ satir: s, acik, onToggle, onGuncelle, onSil, secili, onSecim, projeId, onSpriteGuncelle }) {
  // Notlar format: "miktar|kisaisim|tamadi|gorunur" veya eski "Nx tamadi"
  const notSatirlari = (s.notlar || '').split('\n').filter(Boolean)
  const malzemeSatirlari = notSatirlari.filter(n => !n.startsWith('Iletken:')).map(satir => {
    const pParts = satir.split('|')
    if (pParts.length >= 4) return { miktar: Number(pParts[0]) || 1, kisaIsim: pParts[1], adi: pParts[2], gorunur: pParts[3] !== '0' }
    if (pParts.length >= 3) return { miktar: Number(pParts[0]) || 1, kisaIsim: pParts[1], adi: pParts[2], gorunur: true }
    if (pParts.length === 2) return { miktar: Number(pParts[0]) || 1, kisaIsim: '', adi: pParts[1], gorunur: true }
    const m = satir.match(/^(\d+)x\s*(.+)$/)
    return m ? { miktar: Number(m[1]), kisaIsim: '', adi: m[2], gorunur: true } : { miktar: 1, kisaIsim: '', adi: satir, gorunur: true }
  })
  const iletkenSatirlari = notSatirlari.filter(n => n.startsWith('Iletken:')).map(n => n.replace('Iletken: ', ''))

  // Notları yeniden oluşturup kaydet — format: "miktar|kisaisim|tamadi|gorunur"
  const notlariKaydet = (malzList, iltkList) => {
    const yeniNotlar = [
      ...malzList.map(m => `${m.miktar}|${m.kisaIsim || ''}|${m.adi}|${m.gorunur === false ? '0' : '1'}`),
      ...iltkList.map(il => `Iletken: ${il}`),
    ].join('\n')
    onGuncelle('notlar', yeniNotlar)
    // Sprite text — sadece gorunur=true olanlar, kısa isim varsa onu kullan
    onSpriteGuncelle?.(s.nokta1, malzList.filter(m => m.gorunur !== false).map(m => `${m.miktar}x ${m.kisaIsim || m.adi}`))
  }

  // Tip arama + otomatik tamamlama
  const [tipVal, setTipVal] = useState(s.direk_tip?.replace(/^G-/i, '').replace(/\(P\)/gi, '') || '')
  const [tipAcik, setTipAcik] = useState(false)
  const tipOnerileri = tipVal ? BILINEN_TIPLER.filter(t => t.toLowerCase().includes(tipVal.toLowerCase())).slice(0, 6) : []

  const handleTipSec = (t) => {
    setTipVal(t)
    setTipAcik(false)
    const tur = TIP_TUR_MAP[t] || ''
    onGuncelle('direk_tip', t)
    if (tur) onGuncelle('direk_tur', tur)
  }

  // Malzeme arama
  const [arama, setArama] = useState('')
  const [sonuclar, setSonuclar] = useState([])
  const [araniyor, setAraniyor] = useState(false)
  const [secIdx, setSecIdx] = useState(-1)
  const timer = useRef(null)

  const ara = (text) => {
    if (timer.current) clearTimeout(timer.current)
    if (!text || text.length < 2) { setSonuclar([]); return }
    setAraniyor(true)
    timer.current = setTimeout(async () => {
      try {
        const r = await api.get('/malzeme-katalog', { params: { arama: text } })
        setSonuclar((Array.isArray(r) ? r : (r?.data || [])).slice(0, 12))
      } catch { setSonuclar([]) }
      setAraniyor(false)
    }, 300)
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  useEffect(() => { setSecIdx(-1) }, [sonuclar])

  const handleMalzemeEkle = (item) => {
    const yeniMalz = [...malzemeSatirlari, { miktar: 1, adi: item.malzeme_cinsi || item.malzeme_tanimi_sap || '' }]
    notlariKaydet(yeniMalz, iletkenSatirlari)
    setArama(''); setSonuclar([])
  }

  const handleKeyDown = (e) => {
    if (!sonuclar.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSecIdx(p => Math.min(p + 1, sonuclar.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSecIdx(p => Math.max(p - 1, 0)) }
    else if (e.key === 'Enter' && secIdx >= 0) { e.preventDefault(); handleMalzemeEkle(sonuclar[secIdx]) }
    else if (e.key === 'Escape') { setSonuclar([]); setArama('') }
  }

  // İletken ekleme
  const [iletkenVal, setIletkenVal] = useState('')
  const handleIletkenEkle = () => {
    if (!iletkenVal.trim()) return
    notlariKaydet(malzemeSatirlari, [...iletkenSatirlari, iletkenVal.trim()])
    setIletkenVal('')
  }

  // İletken ekleme sonrası da notlariKaydet kullan

  return (
    <>
      {/* Ana satır */}
      <div onClick={onToggle}
        className={cn('flex items-center gap-2 px-3 py-2 border-b border-input/50 cursor-pointer transition-colors',
          acik ? 'bg-primary/5' : 'hover:bg-muted/30', secili && 'bg-red-50/50')}>
        <input type="checkbox" checked={secili} onClick={e => e.stopPropagation()} onChange={e => onSecim(e.target.checked)}
          className="h-3.5 w-3.5 accent-primary cursor-pointer" />
        {acik ? <ChevronDown className="h-3.5 w-3.5 text-primary" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="font-mono text-xs font-bold text-primary w-10">{s.nokta1 || '-'}</span>
        <span className={cn('text-[10px] font-medium w-14', DURUM_RENK[s.nokta_durum])}>{s.nokta_durum || '-'}</span>
        <span className="text-[10px] text-muted-foreground w-20 truncate">{s.direk_tur || '-'}</span>
        <span className="text-[10px] font-mono text-emerald-600 w-14">{s.direk_tip || '-'}</span>
        <span className="text-[10px] tabular-nums font-medium w-12 text-right">{s.ara_mesafe ? `${s.ara_mesafe}m` : '-'}</span>
        <span className="text-[9px] text-muted-foreground flex-1 truncate ml-2">{malzemeSatirlari.length} malzeme, {iletkenSatirlari.length} iletken</span>
        <button onClick={e => { e.stopPropagation(); onSil() }} className="rounded p-0.5 text-muted-foreground hover:bg-red-50 hover:text-red-600" title="Sil">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Detay paneli */}
      {acik && (
        <div className="border-b border-input bg-muted/10 px-4 py-3 space-y-3">
          {/* Üst: Durum + Tür + Tip + Mesafe */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
            <label className="flex items-center gap-1">
              <span className="text-muted-foreground">Durum:</span>
              <select value={s.nokta_durum || ''} onChange={e => onGuncelle('nokta_durum', e.target.value)}
                className="rounded border border-input bg-white px-1 py-0.5 text-[10px]"><option value="">-</option>
                {DURUM_SECENEKLERI.map(d => <option key={d} value={d}>{d}</option>)}</select>
            </label>
            <label className="flex items-center gap-1">
              <span className="text-muted-foreground">Tur:</span>
              <select value={s.direk_tur || ''} onChange={e => onGuncelle('direk_tur', e.target.value)}
                className="rounded border border-input bg-white px-1 py-0.5 text-[10px]"><option value="">-</option>
                {TUR_SECENEKLERI.map(t => <option key={t} value={t}>{t}</option>)}</select>
            </label>
            <label className="flex items-center gap-1 relative">
              <span className="text-muted-foreground">Tip:</span>
              <input value={tipVal} onChange={e => { setTipVal(e.target.value); setTipAcik(true) }}
                onFocus={() => setTipAcik(true)} onBlur={() => setTimeout(() => setTipAcik(false), 200)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && tipOnerileri[0]) { e.preventDefault(); handleTipSec(tipOnerileri[0]) }
                }}
                className="w-20 rounded border border-input bg-white px-1 py-0.5 text-[10px] font-mono text-emerald-600" />
              {tipAcik && tipOnerileri.length > 0 && (
                <div className="absolute left-12 top-full z-50 mt-1 w-40 max-h-28 overflow-y-auto rounded border border-border bg-white shadow-lg">
                  {tipOnerileri.map(t => (
                    <button key={t} onMouseDown={e => { e.preventDefault(); handleTipSec(t) }}
                      className="flex w-full items-center justify-between px-2 py-1 text-[10px] hover:bg-primary/5 border-b border-border/20">
                      <span className="font-mono text-emerald-600">{t}</span>
                      <span className="text-muted-foreground text-[9px]">{TIP_TUR_MAP[t]}</span>
                    </button>
                  ))}
                </div>
              )}
            </label>
            <label className="flex items-center gap-1">
              <span className="text-muted-foreground">Mesafe:</span>
              <input type="number" value={s.ara_mesafe || ''} onChange={e => onGuncelle('ara_mesafe', Number(e.target.value) || 0)}
                className="w-14 rounded border border-input bg-white px-1 py-0.5 text-[10px] text-right" /><span className="text-muted-foreground">m</span>
            </label>
          </div>

          {/* Malzeme arama */}
          <div className="relative">
            <div className="flex items-center gap-1">
              <Search className="h-3 w-3 text-muted-foreground" />
              <input value={arama} onChange={e => { setArama(e.target.value); ara(e.target.value) }}
                onKeyDown={handleKeyDown} placeholder="Malzeme ara (katalog)..."
                className="flex-1 rounded border border-input bg-white px-2 py-1 text-[11px] focus:border-primary focus:outline-none" />
            </div>
            {(araniyor || sonuclar.length > 0) && (
              <div className="absolute left-0 top-full z-50 mt-1 w-full max-h-36 overflow-y-auto rounded border border-border bg-white shadow-xl">
                {araniyor ? <div className="px-3 py-2 text-[10px] text-muted-foreground"><Loader2 className="inline h-3 w-3 animate-spin mr-1" />Araniyor...</div> : (
                  sonuclar.map((item, i) => (
                    <button key={item.id} onClick={() => handleMalzemeEkle(item)}
                      className={cn('flex w-full items-center gap-2 px-2 py-1 text-left text-[10px] border-b border-border/30', i === secIdx ? 'bg-primary/10' : 'hover:bg-primary/5')}>
                      <span className="font-mono text-blue-600 w-16 shrink-0 truncate">{item.malzeme_kodu || '-'}</span>
                      <span className="flex-1 truncate">{item.malzeme_cinsi || item.malzeme_tanimi_sap || '-'}</span>
                      <Plus className="h-3 w-3 text-emerald-500 shrink-0" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Malzemeler + İletkenler alt alta */}
          <div className="space-y-2">
            {/* Malzemeler */}
            <div>
              <div className="text-[9px] font-bold text-red-600 uppercase mb-1">Malzemeler ({malzemeSatirlari.length})</div>
              {malzemeSatirlari.length === 0 ? <p className="text-[10px] text-muted-foreground/50 italic">Malzeme yok</p> : (
                malzemeSatirlari.map((m, i) => (
                  <MalzemeSatirDuzenle key={i} malzeme={m}
                    onAdiDegistir={(yeniAdi) => { const yeni = [...malzemeSatirlari]; yeni[i] = { ...m, adi: yeniAdi }; notlariKaydet(yeni, iletkenSatirlari) }}
                    onKisaIsimDegistir={(yeniKisa) => { const yeni = [...malzemeSatirlari]; yeni[i] = { ...m, kisaIsim: yeniKisa }; notlariKaydet(yeni, iletkenSatirlari) }}
                    onMiktarDegistir={(yeniMiktar) => { const yeni = [...malzemeSatirlari]; yeni[i] = { ...m, miktar: yeniMiktar }; notlariKaydet(yeni, iletkenSatirlari) }}
                    onGorunurDegistir={(g) => { const yeni = [...malzemeSatirlari]; yeni[i] = { ...m, gorunur: g }; notlariKaydet(yeni, iletkenSatirlari) }}
                    onSil={() => notlariKaydet(malzemeSatirlari.filter((_, j) => j !== i), iletkenSatirlari)}
                  />
                ))
              )}
            </div>
            {/* İletkenler */}
            <div>
              <div className="text-[9px] font-bold text-blue-600 uppercase mb-1">Iletkenler ({iletkenSatirlari.length})</div>
              <div className="flex gap-1 mb-1">
                <input value={iletkenVal} onChange={e => setIletkenVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleIletkenEkle() }}
                  placeholder="Iletken tipi gir..." className="flex-1 rounded border border-input bg-white px-2 py-0.5 text-[10px] focus:border-blue-400 focus:outline-none" />
                <button onClick={handleIletkenEkle} className="rounded bg-blue-500 px-1.5 text-white text-[10px] hover:bg-blue-600">+</button>
              </div>
              {iletkenSatirlari.map((il, i) => (
                <div key={i} className="flex items-center gap-1 text-[10px] py-0.5 border-b border-border/10">
                  <span className="flex-1 truncate text-blue-700 font-medium">{il}</span>
                  <button onClick={() => notlariKaydet(malzemeSatirlari, iletkenSatirlari.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600 p-0.5 shrink-0"><Trash2 className="h-2.5 w-2.5" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function ProjeHakEdis({ projeId, onSpriteGuncelle, seciliDirekBilgi, onSeciliDirekTemizle }) {
  const { data: satirlar, isLoading } = useHakEdisMetraj(projeId)
  const { data: ozet } = useHakEdisMetrajOzet(projeId)
  const ekle = useHakEdisMetrajEkle(projeId)
  const guncelle = useHakEdisMetrajGuncelle(projeId)
  const sil = useHakEdisMetrajSil(projeId)
  const qc = useQueryClient()
  const [seciliIdler, setSeciliIdler] = useState(new Set())
  const [acikIdler, setAcikIdler] = useState(new Set())

  // Direk tıklandığında: mevcut satır varsa aç, yoksa oluştur (oto-malzeme + tip eşleşme ile)
  useEffect(() => {
    if (!seciliDirekBilgi?.numara || isLoading) return
    const numara = seciliDirekBilgi.numara
    const mevcut = satirlar?.find(s => s.nokta1 === numara)

    if (mevcut) {
      setAcikIdler(prev => new Set([...prev, mevcut.id]))
    } else {
      // DXF'ten gelen bilgilerle yeni kayıt oluştur
      const rawTip = seciliDirekBilgi.tip || ''
      const cleanTip = rawTip.replace(/^G-/i, '').replace(/\(P\)/gi, '').trim()
      const turFromTip = TIP_TUR_MAP[cleanTip] || (rawTip.startsWith('G-') ? 'AG Direk' : '')
      const komsu = seciliDirekBilgi.komsular?.[0]

      // Oto-malzemeler
      const otoMalz = hesaplaOtoMalzemeler(rawTip, seciliDirekBilgi.yakinlar)
      const otoNotlar = otoMalz.map(m => `${m.miktar}||${m.adi}|${m.gorunur === false ? '0' : '1'}`).join('\n')

      ekle.mutateAsync({
        nokta1: numara,
        nokta2: komsu?.numara || '',
        nokta_durum: 'Yeni',
        direk_tur: turFromTip,
        direk_tip: cleanTip || rawTip,
        ara_mesafe: komsu?.mesafe || 0,
        notlar: otoNotlar,
        kaynak: 'kroki',
      }).then(res => {
        const yeniId = (res?.data || res)?.id
        if (yeniId) setAcikIdler(prev => new Set([...prev, yeniId]))
      })
    }
    onSeciliDirekTemizle?.()
  }, [seciliDirekBilgi, satirlar, isLoading])
  const [excelYukleniyor, setExcelYukleniyor] = useState(false)
  const [excelDosyaId, setExcelDosyaId] = useState(null)

  const handleYeniSatir = async () => { await ekle.mutateAsync({ nokta_durum: 'Yeni', kaynak: 'manuel' }) }

  const handleSablonKopyala = async () => {
    setExcelYukleniyor(true)
    try { const r = await api.post(`/hak-edis-metraj/${projeId}/sablon-kopyala`); setExcelDosyaId((r.data||r).dosya_id); alert((r.data||r).yeni ? 'Kopyalandi.' : 'Mevcut.') }
    catch (e) { alert(e.message) } finally { setExcelYukleniyor(false) }
  }

  const handleExcelAktar = async () => {
    setExcelYukleniyor(true)
    try { const s = await api.post(`/hak-edis-metraj/${projeId}/sablon-kopyala`); setExcelDosyaId((s.data||s).dosya_id); const a = await api.post(`/hak-edis-metraj/${projeId}/excel-aktar`); alert(`${(a.data||a).aktarilan_satir} satir aktarildi.`) }
    catch (e) { alert(e.message) } finally { setExcelYukleniyor(false) }
  }

  const handleGuncelle = (id, alan, deger) => guncelle.mutate({ id, [alan]: deger })
  const toggleAcik = (id) => setAcikIdler(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div>
      {/* Başlık */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Sebeke Metraji</h3>
          <p className="text-xs text-muted-foreground">Direk bazli malzeme ve iletken listesi</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={handleSablonKopyala} disabled={excelYukleniyor}
            className="flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
            {excelYukleniyor ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileSpreadsheet className="h-3 w-3" />} Sablon
          </button>
          <button onClick={handleExcelAktar} disabled={excelYukleniyor || !satirlar?.length}
            className="flex items-center gap-1 rounded border border-blue-300 bg-blue-50 px-2 py-1.5 text-xs text-blue-700 hover:bg-blue-100 disabled:opacity-50">
            {excelYukleniyor ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Excel
          </button>
          {excelDosyaId && <a href={`/api/dosya/${excelDosyaId}/indir`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 rounded border border-input px-2 py-1.5 text-xs text-primary hover:bg-primary/5"><ExternalLink className="h-3 w-3" /> Indir</a>}
          <button onClick={handleYeniSatir} className="flex items-center gap-1 rounded bg-primary px-2 py-1.5 text-xs font-medium text-white hover:bg-primary/90">
            <Plus className="h-3 w-3" /> Ekle
          </button>
          {seciliIdler.size > 0 && (
            <button onClick={async () => { if (!confirm(`${seciliIdler.size} satir silinecek?`)) return; for (const id of seciliIdler) await sil.mutateAsync(id); setSeciliIdler(new Set()) }}
              className="flex items-center gap-1 rounded border border-red-300 bg-red-50 px-2 py-1.5 text-xs text-red-700 hover:bg-red-100">
              <Trash2 className="h-3 w-3" /> Sil ({seciliIdler.size})
            </button>
          )}
        </div>
      </div>

      {/* Özet */}
      {ozet && (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded border border-input bg-card px-3 py-2"><div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Ruler className="h-3 w-3" />Direk</div><p className="text-lg font-bold">{ozet.toplam_satir || 0}</p></div>
          <div className="rounded border border-input bg-card px-3 py-2"><div className="flex items-center gap-1 text-[10px] text-muted-foreground"><MapPin className="h-3 w-3" />Mesafe</div><p className="text-lg font-bold">{(ozet.toplam_mesafe || 0).toLocaleString('tr-TR')} m</p></div>
          <div className="rounded border border-input bg-card px-3 py-2"><p className="text-[10px] text-muted-foreground">Yeni</p><p className="text-lg font-bold text-emerald-600">{ozet.yeni_nokta || 0}</p></div>
          <div className="rounded border border-input bg-card px-3 py-2"><p className="text-[10px] text-muted-foreground">Demontaj</p><p className="text-lg font-bold text-red-600">{ozet.demontaj_nokta || 0}</p></div>
        </div>
      )}

      {/* Direk listesi — Accordion */}
      <div className="rounded-lg border border-input bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b border-input text-[9px] font-semibold text-muted-foreground uppercase">
          <input type="checkbox" checked={satirlar?.length > 0 && seciliIdler.size === satirlar.length}
            onChange={e => setSeciliIdler(e.target.checked ? new Set(satirlar.map(s => s.id)) : new Set())}
            className="h-3 w-3 accent-primary cursor-pointer" />
          <span className="w-4"></span>
          <span className="w-10">Nokta</span>
          <span className="w-14">Durum</span>
          <span className="w-20">Tur</span>
          <span className="w-14">Tip</span>
          <span className="w-12 text-right">Mesafe</span>
          <span className="flex-1 ml-2">Detay</span>
        </div>

        {isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Yukleniyor...</div>
        ) : !satirlar?.length ? (
          <div className="px-4 py-10 text-center">
            <BarChart3 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Bos — krokiden direk tiklayin veya manuel ekleyin</p>
          </div>
        ) : satirlar.map(s => (
          <DirekDetay key={s.id} satir={s} acik={acikIdler.has(s.id)} onToggle={() => toggleAcik(s.id)}
            onGuncelle={(alan, deger) => handleGuncelle(s.id, alan, deger)}
            onSil={() => sil.mutate(s.id)} secili={seciliIdler.has(s.id)} projeId={projeId}
            onSecim={c => setSeciliIdler(p => { const n = new Set(p); c ? n.add(s.id) : n.delete(s.id); return n })}
            onSpriteGuncelle={onSpriteGuncelle}
          />
        ))}
      </div>
    </div>
  )
}
