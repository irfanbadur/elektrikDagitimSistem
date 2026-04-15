import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Layers, Eye, EyeOff, Loader2, ZoomIn, ZoomOut, RotateCcw,
  X, AlertTriangle, Crosshair, FileText,
} from 'lucide-react'
import api from '@/api/client'
import { cn } from '@/lib/utils'

const DXF_FONTS = ['/fonts/NotoSans.ttf', '/fonts/B_CAD.ttf', '/fonts/T_ROMANS.ttf']

// ── Three.js'te entity → line noktaları ──
function _entityToPoints(three, entity, origin) {
  const ox = origin?.x || 0, oy = origin?.y || 0
  const pts = []

  switch (entity.type) {
    case 'LINE':
      pts.push(new three.Vector3((entity.x1 || 0) - ox, (entity.y1 || 0) - oy, 0))
      pts.push(new three.Vector3((entity.x2 || 0) - ox, (entity.y2 || 0) - oy, 0))
      break
    case 'CIRCLE': {
      const cx = (entity.cx || 0) - ox, cy = (entity.cy || 0) - oy, r = entity.r || 1
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2
        pts.push(new three.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0))
      }
      break
    }
    case 'ARC': {
      const cx = (entity.cx || 0) - ox, cy = (entity.cy || 0) - oy, r = entity.r || 1
      const s = ((entity.startAngle || 0) * Math.PI) / 180
      let e = ((entity.endAngle || 360) * Math.PI) / 180
      if (e <= s) e += Math.PI * 2
      const segs = Math.max(12, Math.round(((e - s) / (Math.PI * 2)) * 48))
      for (let i = 0; i <= segs; i++) {
        const a = s + ((e - s) * i) / segs
        pts.push(new three.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0))
      }
      break
    }
    case 'LWPOLYLINE':
    case 'POLYLINE':
      if (entity.vertices?.length) {
        for (const v of entity.vertices) {
          pts.push(new three.Vector3((v.x || 0) - ox, (v.y || 0) - oy, 0))
        }
      }
      break
  }
  return pts
}

// ── INSERT/TEXT/POINT → daire + artı işareti marker ──
function _markerLines(three, x, y, origin, r) {
  const ox = origin?.x || 0, oy = origin?.y || 0
  const cx = x - ox, cy = y - oy
  const segments = []
  // Daire
  const circlePts = []
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2
    circlePts.push(new three.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0))
  }
  segments.push(circlePts)
  // Artı (+) işareti
  segments.push([
    new three.Vector3(cx - r * 0.6, cy, 0),
    new three.Vector3(cx + r * 0.6, cy, 0),
  ])
  segments.push([
    new three.Vector3(cx, cy - r * 0.6, 0),
    new three.Vector3(cx, cy + r * 0.6, 0),
  ])
  return segments
}

// ── Entity listesini Three.js nesnelerine dönüştür (çizgi + marker) ──
function _buildEntityGroup(three, entities, origin, color) {
  const group = new three.Group()
  const lineMat = new three.LineBasicMaterial({ color })
  // INSERT/TEXT marker boyutu — çizim birimlerinde
  const MARKER_R = 3

  for (const ent of entities) {
    // INSERT — blok referansı (direkler, ekipman semboleri)
    if (ent.type === 'INSERT' && ent.x != null && ent.y != null) {
      const segs = _markerLines(three, ent.x, ent.y, origin, MARKER_R)
      for (const pts of segs) {
        const geo = new three.BufferGeometry().setFromPoints(pts)
        const line = new three.Line(geo, lineMat)
        line.userData = { entity: ent }
        group.add(line)
      }
      continue
    }

    // TEXT/MTEXT — direk stili olanlar marker, diğerleri küçük nokta
    if ((ent.type === 'TEXT' || ent.type === 'MTEXT') && ent.x != null && ent.y != null) {
      const isDirek = (ent.style || '').toLowerCase() === 'direk'
      const r = isDirek ? MARKER_R : MARKER_R * 0.5
      const segs = _markerLines(three, ent.x, ent.y, origin, r)
      for (const pts of segs) {
        const geo = new three.BufferGeometry().setFromPoints(pts)
        const line = new three.Line(geo, lineMat)
        line.userData = { entity: ent }
        group.add(line)
      }
      continue
    }

    // POINT — küçük marker
    if (ent.type === 'POINT' && ent.x != null && ent.y != null) {
      const segs = _markerLines(three, ent.x, ent.y, origin, MARKER_R * 0.4)
      for (const pts of segs) {
        const geo = new three.BufferGeometry().setFromPoints(pts)
        const line = new three.Line(geo, lineMat)
        line.userData = { entity: ent }
        group.add(line)
      }
      continue
    }

    // Geometrik entity'ler (LINE, CIRCLE, ARC, POLYLINE)
    const pts = _entityToPoints(three, ent, origin)
    if (pts.length < 2) continue
    const geo = new three.BufferGeometry().setFromPoints(pts)
    const line = new three.Line(geo, lineMat)
    line.userData = { entity: ent }
    group.add(line)
  }
  return group
}

