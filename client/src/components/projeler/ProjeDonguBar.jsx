import { useRef, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { PhotoProvider, PhotoView } from 'react-photo-view'
import 'react-photo-view/dist/react-photo-view.css'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useProjeFazIlerleme, useAdimMetaGuncelle } from '@/hooks/useDongu'
import {
  FileText, Image, File, Upload, MapPin, Zap, X, Navigation, Clock,
  CheckCircle2, ExternalLink, CalendarDays, FolderOpen, Plus, Sparkles,
  ZoomIn, ZoomOut, RotateCcw, Loader2
} from 'lucide-react'
import api from '@/api/client'
import { cn } from '@/lib/utils'
import KesifParseModal from './KesifParseModal'
import ConfirmDialog from '@/components/shared/ConfirmDialog'

const DURUM = {
  bekliyor:     { bg: 'bg-gray-50',    border: 'border-gray-200',    text: 'text-gray-500',    dot: 'bg-gray-300',    label: 'Bekliyor',      badgeBg: 'bg-gray-100 text-gray-500' },
  devam_ediyor: { bg: 'bg-blue-50/70', border: 'border-blue-300',    text: 'text-blue-700',    dot: 'bg-blue-500',    label: 'Devam Ediyor',  badgeBg: 'bg-blue-100 text-blue-700' },
  tamamlandi:   { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Tamamlandi',    badgeBg: 'bg-emerald-100 text-emerald-700' },
  atlandi:      { bg: 'bg-amber-50',   border: 'border-amber-300',   text: 'text-amber-700',   dot: 'bg-amber-400',   label: 'Atlandi',       badgeBg: 'bg-amber-100 text-amber-600' },
}

function d(durum) { return DURUM[durum] || DURUM.bekliyor }

function dosyaIkonu(adi, cls = 'h-4 w-4') {
  if (!adi) return <File className={cn(cls, 'text-gray-400')} />
  const ext = adi.split('.').pop().toLowerCase()
  if (['jpg','jpeg','png','gif','webp','heic'].includes(ext)) return <Image className={cn(cls, 'text-purple-500')} />
  if (['pdf','doc','docx','xls','xlsx'].includes(ext)) return <FileText className={cn(cls, 'text-red-500')} />
  if (['dwg','dxf'].includes(ext)) return <FileText className={cn(cls, 'text-cyan-600')} />
  return <File className={cn(cls, 'text-gray-400')} />
}

const EXT_RENK = {
  pdf: 'bg-red-50 text-red-600 border-red-200',
  doc: 'bg-blue-50 text-blue-600 border-blue-200', docx: 'bg-blue-50 text-blue-600 border-blue-200',
  xls: 'bg-green-50 text-green-600 border-green-200', xlsx: 'bg-green-50 text-green-600 border-green-200',
  dwg: 'bg-cyan-50 text-cyan-700 border-cyan-200', dxf: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  zip: 'bg-yellow-50 text-yellow-700 border-yellow-200', rar: 'bg-yellow-50 text-yellow-700 border-yellow-200',
}

function DosyaUzantiBadge({ adi }) {
  if (!adi) return <File className="h-4 w-4 text-gray-400" />
  const ext = adi.split('.').pop().toLowerCase()
  const renk = EXT_RENK[ext] || 'bg-gray-50 text-gray-500 border-gray-200'
  return (
    <span className={cn('text-[11px] font-extrabold uppercase leading-none', renk)}>
      {ext}
    </span>
  )
}

function resimMi(adi) {
  if (!adi) return false
  return ['jpg','jpeg','png','gif','webp'].includes(adi.split('.').pop().toLowerCase())
}

// ─── Dosya Yukleme Komponenti ────────────────
function xlsMi(adi) {
  if (!adi) return false
  return ['xls', 'xlsx'].includes(adi.split('.').pop().toLowerCase())
}

// Pan + Zoom destekli resim görüntüleyici
function PanZoomResim({ src, alt }) {
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 })
  const containerRef = useRef(null)

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    setScale(prev => Math.min(5, Math.max(0.5, prev + (e.deltaY < 0 ? 0.2 : -0.2))))
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const handleMouseDown = (e) => {
    if (e.button !== 0) return
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }
  }

  useEffect(() => {
    if (!dragging) return
    const handleMove = (e) => {
      setPos({
        x: dragStart.current.px + (e.clientX - dragStart.current.x),
        y: dragStart.current.py + (e.clientY - dragStart.current.y),
      })
    }
    const handleUp = () => setDragging(false)
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
    return () => { document.removeEventListener('mousemove', handleMove); document.removeEventListener('mouseup', handleUp) }
  }, [dragging])

  const reset = () => { setScale(1); setPos({ x: 0, y: 0 }) }

  return (
    <div className="relative w-full">
      {/* Zoom kontrolleri */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-lg bg-white/90 px-1.5 py-1 shadow-sm border border-border">
        <button onClick={() => setScale(s => Math.min(5, s + 0.3))} className="rounded p-1 hover:bg-muted" title="Yakınlaştır">
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <span className="text-[10px] font-mono w-10 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.max(0.5, s - 0.3))} className="rounded p-1 hover:bg-muted" title="Uzaklaştır">
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button onClick={reset} className="rounded p-1 hover:bg-muted" title="Sıfırla">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* Resim alanı */}
      <div ref={containerRef} className="overflow-hidden rounded-lg" style={{ height: 380, cursor: dragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}>
        <img src={src} alt={alt}
          style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, transformOrigin: 'center center', transition: dragging ? 'none' : 'transform 0.15s', maxHeight: 380, width: '100%', objectFit: 'contain', userSelect: 'none', pointerEvents: 'none' }}
          draggable={false} />
      </div>
    </div>
  )
}

