import { useState, useRef, useEffect, useCallback, Fragment } from 'react'
import { Plus, Trash2, BarChart3, Ruler, MapPin, FileSpreadsheet, Upload, Loader2, ExternalLink, ChevronDown, ChevronRight, Search, Wand2, Package } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useHakEdisMetraj, useHakEdisMetrajOzet, useHakEdisMetrajMalzemeOzeti, useHakEdisMetrajEkle, useHakEdisMetrajGuncelle, useHakEdisMetrajSil,
  useProjeKesifMetraj, useProjeKesifMetrajOzet, useProjeKesifMetrajMalzemeOzeti, useProjeKesifMetrajEkle, useProjeKesifMetrajGuncelle, useProjeKesifMetrajSil,
} from '@/hooks/useHakEdisMetraj'

// İki sekme aynı UI'yi paylaşır; konfigürasyon hangi tablo/route/DXF kaynağı kullanılacağını belirler.
export const HAK_EDIS_KONFIGI = {
  baslik: 'Sebeke Metraji',
  altBaslik: 'Direk bazlı malzeme ve iletken listesi',
  dxfAdimKodu: 'hak_edis_krokisi',
  dxfBulunamadiMesaji: 'Hak Ediş Krokisi DXF bulunamadı. Önce krokiyi oluşturun.',
  excelAktarim: true,
  hooks: {
    useListe: useHakEdisMetraj,
    useOzet: useHakEdisMetrajOzet,
    useMalzemeOzeti: useHakEdisMetrajMalzemeOzeti,
    useEkle: useHakEdisMetrajEkle,
    useGuncelle: useHakEdisMetrajGuncelle,
    useSil: useHakEdisMetrajSil,
  },
}

export const KESIF_KONFIGI = {
  baslik: 'Proje Keşif',
  altBaslik: 'Yeni Durum DXF\'ten direk bazlı keşif listesi',
  dxfAdimKodu: 'yeni_durum_proje',
  dxfBulunamadiMesaji: 'Yeni Durum Proje DXF bulunamadı.',
  excelAktarim: false,
  hooks: {
    useListe: useProjeKesifMetraj,
    useOzet: useProjeKesifMetrajOzet,
    useMalzemeOzeti: useProjeKesifMetrajMalzemeOzeti,
    useEkle: useProjeKesifMetrajEkle,
    useGuncelle: useProjeKesifMetrajGuncelle,
    useSil: useProjeKesifMetrajSil,
  },
}
import api from '@/api/client'
import { cn } from '@/lib/utils'

// ── Sabitler (popup'tan taşındı) ──
const DURUM_SECENEKLERI = ['Yeni', 'Mevcut', 'Demontaj']
const DURUM_RENK = { Yeni: 'text-emerald-600', Mevcut: 'text-blue-600', Demontaj: 'text-red-600' }

// Excel S/T sütunlarındaki iletken tipleri
const ILETKEN_TIPLERI = [
  'ROSE', 'PANSY', 'ASTER', 'SWALLOW', 'RAVEN', 'PİGEON', 'HAWK', 'PARTRIDGE',
  '1X16+25 AER', '1X25+35 AER', '1X50+70 AER', '1X70+95 AER',
  '2X16+25 AER', '3X10+16 AER', '3X16+25 AER', '3X25+35 AER',
  '3X35+50 AER', '3X50+70 AER', '3X70+95 AER',
  '3X16/16+25 AER', '3X25/16+35 AER', '3X35/16+50 AER', '3X50/16+70 AER', '3X70/16+95 AER',
]

// Excel "Şebeke Metrajı" sayfası satır 4, BX-DX sütunları — iletken montaj malzemeleri
// (izolatör, bağ kelepçesi, askı, gergi vs.). Üstteki arama çubuğunda kullanılır.
const ILETKEN_MONTAJ_MALZEMELERI = [
  '1 KV N 80', '1 KV N 95', '1 KV N 95/2',
  '36 KV VHD 35 (20 mm/kV) Normal Tip', '36 KV VKS 35 (20 mm/kV) Nor.Tip',
  '36 KV VHD 35 (25 mm/kV) Sis Tipi', '36 KV VKS 35 (25 mm/kV) Sis Tipi',
  'A 80', 'B 80', 'B 95', 'D 80 ( Deve Boynu )', 'D 95 ( Deve Boynu )',
  'B 15 Demir Travers için ( Durdurucu )', 'B 35 Demir Travers için ( Durdurucu )',
  'B 15 Beton Travers için ( Durdurucu )', 'B 35 Beton Travers için ( Durdurucu )',
  'B 15 Beton Travers için ( Orta )', 'B 35 Beton Travers için ( Orta )',
  'C 35 Demir Travers için ( Taşıyıcı )', 'C 35 Beton Travers için ( Taşıyıcı )',
  'C 35 Beton Travers için ( Orta )',
  'Makara İzolator TK MI 85', 'Makara İzolator mili TK IM 22',
  'Özengi Demiri TK OD 85',
  'Halkalı Saplama TK HS 200', 'Halkalı Saplama TK HS 300', 'Halkalı Saplama TK HS 400',
  'Bağ Kelepçesi TK BS 150', 'Taş.Mak.İzolatör Sapı TK TS 205',
  'Askı Kancası TK AK 100', 'Askı Kancasi TK AK 240',
  'Plastik Koruyucu Kutu TK PK 70',
  'K1 Tipi İzolatör', 'K2 Tipi İzolatör', 'K3 Tipi İzolatör',
  'KOMPOZİT SİL. K1 40 KN', 'KOMPOZİT SİL. K2 100 KN',
  'TEK GERGİ Swallow - Raven - Pigeon (K1)', 'TEK GERGİ Swallow - Raven - Pigeon (K2)',
  'TEK GERGİ Hawk',
  'ÇİFT GERGİ Swallow - Raven - Pigeon (K1)', 'ÇİFT GERGİ Swallow - Raven - Pigeon (K2)',
  'ÇİFT GERGİ Hawk',
  'TEK GERGİ Hawk (Presli Topbaşı)', 'ÇİFT GERGİ Hawk (Presli Topbaşı)',
  'TEK ASKI Swallow - Raven - Pigeon (K1)', 'TEK ASKI Swallow - Raven - Pigeon (K2)',
  'TEK ASKI Hawk',
  'ÇİFT ASKI Swallow - Raven - Pigeon (K1)', 'ÇİFT ASKI Swallow - Raven - Pigeon (K2)',
  'ÇİFT ASKI Hawk',
]

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

