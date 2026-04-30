import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, ZoomIn, ZoomOut, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COLORS } from '@/constants/colors'
import api from '@/api/client'

// DXF ACI (AutoCAD Color Index) → hex — AutoCAD standart paleti
const ACI_TO_HEX = {
  0: 0x000000, 1: 0xff0000, 2: 0xffff00, 3: 0x00ff00, 4: 0x00ffff, 5: 0x0000ff,
  6: 0xff00ff, 7: 0xffffff, 8: 0x414141, 9: 0x808080,
  10: 0xff0000, 11: 0xffaaaa, 12: 0xbd0000, 13: 0xbd7e7e, 14: 0x810000, 15: 0x815656,
  16: 0x680000, 17: 0x684545, 18: 0x4f0000, 19: 0x4f3535,
  20: 0xff3f00, 21: 0xffbfaa, 22: 0xbd2e00, 23: 0xbd8d7e, 24: 0x811f00, 25: 0x816056,
  30: 0xff7f00, 31: 0xffd4aa, 32: 0xbd5e00, 33: 0xbd9d7e, 34: 0x814000, 35: 0x816b56,
  40: 0xffbf00, 41: 0xffeaaa, 42: 0xbd8d00, 43: 0xbdad7e, 44: 0x816000, 45: 0x817656,
  50: 0xffff00, 51: 0xffffaa, 52: 0xbdbd00, 53: 0xbdbd7e, 54: 0x818100, 55: 0x818156,
  60: 0xbfff00, 61: 0xeaffaa, 62: 0x8dbd00, 63: 0xadbd7e, 64: 0x608100, 65: 0x768156,
  70: 0x7fff00, 71: 0xd4ffaa, 72: 0x5ebd00, 73: 0x9dbd7e, 74: 0x408100, 75: 0x6b8156,
  80: 0x3fff00, 81: 0xbfffaa, 82: 0x2ebd00, 83: 0x8dbd7e, 84: 0x1f8100, 85: 0x608156,
  90: 0x00ff00, 91: 0xaaffaa, 92: 0x00bd00, 93: 0x7ebd7e, 94: 0x008100, 95: 0x568156,
  100: 0x00ff3f, 110: 0x00ff7f, 120: 0x00ffbf, 130: 0x00ffff, 140: 0x00bfff, 150: 0x007fff,
  160: 0x003fff, 170: 0x0000ff, 180: 0x3f00ff, 190: 0x7f00ff, 200: 0xbf00ff, 210: 0xff00ff,
  220: 0xff00bf, 230: 0xff007f, 240: 0xff003f, 250: 0x333333, 251: 0x505050, 252: 0x696969,
  253: 0x828282, 254: 0xbebebe, 255: 0xffffff,
}
function aciToHex(aci, defaultHex = 0xffffff) {
  if (aci == null) return defaultHex
  if (ACI_TO_HEX[aci] != null) return ACI_TO_HEX[aci]
  return defaultHex
}

// Elektrik DXF sembol karakterleri — bu karakterler B_CAD fontunda sembol glyph'e eşlenir
const SEMBOL_KARAKTERLER = new Set(['E', 'A', '2', 'B', 'D', 'C', '4', '5', 'c', 'e', 'a'])

// CAD fontlarını browser'a yükle (tek seferlik)
let _fontPromise = null
function loadCadFonts() {
  if (_fontPromise) return _fontPromise
  _fontPromise = (async () => {
    try {
      const bcad = new FontFace('B_CAD', 'url(/fonts/B_CAD.ttf)')
      const romans = new FontFace('T_ROMANS', 'url(/fonts/T_ROMANS.ttf)')
      const [b, r] = await Promise.all([bcad.load(), romans.load()])
      document.fonts.add(b); document.fonts.add(r)
      await document.fonts.ready
      console.info('[DxfSahne] CAD fontları yüklendi (B_CAD + T_ROMANS)')
    } catch (err) { console.warn('[DxfSahne] font yükleme hatası:', err) }
  })()
  return _fontPromise
}

// Verilen karakter için Three.js objesi üretir (çizgi/dolgu) veya null dönerse text olarak çizilir
function sembolCiz(three, char, color, size) {
  const r = size * 0.7

  if (['E', 'A', '2', 'B', 'D', 'e', 'a'].includes(char)) {
    // Direk: DOLU daire
    const circleGeom = new three.CircleGeometry(r, 32)
    return new three.Mesh(circleGeom, new three.MeshBasicMaterial({ color, side: three.DoubleSide }))
  }

  if (char === 'C' || char === 'c') {
    // Armatür: daire konturu + iç çarpı (⊗)
    const seg = 24
    const mat = new three.LineBasicMaterial({ color })
    const dairePts = []
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2
      dairePts.push(Math.cos(a) * r, Math.sin(a) * r, 0)
    }
    const daireGeom = new three.BufferGeometry()
    daireGeom.setAttribute('position', new three.BufferAttribute(new Float32Array(dairePts), 3))
    daireGeom.computeBoundingSphere()
    const daire = new three.LineLoop(daireGeom, mat)
    // İç çarpı — 45° çevrilmiş X
    const d = r * 0.7
    const carpiPts = [-d, -d, 0, d, d, 0, -d, d, 0, d, -d, 0]
    const carpiGeom = new three.BufferGeometry()
    carpiGeom.setAttribute('position', new three.BufferAttribute(new Float32Array(carpiPts), 3))
    carpiGeom.computeBoundingSphere()
    const carpi = new three.LineSegments(carpiGeom, mat)
    const grup = new three.Group()
    grup.add(daire); grup.add(carpi)
    return grup
  }

  if (char === '4' || char === '5') {
    // Topraklama: kısa dikey çizgi + 3 yatay çizgi (⊥ şeklinde), giderek daralan
    const mat = new three.LineBasicMaterial({ color })
    const s = r
    const pts = [
      0, 0, 0, 0, s * 0.4, 0,                             // kısa dikey sap
      -s * 0.8, 0, 0, s * 0.8, 0, 0,                      // 1. yatay (en geniş)
      -s * 0.55, -s * 0.22, 0, s * 0.55, -s * 0.22, 0,    // 2. yatay (orta)
      -s * 0.3, -s * 0.44, 0, s * 0.3, -s * 0.44, 0,      // 3. yatay (dar)
    ]
    const geom = new three.BufferGeometry()
    geom.setAttribute('position', new three.BufferAttribute(new Float32Array(pts), 3))
    geom.computeBoundingSphere()
    return new three.LineSegments(geom, mat)
  }

  return null
}