// DXF Viewer — fontlar: NotoSans (text) + B_CAD (semboller) — stil bazlı seçim otomatik
const DXF_FONTS = ['/fonts/NotoSans.ttf', '/fonts/B_CAD.ttf', '/fonts/T_ROMANS.ttf']

function DxfOnizleme({ src }) {
  const containerRef = useRef(null)
  const viewerRef = useRef(null)
  const rendererRef = useRef(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState('')
  const [ilerleme, setIlerleme] = useState('')

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    const yukle = async () => {
      setYukleniyor(true)
      setHata('')
      setIlerleme('Modüller yükleniyor...')
      try {
        const [{ DxfViewer }, three] = await Promise.all([
          import('dxf-viewer'),
          import('three')
        ])

        // Önceki viewer'ı temizle (renderer'ı koru)
        if (viewerRef.current) {
          try { viewerRef.current.Clear() } catch {}
          viewerRef.current = null
        }

        if (cancelled) return

        // Renderer'ı yeniden kullan veya oluştur
        if (!rendererRef.current) {
          rendererRef.current = new three.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
          containerRef.current.innerHTML = ''
          containerRef.current.appendChild(rendererRef.current.domElement)
          rendererRef.current.domElement.style.width = '100%'
          rendererRef.current.domElement.style.height = '100%'
        }

        setIlerleme('Viewer başlatılıyor...')
        const viewer = new DxfViewer(containerRef.current, {
          clearColor: new three.Color('#f8fafc'),
          autoResize: true,
          colorCorrection: true,
          renderer: rendererRef.current,
        })
        viewerRef.current = viewer

        setIlerleme('DXF dosyası indiriliyor...')
        const response = await fetch(src)
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)

        setIlerleme('DXF parse ediliyor ve çiziliyor...')
        console.log('[DXF] Fontlar:', DXF_FONTS)
        await viewer.Load({
          url,
          fonts: DXF_FONTS,
          progressCbk: (phase, processed, total) => {
            console.log('[DXF] Progress:', phase, processed, total)
            if (phase === 'font') setIlerleme(`Font yükleniyor... (${processed}/${total})`)
            else if (phase === 'fetch') setIlerleme('Dosya alınıyor...')
            else if (phase === 'parse') setIlerleme(`Parse ediliyor... ${total ? Math.round(processed/total*100) + '%' : ''}`)
            else if (phase === 'prepare') setIlerleme('Sahne hazırlanıyor...')
          }
        })
        console.log('[DXF] hasMissingChars:', viewer.hasMissingChars)
        URL.revokeObjectURL(url)

        // Tüm sahneye fit et
        if (viewer.bounds && viewer.origin) {
          const b = viewer.bounds, o = viewer.origin
          viewer.FitView(b.minX - o.x, b.maxX - o.x, b.minY - o.y, b.maxY - o.y)
        }
      } catch (err) {
        console.error('[DXF] Hata:', err)
        if (!cancelled) setHata(err.message || 'DXF dosyası yüklenemedi')
      } finally {
        if (!cancelled) setYukleniyor(false)
      }
    }

    yukle()

    return () => {
      cancelled = true
      if (viewerRef.current) {
        try { viewerRef.current.Clear() } catch {}
        viewerRef.current = null
      }
    }
  }, [src])

  // Bileşen unmount olduğunda renderer'ı temizle
  useEffect(() => {
    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose()
        rendererRef.current = null
      }
    }
  }, [])

  return (
    <div className="relative w-full">
      {yukleniyor && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">{ilerleme || 'DXF yükleniyor...'}</span>
          </div>
        </div>
      )}
      {hata && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="text-center text-sm text-red-600">
            <p className="font-medium">DXF yüklenemedi</p>
            <p className="text-xs text-muted-foreground mt-1">{hata}</p>
          </div>
        </div>
      )}
      {/* Kontroller */}
      {!yukleniyor && !hata && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
          {/* Zoom */}
          <div className="flex items-center gap-1 rounded-lg bg-white/90 px-1.5 py-1 shadow-sm border border-border">
            <button onClick={() => { const v = viewerRef.current; if (v) { v.GetCamera().zoom *= 1.3; v.GetCamera().updateProjectionMatrix(); v.Render() } }}
              className="rounded p-1 hover:bg-muted" title="Yakınlaştır"><ZoomIn className="h-3.5 w-3.5" /></button>
            <button onClick={() => { const v = viewerRef.current; if (v) { v.GetCamera().zoom /= 1.3; v.GetCamera().updateProjectionMatrix(); v.Render() } }}
              className="rounded p-1 hover:bg-muted" title="Uzaklaştır"><ZoomOut className="h-3.5 w-3.5" /></button>
            <button onClick={() => { const v = viewerRef.current; if (v && v.bounds) { const b = v.bounds, o = v.origin || {x:0,y:0}; v.FitView(b.minX-o.x, b.maxX-o.x, b.minY-o.y, b.maxY-o.y) } }}
              className="rounded p-1 hover:bg-muted" title="Tümünü Göster"><RotateCcw className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}
      <div ref={containerRef} style={{ height: 400, width: '100%' }} />
    </div>
  )
}

