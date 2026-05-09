import { useState, useRef, useEffect, useCallback, Fragment } from 'react'
import { Plus, Trash2, BarChart3, Ruler, MapPin, FileSpreadsheet, Upload, Loader2, ExternalLink, ChevronDown, ChevronRight, Search, Wand2, Package, Undo2, Redo2, Eye, EyeOff, Save, Check } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useHakEdisMetraj, useHakEdisMetrajOzet, useHakEdisMetrajMalzemeOzeti, useHakEdisMetrajEkle, useHakEdisMetrajGuncelle, useHakEdisMetrajSil,
  useHakEdisMetrajGecmis, useHakEdisMetrajUndo, useHakEdisMetrajRedo,
  useProjeKesifMetraj, useProjeKesifMetrajOzet, useProjeKesifMetrajMalzemeOzeti, useProjeKesifMetrajEkle, useProjeKesifMetrajGuncelle, useProjeKesifMetrajSil,
  useProjeKesifMetrajGecmis, useProjeKesifMetrajUndo, useProjeKesifMetrajRedo,
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
    useGecmis: useHakEdisMetrajGecmis,
    useUndo: useHakEdisMetrajUndo,
    useRedo: useHakEdisMetrajRedo,
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
    useGecmis: useProjeKesifMetrajGecmis,
    useUndo: useProjeKesifMetrajUndo,
    useRedo: useProjeKesifMetrajRedo,
  },
}
import api from '@/api/client'
import { cn } from '@/lib/utils'
import { tertibiParseTekil } from '@/utils/iletkenTertibi'

