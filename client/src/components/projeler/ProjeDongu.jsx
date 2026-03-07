import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useProjeFazIlerleme,
  useProjeFazAta,
  useAdimBaslat,
  useAdimTamamla,
  useAdimAtla,
} from '@/hooks/useDongu'
import { useIsTipleri } from '@/hooks/useIsTipleri'
import { useAuth } from '@/context/AuthContext'
import api from '@/api/client'
import { cn } from '@/lib/utils'
import { Upload, FileText, Image, File, Loader2 } from 'lucide-react'

// --- DURUM STILLERI ---
const DURUM_STILLER = {
  bekliyor:     { bg: 'bg-gray-50',    border: 'border-gray-200',  text: 'text-gray-500',   label: 'Bekliyor',     ikon: '\u23F3' },
  devam_ediyor: { bg: 'bg-blue-50',    border: 'border-blue-400',  text: 'text-blue-700',   label: 'Devam Ediyor', ikon: '\uD83D\uDD04' },
  tamamlandi:   { bg: 'bg-green-50',   border: 'border-green-400', text: 'text-green-700',  label: 'Tamamland\u0131', ikon: '\u2705' },
  atlandi:      { bg: 'bg-yellow-50',  border: 'border-yellow-400',text: 'text-yellow-700', label: 'Atland\u0131', ikon: '\u23ED\uFE0F' },
}

function getDurumStil(durum) {
  return DURUM_STILLER[durum] || DURUM_STILLER.bekliyor
}

function dosyaIkonu(adi) {
  if (!adi) return <File className="h-3.5 w-3.5" />
  const ext = adi.split('.').pop().toLowerCase()
  if (['jpg','jpeg','png','gif','webp','heic'].includes(ext)) return <Image className="h-3.5 w-3.5 text-purple-500" />
  if (['pdf','doc','docx','xls','xlsx'].includes(ext)) return <FileText className="h-3.5 w-3.5 text-red-500" />
  return <File className="h-3.5 w-3.5 text-gray-400" />
}