function DosyaYuklemeIcerik({ adim, projeId, onDosyaSec }) {
  const [dragOver, setDragOver] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [parseModal, setParseModal] = useState(null)
  const [silOnay, setSilOnay] = useState(null) // { id, adi }
  const fileRef = useRef(null)
  const qc = useQueryClient()

  const { data: dosyalar } = useQuery({
    queryKey: ['adim-dosyalar', adim.id],
    queryFn: () => api.get(`/dosya/adim/${adim.id}`),
    select: (res) => res.data || [],
    enabled: !!adim.id,
    staleTime: 5000,
  })

  const yukle = async (files) => {
    if (!files || files.length === 0) return
    setYukleniyor(true)
    let yuklenen = 0
    for (const file of files) {
      try {
        const fd = new FormData()
        fd.append('dosya', file)
        fd.append('proje_id', projeId)
        fd.append('proje_adim_id', adim.id)
        await api.post('/dosya/yukle', fd)
        yuklenen++
      } catch (err) {
        console.error('Dosya yukleme hatasi:', file.name, err)
      }
    }
    if (yuklenen > 0) qc.invalidateQueries({ queryKey: ['adim-dosyalar', adim.id] })
    setYukleniyor(false)
  }

  const silOnayla = async () => {
    if (!silOnay) return
    try {
      await api.delete(`/dosya/${silOnay.id}?fiziksel=true`)
      qc.invalidateQueries({ queryKey: ['adim-dosyalar', adim.id] })
    } catch (err) {
      console.error('Dosya silme hatasi:', err)
    }
    setSilOnay(null)
  }

  const liste = dosyalar || []

  return (
    <div
      className={cn(
        'flex-1 flex flex-col gap-1.5 min-h-0',
        dragOver && 'bg-blue-50/50 rounded-md'
      )}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }}
      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false) }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); yukle(Array.from(e.dataTransfer.files)) }}
    >
      {/* Dosya listesi */}
      {liste.length > 0 && (
        <PhotoProvider>
          <div className="flex items-center gap-1 flex-wrap">
            {liste.slice(0, 6).map((dosya) => {
              const adi = dosya.orijinal_adi || dosya.dosya_adi || ''
              const gorsel = resimMi(adi)
              const thumb = (
                <div className="group relative w-10 h-10 rounded border border-gray-200 bg-white overflow-hidden flex items-center justify-center flex-shrink-0 cursor-pointer" title={adi}>
                  {gorsel ? (
                    <img src={`/api/dosya/${dosya.id}/thumb`} alt={adi} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <DosyaUzantiBadge adi={adi} />
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setSilOnay({ id: dosya.id, adi }) }}
                    className="absolute -top-0.5 -right-0.5 hidden group-hover:flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-white"
                    title="Sil"
                  >
                    <X className="h-2 w-2" />
                  </button>
                </div>
              )
              const handleDosyaTikla = (e) => {
                e.stopPropagation()
                const ext = adi.split('.').pop().toLowerCase()
                onDosyaSec?.({ id: dosya.id, adi, adimAdi: adim.adim_adi, gorsel, xls: xlsMi(adi), dxf: ext === 'dxf' || ext === 'dwg' })
              }
              if (gorsel) return (
                <div key={dosya.id} className="relative group" onClick={handleDosyaTikla}>
                  {thumb}
                </div>
              )
              if (xlsMi(adi)) return (
                <div key={dosya.id} className="relative group" onClick={handleDosyaTikla}>
                  {thumb}
                </div>
              )
              return (
                <div key={dosya.id} className="relative group" onClick={handleDosyaTikla}>
                  {thumb}
                </div>
              )
            })}
            {liste.length > 6 && (
              <span className="text-[10px] text-gray-400 font-semibold">+{liste.length - 6}</span>
            )}
          </div>
        </PhotoProvider>
      )}

      {/* Yukle */}
      {dragOver ? (
        <div className="flex items-center justify-center gap-1 py-2 text-[11px] text-blue-600 font-medium">
          <Upload className="h-3.5 w-3.5" /> Birak
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary mt-auto"
        >
          <Plus className="h-3 w-3" /> {yukleniyor ? 'Yukleniyor...' : 'Dosya ekle'}
        </button>
      )}
      <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { yukle(Array.from(e.target.files)); e.target.value = '' }} />

      {/* Silme onay */}
      {silOnay && createPortal(
        <ConfirmDialog
          open={true}
          onClose={() => setSilOnay(null)}
          onConfirm={silOnayla}
          title="Dosyayi Sil"
          message={`"${silOnay.adi}" dosyasi kalici olarak silinecek.`}
          confirmText="Sil"
          variant="destructive"
        />,
        document.body
      )}

      {/* Keşif XLS Parse Modal */}
      {parseModal && createPortal(
        <KesifParseModal
          projeId={projeId}
          dosyaId={parseModal.dosyaId}
          dosyaAdi={parseModal.dosyaAdi}
          onKapat={() => setParseModal(null)}
          onBasarili={() => qc.invalidateQueries({ queryKey: ['proje-kesif'] })}
        />,
        document.body
      )}
    </div>
  )
}

