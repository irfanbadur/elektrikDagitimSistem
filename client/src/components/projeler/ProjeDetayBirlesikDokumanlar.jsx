import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Package,
  MapPin,
  Download,
  Image,
  FileText,
  File,
  X,
  Upload,
  Loader2,
  Calendar,
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

function boyutFormat(byte) {
  if (!byte) return '-'
  if (byte < 1024) return `${byte} B`
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(1)} KB`
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`
}

// =============================================
// Paket Karti
// =============================================
function PaketKarti({ paket }) {
  const [acik, setAcik] = useState(false)
  const durumInfo = PAKET_DURUM_LABELS[paket.durum] || PAKET_DURUM_LABELS.tamamlandi
  const tipLabel = PAKET_TIP_LABELS[paket.paket_tipi] || paket.paket_tipi

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Kart Header */}
      <button
        onClick={() => setAcik(!acik)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Package className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm">{paket.paket_no}</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium">
                {tipLabel}
              </span>
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', durumInfo.renk)}>
                {durumInfo.label}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatGecenSure(paket.olusturma_tarihi)}
              </span>
              {paket.personel_adi && <span>{paket.personel_adi}</span>}
              {paket.latitude && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Konum
                </span>
              )}
              <span>
                {(paket.dosya_sayisi || paket.foto_sayisi || 0)} dosya
              </span>
            </div>
          </div>
        </div>
        {acik ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* Acilan Detay */}
      {acik && <PaketDetay paket={paket} />}
    </div>
  )
}

function PaketDetay({ paket }) {
  const { data: detay, isLoading } = useVeriPaketiDetay(paket.id)
  const dosyalar = detay?.dosyalar || []

  return (
    <div className="border-t border-border bg-muted/30 p-4 space-y-3">
      {/* Notlar */}
      {paket.notlar && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Not</p>
          <p className="text-sm whitespace-pre-wrap">{paket.notlar}</p>
        </div>
      )}

      {/* Baslik */}
      {paket.baslik && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Baslik</p>
          <p className="text-sm">{paket.baslik}</p>
        </div>
      )}

      {/* Dosya listesi */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Dosyalar yukleniyor...
        </div>
      ) : dosyalar.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Dosyalar ({dosyalar.length})
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {dosyalar.map((dosya) => (
              <DosyaKarti key={dosya.id} dosya={dosya} />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Bu pakette dosya yok.</p>
      )}

      {/* Tarih detay */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
        <span>Olusturma: {formatTarihSaat(paket.olusturma_tarihi)}</span>
        {paket.tamamlanma_zamani && (
          <span>Tamamlanma: {formatTarihSaat(paket.tamamlanma_zamani)}</span>
        )}
        {paket.kaynak && <span>Kaynak: {paket.kaynak}</span>}
      </div>
    </div>
  )
}

function DosyaKarti({ dosya }) {
  const Icon = dosyaIkonu(dosya.kategori)
  const isFoto = dosya.kategori === 'fotograf'

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
      {/* Hover indirme */}
      <a
        href={`/api/dosya/${dosya.id}/indir`}
        className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
        title="Indir"
      >
        <Download className="h-6 w-6 text-white" />
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
export default function ProjeDetayBirlesikDokumanlar({ projeId }) {
  const [siralama, setSiralama] = useState('tarih_yeni')
  const [kategoriFiltre, setKategoriFiltre] = useState('')
  const [durumFiltre, setDurumFiltre] = useState('')
  const [modalAcik, setModalAcik] = useState(false)

  const queryFilters = { siralama }
  if (kategoriFiltre) queryFilters.dosya_kategori = kategoriFiltre
  if (durumFiltre) queryFilters.proje_durum = durumFiltre

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

        {/* Durum */}
        <select
          value={durumFiltre}
          onChange={(e) => setDurumFiltre(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Tum Durumlar</option>
          {Object.entries(PROJE_DURUMLARI).map(([key, val]) => (
            <option key={key} value={key}>
              {val.emoji} {val.label}
            </option>
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

      {/* Paket Listesi */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border border-border bg-muted/50" />
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
        <div className="space-y-3">
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
