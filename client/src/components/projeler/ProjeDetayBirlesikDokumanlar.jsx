import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/api/client'
import {
  Plus,
  Package,
  MapPin,
  Download,
  Eye,
  Image,
  FileText,
  File,
  X,
  Upload,
  Loader2,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  useProjeVeriPaketleri,
  useVeriPaketiDetay,
  useVeriPaketiOlustur,
  useVeriPaketiDosyaEkle,
  useVeriPaketiTamamla,
} from '@/hooks/useProjeVeriPaketleri'
import { useProje } from '@/hooks/useProjeler'
import { useProjeAsamalari, useProjeFazlar } from '@/hooks/useDongu'
import {
  PAKET_TIP_LABELS,
  PAKET_DURUM_LABELS,
  PROJE_DURUMLARI,
  DOSYA_KATEGORI_LABELS,
  SIRALAMA_SECENEKLERI,
} from '@/utils/constants'
import { formatTarihSaat, formatGecenSure } from '@/utils/formatters'
import { cn } from '@/lib/utils'

function dosyaIkonu(kategori) {
  switch (kategori) {
    case 'fotograf':
      return Image
    case 'belge':
    case 'tablo':
      return FileText
    default:
      return File
  }
}

// =============================================
// Foto Lightbox
// =============================================
function FotoLightbox({ dosya, fotograflar, onKapat }) {
  const [aktifIndex, setAktifIndex] = useState(() =>
    fotograflar ? fotograflar.findIndex(f => f.id === dosya.id) : 0
  )
  const aktif = fotograflar ? fotograflar[aktifIndex] : dosya

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onKapat()
    if (fotograflar && e.key === 'ArrowRight') setAktifIndex(i => Math.min(i + 1, fotograflar.length - 1))
    if (fotograflar && e.key === 'ArrowLeft') setAktifIndex(i => Math.max(i - 1, 0))
  }

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onKapat}>
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <img
          src={`/api/dosya/${aktif.id}/dosya`}
          alt={aktif.orijinal_adi || aktif.dosya_adi}
          className="max-w-full max-h-[85vh] object-contain rounded"
        />
        <div className="absolute bottom-0 inset-x-0 bg-black/60 px-4 py-2 rounded-b flex items-center justify-between">
          <span className="text-sm text-white truncate">{aktif.orijinal_adi || aktif.dosya_adi}</span>
          <div className="flex items-center gap-2">
            <a href={`/api/dosya/${aktif.id}/indir`} className="text-white/70 hover:text-white" title="Indir">
              <Download className="h-4 w-4" />
            </a>
          </div>
        </div>
        <button onClick={onKapat} className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70">
          <X className="h-5 w-5" />
        </button>
        {fotograflar && fotograflar.length > 1 && (
          <>
            {aktifIndex > 0 && (
              <button onClick={() => setAktifIndex(i => i - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70">
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {aktifIndex < fotograflar.length - 1 && (
              <button onClick={() => setAktifIndex(i => i + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70">
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function boyutFormat(byte) {
  if (!byte) return '-'
  if (byte < 1024) return `${byte} B`
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(1)} KB`
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`
}

// =============================================
// Paket Karti (Gorsel Kart)
// =============================================
function PaketKarti({ paket }) {
  const { data: detay, isLoading } = useVeriPaketiDetay(paket.id)
  const dosyalar = detay?.dosyalar || []
  const fotograflar = dosyalar.filter(d => d.kategori === 'fotograf')
  const ilkFoto = fotograflar[0]
  const toplamDosya = dosyalar.length || paket.dosya_sayisi || paket.foto_sayisi || 0

  const durumInfo = PAKET_DURUM_LABELS[paket.durum] || PAKET_DURUM_LABELS.tamamlandi
  const tipLabel = PAKET_TIP_LABELS[paket.paket_tipi] || paket.paket_tipi

  const [lightboxDosya, setLightboxDosya] = useState(null)
  const [detayAcik, setDetayAcik] = useState(false)

  const handleOnizlemeTikla = () => {
    if (ilkFoto) {
      setLightboxDosya(ilkFoto)
    } else if (detayAcik) {
      setDetayAcik(false)
    } else {
      setDetayAcik(true)
    }
  }

  // Etiketleri parse et
  const etiketler = useMemo(() => {
    if (!paket.etiketler) return []
    try {
      const parsed = JSON.parse(paket.etiketler)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return paket.etiketler.split(',').map(s => s.trim()).filter(Boolean)
    }
  }, [paket.etiketler])

  return (
    <div className="group relative rounded-md border border-border bg-white overflow-hidden">
      {/* Thumbnail / On izleme */}
      <div className="relative cursor-pointer" onClick={handleOnizlemeTikla}>
        {isLoading ? (
          <div className="flex aspect-square items-center justify-center bg-gray-50">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
          </div>
        ) : ilkFoto && ilkFoto.thumbnail_yolu ? (
          <div className="aspect-square bg-gray-100">
            <img
              src={`/api/dosya/${ilkFoto.id}/thumb`}
              alt={paket.paket_no}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="flex aspect-square items-center justify-center bg-gray-50">
            <Package className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}

        {/* Coklu foto sayaci */}
        {fotograflar.length > 1 && (
          <div className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
            <Image className="h-3 w-3" />
            {fotograflar.length}
          </div>
        )}

        {/* Alt gradient + baslik ve durum */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6">
          <p className="text-[11px] font-semibold text-white truncate">{paket.paket_no}</p>
          <span className={cn('inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium mt-0.5', durumInfo.renk)}>
            {durumInfo.label}
          </span>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <Eye className="h-6 w-6 text-white" />
        </div>
      </div>

      {/* Alt bilgi */}
      <div className="p-1.5 space-y-0.5">
        <p className="text-[10px] text-muted-foreground truncate">
          {tipLabel} &middot; {toplamDosya} dosya
        </p>
        {paket.notlar && (
          <p className="text-[10px] text-muted-foreground truncate" title={paket.notlar}>
            {paket.notlar}
          </p>
        )}
        {etiketler.length > 0 && (
          <div className="flex flex-wrap gap-0.5">
            {etiketler.slice(0, 3).map((tag, i) => (
              <span key={i} className="rounded bg-gray-100 px-1 py-px text-[9px] text-muted-foreground truncate max-w-[60px]">
                {tag}
              </span>
            ))}
            {etiketler.length > 3 && (
              <span className="text-[9px] text-muted-foreground">+{etiketler.length - 3}</span>
            )}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          {formatGecenSure(paket.olusturma_tarihi)}
        </p>
      </div>

      {/* Detay acilirsa (foto olmayan paketler icin) */}
      {detayAcik && dosyalar.length > 0 && (
        <div className="border-t border-border p-2">
          <div className="grid grid-cols-2 gap-1">
            {dosyalar.map((dosya) => (
              <DosyaKarti key={dosya.id} dosya={dosya} onFotoTikla={setLightboxDosya} />
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxDosya && (
        <FotoLightbox dosya={lightboxDosya} fotograflar={fotograflar} onKapat={() => setLightboxDosya(null)} />
      )}
    </div>
  )
}

function dosyaTiklamaAdresi(dosya) {
  const isFoto = dosya.kategori === 'fotograf'
  const isPdf = dosya.mime_tipi === 'application/pdf'
  if (isFoto || isPdf) return { href: `/api/dosya/${dosya.id}/dosya`, target: '_blank', indir: false }
  return { href: `/api/dosya/${dosya.id}/indir`, target: '_self', indir: true }
}

function DosyaKarti({ dosya, onFotoTikla }) {
  const Icon = dosyaIkonu(dosya.kategori)
  const isFoto = dosya.kategori === 'fotograf'
  const { href, target, indir } = dosyaTiklamaAdresi(dosya)

  const handleClick = (e) => {
    if (isFoto && onFotoTikla) {
      e.preventDefault()
      onFotoTikla(dosya)
    }
  }

  return (
    <div className="group relative rounded-md border border-border bg-white overflow-hidden">
      {/* Thumbnail veya ikon */}
      {isFoto && dosya.thumbnail_yolu ? (
        <div className="aspect-square bg-gray-100">
          <img
            src={`/api/dosya/${dosya.id}/thumb`}
            alt={dosya.baslik || dosya.orijinal_adi}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="flex aspect-square items-center justify-center bg-gray-50">
          <Icon className="h-8 w-8 text-muted-foreground/50" />
        </div>
      )}
      {/* Alt bilgi */}
      <div className="p-1.5">
        <p className="truncate text-xs font-medium" title={dosya.orijinal_adi || dosya.dosya_adi}>
          {dosya.orijinal_adi || dosya.dosya_adi}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {boyutFormat(dosya.dosya_boyutu)}
        </p>
      </div>
      {/* Hover — ac veya indir */}
      <a
        href={href}
        target={target}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        onClick={handleClick}
        className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
        title={indir ? 'Indir' : 'Ac'}
      >
        {indir ? <Download className="h-6 w-6 text-white" /> : <Eye className="h-6 w-6 text-white" />}
      </a>
    </div>
  )
}

// =============================================
// Veri Paketi Ekle Modal
// =============================================
function VeriPaketiEkleModal({ projeId, onKapat }) {
  const { data: proje } = useProje(projeId)
  const { data: asamalar } = useProjeAsamalari(projeId)
  const { data: fazlar } = useProjeFazlar(projeId)

  // Aktif aşamayı bul (proje.aktif_asama_id ile eşleştir, yoksa devam_ediyor durumuna bak)
  const aktifAsama = useMemo(() => {
    if (!asamalar) return null
    if (proje?.aktif_asama_id) {
      return asamalar.find((a) => a.id === proje.aktif_asama_id) || null
    }
    return asamalar.find((a) => a.durum === 'devam_ediyor') || null
  }, [asamalar, proje])

  const [paketTipi, setPaketTipi] = useState('')
  const [notlar, setNotlar] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [etiketler, setEtiketler] = useState('')
  const [dosyalar, setDosyalar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState(null)
  const fileInputRef = useRef(null)

  // Proje ve aşama bilgisi gelince otomatik etiketler ve varsayılan paket tipi ayarla
  useEffect(() => {
    const otomatikEtiketler = []
    if (proje?.proje_no) otomatikEtiketler.push(proje.proje_no)
    if (aktifAsama?.asama_adi) otomatikEtiketler.push(aktifAsama.asama_adi)
    else if (proje?.durum) {
      const durumInfo = PROJE_DURUMLARI[proje.durum]
      if (durumInfo) otomatikEtiketler.push(durumInfo.label)
    }
    if (otomatikEtiketler.length > 0) {
      setEtiketler(otomatikEtiketler.join(', '))
    }
  }, [proje, aktifAsama])

  // Varsayılan paket tipini aktif aşamaya göre ayarla
  useEffect(() => {
    if (aktifAsama?.asama_kodu) {
      setPaketTipi(aktifAsama.asama_kodu)
    } else if (asamalar && asamalar.length > 0) {
      setPaketTipi(asamalar[0].asama_kodu)
    } else {
      setPaketTipi('genel')
    }
  }, [aktifAsama, asamalar])

  const olustur = useVeriPaketiOlustur()
  const dosyaEkle = useVeriPaketiDosyaEkle()
  const tamamla = useVeriPaketiTamamla()

  const handleDosyaSec = (e) => {
    const yeniDosyalar = Array.from(e.target.files)
    setDosyalar((prev) => [...prev, ...yeniDosyalar])
  }

  const handleDosyaKaldir = (index) => {
    setDosyalar((prev) => prev.filter((_, i) => i !== index))
  }

  const handleKaydet = async () => {
    if (yukleniyor) return
    setYukleniyor(true)
    setHata(null)

    try {
      // 1. Paket olustur
      const res = await olustur.mutateAsync({
        paketTipi,
        projeId: parseInt(projeId),
        notlar: notlar || null,
        kaynak: 'web',
        baslik: null,
      })
      const paketId = res.data?.id ?? res.id

      if (!paketId) {
        throw new Error('Paket ID alinamadi')
      }

      // 2. Dosyalari yukle (varsa)
      for (const dosya of dosyalar) {
        const fd = new FormData()
        fd.append('dosya', dosya)
        if (etiketler.trim()) {
          fd.append('etiketler', JSON.stringify(etiketler.split(',').map((s) => s.trim()).filter(Boolean)))
        }
        if (latitude) fd.append('latitude', latitude)
        if (longitude) fd.append('longitude', longitude)
        await dosyaEkle.mutateAsync({ paketId, formData: fd })
      }

      // 3. Paketi tamamla
      await tamamla.mutateAsync(paketId)

      onKapat()
    } catch (err) {
      console.error('Paket olusturma hatasi:', err)
      setHata(err.message || 'Paket olusturulurken bir hata olustu')
    } finally {
      setYukleniyor(false)
    }
  }

  // Paket tipi seçenekleri: Fazlar varsa faz/adım göster, yoksa eski aşamalar, yoksa sabit liste
  const paketTipiSecenekleri = useMemo(() => {
    if (fazlar && fazlar.length > 0) {
      const secenekler = []
      for (const faz of fazlar) {
        for (const adim of faz.adimlar) {
          secenekler.push({
            key: adim.adim_kodu,
            label: `${faz.ikon || ''} ${faz.faz_adi} > ${adim.adim_adi}`.trim(),
            aktif: adim.durum === 'devam_ediyor',
          })
        }
      }
      return secenekler
    }
    if (asamalar && asamalar.length > 0) {
      return asamalar.map((a) => ({
        key: a.asama_kodu,
        label: `${a.ikon || ''} ${a.asama_adi}`.trim(),
        aktif: a.durum === 'devam_ediyor',
      }))
    }
    return Object.entries(PAKET_TIP_LABELS).map(([key, label]) => ({
      key,
      label,
      aktif: false,
    }))
  }, [fazlar, asamalar])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onKapat}>
      <div
        className="mx-4 w-full max-w-lg rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-lg font-semibold">Yeni Veri Paketi</h3>
          <button onClick={onKapat} className="rounded-md p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-4">
          {/* Paket tipi */}
          <div>
            <label className="mb-1 block text-sm font-medium">Paket Tipi</label>
            <select
              value={paketTipi}
              onChange={(e) => setPaketTipi(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {paketTipiSecenekleri.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}{s.aktif ? ' (Mevcut)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Dosya yukle */}
          <div>
            <label className="mb-1 block text-sm font-medium">Dosyalar</label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleDosyaSec}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-gray-300 px-4 py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Upload className="h-4 w-4" />
              Dosya Sec
            </button>
            {dosyalar.length > 0 && (
              <div className="mt-2 space-y-1">
                {dosyalar.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-1.5 text-sm"
                  >
                    <span className="truncate">{d.name}</span>
                    <button
                      type="button"
                      onClick={() => handleDosyaKaldir(i)}
                      className="ml-2 shrink-0 text-muted-foreground hover:text-red-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Not */}
          <div>
            <label className="mb-1 block text-sm font-medium">Not</label>
            <textarea
              value={notlar}
              onChange={(e) => setNotlar(e.target.value)}
              rows={2}
              placeholder="Paket hakkinda not..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Koordinat */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Enlem (Lat)</label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="39.925"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Boylam (Lng)</label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="32.866"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Etiketler */}
          <div>
            <label className="mb-1 block text-sm font-medium">Etiketler</label>
            <input
              type="text"
              value={etiketler}
              onChange={(e) => setEtiketler(e.target.value)}
              placeholder="etiket1, etiket2, ..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Proje ve surec bilgileri otomatik eklenir. Virgul ile ayirarak ek etiket girebilirsiniz.
            </p>
          </div>
        </div>

        {/* Hata mesaji */}
        {hata && (
          <div className="mx-5 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {hata}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
          <button
            onClick={onKapat}
            disabled={yukleniyor}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Iptal
          </button>
          <button
            onClick={handleKaydet}
            disabled={yukleniyor}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {yukleniyor && <Loader2 className="h-4 w-4 animate-spin" />}
            Kaydet
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================
// Ana Bilesen
// =============================================
// =============================================
// Dongu Dosyalari Bolumu
// =============================================
function DonguDosyalari({ projeId }) {
  const { data: dosyalar, isLoading } = useQuery({
    queryKey: ['dosya', 'dongu', projeId],
    queryFn: () => api.get(`/dosya`, { params: { proje_id: projeId, durum: 'aktif' } }),
    select: (res) => {
      const list = res?.data || res || []
      return Array.isArray(list) ? list.filter(d => d.proje_adim_id) : []
    },
    enabled: !!projeId,
  })
  const [lightboxDosya, setLightboxDosya] = useState(null)

  if (isLoading || !dosyalar || dosyalar.length === 0) return null

  const fotograflar = dosyalar.filter(d => d.kategori === 'fotograf')

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
        <File className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Dongu Dosyalari</span>
        <span className="text-xs text-muted-foreground">({dosyalar.length})</span>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {dosyalar.map((dosya) => (
            <DosyaKarti key={dosya.id} dosya={dosya} onFotoTikla={setLightboxDosya} />
          ))}
        </div>
      </div>
      {lightboxDosya && (
        <FotoLightbox dosya={lightboxDosya} fotograflar={fotograflar} onKapat={() => setLightboxDosya(null)} />
      )}
    </div>
  )
}

export default function ProjeDetayBirlesikDokumanlar({ projeId }) {
  const [siralama, setSiralama] = useState('tarih_yeni')
  const [kategoriFiltre, setKategoriFiltre] = useState('')
  const [adimFiltre, setAdimFiltre] = useState('')
  const [modalAcik, setModalAcik] = useState(false)
  const { data: fazlar } = useProjeFazlar(projeId)

  const queryFilters = { siralama }
  if (kategoriFiltre) queryFilters.dosya_kategori = kategoriFiltre
  if (adimFiltre) queryFilters.paket_tipi = adimFiltre

  const { data: paketler, isLoading } = useProjeVeriPaketleri(projeId, queryFilters)

  return (
    <div className="space-y-4">
      {/* Filtre Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Siralama */}
        <select
          value={siralama}
          onChange={(e) => setSiralama(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {Object.entries(SIRALAMA_SECENEKLERI).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        {/* Dosya Turu */}
        <select
          value={kategoriFiltre}
          onChange={(e) => setKategoriFiltre(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Tum Turler</option>
          {Object.entries(DOSYA_KATEGORI_LABELS)
            .filter(([key]) => key !== 'tumu')
            .map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
        </select>

        {/* Surec Adimi */}
        <select
          value={adimFiltre}
          onChange={(e) => setAdimFiltre(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Tum Adimlar</option>
          {fazlar && fazlar.map((faz) => (
            faz.adimlar?.map((adim) => (
              <option key={adim.adim_kodu} value={adim.adim_kodu}>
                {faz.ikon || ''} {faz.faz_adi} &gt; {adim.adim_adi}
              </option>
            ))
          ))}
        </select>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Ekle butonu */}
        <button
          onClick={() => setModalAcik(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Ekle
        </button>
      </div>

      {/* Dongu Dosyalari */}
      <DonguDosyalari projeId={projeId} />

      {/* Paket Listesi */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="aspect-square animate-pulse rounded-md border border-border bg-muted/50" />
          ))}
        </div>
      ) : !paketler || paketler.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            Bu projeye ait veri paketi bulunamadi.
          </p>
          <button
            onClick={() => setModalAcik(true)}
            className="mt-3 text-sm font-medium text-primary hover:underline"
          >
            Ilk veri paketini olustur
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {paketler.map((paket) => (
            <PaketKarti key={paket.id} paket={paket} />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalAcik && (
        <VeriPaketiEkleModal projeId={projeId} onKapat={() => setModalAcik(false)} />
      )}
    </div>
  )
}
