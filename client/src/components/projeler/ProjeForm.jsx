import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowLeftRight, Save, X, Sparkles, AlertCircle } from 'lucide-react'
import { useProje, useProjeOlustur, useProjeGuncelle } from '@/hooks/useProjeler'
import api from '@/api/client'
import { useBolgeler } from '@/hooks/useBolgeler'
import { useEkipler } from '@/hooks/useEkipler'
import { useIsTipleri } from '@/hooks/useIsTipleri'
import { usePersonelListesi } from '@/hooks/usePersonel'
import { PROJE_DURUMLARI, ONCELIK_LABELS } from '@/utils/constants'
import { CardSkeleton } from '@/components/shared/LoadingSkeleton'
import YerTeslimModal from './YerTeslimModal'
import DemontajListesiDuzenle from './DemontajListesiDuzenle'
import DirekListesiDuzenle from './DirekListesiDuzenle'
import KatalogAramaInput from './KatalogAramaInput'
import { cn } from '@/lib/utils'

// Dış kişi (kurum personeli) autocomplete
function DisKisiSecici({ value, onChange, placeholder }) {
  const [acik, setAcik] = useState(false)
  const [sonuclar, setSonuclar] = useState([])
  const [araniyor, setAraniyor] = useState(false)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)
  const timerRef = useRef(null)

  const ara = useCallback((q) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!q || q.length < 2) { setSonuclar([]); setAraniyor(false); return }
    setAraniyor(true)
    timerRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/dis-kisiler/ara', { params: { q } })
        setSonuclar(res?.data || [])
      } catch { setSonuclar([]) }
      setAraniyor(false)
    }, 300)
  }, [])

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setAcik(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleInputChange = (e) => {
    const val = e.target.value
    onChange(val)
    ara(val)
    setAcik(true)
  }

  const handleSec = (kisi) => {
    onChange(kisi.ad_soyad, kisi)
    setAcik(false)
    setSonuclar([])
  }

  const showDropdown = acik && value?.length >= 2 && (araniyor || sonuclar.length > 0)

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value || ''}
        onChange={handleInputChange}
        onFocus={() => { if (value?.length >= 2) { ara(value); setAcik(true) } }}
        className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        placeholder={placeholder || 'Ad Soyad'}
      />
      {showDropdown && (
        <div ref={dropdownRef} className="absolute left-0 right-0 z-20 mt-1 rounded-lg border border-input bg-white shadow-lg max-h-48 overflow-y-auto">
          {araniyor ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Araniyor...</div>
          ) : (
            sonuclar.map(k => (
              <button
                key={k.id}
                type="button"
                onMouseDown={() => handleSec(k)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-primary/5 flex items-center justify-between"
              >
                <span className="font-medium">{k.ad_soyad}</span>
                {(k.unvan || k.kurum) && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {[k.unvan, k.kurum].filter(Boolean).join(' - ')}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

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
  teslim_eden: '',
  teslim_eden_unvan: '',
  teslim_eden_kurum: '',
  teslim_alan_id: '',
  // YB ve genel yer teslim alanları
  basvuru_no: '',
  il: '',
  ilce: '',
  ada_parsel: '',
  telefon: '',
  tesis: '',
  abone_kablosu: '',
  abone_kablosu_metre: '',
  enerji_alinan_direk_no: '',
  kesinti_ihtiyaci: null,
  izinler: null,
  // Excel import alanları
  yil: '',
  pyp: '',
  ihale_no: '',
  ihale_adi: '',
  yuklenici: '',
  tur: '',
  cbs_id: '',
  cbs_durum: '',
  is_durumu: '',
  demontaj_teslim_durumu: '',
  sozlesme_kesfi: '',
  kesif_tutari: '',
  hakedis_miktari: '',
  hakedis_yuzdesi: '',
  ilerleme_miktari: '',
  ilerleme_yuzdesi: '',
  proje_onay_durumu: '',
  is_grubu: '',
  proje_baslangic_tarihi: '',
  enerjilenme_tarihi: '',
}

export default function ProjeForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const duzenleModu = Boolean(id)

  const { data: proje, isLoading: projeYukleniyor } = useProje(id)
  const { data: bolgeler } = useBolgeler()
  const { data: ekipler } = useEkipler()
  const { data: isTipleri } = useIsTipleri()
  const { data: personelRes } = usePersonelListesi()
  const personeller = personelRes?.data || personelRes || []
  const projeOlustur = useProjeOlustur()
  const projeGuncelle = useProjeGuncelle()

  const [form, setForm] = useState(BOS_FORM)
  const [hatalar, setHatalar] = useState({})
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [genelHata, setGenelHata] = useState('')
  const [yerTeslimAcik, setYerTeslimAcik] = useState(false)
  const [demontajListesi, setDemontajListesi] = useState([])
  const [direkListesi, setDirekListesi] = useState([])
  const [yerTeslimDosya, setYerTeslimDosya] = useState(null)
  const [yerTeslimEkBilgi, setYerTeslimEkBilgi] = useState(null)

  // Proje tipine göre eşleşen iş tipi fazları
  const eslesmisIsTipi = useMemo(() => {
    if (!isTipleri || !form.proje_tipi) return null
    return isTipleri.find(
      (t) => t.kod.toUpperCase() === form.proje_tipi.toUpperCase()
    ) || null
  }, [isTipleri, form.proje_tipi])

  // Proje tipi değiştiğinde durum'u ilk faz kodu yap (sadece yeni proje modunda)
  useEffect(() => {
    if (!duzenleModu && eslesmisIsTipi && eslesmisIsTipi.fazlar.length > 0) {
      setForm((prev) => ({ ...prev, durum: eslesmisIsTipi.fazlar[0].faz_kodu }))
    }
  }, [eslesmisIsTipi, duzenleModu])

  // Load direk/demontaj lists for edit mode
  useEffect(() => {
    if (duzenleModu && id) {
      api.get(`/proje-direkler/${id}`).then(r => {
        const data = r?.data || r || []
        if (Array.isArray(data) && data.length > 0) setDirekListesi(data)
      }).catch(() => {})
      api.get(`/proje-demontaj/${id}`).then(r => {
        const data = r?.data || r || []
        if (Array.isArray(data) && data.length > 0) setDemontajListesi(data)
      }).catch(() => {})
    }
  }, [duzenleModu, id])

  // Load existing project data for edit mode
  useEffect(() => {
    if (duzenleModu && proje) {
      setForm({
        proje_no: proje.proje_no || '',
        proje_tipi: proje.proje_tipi || '',
        musteri_adi: proje.musteri_adi || '',
        bolge_id: proje.bolge_id ? String(proje.bolge_id) : '',
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
        teslim_eden: proje.teslim_eden || '',
        teslim_eden_unvan: proje.teslim_eden_unvan || '',
        teslim_eden_kurum: proje.teslim_eden_kurum || '',
        teslim_alan_id: proje.teslim_alan_id ? String(proje.teslim_alan_id) : '',
        basvuru_no: proje.basvuru_no || '',
        il: proje.il || '',
        ilce: proje.ilce || '',
        ada_parsel: proje.ada_parsel || '',
        telefon: proje.telefon || '',
        tesis: proje.tesis || '',
        abone_kablosu: proje.abone_kablosu || '',
        abone_kablosu_metre: proje.abone_kablosu_metre || '',
        enerji_alinan_direk_no: proje.enerji_alinan_direk_no || '',
        kesinti_ihtiyaci: proje.kesinti_ihtiyaci != null ? Boolean(proje.kesinti_ihtiyaci) : null,
        izinler: proje.izinler ? (typeof proje.izinler === 'string' ? JSON.parse(proje.izinler) : proje.izinler) : null,
        yil: proje.yil || '',
        pyp: proje.pyp || '',
        ihale_no: proje.ihale_no || '',
        ihale_adi: proje.ihale_adi || '',
        yuklenici: proje.yuklenici || '',
        tur: proje.tur || '',
        cbs_id: proje.cbs_id || '',
        cbs_durum: proje.cbs_durum || '',
        is_durumu: proje.is_durumu || '',
        demontaj_teslim_durumu: proje.demontaj_teslim_durumu || '',
        sozlesme_kesfi: proje.sozlesme_kesfi || '',
        kesif_tutari: proje.kesif_tutari || '',
        hakedis_miktari: proje.hakedis_miktari || '',
        hakedis_yuzdesi: proje.hakedis_yuzdesi || '',
        ilerleme_miktari: proje.ilerleme_miktari || '',
        ilerleme_yuzdesi: proje.ilerleme_yuzdesi || '',
        proje_onay_durumu: proje.proje_onay_durumu || '',
        is_grubu: proje.is_grubu || '',
        proje_baslangic_tarihi: proje.proje_baslangic_tarihi ? proje.proje_baslangic_tarihi.slice(0, 10) : '',
        enerjilenme_tarihi: proje.enerjilenme_tarihi ? proje.enerjilenme_tarihi.slice(0, 10) : '',
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

  // Türkçe karakter uyumlu normalizasyon
  const normTR = (s) => (s || '').toUpperCase()
    .replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
    .replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

  // Personel listesinde isim ara (fuzzy, Türkçe uyumlu)
  const findPersonByName = (name) => {
    if (!name || !Array.isArray(personeller) || personeller.length === 0) return null
    const n = normTR(name)
    if (!n) return null
    // 1) Tam eşleşme
    let match = personeller.find(p => normTR(p.ad_soyad) === n)
    if (match) return match
    // 2) İçerme
    match = personeller.find(p => {
      const pn = normTR(p.ad_soyad)
      return pn && (pn.includes(n) || n.includes(pn))
    })
    if (match) return match
    // 3) Kelime bazlı (tüm kelimeler eşleşir mi)
    const kelimeler = n.split(' ').filter(Boolean)
    match = personeller.find(p => {
      const pn = normTR(p.ad_soyad)
      return kelimeler.length > 0 && kelimeler.every(k => pn.includes(k))
    })
    return match
  }

  const handleTeslimSwap = () => {
    const currentAlanId = form.teslim_alan_id
    const alanPerson = personeller.find(p => String(p.id) === String(currentAlanId))
    const alanName = alanPerson?.ad_soyad || ''
    const edenPerson = findPersonByName(form.teslim_eden)
    setForm(prev => ({
      ...prev,
      teslim_eden: alanName,
      teslim_alan_id: edenPerson ? String(edenPerson.id) : '',
    }))
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

  const handleYerTeslimSonuc = async (sonuc) => {
    setYerTeslimAcik(false)
    const { _dosya, ...data } = sonuc
    setYerTeslimDosya(_dosya || null)
    setDemontajListesi(data.demontaj_listesi || [])
    setDirekListesi(data.direk_listesi || [])
    setYerTeslimEkBilgi({
      yer_teslim_yapan: data.yer_teslim_yapan,
      yer_teslim_alan: data.yer_teslim_alan,
      ek_bilgiler: data.ek_bilgiler,
    })

    // Teslim yapan = kurum tarafı (teslim_eden), Teslim alan = yüklenici tarafı (teslim_alan_id)
    // Modal'da zaten personel eşleştirmesi ve swap yapılmış durumda
    const yapanAd = data.yer_teslim_yapan?.ad_soyad || ''
    const yapanUnvan = data.yer_teslim_yapan?.unvan || ''
    const alanAd = data.yer_teslim_alan?.ad_soyad || ''
    // personel_id modal'dan direkt geliyor (PersonelSecici seçimi veya auto-swap)
    const teslimEden = yapanAd
    // Personel eşleştirme: önce modal'dan gelen ID, sonra isme göre arama
    const rawAlanId = data.yer_teslim_alan?.personel_id || (findPersonByName(alanAd)?.id) || ''
    // String'e çevir ki select option value ile eşleşsin
    const teslimAlanId = rawAlanId ? String(rawAlanId) : ''

    // Bölge eşleştirme: ilçe adını bölge listesinden bul
    const ilce = data.ilce || ''
    let bolgeId = ''
    if (ilce && Array.isArray(bolgeler) && bolgeler.length > 0) {
      // Türkçe sayı kelimeleri → rakam dönüşümü
      const SAYI_MAP = [
        [/ONDOKUZ/g, '19'], [/ONSEKIZ/g, '18'], [/ONYEDI/g, '17'], [/ONALTI/g, '16'],
        [/ONBES/g, '15'], [/ONDORT/g, '14'], [/ONUC/g, '13'], [/ONIKI/g, '12'],
        [/ONBIR/g, '11'], [/ON/g, '10'], [/DOKUZ/g, '9'], [/SEKIZ/g, '8'],
        [/YEDI/g, '7'], [/ALTI/g, '6'], [/BES/g, '5'], [/DORT/g, '4'],
        [/UC/g, '3'], [/IKI/g, '2'], [/BIR/g, '1'],
      ]
      const normBolge = (s) => {
        let r = (s || '').toUpperCase()
          .replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G')
          .replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
          .replace(/\s+/g, '').replace(/[^A-Z0-9]/g, '')
        // Sayı kelimelerini rakama çevir
        for (const [pattern, digit] of SAYI_MAP) {
          r = r.replace(pattern, digit)
        }
        return r
      }
      const ilceNorm = normBolge(ilce)
      const eslesme = bolgeler.find(b => normBolge(b.bolge_adi) === ilceNorm)
      if (eslesme) bolgeId = String(eslesme.id)
    }

    // Tahmini süre: başlama ve bitiş tarihleri arasındaki gün farkı
    let tahminiSure = ''
    const baslama = data.baslama_tarihi || ''
    const bitis = data.bitis_tarihi || ''
    if (baslama && bitis) {
      const fark = Math.round((new Date(bitis) - new Date(baslama)) / (1000 * 60 * 60 * 24))
      if (fark > 0) tahminiSure = fark
    }

    // Otomatik proje no: İşTipi-Yıl-SıraNo
    const projeTipi = data.proje_tipi || ''
    let projeNo = ''
    if (projeTipi) {
      try {
        const noRes = await api.get('/projeler/sonraki-no', { params: { tip: projeTipi } })
        projeNo = noRes?.data?.proje_no || noRes?.proje_no || ''
      } catch { /* manuel girilir */ }
    }

    // Form alanlarını doldur
    setForm((prev) => ({
      ...prev,
      proje_no: projeNo || prev.proje_no,
      proje_tipi: projeTipi || prev.proje_tipi,
      musteri_adi: data.proje_adi || data.musteri_adi || prev.musteri_adi,
      bolge_id: bolgeId || prev.bolge_id,
      mahalle: data.mahalle || prev.mahalle,
      adres: data.adres || prev.adres,
      oncelik: data.oncelik || prev.oncelik,
      baslama_tarihi: baslama || prev.baslama_tarihi,
      bitis_tarihi: bitis || prev.bitis_tarihi,
      teslim_tarihi: data.teslim_tarihi || prev.teslim_tarihi,
      tahmini_sure_gun: tahminiSure || prev.tahmini_sure_gun,
      notlar: [prev.notlar, data.notlar].filter(Boolean).join('\n') || '',
      teslim_eden: teslimEden || prev.teslim_eden,
      teslim_eden_unvan: yapanUnvan || prev.teslim_eden_unvan,
      teslim_alan_id: teslimAlanId || prev.teslim_alan_id,
      // YB alanları
      basvuru_no: data.basvuru_no || prev.basvuru_no,
      il: data.il || prev.il,
      ilce: ilce || prev.ilce,
      ada_parsel: data.ada_parsel || prev.ada_parsel,
      telefon: data.telefon || prev.telefon,
      tesis: data.tesis || prev.tesis,
      abone_kablosu: data.abone_kablosu || prev.abone_kablosu,
      abone_kablosu_metre: data.abone_kablosu_metre || prev.abone_kablosu_metre,
      enerji_alinan_direk_no: data.enerji_alinan_direk_no || prev.enerji_alinan_direk_no,
      kesinti_ihtiyaci: data.kesinti_ihtiyaci != null ? data.kesinti_ihtiyaci : prev.kesinti_ihtiyaci,
      izinler: data.izinler || prev.izinler,
    }))
  }

  // Eksik zorunlu alanlar (tooltip için)
  const eksikAlanlar = useMemo(() => {
    const alanlar = []
    if (!form.proje_no.trim()) alanlar.push('Proje Numarasi')
    if (!form.proje_tipi) alanlar.push('Proje Tipi')
    return alanlar
  }, [form.proje_no, form.proje_tipi])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setGonderiliyor(true)
    setGenelHata('')

    const payload = {
      ...form,
      bolge_id: form.bolge_id || null,
      ekip_id: form.ekip_id || null,
      tahmini_sure_gun: form.tahmini_sure_gun ? Number(form.tahmini_sure_gun) : null,
      tamamlanma_yuzdesi: Number(form.tamamlanma_yuzdesi),
      baslama_tarihi: form.baslama_tarihi || null,
      bitis_tarihi: form.bitis_tarihi || null,
      teslim_tarihi: form.teslim_tarihi || null,
      teslim_eden: form.teslim_eden || null,
      teslim_eden_unvan: form.teslim_eden_unvan || null,
      teslim_eden_kurum: form.teslim_eden_kurum || null,
      teslim_alan_id: form.teslim_alan_id || null,
      basvuru_no: form.basvuru_no || null,
      il: form.il || null,
      ilce: form.ilce || null,
      ada_parsel: form.ada_parsel || null,
      telefon: form.telefon || null,
      tesis: form.tesis || null,
      abone_kablosu: form.abone_kablosu || null,
      abone_kablosu_metre: form.abone_kablosu_metre ? Number(form.abone_kablosu_metre) : null,
      enerji_alinan_direk_no: form.enerji_alinan_direk_no || null,
      kesinti_ihtiyaci: form.kesinti_ihtiyaci,
      izinler: form.izinler,
      yil: form.yil ? Number(form.yil) : null,
      pyp: form.pyp || null,
      ihale_no: form.ihale_no || null,
      ihale_adi: form.ihale_adi || null,
      yuklenici: form.yuklenici || null,
      tur: form.tur || null,
      cbs_id: form.cbs_id || null,
      cbs_durum: form.cbs_durum || null,
      is_durumu: form.is_durumu || null,
      demontaj_teslim_durumu: form.demontaj_teslim_durumu || null,
      sozlesme_kesfi: form.sozlesme_kesfi ? Number(form.sozlesme_kesfi) : null,
      kesif_tutari: form.kesif_tutari ? Number(form.kesif_tutari) : null,
      hakedis_miktari: form.hakedis_miktari ? Number(form.hakedis_miktari) : null,
      hakedis_yuzdesi: form.hakedis_yuzdesi ? Number(form.hakedis_yuzdesi) : null,
      ilerleme_miktari: form.ilerleme_miktari ? Number(form.ilerleme_miktari) : null,
      ilerleme_yuzdesi: form.ilerleme_yuzdesi ? Number(form.ilerleme_yuzdesi) : null,
      proje_onay_durumu: form.proje_onay_durumu || null,
      is_grubu: form.is_grubu || null,
      proje_baslangic_tarihi: form.proje_baslangic_tarihi || null,
      enerjilenme_tarihi: form.enerjilenme_tarihi || null,
    }

    try {
      if (duzenleModu) {
        await projeGuncelle.mutateAsync({ id, ...payload })
        // Direk listesi kaydet (replace all)
        if (direkListesi.length > 0) {
          await api.post(`/proje-direkler/${id}/toplu`, { kalemler: direkListesi }).catch(() => {})
        }
        navigate(`/projeler/${id}`)
      } else {
        const res = await projeOlustur.mutateAsync(payload)
        const yeniProjeId = res?.data?.id

        if (yeniProjeId) {
          // Demontaj listesi varsa kaydet
          if (demontajListesi.length > 0) {
            try {
              await api.post(`/proje-demontaj/${yeniProjeId}/toplu`, { kalemler: demontajListesi })
            } catch (err) {
              console.error('Demontaj kaydetme hatasi:', err)
            }
          }

          // Direk listesi varsa kaydet
          if (direkListesi.length > 0) {
            try {
              await api.post(`/proje-direkler/${yeniProjeId}/toplu`, { kalemler: direkListesi })
            } catch (err) {
              console.error('Direk listesi kaydetme hatasi:', err)
            }
          }

          // Kroki keşif oluştur: direk + demontaj malzemeleri
          const krokiKesifKalemler = []
          // Direklerden
          for (const d of direkListesi) {
            if (d.katalog_adi || d.kisa_adi) {
              krokiKesifKalemler.push({
                malzeme_kodu: d.malzeme_kodu || null,
                malzeme_adi: d.katalog_adi || d.kisa_adi,
                birim: 'Ad',
                miktar: 1,
                notlar: d.notlar || null,
                kaynak: 'kroki',
              })
            }
          }
          // Demontajlardan
          for (const d of demontajListesi) {
            if (d.malzeme_adi) {
              krokiKesifKalemler.push({
                malzeme_kodu: d.malzeme_kodu || null,
                poz_no: d.poz_no || null,
                malzeme_adi: d.malzeme_adi,
                birim: d.birim || 'Ad',
                miktar: d.miktar || 1,
                notlar: d.notlar || null,
                kaynak: 'demontaj',
              })
            }
          }
          if (krokiKesifKalemler.length > 0) {
            try {
              await api.post(`/proje-kroki-kesif/${yeniProjeId}/toplu`, { kalemler: krokiKesifKalemler })
            } catch (err) {
              console.error('Kroki kesif kaydetme hatasi:', err)
            }
          }

          // Yer teslim dosyasını dosya yönetimine kaydet
          if (yerTeslimDosya) {
            try {
              const fazRes = await api.get(`/dongu/proje/${yeniProjeId}/faz`)
              const fazlar = fazRes?.data
              const ilkAdim = fazlar?.[0]?.adimlar?.[0]

              const formData = new FormData()
              const uzanti = yerTeslimDosya.name.split('.').pop()
              formData.append('dosya', yerTeslimDosya, `Yer_Teslim_Tutanağı_${form.proje_no}.${uzanti}`)
              formData.append('proje_id', yeniProjeId)
              formData.append('proje_no', form.proje_no)
              if (ilkAdim) formData.append('proje_adim_id', ilkAdim.id)
              formData.append('alan', 'proje')
              formData.append('alt_alan', 'belge')
              formData.append('iliskili_kaynak_tipi', 'yer_teslim')
              formData.append('iliskili_kaynak_id', yeniProjeId)

              const dosyaRes = await fetch('/api/dosya/yukle', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: formData
              })
              const dosyaData = await dosyaRes.json()
              if (dosyaData?.id) {
                await api.patch(`/projeler/${yeniProjeId}/yer-teslim-dosya`, { yer_teslim_dosya_id: dosyaData.id })
              }
            } catch (err) {
              console.error('Dosya yukleme hatasi:', err)
            }
          }

          // Yer teslim bilgilerini not olarak kaydet
          if (yerTeslimEkBilgi) {
            try {
              const notParts = []
              if (yerTeslimEkBilgi.yer_teslim_yapan?.ad_soyad)
                notParts.push(`Yer Teslim Yapan: ${yerTeslimEkBilgi.yer_teslim_yapan.ad_soyad}${yerTeslimEkBilgi.yer_teslim_yapan.unvan ? ` (${yerTeslimEkBilgi.yer_teslim_yapan.unvan})` : ''}`)
              if (yerTeslimEkBilgi.yer_teslim_alan?.ad_soyad)
                notParts.push(`Yer Teslim Alan: ${yerTeslimEkBilgi.yer_teslim_alan.ad_soyad}${yerTeslimEkBilgi.yer_teslim_alan.unvan ? ` (${yerTeslimEkBilgi.yer_teslim_alan.unvan})` : ''}`)
              if (yerTeslimEkBilgi.ek_bilgiler)
                notParts.push(yerTeslimEkBilgi.ek_bilgiler)
              if (notParts.length > 0) {
                await api.post(`/projeler/${yeniProjeId}/notlar`, { icerik: notParts.join('\n') }).catch(() => {})
              }
            } catch (err) {
              console.error('Not kaydetme hatasi:', err)
            }
          }

          navigate(`/projeler/${yeniProjeId}`)
        } else {
          navigate('/projeler')
        }
      }
    } catch (err) {
      setGenelHata(err.message || 'Kaydetme sirasinda bir hata olustu.')
    } finally {
      setGonderiliyor(false)
    }
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
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Temel Bilgiler</h2>
            {!duzenleModu && (
              <button
                type="button"
                onClick={() => setYerTeslimAcik(true)}
                className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Yer Teslim Krokisi
              </button>
            )}
          </div>
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
                {isTipleri?.map((t) => (
                  <option key={t.id} value={t.kod}>{t.ad} ({t.kod})</option>
                ))}
                {(!isTipleri || isTipleri.length === 0) && (
                  <>
                    <option value="YB">YB</option>
                    <option value="KET">KET</option>
                    <option value="Tesis">Tesis</option>
                  </>
                )}
              </select>
              {hatalar.proje_tipi && (
                <p className="mt-1 text-xs text-red-500">{hatalar.proje_tipi}</p>
              )}
            </div>

            {/* Proje Adi */}
            <div>
              <label className="mb-1 block text-sm font-medium">Proje Adi</label>
              <input
                type="text"
                value={form.musteri_adi}
                onChange={(e) => handleChange('musteri_adi', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Proje adi / Musteri adi"
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
                  <option key={b.id} value={String(b.id)}>
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
                {eslesmisIsTipi
                  ? eslesmisIsTipi.fazlar.map((f) => (
                      <option key={f.faz_kodu} value={f.faz_kodu}>
                        {f.ikon} {f.faz_adi}
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
                {ekipler?.map((ekip) => (
                  <option key={ekip.id} value={ekip.id}>
                    {ekip.ekip_adi}
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

            {/* Teslim Eden & Alan - swap destekli */}
            <div className="sm:col-span-2">
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Teslim Eden (Kurum)</label>
                  <DisKisiSecici
                    value={form.teslim_eden}
                    onChange={(val, kisi) => {
                      handleChange('teslim_eden', val)
                      if (kisi) {
                        setForm(prev => ({
                          ...prev,
                          teslim_eden: kisi.ad_soyad,
                          teslim_eden_unvan: kisi.unvan || prev.teslim_eden_unvan,
                          teslim_eden_kurum: kisi.kurum || prev.teslim_eden_kurum,
                        }))
                      }
                    }}
                    placeholder="Kurum yetkilisi"
                  />
                  {(form.teslim_eden_unvan || form.teslim_eden_kurum) && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {[form.teslim_eden_unvan, form.teslim_eden_kurum].filter(Boolean).join(' - ')}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleTeslimSwap}
                  className="mb-0.5 rounded-md border border-input p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  title="Teslim eden ve alan yer degistir"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </button>
                <div>
                  <label className="mb-1 block text-sm font-medium">Teslim Alan (Personel)</label>
                  <select
                    value={form.teslim_alan_id}
                    onChange={(e) => handleChange('teslim_alan_id', e.target.value)}
                    className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Seciniz</option>
                    {Array.isArray(personeller) && personeller.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.ad_soyad}{p.unvan ? ` - ${p.unvan}` : ''}{p.ekip_adi ? ` (${p.ekip_adi})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Adres Bilgileri */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Adres Bilgileri</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Il</label>
              <input
                type="text"
                value={form.il}
                onChange={(e) => handleChange('il', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Il"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Ilce</label>
              <input
                type="text"
                value={form.ilce}
                onChange={(e) => handleChange('ilce', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Ilce"
              />
            </div>
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
            <div>
              <label className="mb-1 block text-sm font-medium">Ada / Parsel</label>
              <input
                type="text"
                value={form.ada_parsel}
                onChange={(e) => handleChange('ada_parsel', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Orn: 986/6"
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

        {/* Baglanti / Tesis Bilgileri */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Baglanti / Tesis Bilgileri</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Basvuru No</label>
              <input
                type="text"
                value={form.basvuru_no}
                onChange={(e) => handleChange('basvuru_no', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Basvuru numarasi"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Telefon</label>
              <input
                type="text"
                value={form.telefon}
                onChange={(e) => handleChange('telefon', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Telefon numarasi"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Tesis</label>
              <input
                type="text"
                value={form.tesis}
                onChange={(e) => handleChange('tesis', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="EDAS / YEDAS / Musteri"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Enerji Alinan Direk No</label>
              <input
                type="text"
                value={form.enerji_alinan_direk_no}
                onChange={(e) => handleChange('enerji_alinan_direk_no', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Direk numarasi"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Abone Kablosu</label>
              <KatalogAramaInput
                value={form.abone_kablosu}
                onChange={(val) => handleChange('abone_kablosu', val)}
                placeholder="Orn: 2x10 NYY"
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Abone Kablosu (metre)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.abone_kablosu_metre}
                onChange={(e) => handleChange('abone_kablosu_metre', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Metre cinsinden"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Kesinti Ihtiyaci</label>
              <select
                value={form.kesinti_ihtiyaci == null ? '' : form.kesinti_ihtiyaci ? '1' : '0'}
                onChange={(e) => handleChange('kesinti_ihtiyaci', e.target.value === '' ? null : e.target.value === '1')}
                className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Belirtilmedi</option>
                <option value="1">Evet</option>
                <option value="0">Hayir</option>
              </select>
            </div>
          </div>

          {/* Izinler */}
          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium">Izinler</label>
            <div className="flex flex-wrap gap-4">
              {[
                { key: 'karayollari', label: 'Karayollari' },
                { key: 'kazi_izni', label: 'Kazi Izni' },
                { key: 'orman', label: 'Orman' },
                { key: 'muvafakatname', label: 'Muvafakatname' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.izinler?.[key] || false}
                    onChange={(e) => {
                      const yeniIzinler = { ...(form.izinler || {}), [key]: e.target.checked }
                      handleChange('izinler', yeniIzinler)
                    }}
                    className="rounded border-input accent-primary"
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="mt-2">
              <input
                type="text"
                value={form.izinler?.diger || ''}
                onChange={(e) => {
                  const yeniIzinler = { ...(form.izinler || {}), diger: e.target.value || null }
                  handleChange('izinler', yeniIzinler)
                }}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Diger izinler..."
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

        {/* Sözleşme ve İhale Bilgileri */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Sözleşme / İhale Bilgileri</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">PYP</label>
              <input type="text" value={form.pyp} onChange={(e) => handleChange('pyp', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="26.BATI.KET.1.001" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">İhale No</label>
              <input type="text" value={form.ihale_no} onChange={(e) => handleChange('ihale_no', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">İhale Adı</label>
              <input type="text" value={form.ihale_adi} onChange={(e) => handleChange('ihale_adi', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Yüklenici</label>
              <input type="text" value={form.yuklenici} onChange={(e) => handleChange('yuklenici', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Tür</label>
              <input type="text" value={form.tur} onChange={(e) => handleChange('tur', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="TRAFOLU YB" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Yıl</label>
              <input type="number" value={form.yil} onChange={(e) => handleChange('yil', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">İş Grubu (Etap)</label>
              <input type="text" value={form.is_grubu} onChange={(e) => handleChange('is_grubu', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Sözleşme Keşfi</label>
              <input type="number" step="0.01" value={form.sozlesme_kesfi} onChange={(e) => handleChange('sozlesme_kesfi', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Keşif Tutarı</label>
              <input type="number" step="0.01" value={form.kesif_tutari} onChange={(e) => handleChange('kesif_tutari', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
        </div>

        {/* CBS ve Durum Bilgileri */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">CBS ve Durum Bilgileri</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">CBS ID</label>
              <input type="text" value={form.cbs_id} onChange={(e) => handleChange('cbs_id', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">CBS Durum</label>
              <input type="text" value={form.cbs_durum} onChange={(e) => handleChange('cbs_durum', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">İş Durumu</label>
              <input type="text" value={form.is_durumu} onChange={(e) => handleChange('is_durumu', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Proje Onay Durumu</label>
              <input type="text" value={form.proje_onay_durumu} onChange={(e) => handleChange('proje_onay_durumu', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Demontaj Teslim Durumu</label>
              <input type="text" value={form.demontaj_teslim_durumu} onChange={(e) => handleChange('demontaj_teslim_durumu', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
        </div>

        {/* Hakediş ve İlerleme */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Hakediş ve İlerleme</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Hakediş Miktarı</label>
              <input type="number" step="0.01" value={form.hakedis_miktari} onChange={(e) => handleChange('hakedis_miktari', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Hakediş %</label>
              <input type="number" step="0.01" value={form.hakedis_yuzdesi} onChange={(e) => handleChange('hakedis_yuzdesi', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">İlerleme Miktarı</label>
              <input type="number" step="0.01" value={form.ilerleme_miktari} onChange={(e) => handleChange('ilerleme_miktari', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">İlerleme %</label>
              <input type="number" step="0.01" value={form.ilerleme_yuzdesi} onChange={(e) => handleChange('ilerleme_yuzdesi', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Proje Başlangıç Tarihi</label>
              <input type="date" value={form.proje_baslangic_tarihi} onChange={(e) => handleChange('proje_baslangic_tarihi', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Enerjilenme Tarihi</label>
              <input type="date" value={form.enerjilenme_tarihi} onChange={(e) => handleChange('enerjilenme_tarihi', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
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

        {/* Direk Listesi */}
        {direkListesi.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-6">
            <DirekListesiDuzenle
              liste={direkListesi}
              onChange={setDirekListesi}
            />
          </div>
        )}

        {/* Demontaj Listesi - Ortak bileşen */}
        {demontajListesi.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-6">
            <DemontajListesiDuzenle
              liste={demontajListesi}
              onChange={setDemontajListesi}
              baslik="Demontaj Listesi"
              aciklama="Malzeme adini yazmaya baslayin, depo katalogdan otomatik eslestirme yapilacaktir."
            />
          </div>
        )}

        {/* Hata Mesajı */}
        {genelHata && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {genelHata}
          </div>
        )}

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
          <div className="relative group/save">
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
            {eksikAlanlar.length > 0 && (
              <div className="pointer-events-none absolute bottom-full right-0 mb-3 hidden w-72 group-hover/save:block">
                <div className="rounded-lg border border-red-300 bg-red-50 p-4 shadow-xl">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    Zorunlu alanlar eksik
                  </div>
                  <ul className="space-y-1 text-sm text-red-600">
                    {eksikAlanlar.map(a => (
                      <li key={a} className="flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-red-400" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-b border-r border-red-300 bg-red-50" />
              </div>
            )}
          </div>
        </div>
      </form>

      {yerTeslimAcik && (
        <YerTeslimModal onSonuc={handleYerTeslimSonuc} onKapat={() => setYerTeslimAcik(false)} />
      )}
    </div>
  )
}
