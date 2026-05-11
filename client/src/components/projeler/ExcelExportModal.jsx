import { useState } from 'react'
import { X, Download, Loader2, CheckSquare, Square } from 'lucide-react'
import api from '@/api/client'
import { cn } from '@/lib/utils'

// Excel'e aktarılabilir sütun katalogu — backend PROJE_SELECT'inde olan alanlar
// Default seçili: en sık kullanılan 8 alan; diğerleri kullanıcı seçimine bırakılır.
const KOLONLAR = [
  { accessor: 'excel_sira',                 baslik: 'Sıra',                   varsayilan: true },
  { accessor: 'proje_no',                   baslik: 'Proje No',               varsayilan: true },
  { accessor: 'proje_tipi',                 baslik: 'Tipi',                   varsayilan: true },
  { accessor: 'musteri_adi',                baslik: 'Proje Adı',              varsayilan: true },
  { accessor: 'bolge_adi',                  baslik: 'Bölge',                  varsayilan: true },
  { accessor: 'il',                         baslik: 'İl' },
  { accessor: 'ilce',                       baslik: 'İlçe' },
  { accessor: 'mahalle',                    baslik: 'Mahalle' },
  { accessor: 'adres',                      baslik: 'Adres' },
  { accessor: 'baslama_tarihi',             baslik: 'Başlama',                varsayilan: true },
  { accessor: 'bitis_tarihi',               baslik: 'Bitiş',                  varsayilan: true },
  { accessor: 'teslim_tarihi',              baslik: 'Yer Teslim Tarihi' },
  { accessor: 'kesinti_suresi',             baslik: 'Kesinti Süresi (gün)' },
  { accessor: 'proje_asama',                baslik: 'Proje Aşaması' },
  { accessor: 'saha_asama',                 baslik: 'Saha Aşaması' },
  { accessor: 'aktif_adim_adi',             baslik: 'Aktif Adım' },
  { accessor: 'aktif_sorumlu_adi',          baslik: 'Aktif Sorumlu' },
  { accessor: 'tamamlanma_yuzdesi',         baslik: 'Tamamlanma %' },
  { accessor: 'kesif_toplam_tutar',         baslik: 'Keşif Toplam (raw)' },
  { accessor: 'kesif_toplam_tutar_artirimli', baslik: 'Keşif (artırımlı)',    varsayilan: true },
  { accessor: 'kesif_ilerleme_tutar',       baslik: 'İlerleme (raw)' },
  { accessor: 'kesif_ilerleme_tutar_artirimli', baslik: 'İlerleme (artırımlı)' },
  { accessor: 'metraj_kesif_tutar',         baslik: 'Metraj Keşif' },
  { accessor: 'metraj_ilerleme_tutar',      baslik: 'Metraj İlerleme' },
  { accessor: 'ihale_id',                   baslik: 'İhale ID' },
  { accessor: 'oncelik',                    baslik: 'Öncelik' },
  { accessor: 'ekip_adi',                   baslik: 'Ekip' },
  { accessor: 'durum',                      baslik: 'Durum (raw)' },
  { accessor: 'olusturma_tarihi',           baslik: 'Oluşturma' },
  { accessor: 'guncelleme_tarihi',          baslik: 'Güncelleme' },
]

export default function ExcelExportModal({ ids, onKapat }) {
  const varsayilanKodlar = new Set(KOLONLAR.filter(k => k.varsayilan).map(k => k.accessor))
  const [secilenler, setSecilenler] = useState(varsayilanKodlar)
  const [baslik, setBaslik] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState(null)

  const toggle = (accessor) => {
    setSecilenler(prev => {
      const yeni = new Set(prev)
      if (yeni.has(accessor)) yeni.delete(accessor)
      else yeni.add(accessor)
      return yeni
    })
  }
  const tumunuSec = () => setSecilenler(new Set(KOLONLAR.map(k => k.accessor)))
  const hicbiriniSec = () => setSecilenler(new Set())
  const varsayilani = () => setSecilenler(new Set(varsayilanKodlar))

  const indir = async () => {
    if (secilenler.size === 0) { setHata('En az bir sütun seçin'); return }
    setYukleniyor(true); setHata(null)
    try {
      // Seçilen sütunları KOLONLAR sırasında tut (kullanıcı tıklama sırası değil)
      const kolonlar = KOLONLAR.filter(k => secilenler.has(k.accessor)).map(k => ({ accessor: k.accessor, baslik: k.baslik }))
      const blob = await api.post('/projeler/excel-export', { ids, kolonlar, baslik: baslik.trim() }, { responseType: 'blob' })
      const url = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob]))
      const a = document.createElement('a')
      const tarih = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `projeler-${tarih}.xlsx`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      onKapat?.()
    } catch (e) {
      setHata(e?.response?.data?.error || e.message || 'İndirme sırasında hata')
    } finally {
      setYukleniyor(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onKapat}>
      <div
        className="w-full max-w-2xl rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold">Excel'e Aktar — {ids.length} proje</h2>
          <button onClick={onKapat} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-border/40 space-y-2">
          <label className="block text-xs font-medium text-muted-foreground">
            Excel başlığı <span className="font-normal text-muted-foreground/70">(opsiyonel — dosyanın en üst satırında görünür)</span>
          </label>
          <input
            type="text"
            value={baslik}
            onChange={(e) => setBaslik(e.target.value)}
            placeholder="Örn. KET Projeleri — 2026 Mayıs Aktarımı"
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
                <label
                  key={k.accessor}
                  className={cn(
                    'flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/40',
                    secili && 'bg-blue-50'
                  )}
                >
                  {secili
                    ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                    : <Square className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />}
                  <input
                    type="checkbox"
                    checked={secili}
                    onChange={() => toggle(k.accessor)}
                    className="hidden"
                  />
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
          <button
            onClick={onKapat}
            disabled={yukleniyor}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            İptal
          </button>
          <button
            onClick={indir}
            disabled={yukleniyor || secilenler.size === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {yukleniyor
              ? <><Loader2 className="h-4 w-4 animate-spin" /> İndiriliyor...</>
              : <><Download className="h-4 w-4" /> İndir</>}
          </button>
        </div>
      </div>
    </div>
  )
}
