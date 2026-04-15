import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Layers, Eye, EyeOff, Loader2, ZoomIn, ZoomOut, RotateCcw,
  X, AlertTriangle, Crosshair,
} from 'lucide-react'
import api from '@/api/client'
import { cn } from '@/lib/utils'

const DXF_FONTS = ['/fonts/NotoSans.ttf', '/fonts/B_CAD.ttf', '/fonts/T_ROMANS.ttf']

// ── Güvenli toplu renk atama — color prop'u olmayan materyalleri atlar ──
function _safeRecolor(group, hexColor) {
  group.traverse(obj => {
    if (!obj.material || obj.isLight) return
    try {
      const apply = (m) => {
        const c = m.clone()
        if (c.color && typeof c.color.set === 'function') c.color.set(hexColor)
        return c
      }
      obj.material = Array.isArray(obj.material)
        ? obj.material.map(apply)
        : apply(obj.material)
    } catch { /* unsupported material — skip */ }
  })
}

// ── Fark entity → Three.js çizgi noktaları ──
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
    case 'LWPOLYLINE': case 'POLYLINE':
      if (entity.vertices?.length) entity.vertices.forEach(v =>
        pts.push(new three.Vector3((v.x || 0) - ox, (v.y || 0) - oy, 0)))
      break
    // INSERT/TEXT/POINT — daire marker
    case 'INSERT': case 'TEXT': case 'MTEXT': case 'POINT': {
      const cx = (entity.x || entity.cx || 0) - ox, cy = (entity.y || entity.cy || 0) - oy
      const r = entity.type === 'INSERT' ? 3 : 2
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2
        pts.push(new three.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0))
      }
      break
    }
  }
  return pts
}

