import { useRef, useState, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useProjeFazIlerleme } from '@/hooks/useDongu'
import { FileText, Image, File } from 'lucide-react'
import api from '@/api/client'
import { cn } from '@/lib/utils'

const DURUM = {
  bekliyor:     { bg: 'bg-gray-100',   border: 'border-gray-300',  text: 'text-gray-500',  dot: 'bg-gray-300',    label: 'Bekliyor' },
  devam_ediyor: { bg: 'bg-blue-50',    border: 'border-blue-400',  text: 'text-blue-700',  dot: 'bg-blue-500',    label: 'Devam Ediyor' },
  tamamlandi:   { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Tamamlandi' },
  atlandi:      { bg: 'bg-amber-50',   border: 'border-amber-400', text: 'text-amber-700', dot: 'bg-amber-400',   label: 'Atlandi' },
}

function d(durum) { return DURUM[durum] || DURUM.bekliyor }

function dosyaIkonu(adi) {
  if (!adi) return <File className="h-3 w-3 text-gray-400" />
  const ext = adi.split('.').pop().toLowerCase()
  if (['jpg','jpeg','png','gif','webp','heic'].includes(ext)) return <Image className="h-3 w-3 text-purple-500" />
  if (['pdf','doc','docx','xls','xlsx'].includes(ext)) return <FileText className="h-3 w-3 text-red-500" />
  return <File className="h-3 w-3 text-gray-400" />
}

function resimMi(adi) {
  if (!adi) return false
  const ext = adi.split('.').pop().toLowerCase()
  return ['jpg','jpeg','png','gif','webp'].includes(ext)
}

// Adim icindeki dosya on izleme
function AdimDosyalar({ adimId }) {
  const { data: dosyalar } = useQuery({
    queryKey: ['adim-dosyalar', adimId],
    queryFn: () => api.get(`/dosya/adim/${adimId}`),
    select: (res) => res.data || [],
    enabled: !!adimId,
    staleTime: 60000,
  })

  if (!dosyalar || dosyalar.length === 0) return null

  const gosterilecek = dosyalar.slice(0, 4)
  const kalan = dosyalar.length - gosterilecek.length

  return (
    <div className="flex items-center gap-0.5 mt-1.5 flex-wrap justify-center">
      {gosterilecek.map((dosya) => {
        const adi = dosya.orijinal_adi || dosya.dosya_adi || ''
        const resim = resimMi(adi)
        return (
          <div
            key={dosya.id}
            className="w-7 h-7 rounded border border-gray-200 bg-white overflow-hidden flex items-center justify-center flex-shrink-0"
            title={adi}
          >
            {resim ? (
              <img
                src={`/api/dosya/${dosya.id}/thumb`}
                alt={adi}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              dosyaIkonu(adi)
            )}
          </div>
        )
      })}
      {kalan > 0 && (
        <span className="text-[8px] text-gray-400 font-medium ml-0.5">+{kalan}</span>
      )}
    </div>
  )
}

export default function ProjeDonguBar({ projeId }) {
  const { data: ilerleme } = useProjeFazIlerleme(projeId)
  const scrollRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragState = useRef({ startX: 0, scrollLeft: 0 })

  // Mouse wheel -> yatay kaydirma
  const handleWheel = useCallback((e) => {
    const el = scrollRef.current
    if (!el) return
    const hasOverflow = el.scrollWidth > el.clientWidth
    if (!hasOverflow) return
    e.preventDefault()
    el.scrollLeft += e.deltaY !== 0 ? e.deltaY : e.deltaX
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // Drag to scroll
  const handleMouseDown = useCallback((e) => {
    const el = scrollRef.current
    if (!el) return
    setIsDragging(true)
    dragState.current = { startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft }
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return
    const el = scrollRef.current
    if (!el) return
    e.preventDefault()
    const x = e.pageX - el.offsetLeft
    const walk = (x - dragState.current.startX) * 1.5
    el.scrollLeft = dragState.current.scrollLeft - walk
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  if (!ilerleme || ilerleme.toplam_adim === 0) return null

  // Faz gruplari olustur
  const fazlar = []
  const fazMap = new Map()
  for (const adim of ilerleme.adimlar) {
    const key = `${adim.faz_sira}-${adim.faz_kodu}`
    if (!fazMap.has(key)) {
      const fg = {
        faz_sira: adim.faz_sira, faz_adi: adim.faz_adi, faz_kodu: adim.faz_kodu,
        renk: adim.renk, ikon: adim.ikon, adimlar: [],
      }
      fazMap.set(key, fg)
      fazlar.push(fg)
    }
    fazMap.get(key).adimlar.push(adim)
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Baslik + ilerleme */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Yasam Dongusu
        </span>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 rounded-full bg-gray-200 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                ilerleme.yuzde === 100 ? 'bg-emerald-500' : 'bg-blue-500'
              )}
              style={{ width: `${ilerleme.yuzde}%` }}
            />
          </div>
          <span className="text-xs font-bold text-muted-foreground">%{ilerleme.yuzde}</span>
        </div>
      </div>

      {/* Yatay kaydirma alani */}
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        className={cn(
          'flex gap-0 overflow-x-auto py-3 px-3 scrollbar-hide',
          isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
        )}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {fazlar.map((faz, fi) => {
          const tamamlanan = faz.adimlar.filter(a => a.durum === 'tamamlandi' || a.durum === 'atlandi').length
          const toplam = faz.adimlar.length
          const fazTamam = tamamlanan === toplam && toplam > 0
          const fazAktif = faz.adimlar.some(a => a.durum === 'devam_ediyor')

          return (
            <div key={faz.faz_kodu} className="flex items-center flex-shrink-0">
              {/* Faz grubu */}
              <div className="flex flex-col items-stretch">
                {/* Faz basligi */}
                <div
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-t-lg border-b-2 mb-1',
                    fazTamam ? 'bg-emerald-50 border-emerald-400' :
                    fazAktif ? 'bg-blue-50 border-blue-400' :
                    'bg-gray-50 border-gray-200'
                  )}
                >
                  <span className="text-sm">{faz.ikon}</span>
                  <span className={cn(
                    'text-[11px] font-bold whitespace-nowrap',
                    fazTamam ? 'text-emerald-700' : fazAktif ? 'text-blue-700' : 'text-gray-500'
                  )}>
                    {faz.faz_adi}
                  </span>
                  <span className={cn(
                    'text-[9px] font-semibold ml-auto',
                    fazTamam ? 'text-emerald-500' : 'text-gray-400'
                  )}>
                    {tamamlanan}/{toplam}
                  </span>
                </div>

                {/* Adimlar */}
                <div className="flex gap-1 px-1">
                  {faz.adimlar.map((adim) => {
                    const s = d(adim.durum)
                    const aktif = adim.durum === 'devam_ediyor'
                    return (
                      <div
                        key={adim.id}
                        title={`${adim.adim_adi} — ${s.label}`}
                        className={cn(
                          'flex flex-col items-center rounded-lg border px-2 py-2 transition-all min-w-[80px] max-w-[96px]',
                          s.bg, s.border,
                          aktif && 'ring-2 ring-blue-400/30 shadow-sm'
                        )}
                      >
                        <div className="flex items-center gap-1">
                          <div className={cn('h-2 w-2 rounded-full flex-shrink-0', s.dot)} />
                          <span className="text-[8px] text-gray-400">{s.label}</span>
                        </div>
                        <span className={cn(
                          'text-[10px] font-semibold mt-1 whitespace-nowrap leading-tight text-center',
                          s.text
                        )}>
                          {adim.adim_adi.length > 12 ? adim.adim_adi.slice(0, 11) + '..' : adim.adim_adi}
                        </span>
                        {/* Dosya on izlemeleri */}
                        <AdimDosyalar adimId={adim.id} />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Fazlar arasi ok */}
              {fi < fazlar.length - 1 && (
                <div className="flex items-center px-1.5 self-center">
                  <div className={cn(
                    'w-5 h-0.5',
                    fazTamam ? 'bg-emerald-400' : 'bg-gray-200'
                  )} />
                  <div className={cn(
                    'w-0 h-0 border-t-[4px] border-b-[4px] border-l-[6px] border-t-transparent border-b-transparent',
                    fazTamam ? 'border-l-emerald-400' : 'border-l-gray-300'
                  )} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
