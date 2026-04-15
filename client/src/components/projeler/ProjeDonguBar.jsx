import { useRef, useState, useCallback, useEffect } from 'react'
import useDropdownNav from '@/hooks/useDropdownNav'
import { createPortal } from 'react-dom'
import { PhotoProvider, PhotoView } from 'react-photo-view'
import 'react-photo-view/dist/react-photo-view.css'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useProjeFazIlerleme, useAdimMetaGuncelle } from '@/hooks/useDongu'
import {
  FileText, Image, File, Upload, MapPin, Zap, X, Navigation, Clock,
  CheckCircle2, ExternalLink, CalendarDays, FolderOpen, Plus, Sparkles,
  ZoomIn, ZoomOut, RotateCcw, Loader2, Trash2, Save, Layers, Eye, EyeOff,
  Crosshair, CheckCheck, Ban
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

// Direk malzeme popup — DXF'te direğe tıklanınca açılır
// ─── Varsayılan katman tanımları ───────
const VARSAYILAN_KATMANLAR = [
  { id: 'demontaj', ad: 'Demontaj', renk: '#ff6b6b', punto: 2, gorunur: true },
  { id: 'kesif',    ad: 'Keşif',    renk: '#00e5ff', punto: 2, gorunur: true },
  { id: 'metraj',   ad: 'Metraj',   renk: '#4ade80', punto: 2, gorunur: true },
]

// ─── DXF native text sprite oluşturma ───────
function _notSpriteOlustur(three, baslik, malzemeler, direkX, direkY, origin, textYukseklik, renk) {
  const satirlar = malzemeler.map(m => `${m.miktar}x ${m.adi}`)
  const textH = textYukseklik || 2
  const textColor = renk || '#00e5ff'

  const PX_PER_UNIT = 40
  const lineH = Math.round(textH * PX_PER_UNIT)
  const FONT = `${lineH}px 'Noto Sans', Arial, sans-serif`

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.font = FONT
  let maxW = 0
  for (const s of satirlar) { const w = ctx.measureText(s).width; if (w > maxW) maxW = w }

  canvas.width = Math.ceil(maxW + 4)
  canvas.height = Math.ceil(satirlar.length * lineH * 1.2 + 4)

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = textColor
  ctx.font = FONT
  satirlar.forEach((s, i) => ctx.fillText(s, 2, (i + 1) * lineH * 1.2))

  const texture = new three.CanvasTexture(canvas)
  texture.minFilter = three.LinearFilter
  texture.premultiplyAlpha = true
  const mat = new three.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false })
  const sprite = new three.Sprite(mat)

  const scaleX = canvas.width / PX_PER_UNIT
  const scaleY = canvas.height / PX_PER_UNIT
  sprite.scale.set(scaleX, scaleY, 1)

  const ox = origin?.x || 0, oy = origin?.y || 0
  sprite.position.set(direkX - ox + scaleX * 0.6 + textH, direkY - oy + scaleY * 0.3 + textH, 0.1)

  sprite.userData = { direkKey: baslik, direkX: direkX - ox, direkY: direkY - oy, maxMesafe: Math.max(scaleX, scaleY) * 3 }

  const colorInt = parseInt(textColor.replace('#', ''), 16)
  const lineGeo = new three.BufferGeometry().setFromPoints([
    new three.Vector3(direkX - ox, direkY - oy, 0.05),
    new three.Vector3(sprite.position.x, sprite.position.y, 0.05),
  ])
  const lineMat = new three.LineBasicMaterial({ color: colorInt, linewidth: 1, depthTest: false, transparent: true, opacity: 0.6 })
  const line = new three.Line(lineGeo, lineMat)
  sprite.userData.line = line

  return sprite
}

function _notCizgisiGuncelle(three, sprite) {
  const line = sprite.userData.line
  if (!line) return
  const pos = line.geometry.attributes.position
  pos.setXYZ(1, sprite.position.x, sprite.position.y, 0.05)
  pos.needsUpdate = true
  line.computeLineDistances()
}

