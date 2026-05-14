import { useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, Pencil, Trash2, X, CheckSquare, FileSpreadsheet, AlertTriangle, Clock, Check, Lock, Unlock, Loader2, ChevronDown, Printer } from 'lucide-react'
import { useProjeler, useProjeSil, useTopluProjeSil, useProjeGuncelle, useProjeKismiGuncelle } from '@/hooks/useProjeler'
import { useIsTipleri } from '@/hooks/useIsTipleri'
import { useBolgeler } from '@/hooks/useBolgeler'
import { useEkipler } from '@/hooks/useEkipler'
import { useIhaleler } from '@/hooks/useIhaleler'
import { useDonguSablonlari } from '@/hooks/useDongu'
import { ONCELIK_LABELS } from '@/utils/constants'
import { useAuth } from '@/context/AuthContext'
import DataTable from '@/components/shared/DataTable'
import { OncelikBadge } from '@/components/shared/StatusBadge'
import MalzemeTalepModal from './MalzemeTalepModal'
import YerTeslimXlsxModal from './YerTeslimXlsxModal'
import ExcelExportModal from './ExcelExportModal'
import PrintModal from './PrintModal'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { TableSkeleton } from '@/components/shared/LoadingSkeleton'
import { PROJE_DURUMLARI } from '@/utils/constants'
import { cn } from '@/lib/utils'

// Proje tamamlanmış mı? Durum kodlarına bakar
const TAMAMLANDI_DURUMLAR = new Set([
  'tamamlandi', 'kabul', 'kabul_edildi', 'enerjilendi', 'kapali', 'iptal',
])

function projeDurumu(proje) {
  // Tarihleri parse et
  const bas = proje.baslama_tarihi ? new Date(proje.baslama_tarihi) : null
  const bit = proje.bitis_tarihi ? new Date(proje.bitis_tarihi) : null
  // Bugün (saat sıfırlanmış)
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0)
  // Tamamlanma kontrolü
  const tamamlandi = (Number(proje.tamamlanma_yuzdesi) >= 100)
    || TAMAMLANDI_DURUMLAR.has(String(proje.durum || '').toLowerCase())
    || String(proje.aktif_adim_durum || '').toLowerCase() === 'tamamlandi'
  if (tamamlandi) return 'tamamlandi'
  if (bit && bit < bugun) return 'gecikti'        // bitiş geçmiş + tamamlanmadı
  if (bas && bit && bas <= bugun && bugun <= bit) return 'devam'
  if (bas && bas > bugun) return 'beklemede'
  return 'belirsiz'
}

// Proje (çizim/kurum süreci) aşamaları — sıraya göre rengi de değişir
const PROJE_ASAMA_SECENEKLERI = [
  { kod: 'yukleme_sekmesi_yok', etiket: 'Yükleme Sekmesi Yok',   renk: 'bg-gray-100 text-gray-600 border-gray-300' },
  { kod: 'eksik_bilgi',       etiket: 'Eksik Bilgi-Sorulacak', renk: 'bg-yellow-50 text-yellow-800 border-yellow-400' },
  { kod: 'cizilecek',         etiket: 'Çizilecek',             renk: 'bg-slate-100 text-slate-700 border-slate-300' },
  { kod: 'cizildi',                 etiket: 'Çizildi',                 renk: 'bg-blue-50 text-blue-700 border-blue-300' },
  { kod: 'cizildi_yedas_yukleyecek', etiket: 'Çizildi-Yedaş Yükleyecek', renk: 'bg-cyan-50 text-cyan-700 border-cyan-300' },
  { kod: 'yuklendi',                etiket: 'Yüklendi-Sistemde',       renk: 'bg-indigo-50 text-indigo-700 border-indigo-300' },
  { kod: 'ret_oldu',          etiket: 'Ret Oldu',              renk: 'bg-red-50 text-red-700 border-red-300' },
  { kod: 'revize_edilecek',   etiket: 'Revize Edilecek',       renk: 'bg-orange-50 text-orange-700 border-orange-300' },
  { kod: 'revize_yuklendi',   etiket: 'Revize Yüklendi',       renk: 'bg-amber-50 text-amber-800 border-amber-300' },
  { kod: 'onaylandi',         etiket: 'Onaylandı',             renk: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
]

// Saha (yapım/iş durumu) aşamaları — doc/ilerleme-11.05.xlsx O sütunundaki "İŞ DURUMU"
// değerleriyle uyumlu. Excel'den toplu senkronizasyon için saha_iletken_durum
// sütunu bu kodlar üzerinden tutulur.
const SAHA_ASAMA_SECENEKLERI = [
  { kod: 'yer_teslimi_yapilmadi', etiket: 'Yer Teslimi Yapılmadı', renk: 'bg-orange-50 text-orange-700 border-orange-300' },
  { kod: 'yer_teslimi_yapildi',   etiket: 'Yer Teslimi Yapıldı',   renk: 'bg-blue-50 text-blue-700 border-blue-300' },
  { kod: 'devam_ediyor',          etiket: 'Devam Ediyor',          renk: 'bg-amber-50 text-amber-800 border-amber-400' },
  { kod: 'tamamlandi',            etiket: 'Tamamlandı',            renk: 'bg-emerald-50 text-emerald-700 border-emerald-400 font-semibold' },
]

const _asamaLookup = (liste) => Object.fromEntries(liste.map(s => [s.kod, s]))
const PROJE_ASAMA_MAP = _asamaLookup(PROJE_ASAMA_SECENEKLERI)
const SAHA_ASAMA_MAP = _asamaLookup(SAHA_ASAMA_SECENEKLERI)

// Tarih bazlı filtre seçenekleri — başlangıç ve bitiş tarihlerine göre kategoriler
const TARIH_FILTRE_SECENEKLERI = [
  { kod: 'baslangic_gecti',  etiket: 'Başlangıç geçenler' },
  { kod: 'bitis_gecti',      etiket: 'Bitiş geçenler' },
  { kod: 'yapim',            etiket: 'Yapım aşamasında (başlangıç-bitiş arası)' },
  { kod: 'baslama_gelmedi',  etiket: 'Başlama gelmeyenler' },
  { kod: 'tarih_yok',        etiket: 'Tarih girilmemiş' },
]
// Bir projeyi belirli bir tarih kategorisine göre değerlendir
function tarihKategoriUyar(p, kod) {
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0)
  const bas = p.baslama_tarihi ? new Date(p.baslama_tarihi) : null
  const bit = p.bitis_tarihi ? new Date(p.bitis_tarihi) : null
  if (kod === 'tarih_yok') return !bas && !bit
  if (kod === 'baslangic_gecti') return !!bas && bas <= bugun
  if (kod === 'bitis_gecti') return !!bit && bit < bugun
  if (kod === 'yapim') return !!bas && !!bit && bas <= bugun && bugun <= bit
  if (kod === 'baslama_gelmedi') return !!bas && bas > bugun
  return false
}

