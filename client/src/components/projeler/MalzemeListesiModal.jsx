import { Fragment, useEffect, useState } from 'react'
import { X, Download, Loader2, Package, AlertCircle } from 'lucide-react'
import api from '@/api/client'

const fiyatBicim = (n) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const miktarBicim = (n) => Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })

function DurumRozeti({ durum }) {
  if (!durum) return null
  const renk = {
    Yeni:     'bg-emerald-100 text-emerald-700 border-emerald-200',
    DMM:      'bg-orange-100 text-orange-700 border-orange-200',
    Demontaj: 'bg-red-100 text-red-700 border-red-200',
    Mevcut:   'bg-blue-100 text-blue-700 border-blue-200',
  }[durum] || 'bg-slate-100 text-slate-600 border-slate-200'
  return <span className={`inline-block rounded border px-1.5 py-0.5 text-[9px] font-medium ${renk}`}>{durum}</span>
}

export default function MalzemeListesiModal({ ids, onKapat }) {
  const [ozet, setOzet] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState(null)
  const [indiriliyor, setIndiriliyor] = useState(false)

  useEffect(() => {
    let iptal = false
    setYukleniyor(true); setHata(null)
    api.post('/projeler/malzeme-listesi-toplu', { ids })
      .then(r => { if (!iptal) setOzet(r?.data || r) })
      .catch(e => { if (!iptal) setHata(e?.response?.data?.error || e.message || 'Yüklenemedi') })
      .finally(() => { if (!iptal) setYukleniyor(false) })
    return () => { iptal = true }
  }, [ids])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onKapat?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onKapat])

  const indir = async () => {
    setIndiriliyor(true)
    try {
      const blob = await api.post('/projeler/malzeme-listesi-excel', { ids }, { responseType: 'blob' })
      const url = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob]))
      const a = document.createElement('a')
      const tarih = new Date().toISOString().slice(0, 10)
      a.href = url; a.download = `malzeme-listesi-${tarih}.xlsx`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Excel indirme hatası: ' + (e.message || ''))
    } finally { setIndiriliyor(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onKapat}>
      <div
        className="flex w-full max-w-5xl max-h-[90vh] flex-col rounded-xl border border-border bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Başlık (sabit) */}
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-semibold">
              Toplu Malzeme Listesi — {ids.length} proje
            </h2>
          </div>
          <button onClick={onKapat} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Üst özet bandı */}
        {!yukleniyor && ozet && (
          <div className="flex items-center justify-between border-b px-6 py-2 bg-muted/30 text-xs shrink-0">
            <span className="text-muted-foreground">
              {ozet.gruplar?.length || 0} grup · {ozet.bagimsiz?.length || 0} bağımsız kalem
            </span>
            <span className="text-muted-foreground">
              İlerleme: <span className="font-bold text-blue-700">{fiyatBicim(ozet.genel_ilerleme_tutar)} ₺</span>
              {' / '}
              Genel Toplam: <span className="font-bold text-emerald-700">{fiyatBicim(ozet.genel_toplam)} ₺</span>
            </span>
          </div>
        )}

        {/* İçerik (scroll) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          {yukleniyor && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Malzeme listesi hesaplanıyor...
            </div>
          )}
          {hata && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 m-3">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{hata}</span>
            </div>
          )}
          {!yukleniyor && ozet && (
            <div className="rounded-lg border border-input bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 sticky top-0 z-10">
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-2 py-1.5 text-left">Adı</th>
                    <th className="px-2 py-1.5 text-center w-16">Durum</th>
                    <th className="px-2 py-1.5 text-right w-20">Miktar</th>
                    <th className="px-2 py-1.5 text-right w-20">İlerleme</th>
                    <th className="px-2 py-1.5 text-left w-14">Birim</th>
                    <th className="px-2 py-1.5 text-right w-24">B. Fiyat</th>
                    <th className="px-2 py-1.5 text-right w-28">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {ozet.gruplar?.map((g) => (
                    <Fragment key={`g-${g.poz}-${g.durum}`}>
                      <tr className="border-t-2 border-emerald-300 bg-emerald-50/50 font-semibold">
                        <td className="px-2 py-1.5 text-xs">
                          {g.adi}
                          <span className="ml-1 text-[9px] text-muted-foreground font-mono font-normal">[{g.poz}]</span>
                        </td>
                        <td className="px-2 py-1.5 text-center"><DurumRozeti durum={g.durum} /></td>
                        <td className="px-2 py-1.5 text-xs tabular-nums text-right">{miktarBicim(g.toplam_miktar)}</td>
                        <td className="px-2 py-1.5 text-xs tabular-nums text-right text-blue-700">
                          {g.ilerleme_miktar > 0 ? miktarBicim(g.ilerleme_miktar) : '-'}
                        </td>
                        <td className="px-2 py-1.5 text-[11px] text-muted-foreground">{g.birim}</td>
                        <td className="px-2 py-1.5 text-xs tabular-nums text-right">
                          {g.birim_fiyat > 0 ? `${fiyatBicim(g.birim_fiyat)} ₺` : '-'}
                        </td>
                        <td className="px-2 py-1.5 text-xs tabular-nums text-right text-emerald-700">
                          {g.toplam_tutar > 0 ? `${fiyatBicim(g.toplam_tutar)} ₺` : '-'}
                        </td>
                      </tr>
                      {g.cocuklar?.map((c, i) => (
                        <tr key={`g-${g.poz}-${g.durum}-c-${i}`} className="border-b border-input/30 hover:bg-muted/20">
                          <td className="px-2 py-1 text-xs pl-6 text-muted-foreground">
                            <span className="text-foreground">{c.adi}</span>
                            {c.poz && <span className="ml-1 text-[9px] font-mono">[{c.poz}]</span>}
                          </td>
                          <td className="px-2 py-1 text-center"><DurumRozeti durum={c.durum} /></td>
                          <td className="px-2 py-1 text-xs tabular-nums text-right text-muted-foreground">{miktarBicim(c.miktar)}</td>
                          <td className="px-2 py-1 text-xs tabular-nums text-right text-blue-600">
                            {c.ilerleme > 0 ? miktarBicim(c.ilerleme) : '-'}
                          </td>
                          <td className="px-2 py-1 text-[11px] text-muted-foreground">{c.birim}</td>
                          <td className="px-2 py-1 text-[10px] text-muted-foreground italic">
                            {c.agirlik > 0 ? `${miktarBicim(c.agirlik)} kg/${c.birim}` : ''}
                          </td>
                          <td className="px-2 py-1 text-[10px] text-muted-foreground italic text-right">
                            {c.alt_toplam_miktar > 0 ? `= ${miktarBicim(c.alt_toplam_miktar)} kg` : ''}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                  {ozet.bagimsiz?.length > 0 && (
                    <>
                      <tr className="border-t-2 border-slate-300 bg-slate-50/60">
                        <td colSpan={7} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          Bağımsız Kalemler ({ozet.bagimsiz.length})
                        </td>
                      </tr>
                      {ozet.bagimsiz.map((b, i) => (
                        <tr key={`b-${i}`} className="border-b border-input/30 hover:bg-muted/30">
                          <td className="px-2 py-1 text-xs">
                            {b.adi}
                            {b.poz && <span className="ml-1 text-[9px] text-muted-foreground font-mono">[{b.poz}]</span>}
                            {b.katalog_eslesmedi && <span className="ml-1 text-[9px] text-amber-600">(katalog ✗)</span>}
                          </td>
                          <td className="px-2 py-1 text-center"><DurumRozeti durum={b.durum} /></td>
                          <td className="px-2 py-1 text-xs tabular-nums text-right">{miktarBicim(b.miktar)}</td>
                          <td className="px-2 py-1 text-xs tabular-nums text-right text-blue-600">
                            {b.ilerleme > 0 ? miktarBicim(b.ilerleme) : '-'}
                          </td>
                          <td className="px-2 py-1 text-[11px] text-muted-foreground">{b.birim}</td>
                          <td className="px-2 py-1 text-xs tabular-nums text-right">
                            {b.birim_fiyat > 0 ? `${fiyatBicim(b.birim_fiyat)} ₺` : '-'}
                          </td>
                          <td className="px-2 py-1 text-xs tabular-nums text-right font-medium">
                            {b.toplam_tutar > 0 ? `${fiyatBicim(b.toplam_tutar)} ₺` : '-'}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer (sabit) */}
        <div className="flex justify-end gap-2 border-t px-6 py-3 shrink-0">
          <button
            onClick={onKapat}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Kapat
          </button>
          <button
            onClick={indir}
            disabled={yukleniyor || indiriliyor || !ozet}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {indiriliyor
              ? <><Loader2 className="h-4 w-4 animate-spin" /> İndiriliyor...</>
              : <><Download className="h-4 w-4" /> Excel'e Aktar</>}
          </button>
        </div>
      </div>
    </div>
  )
}