// ── Tek iletken satırı: tip tıkla→arama (tip + grup + katalog), mesafe düzenle, sil ──
function IletkenSatirDuzenle({ iletken, onTipDegistir, onGrupKalemEkle, onKisaIsimDegistir, onMesafeDegistir, onGorunurDegistir, onSil }) {
  const [duzenle, setDuzenle] = useState(false)
  const [aramaVal, setAramaVal] = useState('')
  const [katalogSonuclar, setKatalogSonuclar] = useState([])
  const [grupSonuclar, setGrupSonuclar] = useState([])
  const [araniyor, setAraniyor] = useState(false)
  const [secIdx, setSecIdx] = useState(-1)
  const timerRef = useRef(null)

  // İletken tipi önerileri (statik liste)
  const statikOneriler = aramaVal
    ? ILETKEN_TIPLERI.filter(t => t.toLowerCase().includes(aramaVal.toLowerCase())).slice(0, 6)
    : []

  const araFunc = (text) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!text || text.length < 2) { setKatalogSonuclar([]); setGrupSonuclar([]); return }
    setAraniyor(true)
    timerRef.current = setTimeout(async () => {
      try {
        const [katalogR, grupR] = await Promise.all([
          api.get('/malzeme-katalog', { params: { arama: text } }),
          api.get('/malzeme-gruplari', { params: { arama: text } }).catch(() => null),
        ])
        setKatalogSonuclar((Array.isArray(katalogR) ? katalogR : (katalogR?.data || [])).slice(0, 6))
        setGrupSonuclar(((grupR?.data) || []).slice(0, 5))
      } catch { setKatalogSonuclar([]); setGrupSonuclar([]) }
      setAraniyor(false)
    }, 300)
  }
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])
  useEffect(() => { setSecIdx(-1) }, [statikOneriler.length, katalogSonuclar.length, grupSonuclar.length])

  const secTip = (deger) => {
    onTipDegistir(deger)
    setDuzenle(false); setKatalogSonuclar([]); setGrupSonuclar([])
  }

  const secGrup = async (grupId) => {
    try {
      const r = await api.get(`/malzeme-gruplari/${grupId}`)
      const detay = r?.data
      if (detay?.kalemler?.length && onGrupKalemEkle) onGrupKalemEkle(detay.kalemler)
    } catch (err) { alert('Grup yüklenemedi: ' + err.message) }
    finally { setDuzenle(false); setKatalogSonuclar([]); setGrupSonuclar([]) }
  }

  // Birleşik öneri listesi: gruplar üstte, sonra statik tipler, sonra katalog
  const tumOneriler = [
    ...grupSonuclar.map(g => ({ kaynak: 'grup', id: g.id, deger: g.kisa_ad, aciklama: g.aciklama, kalem_sayisi: g.kalem_sayisi })),
    ...statikOneriler.map(t => ({ kaynak: 'tip', deger: t })),
    ...katalogSonuclar.map(item => ({ kaynak: 'katalog', deger: item.malzeme_cinsi || item.malzeme_tanimi_sap || '', kod: item.malzeme_kodu })),
  ]

  const oneriSec = (item) => item.kaynak === 'grup' ? secGrup(item.id) : secTip(item.deger)

  const handleKeyDown = (e) => {
    if (!tumOneriler.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSecIdx(p => Math.min(p + 1, tumOneriler.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSecIdx(p => Math.max(p - 1, 0)) }
    else if (e.key === 'Enter' && secIdx >= 0) { e.preventDefault(); oneriSec(tumOneriler[secIdx]) }
    else if (e.key === 'Escape') { setDuzenle(false); setKatalogSonuclar([]); setGrupSonuclar([]) }
  }

  if (duzenle) {
    return (
      <div className="relative border-b border-border/10 py-0.5">
        <div className="flex items-center gap-1">
          <input value={aramaVal} onChange={e => { setAramaVal(e.target.value); araFunc(e.target.value) }}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => { setDuzenle(false); setKatalogSonuclar([]); setGrupSonuclar([]) }, 200)}
            autoFocus placeholder="İletken/grup/katalog ara..."
            className="flex-1 rounded border border-blue-400 bg-white px-1 py-0.5 text-[10px] focus:outline-none" />
          <button onClick={() => { setDuzenle(false); setKatalogSonuclar([]); setGrupSonuclar([]) }} className="text-muted-foreground text-[10px] px-1">✕</button>
        </div>
        {(araniyor || tumOneriler.length > 0) && (
          <div className="absolute left-0 top-full z-50 mt-0.5 w-full max-h-40 overflow-y-auto rounded border border-border bg-white shadow-lg">
            {tumOneriler.map((item, i) => (
              <button key={`${item.kaynak}-${item.id || i}`} onMouseDown={e => { e.preventDefault(); oneriSec(item) }}
                className={cn('flex w-full items-center gap-1 px-2 py-1 text-[10px] text-left border-b border-border/20',
                  item.kaynak === 'grup' ? (i === secIdx ? 'bg-amber-100' : 'bg-amber-50/60 hover:bg-amber-100/80')
                    : (i === secIdx ? 'bg-blue-50' : 'hover:bg-blue-50/50'))}>
                {item.kaynak === 'grup' ? (
                  <>
                    <Package className="h-3 w-3 text-amber-600 shrink-0" />
                    <span className="font-semibold text-amber-700">{item.deger}</span>
                    <span className="text-[9px] text-amber-600/80">({item.kalem_sayisi} kalem)</span>
                    {item.aciklama && <span className="text-muted-foreground truncate flex-1 ml-1">— {item.aciklama}</span>}
                  </>
                ) : item.kaynak === 'tip' ? (
                  <><span className="text-blue-700 font-semibold">{item.deger}</span><span className="text-[9px] text-muted-foreground ml-auto">tip</span></>
                ) : (
                  <><span className="font-mono text-blue-600 w-14 shrink-0 truncate">{item.kod || '-'}</span><span className="flex-1 truncate">{item.deger}</span></>
                )}
              </button>
            ))}
            {araniyor && <div className="px-2 py-1 text-[10px] text-muted-foreground"><Loader2 className="inline h-2.5 w-2.5 animate-spin mr-1" />Aranıyor...</div>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-1 text-[10px] py-0.5 border-b border-border/10', iletken.gorunur === false && 'opacity-50')}>
      <input type="checkbox" checked={iletken.gorunur !== false}
        onChange={e => onGorunurDegistir(e.target.checked)}
        title="Sahnede göster" className="h-3 w-3 accent-primary cursor-pointer shrink-0" />
      <input value={iletken.kisaIsim || ''} onChange={e => onKisaIsimDegistir(e.target.value)}
        placeholder="kısa isim" title="Kısa isim (sprite text'te görünür)"
        className="w-28 rounded border border-input bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-700 focus:outline-none focus:border-amber-400" />
      <span className="flex-1 truncate cursor-pointer text-blue-700 font-medium hover:text-blue-500 hover:underline"
        title={`${iletken.tip} — tıkla değiştir`}
        onClick={() => { setDuzenle(true); setAramaVal(iletken.tip) }}>{iletken.tip}</span>
      <input type="number" value={iletken.mesafe || ''} placeholder="0" min={0}
        onChange={e => onMesafeDegistir(Number(e.target.value) || 0)}
        className="w-14 rounded border border-input px-0.5 py-0.5 text-center text-[10px]" />
      <span className="text-[9px] text-muted-foreground">m</span>
      <button onClick={onSil} className="text-red-400 hover:text-red-600 p-0.5 shrink-0"><Trash2 className="h-2.5 w-2.5" /></button>
    </div>
  )
}

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
        placeholder="kısa isim" title="Kısa isim (sprite text'te görünür)"
        className="w-28 rounded border border-input bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-700 focus:outline-none focus:border-amber-400" />
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
  // Notlar'dan malzeme ve iletken parse et — local state ile takip
  const parseNotlar = (notlarStr) => {
    const satirlar = (notlarStr || '').split('\n').filter(Boolean)
    const malz = satirlar.filter(n => !n.startsWith('Iletken:')).map(satir => {
      const p = satir.split('|')
      if (p.length >= 4) { const adi = p[2]; return { miktar: Number(p[0]) || 1, kisaIsim: p[1] || adi, adi, gorunur: p[3] !== '0' } }
      if (p.length >= 3) { const adi = p[2]; return { miktar: Number(p[0]) || 1, kisaIsim: p[1] || adi, adi, gorunur: true } }
      if (p.length === 2) { const adi = p[1]; return { miktar: Number(p[0]) || 1, kisaIsim: adi, adi, gorunur: true } }
      const m = satir.match(/^(\d+)x\s*(.+)$/); if (m) return { miktar: Number(m[1]), kisaIsim: m[2], adi: m[2], gorunur: true }
      return { miktar: 1, kisaIsim: satir, adi: satir, gorunur: true }
    })
    const iltk = satirlar.filter(n => n.startsWith('Iletken:')).map(n => {
      const raw = n.replace('Iletken: ', ''), parts = raw.split('|')
      // Yeni format: tip|mesafe|kisaIsim|gorunur   (geriye uyumlu: tip|mesafe)
      return {
        tip: parts[0] || raw,
        mesafe: parts[1] ? Number(parts[1]) : 0,
        kisaIsim: parts[2] !== undefined ? parts[2] : (parts[0] || raw),
        gorunur: parts[3] !== undefined ? parts[3] !== '0' : true,
      }
    })
    return { malz, iltk }
  }

  const [localMalz, setLocalMalz] = useState(() => parseNotlar(s.notlar).malz)
  const [localIltk, setLocalIltk] = useState(() => parseNotlar(s.notlar).iltk)
  // DB'den gelen notlar değişince local state güncelle (başka oturumdan değişiklik)
  const sonNotlarRef = useRef(s.notlar)
  useEffect(() => {
    if (s.notlar !== sonNotlarRef.current) {
      sonNotlarRef.current = s.notlar
      const { malz, iltk } = parseNotlar(s.notlar)
      setLocalMalz(malz); setLocalIltk(iltk)
    }
  }, [s.notlar])

  const malzemeSatirlari = localMalz
  const iletkenSatirlari = localIltk

  // Notları kaydet — local state anında güncellenir, DB debounce ile
  const kaydetTimerRef = useRef(null)
  const notlariKaydet = (malzList, iltkList) => {
    // Local state anında güncelle (UI hızlı)
    setLocalMalz(malzList)
    setLocalIltk(iltkList)
    // Sprite anında güncelle — hem görünür malzemeler hem görünür iletkenler
    const spriteSatirlari = [
      ...malzList.filter(m => m.gorunur !== false).map(m => `${m.miktar}x ${m.kisaIsim || m.adi}`),
      ...iltkList.filter(il => il.gorunur !== false).map(il => `${il.mesafe || 0}m ${il.kisaIsim || il.tip}`),
    ]
    onSpriteGuncelle?.(s.nokta1, spriteSatirlari)
    // DB kaydetmeyi debounce et
    const yeniNotlar = [
      ...malzList.map(m => `${m.miktar}|${m.kisaIsim || ''}|${m.adi}|${m.gorunur === false ? '0' : '1'}`),
      ...iltkList.map(il => `Iletken: ${il.tip}|${il.mesafe || 0}|${il.kisaIsim || ''}|${il.gorunur === false ? '0' : '1'}`),
    ].join('\n')
    sonNotlarRef.current = yeniNotlar
    if (kaydetTimerRef.current) clearTimeout(kaydetTimerRef.current)
    kaydetTimerRef.current = setTimeout(() => onGuncelle('notlar', yeniNotlar), 600)
  }
  useEffect(() => () => { if (kaydetTimerRef.current) clearTimeout(kaydetTimerRef.current) }, [])

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
        const [katalogR, grupR] = await Promise.all([
          api.get('/malzeme-katalog', { params: { arama: text } }),
          api.get('/malzeme-gruplari', { params: { arama: text } }).catch(() => null),
        ])
        const kataloglar = (Array.isArray(katalogR) ? katalogR : (katalogR?.data || [])).slice(0, 10)
        const gruplar = ((grupR?.data) || []).slice(0, 5)
        // Önce gruplar (öne çıkar), sonra katalog sonuçları
        setSonuclar([
          ...gruplar.map(g => ({ _tip: 'grup', id: g.id, kisa_ad: g.kisa_ad, aciklama: g.aciklama, kalem_sayisi: g.kalem_sayisi })),
          ...kataloglar,
        ])
      } catch { setSonuclar([]) }
      setAraniyor(false)
    }, 300)
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  useEffect(() => { setSecIdx(-1) }, [sonuclar])

  const handleMalzemeEkle = async (item) => {
    if (item._tip === 'grup') {
      try {
        const r = await api.get(`/malzeme-gruplari/${item.id}`)
        const detay = r?.data
        if (detay?.kalemler?.length) {
          const yeniMalz = [
            ...malzemeSatirlari,
            ...detay.kalemler.map(k => ({
              miktar: k.miktar || 1,
              kisaIsim: k.kisa_isim || k.malzeme_adi,
              adi: k.malzeme_adi,
              gorunur: true,
            })),
          ]
          notlariKaydet(yeniMalz, iletkenSatirlari)
        }
      } catch (err) { alert('Grup yüklenemedi: ' + err.message) }
    } else {
      const tamAdi = item.malzeme_cinsi || item.malzeme_tanimi_sap || ''
      const yeniMalz = [...malzemeSatirlari, { miktar: 1, kisaIsim: tamAdi, adi: tamAdi, gorunur: true }]
      notlariKaydet(yeniMalz, iletkenSatirlari)
    }
    setArama(''); setSonuclar([])
  }

  const handleKeyDown = (e) => {
    if (!sonuclar.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSecIdx(p => Math.min(p + 1, sonuclar.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSecIdx(p => Math.max(p - 1, 0)) }
    else if (e.key === 'Enter' && secIdx >= 0) { e.preventDefault(); handleMalzemeEkle(sonuclar[secIdx]) }
    else if (e.key === 'Escape') { setSonuclar([]); setArama('') }
  }

  // İletken montaj malzemesi arama (izolatör, bağ kelepçesi, vs.) — BX-DX listesi + gruplar
  const [montajVal, setMontajVal] = useState('')
  const [montajOneriAcik, setMontajOneriAcik] = useState(false)
  const [montajSecIdx, setMontajSecIdx] = useState(-1)
  const [montajYukleniyor, setMontajYukleniyor] = useState(false)
  const [montajGrupSonuclar, setMontajGrupSonuclar] = useState([])
  const montajTimerRef = useRef(null)
  const montajStatikOnerileri = montajVal.length >= 1
    ? ILETKEN_MONTAJ_MALZEMELERI.filter(m => m.toLowerCase().includes(montajVal.toLowerCase())).slice(0, 8)
    : []
  // Grupları debounce ile getir
  useEffect(() => {
    if (montajTimerRef.current) clearTimeout(montajTimerRef.current)
    if (!montajVal || montajVal.length < 1) { setMontajGrupSonuclar([]); return }
    montajTimerRef.current = setTimeout(async () => {
      try {
        const r = await api.get('/malzeme-gruplari', { params: { arama: montajVal } })
        setMontajGrupSonuclar((r?.data || []).slice(0, 5))
      } catch { setMontajGrupSonuclar([]) }
    }, 250)
    return () => { if (montajTimerRef.current) clearTimeout(montajTimerRef.current) }
  }, [montajVal])
  // Birleşik öneriler: gruplar üstte, sonra statik liste
  const montajOnerileri = [
    ...montajGrupSonuclar.map(g => ({ kaynak: 'grup', id: g.id, deger: g.kisa_ad, aciklama: g.aciklama, kalem_sayisi: g.kalem_sayisi })),
    ...montajStatikOnerileri.map(ad => ({ kaynak: 'statik', deger: ad })),
  ]

  // Bir öneri ögesini ekle: grup ise tüm kalemleri, statik/metin ise katalogta ara
  const handleMontajEkle = async (secim) => {
    // secim: öneri objesi {kaynak, deger, id?} veya ham metin (Enter ile)
    const ogeGrup = secim && typeof secim === 'object' && secim.kaynak === 'grup'
    const metin = (typeof secim === 'string' ? secim : secim?.deger) || montajVal
    const t = (metin || '').trim()
    if (!t && !ogeGrup) return
    setMontajYukleniyor(true)
    try {
      // 1) Grup seçildiyse direkt kalemleri al
      if (ogeGrup) {
        const r = await api.get(`/malzeme-gruplari/${secim.id}`)
        const detay = r?.data
        if (detay?.kalemler?.length) {
          const yeniMalz = [
            ...malzemeSatirlari,
            ...detay.kalemler.map(k => ({
              miktar: k.miktar || 1,
              kisaIsim: k.kisa_isim || k.malzeme_adi,
              adi: k.malzeme_adi,
              gorunur: true,
            })),
          ]
          notlariKaydet(yeniMalz, iletkenSatirlari)
        }
        return
      }
      // 2) Metin — önce kısa ad grup kontrolü
      const grupR = await api.get(`/malzeme-gruplari/by-kisa-ad/${encodeURIComponent(t)}`).catch(() => null)
      const grup = grupR?.data
      if (grup?.kalemler?.length) {
        const yeniMalz = [
          ...malzemeSatirlari,
          ...grup.kalemler.map(k => ({
            miktar: k.miktar || 1,
            kisaIsim: k.kisa_isim || k.malzeme_adi,
            adi: k.malzeme_adi,
            gorunur: true,
          })),
        ]
        notlariKaydet(yeniMalz, iletkenSatirlari)
        return
      }
      // 3) Grup yok — katalogta ara
      const r = await api.get('/malzeme-katalog', { params: { arama: t } })
      const sonuc = (Array.isArray(r) ? r : (r?.data || []))[0]
      const tamAdi = sonuc ? (sonuc.malzeme_cinsi || sonuc.malzeme_tanimi_sap || t) : t
      const yeniMalz = [...malzemeSatirlari, { miktar: 1, kisaIsim: tamAdi, adi: tamAdi, gorunur: true }]
      notlariKaydet(yeniMalz, iletkenSatirlari)
    } finally {
      setMontajYukleniyor(false)
      setMontajVal(''); setMontajOneriAcik(false); setMontajGrupSonuclar([])
    }
  }
  const handleMontajKeyDown = (e) => {
    if (montajOnerileri.length && montajOneriAcik) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMontajSecIdx(p => Math.min(p + 1, montajOnerileri.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setMontajSecIdx(p => Math.max(p - 1, 0)) }
      else if (e.key === 'Enter' && montajSecIdx >= 0) { e.preventDefault(); handleMontajEkle(montajOnerileri[montajSecIdx]) }
      else if (e.key === 'Escape') setMontajOneriAcik(false)
    } else if (e.key === 'Enter') handleMontajEkle(montajVal)
  }
  useEffect(() => { setMontajSecIdx(-1) }, [montajOnerileri.length])

  const handleYeniIletken = () => {
    notlariKaydet(malzemeSatirlari, [...iletkenSatirlari, { tip: 'İletken', kisaIsim: '', mesafe: 0, gorunur: true }])
  }

  return (
    <div className={cn(
      'transition-all',
      acik
        ? 'border-2 border-primary/60 rounded-md my-1.5 shadow-sm'
        : 'border-b border-input/50'
    )}>
      {/* Ana satır */}
      <div onClick={onToggle}
        className={cn('flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors',
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

      {/* Detay paneli — açıldığında satırın çocuğu olduğu, çevredeki kalın çerçeve ile belli olur */}
      {acik && (
        <div className="border-t border-primary/30">
          <div className="bg-muted/10 px-4 py-3 space-y-3">
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

          {/* Malzeme arama (katalog) */}
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
                  sonuclar.map((item, i) => item._tip === 'grup' ? (
                    <button key={`g-${item.id}`} onClick={() => handleMalzemeEkle(item)}
                      className={cn('flex w-full items-center gap-2 px-2 py-1 text-left text-[10px] border-b border-border/30 bg-amber-50/60',
                        i === secIdx ? 'bg-amber-100' : 'hover:bg-amber-100/80')}>
                      <Package className="h-3 w-3 text-amber-600 shrink-0" />
                      <span className="font-semibold text-amber-700">{item.kisa_ad}</span>
                      <span className="text-[9px] text-amber-600/80">({item.kalem_sayisi} kalem)</span>
                      {item.aciklama && <span className="text-muted-foreground truncate flex-1">— {item.aciklama}</span>}
                      <Plus className="h-3 w-3 text-amber-600 shrink-0 ml-auto" />
                    </button>
                  ) : (
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
              <div className="flex items-center justify-between mb-1">
                <div className="text-[9px] font-bold text-blue-600 uppercase">Iletkenler ({iletkenSatirlari.length})</div>
                <button onClick={handleYeniIletken}
                  className="flex items-center gap-0.5 rounded bg-blue-500 px-1.5 py-0.5 text-[10px] text-white hover:bg-blue-600">
                  <Plus className="h-2.5 w-2.5" /> İletken
                </button>
              </div>
              {/* İletken montaj malzemesi arama (izolatör, bağ kelepçesi, askı, gergi...) */}
              <div className="relative mb-1">
                <div className="flex items-center gap-1">
                  <Search className="h-3 w-3 text-blue-500" />
                  <input value={montajVal}
                    onChange={e => { setMontajVal(e.target.value); setMontajOneriAcik(true) }}
                    onFocus={() => setMontajOneriAcik(true)}
                    onBlur={() => setTimeout(() => setMontajOneriAcik(false), 200)}
                    onKeyDown={handleMontajKeyDown}
                    placeholder="İletken montaj malzemesi ara (izolatör, bağ kelepçesi, askı...)..."
                    className="flex-1 rounded border border-blue-200 bg-blue-50/30 px-2 py-1 text-[11px] focus:border-blue-400 focus:outline-none" />
                  {montajYukleniyor && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
                </div>
                {montajOneriAcik && montajOnerileri.length > 0 && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-full max-h-48 overflow-y-auto rounded border border-blue-200 bg-white shadow-xl">
                    {montajOnerileri.map((oge, i) => oge.kaynak === 'grup' ? (
                      <button key={`g-${oge.id}`} onMouseDown={e => { e.preventDefault(); handleMontajEkle(oge) }}
                        className={cn('flex w-full items-center gap-2 px-2 py-1 text-left text-[10px] border-b border-border/30 bg-amber-50/60',
                          i === montajSecIdx ? 'bg-amber-100' : 'hover:bg-amber-100/80')}>
                        <Package className="h-3 w-3 text-amber-600 shrink-0" />
                        <span className="font-semibold text-amber-700">{oge.deger}</span>
                        <span className="text-[9px] text-amber-600/80">({oge.kalem_sayisi} kalem)</span>
                        {oge.aciklama && <span className="text-muted-foreground truncate flex-1">— {oge.aciklama}</span>}
                        <Plus className="h-3 w-3 text-amber-600 shrink-0 ml-auto" />
                      </button>
                    ) : (
                      <button key={`s-${oge.deger}`} onMouseDown={e => { e.preventDefault(); handleMontajEkle(oge) }}
                        className={cn('flex w-full items-center gap-2 px-2 py-1 text-left text-[10px] border-b border-border/30',
                          i === montajSecIdx ? 'bg-blue-100' : 'hover:bg-blue-50')}>
                        <span className="flex-1 truncate">{oge.deger}</span>
                        <Plus className="h-3 w-3 text-blue-500 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {iletkenSatirlari.length === 0 ? <p className="text-[10px] text-muted-foreground/50 italic">İletken yok</p> : (
                iletkenSatirlari.map((il, i) => (
                  <IletkenSatirDuzenle key={i} iletken={il}
                    onTipDegistir={(yeniTip) => { const yeni = [...iletkenSatirlari]; yeni[i] = { ...il, tip: yeniTip, kisaIsim: il.kisaIsim || yeniTip }; notlariKaydet(malzemeSatirlari, yeni) }}
                    onGrupKalemEkle={(kalemler) => {
                      // Bu satırı ilk kalemle değiştir, kalanları yeni iletken satırları olarak ekle
                      const yeniIltkler = kalemler.map(k => ({
                        tip: k.malzeme_adi,
                        kisaIsim: k.kisa_isim || k.malzeme_adi,
                        mesafe: k.birim === 'm' ? (k.miktar || 0) : 0,
                        gorunur: true,
                      }))
                      const yeni = [...iletkenSatirlari]
                      yeni.splice(i, 1, ...yeniIltkler)
                      notlariKaydet(malzemeSatirlari, yeni)
                    }}
                    onKisaIsimDegistir={(yeniKisa) => { const yeni = [...iletkenSatirlari]; yeni[i] = { ...il, kisaIsim: yeniKisa }; notlariKaydet(malzemeSatirlari, yeni) }}
                    onMesafeDegistir={(yeniMesafe) => { const yeni = [...iletkenSatirlari]; yeni[i] = { ...il, mesafe: yeniMesafe }; notlariKaydet(malzemeSatirlari, yeni) }}
                    onGorunurDegistir={(g) => { const yeni = [...iletkenSatirlari]; yeni[i] = { ...il, gorunur: g }; notlariKaydet(malzemeSatirlari, yeni) }}
                    onSil={() => notlariKaydet(malzemeSatirlari, iletkenSatirlari.filter((_, j) => j !== i))}
                  />
                ))
              )}
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProjeHakEdis({ projeId, onSpriteGuncelle, seciliDirekBilgi, onSeciliDirekTemizle, konfig = HAK_EDIS_KONFIGI }) {
  const { data: satirlar, isLoading } = konfig.hooks.useListe(projeId)
  const { data: ozet } = konfig.hooks.useOzet(projeId)
  const ekle = konfig.hooks.useEkle(projeId)
  const guncelle = konfig.hooks.useGuncelle(projeId)
  const sil = konfig.hooks.useSil(projeId)
  const { data: malzemeOzeti } = konfig.hooks.useMalzemeOzeti(projeId)
  const qc = useQueryClient()
  const [seciliIdler, setSeciliIdler] = useState(new Set())
  const [acikIdler, setAcikIdler] = useState(new Set())

  // Bir direk bilgisinden yeni satır oluştur ya da mevcut satırı aç
  // (Hem click handler hem otomatik tespit butonu tarafından kullanılır)
  const direkBilgisiniIsle = useCallback(async (bilgi, mevcutSatirlar, opts = {}) => {
    const { zorlaYeni = false, acma = true } = opts
    if (!bilgi?.numara) return null
    const numara = bilgi.numara
    if (!zorlaYeni) {
      const mevcut = mevcutSatirlar?.find(s => s.nokta1 === numara)
      if (mevcut) {
        if (acma) setAcikIdler(prev => new Set([...prev, mevcut.id]))
        return { id: mevcut.id, yeni: false }
      }
    }
    const rawTip = bilgi.tip || ''
    const cleanTip = rawTip.replace(/^G-/i, '').replace(/\(P\)/gi, '').trim()
    const turFromTip = TIP_TUR_MAP[cleanTip] || (rawTip.startsWith('G-') ? 'AG Direk' : '')
    const komsu = bilgi.komsular?.[0]
    const otoMalz = hesaplaOtoMalzemeler(rawTip, bilgi.yakinlar)
    const otoNotlar = otoMalz.map(m => `${m.miktar}||${m.adi}|${m.gorunur === false ? '0' : '1'}`).join('\n')
    const iletkenText = komsu?.iletken || ''
    const temizIletken = iletkenText.replace(/[()[\]]/g, '').trim()
    const agIletken = /AER|ROSE|PANSY|ASTER/i.test(temizIletken) ? temizIletken.replace(/_/g, ' ') : null
    const ogIletken = /SW|SWALLOW|RAVEN|PIGEON|HAWK/i.test(temizIletken) ? temizIletken.replace(/_/g, ' ') : null
    const iletkenNot = iletkenText ? `Iletken: ${temizIletken.replace(/_/g, ' ')}` : ''
    // Direğin kendi durumu sembole göre belirleniyorsa onu kullan, yoksa komşu hat durumu
    const direkDurum = bilgi.durum || komsu?.hatDurum || 'Yeni'
    const res = await ekle.mutateAsync({
      nokta1: numara,
      nokta2: komsu?.numara || '',
      nokta_durum: direkDurum,
      direk_tur: turFromTip,
      direk_tip: cleanTip || rawTip,
      ara_mesafe: komsu?.mesafe || 0,
      ag_iletken: agIletken,
      og_iletken: ogIletken,
      ag_iletken_durum: komsu?.hatDurum || 'Yeni',
      notlar: [otoNotlar, iletkenNot].filter(Boolean).join('\n'),
      kaynak: 'kroki',
    })
    const yeniId = (res?.data || res)?.id
    if (yeniId && acma) setAcikIdler(prev => new Set([...prev, yeniId]))
    return { id: yeniId, yeni: true }
  }, [ekle])

  // Direk tıklandığında: mevcut satır varsa aç, yoksa oluştur
  useEffect(() => {
    if (!seciliDirekBilgi?.numara || isLoading) return
    direkBilgisiniIsle(seciliDirekBilgi, satirlar)
    onSeciliDirekTemizle?.()
  }, [seciliDirekBilgi, satirlar, isLoading])
  const [excelYukleniyor, setExcelYukleniyor] = useState(false)
  const [excelDosyaId, setExcelDosyaId] = useState(null)
  const [otoTaraYukleniyor, setOtoTaraYukleniyor] = useState(false)
  const [otoTaraIlerleme, setOtoTaraIlerleme] = useState(null)
  const [durumFiltresi, setDurumFiltresi] = useState(null) // null=Tümü | 'Yeni' | 'Mevcut' | 'Demontaj'

  const filtreliSatirlar = durumFiltresi
    ? (satirlar || []).filter(s => s.nokta_durum === durumFiltresi)
    : satirlar

  // Otomatik tespit: Hak Ediş Krokisi DXF'indeki tüm ana direkleri
  // (E/A/2 sembolleri) tarayıp her biri için click mantığını simüle eder.
  const handleOtomatikTespit = async () => {
    if (!projeId || otoTaraYukleniyor) return
    setOtoTaraYukleniyor(true)
    setOtoTaraIlerleme(null)
    try {
      const dxfListRes = await api.get(`/dosya/proje/${projeId}/dxf-listesi`)
      const dxfler = dxfListRes?.data || dxfListRes || []
      const kaynakDxf = dxfler.find(d => d.adim_kodu === konfig.dxfAdimKodu)
      if (!kaynakDxf) {
        alert(konfig.dxfBulunamadiMesaji)
        return
      }
      const elemanRes = await api.get(`/dosya/${kaynakDxf.id}/dxf-elemanlar`)
      const elemanlar = (elemanRes?.data || elemanRes)?.elemanlar || []

      // Diagnostic: hangi sembol karakterleri mevcut?
      const sembolSayimi = {}
      for (const el of elemanlar) {
        if (!el.sembol) continue
        sembolSayimi[el.sembol] = (sembolSayimi[el.sembol] || 0) + 1
      }
      console.info('[OtoTespit] Mevcut sembol karakterleri:', sembolSayimi)
      console.info('[OtoTespit] Toplam eleman:', elemanlar.length, '| numara var:', elemanlar.filter(e => e.numara).length)

      // Sembol → durum eşleşmesi (kullanıcı tanımı):
      //   A, R, P → Mevcut direk (içi boş sembol)
      //   8, E, M → Yeni direk (tam dolu sembol)
      //   T, B, S → DMM — Demontajdan Montaj (yarı dolu sembol)
      const SEMBOL_DURUM = {
        'A': 'Mevcut', 'R': 'Mevcut', 'P': 'Mevcut',
        '8': 'Yeni', 'E': 'Yeni', 'M': 'Yeni',
        'T': 'DMM', 'B': 'DMM', 'S': 'DMM',
      }
      const anaDirekler = elemanlar.filter(d =>
        d.numara && d.sembol && SEMBOL_DURUM[d.sembol]
      )
      console.info('[OtoTespit] Ana direk sayısı:', anaDirekler.length,
        '| numara listesi:', anaDirekler.map(d => `${d.sembol}:${d.numara}`).slice(0, 30))

      if (!anaDirekler.length) { alert('DXF içinde ana direk bulunamadı.'); return }

      let guncelSatirlar = [...(satirlar || [])]
      let eklenen = 0
      for (let i = 0; i < anaDirekler.length; i++) {
        const d = anaDirekler[i]
        setOtoTaraIlerleme({ yapilan: i + 1, toplam: anaDirekler.length })
        const yakinlar = { armatur: false, koruma: false, isletme: false }
        for (const el of elemanlar) {
          if (el.numara !== d.numara || el === d) continue
          if (el.sembol === 'C') yakinlar.armatur = true
          if (el.sembol === '4') yakinlar.koruma = true
          if (el.sembol === '5') yakinlar.isletme = true
        }
        const durum = SEMBOL_DURUM[d.sembol] || 'Yeni'
        const bilgi = {
          numara: d.numara, tip: d.tip, sembol: d.sembol, sembolAdi: d.sembolAdi,
          komsular: d.komsular, yakinlar, durum,
        }
        // Otomatik tespit: zorla yeni satır oluştur + hepsini kapalı bırak (çok sayıda direkte performans için)
        const sonuc = await direkBilgisiniIsle(bilgi, guncelSatirlar, { zorlaYeni: true, acma: false })
        if (sonuc?.yeni && sonuc.id) {
          guncelSatirlar.push({ id: sonuc.id, nokta1: d.numara })
          eklenen++
        }
      }
      alert(`${anaDirekler.length} direk tarandı, ${eklenen} yeni satır eklendi.`)
    } catch (err) {
      alert('Otomatik tespit hatası: ' + (err.message || ''))
    } finally {
      setOtoTaraYukleniyor(false)
      setOtoTaraIlerleme(null)
    }
  }

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
          <h3 className="text-lg font-semibold">{konfig.baslik}</h3>
          <p className="text-xs text-muted-foreground">{konfig.altBaslik}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={handleOtomatikTespit} disabled={otoTaraYukleniyor}
            title={`${konfig.dxfAdimKodu === 'hak_edis_krokisi' ? 'Hak Ediş Krokisi' : 'Yeni Durum Proje'} DXF'indeki tüm direkleri otomatik tara ve malzeme listesini oluştur`}
            className="flex items-center gap-1 rounded border border-violet-300 bg-violet-50 px-2 py-1.5 text-xs text-violet-700 hover:bg-violet-100 disabled:opacity-50">
            {otoTaraYukleniyor ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
            {otoTaraYukleniyor && otoTaraIlerleme
              ? `Taraniyor ${otoTaraIlerleme.yapilan}/${otoTaraIlerleme.toplam}`
              : 'Otomatik Tespit'}
          </button>
          {konfig.excelAktarim && (
            <>
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
            </>
          )}
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

      {/* Durum filtresi */}
      <div className="mb-2 flex items-center gap-1 text-xs">
        <span className="text-muted-foreground mr-1">Durum:</span>
        {[
          { key: null, label: 'Tümü', sayi: satirlar?.length || 0, renk: 'text-foreground' },
          { key: 'Yeni', label: 'Yeni', sayi: (satirlar || []).filter(s => s.nokta_durum === 'Yeni').length, renk: 'text-emerald-600' },
          { key: 'Mevcut', label: 'Mevcut', sayi: (satirlar || []).filter(s => s.nokta_durum === 'Mevcut').length, renk: 'text-blue-600' },
          { key: 'Demontaj', label: 'Demontaj', sayi: (satirlar || []).filter(s => s.nokta_durum === 'Demontaj').length, renk: 'text-red-600' },
        ].map(f => (
          <button key={f.label} onClick={() => setDurumFiltresi(f.key)}
            className={cn('flex items-center gap-1 rounded border px-2 py-1 transition-colors',
              durumFiltresi === f.key
                ? 'border-primary bg-primary/10 font-semibold'
                : 'border-input bg-card hover:bg-muted')}>
            <span className={cn(durumFiltresi === f.key && f.renk)}>{f.label}</span>
            <span className="text-[10px] text-muted-foreground">({f.sayi})</span>
          </button>
        ))}
      </div>

      {/* Direk listesi — Accordion */}
      <div className="rounded-lg border border-input bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b border-input text-[9px] font-semibold text-muted-foreground uppercase">
          <input type="checkbox" checked={filtreliSatirlar?.length > 0 && filtreliSatirlar.every(s => seciliIdler.has(s.id))}
            onChange={e => setSeciliIdler(e.target.checked ? new Set(filtreliSatirlar.map(s => s.id)) : new Set())}
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
        ) : !filtreliSatirlar?.length ? (
          <div className="px-4 py-10 text-center">
            <BarChart3 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {durumFiltresi ? `"${durumFiltresi}" durumunda satır yok` : 'Bos — krokiden direk tiklayin veya manuel ekleyin'}
            </p>
          </div>
        ) : filtreliSatirlar.map(s => (
          <DirekDetay key={s.id} satir={s} acik={acikIdler.has(s.id)} onToggle={() => toggleAcik(s.id)}
            onGuncelle={(alan, deger) => handleGuncelle(s.id, alan, deger)}
            onSil={() => sil.mutate(s.id)} secili={seciliIdler.has(s.id)} projeId={projeId}
            onSecim={c => setSeciliIdler(p => { const n = new Set(p); c ? n.add(s.id) : n.delete(s.id); return n })}
            onSpriteGuncelle={onSpriteGuncelle}
          />
        ))}
      </div>

      {/* Malzeme Özeti — agrega edilmiş kalemler + katalog fiyatlarıyla genel toplam */}
      {malzemeOzeti && satirlar?.length > 0 && (
        <MalzemeOzetiTablosu
          ozet={malzemeOzeti}
          projeId={projeId}
          onIlerlemeKaydedildi={() => {
            qc.invalidateQueries({ queryKey: ['proje-kesif-metraj-malzeme-ozeti', projeId] })
            qc.invalidateQueries({ queryKey: ['hak-edis-metraj-malzeme-ozeti', projeId] })
          }}
        />
      )}
    </div>
  )
}

// İlerleme inline edit hücresi — debounced upsert /api/proje-kesif/:projeId/ilerleme
function IlerlemeInput({ projeId, poz, value, onSaved, malzeme_adi, birim }) {
  const [val, setVal] = useState(value ?? '')
  const timerRef = useRef(null)
  useEffect(() => { setVal(value ?? '') }, [value])
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const kaydet = (yeni) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        await api.put(`/proje-kesif/${projeId}/ilerleme`, {
          poz_no: poz, ilerleme: Number(yeni) || 0,
          malzeme_adi, birim,
        })
        onSaved?.()
      } catch (e) { console.error('İlerleme kaydet hatası:', e.message) }
    }, 500)
  }

  return (
    <input
      type="number" step="any" value={val}
      onChange={e => { setVal(e.target.value); kaydet(e.target.value) }}
      className="w-full text-right text-xs tabular-nums text-blue-700 bg-transparent rounded border border-transparent hover:border-input focus:border-primary focus:bg-white focus:outline-none px-1 py-0.5"
    />
  )
}

// ── Malzeme özeti tablosu — parent-child katalog gruplama ile
function MalzemeOzetiTablosu({ ozet, projeId, onIlerlemeKaydedildi }) {
  const fiyatBicim = (n) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const miktarBicim = (n) => Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })

  return (
    <div className="mt-4 rounded-lg border border-input bg-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-input">
        <h4 className="text-sm font-semibold">Malzeme Özeti</h4>
        <span className="text-xs text-muted-foreground">
          İlerleme: <span className="font-bold text-blue-700">{fiyatBicim(ozet.genel_ilerleme_tutar || 0)} ₺</span>
          {' / '}
          Genel Toplam: <span className="font-bold text-emerald-700">{fiyatBicim(ozet.genel_toplam)} ₺</span>
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/20">
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-2 py-1.5 text-left">Adı</th>
              <th className="px-2 py-1.5 text-right w-20">Miktar</th>
              <th className="px-2 py-1.5 text-right w-20">İlerleme</th>
              <th className="px-2 py-1.5 text-left w-14">Birim</th>
              <th className="px-2 py-1.5 text-right w-24">B. Fiyat</th>
              <th className="px-2 py-1.5 text-right w-28">Tutar</th>
            </tr>
          </thead>
          <tbody>
            {/* Gruplar: parent toplam satırı + altında çocuklar */}
            {ozet.gruplar?.map(g => (
              <Fragment key={`g-${g.poz}`}>
                <tr className="border-t-2 border-emerald-300 bg-emerald-50/50 font-semibold">
                  <td className="px-2 py-1.5 text-xs">
                    {g.adi}
                    <span className="ml-1 text-[9px] text-muted-foreground font-mono font-normal">[{g.poz}]</span>
                  </td>
                  <td className="px-2 py-1.5 text-xs tabular-nums text-right">{miktarBicim(g.toplam_miktar)}</td>
                  <td className="px-2 py-1.5 text-xs tabular-nums text-right text-blue-700">
                    {g.ilerleme_miktar > 0 ? miktarBicim(g.ilerleme_miktar) : '-'}
                  </td>
                  <td className="px-2 py-1.5 text-[11px] text-muted-foreground">{g.birim}</td>
                  <td className="px-2 py-1.5 text-xs tabular-nums text-right">
                    {g.birim_fiyat > 0 ? `${fiyatBicim(g.birim_fiyat)} ₺` : '-'}
                  </td>
                  <td className="px-2 py-1.5 text-xs tabular-nums text-right text-emerald-700">
                    {g.toplam_tutar > 0 ? `${fiyatBicim(g.toplam_tutar)} ₺` : '-'}
                  </td>
                </tr>
                {g.cocuklar.map((c, i) => (
                  <tr key={`g-${g.poz}-c-${i}`} className="border-b border-input/30 hover:bg-muted/20">
                    <td className="px-2 py-1 text-xs pl-6 text-muted-foreground">
                      <span className="text-foreground">{c.adi}</span>
                      <span className="ml-1 text-[9px] font-mono">[{c.poz}]</span>
                    </td>
                    <td className="px-2 py-1 text-xs tabular-nums text-right text-muted-foreground">{miktarBicim(c.miktar)}</td>
                    <td className="px-1 py-1">
                      <IlerlemeInput
                        projeId={projeId} poz={c.poz} value={c.ilerleme}
                        malzeme_adi={c.adi} birim={c.birim}
                        onSaved={onIlerlemeKaydedildi}
                      />
                    </td>
                    <td className="px-2 py-1 text-[11px] text-muted-foreground">{c.birim}</td>
                    <td className="px-2 py-1 text-[10px] text-muted-foreground italic">
                      {c.agirlik > 0 ? `${miktarBicim(c.agirlik)} kg/${c.birim}` : ''}
                    </td>
                    <td className="px-2 py-1 text-[10px] text-muted-foreground italic text-right">
                      {c.alt_toplam_miktar > 0 ? `= ${miktarBicim(c.alt_toplam_miktar)} kg` : ''}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
            {/* Bağımsız (parent grubu olmayan) kalemler */}
            {ozet.bagimsiz?.length > 0 && (
              <>
                <tr className="border-t-2 border-slate-300 bg-slate-50/60">
                  <td colSpan={6} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    Bağımsız Kalemler ({ozet.bagimsiz.length})
                  </td>
                </tr>
                {ozet.bagimsiz.map((b, i) => (
                  <tr key={`b-${i}`} className="border-b border-input/30 hover:bg-muted/30">
                    <td className="px-2 py-1 text-xs">
                      {b.adi}
                      {b.poz && <span className="ml-1 text-[9px] text-muted-foreground font-mono">[{b.poz}]</span>}
                      {b.katalog_eslesmedi && <span className="ml-1 text-[9px] text-amber-600">(katalog ✗)</span>}
                    </td>
                    <td className="px-2 py-1 text-xs tabular-nums text-right">{miktarBicim(b.miktar)}</td>
                    <td className="px-1 py-1">
                      {b.poz ? (
                        <IlerlemeInput
                          projeId={projeId} poz={b.poz} value={b.ilerleme}
                          malzeme_adi={b.adi} birim={b.birim}
                          onSaved={onIlerlemeKaydedildi}
                        />
                      ) : <span className="text-muted-foreground/40 text-xs">-</span>}
                    </td>
                    <td className="px-2 py-1 text-[11px] text-muted-foreground">{b.birim}</td>
                    <td className="px-2 py-1 text-xs tabular-nums text-right">
                      {b.birim_fiyat > 0 ? `${fiyatBicim(b.birim_fiyat)} ₺` : '-'}
                    </td>
                    <td className="px-2 py-1 text-xs tabular-nums text-right font-medium">
                      {b.toplam_tutar > 0 ? `${fiyatBicim(b.toplam_tutar)} ₺` : '-'}
                    </td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-primary/40 bg-muted/30">
              <td colSpan={2} className="px-2 py-2 text-right text-xs font-bold">GENEL TOPLAM</td>
              <td colSpan={3} className="px-2 py-2 text-right text-xs font-bold text-blue-700">
                İlerleme: {fiyatBicim(ozet.genel_ilerleme_tutar || 0)} ₺
              </td>
              <td className="px-2 py-2 text-right text-sm font-bold tabular-nums text-emerald-700">{fiyatBicim(ozet.genel_toplam)} ₺</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
