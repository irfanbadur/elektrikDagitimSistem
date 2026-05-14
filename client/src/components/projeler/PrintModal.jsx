import { useState } from 'react'
import { X, Printer, CheckSquare, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

// Yazdırılabilir sütun katalogu — ExcelExportModal ile aynı set
const KOLONLAR = [
  { accessor: 'excel_sira',                 baslik: 'Sıra',                   varsayilan: true,  genislik: 40 },
  { accessor: 'proje_no',                   baslik: 'Proje No',               varsayilan: true,  genislik: 100 },
  { accessor: 'proje_tipi',                 baslik: 'Tipi',                   varsayilan: true,  genislik: 50 },
  { accessor: 'musteri_adi',                baslik: 'Proje Adı',              varsayilan: true,  genislik: 220 },
  { accessor: 'bolge_adi',                  baslik: 'Bölge',                  varsayilan: true,  genislik: 90 },
  { accessor: 'il',                         baslik: 'İl',                     genislik: 70 },
  { accessor: 'ilce',                       baslik: 'İlçe',                   genislik: 80 },
  { accessor: 'mahalle',                    baslik: 'Mahalle',                genislik: 100 },
  { accessor: 'adres',                      baslik: 'Adres',                  genislik: 200 },
  { accessor: 'baslama_tarihi',             baslik: 'Başlama',                varsayilan: true,  genislik: 70 },
  { accessor: 'bitis_tarihi',               baslik: 'Bitiş',                  varsayilan: true,  genislik: 70 },
  { accessor: 'teslim_tarihi',              baslik: 'Yer Teslim Tarihi',      genislik: 90 },
  { accessor: 'kesinti_suresi',             baslik: 'Kesinti (gün)',          genislik: 70 },
  { accessor: 'proje_asama',                baslik: 'Proje Aşaması',          genislik: 100 },
  { accessor: 'saha_asama',                 baslik: 'Saha Aşaması',           genislik: 100 },
  { accessor: 'aktif_adim_adi',             baslik: 'Aktif Adım',             genislik: 110 },
  { accessor: 'aktif_sorumlu_adi',          baslik: 'Aktif Sorumlu',          genislik: 110 },
  { accessor: 'tamamlanma_yuzdesi',         baslik: 'Tamamlanma %',           genislik: 70 },
  { accessor: 'kesif_toplam_tutar_artirimli', baslik: 'Keşif (₺)',            varsayilan: true,  genislik: 100, sayi: true },
  { accessor: 'kesif_ilerleme_tutar_artirimli', baslik: 'İlerleme (₺)',       genislik: 100, sayi: true },
  { accessor: 'metraj_kesif_tutar',         baslik: 'Metraj Keşif (₺)',       genislik: 100, sayi: true },
  { accessor: 'metraj_ilerleme_tutar',      baslik: 'Metraj İlerleme (₺)',    genislik: 100, sayi: true },
  { accessor: 'oncelik',                    baslik: 'Öncelik',                genislik: 60 },
  { accessor: 'ekip_adi',                   baslik: 'Ekip',                   genislik: 100 },
]

const dateFields = new Set(['baslama_tarihi', 'bitis_tarihi', 'teslim_tarihi'])

function formatHucre(p, k) {
  let v = p[k.accessor]
  if (v == null || v === '') return ''
  if (dateFields.has(k.accessor)) return String(v).slice(0, 10)
  if (k.sayi) {
    const n = Number(v)
    if (!Number.isFinite(n)) return String(v)
    return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return String(v)
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

export default function PrintModal({ projeler, onKapat }) {
  const varsayilan = new Set(KOLONLAR.filter(k => k.varsayilan).map(k => k.accessor))
  const [secilenler, setSecilenler] = useState(varsayilan)
  const [baslik, setBaslik] = useState('')
  const [hata, setHata] = useState(null)

  const toggle = (a) => setSecilenler(prev => {
    const y = new Set(prev); if (y.has(a)) y.delete(a); else y.add(a); return y
  })
  const tumunuSec = () => setSecilenler(new Set(KOLONLAR.map(k => k.accessor)))
  const hicbiriniSec = () => setSecilenler(new Set())
  const varsayilani = () => setSecilenler(new Set(varsayilan))

  const yazdir = () => {
    if (secilenler.size === 0) { setHata('En az bir sütun seçin'); return }
    if (!projeler?.length) { setHata('Seçili proje yok'); return }
    setHata(null)

    const kolonlar = KOLONLAR.filter(k => secilenler.has(k.accessor))
    const baslikHtml = baslik.trim()
      ? `<h2 style="margin:0 0 8px 0;text-align:center">${escapeHtml(baslik.trim())}</h2>`
      : ''

    const thead = `<tr>${kolonlar.map(k => `<th style="width:${k.genislik || 80}px">${escapeHtml(k.baslik)}</th>`).join('')}</tr>`
    const tbody = projeler.map(p =>
      `<tr>${kolonlar.map(k => `<td class="${k.sayi ? 'sayi' : ''}">${escapeHtml(formatHucre(p, k))}</td>`).join('')}</tr>`
    ).join('')

    const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>${escapeHtml(baslik.trim() || 'Projeler')}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 9px; color: #111; margin: 0; padding: 8px; }
  h2 { font-size: 14px; }
  .meta { color: #555; font-size: 9px; margin-bottom: 6px; text-align: center; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 1px solid #999; padding: 3px 5px; text-align: left; vertical-align: top; word-wrap: break-word; overflow: hidden; }
  th { background: #e7effa; font-weight: 700; font-size: 9px; }
  td.sayi { text-align: right; font-variant-numeric: tabular-nums; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
  tfoot { color: #777; font-size: 8px; }
  @media print {
    body { padding: 0; }
    .noprint { display: none; }
  }
</style>
</head>
<body>
  ${baslikHtml}
  <div class="meta">${projeler.length} proje · ${new Date().toLocaleString('tr-TR')}</div>
  <table>
    <thead>${thead}</thead>
    <tbody>${tbody}</tbody>
  </table>
  <script>window.addEventListener('load', () => { setTimeout(() => window.print(), 200); });</script>
</body>
</html>`

    const w = window.open('', '_blank')
    if (!w) { setHata('Yazdırma penceresi engellendi — pop-up\'a izin verin'); return }
    w.document.open(); w.document.write(html); w.document.close()
    onKapat?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onKapat}>
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold">Yazdır — {projeler?.length || 0} proje</h2>
          <button onClick={onKapat} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-border/40 space-y-2">
          <label className="block text-xs font-medium text-muted-foreground">
            Sayfa başlığı <span className="font-normal text-muted-foreground/70">(opsiyonel — üstte ortalı görünür)</span>
          </label>
          <input
            type="text"
            value={baslik}
            onChange={(e) => setBaslik(e.target.value)}
            placeholder="Örn. KET Projeleri — 2026 Mayıs Listesi"
            className="w-full rounded-md border border-input bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex items-center gap-2 text-xs pt-1">
            <span className="text-muted-foreground">Sütun seçimi ({secilenler.size}/{KOLONLAR.length}):</span>
            <button onClick={tumunuSec} className="text-primary hover:underline">Tümünü Seç</button>
            <span className="text-muted-foreground/40">|</span>
            <button onClick={hicbiriniSec} className="text-primary hover:underline">Hiçbirini</button>
            <span className="text-muted-foreground/40">|</span>
            <button onClick={varsayilani} className="text-primary hover:underline">Varsayılan</button>
          </div>
        </div>

        <div className="px-5 py-3 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {KOLONLAR.map(k => {
              const secili = secilenler.has(k.accessor)
              return (
                <label key={k.accessor}
                  className={cn('flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/40',
                    secili && 'bg-blue-50')}>
                  {secili
                    ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                    : <Square className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />}
                  <input type="checkbox" checked={secili} onChange={() => toggle(k.accessor)} className="hidden" />
                  <span className="truncate">{k.baslik}</span>
                </label>
              )
            })}
          </div>
        </div>

        {hata && (
          <div className="mx-5 mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {hata}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button onClick={onKapat}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted">
            İptal
          </button>
          <button onClick={yazdir} disabled={secilenler.size === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            <Printer className="h-4 w-4" /> Yazdır
          </button>
        </div>
      </div>
    </div>
  )
}