// --- ILERLEME CUBUGU ---
function IlerlemeBar({ ilerleme }) {
  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold text-gray-700">Genel Ilerleme</span>
        <span className="text-2xl font-bold text-blue-600">%{ilerleme.yuzde}</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            ilerleme.yuzde === 100 ? 'bg-green-500' : 'bg-gradient-to-r from-blue-500 to-blue-600'
          )}
          style={{ width: `${ilerleme.yuzde}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-gray-500 flex gap-3">
        <span>{ilerleme.tamamlanan}/{ilerleme.toplam_adim} adim tamamlandi</span>
        {ilerleme.aktif_faz && <span>Aktif faz: <strong>{ilerleme.aktif_faz}</strong></span>}
        {ilerleme.aktif_adim && <span>{ilerleme.aktif_adim}</span>}
      </div>
    </div>
  )
}

// --- DOSYA ON IZLEME (Windows dosya penceresi stili) ---
function DosyaOnizleme({ dosya }) {
  const adi = dosya.adi || dosya.orijinal_adi || dosya.dosya_adi || ''
  const ext = adi.split('.').pop().toLowerCase()
  const resim = ['jpg','jpeg','png','gif','webp'].includes(ext)
  const thumbSrc = dosya.id ? `/api/dosya/${dosya.id}/thumb` : null

  return (
    <div className="flex flex-col items-center w-[56px] group" title={adi}>
      <div className="w-10 h-10 rounded border border-gray-200 bg-white overflow-hidden flex items-center justify-center">
        {resim && thumbSrc ? (
          <img src={thumbSrc} alt={adi} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center gap-0.5">
            {dosyaIkonu(adi)}
          </div>
        )}
      </div>
      <span className="mt-0.5 text-[8px] text-gray-500 leading-tight text-center truncate w-full group-hover:text-gray-800">
        {adi.length > 10 ? adi.slice(0, 8) + '..' : adi}
      </span>
    </div>
  )
}

// --- ADIM KARTI (3 sutunlu, orta sutun = dosya penceresi) ---
function AdimKarti({ adim, projeId, projeNo, onBaslat, onTamamla, onAtla }) {
  const stil = getDurumStil(adim.durum)
  const aktif = adim.durum === 'devam_ediyor'
  const dosyaYuklenebilir = adim.durum === 'devam_ediyor'
  const [yukleniyor, setYukleniyor] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)
  const qc = useQueryClient()
  const { kullanici } = useAuth()

  // Mevcut dosyalari API'den cek
  const { data: mevcutDosyalar } = useQuery({
    queryKey: ['adim-dosyalar', adim.id],
    queryFn: () => api.get(`/dosya/adim/${adim.id}`),
    select: (res) => res.data || [],
    enabled: !!adim.id,
  })

  const dosyalar = mevcutDosyalar || []

  const dosyaYukle = useCallback(async (files) => {
    if (!dosyaYuklenebilir || files.length === 0) return
    setYukleniyor(true)
    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append('dosya', file)
        formData.append('proje_id', projeId)
        formData.append('proje_adim_id', adim.id)
        if (projeNo) formData.append('proje_no', projeNo)
        formData.append('kaynak', 'web')
        if (kullanici?.id) formData.append('yukleyen_id', kullanici.id)
        await api.post('/dosya/yukle', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
      qc.invalidateQueries({ queryKey: ['adim-dosyalar', adim.id] })
      qc.invalidateQueries({ queryKey: ['proje-faz-ilerleme'] })
      qc.invalidateQueries({ queryKey: ['dosya'] })
      qc.invalidateQueries({ queryKey: ['proje-veri-paketleri'] })
    } catch (err) {
      console.error('Dosya yukleme hatasi:', err)
    } finally {
      setYukleniyor(false)
    }
  }, [dosyaYuklenebilir, projeId, projeNo, adim.id, kullanici, qc])

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    if (!dosyaYuklenebilir) return
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) dosyaYukle(files)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (dosyaYuklenebilir) setDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  const handleDosyaSec = (e) => {
    dosyaYukle(Array.from(e.target.files))
    e.target.value = ''
  }

  let gecenGun = null
  if (adim.baslangic_tarihi) {
    const bas = new Date(adim.baslangic_tarihi)
    const bit = adim.bitis_tarihi ? new Date(adim.bitis_tarihi) : new Date()
    gecenGun = Math.ceil((bit - bas) / (1000 * 60 * 60 * 24))
  }

  return (
    <div
      className={cn(
        'ml-6 rounded-lg border mb-2 transition-all',
        aktif ? cn(stil.bg, stil.border, 'shadow-sm') : 'bg-white border-gray-200 hover:border-gray-300'
      )}
    >
      <div className="flex items-stretch min-h-[80px]">
        {/* 1. SUTUN - Adim bilgileri */}
        <div className="w-[220px] flex-shrink-0 p-3 flex flex-col justify-between border-r border-gray-100">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400 font-mono">{adim.adim_sira}.</span>
              <span className={cn('text-sm font-semibold leading-tight', aktif ? stil.text : 'text-gray-800')}>
                {adim.adim_adi}
              </span>
            </div>
            <div className="mt-1 text-[10px] text-gray-400 flex items-center gap-1.5">
              {adim.baslangic_tarihi && <span>{adim.baslangic_tarihi}</span>}
              {adim.bitis_tarihi && <span>&rarr; {adim.bitis_tarihi}</span>}
              {gecenGun !== null && <span>({gecenGun}g)</span>}
              {!adim.baslangic_tarihi && adim.tahmini_gun && <span>~{adim.tahmini_gun}g</span>}
            </div>
          </div>
          <div className="flex gap-1.5 mt-1.5">
            {adim.durum === 'bekliyor' && (
              <>
                <button onClick={() => onBaslat(adim.id)}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                  Baslat
                </button>
                <button onClick={() => onAtla(adim.id)}
                  className="px-2.5 py-1 text-[11px] bg-white text-gray-500 border border-gray-300 rounded hover:bg-gray-50 transition-colors">
                  Atla
                </button>
              </>
            )}
            {adim.durum === 'devam_ediyor' && (
              <button onClick={() => onTamamla(adim.id)}
                className="px-2.5 py-1 text-[11px] font-semibold bg-green-600 text-white rounded hover:bg-green-700 transition-colors">
                Tamamla
              </button>
            )}
          </div>
        </div>

        {/* 2. SUTUN - Dosya penceresi (drag-drop, scroll) */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'flex-1 min-w-0 overflow-y-auto transition-colors relative',
            dragOver ? 'bg-blue-50 ring-2 ring-inset ring-blue-400' : 'bg-gray-50/30'
          )}
        >
          <div className="flex flex-wrap gap-1 p-1.5 content-start min-h-full">
            {/* Mevcut dosyalar */}
            {dosyalar.map((d) => (
              <DosyaOnizleme key={d.id} dosya={d} />
            ))}

            {/* Yukleniyor gostergesi */}
            {yukleniyor && (
              <div className="flex items-center justify-center w-[56px] h-[52px]">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              </div>
            )}

            {/* Dosya ekle butonu — aktif adimda her zaman goster */}
            {dosyaYuklenebilir && !yukleniyor && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                className="flex flex-col items-center justify-center w-[56px] h-[52px] rounded border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 transition-colors"
                title="Dosya yukle"
              >
                <Upload className="h-4 w-4" />
                <span className="text-[7px] mt-0.5">Ekle</span>
              </button>
            )}

            {/* Bos durum mesaji */}
            {dosyalar.length === 0 && !dosyaYuklenebilir && !yukleniyor && (
              <div className="flex items-center justify-center w-full h-full">
                <span className="text-[10px] text-gray-300 italic">
                  {adim.durum === 'bekliyor' ? 'Adimi baslatin' : 'Dosya yok'}
                </span>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleDosyaSec} />
        </div>

        {/* 3. SUTUN - Durum */}
        <div className="w-[100px] flex-shrink-0 p-3 flex flex-col items-center justify-center border-l border-gray-100">
          <span
            className={cn(
              'text-[10px] font-semibold px-2 py-1 rounded-full border whitespace-nowrap',
              stil.bg, stil.text, stil.border
            )}
          >
            {stil.ikon} {stil.label}
          </span>
          {dosyalar.length > 0 && (
            <span className="mt-1.5 text-[10px] text-gray-400">{dosyalar.length} dosya</span>
          )}
          {adim.paket_sayisi > 0 && (
            <span className="text-[10px] text-gray-400">{adim.paket_sayisi} paket</span>
          )}
        </div>
      </div>
    </div>
  )
}

// --- FAZ GRUBU ---
function FazGrubu({ faz, isLast, projeId, projeNo, onBaslat, onTamamla, onAtla }) {
  const tamamlanan = faz.adimlar.filter(a => a.durum === 'tamamlandi' || a.durum === 'atlandi').length
  const toplam = faz.adimlar.length
  const aktif = faz.adimlar.some(a => a.durum === 'devam_ediyor')
  const tamam = tamamlanan === toplam && toplam > 0
  const yuzde = toplam ? Math.round((tamamlanan / toplam) * 100) : 0

  return (
    <div className="flex items-stretch gap-3">
      {/* Sol - Timeline */}
      <div className="flex flex-col items-center w-10 flex-shrink-0">
        <div
          className={cn(
            'rounded-full flex items-center justify-center flex-shrink-0 border-[3px] transition-all',
            tamam
              ? 'bg-green-100 border-green-500'
              : aktif
                ? 'bg-blue-100 border-blue-500 ring-4 ring-blue-500/20'
                : 'bg-gray-100 border-gray-300',
            aktif ? 'w-10 h-10 text-lg' : 'w-8 h-8 text-sm'
          )}
        >
          {faz.ikon}
        </div>
        {!isLast && (
          <div
            className={cn(
              'flex-1 w-0.5 min-h-[20px]',
              tamam ? 'bg-green-500' : 'bg-gray-200'
            )}
          />
        )}
      </div>

      {/* Sag - Faz icerigi */}
      <div className="flex-1 mb-4">
        {/* Faz baslik */}
        <div
          className={cn(
            'rounded-xl p-4 border mb-2 transition-all',
            aktif ? 'bg-blue-50 border-blue-300 shadow-sm' : tamam ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
          )}
        >
          <div className="flex justify-between items-center">
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{faz.faz_sira}. Faz</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-base font-bold" style={{ color: faz.renk }}>
                  {faz.faz_adi}
                </span>
                {faz.sorumlu_rol_adi && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                    {faz.sorumlu_rol_adi}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold" style={{ color: faz.renk }}>
                {tamamlanan}/{toplam}
              </span>
              <div className="h-2 w-20 bg-gray-200 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${yuzde}%`, backgroundColor: faz.renk }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Adimlar */}
        {faz.adimlar.map(adim => (
          <AdimKarti
            key={adim.id}
            adim={adim}
            projeId={projeId}
            projeNo={projeNo}
            onBaslat={onBaslat}
            onTamamla={onTamamla}
            onAtla={onAtla}
          />
        ))}
      </div>
    </div>
  )
}