export default function DemontajKrokisi({ projeId }) {
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
  const yeniGroupRef = useRef(null)
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
  // Her iki DXF'i native DxfViewer ile yükle
  // Mevcut → ana viewer, Yeni → gizli viewer + sahneye klonla
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
          import('dxf-viewer'), import('three'),
        ])
        threeRef.current = three
        if (cancelled) return

        // Temizlik
        if (viewerRef.current) { try { viewerRef.current.Clear() } catch {} }
        viewerRef.current = null

        if (!rendererRef.current) {
          rendererRef.current = new three.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
          containerRef.current.innerHTML = ''
          containerRef.current.appendChild(rendererRef.current.domElement)
          rendererRef.current.domElement.style.width = '100%'
          rendererRef.current.domElement.style.height = '100%'
        }

        // ── 1) MEVCUT DURUM — ana viewer'da native yükle ──
        setIlerleme('Mevcut durum DXF yukleniyor...')
        const mainViewer = new DxfViewer(containerRef.current, {
          clearColor: new three.Color('#111827'),
          autoResize: true,
          colorCorrection: true,
          renderer: rendererRef.current,
        })
        viewerRef.current = mainViewer

        const mevcutBlob = await fetch(`/api/dosya/${dxfDosyalar.mevcutDurum.id}/dosya`).then(r => r.blob())
        const mevcutUrl = URL.createObjectURL(mevcutBlob)
        await mainViewer.Load({ url: mevcutUrl, fonts: DXF_FONTS,
          progressCbk: (phase, _, total) => {
            if (phase === 'parse') setIlerleme(`Mevcut durum parse... ${total ? Math.round(_ / total * 100) + '%' : ''}`)
            else if (phase === 'prepare') setIlerleme('Mevcut durum sahne hazirlaniyor...')
          },
        })
        URL.revokeObjectURL(mevcutUrl)
        if (cancelled) return

        // Mevcut nesneleri grupla
        const scene = mainViewer.GetScene?.() || mainViewer.scene
        if (!scene) throw new Error('DXF sahnesi alinamadi')

        const mevcutGroup = new three.Group()
        mevcutGroup.name = 'mevcut_durum'
        ;[...scene.children].filter(c => !c.isLight).forEach(c => mevcutGroup.add(c))
        _safeRecolor(mevcutGroup, 0xf87171) // kirmiziya boyamayı dene, hata olursa atla
        scene.add(mevcutGroup)
        mevcutGroupRef.current = mevcutGroup

        // ── 2) YENİ DURUM — gizli viewer'da yükle, sonra ana sahneye taşı ──
        setIlerleme('Yeni durum DXF yukleniyor...')

        // Gizli container + renderer — ayrı WebGL context
        const hiddenDiv = document.createElement('div')
        hiddenDiv.style.cssText = 'position:fixed;top:0;left:-9999px;width:800px;height:600px;pointer-events:none;overflow:hidden'
        document.body.appendChild(hiddenDiv)

        const hiddenRenderer = new three.WebGLRenderer({ antialias: false })
        hiddenRenderer.setSize(800, 600)
        hiddenDiv.appendChild(hiddenRenderer.domElement)

        const hiddenViewer = new DxfViewer(hiddenDiv, {
          clearColor: new three.Color('#000'),
          autoResize: false,
          renderer: hiddenRenderer,
        })

        const yeniBlob = await fetch(`/api/dosya/${dxfDosyalar.yeniDurum.id}/dosya`).then(r => r.blob())
        const yeniUrl = URL.createObjectURL(yeniBlob)
        await hiddenViewer.Load({ url: yeniUrl, fonts: DXF_FONTS,
          progressCbk: (phase, _, total) => {
            if (phase === 'parse') setIlerleme(`Yeni durum parse... ${total ? Math.round(_ / total * 100) + '%' : ''}`)
            else if (phase === 'prepare') setIlerleme('Yeni durum sahne hazirlaniyor...')
          },
        })
        URL.revokeObjectURL(yeniUrl)
        if (cancelled) return

        // Gizli sahneden klonla — her nesneyi deep clone edip ana sahneye ekle
        const hiddenScene = hiddenViewer.GetScene?.() || hiddenViewer.scene
        const yeniGroup = new three.Group()
        yeniGroup.name = 'yeni_durum'

        if (hiddenScene) {
          ;[...hiddenScene.children].filter(c => !c.isLight).forEach(child => {
            try { yeniGroup.add(child.clone(true)) } catch (e) {
              console.warn('[DemontajKroki] Klonlama atlandi:', e.message)
            }
          })
        }

        _safeRecolor(yeniGroup, 0x4ade80)
        scene.add(yeniGroup)
        yeniGroupRef.current = yeniGroup

        // Gizli viewer temizle
        try { hiddenViewer.Clear() } catch {}
        try { hiddenRenderer.dispose() } catch {}
        try { document.body.removeChild(hiddenDiv) } catch {}

        // Boş fark grubu
        const farkGroup = new three.Group()
        farkGroup.name = 'fark'
        farkGroup.visible = false
        scene.add(farkGroup)
        farkGroupRef.current = farkGroup

        // Sahneye fit
        if (mainViewer.bounds && mainViewer.origin) {
          const b = mainViewer.bounds, o = mainViewer.origin
          mainViewer.FitView(b.minX - o.x, b.maxX - o.x, b.minY - o.y, b.maxY - o.y)
        }
        mainViewer.Render()
        setIlerleme('')
      } catch (err) {
        console.error('[DemontajKroki] Hata:', err)
        if (!cancelled) setHata(err.message || 'DXF dosyalari yuklenemedi')
      } finally {
        if (!cancelled) setYukleniyor(false)
      }
    }
    yukle()
    return () => { cancelled = true; if (viewerRef.current) { try { viewerRef.current.Clear() } catch {} }; viewerRef.current = null }
  }, [hasDxfFiles, dxfDosyalar?.mevcutDurum?.id, dxfDosyalar?.yeniDurum?.id])

  useEffect(() => () => { if (rendererRef.current) { rendererRef.current.dispose(); rendererRef.current = null } }, [])

  // ── Katman görünürlük ──
  useEffect(() => {
    const v = viewerRef.current
    if (!v || yukleniyor) return
    if (mevcutGroupRef.current) mevcutGroupRef.current.visible = katmanlar.find(k => k.id === 'mevcut')?.gorunur ?? true
    if (yeniGroupRef.current) yeniGroupRef.current.visible = katmanlar.find(k => k.id === 'yeni')?.gorunur ?? true
    if (farkGroupRef.current) farkGroupRef.current.visible = katmanlar.find(k => k.id === 'fark')?.gorunur ?? false
    v.Render()
  }, [katmanlar, yukleniyor])

  // ── Fark analizi ──
  const handleFarkAnalizi = useCallback(async () => {
    if (!dxfDosyalar?.mevcutDurum?.id || !dxfDosyalar?.yeniDurum?.id) return
    const viewer = viewerRef.current, three = threeRef.current, farkGroup = farkGroupRef.current
    if (!viewer || !three || !farkGroup) return
    setFarkYukleniyor(true)
    try {
      const res = await api.post('/dosya/dxf-fark', { mevcut_dosya_id: dxfDosyalar.mevcutDurum.id, yeni_dosya_id: dxfDosyalar.yeniDurum.id })
      const data = res.data || res
      setFarkOzet({ mevcutToplam: data.mevcutToplam, yeniToplam: data.yeniToplam, sadeceMevcutSayi: data.sadeceMevcut?.length || 0, sadeceYeniSayi: data.sadeceYeni?.length || 0, ortakTahmini: data.ortakTahmini })
      while (farkGroup.children.length) { const c = farkGroup.children[0]; farkGroup.remove(c); if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose() }
      const origin = viewer.origin || { x: 0, y: 0 }
      const mat = new three.LineBasicMaterial({ color: 0xfacc15, linewidth: 2 })
      for (const ent of (data.sadeceMevcut || [])) {
        const pts = _entityToPoints(three, ent, origin)
        if (pts.length < 2) continue
        farkGroup.add(new three.Line(new three.BufferGeometry().setFromPoints(pts), mat))
      }
      setKatmanlar(prev => prev.map(k => k.id === 'fark' ? { ...k, gorunur: true, disabled: false } : k))
      farkGroup.visible = true
      setFarkYuklendi(true)
      viewer.Render()
    } catch (err) { console.error('Fark hatasi:', err); setHata('Fark analizi hatasi: ' + (err.message || '')) }
    finally { setFarkYukleniyor(false) }
  }, [dxfDosyalar])

  // ── Tek tuşla işaretle ──
  const handleFarkIsaretle = useCallback(() => {
    const farkGroup = farkGroupRef.current, viewer = viewerRef.current
    if (!farkGroup || !viewer) return
    const yeni = !farkIsaretli
    farkGroup.traverse(obj => { if (obj.material?.color?.set) { obj.material.color.set(yeni ? 0xff0000 : 0xfacc15); obj.material.needsUpdate = true } })
    setFarkIsaretli(yeni)
    viewer.Render()
  }, [farkIsaretli])

  // ── Katman renk değiştirme ──
  const handleRenkDegistir = useCallback((katmanId, yeniRenk) => {
    const viewer = viewerRef.current
    if (!viewer) return
    setKatmanlar(prev => prev.map(k => k.id === katmanId ? { ...k, renk: yeniRenk } : k))
    const hex = parseInt(yeniRenk.replace('#', ''), 16)
    const group = katmanId === 'mevcut' ? mevcutGroupRef.current : katmanId === 'yeni' ? yeniGroupRef.current : farkGroupRef.current
    if (group) { _safeRecolor(group, hex); viewer.Render() }
  }, [])

  // ══════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════
  if (dosyaYukleniyor) return <div className="flex items-center justify-center py-12 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Dosyalar kontrol ediliyor...</div>

  if (!dxfDosyalar?.mevcutDurum?.id || !dxfDosyalar?.yeniDurum?.id) {
    const m = !!dxfDosyalar?.mevcutDurum?.id, y = !!dxfDosyalar?.yeniDurum?.id
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-500" />
        <p className="text-sm font-medium text-amber-800">Demontaj Krokisi icin her iki DXF dosyasi gerekli</p>
        <div className="mt-3 flex justify-center gap-4 text-xs">
          <span className={m ? 'text-emerald-600 font-semibold' : 'text-red-600'}>{m ? '✓' : '✗'} Mevcut Durum Proje</span>
          <span className={y ? 'text-emerald-600 font-semibold' : 'text-red-600'}>{y ? '✓' : '✗'} Yeni Durum Proje</span>
        </div>
        <p className="mt-2 text-xs text-amber-600">Yasam dongusundeki ilgili adimlara DXF dosyalarini yukleyin.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Başlık */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Demontaj Krokisi</span>
          <span className="text-[10px] text-muted-foreground">— Mevcut / Yeni Durum Overlay</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-400" />{dxfDosyalar.mevcutDurum.dosya_adi}</span>
          <span className="text-muted-foreground/40">|</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green-400" />{dxfDosyalar.yeniDurum.dosya_adi}</span>
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
              <div className="flex items-center gap-1 rounded-lg bg-white/90 px-1.5 py-1 shadow-sm border border-border">
                <button onClick={() => { const v = viewerRef.current; if (v) { v.GetCamera().zoom *= 1.3; v.GetCamera().updateProjectionMatrix(); v.Render() } }} className="rounded p-1 hover:bg-muted" title="Yakinlastir"><ZoomIn className="h-3.5 w-3.5" /></button>
                <button onClick={() => { const v = viewerRef.current; if (v) { v.GetCamera().zoom /= 1.3; v.GetCamera().updateProjectionMatrix(); v.Render() } }} className="rounded p-1 hover:bg-muted" title="Uzaklastir"><ZoomOut className="h-3.5 w-3.5" /></button>
                <button onClick={() => { const v = viewerRef.current; if (v?.bounds) { const b = v.bounds, o = v.origin || { x: 0, y: 0 }; v.FitView(b.minX - o.x, b.maxX - o.x, b.minY - o.y, b.maxY - o.y) } }} className="rounded p-1 hover:bg-muted" title="Tumunu Goster"><RotateCcw className="h-3.5 w-3.5" /></button>
              </div>
              <button onClick={() => setKatmanPanelAcik(p => !p)} className={cn('flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium shadow-sm border', katmanPanelAcik ? 'bg-primary/10 border-primary text-primary' : 'bg-white/90 border-border hover:bg-muted')}>
                <Layers className="h-3.5 w-3.5" /> Katmanlar
              </button>
            </div>

            {/* Katman Paneli */}
            {katmanPanelAcik && (
              <div className="absolute top-10 right-2 z-20 w-64 rounded-lg border border-border bg-white/95 shadow-lg backdrop-blur-sm" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Katmanlar</span>
                  <button onClick={() => setKatmanPanelAcik(false)} className="rounded p-0.5 hover:bg-muted"><X className="h-3 w-3" /></button>
                </div>
                <div className="p-3 space-y-3">
                  {katmanlar.map(k => (
                    <div key={k.id} className={cn('flex items-center gap-2', k.disabled && 'opacity-40')}>
                      <button onClick={() => !k.disabled && setKatmanlar(prev => prev.map(p => p.id === k.id ? { ...p, gorunur: !p.gorunur } : p))} className={cn('p-0.5 rounded', k.gorunur ? 'text-foreground' : 'text-muted-foreground/40')} disabled={k.disabled}>
                        {k.gorunur ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      <div className="relative h-4 w-4 shrink-0 overflow-hidden rounded-sm border border-border/50">
                        <input type="color" value={k.renk} onChange={e => handleRenkDegistir(k.id, e.target.value)} className="absolute -left-1 -top-1 h-8 w-8 cursor-pointer border-0" disabled={k.disabled} />
                      </div>
                      <span className={cn('text-xs font-medium flex-1', !k.gorunur && 'text-muted-foreground/50 line-through')}>{k.ad}</span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-3 space-y-2">
                    {!farkYuklendi ? (
                      <button onClick={handleFarkAnalizi} disabled={farkYukleniyor} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                        {farkYukleniyor ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analiz ediliyor...</> : <><Crosshair className="h-3.5 w-3.5" /> Cakmayanlari Bul</>}
                      </button>
                    ) : (
                      <>
                        {farkOzet && (
                          <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-800 space-y-0.5">
                            <div className="flex justify-between"><span>Mevcut entity</span><span className="font-bold">{farkOzet.mevcutToplam}</span></div>
                            <div className="flex justify-between"><span>Yeni entity</span><span className="font-bold">{farkOzet.yeniToplam}</span></div>
                            <div className="flex justify-between"><span>Ortak (tahmini)</span><span className="font-bold">{farkOzet.ortakTahmini}</span></div>
                            <div className="flex justify-between text-red-700 font-semibold"><span>Demontaj (sadece mevcut)</span><span>{farkOzet.sadeceMevcutSayi}</span></div>
                          </div>
                        )}
                        <button onClick={handleFarkIsaretle} className={cn('flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium', farkIsaretli ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-amber-500 text-white hover:bg-amber-600')}>
                          <Crosshair className="h-3.5 w-3.5" /> {farkIsaretli ? 'Isaretlemeyi Kaldir' : 'Tumunu Isaretle'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={containerRef} style={{ height: 480, width: '100%' }} />
      </div>

      {/* Alt bilgi */}
      <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: katmanlar.find(k => k.id === 'mevcut')?.renk }} />Mevcut Durum</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: katmanlar.find(k => k.id === 'yeni')?.renk }} />Yeni Durum</span>
          {farkYuklendi && <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: farkIsaretli ? '#ef4444' : katmanlar.find(k => k.id === 'fark')?.renk }} />Demontaj {farkIsaretli && '(isaretli)'}</span>}
        </div>
        <span>Kaydirmak icin orta/sag tus | Zoom icin scroll</span>
      </div>
    </div>
  )
}