// ─── Koordinat Komponenti ────────────────────
function KoordinatIcerik({ adim }) {
  const meta = adim.meta_veri ? JSON.parse(adim.meta_veri) : {}
  const [duzenle, setDuzenle] = useState(false)
  const [lat, setLat] = useState(meta.lat || '')
  const [lng, setLng] = useState(meta.lng || '')
  const [aliyor, setAliyor] = useState(false)
  const metaGuncelle = useAdimMetaGuncelle()
  const varMi = meta.lat && meta.lng

  useEffect(() => {
    setLat(meta.lat || '')
    setLng(meta.lng || '')
  }, [meta.lat, meta.lng])

  const konumAl = (e) => {
    e?.stopPropagation()
    if (!navigator.geolocation) return alert('Tarayici konum desteklemiyor')
    setAliyor(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const yLat = pos.coords.latitude.toFixed(6)
        const yLng = pos.coords.longitude.toFixed(6)
        setLat(yLat)
        setLng(yLng)
        metaGuncelle.mutate({ adimId: adim.id, lat: yLat, lng: yLng })
        setAliyor(false)
        setDuzenle(false)
      },
      (err) => { alert('Konum alinamadi: ' + err.message); setAliyor(false) },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  const kaydet = (e) => {
    e?.stopPropagation()
    if (!lat || !lng) return
    metaGuncelle.mutate({ adimId: adim.id, lat, lng })
    setDuzenle(false)
  }

  if (duzenle) {
    return (
      <div className="flex-1 flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
        <div className="grid grid-cols-2 gap-1">
          <div>
            <label className="text-[9px] text-gray-400 uppercase">Enlem</label>
            <input value={lat} onChange={e => setLat(e.target.value)} placeholder="39.925"
              className="w-full rounded border border-gray-200 px-1.5 py-1 text-[11px] outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="text-[9px] text-gray-400 uppercase">Boylam</label>
            <input value={lng} onChange={e => setLng(e.target.value)} placeholder="32.866"
              className="w-full rounded border border-gray-200 px-1.5 py-1 text-[11px] outline-none focus:border-blue-400" />
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={konumAl} disabled={aliyor}
            className="flex-1 flex items-center justify-center gap-1 px-1 py-1 text-[10px] font-medium bg-blue-50 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-50">
            <Navigation className="h-3 w-3" />
            {aliyor ? 'Aliniyor...' : 'GPS'}
          </button>
          <button onClick={kaydet}
            className="flex-1 flex items-center justify-center gap-1 px-1 py-1 text-[10px] font-medium bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100">
            <CheckCircle2 className="h-3 w-3" /> Kaydet
          </button>
        </div>
        <button onClick={(e) => { e.stopPropagation(); setDuzenle(false) }}
          className="text-[10px] text-gray-400 hover:text-gray-600 text-center">Vazgec</button>
      </div>
    )
  }

  if (varMi) {
    return (
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 bg-green-50 rounded-md px-2 py-1.5">
          <MapPin className="h-4 w-4 text-green-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold text-green-700">{Number(meta.lat).toFixed(5)}</div>
            <div className="text-[11px] font-semibold text-green-700">{Number(meta.lng).toFixed(5)}</div>
          </div>
        </div>
        <div className="flex gap-1">
          <a href={`https://www.google.com/maps?q=${meta.lat},${meta.lng}`} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex-1 flex items-center justify-center gap-0.5 text-[10px] text-blue-600 hover:underline">
            <ExternalLink className="h-3 w-3" /> Harita
          </a>
          <button onClick={(e) => { e.stopPropagation(); setDuzenle(true) }}
            className="flex-1 text-[10px] text-gray-500 hover:text-primary">Duzenle</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-1.5">
      <MapPin className="h-6 w-6 text-gray-300" />
      <button onClick={konumAl} disabled={aliyor}
        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 disabled:opacity-50">
        <Navigation className="h-3 w-3" />
        {aliyor ? 'Aliniyor...' : 'Konum Al'}
      </button>
      <button onClick={(e) => { e.stopPropagation(); setDuzenle(true) }}
        className="text-[10px] text-gray-400 hover:text-primary">Manuel gir</button>
    </div>
  )
}

// ─── Meta'dan kesinti listesi çıkar (eski tekil format uyumu) ───
function metadanKesintiler(meta) {
  if (meta.kesintiler && Array.isArray(meta.kesintiler)) return meta.kesintiler
  if (meta.kesinti_tarihi) return [{
    kesinti_tarihi: meta.kesinti_tarihi, baslangic_saati: meta.baslangic_saati || '',
    bitis_saati: meta.bitis_saati || '', gerilim_ag: meta.gerilim_ag || false,
    gerilim_og: meta.gerilim_og || false, bolge: meta.bolge || '', notlar: meta.notlar || '',
  }]
  return []
}

const bosKesinti = () => ({
  kesinti_tarihi: '', baslangic_saati: '', bitis_saati: '',
  gerilim_ag: false, gerilim_og: false, bolge: '', notlar: '',
})

// ─── Kesinti Modal (çoklu) ──────────────────
function KesintiModal({ adim, onKapat }) {
  const meta = adim.meta_veri ? JSON.parse(adim.meta_veri) : {}
  const [liste, setListe] = useState(() => {
    const mevcut = metadanKesintiler(meta)
    return mevcut.length > 0 ? mevcut : [bosKesinti()]
  })
  const [aktifIdx, setAktifIdx] = useState(0)
  const metaGuncelle = useAdimMetaGuncelle()
  const inputCls = 'w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200'

  const form = liste[aktifIdx] || bosKesinti()
  const setForm = (fn) => setListe(prev => prev.map((k, i) => i === aktifIdx ? (typeof fn === 'function' ? fn(k) : fn) : k))

  const ekle = () => { setListe(prev => [...prev, bosKesinti()]); setAktifIdx(liste.length) }
  const sil = (idx) => {
    const yeni = liste.filter((_, i) => i !== idx)
    setListe(yeni.length > 0 ? yeni : [bosKesinti()])
    setAktifIdx(prev => prev >= yeni.length ? Math.max(0, yeni.length - 1) : prev)
  }

  const kaydet = () => {
    const gecerli = liste.filter(k => k.kesinti_tarihi)
    metaGuncelle.mutate({ adimId: adim.id, kesintiler: gecerli })
    onKapat()
  }

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onKapat() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onKapat])

  const formatGun = (t) => t ? new Date(t + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onKapat}>
      <div className="rounded-xl bg-white shadow-2xl border border-gray-200 flex flex-col" style={{ width: 460, maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100" style={{ padding: '16px 28px' }}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
              <Zap className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Enerji Kesintisi Planlayici</h3>
              <p className="text-[11px] text-gray-400">{adim.ad || 'Kesinti Adimi'} — {liste.length} kesinti</p>
            </div>
          </div>
          <button onClick={onKapat} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-gray-100" style={{ padding: '8px 28px' }}>
          {liste.map((k, i) => (
            <button key={i} onClick={() => setAktifIdx(i)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                i === aktifIdx ? 'bg-amber-100 text-amber-800' : 'text-gray-500 hover:bg-gray-100'
              )}>
              <Zap className="h-3 w-3" />
              {k.kesinti_tarihi ? formatGun(k.kesinti_tarihi) : `#${i + 1}`}
            </button>
          ))}
          <button onClick={ekle}
            className="flex items-center gap-0.5 rounded-md px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors">
            <Plus className="h-3 w-3" /> Ekle
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4" style={{ padding: '20px 28px' }}>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Kesinti Tarihi</label>
              <input type="date" value={form.kesinti_tarihi} onChange={e => setForm(f => ({ ...f, kesinti_tarihi: e.target.value }))} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">Baslangic Saati</label>
                <input type="time" value={form.baslangic_saati} onChange={e => setForm(f => ({ ...f, baslangic_saati: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">Bitis Saati</label>
                <input type="time" value={form.bitis_saati} onChange={e => setForm(f => ({ ...f, bitis_saati: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Gerilim Seviyesi</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.gerilim_ag} onChange={e => setForm(f => ({ ...f, gerilim_ag: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 accent-amber-500" />
                  <span className="text-sm font-medium text-gray-700">AG</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.gerilim_og} onChange={e => setForm(f => ({ ...f, gerilim_og: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 accent-amber-500" />
                  <span className="text-sm font-medium text-gray-700">OG</span>
                </label>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Bolge / Fider</label>
              <input value={form.bolge} onChange={e => setForm(f => ({ ...f, bolge: e.target.value }))} placeholder="Etkilenen bolge veya fider" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Notlar</label>
              <textarea value={form.notlar} onChange={e => setForm(f => ({ ...f, notlar: e.target.value }))} placeholder="Ek bilgi, kesinti sebebi..." rows={2} className={inputCls} />
            </div>
            {liste.length > 1 && (
              <button onClick={() => sil(aktifIdx)}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:underline">
                <X className="h-3 w-3" /> Bu kesintiyi kaldir
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100" style={{ padding: '16px 28px' }}>
          <button onClick={onKapat} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Vazgec</button>
          <button onClick={kaydet}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600">
            <CheckCircle2 className="h-4 w-4" /> Kaydet
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Kesinti Komponenti ──────────────────────
function KesintiIcerik({ adim }) {
  const meta = adim.meta_veri ? JSON.parse(adim.meta_veri) : {}
  const [modalAcik, setModalAcik] = useState(false)
  const kesintiler = metadanKesintiler(meta)

  if (kesintiler.length > 0) {
    const ilk = kesintiler[0]
    const gun = ilk.kesinti_tarihi ? new Date(ilk.kesinti_tarihi + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : ''

    return (
      <div className="flex-1 flex flex-col gap-1">
        <div className="bg-amber-50 rounded-md px-2 py-1.5 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
            <span className="text-[12px] font-bold text-amber-800">{gun}</span>
            {kesintiler.length > 1 && (
              <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">+{kesintiler.length - 1}</span>
            )}
          </div>
          {(ilk.baslangic_saati || ilk.bitis_saati) && (
            <div className="flex items-center gap-1 ml-5">
              <Clock className="h-3 w-3 text-amber-500" />
              <span className="text-[11px] text-amber-700">
                {ilk.baslangic_saati || '?'} - {ilk.bitis_saati || '?'}
              </span>
            </div>
          )}
          {(ilk.gerilim_ag || ilk.gerilim_og || ilk.bolge) && (
            <div className="flex items-center gap-1.5 ml-5">
              {ilk.gerilim_ag && <span className="rounded bg-amber-200/60 px-1 py-0.5 text-[9px] font-bold text-amber-800">AG</span>}
              {ilk.gerilim_og && <span className="rounded bg-orange-200/60 px-1 py-0.5 text-[9px] font-bold text-orange-800">OG</span>}
              {ilk.bolge && <span className="text-[10px] text-amber-600 truncate" title={ilk.bolge}>{ilk.bolge}</span>}
            </div>
          )}
        </div>
        <button onClick={(e) => { e.stopPropagation(); setModalAcik(true) }}
          className="text-[10px] text-gray-500 hover:text-primary text-center">Duzenle</button>
        {modalAcik && createPortal(<KesintiModal adim={adim} onKapat={() => setModalAcik(false)} />, document.body)}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-1.5">
      <Zap className="h-6 w-6 text-gray-300" />
      <span className="text-[10px] text-gray-400">Kesinti planlanmadi</span>
      <button onClick={(e) => { e.stopPropagation(); setModalAcik(true) }}
        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-amber-50 text-amber-700 rounded-md hover:bg-amber-100">
        <CalendarDays className="h-3 w-3" /> Planla
      </button>
      {modalAcik && createPortal(<KesintiModal adim={adim} onKapat={() => setModalAcik(false)} />, document.body)}
    </div>
  )
}

// ─── Komponent tipi ikonları & label ─────────
const KOMPONENT_CFG = {
  dosya_yukleme: { ikon: <FolderOpen className="h-3 w-3" />, label: 'Dosya', renk: 'text-blue-500' },
  koordinat:     { ikon: <MapPin className="h-3 w-3" />,     label: 'Konum', renk: 'text-green-600' },
  kesinti:       { ikon: <Zap className="h-3 w-3" />,        label: 'Kesinti', renk: 'text-amber-500' },
}

// ─── Adım Kartı ──────────────────────────────
function AdimKarti({ adim, projeId, onDosyaSec }) {
  const komponent = adim.komponent_tipi || 'dosya_yukleme'
  const cfg = KOMPONENT_CFG[komponent] || KOMPONENT_CFG.dosya_yukleme

  // Dosya yükleme aracında dosya var mı?
  const { data: adimDosyalar } = useQuery({
    queryKey: ['adim-dosyalar', adim.id],
    queryFn: () => api.get(`/dosya/adim/${adim.id}`),
    select: (res) => res.data || [],
    enabled: komponent === 'dosya_yukleme' && !!adim.id,
    staleTime: 5000,
  })
  const dosyaVar = komponent === 'dosya_yukleme' && adimDosyalar && adimDosyalar.length > 0

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-xl border',
        'w-[150px] min-h-[120px]',
        dosyaVar ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-200',
      )}
    >
      {/* Kart baslik */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-gray-100 rounded-t-xl bg-white/60">
        <span className={cn('flex-shrink-0', cfg.renk)}>
          {cfg.ikon}
        </span>
        <span className="text-[11px] font-bold flex-1 truncate text-gray-700" title={adim.adim_adi}>
          {adim.adim_adi}
        </span>
        {dosyaVar && (
          <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-100 rounded-full px-1.5 py-0.5">{adimDosyalar.length}</span>
        )}
      </div>

      {/* Komponent icerigi */}
      <div className="flex-1 flex flex-col p-2">
        {komponent === 'dosya_yukleme' && <DosyaYuklemeIcerik adim={adim} projeId={projeId} onDosyaSec={onDosyaSec} />}
        {komponent === 'koordinat' && <KoordinatIcerik adim={adim} />}
        {komponent === 'kesinti' && <KesintiIcerik adim={adim} />}
      </div>
    </div>
  )
}

// ─── Ana Komponent ───────────────────────────
export default function ProjeDonguBar({ projeId }) {
  const { data: ilerleme } = useProjeFazIlerleme(projeId)
  const scrollRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [seciliDosya, setSeciliDosya] = useState(null) // { id, adi, adimAdi }
  const dragState = useRef({ startX: 0, scrollLeft: 0 })

  const handleWheel = useCallback((e) => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollWidth <= el.clientWidth) return
    e.preventDefault()
    el.scrollLeft += e.deltaY !== 0 ? e.deltaY : e.deltaX
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

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
    el.scrollLeft = dragState.current.scrollLeft - (x - dragState.current.startX) * 1.5
  }, [isDragging])

  const handleMouseUp = useCallback(() => setIsDragging(false), [])

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

  // Faz gruplari
  const fazlar = []
  const fazMap = new Map()
  for (const adim of ilerleme.adimlar) {
    const key = `${adim.faz_sira}-${adim.faz_kodu}`
    if (!fazMap.has(key)) {
      const fg = { faz_sira: adim.faz_sira, faz_adi: adim.faz_adi, faz_kodu: adim.faz_kodu, renk: adim.renk, ikon: adim.ikon, adimlar: [] }
      fazMap.set(key, fg)
      fazlar.push(fg)
    }
    fazMap.get(key).adimlar.push(adim)
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {/* Baslik */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-border">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Yasam Dongusu
        </span>
        <div className="flex items-center gap-3">
          <div className="h-2 w-28 rounded-full bg-gray-200 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                ilerleme.yuzde === 100 ? 'bg-emerald-500' : 'bg-blue-500'
              )}
              style={{ width: `${ilerleme.yuzde}%` }}
            />
          </div>
          <span className="text-xs font-bold text-muted-foreground tabular-nums">%{ilerleme.yuzde}</span>
        </div>
      </div>

      {/* Kaydirma alani */}
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        className={cn(
          'flex gap-0 overflow-x-auto py-4 px-4 scrollbar-hide',
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
            <div key={faz.faz_kodu} className="flex items-stretch flex-shrink-0">
              <div className="flex flex-col">
                {/* Faz basligi */}
                <div className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-t-xl border-b-2 mb-2',
                  fazTamam ? 'bg-emerald-50 border-emerald-400' :
                  fazAktif ? 'bg-blue-50 border-blue-400' :
                  'bg-gray-50 border-gray-200'
                )}>
                  <span className="text-base">{faz.ikon}</span>
                  <span className={cn(
                    'text-xs font-bold whitespace-nowrap',
                    fazTamam ? 'text-emerald-700' : fazAktif ? 'text-blue-700' : 'text-gray-500'
                  )}>
                    {faz.faz_adi}
                  </span>
                  <span className={cn(
                    'text-[10px] font-semibold ml-auto',
                    fazTamam ? 'text-emerald-500' : 'text-gray-400'
                  )}>
                    {tamamlanan}/{toplam}
                  </span>
                </div>

                {/* Adimlar */}
                <div className="flex gap-2 px-1 items-stretch">
                  {faz.adimlar.map((adim) => (
                    <AdimKarti key={adim.id} adim={adim} projeId={projeId} onDosyaSec={setSeciliDosya} />
                  ))}
                </div>
              </div>

              {/* Ok */}
              {fi < fazlar.length - 1 && (
                <div className="flex items-center px-2 self-center">
                  <div className={cn('w-6 h-0.5', fazTamam ? 'bg-emerald-400' : 'bg-gray-200')} />
                  <div className={cn(
                    'w-0 h-0 border-t-[5px] border-b-[5px] border-l-[7px] border-t-transparent border-b-transparent',
                    fazTamam ? 'border-l-emerald-400' : 'border-l-gray-300'
                  )} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ─── Dosya Ön İzleme Paneli ─── */}
      {seciliDosya && (
        <div className="border-t border-border">
          <div className="flex items-center justify-between px-5 py-2 bg-muted/30">
            <div className="flex items-center gap-2">
              {dosyaIkonu(seciliDosya.adi, 'h-4 w-4')}
              <span className="text-xs font-semibold">{seciliDosya.adi}</span>
              <span className="text-[10px] text-muted-foreground">— {seciliDosya.adimAdi}</span>
            </div>
            <div className="flex items-center gap-2">
              <a href={`/api/dosya/${seciliDosya.id}/dosya`} download={seciliDosya.adi} onClick={e => e.stopPropagation()}
                className="rounded px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/10">
                İndir
              </a>
              <button onClick={() => setSeciliDosya(null)} className="rounded p-1 hover:bg-muted">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="bg-gray-50 p-4" style={{ minHeight: 200 }}>
            {seciliDosya.gorsel ? (
              <PanZoomResim src={`/api/dosya/${seciliDosya.id}/dosya`} alt={seciliDosya.adi} />
            ) : seciliDosya.dxf ? (
              <DxfOnizleme src={`/api/dosya/${seciliDosya.id}/dosya`} />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                {dosyaIkonu(seciliDosya.adi, 'h-12 w-12')}
                <span className="text-sm font-medium">{seciliDosya.adi}</span>
                <span className="text-xs">Bu dosya türü için ön izleme mevcut değil</span>
                <a href={`/api/dosya/${seciliDosya.id}/dosya`} download={seciliDosya.adi}
                  className="mt-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary/90">
                  Dosyayı İndir
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