// --- FAZ ATAMA PANELI ---
function FazAtamaPanel({ projeId, projeTipi }) {
  const { data: tipler, isLoading } = useIsTipleri()
  const ata = useProjeFazAta()
  const [secili, setSecili] = useState('')

  const otomatikTip = tipler?.find(t => t.kod.toUpperCase() === (projeTipi || '').toUpperCase())

  const handleAta = () => {
    const tipId = secili || otomatikTip?.id
    if (!tipId) return
    ata.mutate({ projeId: parseInt(projeId), isTipiId: parseInt(tipId) })
  }

  if (isLoading) return <div className="text-sm text-gray-400 p-4">Yukleniyor...</div>

  return (
    <div className="p-8 text-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50">
      <div className="text-gray-400 mb-4 text-sm">Bu projeye henuz yasam dongusu atanmamis.</div>
      {otomatikTip && (
        <p className="text-sm text-blue-600 mb-4">
          Proje tipine uygun: <strong>{otomatikTip.ad}</strong> ({otomatikTip.fazlar.length} faz)
        </p>
      )}
      <div className="flex items-center justify-center gap-3">
        <select
          value={secili}
          onChange={(e) => setSecili(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="">{otomatikTip ? `${otomatikTip.ad} (otomatik)` : 'Is tipi sec...'}</option>
          {tipler?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.ad} ({t.fazlar.length} faz)
            </option>
          ))}
        </select>
        <button
          onClick={handleAta}
          disabled={!secili && !otomatikTip || ata.isPending}
          className="px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {ata.isPending ? 'Ataniyor...' : 'Yasam Dongusu Ata'}
        </button>
      </div>
      {ata.isError && (
        <p className="mt-3 text-sm text-red-500">{ata.error.message}</p>
      )}
    </div>
  )
}