function DirekMalzemePopup({ direk, projeId, onKapat, direkNotlari, onMalzemeGuncelle }) {
  const direkKey = [direk.numara, direk.tip].filter(Boolean).join(' ') || direk.etiket || 'Direk'
  const mevcutNot = direkNotlari?.[direkKey]
  const malzemeler = mevcutNot?.malzemeler || []

  const [arama, setArama] = useState(direk.etiket || '')
  const [sonuclar, setSonuclar] = useState([])
  const [araniyor, setAraniyor] = useState(false)
  const timer = useRef(null)
  const inputRef = useRef(null)

  const ara = (text) => {
    if (timer.current) clearTimeout(timer.current)
    if (!text || text.length < 2) { setSonuclar([]); return }
    setAraniyor(true)
    timer.current = setTimeout(async () => {
      try {
        const r = await api.get('/malzeme-katalog', { params: { arama: text } })
        setSonuclar(Array.isArray(r) ? r : (r?.data || []))
      } catch { setSonuclar([]) }
      setAraniyor(false)
    }, 300)
  }

  useEffect(() => { if (direk.etiket) ara(direk.etiket); setTimeout(() => inputRef.current?.focus(), 100) }, [])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  // Malzeme listesini güncelle → anında DXF sprite'a yansır
  const guncelleNotlar = (yeniMalzemeler) => {
    onMalzemeGuncelle?.({
      key: direkKey,
      x: mevcutNot?.x || direk.x,
      y: mevcutNot?.y || direk.y,
      yukseklik: direk.yukseklik || 2,
      malzemeler: yeniMalzemeler,
    })
  }

  const handleMalzemeEkle = useCallback((item) => {
    if (!item) return
    const yeni = { adi: item.malzeme_cinsi || item.malzeme_tanimi_sap || '', miktar: 1, malzeme_kodu: item.malzeme_kodu || '', birim: item.olcu || 'Ad' }
    guncelleNotlar([...malzemeler, yeni])
  }, [malzemeler])

  const gosterilen = sonuclar.slice(0, 10)
  const { seciliIdx, setSeciliIdx, handleKeyDown } = useDropdownNav(gosterilen, handleMalzemeEkle, onKapat)
  useEffect(() => { setSeciliIdx(-1) }, [sonuclar, setSeciliIdx])

  const handleMiktarDegistir = (idx, miktar) => {
    const yeni = malzemeler.map((m, i) => i === idx ? { ...m, miktar: Number(miktar) || 1 } : m)
    guncelleNotlar(yeni)
  }

  const handleSil = (idx) => {
    const yeni = malzemeler.filter((_, i) => i !== idx)
    guncelleNotlar(yeni)
  }

  const handleKesifEkle = async () => {
    if (!malzemeler.length) return
    try {
      await api.post(`/proje-kesif/${projeId}/toplu`, {
        kalemler: malzemeler.map(k => ({
          malzeme_kodu: k.malzeme_kodu || null,
          malzeme_adi: k.adi,
          birim: k.birim || 'Ad',
          miktar: k.miktar || 1,
          birim_fiyat: 0,
          notlar: '',
          okunan_deger: [direk.numara, direk.tip || direk.etiket, direk.sembolAdi].filter(Boolean).join(' — '),
        }))
      })
    } catch (err) { alert(err.message) }
  }

  return (
    <div className="absolute z-50 rounded-lg border border-border bg-white shadow-xl" style={{ top: 8, right: 8, width: 380, maxHeight: 480, overflow: 'auto' }}
      onMouseDown={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
      <div className="flex items-center justify-between border-b border-border px-3 py-2 bg-muted/30">
        <div className="flex items-center gap-2">
          {direk.numara && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">{direk.numara}</span>}
          <span className="text-xs font-bold">{direk.sembolAdi}</span>
          {direk.tip && <span className="text-xs text-emerald-600 font-medium">{direk.tip}</span>}
          {!direk.numara && !direk.tip && direk.etiket && <span className="text-xs text-muted-foreground">{direk.etiket}</span>}
        </div>
        <button onClick={onKapat} className="rounded p-0.5 hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
      </div>

      {/* Arama */}
      <div className="p-2 border-b border-border">
        <input ref={inputRef} value={arama} onChange={e => { setArama(e.target.value); ara(e.target.value) }}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onKapat() } else if (gosterilen.length > 0) handleKeyDown(e) }}
          placeholder="Malzeme katalogda ara..."
          className="w-full rounded border border-input bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none" />
      </div>

      {/* Arama sonuçları */}
      {(araniyor || sonuclar.length > 0) && (
        <div className="max-h-32 overflow-y-auto border-b border-border">
          {araniyor ? <div className="px-3 py-2 text-xs text-muted-foreground"><Loader2 className="inline h-3 w-3 animate-spin mr-1" />Aranıyor...</div> : (
            gosterilen.map((item, i) => (
              <button key={item.id} onClick={() => handleMalzemeEkle(item)}
                className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs border-b border-border/30 transition-colors', i === seciliIdx ? 'bg-primary/10' : 'hover:bg-primary/5')}>
                <span className="font-mono text-blue-600 w-20 shrink-0">{item.malzeme_kodu || '-'}</span>
                <span className="flex-1 truncate">{item.malzeme_cinsi || item.malzeme_tanimi_sap || '-'}</span>
                <Plus className="h-3 w-3 text-emerald-500 shrink-0" />
              </button>
            ))
          )}
        </div>
      )}

      {/* Direk malzeme listesi — DXF ile senkron */}
      <div className="p-2">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">
          Direk Malzeme Listesi {malzemeler.length > 0 && `(${malzemeler.length})`}
        </div>
        {malzemeler.length === 0 ? (
          <p className="text-[10px] text-muted-foreground/60 py-2 text-center">Yukarıdan malzeme arayıp ekleyin</p>
        ) : (
          <>
            {malzemeler.map((m, i) => (
              <div key={i} className="flex items-center gap-1.5 py-1 border-b border-border/30">
                <span className="flex-1 text-xs truncate" title={m.adi}>{m.adi}</span>
                <input type="number" value={m.miktar} onChange={e => handleMiktarDegistir(i, e.target.value)} min="1"
                  className="w-12 rounded border border-input px-1 py-0.5 text-center text-xs" />
                <span className="text-[10px] text-muted-foreground w-5">{m.birim || 'Ad'}</span>
                <button onClick={() => handleSil(i)} className="text-red-400 hover:text-red-600 p-0.5">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button onClick={handleKesifEkle}
              className="mt-2 w-full rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
              Keşife Ekle ({malzemeler.length})
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// DXF Viewer — fontlar: NotoSans (text) + B_CAD (semboller) — stil bazlı seçim otomatik
const DXF_FONTS = ['/fonts/NotoSans.ttf', '/fonts/B_CAD.ttf', '/fonts/T_ROMANS.ttf']

function DxfOnizleme({ src, dosyaId, projeId, onDirekTikla, direkNotlari, onNotSil, overlayUrl }) {
  const qc = useQueryClient()
  const containerRef = useRef(null)
  const viewerRef = useRef(null)
  const rendererRef = useRef(null)
  const direklerRef = useRef([])
  const threeRef = useRef(null)
  // Overlay refs (demontaj krokisi modu)
  const mevcutGroupRef = useRef(null)
  const yeniGroupRef = useRef(null)
  const [overlayKatmanlar, setOverlayKatmanlar] = useState([])
  const spritelerRef = useRef({}) // { key: sprite }
  const spriteKonumRef = useRef({}) // { key: { x, y } } — sürüklenen konumlar
  const dragRef = useRef(null) // { sprite, startPos, startMouse }
  const onDirekTiklaRef = useRef(onDirekTikla)
  onDirekTiklaRef.current = onDirekTikla
  const [yukleniyor, setYukleniyor] = useState(true)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [hata, setHata] = useState('')
  const [ilerleme, setIlerleme] = useState('')
  const [katmanlar, setKatmanlar] = useState(() => VARSAYILAN_KATMANLAR.map(k => ({ ...k })))
  const [katmanPanelAcik, setKatmanPanelAcik] = useState(false)
  const katmanlarRef = useRef(katmanlar)
  katmanlarRef.current = katmanlar
  // ── Demontaj seçim modu ──
  const [secimModu, setSecimModu] = useState(false)
  const [secimRect, setSecimRect] = useState(null) // { x1,y1,x2,y2 } piksel
  const secimStartRef = useRef(null)
  const [seciliNesneler, setSeciliNesneler] = useState([]) // Three.js objeleri
  const orijinalMatRef = useRef(new Map()) // obj → orijinal materyal
  const demontajGroupRef = useRef(null)

  const handleMetrajKaydet = async () => {
    if (!direkNotlari || !Object.keys(direkNotlari).length) return alert('Henüz direk malzemesi eklenmemiş')
    if (!projeId || !dosyaId) return
    setKaydediliyor(true)
    try {
      const viewer = viewerRef.current
      const origin = viewer?.origin || { x: 0, y: 0 }
      // Sprite'ların güncel pozisyonlarından notları topla
      const notlar = Object.entries(direkNotlari).map(([key, not]) => {
        const sprite = spritelerRef.current[key]
        const sx = sprite ? sprite.position.x + origin.x : not.x
        const sy = sprite ? sprite.position.y + origin.y : not.y
        return {
          x: sx,
          y: sy,
          yukseklik: not.yukseklik || 2,
          satirlar: not.malzemeler.map(m => `${m.miktar}x ${m.adi}`),
        }
      })
      const r = await api.post(`/dosya/${dosyaId}/dxf-metraj-kaydet`, { proje_id: projeId, notlar })
      const data = r?.data || r
      // Yaşam döngüsü ve dosya listelerini yenile
      qc.invalidateQueries({ queryKey: ['faz-ilerleme'] })
      qc.invalidateQueries({ queryKey: ['adim-dosyalar'] })
      onNotSil?.('__ALL__') // Tüm sprite'ları temizle
      alert('Metraj.dxf Hakediş > Metraj adımına kaydedildi.')
    } catch (err) { alert(err.message || 'Metraj kaydetme hatası') }
    finally { setKaydediliyor(false) }
  }

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
        window.__three = three
        threeRef.current = three

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
          clearColor: new three.Color('#000000'),
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
        await viewer.Load({
          url,
          fonts: DXF_FONTS,
          progressCbk: (phase, processed, total) => {
            if (phase === 'font') setIlerleme(`Font yükleniyor... (${processed}/${total})`)
            else if (phase === 'fetch') setIlerleme('Dosya alınıyor...')
            else if (phase === 'parse') setIlerleme(`Parse ediliyor... ${total ? Math.round(processed/total*100) + '%' : ''}`)
            else if (phase === 'prepare') setIlerleme('Sahne hazırlanıyor...')
          }
        })
        URL.revokeObjectURL(url)

        // Tüm sahneye fit et
        if (viewer.bounds && viewer.origin) {
          const b = viewer.bounds, o = viewer.origin
          viewer.FitView(b.minX - o.x, b.maxX - o.x, b.minY - o.y, b.maxY - o.y)
        }

        // ── Overlay modu: ikinci DXF'i yükle (demontaj krokisi) ──
        if (overlayUrl && !cancelled) {
          try {
            setIlerleme('Overlay DXF yukleniyor...')
            const scene = viewer.GetScene?.() || viewer.scene
            if (scene) {
              // Ana DXF nesnelerini "mevcut_durum" grubuna al ve renklendir
              const mevcutGroup = new three.Group()
              mevcutGroup.name = 'mevcut_durum'
              ;[...scene.children].filter(c => !c.isLight).forEach(c => mevcutGroup.add(c))
              // Güvenli renklendirme
              mevcutGroup.traverse(obj => {
                if (!obj.material || obj.isLight) return
                try {
                  const apply = m => { const c = m.clone(); if (c.color?.set) c.color.set(0xf87171); return c }
                  obj.material = Array.isArray(obj.material) ? obj.material.map(apply) : apply(obj.material)
                } catch {}
              })
              scene.add(mevcutGroup)
              mevcutGroupRef.current = mevcutGroup

              // Gizli viewer'da overlay DXF'i yükle
              const hiddenDiv = document.createElement('div')
              hiddenDiv.style.cssText = 'position:fixed;top:0;left:-9999px;width:800px;height:600px;pointer-events:none;overflow:hidden'
              document.body.appendChild(hiddenDiv)
              const hiddenRenderer = new three.WebGLRenderer({ antialias: false })
              hiddenRenderer.setSize(800, 600)
              hiddenDiv.appendChild(hiddenRenderer.domElement)
              const { DxfViewer: DxfViewerClass } = await import('dxf-viewer')
              const hiddenViewer = new DxfViewerClass(hiddenDiv, {
                clearColor: new three.Color('#000'), autoResize: false, renderer: hiddenRenderer,
              })
              const overlayResponse = await fetch(overlayUrl)
              const overlayBlob = await overlayResponse.blob()
              const overlayBlobUrl = URL.createObjectURL(overlayBlob)
              await hiddenViewer.Load({ url: overlayBlobUrl, fonts: DXF_FONTS,
                progressCbk: (phase) => { if (phase === 'parse') setIlerleme('Overlay parse ediliyor...') }
              })
              URL.revokeObjectURL(overlayBlobUrl)

              // Klonla ve yeşile boya
              const hiddenScene = hiddenViewer.GetScene?.() || hiddenViewer.scene
              const yeniGroup = new three.Group()
              yeniGroup.name = 'yeni_durum'
              if (hiddenScene) {
                ;[...hiddenScene.children].filter(c => !c.isLight).forEach(child => {
                  try { yeniGroup.add(child.clone(true)) } catch {}
                })
              }
              yeniGroup.traverse(obj => {
                if (!obj.material || obj.isLight) return
                try {
                  const apply = m => { const c = m.clone(); if (c.color?.set) c.color.set(0x4ade80); return c }
                  obj.material = Array.isArray(obj.material) ? obj.material.map(apply) : apply(obj.material)
                } catch {}
              })
              scene.add(yeniGroup)
              yeniGroupRef.current = yeniGroup

              // Temizle
              try { hiddenViewer.Clear() } catch {}
              try { hiddenRenderer.dispose() } catch {}
              try { document.body.removeChild(hiddenDiv) } catch {}

              // Overlay katmanlarını ayarla
              setOverlayKatmanlar([
                { id: 'mevcut_durum', ad: 'Mevcut Durum', renk: '#f87171', gorunur: true },
                { id: 'yeni_durum', ad: 'Yeni Durum', renk: '#4ade80', gorunur: true },
              ])
              viewer.Render()
            }
          } catch (overlayErr) {
            console.warn('[DXF] Overlay yükleme hatası:', overlayErr.message)
          }
        }

        // Direk listesini yükle ve tıklama event'i ekle
        if (dosyaId) {
          try {
            const elemanRes = await api.get(`/dosya/${dosyaId}/dxf-elemanlar`)
            const elemanData = elemanRes?.data || elemanRes
            direklerRef.current = elemanData?.elemanlar || []
          } catch {}

          viewer.Subscribe('pointerup', (evt) => {
            const e = evt.detail || evt
            if (!direklerRef.current.length || !e.position) return
            const px = e.position.x + (viewer.origin?.x || 0)
            const py = e.position.y + (viewer.origin?.y || 0)
            // En yakın direği bul
            let enYakin = null, enYakinMesafe = Infinity
            for (const d of direklerRef.current) {
              const dx = d.x - px, dy = d.y - py
              const mesafe = Math.sqrt(dx*dx + dy*dy)
              if (mesafe < enYakinMesafe) { enYakinMesafe = mesafe; enYakin = d }
            }
            // 15 birim yakınlık eşiği
            if (enYakin && enYakinMesafe < 15) {
              const domEvt = e.domEvent || evt
              onDirekTiklaRef.current?.({
                ...enYakin,
                mesafe: enYakinMesafe,
              })
            }
          })
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
  }, [src, overlayUrl])

  // Bileşen unmount olduğunda renderer'ı temizle
  useEffect(() => {
    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose()
        rendererRef.current = null
      }
    }
  }, [])

  // Overlay katman görünürlük kontrolü
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !overlayUrl || yukleniyor || !overlayKatmanlar.length) return
    const m = mevcutGroupRef.current, y = yeniGroupRef.current, d = demontajGroupRef.current
    if (m) m.visible = overlayKatmanlar.find(k => k.id === 'mevcut_durum')?.gorunur ?? true
    if (y) y.visible = overlayKatmanlar.find(k => k.id === 'yeni_durum')?.gorunur ?? true
    if (d) d.visible = overlayKatmanlar.find(k => k.id === 'demontaj')?.gorunur ?? true
    viewer.Render()
  }, [overlayKatmanlar, overlayUrl, yukleniyor])

  // ── Demontaj seçim — overlay div handler'ları ──
  const secimOverlayRef = useRef(null)

  const handleSecimDown = useCallback((e) => {
    if (e.button !== 0) return
    e.stopPropagation(); e.preventDefault()
    const el = secimOverlayRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    secimStartRef.current = { x: e.clientX - r.left, y: e.clientY - r.top }
    setSecimRect(null)
  }, [])

  const handleSecimMove = useCallback((e) => {
    if (!secimStartRef.current) return
    e.stopPropagation(); e.preventDefault()
    const el = secimOverlayRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const cx = e.clientX - r.left, cy = e.clientY - r.top
    const sx = secimStartRef.current.x, sy = secimStartRef.current.y
    setSecimRect({ x1: Math.min(sx, cx), y1: Math.min(sy, cy), x2: Math.max(sx, cx), y2: Math.max(sy, cy) })
  }, [])

  const handleSecimUp = useCallback((e) => {
    if (!secimStartRef.current) return
    e.stopPropagation(); e.preventDefault()
    const three = threeRef.current, viewer = viewerRef.current
    const el = secimOverlayRef.current
    if (!three || !viewer || !el) return

    const r = el.getBoundingClientRect()
    const cx = e.clientX - r.left, cy = e.clientY - r.top
    const sx = secimStartRef.current.x, sy = secimStartRef.current.y
    const isDrag = Math.abs(cx - sx) > 5 || Math.abs(cy - sy) > 5
    secimStartRef.current = null
    setSecimRect(null)

    // mevcutGroup ve yeniGroup'taki tüm mesh/line nesnelerini topla
    const allObjects = []
    const collectObjects = (group) => {
      if (!group) return
      group.traverse(obj => { if (obj.geometry && obj !== group) allObjects.push(obj) })
    }
    collectObjects(mevcutGroupRef.current)
    // yeniGroup'tan da seçilebilir
    collectObjects(yeniGroupRef.current)

    if (allObjects.length === 0) {
      console.warn('[Secim] Sahnede secilecek nesne bulunamadi')
      return
    }

    const camera = viewer.GetCamera()
    const raycaster = new three.Raycaster()
    const mouse = new three.Vector2()
    const yeniSecim = new Set(seciliNesneler)

    // NDC dönüşümü
    const toNdcX = (px) => (px / r.width) * 2 - 1
    const toNdcY = (py) => -(py / r.height) * 2 + 1

    if (isDrag) {
      // Dikdörtgen seçim: seçim alanı içinde ızgara noktalarından ray cast et
      const steps = 8 // 8x8 ızgara
      const minPx = Math.min(sx, cx), maxPx = Math.max(sx, cx)
      const minPy = Math.min(sy, cy), maxPy = Math.max(sy, cy)
      for (let xi = 0; xi <= steps; xi++) {
        for (let yi = 0; yi <= steps; yi++) {
          const px = minPx + (maxPx - minPx) * (xi / steps)
          const py = minPy + (maxPy - minPy) * (yi / steps)
          mouse.set(toNdcX(px), toNdcY(py))
          raycaster.setFromCamera(mouse, camera)
          const hits = raycaster.intersectObjects(allObjects, false)
          for (const hit of hits) yeniSecim.add(hit.object)
        }
      }
    } else {
      // Tek tıklama: tıklama noktasından ray cast
      mouse.set(toNdcX(cx), toNdcY(cy))
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(allObjects, false)
      for (const hit of hits) yeniSecim.add(hit.object)
    }

    if (yeniSecim.size !== seciliNesneler.length || [...yeniSecim].some(o => !seciliNesneler.includes(o))) {
      setSeciliNesneler([...yeniSecim])
    }
  }, [seciliNesneler])

  // ── Seçili nesneleri vurgula: seçilenleri parlak yap, diğerlerini soldur ──
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    const seciliSet = new Set(seciliNesneler)
    const hasSelection = seciliSet.size > 0

    // Her iki gruptaki tüm nesnelere uygula
    const groups = [mevcutGroupRef.current, yeniGroupRef.current].filter(Boolean)
    for (const grp of groups) {
      grp.traverse(obj => {
        if (!obj.material || obj === grp) return
        try {
          // Orijinal değerleri kaydet (ilk kez)
          if (!orijinalMatRef.current.has(obj)) {
            orijinalMatRef.current.set(obj, {
              opacity: Array.isArray(obj.material) ? obj.material.map(m => m.opacity) : obj.material.opacity,
              transparent: Array.isArray(obj.material) ? obj.material.map(m => m.transparent) : obj.material.transparent,
            })
          }
          if (hasSelection) {
            const isSelected = seciliSet.has(obj)
            const opacity = isSelected ? 1 : 0.06
            if (Array.isArray(obj.material)) {
              obj.material.forEach(m => { m.transparent = true; m.opacity = opacity; m.needsUpdate = true })
            } else {
              obj.material.transparent = true
              obj.material.opacity = opacity
              obj.material.needsUpdate = true
            }
          } else {
            // Orijinale döndür
            const orig = orijinalMatRef.current.get(obj)
            if (orig) {
              if (Array.isArray(obj.material)) {
                obj.material.forEach((m, i) => { m.opacity = orig.opacity[i] ?? 1; m.transparent = orig.transparent[i] ?? false; m.needsUpdate = true })
              } else {
                obj.material.opacity = orig.opacity ?? 1
                obj.material.transparent = orig.transparent ?? false
                obj.material.needsUpdate = true
              }
            }
          }
        } catch {}
      })
    }
    viewer.Render()
  }, [seciliNesneler])

  // ── Demontaj seçimi onayla ──
  const handleSecimOnayla = useCallback(() => {
    const viewer = viewerRef.current, three = threeRef.current
    const scene = viewer?.GetScene?.() || viewer?.scene
    if (!viewer || !three || !scene || !seciliNesneler.length) return

    // Demontaj grubu oluştur (yoksa)
    let dGroup = demontajGroupRef.current
    if (!dGroup) {
      dGroup = new three.Group()
      dGroup.name = 'demontaj'
      scene.add(dGroup)
      demontajGroupRef.current = dGroup
      setOverlayKatmanlar(prev => {
        if (prev.find(k => k.id === 'demontaj')) return prev
        return [...prev, { id: 'demontaj', ad: 'Demontaj', renk: '#facc15', gorunur: true }]
      })
    }

    // Orijinal opacity'leri geri yükle + demontaj grubuna taşı + demontaj rengi uygula
    for (const obj of seciliNesneler) {
      // Opacity'yi normale döndür
      const orig = orijinalMatRef.current.get(obj)
      if (orig) {
        try {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m, i) => { m.opacity = orig.opacity[i] ?? 1; m.transparent = orig.transparent[i] ?? false })
          } else {
            obj.material.opacity = orig.opacity ?? 1; obj.material.transparent = orig.transparent ?? false
          }
        } catch {}
      }
      orijinalMatRef.current.delete(obj)
      // Demontaj grubuna taşı
      dGroup.add(obj)
      // Demontaj rengi uygula
      try {
        const apply = m => { const c = m.clone(); if (c.color?.set) c.color.set(0xfacc15); return c }
        obj.material = Array.isArray(obj.material) ? obj.material.map(apply) : apply(obj.material)
      } catch {}
    }

    orijinalMatRef.current.clear()
    setSeciliNesneler([])
    setSecimModu(false)
    viewer.Render()
  }, [seciliNesneler])

  // ── Demontaj seçimi iptal ──
  const handleSecimIptal = useCallback(() => {
    // seciliNesneler'i temizle → effect orijinal opacity'leri geri yükler
    setSeciliNesneler([])
    setSecimModu(false)
  }, [])

  // direkNotlari veya katman ayarları değiştiğinde sprite'ları senkronize et
  useEffect(() => {
    const viewer = viewerRef.current
    const three = threeRef.current
    if (!viewer || !three || yukleniyor) return
    const scene = viewer.GetScene?.() || viewer.scene
    if (!scene) return

    const mevcutKeyler = new Set(Object.keys(direkNotlari || {}))
    // Silinmesi gereken sprite'lar
    for (const [key, sprite] of Object.entries(spritelerRef.current)) {
      if (!mevcutKeyler.has(key)) {
        scene.remove(sprite)
        if (sprite.userData.line) scene.remove(sprite.userData.line)
        sprite.material.map?.dispose()
        sprite.material.dispose()
        delete spritelerRef.current[key]
        delete spriteKonumRef.current[key]
      }
    }
    // Eklenmesi / güncellenmesi gereken sprite'lar
    for (const [key, not] of Object.entries(direkNotlari || {})) {
      if (!not.malzemeler?.length) continue
      const katman = katmanlar.find(k => k.id === (not.katman || 'kesif')) || katmanlar[1]
      // Varsa konumunu kaydet, kaldır ve yeniden oluştur
      const eski = spritelerRef.current[key]
      if (eski) {
        spriteKonumRef.current[key] = { x: eski.position.x, y: eski.position.y }
        scene.remove(eski)
        if (eski.userData.line) scene.remove(eski.userData.line)
        eski.material.map?.dispose()
        eski.material.dispose()
      }
      const sprite = _notSpriteOlustur(three, key, not.malzemeler, not.x, not.y, viewer.origin, katman.punto, katman.renk)
      sprite.userData.katman = katman.id
      // Katman görünürlüğü
      sprite.visible = katman.gorunur
      if (sprite.userData.line) sprite.userData.line.visible = katman.gorunur
      // Kaydedilmiş konum varsa geri yükle
      const kayitliKonum = spriteKonumRef.current[key]
      if (kayitliKonum) {
        sprite.position.set(kayitliKonum.x, kayitliKonum.y, sprite.position.z)
        _notCizgisiGuncelle(three, sprite)
      }
      scene.add(sprite)
      if (sprite.userData.line) scene.add(sprite.userData.line)
      spritelerRef.current[key] = sprite
    }
    viewer.Render()
  }, [direkNotlari, katmanlar, yukleniyor])

  // Sprite sürükleme (drag) - mouse event'leri
  useEffect(() => {
    const container = containerRef.current
    const three = threeRef.current
    if (!container || !three) return

    const raycaster = new three.Raycaster()
    const mouse = new three.Vector2()

    const getSprites = () => Object.values(spritelerRef.current)

    const onPointerDown = (e) => {
      const viewer = viewerRef.current
      if (!viewer || !getSprites().length) return
      const rect = container.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, viewer.GetCamera())
      const hits = raycaster.intersectObjects(getSprites())
      if (hits.length > 0) {
        const sprite = hits[0].object
        dragRef.current = { sprite, startPos: sprite.position.clone(), startMouse: { x: e.clientX, y: e.clientY } }
        e.stopPropagation()
        e.preventDefault()
      }
    }

    const onPointerMove = (e) => {
      if (!dragRef.current) return
      const viewer = viewerRef.current
      if (!viewer) return
      const { sprite, startPos, startMouse } = dragRef.current
      const cam = viewer.GetCamera()
      // Ekran piksel farkını world birimine çevir
      const rect = container.getBoundingClientRect()
      const pxToWorld = (cam.right - cam.left) / cam.zoom / rect.width
      const dx = (e.clientX - startMouse.x) * pxToWorld
      const dy = -(e.clientY - startMouse.y) * pxToWorld
      let nx = startPos.x + dx, ny = startPos.y + dy
      // Mesafe sınırı
      const dxD = nx - sprite.userData.direkX, dyD = ny - sprite.userData.direkY
      const dist = Math.sqrt(dxD * dxD + dyD * dyD)
      const maxM = sprite.userData.maxMesafe || 50
      if (dist > maxM) { nx = sprite.userData.direkX + dxD / dist * maxM; ny = sprite.userData.direkY + dyD / dist * maxM }
      sprite.position.set(nx, ny, sprite.position.z)
      _notCizgisiGuncelle(three, sprite)
      viewer.Render()
      e.stopPropagation()
      e.preventDefault()
    }

    const onPointerUp = () => { dragRef.current = null }

    container.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      container.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [yukleniyor])

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
        <>
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
          {/* Katmanlar */}
          <button onClick={() => setKatmanPanelAcik(p => !p)}
            className={cn('flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium shadow-sm border', katmanPanelAcik ? 'bg-primary/10 border-primary text-primary' : 'bg-white/90 border-border hover:bg-muted')}
            title="Katmanlar">
            <Layers className="h-3.5 w-3.5" /> Katmanlar
          </button>
          {/* Demontaj Seç butonu — overlay modunda */}
          {overlayUrl && !secimModu && (
            <button onClick={() => setSecimModu(true)}
              className="flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-amber-600"
              title="Dikdörtgen ile demontaj elemanlarını seç">
              <Crosshair className="h-3.5 w-3.5" /> Demontaj Seç
            </button>
          )}
          {direkNotlari && Object.keys(direkNotlari).length > 0 && (
            <button
              onClick={handleMetrajKaydet}
              disabled={kaydediliyor}
              className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              title="Malzeme notlarıyla birlikte DXF'i Hakediş > Metraj adımına kaydet"
            >
              {kaydediliyor ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Metraj'a Kaydet
            </button>
          )}
        </div>
        {/* Katman Paneli */}
        {katmanPanelAcik && (
          <div className="absolute top-10 right-2 z-20 w-56 rounded-lg border border-border bg-white/95 shadow-lg backdrop-blur-sm" onClick={e => e.stopPropagation()}>
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Katmanlar</span>
              <button onClick={() => setKatmanPanelAcik(false)} className="p-0.5 rounded hover:bg-muted"><X className="h-3 w-3" /></button>
            </div>
            <div className="p-2 space-y-2">
              {/* Overlay katmanları (demontaj krokisi modu) */}
              {overlayKatmanlar.length > 0 && (
                <>
                  {overlayKatmanlar.map(k => (
                    <div key={k.id} className="flex items-center gap-2">
                      <button onClick={() => setOverlayKatmanlar(prev => prev.map(p => p.id === k.id ? { ...p, gorunur: !p.gorunur } : p))}
                        className={cn('p-0.5 rounded', k.gorunur ? 'text-foreground' : 'text-muted-foreground/40')}>
                        {k.gorunur ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      <div className="w-4 h-4 rounded-sm border border-border/50 shrink-0 relative overflow-hidden">
                        <input type="color" value={k.renk}
                          onChange={e => {
                            const hex = parseInt(e.target.value.replace('#', ''), 16)
                            setOverlayKatmanlar(prev => prev.map(p => p.id === k.id ? { ...p, renk: e.target.value } : p))
                            const grp = k.id === 'mevcut_durum' ? mevcutGroupRef.current : k.id === 'yeni_durum' ? yeniGroupRef.current : demontajGroupRef.current
                            if (grp) {
                              grp.traverse(obj => {
                                if (!obj.material || obj.isLight) return
                                try { if (Array.isArray(obj.material)) obj.material.forEach(m => { if (m.color?.set) m.color.set(hex) }); else if (obj.material.color?.set) obj.material.color.set(hex) } catch {}
                              })
                              viewerRef.current?.Render()
                            }
                          }}
                          className="absolute inset-0 w-8 h-8 -top-1 -left-1 cursor-pointer border-0" />
                      </div>
                      <span className={cn('text-xs font-medium flex-1', !k.gorunur && 'text-muted-foreground/50 line-through')}>{k.ad}</span>
                    </div>
                  ))}
                  <div className="border-t border-border my-1" />
                </>
              )}
              {/* Sprite katmanları (keşif/demontaj/metraj) */}
              {katmanlar.map(k => (
                <div key={k.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setKatmanlar(prev => prev.map(p => p.id === k.id ? { ...p, gorunur: !p.gorunur } : p))}
                      className={cn('p-0.5 rounded', k.gorunur ? 'text-foreground' : 'text-muted-foreground/40')} title={k.gorunur ? 'Gizle' : 'Göster'}>
                      {k.gorunur ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <div className="w-4 h-4 rounded-sm border border-border/50 shrink-0 relative overflow-hidden">
                      <input type="color" value={k.renk}
                        onChange={e => setKatmanlar(prev => prev.map(p => p.id === k.id ? { ...p, renk: e.target.value } : p))}
                        className="absolute inset-0 w-8 h-8 -top-1 -left-1 cursor-pointer border-0" />
                    </div>
                    <span className={cn('text-xs font-medium flex-1', !k.gorunur && 'text-muted-foreground/50 line-through')}>{k.ad}</span>
                  </div>
                  <div className="flex items-center gap-1.5 ml-6">
                    <span className="text-[10px] text-muted-foreground w-8">Punto</span>
                    <input type="range" min="0.5" max="5" step="0.5" value={k.punto}
                      onChange={e => setKatmanlar(prev => prev.map(p => p.id === k.id ? { ...p, punto: parseFloat(e.target.value) } : p))}
                      className="flex-1 h-1 accent-primary" />
                    <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{k.punto}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </>
      )}
      {/* Seçim modu: şeffaf overlay div — DxfViewer event'lerini bloklar */}
      {secimModu && (
        <div
          ref={secimOverlayRef}
          onPointerDown={handleSecimDown}
          onPointerMove={handleSecimMove}
          onPointerUp={handleSecimUp}
          style={{ position: 'absolute', inset: 0, zIndex: 12, cursor: 'crosshair', touchAction: 'none' }}
        />
      )}
      {/* Seçim dikdörtgeni */}
      {secimModu && secimRect && (
        <div style={{
          position: 'absolute', pointerEvents: 'none', zIndex: 13,
          left: secimRect.x1, top: secimRect.y1,
          width: secimRect.x2 - secimRect.x1, height: secimRect.y2 - secimRect.y1,
          border: '2px dashed #facc15', background: 'rgba(250,204,21,0.15)', borderRadius: 2,
        }} />
      )}
      {/* Seçim modu bilgi paneli */}
      {secimModu && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-15 flex items-center gap-2 rounded-lg bg-gray-900/90 px-4 py-2 shadow-lg backdrop-blur-sm">
          <Crosshair className="h-4 w-4 text-amber-400" />
          <span className="text-xs text-white font-medium">
            {seciliNesneler.length > 0
              ? `${seciliNesneler.length} eleman secildi`
              : 'Dortgen cizerek veya tiklayarak secin'}
          </span>
          {seciliNesneler.length > 0 && (
            <>
              <button onClick={handleSecimOnayla} className="flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700">
                <CheckCheck className="h-3.5 w-3.5" /> Onayla
              </button>
              <button onClick={() => { setSeciliNesneler([]); viewerRef.current?.Render() }}
                className="rounded bg-gray-700 px-2.5 py-1 text-[11px] text-gray-300 hover:bg-gray-600">
                Temizle
              </button>
            </>
          )}
          <button onClick={handleSecimIptal} className="flex items-center gap-1 rounded bg-red-600/80 px-2.5 py-1 text-[11px] text-white hover:bg-red-600">
            <Ban className="h-3.5 w-3.5" /> Kapat
          </button>
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
                onDosyaSec?.({ id: dosya.id, adi, adimAdi: adim.adim_adi, adimKodu: adim.adim_kodu, gorsel, xls: xlsMi(adi), dxf: ext === 'dxf' || ext === 'dwg' })
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
  const [seciliDosya, setSeciliDosya] = useState(null) // { id, adi, adimAdi, overlayId? }
  const [seciliDirek, setSeciliDirek] = useState(null)
  const [direkNotlari, setDirekNotlari] = useState({})
  useEffect(() => { setDirekNotlari({}); setSeciliDirek(null) }, [seciliDosya?.id])
  const dragState = useRef({ startX: 0, scrollLeft: 0 })

  // Demontaj Krokisi — mevcut/yeni durum DXF dosya bilgilerini al
  const { data: demontajKrokiData } = useQuery({
    queryKey: ['demontaj-kroki-dosyalar', projeId],
    queryFn: () => api.get(`/dosya/proje/${projeId}/demontaj-kroki`),
    select: (res) => res.data || res,
    enabled: !!projeId,
  })
  const demontajHazir = demontajKrokiData?.mevcutDurum?.id && demontajKrokiData?.yeniDurum?.id

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

      {/* ─── Demontaj Krokisi Butonu ─── */}
      {demontajHazir && (
        <div className="border-t border-border px-5 py-2 flex items-center justify-between bg-gradient-to-r from-red-50/50 to-green-50/50">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-amber-600" />
            <span className="text-xs font-semibold text-foreground">Demontaj Krokisi</span>
            <span className="text-[10px] text-muted-foreground">— Mevcut / Yeni Durum karşılaştırma</span>
          </div>
          <button
            onClick={() => setSeciliDosya({
              id: demontajKrokiData.mevcutDurum.id,
              adi: 'Demontaj Krokisi',
              adimAdi: 'Demontaj Krokisi',
              adimKodu: 'demontaj_kroki',
              dxf: true,
              overlayId: demontajKrokiData.yeniDurum.id,
            })}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              seciliDosya?.adimKodu === 'demontaj_kroki'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {seciliDosya?.adimKodu === 'demontaj_kroki' ? 'Görüntüleniyor' : 'Görüntüle'}
          </button>
        </div>
      )}

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
              <div className="relative">
                <DxfOnizleme
                  src={`/api/dosya/${seciliDosya.id}/dosya`}
                  dosyaId={seciliDosya.id}
                  projeId={projeId}
                  overlayUrl={seciliDosya.overlayId ? `/api/dosya/${seciliDosya.overlayId}/dosya` : null}
                  onDirekTikla={seciliDosya.adimKodu === 'kesif' ? (d) => { if (!seciliDirek) setSeciliDirek(d) } : undefined}
                  direkNotlari={seciliDosya.adimKodu === 'kesif' ? direkNotlari : undefined}
                  onNotSil={seciliDosya.adimKodu === 'kesif' ? (key) => key === '__ALL__' ? setDirekNotlari({}) : setDirekNotlari(prev => { const y = { ...prev }; delete y[key]; return y }) : undefined}
                />
                {/* Direk popup — sadece Keşif adımında */}
                {seciliDosya.adimKodu === 'kesif' && seciliDirek && (
                  <DirekMalzemePopup
                    direk={seciliDirek}
                    projeId={projeId}
                    onKapat={() => setSeciliDirek(null)}
                    direkNotlari={direkNotlari}
                    onMalzemeGuncelle={(not) => setDirekNotlari(prev => ({
                      ...prev,
                      [not.key]: {
                        x: not.x,
                        y: not.y,
                        yukseklik: not.yukseklik,
                        katman: prev[not.key]?.katman || 'kesif',
                        malzemeler: not.malzemeler,
                      }
                    }))}
                  />
                )}
              </div>
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