// Paint renkleri
const PAINT_RENKLER = [
  { id: 'mavi', renk: '#' + COLORS.paint.mavi.hex.toString(16).padStart(6, '0'), hex: COLORS.paint.mavi.hex, ad: COLORS.paint.mavi.ad },
  { id: 'gri', renk: '#' + COLORS.paint.gri.hex.toString(16).padStart(6, '0'), hex: COLORS.paint.gri.hex, ad: COLORS.paint.gri.ad },
  { id: 'beyaz', renk: '#' + COLORS.paint.beyaz.hex.toString(16).padStart(6, '0'), hex: COLORS.paint.beyaz.hex, ad: COLORS.paint.beyaz.ad },
]

// 2D segment-segment kesişimi
function segSegInt(p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y) {
  const den = (p4y - p3y) * (p2x - p1x) - (p4x - p3x) * (p2y - p1y)
  if (den === 0) return false
  const ua = ((p4x - p3x) * (p1y - p3y) - (p4y - p3y) * (p1x - p3x)) / den
  const ub = ((p2x - p1x) * (p1y - p3y) - (p2y - p1y) * (p1x - p3x)) / den
  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1
}
function segCrossesRect(p1, p2, r) {
  const inR = p => p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY
  if (inR(p1) || inR(p2)) return true
  return (
    segSegInt(p1.x, p1.y, p2.x, p2.y, r.minX, r.minY, r.maxX, r.minY) ||
    segSegInt(p1.x, p1.y, p2.x, p2.y, r.maxX, r.minY, r.maxX, r.maxY) ||
    segSegInt(p1.x, p1.y, p2.x, p2.y, r.maxX, r.maxY, r.minX, r.maxY) ||
    segSegInt(p1.x, p1.y, p2.x, p2.y, r.minX, r.maxY, r.minX, r.minY)
  )
}

/**
 * DxfSahne — Projabze CAD mimarisi ile DXF viewer
 * - dxf-parser ile parse → Three.js sahnesi
 * - Her entity ayrı obje (userData metadata ile)
 * - Raycaster seçim + box select + renk paleti
 */