// === ANA BILESEN ===
export default function ProjeDongu({ projeId, projeTipi, projeNo }) {
  const { data: ilerleme, isLoading } = useProjeFazIlerleme(projeId)
  const baslat = useAdimBaslat()
  const tamamla = useAdimTamamla()
  const atla = useAdimAtla()

  const handleBaslat = (adimId) => baslat.mutate({ adimId })
  const handleTamamla = (adimId) => tamamla.mutate({ adimId })
  const handleAtla = (adimId) => atla.mutate({ adimId })

  if (isLoading) {
    return <div className="p-6 text-gray-400 text-center">Yukleniyor...</div>
  }

  if (!ilerleme || ilerleme.toplam_adim === 0) {
    return <FazAtamaPanel projeId={projeId} projeTipi={projeTipi} />
  }

  // Adimlari faz bazli grupla
  const fazGruplari = []
  const fazMap = new Map()

  for (const adim of ilerleme.adimlar) {
    const key = `${adim.faz_sira}-${adim.faz_kodu}`
    if (!fazMap.has(key)) {
      const fGrup = {
        faz_sira: adim.faz_sira,
        faz_adi: adim.faz_adi,
        faz_kodu: adim.faz_kodu,
        renk: adim.renk,
        ikon: adim.ikon,
        sorumlu_rol_adi: adim.sorumlu_rol_adi,
        adimlar: []
      }
      fazMap.set(key, fGrup)
      fazGruplari.push(fGrup)
    }
    fazMap.get(key).adimlar.push(adim)
  }

  return (
    <div className="p-4">
      <IlerlemeBar ilerleme={ilerleme} />
      <div>
        {fazGruplari.map((faz, i) => (
          <FazGrubu
            key={faz.faz_kodu}
            faz={faz}
            isLast={i === fazGruplari.length - 1}
            projeId={projeId}
            projeNo={projeNo}
            onBaslat={handleBaslat}
            onTamamla={handleTamamla}
            onAtla={handleAtla}
          />
        ))}
      </div>
    </div>
  )
}
