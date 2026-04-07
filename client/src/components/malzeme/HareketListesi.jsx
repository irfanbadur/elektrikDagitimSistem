import { useState } from 'react'
import {
  ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, RotateCcw, Flame, ClipboardList,
  ChevronDown, ChevronUp, FileText, AlertTriangle, XCircle, Loader2, Eye, Pencil, ArrowRight, Trash2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useHareketler, useHareket, useHareketIptal, useHareketSil } from '@/hooks/useHareketler'
import api from '@/api/client'
import { cn } from '@/lib/utils'

const TIP_CONFIG = {
  giris:    { label: 'Giriş',    ikon: ArrowDownCircle, renk: 'text-emerald-600', bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700' },
  cikis:    { label: 'Çıkış',    ikon: ArrowUpCircle,   renk: 'text-red-600',     bg: 'bg-red-50',     badge: 'bg-red-100 text-red-700' },
  transfer: { label: 'Transfer', ikon: ArrowRightLeft,  renk: 'text-blue-600',    bg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-700' },
  iade:     { label: 'İade',     ikon: RotateCcw,       renk: 'text-purple-600',  bg: 'bg-purple-50',  badge: 'bg-purple-100 text-purple-700' },
  fire:     { label: 'Fire',     ikon: Flame,           renk: 'text-orange-600',  bg: 'bg-orange-50',  badge: 'bg-orange-100 text-orange-700' },
  sayim:    { label: 'Sayım',    ikon: ClipboardList,   renk: 'text-gray-600',    bg: 'bg-gray-50',    badge: 'bg-gray-100 text-gray-700' },
}

function HareketDetay({ hareketId, onKapat, onResimTikla }) {
  const { data: h, isLoading } = useHareket(hareketId)
  const iptalMut = useHareketIptal()
  const navigate = useNavigate()
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

  const inputCls = 'w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none'
  const editInputCls = 'w-full rounded border border-transparent bg-transparent px-2 py-1 text-xs hover:border-input focus:border-primary focus:outline-none'

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
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium',
            h.durum === 'aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          )}>
            {h.durum === 'aktif' ? 'Aktif' : 'İptal'}
          </span>
          {h.durum === 'aktif' && (
            <button onClick={() => navigate(`/depo/yeni?duzenle=${h.id}`)}
              className="flex items-center gap-1 rounded-lg border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted">
              <Pencil className="h-3.5 w-3.5" /> Düzenle
            </button>
          )}
        </div>
      </div>

      {/* Yön bilgisi */}
      <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
        <span className="font-medium">{h.kaynak_depo_adi || h.teslim_eden || 'Kaynak'}</span>
        <ArrowRight className="h-4 w-4 text-primary" />
        <span className="font-medium">{h.hedef_depo_adi || h.teslim_alan || 'Hedef'}</span>
      </div>

      {(() => { /* salt okunur detaylar */ return (
        <>
          {/* Bilgi satırları — salt okunur */}
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {h.proje_no && <div><span className="text-muted-foreground">Proje:</span> <span className="font-medium">{h.proje_no} {h.proje_adi}</span></div>}
            {h.hedef_depo_adi && <div><span className="text-muted-foreground">Hedef Depo:</span> <span className="font-medium">{h.hedef_depo_adi}</span></div>}
            {h.kaynak_depo_adi && <div><span className="text-muted-foreground">Kaynak Depo:</span> <span className="font-medium">{h.kaynak_depo_adi}</span></div>}
            {h.ekip_adi && <div><span className="text-muted-foreground">Ekip:</span> <span className="font-medium">{h.ekip_adi}</span></div>}
            {h.teslim_alan && <div><span className="text-muted-foreground">Teslim Alan:</span> <span className="font-medium">{h.teslim_alan}</span></div>}
            {h.teslim_eden && <div><span className="text-muted-foreground">Teslim Eden:</span> <span className="font-medium">{h.teslim_eden}</span></div>}
            {h.aciklama && <div className="sm:col-span-2"><span className="text-muted-foreground">Açıklama:</span> {h.aciklama}</div>}
          </div>

          {/* İrsaliye/Bono bilgileri — meta'dan parse et */}
          {h.meta?.length > 0 && h.meta.map(m => {
            const veri = JSON.parse(m.veri)
            const etiket = m.meta_tipi === 'bono_bilgi' ? 'Bono Bilgileri' : 'İrsaliye Bilgileri'
            const alanlar = m.meta_tipi === 'irsaliye_bilgi'
              ? [
                  { k: 'irsaliye_no', l: 'İrsaliye No' }, { k: 'irsaliye_tarihi', l: 'Tarih' },
                  { k: 'sevk_tarihi', l: 'Sevk Tarihi' }, { k: 'irsaliye_zamani', l: 'Zamanı' },
                  { k: 'sevk_zamani', l: 'Sevk Zamanı' }, { k: 'referans_belge', l: 'Referans Belge' },
                  { k: 'irsaliye_tipi', l: 'Tipi' }, { k: 'tasiyici_firma', l: 'Taşıyıcı Firma', alt: 'firma' },
                  { k: 'arac_plakasi', l: 'Araç Plakası' },
                ]
              : [
                  { k: 'bono_no', l: 'Bono No' }, { k: 'bono_tarihi', l: 'Tarih' },
                  { k: 'kurum', l: 'Kurum' }, { k: 'teslim_alan', l: 'Teslim Alan' },
                  { k: 'teslim_eden', l: 'Teslim Eden' }, { k: 'aciklama', l: 'Açıklama' },
                ]
            const doluAlanlar = alanlar.filter(a => veri[a.k] || (a.alt && veri[a.alt]))
            if (doluAlanlar.length === 0) return null
            return (
              <div key={m.id} className="rounded-lg border border-input p-4">
                <h4 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">{etiket}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
                  {doluAlanlar.map(a => (
                    <div key={a.k}>
                      <span className="text-xs text-muted-foreground">{a.l}</span>
                      <p className="font-medium">{veri[a.k] || veri[a.alt] || '-'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Kalemler — salt okunur */}
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
              <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Dokümanlar</h4>
              <div className="flex flex-wrap gap-3">
                {h.dokumanlar.map(d => {
                  const url = `/uploads/${d.dosya_yolu}`
                  const isImg = (d.mime_tipi || '').startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(d.dosya_adi || '')
                  return isImg ? (
                    <button key={d.id} type="button" onClick={e => { e.stopPropagation(); onResimTikla?.(url) }}
                      className="group overflow-hidden rounded-lg border border-input hover:border-primary transition-colors cursor-pointer text-left">
                      <img src={url} alt={d.orijinal_adi || d.dosya_adi} className="h-20 w-28 object-cover group-hover:opacity-80 transition-opacity" />
                      <div className="px-2 py-1 text-[10px] text-muted-foreground truncate">{d.dosya_tipi || 'Belge'}</div>
                    </button>
                  ) : (
                    <a key={d.id} href={url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-input px-2.5 py-1.5 text-xs hover:bg-muted">
                      <FileText className="h-3 w-3" />
                      {d.dosya_tipi}: {d.orijinal_adi || d.dosya_adi}
                    </a>
                  )
                })}
              </div>
            </div>
          )}

          {/* Lightbox portali aşağıda */}
        </>
      ) })()}

      {/* İptal */}
      {h.durum === 'aktif' && !h.iptal_referans_id && (
        <div className="border-t border-input pt-3">
          {!iptalOnay ? (
            <button onClick={() => setIptalOnay(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50">
              <XCircle className="h-3.5 w-3.5" /> Hareketi İptal Et
            </button>
          ) : (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">İptal Nedeni</label>
                <input value={iptalNeden} onChange={e => setIptalNeden(e.target.value)}
                  placeholder="Neden iptal ediliyor?" className="mt-0.5 w-full rounded border border-input bg-background px-2.5 py-1.5 text-sm" />
              </div>
              <button onClick={handleIptal} disabled={iptalMut.isPending}
                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {iptalMut.isPending ? 'İptal ediliyor...' : 'Onayla'}
              </button>
              <button onClick={() => setIptalOnay(false)} className="rounded-lg border border-input px-3 py-2 text-xs font-medium hover:bg-muted">Vazgeç</button>
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

// Basit resim popup bileşeni
function ResimPopup({ url, onKapat }) {
  if (!url) return null
  return (
    <div id="resim-popup-overlay"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
      onClick={onKapat}>
      <img src={url} alt="Belge" onClick={e => e.stopPropagation()}
        style={{ maxHeight: '85vh', maxWidth: '90vw', objectFit: 'contain', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', cursor: 'default' }} />
      <div onClick={onKapat}
        style={{ position: 'absolute', top: 16, right: 16, background: 'white', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', fontSize: 18, fontWeight: 'bold' }}>
        ✕
      </div>
    </div>
  )
}

export default function HareketListesi() {
  const [filtre, setFiltre] = useState({ hareket_tipi: '', durum: '' })
  const { data: hareketler, isLoading } = useHareketler(filtre)
  const hareketSil = useHareketSil()
  const [seciliId, setSeciliId] = useState(null)
  const [popupResim, setPopupResim] = useState('')

  const handleSil = (e, id) => {
    e.stopPropagation()
    if (!window.confirm('Bu hareketi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return
    hareketSil.mutate(id, { onSuccess: () => { if (seciliId === id) setSeciliId(null) } })
  }

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
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Veren</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Alan</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Kalem</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Durum</th>
                <th className="px-3 py-2 w-16"></th>
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
                    <td className="px-3 py-2 text-xs">{h.kaynak_depo_adi || h.teslim_eden || '-'}</td>
                    <td className="px-3 py-2 text-xs">{h.hedef_depo_adi || h.teslim_alan || '-'}</td>
                    <td className="px-3 py-2 text-right text-xs font-semibold">{h.kalem_sayisi}</td>
                    <td className="px-3 py-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium',
                        h.durum === 'aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      )}>
                        {h.durum === 'aktif' ? 'Aktif' : 'İptal'}
                      </span>
                    </td>
                    <td className="px-3 py-2 flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      <button onClick={e => handleSil(e, h.id)} disabled={hareketSil.isPending}
                        className="rounded p-0.5 text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors" title="Sil">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {(!hareketler || hareketler.length === 0) && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-muted-foreground">Hareket bulunamadi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detay — listenin altında */}
      {seciliId && (
        <div className="rounded-lg border border-primary/20 bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Hareket Detayı</h3>
            <button onClick={() => setSeciliId(null)} className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">Kapat</button>
          </div>
          <HareketDetay hareketId={seciliId} onKapat={() => setSeciliId(null)} onResimTikla={setPopupResim} />
        </div>
      )}

      <ResimPopup url={popupResim} onKapat={() => setPopupResim('')} />
    </div>
  )
}
