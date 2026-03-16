import { useState } from 'react'
import {
  ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, RotateCcw, Flame, ClipboardList,
  ChevronDown, ChevronUp, FileText, AlertTriangle, XCircle, Loader2, Eye,
} from 'lucide-react'
import { useHareketler, useHareket, useHareketIptal } from '@/hooks/useHareketler'
import { cn } from '@/lib/utils'

const TIP_CONFIG = {
  giris:    { label: 'Giriş',    ikon: ArrowDownCircle, renk: 'text-emerald-600', bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700' },
  cikis:    { label: 'Çıkış',    ikon: ArrowUpCircle,   renk: 'text-red-600',     bg: 'bg-red-50',     badge: 'bg-red-100 text-red-700' },
  transfer: { label: 'Transfer', ikon: ArrowRightLeft,  renk: 'text-blue-600',    bg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-700' },
  iade:     { label: 'İade',     ikon: RotateCcw,       renk: 'text-purple-600',  bg: 'bg-purple-50',  badge: 'bg-purple-100 text-purple-700' },
  fire:     { label: 'Fire',     ikon: Flame,           renk: 'text-orange-600',  bg: 'bg-orange-50',  badge: 'bg-orange-100 text-orange-700' },
  sayim:    { label: 'Sayım',    ikon: ClipboardList,   renk: 'text-gray-600',    bg: 'bg-gray-50',    badge: 'bg-gray-100 text-gray-700' },
}

function HareketDetay({ hareketId, onKapat }) {
  const { data: h, isLoading } = useHareket(hareketId)
  const iptalMut = useHareketIptal()
  const [iptalNeden, setIptalNeden] = useState('')
  const [iptalOnay, setIptalOnay] = useState(false)

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  if (!h) return null

  const cfg = TIP_CONFIG[h.hareket_tipi] || TIP_CONFIG.giris
  const Icon = cfg.ikon

  const handleIptal = async () => {
    try {
      await iptalMut.mutateAsync({ id: h.id, neden: iptalNeden })
      onKapat()
    } catch {}
  }

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('rounded-lg p-2', cfg.bg)}><Icon className={cn('h-5 w-5', cfg.renk)} /></div>
          <div>
            <h3 className="font-semibold">Hareket #{h.id} — {cfg.label}</h3>
            <p className="text-xs text-muted-foreground">
              {h.tarih} · {h.belge_no || 'Belge no yok'} · {h.kalemler?.length || 0} kalem
            </p>
          </div>
        </div>
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium',
          h.durum === 'aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
        )}>
          {h.durum === 'aktif' ? 'Aktif' : 'İptal'}
        </span>
      </div>

      {/* Bilgi satırları */}
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        {h.proje_no && <div><span className="text-muted-foreground">Proje:</span> {h.proje_no} {h.proje_adi}</div>}
        {h.hedef_depo_adi && <div><span className="text-muted-foreground">Hedef Depo:</span> {h.hedef_depo_adi}</div>}
        {h.kaynak_depo_adi && <div><span className="text-muted-foreground">Kaynak Depo:</span> {h.kaynak_depo_adi}</div>}
        {h.teslim_alan && <div><span className="text-muted-foreground">Teslim Alan:</span> {h.teslim_alan}</div>}
        {h.teslim_eden && <div><span className="text-muted-foreground">Teslim Eden:</span> {h.teslim_eden}</div>}
        {h.aciklama && <div className="sm:col-span-2"><span className="text-muted-foreground">Açıklama:</span> {h.aciklama}</div>}
      </div>

      {/* Meta bilgileri */}
      {h.meta?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {h.meta.map(m => {
            const veri = JSON.parse(m.veri)
            const etiket = m.meta_tipi === 'bono_bilgi' ? 'Bono' : 'İrsaliye'
            const no = veri.bono_no || veri.irsaliye_no || ''
            return (
              <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                <FileText className="h-3 w-3" /> {etiket}: {no}
              </span>
            )
          })}
        </div>
      )}

      {/* Kalemler */}
      <div className="overflow-hidden rounded-lg border border-input">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">No</th>
              <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Malzeme Kodu</th>
              <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Malzeme</th>
              <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Birim</th>
              <th className="px-2 py-1.5 text-right font-semibold text-muted-foreground">Miktar</th>
            </tr>
          </thead>
          <tbody>
            {(h.kalemler || []).map(k => (
              <tr key={k.id} className="border-b border-input/50">
                <td className="px-2 py-1.5 text-muted-foreground">{k.sira_no}</td>
                <td className="px-2 py-1.5 font-mono">{k.malzeme_kodu || '-'}</td>
                <td className="px-2 py-1.5">{k.malzeme_cinsi || k.malzeme_tanimi_sap || k.malzeme_adi}</td>
                <td className="px-2 py-1.5">{k.birim}</td>
                <td className="px-2 py-1.5 text-right font-semibold">{k.miktar}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dokümanlar */}
      {h.dokumanlar?.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold text-muted-foreground">Dokümanlar</h4>
          <div className="flex flex-wrap gap-2">
            {h.dokumanlar.map(d => (
              <a key={d.id} href={`/uploads/${d.dosya_yolu}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-input px-2.5 py-1.5 text-xs hover:bg-muted"
              >
                <FileText className="h-3 w-3" />
                {d.dosya_tipi}: {d.orijinal_adi || d.dosya_adi}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* İptal */}
      {h.durum === 'aktif' && !h.iptal_referans_id && (
        <div className="border-t border-input pt-3">
          {!iptalOnay ? (
            <button onClick={() => setIptalOnay(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              <XCircle className="h-3.5 w-3.5" /> Hareketi Iptal Et
            </button>
          ) : (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Iptal Nedeni</label>
                <input value={iptalNeden} onChange={e => setIptalNeden(e.target.value)}
                  placeholder="Neden iptal ediliyor?"
                  className="mt-0.5 w-full rounded border border-input bg-background px-2.5 py-1.5 text-sm"
                />
              </div>
              <button onClick={handleIptal} disabled={iptalMut.isPending}
                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {iptalMut.isPending ? 'Iptal ediliyor...' : 'Onayla'}
              </button>
              <button onClick={() => setIptalOnay(false)}
                className="rounded-lg border border-input px-3 py-2 text-xs font-medium hover:bg-muted"
              >
                Vazgec
              </button>
            </div>
          )}
        </div>
      )}

      {h.iptal_nedeni && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          İptal nedeni: {h.iptal_nedeni}
        </div>
      )}
    </div>
  )
}

export default function HareketListesi() {
  const [filtre, setFiltre] = useState({ hareket_tipi: '', durum: '' })
  const { data: hareketler, isLoading } = useHareketler(filtre)
  const [seciliId, setSeciliId] = useState(null)

  return (
    <div className="space-y-4">
      {/* Filtreler */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={filtre.hareket_tipi} onChange={e => setFiltre(p => ({ ...p, hareket_tipi: e.target.value }))}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Tum Tipler</option>
          {Object.entries(TIP_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filtre.durum} onChange={e => setFiltre(p => ({ ...p, durum: e.target.value }))}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Tum Durumlar</option>
          <option value="aktif">Aktif</option>
          <option value="iptal">Iptal</option>
        </select>
      </div>

      {/* Detay */}
      {seciliId && (
        <div className="rounded-lg border border-input bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Hareket Detayi</h3>
            <button onClick={() => setSeciliId(null)} className="text-xs text-muted-foreground hover:text-foreground">Kapat</button>
          </div>
          <HareketDetay hareketId={seciliId} onKapat={() => setSeciliId(null)} />
        </div>
      )}

      {/* Liste */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-input">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-10">#</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Tarih</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Tip</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Belge No</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Proje</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Depo</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Kalem</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Durum</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {(hareketler || []).map(h => {
                const cfg = TIP_CONFIG[h.hareket_tipi] || TIP_CONFIG.giris
                const Icon = cfg.ikon
                return (
                  <tr key={h.id} className={cn(
                    'border-b border-input/50 transition-colors hover:bg-muted/30 cursor-pointer',
                    h.durum === 'iptal' && 'opacity-50 line-through',
                    seciliId === h.id && 'bg-primary/5'
                  )} onClick={() => setSeciliId(h.id === seciliId ? null : h.id)}>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{h.id}</td>
                    <td className="px-3 py-2 text-xs">{h.tarih}</td>
                    <td className="px-3 py-2">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', cfg.badge)}>
                        <Icon className="h-3 w-3" /> {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs font-mono">{h.belge_no || '-'}</td>
                    <td className="px-3 py-2 text-xs">{h.proje_no || '-'}</td>
                    <td className="px-3 py-2 text-xs">{h.hedef_depo_adi || h.kaynak_depo_adi || '-'}</td>
                    <td className="px-3 py-2 text-right text-xs font-semibold">{h.kalem_sayisi}</td>
                    <td className="px-3 py-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium',
                        h.durum === 'aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      )}>
                        {h.durum === 'aktif' ? 'Aktif' : 'Iptal'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    </td>
                  </tr>
                )
              })}
              {(!hareketler || hareketler.length === 0) && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">Hareket bulunamadi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
