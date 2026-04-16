import { useState } from 'react'
import { Plus, Trash2, BarChart3, Ruler, MapPin, FileSpreadsheet, Upload, Loader2, ExternalLink } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useHakEdisMetraj, useHakEdisMetrajOzet, useHakEdisMetrajEkle, useHakEdisMetrajGuncelle, useHakEdisMetrajSil } from '@/hooks/useHakEdisMetraj'
import api from '@/api/client'
import { cn } from '@/lib/utils'

const DURUM_SECENEKLERI = ['Yeni', 'Mevcut', 'Demontaj']

function DuzenlenebilirHucre({ deger, onKaydet, type = 'text', secenekler, className }) {
  const [duzenle, setDuzenle] = useState(false)
  const [val, setVal] = useState(deger ?? '')

  const kaydet = () => {
    setDuzenle(false)
    const yeni = type === 'number' ? (Number(val) || 0) : val
    if (yeni !== deger) onKaydet(yeni)
  }

  if (!duzenle) {
    return (
      <div
        onClick={() => { setVal(deger ?? ''); setDuzenle(true) }}
        className={cn('min-h-[24px] min-w-[40px] cursor-pointer rounded px-1 py-0.5 hover:bg-primary/10 hover:ring-1 hover:ring-primary/30', className)}
        title="Duzenlemek icin tikla"
      >
        {type === 'number' && deger ? Number(deger).toLocaleString('tr-TR') : (deger || '-')}
      </div>
    )
  }

  if (secenekler) {
    return (
      <select
        value={val}
        onChange={e => { setVal(e.target.value); }}
        onBlur={kaydet}
        autoFocus
        className="w-full rounded border border-primary bg-background px-1 py-0.5 text-[11px] focus:outline-none"
      >
        <option value="">-</option>
        {secenekler.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    )
  }

  return (
    <input
      type={type}
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={kaydet}
      onKeyDown={e => { if (e.key === 'Enter') kaydet(); if (e.key === 'Escape') setDuzenle(false) }}
      autoFocus
      className="w-full rounded border border-primary bg-background px-1 py-0.5 text-[11px] focus:outline-none"
    />
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
  const [excelYukleniyor, setExcelYukleniyor] = useState(false)
  const [excelDosyaId, setExcelDosyaId] = useState(null)

  const handleYeniSatir = async () => {
    await ekle.mutateAsync({ nokta_durum: 'Yeni', kaynak: 'manuel' })
    setYeniSatir(false)
  }

  // Excel şablonunu Kurum Şablon adımına kopyala
  const handleSablonKopyala = async () => {
    setExcelYukleniyor(true)
    try {
      const res = await api.post(`/hak-edis-metraj/${projeId}/sablon-kopyala`)
      const data = res.data || res
      setExcelDosyaId(data.dosya_id)
      qc.invalidateQueries({ queryKey: ['adim-dosyalar'] })
      qc.invalidateQueries({ queryKey: ['proje-dxf-listesi'] })
      alert(data.yeni ? 'Hakkediş şablonu kopyalandı.' : 'Şablon zaten mevcut.')
    } catch (err) { alert('Şablon kopyalama hatası: ' + (err.message || '')) }
    finally { setExcelYukleniyor(false) }
  }

  // Metraj verisini Excel'e aktar
  const handleExcelAktar = async () => {
    setExcelYukleniyor(true)
    try {
      // Önce şablon yoksa kopyala
      const sRes = await api.post(`/hak-edis-metraj/${projeId}/sablon-kopyala`)
      const sData = sRes.data || sRes
      setExcelDosyaId(sData.dosya_id)
      // Sonra metrajı yaz
      const aRes = await api.post(`/hak-edis-metraj/${projeId}/excel-aktar`)
      const aData = aRes.data || aRes
      qc.invalidateQueries({ queryKey: ['adim-dosyalar'] })
      alert(`${aData.aktarilan_satir} satır Excel'e aktarıldı.`)
    } catch (err) { alert('Excel aktarım hatası: ' + (err.message || '')) }
    finally { setExcelYukleniyor(false) }
  }

  const handleGuncelle = (id, alan, deger) => {
    guncelle.mutate({ id, [alan]: deger })
  }

  return (
    <div>
      {/* Baslik + Ekle butonu */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Sebeke Metraji</h3>
          <p className="text-sm text-muted-foreground">Hak edis icin direk-direk aciklik verileri</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Excel Şablon Kopyala */}
          <button
            onClick={handleSablonKopyala}
            disabled={excelYukleniyor}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            {excelYukleniyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Sablon Kopyala
          </button>
          {/* Metraj → Excel Aktar */}
          <button
            onClick={handleExcelAktar}
            disabled={excelYukleniyor || !satirlar?.length}
            className="flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {excelYukleniyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Excel'e Aktar
          </button>
          {/* Excel İndir */}
          {excelDosyaId && (
            <a href={`/api/dosya/${excelDosyaId}/indir`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm text-primary hover:bg-primary/5">
              <ExternalLink className="h-4 w-4" /> Indir
            </a>
          )}
          {/* Satır Ekle */}
          <button
            onClick={handleYeniSatir}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Satir Ekle
          </button>
        </div>
      </div>

      {/* Ozet */}
      {ozet && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-input bg-card px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Ruler className="h-3.5 w-3.5" />Toplam Aciklik</div>
            <p className="mt-1 text-lg font-bold">{ozet.toplam_satir || 0}</p>
          </div>
          <div className="rounded-lg border border-input bg-card px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />Toplam Mesafe</div>
            <p className="mt-1 text-lg font-bold">{(ozet.toplam_mesafe || 0).toLocaleString('tr-TR')} m</p>
          </div>
          <div className="rounded-lg border border-input bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Yeni Nokta</p>
            <p className="mt-1 text-lg font-bold text-emerald-600">{ozet.yeni_nokta || 0}</p>
          </div>
          <div className="rounded-lg border border-input bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Demontaj Nokta</p>
            <p className="mt-1 text-lg font-bold text-red-600">{ozet.demontaj_nokta || 0}</p>
          </div>
        </div>
      )}

      {/* Tablo */}
      <div className="overflow-hidden rounded-lg border border-input bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              {/* Ust header — gruplar */}
              <tr className="border-b border-input bg-muted/70">
                <th colSpan={4} className="border-r border-input px-2 py-1.5 text-center text-[10px] font-bold text-muted-foreground uppercase">Giris</th>
                <th colSpan={2} className="border-r border-input px-2 py-1.5 text-center text-[10px] font-bold text-muted-foreground uppercase">Direk</th>
                <th colSpan={4} className="border-r border-input px-2 py-1.5 text-center text-[10px] font-bold text-muted-foreground uppercase">Iletken</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-bold text-muted-foreground uppercase w-8"></th>
              </tr>
              {/* Alt header — sütunlar */}
              <tr className="border-b border-input bg-muted/50">
                <th className="px-2 py-2 text-left font-semibold text-muted-foreground w-8">#</th>
                <th className="px-2 py-2 text-left font-semibold text-muted-foreground">1.Nokta</th>
                <th className="px-2 py-2 text-left font-semibold text-muted-foreground">2.Nokta</th>
                <th className="px-2 py-2 text-left font-semibold text-muted-foreground border-r border-input">Durum</th>
                <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Tur</th>
                <th className="px-2 py-2 text-left font-semibold text-muted-foreground border-r border-input">Tip</th>
                <th className="px-2 py-2 text-right font-semibold text-muted-foreground">Mesafe</th>
                <th className="px-2 py-2 text-left font-semibold text-muted-foreground">AG Durum</th>
                <th className="px-2 py-2 text-left font-semibold text-muted-foreground">AG Iletken</th>
                <th className="px-2 py-2 text-left font-semibold text-muted-foreground border-r border-input">OG Iletken</th>
                <th className="px-2 py-2 text-center font-semibold text-muted-foreground w-8"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-input/50">
                    {Array.from({ length: 11 }).map((_, j) => (
                      <td key={j} className="px-2 py-2"><div className="skeleton h-4 w-full rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : !satirlar?.length ? (
                <tr>
                  <td colSpan={11} className="px-3 py-12 text-center">
                    <BarChart3 className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">Sebeke metraji bos</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">Hak Edis Krokisi uzerinden direk tikla veya manuel ekle</p>
                  </td>
                </tr>
              ) : (
                satirlar.map((s) => (
                  <tr key={s.id} className="border-b border-input/50 hover:bg-muted/30 transition-colors">
                    <td className="px-2 py-1.5 text-muted-foreground tabular-nums">{s.sira}</td>
                    <td className="px-2 py-1.5">
                      <DuzenlenebilirHucre deger={s.nokta1} onKaydet={v => handleGuncelle(s.id, 'nokta1', v)} className="font-mono text-blue-600" />
                    </td>
                    <td className="px-2 py-1.5">
                      <DuzenlenebilirHucre deger={s.nokta2} onKaydet={v => handleGuncelle(s.id, 'nokta2', v)} className="font-mono text-blue-600" />
                    </td>
                    <td className="px-2 py-1.5 border-r border-input/30">
                      <DuzenlenebilirHucre deger={s.nokta_durum} onKaydet={v => handleGuncelle(s.id, 'nokta_durum', v)} secenekler={DURUM_SECENEKLERI}
                        className={cn(
                          s.nokta_durum === 'Yeni' && 'text-emerald-600 font-medium',
                          s.nokta_durum === 'Demontaj' && 'text-red-600 font-medium',
                          s.nokta_durum === 'Mevcut' && 'text-blue-600',
                        )}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <DuzenlenebilirHucre deger={s.direk_tur} onKaydet={v => handleGuncelle(s.id, 'direk_tur', v)} />
                    </td>
                    <td className="px-2 py-1.5 border-r border-input/30">
                      <DuzenlenebilirHucre deger={s.direk_tip} onKaydet={v => handleGuncelle(s.id, 'direk_tip', v)} className="font-mono" />
                    </td>
                    <td className="px-2 py-1.5">
                      <DuzenlenebilirHucre deger={s.ara_mesafe} onKaydet={v => handleGuncelle(s.id, 'ara_mesafe', v)} type="number" className="text-right tabular-nums font-medium" />
                    </td>
                    <td className="px-2 py-1.5">
                      <DuzenlenebilirHucre deger={s.ag_iletken_durum} onKaydet={v => handleGuncelle(s.id, 'ag_iletken_durum', v)} secenekler={DURUM_SECENEKLERI} />
                    </td>
                    <td className="px-2 py-1.5">
                      <DuzenlenebilirHucre deger={s.ag_iletken} onKaydet={v => handleGuncelle(s.id, 'ag_iletken', v)} />
                    </td>
                    <td className="px-2 py-1.5 border-r border-input/30">
                      <DuzenlenebilirHucre deger={s.og_iletken} onKaydet={v => handleGuncelle(s.id, 'og_iletken', v)} />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button onClick={() => sil.mutate(s.id)} className="rounded p-0.5 text-muted-foreground hover:bg-red-50 hover:text-red-600" title="Sil">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