export default function DemontajKrokisi({ projeId }) {
  // ── DXF dosya bilgilerini al ──
  const { data: dxfDosyalar, isLoading: dosyaYukleniyor } = useQuery({
    queryKey: ['demontaj-kroki-dosyalar', projeId],
    queryFn: () => api.get(`/dosya/proje/${projeId}/demontaj-kroki`),
    select: (res) => res.data || res,
    enabled: !!projeId,
  })

  const containerRef = useRef(null)
  const viewerRef = useRef(null)
  const rendererRef = useRef(null)
  const threeRef = useRef(null)
  const mevcutGroupRef = useRef(null)
  const yeniNativeRef = useRef(null) // DxfViewer nesneleri
  const farkGroupRef = useRef(null)

  const [yukleniyor, setYukleniyor] = useState(false)
  const [ilerleme, setIlerleme] = useState('')
  const [hata, setHata] = useState('')
  const [katmanPanelAcik, setKatmanPanelAcik] = useState(true)
  const [farkYukleniyor, setFarkYukleniyor] = useState(false)
  const [farkYuklendi, setFarkYuklendi] = useState(false)
  const [farkOzet, setFarkOzet] = useState(null)
  const [farkIsaretli, setFarkIsaretli] = useState(false)

  const [katmanlar, setKatmanlar] = useState([
    { id: 'mevcut', ad: 'Mevcut Durum', renk: '#f87171', gorunur: true },
    { id: 'yeni', ad: 'Yeni Durum', renk: '#4ade80', gorunur: true },
    { id: 'fark', ad: 'Demontaj (Fark)', renk: '#facc15', gorunur: false, disabled: true },
  ])

  const hasDxfFiles = dxfDosyalar?.mevcutDurum?.id && dxfDosyalar?.yeniDurum?.id

  // ══════════════════════════════════════════════
  // DXF YÜKLEME — Yeni durum native + Mevcut durum entity overlay
  // ══════════════════════════════════════════════
  useEffect(() => {
    if (!hasDxfFiles || !containerRef.current) return
    let cancelled = false

    const yukle = async () => {
      setYukleniyor(true)
      setHata('')
      setIlerleme('Moduller yukleniyor...')
      setFarkYuklendi(false)
      setFarkIsaretli(false)
      setFarkOzet(null)

      try {
        const [{ DxfViewer }, three] = await Promise.all([
          import('dxf-viewer'),
          import('three'),
        ])
        threeRef.current = three
        if (cancelled) return

        // Onceki viewer'i temizle
        if (viewerRef.current) {
          try { viewerRef.current.Clear() } catch {}
          viewerRef.current = null
        }

        // Renderer olustur
        if (!rendererRef.current) {
          rendererRef.current = new three.WebGLRenderer({
            antialias: true, alpha: true, preserveDrawingBuffer: true,
          })
          containerRef.current.innerHTML = ''
          containerRef.current.appendChild(rendererRef.current.domElement)
          rendererRef.current.domElement.style.width = '100%'
          rendererRef.current.domElement.style.height = '100%'
        }

        // ── 1) Yeni Durum DXF'i native yukle (tam kalite) ──
        setIlerleme('Yeni durum DXF yukleniyor...')
        const viewer = new DxfViewer(containerRef.current, {
          clearColor: new three.Color('#111827'),
          autoResize: true,
          colorCorrection: true,
          renderer: rendererRef.current,
        })
        viewerRef.current = viewer

        const yeniBlob = await fetch(`/api/dosya/${dxfDosyalar.yeniDurum.id}/dosya`).then(r => r.blob())
        const yeniUrl = URL.createObjectURL(yeniBlob)
        await viewer.Load({
          url: yeniUrl,
          fonts: DXF_FONTS,
          progressCbk: (phase, processed, total) => {
            if (phase === 'parse') setIlerleme(`Yeni durum parse... ${total ? Math.round((processed / total) * 100) + '%' : ''}`)
            else if (phase === 'prepare') setIlerleme('Yeni durum sahne hazirlaniyor...')
          },
        })
        URL.revokeObjectURL(yeniUrl)
        if (cancelled) return

        const scene = viewer.GetScene?.() || viewer.scene
        if (!scene) throw new Error('DXF sahnesi alinamadi')

        // Yeni durum nesnelerini gruplayip yesil tona boya
        const yeniGroup = new three.Group()
        yeniGroup.name = 'yeni_durum'
        const nativeChildren = [...scene.children].filter(c => !c.isLight)
        nativeChildren.forEach(child => yeniGroup.add(child))
        // Renklendirme — guvenli: color olmayan materyalleri atla
        yeniGroup.traverse(obj => {
          if (!obj.material || obj.isLight) return
          try {
            if (Array.isArray(obj.material)) {
              obj.material = obj.material.map(m => {
                const c = m.clone()
                if (c.color && typeof c.color.set === 'function') c.color.set(0x4ade80)
                return c
              })
            } else {
              obj.material = obj.material.clone()
              if (obj.material.color && typeof obj.material.color.set === 'function') {
                obj.material.color.set(0x4ade80)
              }
            }
          } catch { /* skip */ }
        })
        scene.add(yeniGroup)
        yeniNativeRef.current = yeniGroup

        // ── 2) Mevcut Durum entity'lerini server'dan al, Three.js cizgileri olarak ekle ──
        setIlerleme('Mevcut durum entity verileri aliniyor...')
        const mevcutRes = await api.get(`/dosya/${dxfDosyalar.mevcutDurum.id}/dxf-entity-list`)
        const mevcutData = mevcutRes.data || mevcutRes
        const mevcutEntities = mevcutData.entities || []

        if (cancelled) return
        setIlerleme(`Mevcut durum ciziliyor (${mevcutEntities.length} entity)...`)

        const origin = viewer.origin || { x: 0, y: 0 }
        const mevcutGroup = _buildEntityGroup(three, mevcutEntities, origin, 0xf87171)
        mevcutGroup.name = 'mevcut_durum'
        scene.add(mevcutGroup)
        mevcutGroupRef.current = mevcutGroup

        // ── 3) Bos fark grubu (sonra doldurulacak) ──
        const farkGroup = new three.Group()
        farkGroup.name = 'fark'
        farkGroup.visible = false
        scene.add(farkGroup)
        farkGroupRef.current = farkGroup

        // Sahneye fit et
        if (viewer.bounds && viewer.origin) {
          const b = viewer.bounds, o = viewer.origin
          viewer.FitView(b.minX - o.x, b.maxX - o.x, b.minY - o.y, b.maxY - o.y)
        }
        viewer.Render()
        setIlerleme('')
      } catch (err) {
        console.error('[DemontajKroki] Hata:', err)
        if (!cancelled) setHata(err.message || 'DXF dosyalari yuklenemedi')
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
  }, [hasDxfFiles, dxfDosyalar?.mevcutDurum?.id, dxfDosyalar?.yeniDurum?.id])

  // Renderer temizleme
  useEffect(() => {
    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose()
        rendererRef.current = null
      }
    }
  }, [])

  // ── Katman gorunurluk ──
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || yukleniyor) return

    const mevcut = mevcutGroupRef.current
    const yeni = yeniNativeRef.current
    const fark = farkGroupRef.current

    if (mevcut) mevcut.visible = katmanlar.find(k => k.id === 'mevcut')?.gorunur ?? true
    if (yeni) yeni.visible = katmanlar.find(k => k.id === 'yeni')?.gorunur ?? true
    if (fark) fark.visible = katmanlar.find(k => k.id === 'fark')?.gorunur ?? false

    viewer.Render()
  }, [katmanlar, yukleniyor])

  // ── Fark analizi ──
  const handleFarkAnalizi = useCallback(async () => {
    if (!dxfDosyalar?.mevcutDurum?.id || !dxfDosyalar?.yeniDurum?.id) return
    const viewer = viewerRef.current
    const three = threeRef.current
    const farkGroup = farkGroupRef.current
    if (!viewer || !three || !farkGroup) return

    setFarkYukleniyor(true)
    try {
      const res = await api.post('/dosya/dxf-fark', {
        mevcut_dosya_id: dxfDosyalar.mevcutDurum.id,
        yeni_dosya_id: dxfDosyalar.yeniDurum.id,
      })
      const data = res.data || res

      setFarkOzet({
        mevcutToplam: data.mevcutToplam,
        yeniToplam: data.yeniToplam,
        sadeceMevcutSayi: data.sadeceMevcut?.length || 0,
        sadeceYeniSayi: data.sadeceYeni?.length || 0,
        ortakTahmini: data.ortakTahmini,
      })

      // Eski fark nesnelerini temizle
      while (farkGroup.children.length > 0) {
        const c = farkGroup.children[0]
        farkGroup.remove(c)
        if (c.geometry) c.geometry.dispose()
        if (c.material) c.material.dispose()
      }

      const origin = viewer.origin || { x: 0, y: 0 }

      // Demontaj (sadece mevcut) entity'leri — sari cizgi
      const demontajMat = new three.LineBasicMaterial({ color: 0xfacc15, linewidth: 2 })
      for (const entity of (data.sadeceMevcut || [])) {
        const pts = _entityToPoints(three, entity, origin)
        if (pts.length < 2) continue
        const geo = new three.BufferGeometry().setFromPoints(pts)
        const line = new three.Line(geo, demontajMat)
        line.userData = { tip: 'demontaj', entity }
        farkGroup.add(line)
      }

      setKatmanlar(prev => prev.map(k =>
        k.id === 'fark' ? { ...k, gorunur: true, disabled: false } : k
      ))
      farkGroup.visible = true
      setFarkYuklendi(true)
      viewer.Render()
    } catch (err) {
      console.error('Fark analizi hatasi:', err)
      setHata('Fark analizi hatasi: ' + (err.message || ''))
    } finally {
      setFarkYukleniyor(false)
    }
  }, [dxfDosyalar])

  // ── Tek tusla isaretle / kaldir ──
  const handleFarkIsaretle = useCallback(() => {
    const three = threeRef.current
    const farkGroup = farkGroupRef.current
    const viewer = viewerRef.current
    if (!three || !farkGroup || !viewer) return

    const yeniIsaretli = !farkIsaretli
    const renk = yeniIsaretli ? 0xff0000 : 0xfacc15

    farkGroup.traverse(obj => {
      if (obj.material && obj.isLine) {
        obj.material.color.set(renk)
        obj.material.needsUpdate = true
      }
    })

    setFarkIsaretli(yeniIsaretli)
    viewer.Render()
  }, [farkIsaretli])

  // ── Katman renk degistirme ──
  const handleRenkDegistir = useCallback((katmanId, yeniRenk) => {
    const three = threeRef.current
    const viewer = viewerRef.current
    if (!three || !viewer) return

    setKatmanlar(prev => prev.map(k => k.id === katmanId ? { ...k, renk: yeniRenk } : k))

    const renkHex = parseInt(yeniRenk.replace('#', ''), 16)
    let group = null
    if (katmanId === 'mevcut') group = mevcutGroupRef.current
    if (katmanId === 'yeni') group = yeniNativeRef.current
    if (katmanId === 'fark') group = farkGroupRef.current

    if (group) {
      group.traverse(obj => {
        if (!obj.material || obj.isLight) return
        try {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => { if (m.color?.set) m.color.set(renkHex) })
          } else {
            if (obj.material.color?.set) obj.material.color.set(renkHex)
          }
        } catch { /* skip */ }
      })
      viewer.Render()
    }
  }, [])

  // ══════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════

  if (dosyaYukleniyor) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Dosyalar kontrol ediliyor...
      </div>
    )
  }

  if (!dxfDosyalar?.mevcutDurum?.id || !dxfDosyalar?.yeniDurum?.id) {
    const mevcutVar = !!dxfDosyalar?.mevcutDurum?.id
    const yeniVar = !!dxfDosyalar?.yeniDurum?.id
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-500" />
        <p className="text-sm font-medium text-amber-800">Demontaj Krokisi icin her iki DXF dosyasi gerekli</p>
        <div className="mt-3 flex justify-center gap-4 text-xs">
          <span className={mevcutVar ? 'text-emerald-600 font-semibold' : 'text-red-600'}>
            {mevcutVar ? '✓' : '✗'} Mevcut Durum Proje
          </span>
          <span className={yeniVar ? 'text-emerald-600 font-semibold' : 'text-red-600'}>
            {yeniVar ? '✓' : '✗'} Yeni Durum Proje
          </span>
        </div>
        <p className="mt-2 text-xs text-amber-600">
          Yasam dongusundeki ilgili adimlara DXF dosyalarini yukleyin.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Baslik */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Demontaj Krokisi</span>
          <span className="text-[10px] text-muted-foreground">— Mevcut / Yeni Durum Overlay</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
            {dxfDosyalar.mevcutDurum.dosya_adi}
          </span>
          <span className="text-muted-foreground/40">|</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
            {dxfDosyalar.yeniDurum.dosya_adi}
          </span>
        </div>
      </div>

      {/* Viewer */}
      <div className="relative" style={{ minHeight: 480 }}>
        {yukleniyor && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-900/80">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs text-white/80">{ilerleme || 'DXF yukleniyor...'}</span>
            </div>
          </div>
        )}

        {hata && !yukleniyor && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-900/60">
            <div className="text-center">
              <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-red-400" />
              <p className="text-sm font-medium text-red-300">DXF yuklenemedi</p>
              <p className="mt-1 text-xs text-red-400/70">{hata}</p>
            </div>
          </div>
        )}

        {/* Kontroller */}
        {!yukleniyor && !hata && hasDxfFiles && (
          <>
            <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
              {/* Zoom */}
              <div className="flex items-center gap-1 rounded-lg bg-white/90 px-1.5 py-1 shadow-sm border border-border">
                <button
                  onClick={() => {
                    const v = viewerRef.current
                    if (v) { v.GetCamera().zoom *= 1.3; v.GetCamera().updateProjectionMatrix(); v.Render() }
                  }}
                  className="rounded p-1 hover:bg-muted" title="Yakinlastir"
                ><ZoomIn className="h-3.5 w-3.5" /></button>
                <button
                  onClick={() => {
                    const v = viewerRef.current
                    if (v) { v.GetCamera().zoom /= 1.3; v.GetCamera().updateProjectionMatrix(); v.Render() }
                  }}
                  className="rounded p-1 hover:bg-muted" title="Uzaklastir"
                ><ZoomOut className="h-3.5 w-3.5" /></button>
                <button
                  onClick={() => {
                    const v = viewerRef.current
                    if (v && v.bounds) {
                      const b = v.bounds, o = v.origin || { x: 0, y: 0 }
                      v.FitView(b.minX - o.x, b.maxX - o.x, b.minY - o.y, b.maxY - o.y)
                    }
                  }}
                  className="rounded p-1 hover:bg-muted" title="Tumunu Goster"
                ><RotateCcw className="h-3.5 w-3.5" /></button>
              </div>
              {/* Katman butonu */}
              <button
                onClick={() => setKatmanPanelAcik(p => !p)}
                className={cn(
                  'flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium shadow-sm border',
                  katmanPanelAcik
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-white/90 border-border hover:bg-muted'
                )}
              >
                <Layers className="h-3.5 w-3.5" /> Katmanlar
              </button>
            </div>

            {/* Katman Paneli */}
            {katmanPanelAcik && (
              <div
                className="absolute top-10 right-2 z-20 w-64 rounded-lg border border-border bg-white/95 shadow-lg backdrop-blur-sm"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Katmanlar</span>
                  <button onClick={() => setKatmanPanelAcik(false)} className="rounded p-0.5 hover:bg-muted">
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="p-3 space-y-3">
                  {katmanlar.map(k => (
                    <div key={k.id} className={cn('space-y-1', k.disabled && 'opacity-40')}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => !k.disabled && setKatmanlar(prev =>
                            prev.map(p => p.id === k.id ? { ...p, gorunur: !p.gorunur } : p)
                          )}
                          className={cn('p-0.5 rounded', k.gorunur ? 'text-foreground' : 'text-muted-foreground/40')}
                          disabled={k.disabled}
                        >
                          {k.gorunur ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </button>
                        <div className="relative h-4 w-4 shrink-0 overflow-hidden rounded-sm border border-border/50">
                          <input
                            type="color"
                            value={k.renk}
                            onChange={e => handleRenkDegistir(k.id, e.target.value)}
                            className="absolute -left-1 -top-1 h-8 w-8 cursor-pointer border-0"
                            disabled={k.disabled}
                          />
                        </div>
                        <span className={cn('text-xs font-medium flex-1', !k.gorunur && 'text-muted-foreground/50 line-through')}>
                          {k.ad}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Fark analizi */}
                  <div className="border-t border-border pt-3 space-y-2">
                    {!farkYuklendi ? (
                      <button
                        onClick={handleFarkAnalizi}
                        disabled={farkYukleniyor}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                      >
                        {farkYukleniyor ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analiz ediliyor...</>
                        ) : (
                          <><Crosshair className="h-3.5 w-3.5" /> Cakmayanlari Bul</>
                        )}
                      </button>
                    ) : (
                      <>
                        {farkOzet && (
                          <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-800 space-y-0.5">
                            <div className="flex justify-between">
                              <span>Mevcut entity</span>
                              <span className="font-bold">{farkOzet.mevcutToplam}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Yeni entity</span>
                              <span className="font-bold">{farkOzet.yeniToplam}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Ortak (tahmini)</span>
                              <span className="font-bold">{farkOzet.ortakTahmini}</span>
                            </div>
                            <div className="flex justify-between text-red-700 font-semibold">
                              <span>Demontaj (sadece mevcut)</span>
                              <span>{farkOzet.sadeceMevcutSayi}</span>
                            </div>
                          </div>
                        )}
                        <button
                          onClick={handleFarkIsaretle}
                          className={cn(
                            'flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                            farkIsaretli
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'bg-amber-500 text-white hover:bg-amber-600'
                          )}
                        >
                          <Crosshair className="h-3.5 w-3.5" />
                          {farkIsaretli ? 'Isaretlemeyi Kaldir' : 'Tumunu Isaretle'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Canvas */}
        <div ref={containerRef} style={{ height: 480, width: '100%' }} />
      </div>

      {/* Alt bilgi */}
      <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: katmanlar.find(k => k.id === 'mevcut')?.renk }} />
            Mevcut Durum
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: katmanlar.find(k => k.id === 'yeni')?.renk }} />
            Yeni Durum
          </span>
          {farkYuklendi && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: farkIsaretli ? '#ef4444' : katmanlar.find(k => k.id === 'fark')?.renk }} />
              Demontaj {farkIsaretli && '(isaretli)'}
            </span>
          )}
        </div>
        <span>Kaydirmak icin orta/sag tus | Zoom icin scroll</span>
      </div>
    </div>
  )
}