// ── Sabitler (popup'tan taşındı) ──
const DURUM_SECENEKLERI = ['Yeni', 'Mevcut', 'DMM']
const DURUM_RENK = { Yeni: 'text-emerald-600', Mevcut: 'text-blue-600', DMM: 'text-orange-600', Demontaj: 'text-red-600' }

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
function IletkenSatirDuzenle({ iletken, onTipDegistir, onGrupKalemEkle, onKisaIsimDegistir, onMesafeDegistir, onDurumDegistir, onGorunurDegistir, onSil }) {
  const [duzenle, setDuzenle] = useState(false)
  const [aramaVal, setAramaVal] = useState('')
  const [katalogSonuclar, setKatalogSonuclar] = useState([])
  const [grupSonuclar, setGrupSonuclar] = useState([])
  const [araniyor, setAraniyor] = useState(false)
  const [secIdx, setSecIdx] = useState(-1)
  // Akordyon (Pansy/Rose alt kalemler) — hook'lar her render'da aynı sırada çağrılmalı
  const [acik, setAcik] = useState(false)
  const [katalogKalemler, setKatalogKalemler] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const timerRef = useRef(null)
  // Mesafe/tip/durum değişince akordyon verisini sıfırla
  useEffect(() => { setKatalogKalemler(null) }, [iletken.tip, iletken.mesafe, iletken.durum])

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

  // Tertibi parse — açık hat veya OG mı?
  const tertibi = tertibiParseTekil(iletken.tip)
  const takimMi = tertibi && (tertibi.tip === 'ag-acik' || tertibi.tip === 'og')

  const yukle = async () => {
    if (katalogKalemler) return
    setYukleniyor(true)
    try {
      const r = await api.get('/iletken-tertibi/expand', {
        params: { tertibi: iletken.tip, mesafe: iletken.mesafe || 0, durum: iletken.durum || 'Yeni' },
      })
      setKatalogKalemler((r?.data?.kalemler) || [])
    } catch { setKatalogKalemler([]) }
    finally { setYukleniyor(false) }
  }

  const toggleAcik = async () => {
    if (!acik && takimMi) await yukle()
    setAcik(!acik)
  }

  return (
    <div className="border-b border-border/10 py-0.5">
      <div className="flex items-center gap-1 text-[10px]">
        {takimMi ? (
          <button onClick={toggleAcik} title={acik ? 'Alt kalemleri kapat' : 'Alt kalemleri aç'}
            className="shrink-0 p-0.5 text-blue-600 hover:bg-blue-100 rounded">
            {acik ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : <span className="w-4 shrink-0" />}
        <input value={iletken.kisaIsim || ''} onChange={e => onKisaIsimDegistir(e.target.value)}
          placeholder="kısa isim" title="Kısa isim (sprite text'te görünür — örn. 4P+R)"
          className="w-28 rounded border border-input bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-700 focus:outline-none focus:border-amber-400" />
        <span className="flex-1 truncate cursor-pointer text-blue-700 font-medium hover:text-blue-500 hover:underline"
          title={`${iletken.tip} — tıkla değiştir`}
          onClick={() => { setDuzenle(true); setAramaVal(iletken.tip) }}>{iletken.tip}</span>
        <input type="number" value={iletken.mesafe || ''} placeholder="0" min={0}
          onChange={e => onMesafeDegistir(Number(e.target.value) || 0)}
          className="w-14 rounded border border-input px-0.5 py-0.5 text-center text-[10px]" />
        <span className="text-[9px] text-muted-foreground">m</span>
        <select value={iletken.durum || 'Yeni'}
          onChange={e => onDurumDegistir?.(e.target.value)}
          title="İletken durumu (özet hesabında bu kullanılır)"
          className={cn(
            'rounded border px-1 py-0.5 text-[10px] font-medium focus:outline-none',
            (iletken.durum === 'DMM') && 'border-orange-300 bg-orange-50 text-orange-700',
            (iletken.durum === 'Mevcut') && 'border-blue-300 bg-blue-50 text-blue-700',
            (!iletken.durum || iletken.durum === 'Yeni') && 'border-emerald-300 bg-emerald-50 text-emerald-700'
          )}>
          <option value="Yeni">Yeni</option>
          <option value="Mevcut">Mevcut</option>
          <option value="DMM">DMM</option>
        </select>
        <button onClick={onSil} className="text-red-400 hover:text-red-600 p-0.5 shrink-0"><Trash2 className="h-2.5 w-2.5" /></button>
      </div>
      {takimMi && acik && (
        <div className="ml-6 mb-1 rounded border border-blue-200 bg-blue-50/40 px-2 py-1.5">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wide text-blue-700">
              {iletken.tip} Tertibi — Katalog Kalemleri
            </span>
            {tertibi.sokakSecenekleri && (
              <span className="text-[9px] text-blue-700/70">sokak: {tertibi.sokakSecenekleri.join('/')}</span>
            )}
          </div>
          {yukleniyor ? (
            <div className="text-[10px] text-muted-foreground py-1">
              <Loader2 className="inline h-2.5 w-2.5 animate-spin mr-1" />Yükleniyor...
            </div>
          ) : (katalogKalemler && katalogKalemler.length > 0) ? (
            <div className="space-y-0.5">
              {katalogKalemler.map((k, i) => (
                <div key={i} className="flex items-center gap-1 text-[10px] text-blue-900/80">
                  <span className="w-3 text-center">·</span>
                  <span className="flex-1 truncate" title={k.katalog_adi || k.cins}>
                    {k.katalog_adi || k.cins}
                    {k.sokak && <span className="ml-1 text-[8px] text-blue-600">(sokak)</span>}
                  </span>
                  <span className="tabular-nums w-16 text-right text-foreground/80">{k.mesafe} m</span>
                  <span className="tabular-nums w-16 text-right text-foreground/70">{k.kg ? `${k.kg.toFixed(2)} kg` : '—'}</span>
                  {k.carpan > 1 && <span className="text-[9px] text-blue-700/60 w-8 text-right">({k.carpan}×)</span>}
                </div>
              ))}
              {katalogKalemler.some(k => k.tutar > 0) && (
                <div className="mt-1 pt-1 border-t border-blue-200/60 flex items-center justify-end gap-2 text-[9px] text-blue-700">
                  <span>Toplam:</span>
                  <span className="font-bold tabular-nums">
                    {katalogKalemler.reduce((s, k) => s + (k.tutar || 0), 0).toFixed(2)} ₺
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground italic">Katalog eşleşmesi bulunamadı.</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tek malzeme satırı: ad tıkla→arama, miktar düzenle, sil ──
// Bilinen grup adları (case-insensitive Türkçe normalize ile)
const GRUP_ADLARI = ['KORUMA', 'ISLETME', 'İŞLETME', 'ISLETME TOP.', 'KORUMA TOP.', 'ARMATUR', 'ARMATÜR', 'MAKARA', 'HSTA']
const trUst = (s) => String(s || '')
  .replace(/ı/g, 'I').replace(/İ/g, 'I')
  .replace(/ğ/g, 'G').replace(/Ğ/g, 'G')
  .replace(/ü/g, 'U').replace(/Ü/g, 'U')
  .replace(/ş/g, 'S').replace(/Ş/g, 'S')
  .replace(/ö/g, 'O').replace(/Ö/g, 'O')
  .replace(/ç/g, 'C').replace(/Ç/g, 'C')
  .toUpperCase().trim()
const isGrupAdi = (ad) => {
  const u = trUst(ad)
  return ['KORUMA', 'ISLETME', 'ARMATUR', 'MAKARA', 'HSTA'].includes(u)
}

function MalzemeSatirDuzenle({ malzeme, onAdiDegistir, onKisaIsimDegistir, onMiktarDegistir, onGorunurDegistir, onSil, onPatlat }) {
  const [duzenle, setDuzenle] = useState(false)
  const [aramaVal, setAramaVal] = useState('')
  const [sonuclar, setSonuclar] = useState([])
  const [araniyor, setAraniyor] = useState(false)
  const [secIdx, setSecIdx] = useState(-1)
  const [acik, setAcik] = useState(false)
  const [grupKalemleri, setGrupKalemleri] = useState(null)
  const [grupYukleniyor, setGrupYukleniyor] = useState(false)
  const [duzenleModu, setDuzenleModu] = useState(false)
  const [yerelKalemler, setYerelKalemler] = useState([])  // edit modunda override miktarlar
  const timerRef = useRef(null)
  const grupMu = isGrupAdi(malzeme.kisaIsim) || isGrupAdi(malzeme.adi)

  const grupKalemleriniGetir = async () => {
    if (grupKalemleri) return grupKalemleri
    setGrupYukleniyor(true)
    try {
      const ad = isGrupAdi(malzeme.kisaIsim) ? malzeme.kisaIsim : malzeme.adi
      const r = await api.get(`/malzeme-gruplari/by-kisa-ad/${encodeURIComponent(ad)}`)
      const data = r?.data || r
      const kalemler = data?.kalemler || []
      setGrupKalemleri(kalemler)
      return kalemler
    } catch { setGrupKalemleri([]); return [] }
    finally { setGrupYukleniyor(false) }
  }
  const toggleAcik = async () => {
    if (!acik) await grupKalemleriniGetir()
    setAcik(!acik)
    if (acik) { setDuzenleModu(false); setYerelKalemler([]) }
  }
  const duzenleyeBasla = async () => {
    const kalemler = grupKalemleri ?? await grupKalemleriniGetir()
    if (!kalemler.length) { alert('Grup kalemleri yüklenemedi.'); return }
    // Her kalem için varsayılan miktar = (grup_kalem.miktar × parent.miktar)
    setYerelKalemler(kalemler.map(k => ({
      adi: k.malzeme_adi,
      kisaIsim: k.kisa_isim || k.malzeme_adi,
      miktar: (Number(k.miktar) || 1) * (Number(malzeme.miktar) || 1),
      gorunur: false,
    })))
    setDuzenleModu(true)
  }
  const handleVazgec = () => {
    setDuzenleModu(false)
    setYerelKalemler([])
  }
  const handleTamam = () => {
    if (!yerelKalemler.length) { handleVazgec(); return }
    onPatlat?.(yerelKalemler)
    setDuzenleModu(false)
    setYerelKalemler([])
  }
  const yerelKalemMiktarDegis = (idx, deger) => {
    setYerelKalemler(prev => {
      const yeni = [...prev]
      yeni[idx] = { ...yeni[idx], miktar: Number(deger) || 0 }
      return yeni
    })
  }
  const yerelKalemSil = (idx) => {
    setYerelKalemler(prev => prev.filter((_, i) => i !== idx))
  }

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
    <>
      <div className={cn("flex items-center gap-1 text-[10px] py-0.5 border-b border-border/10", malzeme.gorunur === false && "opacity-60")}>
        {grupMu ? (
          <button onClick={toggleAcik} title={acik ? "Detayları kapat" : "Grup detaylarını aç"}
            className="shrink-0 p-0.5 text-amber-600 hover:bg-amber-100 rounded">
            {acik ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : <span className="w-4 shrink-0" />}
        <button onClick={() => onGorunurDegistir(malzeme.gorunur === false)}
          title={malzeme.gorunur === false ? "Sprite text'te göster" : "Sprite text'te gizle"}
          className={cn("shrink-0 p-0.5 rounded transition-colors",
            malzeme.gorunur === false
              ? "text-muted-foreground/40 hover:bg-muted hover:text-muted-foreground"
              : "text-emerald-600 hover:bg-emerald-50")}>
          {malzeme.gorunur === false ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
        <input value={malzeme.kisaIsim || ''} onChange={e => onKisaIsimDegistir(e.target.value)}
          placeholder="kısa isim" title="Kısa isim (sprite text'te görünür)"
          className={cn("w-28 rounded border border-input px-1 py-0.5 text-[10px] font-medium focus:outline-none focus:border-amber-400",
            grupMu ? "bg-amber-100 text-amber-800 font-bold" : "bg-amber-50 text-amber-700")} />
        <span className="flex-1 truncate cursor-pointer hover:text-primary hover:underline" title={`${malzeme.adi} — tıkla değiştir`}
          onClick={() => { setDuzenle(true); setAramaVal(malzeme.adi) }}>{malzeme.adi}</span>
        <input type="number" value={malzeme.miktar} min={1}
          onChange={e => onMiktarDegistir(Number(e.target.value) || 1)}
          className="w-10 rounded border border-input px-0.5 py-0.5 text-center text-[10px]" />
        <button onClick={onSil} className="text-red-400 hover:text-red-600 p-0.5 shrink-0"><Trash2 className="h-2.5 w-2.5" /></button>
      </div>
      {grupMu && acik && (
        <div className="ml-6 mb-1 rounded border border-amber-200 bg-amber-50/40 px-2 py-1.5">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wide text-amber-700">
              {malzeme.kisaIsim || malzeme.adi} Grubu Kalemleri{duzenleModu ? ' — Düzenleme' : ''}
            </span>
            {!duzenleModu && onPatlat && (
              <button onClick={duzenleyeBasla}
                className="rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-medium text-white hover:bg-amber-600">
                Detayları Düzenle (Grubu Aç)
              </button>
            )}
            {duzenleModu && (
              <div className="flex items-center gap-1">
                <button onClick={handleTamam}
                  className="rounded bg-emerald-500 px-2 py-0.5 text-[9px] font-medium text-white hover:bg-emerald-600">
                  Tamam
                </button>
                <button onClick={handleVazgec}
                  className="rounded border border-input bg-white px-2 py-0.5 text-[9px] font-medium text-muted-foreground hover:bg-muted">
                  Vazgeç
                </button>
              </div>
            )}
          </div>
          {grupYukleniyor ? (
            <div className="text-[10px] text-muted-foreground py-1">
              <Loader2 className="inline h-2.5 w-2.5 animate-spin mr-1" />Yükleniyor...
            </div>
          ) : duzenleModu ? (
            // Düzenleme modu: her kalem için input + sil
            <div className="space-y-0.5">
              {yerelKalemler.length === 0 ? (
                <div className="text-[10px] text-muted-foreground italic">Tüm kalemler silindi — "Vazgeç" ile geri al</div>
              ) : yerelKalemler.map((k, i) => (
                <div key={i} className="flex items-center gap-1 text-[10px]">
                  <span className="w-3 text-center text-amber-700">·</span>
                  <span className="flex-1 truncate text-amber-900">{k.adi}</span>
                  <input type="number" value={k.miktar} min={0}
                    onChange={e => yerelKalemMiktarDegis(i, e.target.value)}
                    className="w-12 rounded border border-amber-300 bg-white px-1 py-0.5 text-center text-[10px]" />
                  <button onClick={() => yerelKalemSil(i)}
                    className="text-red-400 hover:text-red-600 p-0.5 shrink-0"
                    title="Bu kalemi gruptan çıkar">
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              <div className="mt-1 pt-1 border-t border-amber-200/60 text-[9px] text-amber-700/80 italic">
                "Tamam" → grup açılır, alt kalemler bu direğin malzemelerine eklenir. "Vazgeç" → değişiklik yapılmaz.
              </div>
            </div>
          ) : grupKalemleri && grupKalemleri.length > 0 ? (
            // Salt-okur görünüm
            <div className="space-y-0.5">
              {grupKalemleri.map((k, i) => (
                <div key={i} className="flex items-center gap-1 text-[10px] text-amber-900/80">
                  <span className="w-3 text-center">·</span>
                  <span className="flex-1 truncate">{k.malzeme_adi}</span>
                  <span className="tabular-nums w-12 text-right">
                    {(Number(k.miktar) || 1) * (Number(malzeme.miktar) || 1)} {k.birim || 'Ad'}
                  </span>
                  <span className="text-[9px] text-amber-700/60 w-12 text-right">
                    ({Number(k.miktar) || 1}/{malzeme.kisaIsim || 'grup'})
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground italic">Grup tanımı bulunamadı.</div>
          )}
        </div>
      )}
    </>
  )
}

// Müşterek hat text'ini AG ve OG metinlerine ayır.
// Dış parantez korunur (durum belirleyici): "[3xSW + 4P+R]" → ["[4P+R]","[3xSW]"]
function tertibiTextleriAyir(text) {
  if (!text) return { agText: null, ogText: null }
  const raw = String(text).trim()
  let disDurum = ''
  let ic = raw
  const disPar = raw.match(/^\((.*)\)$/) || raw.match(/^\[(.*)\]$/)
  if (disPar && !/[\(\)\[\]]/.test(disPar[1])) {
    disDurum = raw[0] === '[' ? '[]' : '()'
    ic = disPar[1].trim()
  }
  const ogTokenRe = /(\[?\(?\s*\d*x?(?:SW|SWALLOW|266|477|1\/0|PIGEON|RAVEN|HAWK|PARTRIDGE)\s*\]?\)?|\[?\(?\s*3x0\s*\]?\)?)/i
  const ogMatch = ic.match(ogTokenRe)
  const sarmala = (s) => {
    if (!s) return s
    if (disDurum === '[]') return `[${s}]`
    if (disDurum === '()') return `(${s})`
    return s
  }
  if (ogMatch) {
    const ogText = ogMatch[0].trim()
    const kalan = ic.replace(ogMatch[0], '').replace(/^\s*\+\s*|\s*\+\s*$/g, '').trim()
    const agText = kalan.length > 0 ? kalan : null
    return { agText: sarmala(agText), ogText: sarmala(ogText) }
  }
  return { agText: sarmala(ic), ogText: null }
}

// ── İletken metnini ayrıştır ──
// Girdi örnekleri: "3x70/16+95_AER", "(4P+R)", "[3xSW]+[4P+R]", "3xSW+(4P+R)", "(3xSW)+(4P+R)"
// Çıktı: { agIletken: {tip,kesit|tertip,tel_sayisi}, ogIletken: {tip,tertip,faz_sayisi}, durum }
function parseIletken(text) {
  if (!text) return { agIletken: null, ogIletken: null, durum: 'Yeni' }
  const ham = text.trim()
  // Tüm metinde [ varsa DMM, ( varsa ama [] yok → Mevcut, hiçbiri → Yeni
  const tumDmm = /\[/.test(ham)
  const tumMevcut = !tumDmm && /^\(/.test(ham)
  const durumGenel = tumDmm ? 'DMM' : (tumMevcut ? 'Mevcut' : 'Yeni')

  // Parantezleri parça parça çözümle: her bölüm için durumu farklı olabilir
  // "3xSW+(4P+R)" → OG yeni "3xSW" + AG mevcut "4P+R"
  const ogPattern = /(\(|\[)?([0-9]+\s*x\s*(?:SW|SWALLOW|PIGEON|RAVEN|HAWK|PARTRIDGE))(\)|\])?/i
  const agAerPattern = /(\(|\[)?(\d+\s*x\s*\d+\s*\/?\s*\d*\s*\+?\s*\d*[_\s]*AER)(\)|\])?/i
  // AG çıplak tertip: 4P+R, 3A+P/R, 5xR, 4P. (SW olmamak şartıyla)
  const agCiplakPattern = /(\(|\[)?(\d+\s*x?\s*[PARLI](?:[+\/][PARLI]+)*)(\)|\])?/i
  // Çıplak Al iletken: 3x150/70-Al, 3x150/70-Al/95ÇLK
  const ciplakAlPattern = /(\(|\[)?(\d+\s*x\s*\d+\s*\/?\s*\d*\s*-\s*AL[\/\d]*[ÇCK]*)(\)|\])?/i

  let agIletken = null, ogIletken = null

  const ogMatch = ham.match(ogPattern)
  if (ogMatch) {
    const fazSay = parseInt(ogMatch[2].match(/^(\d+)/)?.[1] || '3')
    const ogDur = ogMatch[1] === '[' ? 'DMM' : (ogMatch[1] === '(' ? 'Mevcut' : 'Yeni')
    ogIletken = { tip: 'CIPLAK', tertip: ogMatch[2].trim(), faz_sayisi: fazSay, durum: ogDur }
  }
  const aerMatch = ham.match(agAerPattern)
  const alMatch = ham.match(ciplakAlPattern)
  if (aerMatch) {
    const kesitMatch = aerMatch[2].match(/3x(\d+)/i)
    const agDur = aerMatch[1] === '[' ? 'DMM' : (aerMatch[1] === '(' ? 'Mevcut' : 'Yeni')
    agIletken = { tip: 'AER', kesit: kesitMatch?.[1] || null, durum: agDur }
  } else if (alMatch) {
    // Çıplak Al — N95 + konsol kombinasyonuyla taşınır (4P+R'a benzer)
    const agDur = alMatch[1] === '[' ? 'DMM' : (alMatch[1] === '(' ? 'Mevcut' : 'Yeni')
    agIletken = { tip: 'CIPLAK_AL', tertip: alMatch[2].trim(), tel_sayisi: 4, durum: agDur }
  } else {
    // Sadece AER/Al yoksa AG çıplak harf-tertibe bak
    // Önce OG eşleşmesini metinden çıkar (ki "3xSW+(4P+R)" sadece (4P+R)'i bulsun)
    const ogIle = ogMatch ? ham.replace(ogMatch[0], '') : ham
    const ciplakMatch = ogIle.match(agCiplakPattern)
    if (ciplakMatch) {
      const tertip = ciplakMatch[2]
      if (!/SW/i.test(tertip)) {
        const tel = (() => {
          let toplam = 0
          // 4P, 5xR, 3A
          for (const m of tertip.matchAll(/(\d+)\s*x?\s*[PARLI]/gi)) toplam += parseInt(m[1])
          // +R, +P/R
          for (const m of tertip.matchAll(/\+\s*([PARLI](?:\/[PARLI])*)/gi)) toplam += m[1].split('/').length
          return toplam || 5
        })()
        const agDur = ciplakMatch[1] === '[' ? 'DMM' : (ciplakMatch[1] === '(' ? 'Mevcut' : 'Yeni')
        agIletken = { tip: 'CIPLAK', tertip, tel_sayisi: tel, durum: agDur }
      }
    }
  }

  return { agIletken, ogIletken, durum: durumGenel }
}

// ── Direk koşullarını analiz et ──
function analizDirek(rawTip, sembol, komsular) {
  const tip = rawTip || ''
  const tipUst = tip.toUpperCase()
  const potans = /\(P\)/.test(tipUst)
  // Çift apostrof: '' veya " (DXF kaynağına göre değişebilir)
  const ciftApos = /''/.test(tip) || /[A-Z0-9]"/.test(tip)
  const isKtipi = /\bG-?K\d/i.test(tip) || /\bK\d/.test(tip)              // K-tipi (kafes)
  const isItipi = /\bG-?(8|10|12)\s*I/i.test(tip) || /^(8|10|12)\s*I/i.test(tip) // 8I/10I/12I
  const isE = /^E$/i.test(tip.trim())
  const isBeton = /^\d+\s*\/\s*\d+/.test(tip)                             // "11/5"
  const isHsta = /\(S\)\s*$/i.test(tip)                                    // G-N-14(S) gibi
  const isAgac = /\b\d+\s*-\s*O\b/i.test(tip) || /^\d+\s*-\s*O$/i.test(tip) // 9-O, 12-O ahşap direk

  // Sembol durumu (Yeni/Mevcut/DMM) — DXF parser kuralları
  const SEMBOL_DURUM = {
    'A': 'Mevcut', 'R': 'Mevcut', 'P': 'Mevcut',
    '8': 'Yeni', 'E': 'Yeni', 'M': 'Yeni',
    'T': 'DMM', 'B': 'DMM', 'S': 'DMM',
  }
  const direkDurum = SEMBOL_DURUM[sembol] || 'Yeni'

  // AG konsol tipi: K-direkte 6,5U-100, A-tipi I-direkte 6,5U-80
  // Diğer direklerde (E, beton vb.) varsayılan 6,5U-80
  const agKonsolTipi = isKtipi ? '6,5U-100' : '6,5U-80'

  // İletken — komşulardan ilkine bak (en yakın hat). DİKKAT: hat durumu (Mevcut/DMM)
  // konsol seçimini ETKİLEMEZ; direk yeniyse konsol da yeni eklenir.
  const komsuList = komsular || []
  const ilkIletken = komsuList[0]?.iletken || ''
  const { agIletken, ogIletken } = parseIletken(ilkIletken)

  return {
    tip, potans, ciftApos, isKtipi, isItipi, isE, isBeton, isHsta,
    direkDurum, agKonsolTipi, agIletken, ogIletken,
  }
}

// ── Otomatik malzeme kuralları (KARAR AĞACI) ──
// Bkz: doc/hakediş/kroki-analizi/DIREK-DONANIM-KURALLARI.md §7
//
// KURAL ÖZETİ:
//  - Direk YENİ ise üzerindeki konsoller de YENİ. Hat MEVCUT/DMM olsa bile konsol seçilir.
//  - AG konsol tipi: K-tipi (kafes) direkte 6,5U-100; A-tipi (I-direk) ve diğerlerinde 6,5U-80
//  - AER → 1 konsol + 1 MAKARA
//  - Açık iletken → ceil(tel/2) konsol + tel sayısı kadar N95 (1 konsole 2 iletken)
//  - OG çift apostroflu I-direk: T-200 + 3 VHD;  K-direk: D-250 + 6 TG+40KN + 3 VHD
//  - HSTA direği (G-*(S)): + 1 HSTA
//  - Potans (P) direkleri: konsol yerine D-AG-3 / T-AG-5 traversi
function hesaplaOtoMalzemeler(tip, yakinlar, komsular, sembol) {
  const a = analizDirek(tip, sembol, komsular)
  const oto = []
  const ekle = (adi, miktar = 1) => oto.push({ adi, miktar, birim: 'Ad', gorunur: false })

  // A) MEVCUT direk → boş liste (hat durumu fark etmez; sadece direk yeniyse devam)
  if (a.direkDurum === 'Mevcut') {
    return oto
  }

  // B) HSTA direği (S sonlu, ör. G-N-14(S)): HSTA grubu eklenir.
  // "HSTA" kısa adıyla grup tanınır → akordyon açıldığında 5 alt kalem (ayırıcı,
  // topraklama 95mm² 20m, köşebent, 6× VHD 35, 6× B 95) gösterilir/patlatılır.
  if (a.isHsta) {
    oto.push({ adi: 'HSTA', kisaIsim: 'HSTA', miktar: 1, birim: 'Ad', gorunur: false })
  }

  // C) Potans direği — konsol kullanılmaz, AG traversi
  if (a.potans) {
    if (a.isKtipi)         ekle('D-AG-3', 1)
    else /*A-tipi/diğer*/  ekle('T-AG-5', 1)
  }
  // D) AG+OG geçiş direği (çift apostrof) — iki katmanlı donanım
  else if (a.ciftApos) {
    // OG katmanı
    if (a.isKtipi) {
      ekle('D-250', 1)
      ekle('TG+40 KN', 6)
      ekle('VHD', 3)
    } else {
      ekle('T-200', 1)
      ekle('VHD', 3)
    }
    // AG katmanı (mevcut OG direğine yeni AG ankrajı)
    ekle('T-250', 1)
    ekle(a.agKonsolTipi, 1)
    ekle('MAKARA', 1)
  }
  // E) Trafo altı E direği — AG kablo + OG havadan iniyor (TAG-5)
  else if (yakinlar?.trafoAlti && a.agIletken?.tip === 'AER') {
    ekle('TAG-5', 1)
    ekle('MAKARA', 1)
  }
  // F) Normal direkler — iletken tipine göre konsol+izolatör
  else {
    // F.1) AG AER kablo (askılı): 1 konsol + 1 MAKARA
    if (a.agIletken?.tip === 'AER') {
      ekle(a.agKonsolTipi, 1)
      ekle('MAKARA', 1)
    }
    // F.2) AG açık iletken (P, R, A …): 1 konsole 2 iletken
    else if (a.agIletken?.tip === 'CIPLAK' || a.agIletken?.tip === 'CIPLAK_AL') {
      const tel = a.agIletken.tel_sayisi || 5
      const konsolAdedi = Math.max(1, Math.ceil(tel / 2))
      ekle(a.agKonsolTipi, konsolAdedi)
      ekle('N95', tel)            // her iletken için 1 izolatör
    }

    // F.3) OG çıplak iletken (3SW, 3xPIGEON vb.) — direk tipine göre
    if (a.ogIletken?.tip === 'CIPLAK') {
      const fazSay = a.ogIletken.faz_sayisi || 3
      if (a.isKtipi) {
        ekle('D-250', 1)
        ekle('TG+40 KN', fazSay * 2)   // 3 faz × 2 yön
        ekle('VHD', fazSay)
      } else {
        ekle('T-200', 1)
        ekle('VHD', fazSay)
      }
    }
  }

  // G) Topraklama — grup adı olarak tek kelime (malzeme özetinde alt kalemlerine patlatılır)
  if (yakinlar?.koruma) ekle('KORUMA', 1)
  if (yakinlar?.isletme) ekle('İŞLETME', 1)
  if (yakinlar?.armatur) ekle('ARMATÜR', 1)

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
      // Format: tip|mesafe|kisaIsim|gorunur|durum   (geriye uyumlu: eksik parçalar fallback)
      const tip = parts[0] || raw
      // Durum fallback: notlarda yoksa, OG iletkense og_iletken_durum, değilse ag_iletken_durum
      const isOg = /SW|SWALLOW|PIGEON|RAVEN|HAWK|PARTRIDGE/i.test(tip)
      const fallbackDurum = isOg ? (s.og_iletken_durum || 'Yeni') : (s.ag_iletken_durum || 'Yeni')
      return {
        tip,
        mesafe: parts[1] ? Number(parts[1]) : 0,
        kisaIsim: parts[2] !== undefined ? parts[2] : (parts[0] || raw),
        gorunur: parts[3] !== undefined ? parts[3] !== '0' : true,
        durum: parts[4] || fallbackDurum,
      }
    })
    return { malz, iltk }
  }

  const [localMalz, setLocalMalz] = useState(() => parseNotlar(s.notlar).malz)
  const [localIltk, setLocalIltk] = useState(() => parseNotlar(s.notlar).iltk)
  // DXF üzerindeki sprite text görünürlüğü — direk başına bir flag.
  // sprite_veri.aktif kayıtlıysa onu kullan, yoksa default false (kullanıcı Eye ile açar).
  const [spriteAktif, setSpriteAktif] = useState(() => {
    try {
      const sv = typeof s.sprite_veri === 'string' ? JSON.parse(s.sprite_veri) : s.sprite_veri
      return sv?.aktif === true
    } catch { return false }
  })
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

  // Sprite text güncelleme yardımcısı:
  //  - aktif=false  → sprite kaldırılır (boş satırlar)
  //  - aktif=true   → SADECE gorunur !== false olan MALZEMELER yazılır.
  //    İletkenler sprite text'te GÖSTERİLMEZ.
  const spriteSenkronize = (malzList, _iltkList, aktif) => {
    if (!aktif) {
      onSpriteGuncelle?.(s.nokta1, [])
      return
    }
    const satirlar = malzList
      .filter(m => m.gorunur !== false)
      .map(m => `${m.miktar}x ${m.kisaIsim || m.adi}`)
    onSpriteGuncelle?.(s.nokta1, satirlar)
  }

  // Eye butonu tıklayınca sprite görünürlüğünü toggle et
  const spriteToggle = () => {
    const yeni = !spriteAktif
    setSpriteAktif(yeni)
    spriteSenkronize(localMalz, localIltk, yeni)
    // sprite_veri.aktif flag'ini DB'ye yaz (kalıcılık)
    try {
      const mevcutSv = typeof s.sprite_veri === 'string' ? JSON.parse(s.sprite_veri || '{}') : (s.sprite_veri || {})
      const yeniSv = { ...mevcutSv, aktif: yeni }
      onGuncelle('sprite_veri', JSON.stringify(yeniSv))
    } catch { onGuncelle('sprite_veri', JSON.stringify({ aktif: yeni })) }
  }

  // Notları kaydet — local state anında güncellenir, DB debounce ile
  const kaydetTimerRef = useRef(null)
  const bekleyenNotlarRef = useRef(null)
  const [kaydedildi, setKaydedildi] = useState(false)
  // Anında kaydet — debounce'u atlar, "Kaydet" butonu için
  const hemenKaydet = () => {
    if (kaydetTimerRef.current) {
      clearTimeout(kaydetTimerRef.current)
      kaydetTimerRef.current = null
    }
    if (bekleyenNotlarRef.current != null) {
      onGuncelle('notlar', bekleyenNotlarRef.current)
      bekleyenNotlarRef.current = null
    }
    setKaydedildi(true)
    setTimeout(() => setKaydedildi(false), 1500)
  }
  // Global "Tümünü Kaydet" event'i — header butonu tüm direkleri flush eder
  useEffect(() => {
    const handler = (e) => {
      const proje = e.detail?.projeId
      if (proje && proje !== s.proje_id) return
      hemenKaydet()
    }
    window.addEventListener('metraj-flush-all', handler)
    return () => window.removeEventListener('metraj-flush-all', handler)
  }, [s.proje_id])
  const notlariKaydet = (malzList, iltkList) => {
    // Local state anında güncelle (UI hızlı)
    setLocalMalz(malzList)
    setLocalIltk(iltkList)
    // Sprite anında güncelle — direk-bazlı `spriteAktif` flag'i true ise tüm kalemler
    // çizimdeki text nesnesine yazılır; false ise boş satırlar (sprite kaldırılır).
    spriteSenkronize(malzList, iltkList, spriteAktif)
    // DB kaydetmeyi debounce et
    const yeniNotlar = [
      ...malzList.map(m => `${m.miktar}|${m.kisaIsim || ''}|${m.adi}|${m.gorunur === false ? '0' : '1'}`),
      ...iltkList.map(il => `Iletken: ${il.tip}|${il.mesafe || 0}|${il.kisaIsim || ''}|${il.gorunur === false ? '0' : '1'}|${il.durum || 'Yeni'}`),
    ].join('\n')
    sonNotlarRef.current = yeniNotlar
    bekleyenNotlarRef.current = yeniNotlar
    if (kaydetTimerRef.current) clearTimeout(kaydetTimerRef.current)
    kaydetTimerRef.current = setTimeout(() => {
      onGuncelle('notlar', yeniNotlar)
      bekleyenNotlarRef.current = null
      kaydetTimerRef.current = null
    }, 600)

    // Hat uzunluğunu (ara_mesafe) iletken mesafelerinden otomatik senkronize
    // Tek iletken varsa onun mesafesi; birden fazla varsa en uzun olanı; yoksa 0.
    const yeniMesafe = iltkList.length === 0
      ? 0
      : Math.max(...iltkList.map(il => Number(il.mesafe) || 0))
    if (Number(s.ara_mesafe || 0) !== yeniMesafe) {
      onGuncelle('ara_mesafe', yeniMesafe)
    }
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
      // Grup → tek bir PARENT satır olarak ekle (kısa adı KORUMA / MAKARA / İŞLETME …)
      // Akordeyon ile detayları açıp düzenleyebilir; özet listesinde alt kalemlere otomatik patlatılır.
      const yeniMalz = [
        ...malzemeSatirlari,
        { miktar: 1, kisaIsim: item.kisa_ad, adi: item.kisa_ad, gorunur: false },
      ]
      notlariKaydet(yeniMalz, iletkenSatirlari)
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
      // 1) Grup seçildiyse → PARENT satır olarak ekle (akordeyon ile alt kalemler açılır)
      if (ogeGrup) {
        const r = await api.get(`/malzeme-gruplari/${secim.id}`).catch(() => null)
        const detay = r?.data
        const ad = detay?.kisa_ad || secim.deger
        if (ad) {
          const yeniMalz = [
            ...malzemeSatirlari,
            { miktar: 1, kisaIsim: ad, adi: ad, gorunur: false },
          ]
          notlariKaydet(yeniMalz, iletkenSatirlari)
        }
        return
      }
      // 2) Metin — önce kısa ad grup kontrolü → bulunduysa PARENT satır
      const grupR = await api.get(`/malzeme-gruplari/by-kisa-ad/${encodeURIComponent(t)}`).catch(() => null)
      const grup = grupR?.data
      if (grup) {
        const ad = grup.kisa_ad
        const yeniMalz = [
          ...malzemeSatirlari,
          { miktar: 1, kisaIsim: ad, adi: ad, gorunur: false },
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
        {(() => {
          const toplam = malzemeSatirlari.length + iletkenSatirlari.length
          return (
            <button
              onClick={e => { e.stopPropagation(); if (toplam > 0) spriteToggle() }}
              disabled={toplam === 0}
              title={toplam === 0
                ? 'Önce malzeme/iletken ekleyin'
                : spriteAktif ? 'Çizimdeki sprite text\'ini gizle' : 'Direk envanteri çizime sprite text olarak yansıt'}
              className={cn(
                'rounded p-0.5 transition-colors',
                toplam === 0 ? 'text-muted-foreground/30 cursor-not-allowed'
                  : spriteAktif ? 'text-emerald-600 hover:bg-emerald-50'
                  : 'text-muted-foreground/40 hover:bg-muted hover:text-muted-foreground'
              )}
            >
              {spriteAktif ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
          )
        })()}
        <button onClick={e => { e.stopPropagation(); hemenKaydet() }}
          title={kaydedildi ? 'Kaydedildi' : 'Bu satırı hemen kaydet (debounce\'ı atla)'}
          className={cn('rounded p-0.5 transition-colors',
            kaydedildi ? 'text-emerald-600 bg-emerald-50' : 'text-muted-foreground/50 hover:bg-blue-50 hover:text-blue-700')}>
          {kaydedildi ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
        </button>
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
            <label className="flex items-center gap-1" title="İletken mesafesinden otomatik hesaplanır — aşağıdaki iletken satırından düzenleyin">
              <span className="text-muted-foreground">Mesafe:</span>
              <input type="number" value={s.ara_mesafe || 0} readOnly tabIndex={-1}
                className="w-14 rounded border border-input bg-slate-100 px-1 py-0.5 text-[10px] text-right cursor-not-allowed text-muted-foreground" />
              <span className="text-muted-foreground">m</span>
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
                    onPatlat={(altKalemler) => {
                      // Grup satırı çıkar, alt kalemler aynı yere eklensin
                      const yeni = [...malzemeSatirlari]
                      yeni.splice(i, 1, ...altKalemler)
                      notlariKaydet(yeni, iletkenSatirlari)
                    }}
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
                    onDurumDegistir={(yeniDurum) => { const yeni = [...iletkenSatirlari]; yeni[i] = { ...il, durum: yeniDurum }; notlariKaydet(malzemeSatirlari, yeni) }}
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
  // Undo / Redo
  const { data: gecmisData } = konfig.hooks.useGecmis ? konfig.hooks.useGecmis(projeId) : { data: null }
  const undo = konfig.hooks.useUndo ? konfig.hooks.useUndo(projeId) : null
  const redo = konfig.hooks.useRedo ? konfig.hooks.useRedo(projeId) : null
  const undoVar = !!gecmisData?.undo
  const redoVar = !!gecmisData?.redo
  const qc = useQueryClient()
  const [seciliIdler, setSeciliIdler] = useState(new Set())
  const [acikIdler, setAcikIdler] = useState(new Set())
  const [tumKaydedildi, setTumKaydedildi] = useState(false)

  const handleUndo = useCallback(async () => {
    if (!undo || !undoVar) return
    try {
      const r = await undo.mutateAsync()
      const data = r?.data || r
      if (data?.undone > 0) {
        // Sessiz başarı — istenirse toast eklenebilir
        console.info(`[Undo] ${data.undone} işlem geri alındı: ${data.aciklama || ''}`)
      }
    } catch (e) { alert('Geri alma hatası: ' + (e.message || '')) }
  }, [undo, undoVar])

  const handleRedo = useCallback(async () => {
    if (!redo || !redoVar) return
    try {
      const r = await redo.mutateAsync()
      const data = r?.data || r
      if (data?.redone > 0) {
        console.info(`[Redo] ${data.redone} işlem tekrar uygulandı: ${data.aciklama || ''}`)
      }
    } catch (e) { alert('Yeniden uygulama hatası: ' + (e.message || '')) }
  }, [redo, redoVar])

  // Klavye kısayolları: Ctrl+Z / Ctrl+Shift+Z (veya Ctrl+Y)
  useEffect(() => {
    const handler = (e) => {
      // Input'a yazılırken kısayolları yutma — sadece tablo aktifken
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault(); handleUndo()
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault(); handleRedo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo, handleRedo])

  // Bir direk bilgisinden yeni satır oluştur ya da mevcut satırı aç
  // (Hem click handler hem otomatik tespit butonu tarafından kullanılır)
  // batchInfo: { batch_id, aciklama } — varsa ekle isteğine eklenir (otomatik tespit için)
  const direkBilgisiniIsle = useCallback(async (bilgi, mevcutSatirlar, opts = {}) => {
    const { zorlaYeni = false, acma = true, batchInfo = null } = opts
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
    const otoMalz = hesaplaOtoMalzemeler(rawTip, bilgi.yakinlar, bilgi.komsular, bilgi.sembol)
    const otoNotlar = otoMalz.map(m => `${m.miktar}|${m.kisaIsim || ''}|${m.adi}|${m.gorunur === false ? '0' : '1'}`).join('\n')
    const iletkenText = komsu?.iletken || ''
    // Müşterek hat text'i (ör. "3xSW + 4P+R") AG ve OG'ye ayrılır; her ikisi de açık hat
    // tertibi (4P+R, 4xR, 1xP, 3A+R/P) veya OG (3xSW/1/0/3x266/3x477) olabilir.
    const { agText, ogText } = tertibiTextleriAyir(iletkenText)
    // Parantezler durum belirler: "[X]" → DMM, "(X)" → Mevcut, parantezsiz → Yeni
    const durumCikar = (s) => {
      if (!s) return 'Yeni'
      if (/^\[/.test(s)) return 'DMM'
      if (/^\(/.test(s)) return 'Mevcut'
      return 'Yeni'
    }
    const norm = (s) => s ? s.replace(/_/g, ' ').replace(/[()[\]]/g, '').trim() : null
    const agIletken = norm(agText)
    const ogIletken = norm(ogText)
    const agDurum = durumCikar(agText)
    const ogDurum = durumCikar(ogText)
    const iletkenBulundu = !!(agIletken || ogIletken)
    // Notlar formatı: "Iletken: <kısa>|<mesafe>|<kısa>|1|<durum>"
    // Tip alanına parantez konmaz; durum 5. parçaya yazılır.
    const iletkenNotlari = []
    if (ogIletken) iletkenNotlari.push(`Iletken: ${ogIletken}|${komsu?.mesafe || 0}|${ogIletken}|1|${ogDurum}`)
    if (agIletken) iletkenNotlari.push(`Iletken: ${agIletken}|${komsu?.mesafe || 0}|${agIletken}|1|${agDurum}`)
    const iletkenNot = iletkenNotlari.join('\n')
    const baslangicMesafe = iletkenBulundu ? (komsu?.mesafe || 0) : 0
    // Direğin kendi durumu sembole göre belirleniyorsa onu kullan, yoksa komşu hat durumu
    const direkDurum = bilgi.durum || komsu?.hatDurum || 'Yeni'
    const res = await ekle.mutateAsync({
      nokta1: numara,
      nokta2: komsu?.numara || '',
      nokta_durum: direkDurum,
      direk_tur: turFromTip,
      direk_tip: cleanTip || rawTip,
      ara_mesafe: baslangicMesafe,
      ag_iletken: agIletken,
      og_iletken: ogIletken,
      ag_iletken_durum: komsu?.hatDurum || 'Yeni',
      notlar: [otoNotlar, iletkenNot].filter(Boolean).join('\n'),
      kaynak: 'kroki',
      ...(batchInfo ? { _batch_id: batchInfo.batch_id, _aciklama: batchInfo.aciklama } : {}),
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
      const elemanData = elemanRes?.data || elemanRes
      const elemanlar = elemanData?.elemanlar || []
      const trafolarServer = elemanData?.trafolar || []

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

      // Tüm bu işlemleri tek bir undo grubu yap (Otomatik Tespit'ten önceki duruma dönmek için)
      const batchInfo = {
        batch_id: (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : `oto-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        aciklama: `Otomatik Tespit (${anaDirekler.length} direk)`,
      }

      let guncelSatirlar = [...(satirlar || [])]
      let eklenen = 0
      // Trafo elemanları — server'dan TRAFO_* katmanındakilerle birlikte gelir
      const trafolar = trafolarServer
      console.info('[OtoTespit] Trafo eleman sayısı:', trafolar.length)
      for (let i = 0; i < anaDirekler.length; i++) {
        const d = anaDirekler[i]
        setOtoTaraIlerleme({ yapilan: i + 1, toplam: anaDirekler.length })
        const yakinlar = { armatur: false, koruma: false, isletme: false, trafoAlti: false }
        for (const el of elemanlar) {
          if (el.numara !== d.numara || el === d) continue
          if (el.sembol === 'C') yakinlar.armatur = true
          if (el.sembol === '4') yakinlar.koruma = true
          if (el.sembol === '5') yakinlar.isletme = true
        }
        // Trafo altı tespiti — direğe en yakın trafo < 25m mesafede ise
        for (const t of trafolar) {
          const dx = (t.x || 0) - (d.x || 0), dy = (t.y || 0) - (d.y || 0)
          if (Math.sqrt(dx * dx + dy * dy) < 25) { yakinlar.trafoAlti = true; break }
        }
        const durum = SEMBOL_DURUM[d.sembol] || 'Yeni'
        const bilgi = {
          numara: d.numara, tip: d.tip, sembol: d.sembol, sembolAdi: d.sembolAdi,
          komsular: d.komsular, yakinlar, durum,
        }
        // Otomatik tespit: zorla yeni satır + batch_id ile grupla (tek undo ile geri al)
        const sonuc = await direkBilgisiniIsle(bilgi, guncelSatirlar, {
          zorlaYeni: true, acma: false, batchInfo,
        })
        if (sonuc?.yeni && sonuc.id) {
          guncelSatirlar.push({ id: sonuc.id, nokta1: d.numara })
          eklenen++
        }
      }
      alert(`${anaDirekler.length} direk tarandı, ${eklenen} yeni satır eklendi.\nGeri almak için Ctrl+Z.`)
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
          <button onClick={handleUndo} disabled={!undoVar || undo?.isPending}
            title={undoVar ? `Geri Al (Ctrl+Z)${gecmisData?.liste?.[0]?.aciklama ? ' — ' + gecmisData.liste[0].aciklama : ''}` : 'Geri alınacak işlem yok'}
            className="flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-700 hover:bg-amber-100 disabled:opacity-40">
            {undo?.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />} Geri Al
          </button>
          <button onClick={handleRedo} disabled={!redoVar || redo?.isPending}
            title={redoVar ? 'İleri Al (Ctrl+Y)' : 'Tekrar uygulanacak işlem yok'}
            className="flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-700 hover:bg-amber-100 disabled:opacity-40">
            {redo?.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Redo2 className="h-3 w-3" />} İleri Al
          </button>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('metraj-flush-all', { detail: { projeId } }))
              setTumKaydedildi(true)
              setTimeout(() => setTumKaydedildi(false), 1500)
            }}
            title="Tüm bekleyen değişiklikleri anında kaydet (debounce'u atla)"
            className={cn('flex items-center gap-1 rounded px-2 py-1.5 text-xs font-medium transition-colors',
              tumKaydedildi
                ? 'bg-emerald-600 text-white'
                : 'border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100')}>
            {tumKaydedildi ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
            {tumKaydedildi ? 'Kaydedildi' : 'Tümünü Kaydet'}
          </button>
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
          <div className="rounded border border-input bg-card px-3 py-2"><p className="text-[10px] text-muted-foreground">DMM</p><p className="text-lg font-bold text-orange-600">{ozet.dmm_nokta ?? ozet.demontaj_nokta ?? 0}</p></div>
        </div>
      )}

      {/* Durum filtresi */}
      <div className="mb-2 flex items-center gap-1 text-xs">
        <span className="text-muted-foreground mr-1">Durum:</span>
        {[
          { key: null, label: 'Tümü', sayi: satirlar?.length || 0, renk: 'text-foreground' },
          { key: 'Yeni', label: 'Yeni', sayi: (satirlar || []).filter(s => s.nokta_durum === 'Yeni').length, renk: 'text-emerald-600' },
          { key: 'Mevcut', label: 'Mevcut', sayi: (satirlar || []).filter(s => s.nokta_durum === 'Mevcut').length, renk: 'text-blue-600' },
          { key: 'DMM', label: 'DMM', sayi: (satirlar || []).filter(s => s.nokta_durum === 'DMM').length, renk: 'text-orange-600' },
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
function DurumRozeti({ durum }) {
  if (!durum) return <span className="text-muted-foreground/40">-</span>
  const renk = durum === 'DMM' ? 'bg-orange-100 text-orange-700 border-orange-300'
    : durum === 'Demontaj' ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200' // Yeni
  return (
    <span className={cn('inline-block rounded border px-1.5 py-0.5 text-[9px] font-semibold', renk)}>
      {durum}
    </span>
  )
}

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
              <th className="px-2 py-1.5 text-center w-16">Durum</th>
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
                  <td className="px-2 py-1.5 text-center"><DurumRozeti durum={g.durum} /></td>
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
                    <td className="px-2 py-1 text-center"><DurumRozeti durum={c.durum} /></td>
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
                  <td colSpan={7} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
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
                    <td className="px-2 py-1 text-center"><DurumRozeti durum={b.durum} /></td>
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