export default function DxfSahne({ src, dosyaId, onDirekTikla, onDireklerYuklendi, direkler: direklerProp }) {
  const [direklerState, setDireklerState] = useState(direklerProp || [])
  const direkler = direklerProp || direklerState
  // dosyaId verilmişse backend'den direk listesini çek
  useEffect(() => {
    if (!dosyaId || direklerProp) return
    api.get(`/dosya/${dosyaId}/dxf-elemanlar`).then(r => {
      const list = (r?.data || r)?.elemanlar || []
      setDireklerState(list)
      onDireklerYuklendi?.(list)
    }).catch(() => {})
  }, [dosyaId])

  const containerRef = useRef(null)
  const rendererRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const threeRef = useRef(null)
  const entitiesGroupRef = useRef(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState('')
  const [paintRenk, setPaintRenk] = useState(null)
  const [paintRect, setPaintRect] = useState(null)
  const paintStartRef = useRef(null)
  const paintOverlayRef = useRef(null)
  const [entitySayi, setEntitySayi] = useState(0)

  // ── Sahneyi yükle ──
  useEffect(() => {
    if (!containerRef.current || !src) return
    let cancelled = false
    setYukleniyor(true); setHata('')

    const yukle = async () => {
      try {
        const [DxfParserMod, three] = await Promise.all([
          import('dxf-parser'),
          import('three'),
          loadCadFonts(), // fontları paralel yükle
        ])
        if (cancelled) return
        const DxfParser = DxfParserMod.default || DxfParserMod
        threeRef.current = three

        // Fetch + parse
        const res = await fetch(src)
        const text = await res.text()
        const parser = new DxfParser()
        const dxf = parser.parseSync(text)
        if (cancelled) return

        // Renderer — container boyutu hazır değilse bir sonraki frame'de tekrar al
        let width = containerRef.current.clientWidth
        let height = containerRef.current.clientHeight
        if (width === 0 || height === 0) {
          await new Promise(r => requestAnimationFrame(r))
          width = containerRef.current?.clientWidth || 800
          height = containerRef.current?.clientHeight || 600
        }
        console.info('[DxfSahne] container boyutu:', width, 'x', height)
        const renderer = new three.WebGLRenderer({ antialias: true })
        renderer.setPixelRatio(window.devicePixelRatio)
        renderer.setSize(width, height)
        renderer.setClearColor(0x000000, 1)
        containerRef.current.innerHTML = ''
        containerRef.current.appendChild(renderer.domElement)
        rendererRef.current = renderer

        // Scene + Camera (Ortografik — kuşbakışı)
        const scene = new three.Scene()
        sceneRef.current = scene
        const aspect = width / height
        const frustum = 100
        const camera = new three.OrthographicCamera(
          -frustum * aspect, frustum * aspect,
          frustum, -frustum,
          0.1, 10000
        )
        camera.position.set(0, 0, 100)
        camera.lookAt(0, 0, 0)
        cameraRef.current = camera

        // Entity grubu
        const entitiesGroup = new three.Group()
        entitiesGroup.name = 'dxf_entities'
        scene.add(entitiesGroup)
        entitiesGroupRef.current = entitiesGroup

        // Layer renkleri — dxf-parser l.color RGB hex olarak geliyor (ACI değil)
        const layerColors = {}
        const layersRaw = dxf.tables?.layer?.layers || dxf.tables?.layers?.layers || {}
        for (const [ad, l] of Object.entries(layersRaw)) {
          if (l.color != null && typeof l.color === 'number') {
            layerColors[ad] = l.color & 0xffffff
          } else if (l.colorIndex != null) {
            layerColors[ad] = aciToHex(l.colorIndex, 0xffffff)
          } else {
            layerColors[ad] = 0xffffff
          }
        }
        console.info('[DxfSahne] layer renkleri:', layerColors)

        // INSERT'leri flatten et (block içeriği çıkar)
        const blocks = dxf.blocks || {}
        const flatEntities = []
        const flatten = (entity, transform = null) => {
          if (entity.type === 'INSERT') {
            const block = blocks[entity.name]
            if (!block || !block.entities) return
            const tx = (transform?.x || 0) + (entity.position?.x || 0)
            const ty = (transform?.y || 0) + (entity.position?.y || 0)
            const rot = (transform?.rot || 0) + (entity.rotation || 0) * Math.PI / 180
            const sx = (transform?.sx || 1) * (entity.xScale || 1)
            const sy = (transform?.sy || 1) * (entity.yScale || 1)
            for (const be of block.entities) flatten(be, { x: tx, y: ty, rot, sx, sy })
          } else {
            flatEntities.push({ entity, transform })
          }
        }
        for (const e of (dxf.entities || [])) flatten(e)

        // Entity → Three.js objesi — DXF renk çözümleme
        // dxf-parser kuralları:
        //   entity.colorIndex → ham ACI değeri (1-255 özel renk, 0=BYBLOCK, 256=BYLAYER)
        //   entity.color → ACI'dan getAcadColor ile RGB hex'e dönüştürülmüş değer
        //   entity.trueColor → 24-bit true color
        const makeColor = function makeColor(entity) {
          // 1. trueColor (24-bit)
          if (entity.trueColor != null && typeof entity.trueColor === 'number') {
            return entity.trueColor & 0xffffff
          }
          // 2. Entity kendi rengi var mı? (ACI 1-255, 0 ve 256 özel)
          const aci = entity.colorIndex
          if (aci != null && aci !== 0 && aci !== 256) {
            // entity.color zaten RGB hex olarak gelir — direkt kullan
            if (entity.color != null && typeof entity.color === 'number') {
              return entity.color & 0xffffff
            }
            // Fallback: kendi ACI tablomuzdan çevir
            return aciToHex(aci, 0xffffff)
          }
          // 3. BYLAYER veya tanımsız → layer rengi
          if (entity.layer && layerColors[entity.layer] != null) return layerColors[entity.layer]
          return 0xffffff
        }

        // Sembol TEXT örneği (makeColor tanımlandıktan sonra)
        const sampleText = (dxf.entities || []).find(e => (e.type === 'TEXT' || e.type === 'MTEXT') && (e.text || '').length === 1)
        if (sampleText) {
          console.info('[DxfSahne] sembol TEXT örneği:', {
            text: sampleText.text, color: sampleText.color, colorIndex: sampleText.colorIndex,
            colorNumber: sampleText.colorNumber, trueColor: sampleText.trueColor,
            layer: sampleText.layer, styleName: sampleText.styleName, style: sampleText.style,
            resolvedColor: '#' + makeColor(sampleText).toString(16).padStart(6, '0'),
          })
        }
        const applyTransform = (x, y, t) => {
          if (!t) return { x, y }
          const cos = Math.cos(t.rot), sin = Math.sin(t.rot)
          const xr = x * t.sx, yr = y * t.sy
          return { x: xr * cos - yr * sin + t.x, y: xr * sin + yr * cos + t.y }
        }

        // ⭐ ÖN GEÇİŞ: bounds'ı hesapla (UTM koordinatları → centroid'i çıkar, float32 precision koru)
        let rawB = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
        const hitRaw = (p) => {
          if (!p || !isFinite(p.x) || !isFinite(p.y)) return
          if (p.x < rawB.minX) rawB.minX = p.x
          if (p.x > rawB.maxX) rawB.maxX = p.x
          if (p.y < rawB.minY) rawB.minY = p.y
          if (p.y > rawB.maxY) rawB.maxY = p.y
        }
        for (const { entity, transform } of flatEntities) {
          if (entity.vertices) for (const v of entity.vertices) hitRaw(applyTransform(v.x, v.y, transform))
          if (entity.center) hitRaw(applyTransform(entity.center.x, entity.center.y, transform))
          if (entity.position) hitRaw(applyTransform(entity.position.x, entity.position.y, transform))
          if (entity.startPoint) hitRaw(applyTransform(entity.startPoint.x, entity.startPoint.y, transform))
        }
        const offsetX = isFinite(rawB.minX) ? (rawB.minX + rawB.maxX) / 2 : 0
        const offsetY = isFinite(rawB.minY) ? (rawB.minY + rawB.maxY) / 2 : 0
        // Entity'ler origin civarına (relative) yerleştirilecek — kamera ve Box3 işimizi kolaylaştırır.
        // UTM offset'i sadece click → direkler eşleşmesinde kullanacağız.
        entitiesGroup.position.set(0, 0, 0)
        entitiesGroup.userData = { offsetX, offsetY } // offset'i sakla (click handler için)
        const tr = (x, y, t) => {
          const w = applyTransform(x, y, t)
          return { x: w.x - offsetX, y: w.y - offsetY }
        }

        // Kolaylık için touch'ı atıyoruz artık — Box3 kullanacağız
        const touch = () => {}
        let bounds = rawB

        let eklenen = 0
        const tipSayi = {}
        for (const { entity } of flatEntities) {
          tipSayi[entity.type] = (tipSayi[entity.type] || 0) + 1
        }
        console.info('[DxfSahne] entity tipleri:', tipSayi, `| toplam flat: ${flatEntities.length}`,
          `| offset: (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`)

        for (const { entity, transform } of flatEntities) {
          const col = makeColor(entity)
          const type = entity.type

          if (type === 'LINE') {
            const p1 = tr(entity.vertices[0].x, entity.vertices[0].y, transform)
            const p2 = tr(entity.vertices[1].x, entity.vertices[1].y, transform)
            const geom = new three.BufferGeometry()
            geom.setAttribute('position', new three.BufferAttribute(new Float32Array([
              p1.x, p1.y, 0, p2.x, p2.y, 0
            ]), 3))
            geom.computeBoundingSphere()
            const line = new three.Line(geom, new three.LineBasicMaterial({ color: col }))
            line.userData = {
              id: entity.handle || `line-${eklenen}`, type: 'LINE',
              layerId: entity.layer || 'default', selectable: true,
              originalColor: col, state: { selected: false, hovered: false },
            }
            entitiesGroup.add(line)
            eklenen++
          } else if (type === 'LWPOLYLINE' || type === 'POLYLINE') {
            const verts = (entity.vertices || []).map(v => tr(v.x, v.y, transform))
            if (verts.length < 2) continue
            const closed = !!entity.shape
            const pts = verts.map(v => [v.x, v.y, 0]).flat()
            if (closed) pts.push(verts[0].x, verts[0].y, 0)
            const geom = new three.BufferGeometry()
            geom.setAttribute('position', new three.BufferAttribute(new Float32Array(pts), 3))
            geom.computeBoundingSphere()
            const line = new three.Line(geom, new three.LineBasicMaterial({ color: col }))
            line.userData = {
              id: entity.handle || `pline-${eklenen}`, type: 'POLYLINE',
              layerId: entity.layer || 'default', selectable: true,
              originalColor: col, state: { selected: false, hovered: false },
            }
            entitiesGroup.add(line)
            eklenen++
          } else if (type === 'CIRCLE') {
            const c = tr(entity.center.x, entity.center.y, transform)
            const r = entity.radius * (transform?.sx || 1)
            const seg = 64
            const pts = []
            for (let i = 0; i <= seg; i++) {
              const a = (i / seg) * Math.PI * 2
              pts.push(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, 0)
            }
            const geom = new three.BufferGeometry()
            geom.setAttribute('position', new three.BufferAttribute(new Float32Array(pts), 3))
            geom.computeBoundingSphere()
            const line = new three.LineLoop(geom, new three.LineBasicMaterial({ color: col }))
            line.userData = {
              id: entity.handle || `circle-${eklenen}`, type: 'CIRCLE',
              layerId: entity.layer || 'default', selectable: true,
              originalColor: col, state: { selected: false, hovered: false },
            }
            entitiesGroup.add(line)
            eklenen++
          } else if (type === 'ARC') {
            const c = tr(entity.center.x, entity.center.y, transform)
            const r = entity.radius * (transform?.sx || 1)
            const a0 = (entity.startAngle || 0) * Math.PI / 180 + (transform?.rot || 0)
            const a1 = (entity.endAngle || 0) * Math.PI / 180 + (transform?.rot || 0)
            let a1Norm = a1
            if (a1Norm <= a0) a1Norm += Math.PI * 2
            const seg = 48
            const pts = []
            for (let i = 0; i <= seg; i++) {
              const a = a0 + (a1Norm - a0) * (i / seg)
              const x = c.x + Math.cos(a) * r
              const y = c.y + Math.sin(a) * r
              pts.push(x, y, 0)
            }
            const geom = new three.BufferGeometry()
            geom.setAttribute('position', new three.BufferAttribute(new Float32Array(pts), 3))
            geom.computeBoundingSphere()
            const line = new three.Line(geom, new three.LineBasicMaterial({ color: col }))
            line.userData = {
              id: entity.handle || `arc-${eklenen}`, type: 'ARC',
              layerId: entity.layer || 'default', selectable: true,
              originalColor: col, state: { selected: false, hovered: false },
            }
            entitiesGroup.add(line)
            eklenen++
          } else if (type === 'TEXT' || type === 'MTEXT') {
            const txt = entity.text || ''
            if (!txt) continue
            const halign = entity.halign != null ? entity.halign : 0 // 0=left 1=center 2=right 3=aligned 4=middle 5=fit
            const valign = entity.valign != null ? entity.valign : 0 // 0=baseline 1=bottom 2=middle 3=top
            // DXF alignment kuralı: halign/valign 0'dan farklıysa endPoint/secondAlignmentPoint kullanılır
            const hizaliMi = (halign !== 0 || valign !== 0)
            const primary = entity.startPoint || entity.position || { x: 0, y: 0 }
            const secondary = entity.endPoint || entity.secondAlignmentPoint || entity.position || primary
            const anchor = hizaliMi ? secondary : primary
            const p = tr(anchor.x || 0, anchor.y || 0, transform)
            const size = (entity.textHeight || entity.height || 2.5) * (transform?.sx || 1)
            const rotRad = ((entity.rotation || 0) * Math.PI / 180) + (transform?.rot || 0)

            const sembolMu = txt.length === 1
            const fontAdi = sembolMu ? 'B_CAD' : 'T_ROMANS'
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            const fontPx = 64
            const fontStr = `${fontPx}px "${fontAdi}", sans-serif`
            ctx.font = fontStr
            const m = ctx.measureText(txt)
            // Gerçek görünür glyph yüksekliği (ascent + descent)
            const glyphH = Math.max(1,
              (m.actualBoundingBoxAscent || fontPx * 0.75) +
              (m.actualBoundingBoxDescent || fontPx * 0.05))
            const glyphW = Math.max(1, m.width)
            const padX = 4, padY = 6
            canvas.width = Math.ceil(glyphW) + padX * 2
            canvas.height = Math.ceil(glyphH) + padY * 2
            ctx.font = fontStr
            ctx.fillStyle = `#${col.toString(16).padStart(6, '0')}`
            ctx.textBaseline = 'middle'
            ctx.textAlign = 'center'
            ctx.fillText(txt, canvas.width / 2, canvas.height / 2)

            const tex = new three.CanvasTexture(canvas)
            tex.needsUpdate = true
            // Görünür glyph yüksekliği = `size` world birim olsun → canvas tamamı glyphH oranında
            const worldH = size * (canvas.height / glyphH)
            const worldW = worldH * (canvas.width / canvas.height)
            const planeGeom = new three.PlaneGeometry(worldW, worldH)

            // Plane origin'ini alignment'a göre kaydır (DXF anchor point neredeyse orası plane'in hangi noktası olmalı)
            // Varsayılan: mesh origin = plane merkezi (0,0). Canvas merkezinde yazdık, mesh merkezi = metin merkezi.
            // halign/valign'e göre plane'i translate edelim — örn. halign=0 (left) ise plane'in sol kenarı anchor'a gelir
            let tx = 0, ty = 0
            if (!hizaliMi) {
              // Varsayılan: baseline left → anchor sol-baseline, bizim mesh merkezi metin merkezinde
              // Plane'i sağa ve yukarı kaydır (anchor sol-alt köşeye denk gelir)
              tx = worldW / 2
              ty = worldH / 2
            } else {
              // halign
              if (halign === 0) tx = worldW / 2         // left
              else if (halign === 2) tx = -worldW / 2   // right
              // 1=center, 4=middle → 0
              // valign
              if (valign === 1) ty = worldH / 2         // bottom
              else if (valign === 3) ty = -worldH / 2   // top
              // 0=baseline → biraz yukarı (baseline glyph descent'i üstünde)
              if (valign === 0) ty = worldH * 0.25
              // 2=middle → 0
            }
            planeGeom.translate(tx, ty, 0)
            const mat = new three.MeshBasicMaterial({ map: tex, transparent: true, side: three.DoubleSide, depthTest: false })
            const mesh = new three.Mesh(planeGeom, mat)
            mesh.position.set(p.x, p.y, 0)
            mesh.rotation.z = rotRad
            mesh.renderOrder = 10
            mesh.userData = {
              id: entity.handle || `text-${eklenen}`, type: sembolMu ? 'SEMBOL' : 'TEXT',
              layerId: entity.layer || 'default', selectable: true,
              text: txt, originalColor: col, halign, valign,
              state: { selected: false, hovered: false },
            }
            entitiesGroup.add(mesh)
            eklenen++
          }
        }

        setEntitySayi(eklenen)

        // Box3 ile kesin bounds hesapla
        const box = new three.Box3()
        entitiesGroup.updateMatrixWorld(true)
        box.setFromObject(entitiesGroup)
        if (isFinite(box.min.x) && isFinite(box.max.x) && box.min.x !== box.max.x) {
          const dx = box.max.x - box.min.x
          const dy = box.max.y - box.min.y
          const cx = (box.min.x + box.max.x) / 2
          const cy = (box.min.y + box.max.y) / 2
          const pad = 1.15
          const halfW = Math.max(dx, dy * aspect) * 0.5 * pad
          const halfH = halfW / aspect
          camera.left = -halfW; camera.right = halfW
          camera.top = halfH; camera.bottom = -halfH
          camera.position.set(cx, cy, 100)
          camera.lookAt(cx, cy, 0)
          camera.zoom = 1
          camera.updateProjectionMatrix()
          console.info('[DxfSahne] fit view', { cx, cy, dx, dy, halfW, halfH, bounds: box })
          // İlk entity örneği
          const ilk = entitiesGroup.children.find(c => c.userData && !c.userData._test)
          if (ilk) {
            const posAttr = ilk.geometry?.getAttribute?.('position')
            console.info('[DxfSahne] ilk entity:', {
              type: ilk.type, userDataType: ilk.userData.type,
              materialType: ilk.material?.type,
              materialColor: ilk.material?.color?.getHexString?.(),
              firstPos: posAttr ? [posAttr.getX(0), posAttr.getY(0), posAttr.getZ(0)] : null,
              objPos: [ilk.position.x, ilk.position.y, ilk.position.z],
              visible: ilk.visible,
            })
          }
        } else {
          console.warn('[DxfSahne] bounds geçersiz — varsayılan kamera', { box, eklenen })
        }

        renderer.render(scene, camera)
        setYukleniyor(false)

        // ── Pan + Zoom (fare) ──
        let panBasladi = false
        const panStart = { x: 0, y: 0 }
        const camStart = { x: 0, y: 0 }
        const el = renderer.domElement
        const pxPerWorld = () => height / (camera.top - camera.bottom)

        el.addEventListener('mousedown', (e) => {
          if (e.button !== 0 || paintRenk) return
          panBasladi = true
          panStart.x = e.clientX; panStart.y = e.clientY
          camStart.x = camera.position.x; camStart.y = camera.position.y
        })
        window.addEventListener('mousemove', (e) => {
          if (!panBasladi) return
          const ppw = pxPerWorld()
          const dx = (e.clientX - panStart.x) / ppw
          const dy = (e.clientY - panStart.y) / ppw
          camera.position.x = camStart.x - dx
          camera.position.y = camStart.y + dy
          renderer.render(scene, camera)
        })
        window.addEventListener('mouseup', () => { panBasladi = false })
        el.addEventListener('wheel', (e) => {
          e.preventDefault()
          const zoomFactor = e.deltaY > 0 ? 1.1 : 1 / 1.1
          const rect = el.getBoundingClientRect()
          const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
          const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1
          // Zoom öncesi fare altındaki world noktası
          const before = new three.Vector3(ndcX, ndcY, 0).unproject(camera)
          // Frustumu orantılı daralt/genişlet
          camera.left *= zoomFactor
          camera.right *= zoomFactor
          camera.top *= zoomFactor
          camera.bottom *= zoomFactor
          camera.updateProjectionMatrix()
          // Zoom sonrası aynı NDC'nin world karşılığı
          const after = new three.Vector3(ndcX, ndcY, 0).unproject(camera)
          // Kamerayı kaydır: fare altındaki world noktası sabit kalır
          camera.position.x += before.x - after.x
          camera.position.y += before.y - after.y
          camera.updateProjectionMatrix()
          renderer.render(scene, camera)
        }, { passive: false })

        // Resize
        const onResize = () => {
          const w = containerRef.current.clientWidth
          const h = containerRef.current.clientHeight
          renderer.setSize(w, h)
          const as = w / h
          const halfW = (camera.right - camera.left) / 2
          const halfH = (camera.top - camera.bottom) / 2
          const cx = camera.position.x, cy = camera.position.y
          const sz = Math.max(halfW / as, halfH)
          camera.left = cx - sz * as; camera.right = cx + sz * as
          camera.top = cy + sz; camera.bottom = cy - sz
          camera.updateProjectionMatrix()
          renderer.render(scene, camera)
        }
        const ro = new ResizeObserver(onResize)
        ro.observe(containerRef.current)

        console.info(`[DxfSahne] ${eklenen} entity yüklendi`, { bounds })
      } catch (err) {
        console.error('[DxfSahne] hata:', err)
        if (!cancelled) setHata(err.message || 'DXF yüklenemedi')
        setYukleniyor(false)
      }
    }
    yukle()

    return () => {
      cancelled = true
      if (rendererRef.current) {
        try { rendererRef.current.dispose() } catch {}
        rendererRef.current = null
      }
    }
  }, [src])

  // ── Tıklama — direk bul ──
  const handleClick = useCallback((e) => {
    if (paintRenk) return
    const three = threeRef.current, scene = sceneRef.current, camera = cameraRef.current
    const renderer = rendererRef.current
    if (!three || !scene || !camera || !renderer) return
    const rect = renderer.domElement.getBoundingClientRect()
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1
    const rc = new three.Raycaster()
    rc.params.Line = { threshold: 3 }
    rc.params.Sprite = { threshold: 1 }
    rc.setFromCamera(new three.Vector2(ndcX, ndcY), camera)
    const hits = rc.intersectObjects(entitiesGroupRef.current.children, false)
    if (!hits.length) return
    // hit.point → kamera dünya sistemindeki pozisyon (entity relative space)
    // Direkler UTM koordinatlarında, offset'i ekleyerek UTM world'e çevir
    const offsetX = entitiesGroupRef.current.userData?.offsetX || 0
    const offsetY = entitiesGroupRef.current.userData?.offsetY || 0
    const wx = hits[0].point.x + offsetX
    const wy = hits[0].point.y + offsetY
    let nearest = null, minD = 15
    for (const d of direkler) {
      const dd = Math.hypot(d.x - wx, d.y - wy)
      if (dd < minD) { minD = dd; nearest = d }
    }
    if (nearest) onDirekTikla?.({ ...nearest, mesafe: minD })
  }, [paintRenk, direkler, onDirekTikla])

  // ── Boyama (AutoCAD window/crossing) ──
  const handlePaintDown = useCallback((e) => {
    if (e.button !== 0 || !paintRenk) return
    e.stopPropagation(); e.preventDefault()
    const r = paintOverlayRef.current.getBoundingClientRect()
    paintStartRef.current = { x: e.clientX - r.left, y: e.clientY - r.top }
    setPaintRect(null)
  }, [paintRenk])
  const handlePaintMove = useCallback((e) => {
    if (!paintStartRef.current) return
    e.stopPropagation(); e.preventDefault()
    const r = paintOverlayRef.current.getBoundingClientRect()
    const cx = e.clientX - r.left, cy = e.clientY - r.top
    const sx = paintStartRef.current.x, sy = paintStartRef.current.y
    setPaintRect({
      x1: Math.min(sx, cx), y1: Math.min(sy, cy),
      x2: Math.max(sx, cx), y2: Math.max(sy, cy),
      yon: cx >= sx ? 'sag' : 'sol',
    })
  }, [])
  const handlePaintUp = useCallback(() => {
    const rect = paintRect
    const yon = rect?.yon
    paintStartRef.current = null
    setPaintRect(null)
    if (!rect || !paintRenk) return
    if (Math.abs(rect.x2 - rect.x1) < 3 && Math.abs(rect.y2 - rect.y1) < 3) return
    const three = threeRef.current, camera = cameraRef.current, renderer = rendererRef.current
    const scene = sceneRef.current
    if (!three || !camera || !renderer || !scene) return
    const bbox = renderer.domElement.getBoundingClientRect()

    // Ekran rect'i world'e çevir
    const toWorld = (sx, sy) => {
      const ndcX = (sx / bbox.width) * 2 - 1
      const ndcY = -((sy / bbox.height) * 2 - 1)
      const v = new three.Vector3(ndcX, ndcY, 0).unproject(camera)
      return { x: v.x, y: v.y }
    }
    const c1 = toWorld(rect.x1, rect.y1)
    const c2 = toWorld(rect.x2, rect.y2)
    const wRect = {
      minX: Math.min(c1.x, c2.x), maxX: Math.max(c1.x, c2.x),
      minY: Math.min(c1.y, c2.y), maxY: Math.max(c1.y, c2.y),
    }
    const inR = (x, y) => x >= wRect.minX && x <= wRect.maxX && y >= wRect.minY && y <= wRect.maxY

    const hex = paintRenk.hex
    let boyanan = 0
    const v = new three.Vector3()
    for (const obj of entitiesGroupRef.current.children) {
      if (!obj.userData?.selectable) continue
      const geom = obj.geometry
      const posAttr = geom?.getAttribute?.('position')
      if (!posAttr) continue
      obj.updateMatrixWorld()

      let secili = false
      const count = posAttr.count
      const wp = new Array(count)
      for (let i = 0; i < count; i++) {
        v.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).applyMatrix4(obj.matrixWorld)
        wp[i] = { x: v.x, y: v.y }
      }
      if (yon === 'sag') {
        secili = count > 0 && wp.every(p => inR(p.x, p.y))
      } else {
        if (obj.type === 'Line' || obj.type === 'LineLoop') {
          const maxI = obj.type === 'LineLoop' ? count : count - 1
          for (let i = 0; i < maxI; i++) {
            const j = obj.type === 'LineLoop' ? (i + 1) % count : i + 1
            if (segCrossesRect(wp[i], wp[j], wRect)) { secili = true; break }
          }
        } else {
          // Mesh (text) veya diğer — herhangi bir vertex rect içinde
          for (const p of wp) if (inR(p.x, p.y)) { secili = true; break }
        }
      }

      if (!secili) continue
      try {
        const m = Array.isArray(obj.material) ? obj.material[0] : obj.material
        if (m?.color?.set) {
          m.color.set(hex)
          m.needsUpdate = true
        }
        // Text mesh ise canvas texture'ı yeniden çiz (aynı font ile)
        if (obj.userData?.type === 'TEXT' && m?.map && obj.userData.text !== undefined) {
          const txt = obj.userData.text
          const sembolMu = txt.length === 1 && SEMBOL_KARAKTERLER.has(txt)
          const fontAdi = sembolMu ? 'B_CAD' : 'T_ROMANS'
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          const fontPx = 64
          const fontStr = `${fontPx}px ${fontAdi}, sans-serif`
          ctx.font = fontStr
          const mm = ctx.measureText(txt)
          canvas.width = Math.max(1, Math.ceil(mm.width)) + 8
          canvas.height = fontPx + 16
          ctx.font = fontStr
          ctx.fillStyle = `#${hex.toString(16).padStart(6, '0')}`
          ctx.textBaseline = 'top'
          ctx.fillText(txt, 4, 4)
          m.map.dispose()
          m.map = new three.CanvasTexture(canvas)
          m.map.needsUpdate = true
          m.color.set(0xffffff)
        }
        obj.userData.state = { ...obj.userData.state, selected: true }
        boyanan++
      } catch (err) { console.error('[paint] err:', err) }
    }
    renderer.render(scene, camera)
    console.info(`[DxfSahne paint] ${boyanan} entity boyandı (${yon === 'sag' ? 'window' : 'crossing'}, ${paintRenk.ad})`)
  }, [paintRect, paintRenk])

  const zoomIn = () => {
    const c = cameraRef.current; if (!c) return
    c.zoom *= 1.3; c.updateProjectionMatrix()
    rendererRef.current?.render(sceneRef.current, c)
  }
  const zoomOut = () => {
    const c = cameraRef.current; if (!c) return
    c.zoom /= 1.3; c.updateProjectionMatrix()
    rendererRef.current?.render(sceneRef.current, c)
  }
  const resetView = () => {
    const c = cameraRef.current; if (!c) return
    c.zoom = 1; c.updateProjectionMatrix()
    rendererRef.current?.render(sceneRef.current, c)
  }

  return (
    <div className="relative w-full h-full flex flex-col" style={{ minHeight: 400 }}>
      {yukleniyor && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-20">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs text-white">DXF yükleniyor…</span>
          </div>
        </div>
      )}
      {hata && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-20 text-red-400 text-sm p-4 text-center">
          <div>
            <p className="font-medium">DXF yüklenemedi</p>
            <p className="text-xs opacity-80 mt-1">{hata}</p>
          </div>
        </div>
      )}

      {/* Renk paleti — sol üst */}
      {!yukleniyor && !hata && (
        <div className="absolute top-2 left-2 z-30 flex flex-col gap-1.5">
          <div className="flex items-center gap-1 rounded-lg bg-white/90 px-1.5 py-1.5 shadow-sm border border-border">
            {PAINT_RENKLER.map(r => (
              <button key={r.id}
                onClick={() => setPaintRenk(p => p?.id === r.id ? null : r)}
                className={cn('h-6 w-6 rounded border-2 transition-all',
                  paintRenk?.id === r.id ? 'border-gray-800 ring-2 ring-offset-1 ring-gray-800 scale-110' : 'border-white/80 hover:scale-105')}
                style={{ background: r.renk }}
                title={`${r.ad} — sağa: kapsama, sola: kesişim`}
              />
            ))}
            {paintRenk && (
              <button onClick={() => setPaintRenk(null)} className="ml-1 rounded p-1 text-muted-foreground hover:bg-muted" title="Kapat">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          {paintRenk && (
            <div className="rounded-md bg-gray-900/90 px-2 py-1 text-[10px] text-white shadow">
              <div className="flex items-center gap-2">
                <span style={{ color: paintRenk.renk }}>●</span>
                <span className="font-medium">{paintRenk.ad}</span>
              </div>
              <div className="text-[9px] text-white/70 mt-0.5">→ Kapsama • ← Kesişim</div>
            </div>
          )}
        </div>
      )}

      {/* Zoom kontrolleri — sağ üst */}
      {!yukleniyor && !hata && (
        <div className="absolute top-2 right-2 z-30 flex items-center gap-1 rounded-lg bg-white/90 px-1.5 py-1 shadow-sm border border-border">
          <button onClick={zoomIn} className="rounded p-1 hover:bg-muted" title="Yakınlaştır"><ZoomIn className="h-3.5 w-3.5" /></button>
          <button onClick={zoomOut} className="rounded p-1 hover:bg-muted" title="Uzaklaştır"><ZoomOut className="h-3.5 w-3.5" /></button>
          <button onClick={resetView} className="rounded p-1 hover:bg-muted" title="Sıfırla"><RotateCcw className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Boyama overlay */}
      {paintRenk && !yukleniyor && (
        <div ref={paintOverlayRef}
          onPointerDown={handlePaintDown}
          onPointerMove={handlePaintMove}
          onPointerUp={handlePaintUp}
          style={{ position: 'absolute', inset: 0, zIndex: 12, cursor: 'crosshair', touchAction: 'none' }} />
      )}
      {paintRenk && paintRect && (
        <div style={{
          position: 'absolute', pointerEvents: 'none', zIndex: 13,
          left: paintRect.x1, top: paintRect.y1,
          width: paintRect.x2 - paintRect.x1, height: paintRect.y2 - paintRect.y1,
          border: `2px ${paintRect.yon === 'sag' ? 'solid' : 'dashed'} ${paintRect.yon === 'sag' ? '#3b82f6' : '#22c55e'}`,
          background: paintRect.yon === 'sag' ? 'rgba(59,130,246,0.2)' : 'rgba(34,197,94,0.2)',
        }} />
      )}

      {/* Entity sayısı - sol alt */}
      {!yukleniyor && !hata && (
        <div className="absolute bottom-2 left-2 z-10 rounded bg-gray-900/70 px-2 py-1 text-[10px] text-white">
          {entitySayi} entity
        </div>
      )}

      <div ref={containerRef} onClick={handleClick}
        className="flex-1" style={{ minHeight: 400, width: '100%', background: '#000' }} />
    </div>
  )
}