function AsamaBadge({ kod, map }) {
  if (!kod) return <span className="text-muted-foreground">-</span>
  const s = map[kod]
  if (!s) return <span className="text-xs text-muted-foreground">{kod}</span>
  return (
    <span className={cn('inline-block rounded border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap', s.renk)}>
      {s.etiket}
    </span>
  )
}

// Durum sütunu yerine bu adımlar için ayrı sütunlar — her hücre o adıma yüklenmiş dosya sayısını gösterir
const ADIM_SUTUNLARI = [
  { kod: 'cbs_altlik',         baslik: 'CBS altlık' },
  { kod: 'mevcut_durum_proje', baslik: 'Mevcut Durum' },
  { kod: 'yeni_durum_proje',   baslik: 'Yeni Durum' },
  { kod: 'demontaj_krokisi',   baslik: 'Demontaj Krokisi' },
  { kod: 'metraj',             baslik: 'Metraj' },
  { kod: 'hak_edis_krokisi',   baslik: 'Hak Ediş Krokisi' },
  { kod: 'gecici_kabul',       baslik: 'Geçici Kabul' },
  { kod: 'eksik_giderim',      baslik: 'EVP' },
  { kod: 'kabul_tutanaklar',   baslik: 'BHP' },
]

function projeAdimlari(proje) {
  if (proje.__adimlar) return proje.__adimlar
  try {
    proje.__adimlar = proje.adimlar_json ? JSON.parse(proje.adimlar_json) : []
  } catch { proje.__adimlar = [] }
  return proje.__adimlar
}

function AdimDosyaSayisiHucresi({ proje, kod }) {
  const adim = projeAdimlari(proje).find(a => a.adim_kodu === kod)
  if (!adim) return <span className="text-muted-foreground/40">-</span>
  const sayi = Number(adim.dosya_sayisi || 0)
  if (sayi === 0) {
    return <span className="text-muted-foreground/30 text-xs tabular-nums">0</span>
  }
  return (
    <span className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-semibold tabular-nums">
      {sayi}
    </span>
  )
}

function TarihHucresi({ proje, alan }) {
  const v = alan === 'baslama' ? proje.baslama_tarihi : proje.bitis_tarihi
  if (!v) return <span className="text-muted-foreground">-</span>
  const tarih = String(v).slice(0, 10)
  const durum = projeDurumu(proje)
  if (durum === 'devam') {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 border border-orange-300">
        <Clock className="h-3 w-3" /> {tarih}
      </span>
    )
  }
  if (durum === 'gecikti' && alan === 'bitis') {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold bg-red-100 text-red-800 border border-red-400 animate-pulse">
        <AlertTriangle className="h-3 w-3 text-red-600 animate-bounce" /> {tarih}
      </span>
    )
  }
  if (durum === 'gecikti' && alan === 'baslama') {
    return <span className="text-xs text-red-600">{tarih}</span>
  }
  if (durum === 'tamamlandi') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
        <Check className="h-3 w-3" /> {tarih}
      </span>
    )
  }
  return <span className="text-xs">{tarih}</span>
}

