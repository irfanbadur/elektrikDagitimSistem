import { useState } from 'react'
import { Plus, Trash2, BarChart3, Ruler, MapPin, FileSpreadsheet, Upload, Loader2, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useHakEdisMetraj, useHakEdisMetrajOzet, useHakEdisMetrajEkle, useHakEdisMetrajGuncelle, useHakEdisMetrajSil } from '@/hooks/useHakEdisMetraj'
import api from '@/api/client'
import { cn } from '@/lib/utils'

const DURUM_SECENEKLERI = ['Yeni', 'Mevcut', 'Demontaj']
const DURUM_RENK = { Yeni: 'text-emerald-600', Mevcut: 'text-blue-600', Demontaj: 'text-red-600' }

function DirekSatiri({ satir: s, acik, onToggle, onGuncelle, onSil, secili, onSecim }) {
  // notlar alanından malzeme ve iletken parse et
  const notSatirlari = (s.notlar || '').split('\n').filter(Boolean)
  const malzemeSatirlari = notSatirlari.filter(n => !n.startsWith('Iletken:'))
  const iletkenSatirlari = notSatirlari.filter(n => n.startsWith('Iletken:')).map(n => n.replace('Iletken: ', ''))

  return (
    <>
      {/* Ana satır — Direk accordion */}
      <div
        onClick={onToggle}
        className={cn(
          'flex items-center gap-2 px-3 py-2 border-b border-input/50 cursor-pointer transition-colors',
          acik ? 'bg-primary/5' : 'hover:bg-muted/30',
          secili && 'bg-red-50/50'
        )}
      >
        <input type="checkbox" checked={secili}
          onClick={e => e.stopPropagation()}
          onChange={e => onSecim(e.target.checked)}
          className="h-3.5 w-3.5 accent-primary cursor-pointer" />
        {acik ? <ChevronDown className="h-3.5 w-3.5 text-primary" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="font-mono text-xs font-bold text-primary w-10">{s.nokta1 || '-'}</span>
        <span className="text-[10px] text-muted-foreground">→</span>
        <span className="font-mono text-xs text-blue-600 w-10">{s.nokta2 || '-'}</span>
        <span className={cn('text-[10px] font-medium w-14', DURUM_RENK[s.nokta_durum])}>{s.nokta_durum || '-'}</span>
        <span className="text-[10px] text-muted-foreground w-16 truncate">{s.direk_tur || '-'}</span>
        <span className="text-[10px] font-mono text-emerald-600 w-14">{s.direk_tip || '-'}</span>
        <span className="text-[10px] tabular-nums font-medium w-12 text-right">{s.ara_mesafe ? `${s.ara_mesafe}m` : '-'}</span>
        <span className="text-[10px] text-muted-foreground flex-1 truncate ml-2">{s.ag_iletken || ''}</span>
        <span className="text-[9px] text-muted-foreground/60">{malzemeSatirlari.length} mlz</span>
        <button onClick={e => { e.stopPropagation(); onSil() }} className="rounded p-0.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 ml-1" title="Sil">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Detay paneli — accordion açıkken */}
      {acik && (
        <div className="border-b border-input bg-muted/10 px-4 py-3">
          {/* Üst bilgi satırı — düzenlenebilir alanlar */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-[10px]">
            <label className="flex items-center gap-1">
              <span className="text-muted-foreground">Durum:</span>
              <select value={s.nokta_durum || ''} onChange={e => onGuncelle('nokta_durum', e.target.value)}
                className="rounded border border-input bg-white px-1 py-0.5 text-[10px] focus:outline-none">
                <option value="">-</option>
                {DURUM_SECENEKLERI.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <span className="text-muted-foreground">Tur:</span>
              <input value={s.direk_tur || ''} onChange={e => onGuncelle('direk_tur', e.target.value)}
                className="w-24 rounded border border-input bg-white px-1 py-0.5 text-[10px] focus:outline-none" />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-muted-foreground">Tip:</span>
              <input value={s.direk_tip || ''} onChange={e => onGuncelle('direk_tip', e.target.value)}
                className="w-20 rounded border border-input bg-white px-1 py-0.5 text-[10px] font-mono focus:outline-none" />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-muted-foreground">Mesafe:</span>
              <input type="number" value={s.ara_mesafe || ''} onChange={e => onGuncelle('ara_mesafe', Number(e.target.value) || 0)}
                className="w-16 rounded border border-input bg-white px-1 py-0.5 text-[10px] text-right focus:outline-none" />
              <span className="text-muted-foreground">m</span>
            </label>
          </div>

          {/* İki sütunlu detay: Malzemeler | İletken */}
          <div className="flex gap-3" style={{ minHeight: 60 }}>
            {/* SOL — Malzemeler */}
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-bold text-red-600 uppercase mb-1">Malzemeler ({malzemeSatirlari.length})</div>
              {malzemeSatirlari.length === 0 ? (
                <p className="text-[10px] text-muted-foreground/50 italic">Malzeme yok</p>
              ) : (
                <div className="space-y-0.5">
                  {malzemeSatirlari.map((m, i) => (
                    <div key={i} className="flex items-center gap-1 text-[10px] py-0.5 border-b border-border/10">
                      <span className="flex-1 truncate" title={m}>{m}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SAĞ — İletken */}
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-bold text-blue-600 uppercase mb-1">Iletken ({iletkenSatirlari.length})</div>
              {iletkenSatirlari.length === 0 ? (
                <p className="text-[10px] text-muted-foreground/50 italic">Iletken yok</p>
              ) : (
                <div className="space-y-0.5">
                  {iletkenSatirlari.map((il, i) => (
                    <div key={i} className="flex items-center gap-1 text-[10px] py-0.5 border-b border-border/10">
                      <span className="flex-1 truncate text-blue-700 font-medium" title={il}>{il}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function ProjeHakEdis({ projeId }) {
  const { data: satirlar, isLoading } = useHakEdisMetraj(projeId)
  const { data: ozet } = useHakEdisMetrajOzet(projeId)
  const ekle = useHakEdisMetrajEkle(projeId)
  const guncelle = useHakEdisMetrajGuncelle(projeId)
  const sil = useHakEdisMetrajSil(projeId)
  const qc = useQueryClient()
  const [yeniSatir, setYeniSatir] = useState(false)
  const [seciliIdler, setSeciliIdler] = useState(new Set())
  const [acikIdler, setAcikIdler] = useState(new Set())
  const [excelYukleniyor, setExcelYukleniyor] = useState(false)
  const [excelDosyaId, setExcelDosyaId] = useState(null)

  const handleYeniSatir = async () => {
    await ekle.mutateAsync({ nokta_durum: 'Yeni', kaynak: 'manuel' })
    setYeniSatir(false)
  }

  const handleSablonKopyala = async () => {
    setExcelYukleniyor(true)
    try {
      const res = await api.post(`/hak-edis-metraj/${projeId}/sablon-kopyala`)
      const data = res.data || res
      setExcelDosyaId(data.dosya_id)
      qc.invalidateQueries({ queryKey: ['adim-dosyalar'] })
      alert(data.yeni ? 'Sablon kopyalandi.' : 'Sablon zaten mevcut.')
    } catch (err) { alert(err.message || '') }
    finally { setExcelYukleniyor(false) }
  }

  const handleExcelAktar = async () => {
    setExcelYukleniyor(true)
    try {
      const sRes = await api.post(`/hak-edis-metraj/${projeId}/sablon-kopyala`)
      setExcelDosyaId((sRes.data || sRes).dosya_id)
      const aRes = await api.post(`/hak-edis-metraj/${projeId}/excel-aktar`)
      alert(`${(aRes.data || aRes).aktarilan_satir} satir Excel'e aktarildi.`)
    } catch (err) { alert(err.message || '') }
    finally { setExcelYukleniyor(false) }
  }

  const handleGuncelle = (id, alan, deger) => guncelle.mutate({ id, [alan]: deger })

  const toggleAcik = (id) => setAcikIdler(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  return (
    <div>
      {/* Baslik */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Sebeke Metraji</h3>
          <p className="text-xs text-muted-foreground">Direk bazli malzeme ve iletken listesi</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleSablonKopyala} disabled={excelYukleniyor}
            className="flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
            {excelYukleniyor ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />} Sablon
          </button>
          <button onClick={handleExcelAktar} disabled={excelYukleniyor || !satirlar?.length}
            className="flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50">
            {excelYukleniyor ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Excel
          </button>
          {excelDosyaId && (
            <a href={`/api/dosya/${excelDosyaId}/indir`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg border border-input px-2.5 py-1.5 text-xs text-primary hover:bg-primary/5">
              <ExternalLink className="h-3.5 w-3.5" /> Indir
            </a>
          )}
          <button onClick={handleYeniSatir} className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" /> Ekle
          </button>
          {seciliIdler.size > 0 && (
            <button onClick={async () => {
              if (!window.confirm(`${seciliIdler.size} satir silinecek?`)) return
              for (const id of seciliIdler) { await sil.mutateAsync(id) }
              setSeciliIdler(new Set())
            }} className="flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100">
              <Trash2 className="h-3.5 w-3.5" /> Sil ({seciliIdler.size})
            </button>
          )}
        </div>
      </div>

      {/* Ozet */}
      {ozet && (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-input bg-card px-3 py-2">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Ruler className="h-3 w-3" />Direk</div>
            <p className="text-lg font-bold">{ozet.toplam_satir || 0}</p>
          </div>
          <div className="rounded-lg border border-input bg-card px-3 py-2">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><MapPin className="h-3 w-3" />Mesafe</div>
            <p className="text-lg font-bold">{(ozet.toplam_mesafe || 0).toLocaleString('tr-TR')} m</p>
          </div>
          <div className="rounded-lg border border-input bg-card px-3 py-2">
            <p className="text-[10px] text-muted-foreground">Yeni</p>
            <p className="text-lg font-bold text-emerald-600">{ozet.yeni_nokta || 0}</p>
          </div>
          <div className="rounded-lg border border-input bg-card px-3 py-2">
            <p className="text-[10px] text-muted-foreground">Demontaj</p>
            <p className="text-lg font-bold text-red-600">{ozet.demontaj_nokta || 0}</p>
          </div>
        </div>
      )}

      {/* Direk listesi — Accordion */}
      <div className="rounded-lg border border-input bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-input text-[10px] font-semibold text-muted-foreground">
          <input type="checkbox"
            checked={satirlar?.length > 0 && seciliIdler.size === satirlar.length}
            onChange={e => setSeciliIdler(e.target.checked ? new Set(satirlar.map(s => s.id)) : new Set())}
            className="h-3.5 w-3.5 accent-primary cursor-pointer" />
          <span className="w-4"></span>
          <span className="w-10">1.Nokta</span>
          <span className="w-3"></span>
          <span className="w-10">2.Nokta</span>
          <span className="w-14">Durum</span>
          <span className="w-16">Tur</span>
          <span className="w-14">Tip</span>
          <span className="w-12 text-right">Mesafe</span>
          <span className="flex-1 ml-2">Iletken</span>
          <span className="w-10 text-right">Mlz</span>
          <span className="w-6"></span>
        </div>

        {/* Satırlar */}
        {isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Yukleniyor...</div>
        ) : !satirlar?.length ? (
          <div className="px-4 py-12 text-center">
            <BarChart3 className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">Sebeke metraji bos</p>
            <p className="mt-1 text-xs text-muted-foreground/70">Hak Edis Krokisi uzerinden direk tikla veya manuel ekle</p>
          </div>
        ) : (
          satirlar.map(s => (
            <DirekSatiri
              key={s.id}
              satir={s}
              acik={acikIdler.has(s.id)}
              onToggle={() => toggleAcik(s.id)}
              onGuncelle={(alan, deger) => handleGuncelle(s.id, alan, deger)}
              onSil={() => sil.mutate(s.id)}
              secili={seciliIdler.has(s.id)}
              onSecim={checked => setSeciliIdler(prev => { const n = new Set(prev); checked ? n.add(s.id) : n.delete(s.id); return n })}
            />
          ))
        )}
      </div>
    </div>
  )
}