export default function ProjeListesi() {
  const navigate = useNavigate()
  const { izinVar } = useAuth()
  const silmeYetkisi = izinVar('projeler', 'silme')

  const [filtreler, setFiltreler] = useState({ durum: '', bolge_id: '', tip: '', yer_teslim: '', ihale_id: '', saha_asamalar: [], tarih_durumlari: [] })
  const [sahaSecimAcik, setSahaSecimAcik] = useState(false)
  const [tarihSecimAcik, setTarihSecimAcik] = useState(false)
  // Artırım yüzdesi (Excel KET-YB özet sayfasındaki %10 markup'ı taklit eder)
  // Sözleşme keşfi etkilenmez; sadece fiyat ve ilerleme değerleri çarpılır.
  const [artirimYuzdesi, setArtirimYuzdesi] = useState(() => {
    const v = Number(localStorage.getItem('proje_artirim_yuzdesi'))
    return Number.isFinite(v) && v >= 0 ? v : 10
  })
  const carpan = 1 + (Number(artirimYuzdesi) || 0) / 100
  // %10 (default) için Excel-uyumlu birebir hesap (her satırı +%10 yuvarlı fiyatla çarpar)
  // Diğer % için matematiksel `raw × carpan` (yaklaşık)
  const isExcel10 = Number(artirimYuzdesi) === 10
  const tutarHesapla = (p) => {
    const t = isExcel10 ? Number(p.kesif_toplam_tutar_artirimli) : (Number(p.kesif_toplam_tutar) || 0) * carpan
    return t || 0
  }
  const ilerlemeHesapla = (p) => {
    const i = isExcel10 ? Number(p.kesif_ilerleme_tutar_artirimli) : (Number(p.kesif_ilerleme_tutar) || 0) * carpan
    return i || 0
  }
  // Durum filtresi server'a göndermiyoruz (DB'de p.durum çoğunlukla 'baslama')
  // → client-side projeDurumu() veya aktif adım kodu üzerinden filtreleme
  const { durum: durumFiltresi, saha_asamalar: sahaAsamalar, tarih_durumlari: tarihDurumlari, ...serverFiltreler } = filtreler
  const { data: rawProjeler, isLoading } = useProjeler(serverFiltreler)
  // Yer teslim + İhale + Durum + Saha aşaması client-side filtre
  const projeler = useMemo(() => {
    if (!rawProjeler) return rawProjeler
    let liste = rawProjeler
    if (filtreler.yer_teslim === 'var') liste = liste.filter(p => !!p.teslim_tarihi)
    else if (filtreler.yer_teslim === 'yok') liste = liste.filter(p => !p.teslim_tarihi)
    if (filtreler.ihale_id) {
      const ihaleFid = parseInt(filtreler.ihale_id)
      if (filtreler.ihale_id === 'yok') liste = liste.filter(p => !p.ihale_id)
      else liste = liste.filter(p => p.ihale_id === ihaleFid)
    }
    // Durum filtresi:
    //   "_PROJE_<kod>" → p.proje_asama === kod  (cizildi, cizilecek, revize_edilecek...)
    //   "_DURUM_<x>"   → projeDurumu() === x    (devam/gecikti/tamamlandi/beklemede)
    if (durumFiltresi) {
      if (durumFiltresi.startsWith('_PROJE_')) {
        const hedef = durumFiltresi.slice(7)
        liste = liste.filter(p => p.proje_asama === hedef)
      } else if (durumFiltresi.startsWith('_DURUM_')) {
        const hedef = durumFiltresi.slice(7)
        liste = liste.filter(p => projeDurumu(p) === hedef)
      }
    }
    // Saha aşaması — çoklu seçim (en az biri eşleşmeli).
    // '__BOS__' özel kodu: saha_asama null/boş olan projeler için.
    if (sahaAsamalar && sahaAsamalar.length > 0) {
      const set = new Set(sahaAsamalar)
      const bosVarMi = set.has('__BOS__')
      liste = liste.filter(p => {
        const v = p.saha_asama
        if (!v) return bosVarMi
        return set.has(v)
      })
    }
    // Tarih bazlı çoklu filtre — en az biri eşleşmeli (OR)
    if (tarihDurumlari && tarihDurumlari.length > 0) {
      liste = liste.filter(p => tarihDurumlari.some(k => tarihKategoriUyar(p, k)))
    }
    return liste
  }, [rawProjeler, filtreler.yer_teslim, filtreler.ihale_id, durumFiltresi, sahaAsamalar, tarihDurumlari])
  const { data: bolgeler } = useBolgeler()
  const { data: isTipleri } = useIsTipleri()
  const { data: ekipler } = useEkipler()
  const { data: ihaleler } = useIhaleler()
  const { data: sablonlar } = useDonguSablonlari()
  const projeSil = useProjeSil()
  const topluSil = useTopluProjeSil()
  const projeGuncelle = useProjeGuncelle()
  const projeKismiGuncelle = useProjeKismiGuncelle()

  // ── Satır + Sütun kilit/düzenleme modları ──
  // Aynı anda yalnızca bir kilit açık olabilir. Kilit açıkken diğer aksiyonlar engellenir.
  const [kilitliId, setKilitliId] = useState(null)         // Satır kilidi
  const [kilitliKolon, setKilitliKolon] = useState(null)   // Sütun kilidi (alan adı)
  const [duzenleForm, setDuzenleForm] = useState({})
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const kilitAcikMi = (id) => kilitliId === id
  const kolonAcikMi = (alan) => kilitliKolon === alan
  // Başka aksiyonların yutulması — kilit açıkken bunu çağır
  const engelTetik = useCallback((e) => {
    if (kilitliId === null && kilitliKolon === null) return false
    e?.stopPropagation?.()
    e?.preventDefault?.()
    alert('Önce açık olan kilidi kapatın (satır veya sütun kilidi).')
    return true
  }, [kilitliId, kilitliKolon])

  const kilitAc = (proje) => {
    setKilitliId(proje.id)
    setDuzenleForm({
      proje_no: proje.proje_no || '',
      proje_tipi: proje.proje_tipi || '',
      bolge_id: proje.bolge_id != null ? String(proje.bolge_id) : '',
      musteri_adi: proje.musteri_adi || '',
      ekip_id: proje.ekip_id != null ? String(proje.ekip_id) : '',
      oncelik: proje.oncelik || 'normal',
      teslim_tarihi: (proje.teslim_tarihi || '').slice(0, 10),
      baslama_tarihi: (proje.baslama_tarihi || '').slice(0, 10),
      bitis_tarihi: (proje.bitis_tarihi || '').slice(0, 10),
      proje_asama: proje.proje_asama || '',
      saha_asama: proje.saha_asama || '',
    })
  }

  const duzenleAlanGuncelle = (alan, deger) => {
    setDuzenleForm(prev => ({ ...prev, [alan]: deger }))
  }

  const kilitKapat = async () => {
    if (kilitliId == null) return
    setKaydediliyor(true)
    try {
      // Yapım süresi (gün) — başla ve bitiş tarihlerinden hesapla
      const bas = duzenleForm.baslama_tarihi
      const bit = duzenleForm.bitis_tarihi
      let tahmini_sure_gun = null
      if (bas && bit) {
        const fark = Math.round((new Date(bit) - new Date(bas)) / 86400000)
        if (fark > 0) tahmini_sure_gun = fark
      }
      await projeKismiGuncelle.mutateAsync({
        id: kilitliId,
        proje_no: duzenleForm.proje_no,
        proje_tipi: duzenleForm.proje_tipi,
        bolge_id: duzenleForm.bolge_id ? parseInt(duzenleForm.bolge_id) : null,
        musteri_adi: duzenleForm.musteri_adi || null,
        ekip_id: duzenleForm.ekip_id ? parseInt(duzenleForm.ekip_id) : null,
        oncelik: duzenleForm.oncelik || 'normal',
        teslim_tarihi: duzenleForm.teslim_tarihi || null,
        baslama_tarihi: duzenleForm.baslama_tarihi || null,
        bitis_tarihi: duzenleForm.bitis_tarihi || null,
        proje_asama: duzenleForm.proje_asama || null,
        saha_asama: duzenleForm.saha_asama || null,
        tahmini_sure_gun,
      })
      setKilitliId(null)
      setDuzenleForm({})
    } catch (e) {
      alert('Kaydedilemedi: ' + (e.message || ''))
    } finally {
      setKaydediliyor(false)
    }
  }

  const kilitIptal = () => {
    if (kilitliId == null) return
    setKilitliId(null)
    setDuzenleForm({})
  }

  // Sütun kilidi: aç/kapat
  const kolonKilitToggle = (alan) => {
    if (kilitliId !== null) {
      alert('Önce açık satır kilidini kapatın.')
      return
    }
    if (kilitliKolon === alan) {
      setKilitliKolon(null) // kapat
    } else if (kilitliKolon !== null) {
      alert('Önce açık olan sütunu kilitleyin.')
    } else {
      setKilitliKolon(alan)
    }
  }

  // Sütun kilidi açıkken bir hücreyi anında günceller (debounce yok — onChange/onBlur ile çağrılır)
  const kolonHucreGuncelle = useCallback(async (proje, alan, yeniDeger) => {
    const payload = { id: proje.id }
    let val = yeniDeger
    if (val === '') val = null
    if ((alan === 'bolge_id' || alan === 'ekip_id') && val != null) {
      val = parseInt(val) || null
    }
    payload[alan] = val
    // Tarih değişikliklerinde tahmini_sure_gun yeniden hesapla
    if (alan === 'baslama_tarihi' || alan === 'bitis_tarihi') {
      const bas = alan === 'baslama_tarihi' ? val : (proje.baslama_tarihi || '').slice(0, 10) || null
      const bit = alan === 'bitis_tarihi' ? val : (proje.bitis_tarihi || '').slice(0, 10) || null
      if (bas && bit) {
        const fark = Math.round((new Date(bit) - new Date(bas)) / 86400000)
        payload.tahmini_sure_gun = fark > 0 ? fark : null
      }
    }
    try { await projeKismiGuncelle.mutateAsync(payload) }
    catch (e) { alert('Güncellenemedi: ' + (e.message || '')) }
  }, [projeKismiGuncelle])

  // Sütun başlığında kilit ikonu
  const KolonBaslik = ({ baslik, alan }) => {
    const acik = kolonAcikMi(alan)
    return (
      <div className="flex items-center gap-1 whitespace-nowrap">
        <span>{baslik}</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); kolonKilitToggle(alan) }}
          className={cn(
            'p-0.5 rounded transition-colors',
            acik
              ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
              : 'text-muted-foreground/40 hover:text-amber-700 hover:bg-amber-50'
          )}
          title={acik ? `${baslik} sütununu kilitle` : `${baslik} sütununu düzenlemek için aç`}
        >
          {acik ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
        </button>
      </div>
    )
  }

  const [silmeDialogAcik, setSilmeDialogAcik] = useState(false)
  const [silinecekProje, setSilinecekProje] = useState(null)
  const [silmeHatasi, setSilmeHatasi] = useState(null)

  // Checkbox seçim state
  const [seciliIdler, setSeciliIdler] = useState(new Set())
  const [topluSilmeDialogAcik, setTopluSilmeDialogAcik] = useState(false)
  const [malzemeTalepModalAcik, setMalzemeTalepModalAcik] = useState(false)
  const [yerTeslimXlsxModalAcik, setYerTeslimXlsxModalAcik] = useState(false)
  const [excelExportModalAcik, setExcelExportModalAcik] = useState(false)
  const [printModalAcik, setPrintModalAcik] = useState(false)

  const secimDegistir = useCallback((id) => {
    setSeciliIdler((prev) => {
      const yeni = new Set(prev)
      if (yeni.has(id)) yeni.delete(id)
      else yeni.add(id)
      return yeni
    })
  }, [])

  const tumunuSec = useCallback(() => {
    if (!projeler) return
    if (seciliIdler.size === projeler.length) {
      setSeciliIdler(new Set())
    } else {
      setSeciliIdler(new Set(projeler.map((p) => p.id)))
    }
  }, [projeler, seciliIdler.size])

  const secimiTemizle = useCallback(() => {
    setSeciliIdler(new Set())
  }, [])

  // Tüm şablonlardaki tekrarsız aşamalar (filtre için)
  const tumAsamalar = useMemo(() => {
    if (!sablonlar) return null
    const map = new Map()
    for (const s of sablonlar) {
      for (const a of s.asamalar || []) {
        if (!map.has(a.asama_kodu)) {
          map.set(a.asama_kodu, { kod: a.asama_kodu, adi: a.asama_adi, ikon: a.ikon })
        }
      }
    }
    return map.size > 0 ? Array.from(map.values()) : null
  }, [sablonlar])

  const handleSil = () => {
    if (!silinecekProje) return
    setSilmeHatasi(null)
    projeSil.mutate(silinecekProje.id, {
      onSuccess: () => {
        setSilinecekProje(null)
        setSilmeDialogAcik(false)
        // Silinen proje seçiliyse seçimden çıkar
        setSeciliIdler((prev) => {
          const yeni = new Set(prev)
          yeni.delete(silinecekProje.id)
          return yeni
        })
      },
      onError: (err) => {
        setSilmeHatasi(err.message || 'Proje silinirken bir hata olustu')
      },
    })
  }

  const handleTopluSil = () => {
    setSilmeHatasi(null)
    topluSil.mutate([...seciliIdler], {
      onSuccess: () => {
        setSeciliIdler(new Set())
        setTopluSilmeDialogAcik(false)
      },
      onError: (err) => {
        setSilmeHatasi(err.response?.data?.error || err.message || 'Toplu silme sirasinda hata olustu')
      },
    })
  }

  const handleFiltreChange = (key, value) => {
    setFiltreler((prev) => ({ ...prev, [key]: value }))
  }

  const columns = useMemo(
    () => [
      // Checkbox sütunu
      ...[
            {
              id: 'secim',
              header: () => (
                <input
                  type="checkbox"
                  checked={projeler?.length > 0 && seciliIdler.size === projeler.length}
                  ref={(el) => {
                    if (el) el.indeterminate = seciliIdler.size > 0 && seciliIdler.size < (projeler?.length || 0)
                  }}
                  onChange={tumunuSec}
                  className="h-4 w-4 rounded border-gray-300 text-primary accent-primary cursor-pointer"
                />
              ),
              cell: ({ row }) => {
                const p = row.original
                const isLocked = kilitliId === p.id
                return (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={seciliIdler.has(p.id)}
                      disabled={kilitliId !== null && kilitliId !== p.id}
                      onChange={(e) => {
                        e.stopPropagation()
                        if (engelTetik(e)) return
                        secimDegistir(p.id)
                      }}
                      onClick={(e) => { e.stopPropagation(); if (engelTetik(e)) return }}
                      className="h-4 w-4 rounded border-gray-300 text-primary accent-primary cursor-pointer disabled:opacity-30"
                    />
                    {isLocked ? (
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); kilitKapat() }}
                          disabled={kaydediliyor}
                          title="Kaydet ve kilitle"
                          className="p-1 rounded hover:bg-emerald-100 text-emerald-600 disabled:opacity-50"
                        >
                          {kaydediliyor ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); kilitIptal() }}
                          disabled={kaydediliyor}
                          title="İptal"
                          className="p-1 rounded hover:bg-red-100 text-red-600 disabled:opacity-50"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (kilitliId !== null && kilitliId !== p.id) {
                            engelTetik(e)
                            return
                          }
                          kilitAc(p)
                        }}
                        title="Satırı düzenle"
                        className="p-1 rounded hover:bg-amber-100 text-muted-foreground hover:text-amber-700"
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )
              },
              enableSorting: false,
              size: 80,
            },
          ],
      {
        accessorKey: 'excel_sira',
        header: '#',
        cell: ({ row }) => {
          const s = row.original.excel_sira
          return s != null
            ? <span className="text-xs tabular-nums text-muted-foreground">{s}</span>
            : <span className="text-xs text-muted-foreground/40">-</span>
        },
        size: 36,
      },
      {
        accessorKey: 'proje_no',
        header: () => <KolonBaslik baslik="Proje No" alan="proje_no" />,
        cell: ({ row }) => {
          const p = row.original
          if (kilitAcikMi(p.id)) {
            return (
              <input type="text" value={duzenleForm.proje_no || ''}
                onChange={(e) => duzenleAlanGuncelle('proje_no', e.target.value)}
                className="w-28 rounded border border-amber-400 bg-amber-50 px-1.5 py-0.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-400" />
            )
          }
          if (kolonAcikMi('proje_no')) {
            return (
              <input type="text" defaultValue={p.proje_no || ''}
                onBlur={(e) => { if (e.target.value !== (p.proje_no || '')) kolonHucreGuncelle(p, 'proje_no', e.target.value) }}
                className="w-28 rounded border border-emerald-400 bg-emerald-50 px-1.5 py-0.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            )
          }
          return (
            <button
              onClick={(e) => { if (engelTetik(e)) return; navigate(`/projeler/${p.id}`) }}
              className="font-medium text-primary hover:underline"
            >
              {p.proje_no}
            </button>
          )
        },
      },
      {
        accessorKey: 'proje_tipi',
        header: () => <KolonBaslik baslik="Tür" alan="proje_tipi" />,
        cell: ({ getValue, row }) => {
          const p = row.original
          if (kilitAcikMi(p.id)) {
            return (
              <select value={duzenleForm.proje_tipi || ''}
                onChange={(e) => duzenleAlanGuncelle('proje_tipi', e.target.value)}
                className="rounded border border-amber-400 bg-amber-50 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400">
                <option value="">-</option>
                {(isTipleri || []).map(t => <option key={t.id} value={t.kod}>{t.kod}</option>)}
              </select>
            )
          }
          if (kolonAcikMi('proje_tipi')) {
            return (
              <select value={p.proje_tipi || ''}
                onChange={(e) => kolonHucreGuncelle(p, 'proje_tipi', e.target.value)}
                className="rounded border border-emerald-400 bg-emerald-50 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400">
                <option value="">-</option>
                {(isTipleri || []).map(t => <option key={t.id} value={t.kod}>{t.kod}</option>)}
              </select>
            )
          }
          return (
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium">
              {getValue()}
            </span>
          )
        },
      },
      {
        accessorKey: 'bolge_adi',
        header: () => <KolonBaslik baslik="Bolge" alan="bolge_id" />,
        cell: ({ row }) => {
          const p = row.original
          if (kilitAcikMi(p.id)) {
            return (
              <select value={duzenleForm.bolge_id || ''}
                onChange={(e) => duzenleAlanGuncelle('bolge_id', e.target.value)}
                className="rounded border border-amber-400 bg-amber-50 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400">
                <option value="">-</option>
                {(bolgeler || []).map(b => <option key={b.id} value={b.id}>{b.bolge_adi}</option>)}
              </select>
            )
          }
          if (kolonAcikMi('bolge_id')) {
            return (
              <select value={p.bolge_id != null ? String(p.bolge_id) : ''}
                onChange={(e) => kolonHucreGuncelle(p, 'bolge_id', e.target.value)}
                className="rounded border border-emerald-400 bg-emerald-50 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400">
                <option value="">-</option>
                {(bolgeler || []).map(b => <option key={b.id} value={b.id}>{b.bolge_adi}</option>)}
              </select>
            )
          }
          return p.bolge_adi || '-'
        },
      },
      {
        accessorKey: 'musteri_adi',
        header: () => <KolonBaslik baslik="Proje Adı" alan="musteri_adi" />,
        cell: ({ row }) => {
          const p = row.original
          if (kilitAcikMi(p.id)) {
            return (
              <input type="text" value={duzenleForm.musteri_adi || ''}
                onChange={(e) => duzenleAlanGuncelle('musteri_adi', e.target.value)}
                autoComplete="off"
                className="w-48 rounded border border-amber-400 bg-amber-50 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
            )
          }
          if (kolonAcikMi('musteri_adi')) {
            return (
              <input type="text" defaultValue={p.musteri_adi || ''}
                autoComplete="off"
                onBlur={(e) => { if (e.target.value !== (p.musteri_adi || '')) kolonHucreGuncelle(p, 'musteri_adi', e.target.value) }}
                className="w-48 rounded border border-emerald-400 bg-emerald-50 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            )
          }
          return p.musteri_adi || '-'
        },
      },
      {
        accessorKey: 'ekip_adi',
        header: () => <KolonBaslik baslik="Ekip" alan="ekip_id" />,
        cell: ({ row }) => {
          const p = row.original
          if (kilitAcikMi(p.id)) {
            return (
              <select value={duzenleForm.ekip_id || ''}
                onChange={(e) => duzenleAlanGuncelle('ekip_id', e.target.value)}
                className="rounded border border-amber-400 bg-amber-50 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400">
                <option value="">-</option>
                {(ekipler || []).map(e => <option key={e.id} value={e.id}>{e.ekip_adi}</option>)}
              </select>
            )
          }
          if (kolonAcikMi('ekip_id')) {
            return (
              <select value={p.ekip_id != null ? String(p.ekip_id) : ''}
                onChange={(e) => kolonHucreGuncelle(p, 'ekip_id', e.target.value)}
                className="rounded border border-emerald-400 bg-emerald-50 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400">
                <option value="">-</option>
                {(ekipler || []).map(e => <option key={e.id} value={e.id}>{e.ekip_adi}</option>)}
              </select>
            )
          }
          return p.ekip_adi
            ? <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{p.ekip_adi}</span>
            : <span className="text-muted-foreground">-</span>
        },
      },
      {
        accessorKey: 'kesif_ilerleme_tutar',
        header: 'İlerleme',
        cell: ({ row }) => {
          const tutar = ilerlemeHesapla(row.original)
          const raw = Number(row.original.kesif_ilerleme_tutar) || 0
          const toplam = Number(row.original.kesif_toplam_tutar) || 0
          const yuzde = toplam > 0 && raw > 0 ? Math.round((raw * 100) / toplam) : 0
          if (!tutar) return <span className="text-muted-foreground">-</span>
          return (
            <div className="flex flex-col leading-tight">
              <span className="tabular-nums font-medium text-blue-700">
                {tutar.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺
              </span>
              {yuzde > 0 && <span className="text-[10px] text-muted-foreground">%{yuzde}</span>}
            </div>
          )
        },
      },
      {
        accessorKey: 'kesif_toplam_tutar',
        header: 'Fiyat',
        cell: ({ row }) => {
          const tutar = tutarHesapla(row.original)
          if (!tutar) return <span className="text-muted-foreground">-</span>
          return <span className="tabular-nums font-medium text-emerald-700">
            {tutar.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺
          </span>
        },
      },
      {
        accessorKey: 'sozlesme_kesfi',
        header: 'Sözleşme Keşfi',
        cell: ({ row }) => {
          const tutar = Number(row.original.sozlesme_kesfi) || 0
          if (!tutar) return <span className="text-muted-foreground">-</span>
          return <span className="tabular-nums text-slate-700">
            {tutar.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺
          </span>
        },
      },
      ...ADIM_SUTUNLARI.map(({ kod, baslik }) => ({
        id: `adim_${kod}`,
        header: () => (
          <div
            className="text-[11px] font-medium normal-case tracking-normal whitespace-nowrap"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            title={baslik}
          >
            {baslik}
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-center">
            <AdimDosyaSayisiHucresi proje={row.original} kod={kod} />
          </div>
        ),
        meta: {
          thClassName: 'px-1 py-2 align-bottom text-center',
          thStyle: { width: 32, minWidth: 32, maxWidth: 32, height: 130 },
          tdClassName: 'px-0 py-2 text-center',
          tdStyle: { width: 32, minWidth: 32, maxWidth: 32 },
        },
      })),
      {
        accessorKey: 'teslim_tarihi',
        header: () => <KolonBaslik baslik="Yer Teslim" alan="teslim_tarihi" />,
        cell: ({ getValue, row }) => {
          const p = row.original
          if (kilitAcikMi(p.id)) {
            return (
              <input type="date" value={duzenleForm.teslim_tarihi || ''}
                onChange={(e) => duzenleAlanGuncelle('teslim_tarihi', e.target.value)}
                className="rounded border border-amber-400 bg-amber-50 px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
            )
          }
          if (kolonAcikMi('teslim_tarihi')) {
            return (
              <input type="date" value={(p.teslim_tarihi || '').slice(0, 10)}
                onChange={(e) => kolonHucreGuncelle(p, 'teslim_tarihi', e.target.value)}
                className="rounded border border-emerald-400 bg-emerald-50 px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            )
          }
          const v = getValue()
          return v ? <span className="text-xs">{v.slice(0, 10)}</span> : <span className="text-muted-foreground">-</span>
        },
      },
      {
        accessorKey: 'baslama_tarihi',
        header: () => <KolonBaslik baslik="Başlangıç" alan="baslama_tarihi" />,
        cell: ({ row }) => {
          const p = row.original
          if (kilitAcikMi(p.id)) {
            return (
              <input type="date" value={duzenleForm.baslama_tarihi || ''}
                onChange={(e) => duzenleAlanGuncelle('baslama_tarihi', e.target.value)}
                className="rounded border border-amber-400 bg-amber-50 px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
            )
          }
          if (kolonAcikMi('baslama_tarihi')) {
            return (
              <input type="date" value={(p.baslama_tarihi || '').slice(0, 10)}
                onChange={(e) => kolonHucreGuncelle(p, 'baslama_tarihi', e.target.value)}
                className="rounded border border-emerald-400 bg-emerald-50 px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            )
          }
          return <TarihHucresi proje={p} alan="baslama" />
        },
      },
      {
        accessorKey: 'bitis_tarihi',
        header: () => <KolonBaslik baslik="Bitiş" alan="bitis_tarihi" />,
        cell: ({ row }) => {
          const p = row.original
          if (kilitAcikMi(p.id)) {
            const bas = duzenleForm.baslama_tarihi
            const bit = duzenleForm.bitis_tarihi
            const fark = bas && bit ? Math.round((new Date(bit) - new Date(bas)) / 86400000) : null
            return (
              <div className="flex flex-col gap-0.5">
                <input type="date" value={bit || ''}
                  onChange={(e) => duzenleAlanGuncelle('bitis_tarihi', e.target.value)}
                  className="rounded border border-amber-400 bg-amber-50 px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
                {fark != null && fark > 0 && (
                  <span className="text-[9px] text-amber-700/80">Süre: {fark} gün</span>
                )}
              </div>
            )
          }
          if (kolonAcikMi('bitis_tarihi')) {
            return (
              <input type="date" value={(p.bitis_tarihi || '').slice(0, 10)}
                onChange={(e) => kolonHucreGuncelle(p, 'bitis_tarihi', e.target.value)}
                className="rounded border border-emerald-400 bg-emerald-50 px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            )
          }
          return <TarihHucresi proje={p} alan="bitis" />
        },
      },
      {
        accessorKey: 'proje_asama',
        header: () => <KolonBaslik baslik="Proje" alan="proje_asama" />,
        cell: ({ row }) => {
          const p = row.original
          if (kilitAcikMi(p.id)) {
            return (
              <select value={duzenleForm.proje_asama || ''}
                onChange={(e) => duzenleAlanGuncelle('proje_asama', e.target.value)}
                className="rounded border border-amber-400 bg-amber-50 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400">
                <option value="">-</option>
                {PROJE_ASAMA_SECENEKLERI.map(s => <option key={s.kod} value={s.kod}>{s.etiket}</option>)}
              </select>
            )
          }
          if (kolonAcikMi('proje_asama')) {
            return (
              <select value={p.proje_asama || ''}
                onChange={(e) => kolonHucreGuncelle(p, 'proje_asama', e.target.value)}
                className="rounded border border-emerald-400 bg-emerald-50 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400">
                <option value="">-</option>
                {PROJE_ASAMA_SECENEKLERI.map(s => <option key={s.kod} value={s.kod}>{s.etiket}</option>)}
              </select>
            )
          }
          return <AsamaBadge kod={p.proje_asama} map={PROJE_ASAMA_MAP} />
        },
      },
      {
        accessorKey: 'saha_asama',
        header: () => <KolonBaslik baslik="Saha" alan="saha_asama" />,
        cell: ({ row }) => {
          const p = row.original
          if (kilitAcikMi(p.id)) {
            return (
              <select value={duzenleForm.saha_asama || ''}
                onChange={(e) => duzenleAlanGuncelle('saha_asama', e.target.value)}
                className="rounded border border-amber-400 bg-amber-50 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400">
                <option value="">-</option>
                {SAHA_ASAMA_SECENEKLERI.map(s => <option key={s.kod} value={s.kod}>{s.etiket}</option>)}
              </select>
            )
          }
          if (kolonAcikMi('saha_asama')) {
            return (
              <select value={p.saha_asama || ''}
                onChange={(e) => kolonHucreGuncelle(p, 'saha_asama', e.target.value)}
                className="rounded border border-emerald-400 bg-emerald-50 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400">
                <option value="">-</option>
                {SAHA_ASAMA_SECENEKLERI.map(s => <option key={s.kod} value={s.kod}>{s.etiket}</option>)}
              </select>
            )
          }
          return <AsamaBadge kod={p.saha_asama} map={SAHA_ASAMA_MAP} />
        },
      },
      {
        accessorKey: 'oncelik',
        header: () => <KolonBaslik baslik="Oncelik" alan="oncelik" />,
        cell: ({ getValue, row }) => {
          const p = row.original
          if (kilitAcikMi(p.id)) {
            return (
              <select value={duzenleForm.oncelik || 'normal'}
                onChange={(e) => duzenleAlanGuncelle('oncelik', e.target.value)}
                className="rounded border border-amber-400 bg-amber-50 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400">
                {Object.entries(ONCELIK_LABELS || { dusuk:'Düşük', normal:'Normal', yuksek:'Yüksek', acil:'Acil' }).map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            )
          }
          if (kolonAcikMi('oncelik')) {
            return (
              <select value={p.oncelik || 'normal'}
                onChange={(e) => kolonHucreGuncelle(p, 'oncelik', e.target.value)}
                className="rounded border border-emerald-400 bg-emerald-50 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400">
                {Object.entries(ONCELIK_LABELS || { dusuk:'Düşük', normal:'Normal', yuksek:'Yüksek', acil:'Acil' }).map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            )
          }
          return <OncelikBadge oncelik={getValue()} />
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (engelTetik(e)) return
                navigate(`/projeler/${row.original.id}`)
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Goruntule"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (engelTetik(e)) return
                navigate(`/projeler/${row.original.id}/duzenle`)
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Duzenle"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (engelTetik(e)) return
                setSilinecekProje(row.original)
                setSilmeDialogAcik(true)
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
              title="Sil"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [navigate, silmeYetkisi, projeler, seciliIdler, tumunuSec, secimDegistir, carpan, isExcel10,
     kilitliId, kilitliKolon, duzenleForm, kaydediliyor, isTipleri, bolgeler, ekipler, engelTetik,
     kolonHucreGuncelle]
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Projeler</h1>
        </div>
        <TableSkeleton rows={8} cols={7} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projeler</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Toplam {projeler?.length || 0} proje
          </p>
        </div>
        <button
          onClick={() => navigate('/projeler/yeni')}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Yeni Proje
        </button>
      </div>

      {/* Artırım yüzdesi seçici (Excel KET-YB özet sayfasındaki %10 markup taklidi) */}
      <div className="flex items-center gap-2 rounded-lg border border-input bg-muted/20 px-3 py-2 max-w-fit">
        <span className="text-xs text-muted-foreground">Fiyat artırım yüzdesi:</span>
        <input
          type="number" step="0.5" min="0" max="100"
          value={artirimYuzdesi}
          onChange={e => {
            const v = Number(e.target.value)
            setArtirimYuzdesi(v)
            try { localStorage.setItem('proje_artirim_yuzdesi', String(v)) } catch {}
          }}
          className="w-16 rounded border border-input bg-white px-2 py-1 text-sm text-right tabular-nums focus:border-primary focus:outline-none"
        />
        <span className="text-xs text-muted-foreground">%</span>
        <span className="text-[10px] text-muted-foreground italic">(Sözleşme keşfi etkilenmez)</span>
      </div>

      {/* Özet kartları — seçim varsa SEÇİLEN projelerin, yoksa TÜM filtrelenmiş projelerin toplamı */}
      {(projeler?.length || 0) > 0 && (() => {
        // %10'da Excel-uyumlu (artırımlı kolon), diğer % için raw × carpan
        const fiyatBul = tutarHesapla
        const ilerlemeBul = ilerlemeHesapla
        const sozlesmeBul = (p) => Number(p.sozlesme_kesfi) || 0
        const seciliMod = seciliIdler.size > 0
        const kapsam = seciliMod ? projeler.filter(p => seciliIdler.has(p.id)) : projeler
        const toplamTutar = kapsam.reduce((t, p) => t + fiyatBul(p), 0)
        const ilerlemeTutar = kapsam.reduce((t, p) => t + ilerlemeBul(p), 0)
        const sozlesmeTutar = kapsam.reduce((t, p) => t + sozlesmeBul(p), 0)
        const yuzde = toplamTutar > 0 ? Math.round((ilerlemeTutar / toplamTutar) * 100) : 0
        const fmt = (n) => n.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) + ' ₺'
        const renkSinifi = seciliMod
          ? { kart: 'border-primary/40 bg-primary/5', baslikRenk: 'text-primary' }
          : { kart: 'border-input bg-card', baslikRenk: 'text-muted-foreground' }
        return (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className={cn('rounded-lg border px-4 py-3', renkSinifi.kart)}>
              <p className={cn('text-xs', renkSinifi.baslikRenk)}>
                {seciliMod ? `Seçili Proje (${kapsam.length})` : 'Proje Sayısı'}
              </p>
              <p className="text-xl font-bold tabular-nums">{kapsam.length}</p>
              {seciliMod && (
                <p className="text-[10px] text-muted-foreground">tüm filtre: {projeler.length}</p>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">Sözleşme Toplamı</p>
              <p className="text-xl font-bold tabular-nums text-slate-700">{fmt(sozlesmeTutar)}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">Toplam Tutar</p>
              <p className="text-xl font-bold tabular-nums text-emerald-700">{fmt(toplamTutar)}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">İlerleme</p>
              <p className="text-xl font-bold tabular-nums text-blue-700">{fmt(ilerlemeTutar)}</p>
              <p className="text-[10px] text-muted-foreground">%{yuzde}</p>
            </div>
          </div>
        )
      })()}

      <div className="flex flex-wrap gap-3">
        <select
          value={filtreler.tip}
          onChange={(e) => handleFiltreChange('tip', e.target.value)}
          className="rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Tüm Tipler</option>
          {(isTipleri || []).map(t => (
            <option key={t.id} value={t.kod}>{t.ad}</option>
          ))}
        </select>
        <select
          value={filtreler.durum}
          onChange={(e) => handleFiltreChange('durum', e.target.value)}
          className="rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Tüm Durumlar</option>
          <optgroup label="Proje Aşaması">
            {PROJE_ASAMA_SECENEKLERI.map(s => (
              <option key={s.kod} value={`_PROJE_${s.kod}`}>{s.etiket}</option>
            ))}
          </optgroup>
          <optgroup label="Genel">
            <option value="_DURUM_devam">⏱️ Devam Eden</option>
            <option value="_DURUM_gecikti">⚠️ Gecikti</option>
            <option value="_DURUM_tamamlandi">✅ Tamamlandı</option>
            <option value="_DURUM_beklemede">⏸️ Beklemede</option>
          </optgroup>
        </select>
        {/* Saha Aşaması çoklu seçim — checkbox'lı dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setSahaSecimAcik(v => !v)}
            className="flex items-center gap-1 rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[160px] justify-between"
          >
            <span className={cn('truncate', sahaAsamalar.length === 0 && 'text-muted-foreground')}>
              {sahaAsamalar.length === 0
                ? 'Saha (Hepsi)'
                : sahaAsamalar.length === 1
                  ? (sahaAsamalar[0] === '__BOS__' ? '— (Bilgi Yok)' : (SAHA_ASAMA_MAP[sahaAsamalar[0]]?.etiket || sahaAsamalar[0]))
                  : `Saha (${sahaAsamalar.length} seçili)`}
            </span>
            <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', sahaSecimAcik && 'rotate-180')} />
          </button>
          {sahaSecimAcik && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSahaSecimAcik(false)} />
              <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-white shadow-lg py-1">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Saha Aşaması</span>
                  {sahaAsamalar.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleFiltreChange('saha_asamalar', [])}
                      className="text-[10px] text-primary hover:underline"
                    >
                      Temizle
                    </button>
                  )}
                </div>
                {[{ kod: '__BOS__', etiket: '— (Bilgi Girilmemiş)' }, ...SAHA_ASAMA_SECENEKLERI].map(s => {
                  const secili = sahaAsamalar.includes(s.kod)
                  return (
                    <label
                      key={s.kod}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/40 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={secili}
                        onChange={() => {
                          const yeni = secili
                            ? sahaAsamalar.filter(k => k !== s.kod)
                            : [...sahaAsamalar, s.kod]
                          handleFiltreChange('saha_asamalar', yeni)
                        }}
                        className="h-3.5 w-3.5"
                      />
                      <span className={cn('flex-1', s.kod === '__BOS__' && 'text-muted-foreground italic')}>{s.etiket}</span>
                    </label>
                  )
                })}
              </div>
            </>
          )}
        </div>
        {/* Tarih bazlı filtre — çoklu seçim */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setTarihSecimAcik(v => !v)}
            className="flex items-center gap-1 rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[160px] justify-between"
          >
            <span className={cn('truncate', tarihDurumlari.length === 0 && 'text-muted-foreground')}>
              {tarihDurumlari.length === 0
                ? 'Tarih (Hepsi)'
                : tarihDurumlari.length === 1
                  ? (TARIH_FILTRE_SECENEKLERI.find(t => t.kod === tarihDurumlari[0])?.etiket || tarihDurumlari[0])
                  : `Tarih (${tarihDurumlari.length} seçili)`}
            </span>
            <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', tarihSecimAcik && 'rotate-180')} />
          </button>
          {tarihSecimAcik && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setTarihSecimAcik(false)} />
              <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-md border border-border bg-white shadow-lg py-1">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tarih Durumu</span>
                  {tarihDurumlari.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleFiltreChange('tarih_durumlari', [])}
                      className="text-[10px] text-primary hover:underline"
                    >
                      Temizle
                    </button>
                  )}
                </div>
                {TARIH_FILTRE_SECENEKLERI.map(s => {
                  const secili = tarihDurumlari.includes(s.kod)
                  return (
                    <label
                      key={s.kod}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/40 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={secili}
                        onChange={() => {
                          const yeni = secili
                            ? tarihDurumlari.filter(k => k !== s.kod)
                            : [...tarihDurumlari, s.kod]
                          handleFiltreChange('tarih_durumlari', yeni)
                        }}
                        className="h-3.5 w-3.5"
                      />
                      <span className={cn('flex-1', s.kod === 'tarih_yok' && 'text-muted-foreground italic')}>{s.etiket}</span>
                    </label>
                  )
                })}
              </div>
            </>
          )}
        </div>
        <select
          value={filtreler.bolge_id}
          onChange={(e) => handleFiltreChange('bolge_id', e.target.value)}
          className="rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Tum Bolgeler</option>
          {bolgeler?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.bolge_adi}
            </option>
          ))}
        </select>
        <select
          value={filtreler.yer_teslim}
          onChange={(e) => handleFiltreChange('yer_teslim', e.target.value)}
          className="rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Yer Teslim (Hepsi)</option>
          <option value="var">Yer Teslimi Var</option>
          <option value="yok">Yer Teslimi Yok</option>
        </select>
        <select
          value={filtreler.ihale_id}
          onChange={(e) => handleFiltreChange('ihale_id', e.target.value)}
          className="rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Tüm İhaleler</option>
          {(ihaleler || []).map(i => (
            <option key={i.id} value={i.id}>{i.ihale_adi}</option>
          ))}
          <option value="yok">— İhalesi Olmayanlar —</option>
        </select>
      </div>

      {/* Toplu islem bar - secim varsa goster */}
      {seciliIdler.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <CheckSquare className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">
            {seciliIdler.size} proje secildi
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={secimiTemizle}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Secimi Temizle
            </button>
            <button
              onClick={() => setPrintModalAcik(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <Printer className="h-4 w-4" />
              Yazdır ({seciliIdler.size})
            </button>
            <button
              onClick={() => setExcelExportModalAcik(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel'e Aktar ({seciliIdler.size})
            </button>
            <button
              onClick={() => setYerTeslimXlsxModalAcik(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Yer Teslim XLSX ({seciliIdler.size})
            </button>
            <button
              onClick={() => setMalzemeTalepModalAcik(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Malzeme Talebi ({seciliIdler.size})
            </button>
            {silmeYetkisi && (
              <button
                onClick={() => setTopluSilmeDialogAcik(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Secilenleri Sil ({seciliIdler.size})
              </button>
            )}
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={projeler || []}
        searchPlaceholder="Proje ara..."
        pagination={false}
        stickyHeader
        rowNumber
      />

      {silmeHatasi && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-red-200 bg-red-50 p-4 shadow-lg">
          <div className="flex items-start gap-2">
            <span className="text-sm font-medium text-red-800">{silmeHatasi}</span>
            <button onClick={() => setSilmeHatasi(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Yer Teslim XLSX Modal */}
      {yerTeslimXlsxModalAcik && (
        <YerTeslimXlsxModal
          projeler={(projeler || []).filter((p) => seciliIdler.has(p.id))}
          onKapat={() => setYerTeslimXlsxModalAcik(false)}
        />
      )}

      {/* Excel'e Aktar Modal */}
      {excelExportModalAcik && (
        <ExcelExportModal
          ids={[...seciliIdler]}
          onKapat={() => setExcelExportModalAcik(false)}
        />
      )}

      {/* Yazdır Modal */}
      {printModalAcik && (
        <PrintModal
          projeler={(projeler || []).filter(p => seciliIdler.has(p.id))}
          onKapat={() => setPrintModalAcik(false)}
        />
      )}

      {/* Malzeme Talebi Modal */}
      {malzemeTalepModalAcik && (
        <MalzemeTalepModal
          projeler={(projeler || []).filter((p) => seciliIdler.has(p.id))}
          onKapat={() => setMalzemeTalepModalAcik(false)}
        />
      )}

      {/* Tekli silme dialog */}
      <ConfirmDialog
        open={silmeDialogAcik}
        onClose={() => {
          if (!projeSil.isPending) {
            setSilmeDialogAcik(false)
            setSilinecekProje(null)
            setSilmeHatasi(null)
          }
        }}
        onConfirm={handleSil}
        title="Projeyi Sil"
        message={silmeHatasi
          ? `${silmeHatasi}`
          : `"${silinecekProje?.proje_no}" numarali projeyi silmek istediginize emin misiniz? Bu islem geri alinamaz.`
        }
        confirmText={projeSil.isPending ? 'Siliniyor...' : 'Sil'}
        cancelText="Iptal"
        variant="destructive"
        loading={projeSil.isPending}
      />

      {/* Toplu silme dialog */}
      <ConfirmDialog
        open={topluSilmeDialogAcik}
        onClose={() => {
          if (!topluSil.isPending) {
            setTopluSilmeDialogAcik(false)
          }
        }}
        onConfirm={handleTopluSil}
        title="Toplu Proje Silme"
        message={`${seciliIdler.size} adet projeyi silmek istediginize emin misiniz? Bu islem geri alinamaz ve tum iliskili veriler (kesifler, demontajlar, direkler, asamalar vb.) kalici olarak silinecektir.`}
        confirmText={topluSil.isPending ? 'Siliniyor...' : `${seciliIdler.size} Projeyi Sil`}
        cancelText="Iptal"
        variant="destructive"
        loading={topluSil.isPending}
      />
    </div>
  )
}
