import { useState, useRef, useEffect } from 'react'
import { Zap, Plus, X, Trash2, CheckCircle, Clock, XCircle, ChevronDown } from 'lucide-react'
import { useEnerjiKesintileri, useEnerjiKesintisiOlustur, useEnerjiKesintisiDurumDegistir, useEnerjiKesintisiSil } from '@/hooks/useEnerjiKesintileri'
import { useProjeler } from '@/hooks/useProjeler'
import { useBolgeler } from '@/hooks/useBolgeler'

const DURUM_CONFIG = {
  planli: { label: 'Planli', renk: 'bg-blue-100 text-blue-700', icon: Clock },
  aktif: { label: 'Aktif', renk: 'bg-orange-100 text-orange-700', icon: Zap },
  tamamlandi: { label: 'Tamamlandi', renk: 'bg-green-100 text-green-700', icon: CheckCircle },
  iptal: { label: 'Iptal', renk: 'bg-red-100 text-red-700', icon: XCircle },
}

const bugununTarihi = () => new Date().toISOString().slice(0, 10)

export default function EnerjiKesintisiPlanlayici({ acik, onKapat }) {
  const panelRef = useRef(null)
  const [formAcik, setFormAcik] = useState(false)
  const [form, setForm] = useState({
    proje_id: '', bolge_id: '', basla_tarih: bugununTarihi(), basla_saat: '08:00',
    bitis_tarih: bugununTarihi(), bitis_saat: '17:00', etkilenen_alan: '', aciklama: '',
  })

  const { data: kesintiler, isLoading } = useEnerjiKesintileri()
  const { data: projeler } = useProjeler()
  const { data: bolgeler } = useBolgeler()
  const olustur = useEnerjiKesintisiOlustur()
  const durumDegistir = useEnerjiKesintisiDurumDegistir()
  const sil = useEnerjiKesintisiSil()


  // ESC ile kapat
  useEffect(() => {
    if (!acik) return
    const handleKey = (e) => { if (e.key === 'Escape') onKapat() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [acik, onKapat])

  if (!acik) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.basla_tarih) return
    await olustur.mutateAsync({
      ...form,
      proje_id: form.proje_id || null,
      bolge_id: form.bolge_id || null,
    })
    setForm({ proje_id: '', bolge_id: '', basla_tarih: bugununTarihi(), basla_saat: '08:00', bitis_tarih: bugununTarihi(), bitis_saat: '17:00', etkilenen_alan: '', aciklama: '' })
    setFormAcik(false)
  }

  const handleDurumDegistir = (id, durum) => durumDegistir.mutate({ id, durum })
  const handleSil = (id) => { if (confirm('Bu kesinti plani silinsin mi?')) sil.mutate(id) }

  // Tarihleri gruplama
  const gruplar = {}
  const liste = Array.isArray(kesintiler) ? kesintiler : []
  liste.forEach(k => {
    const tarih = k.basla_tarih || 'Belirsiz'
    if (!gruplar[tarih]) gruplar[tarih] = []
    gruplar[tarih].push(k)
  })

  const bugun = bugununTarihi()
  const formatTarih = (t) => {
    if (!t) return ''
    if (t === bugun) return 'Bugun'
    const d = new Date(t + 'T00:00:00')
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' })
  }

  const inputCls = 'w-full rounded border border-gray-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onKapat}>
      <div
        ref={panelRef}
        className="w-[440px] max-h-[85vh] flex flex-col rounded-xl border border-gray-200 bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
            <Zap className="h-4 w-4 text-amber-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-800">Enerji Kesintisi Planlayici</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFormAcik(!formAcik)}
            className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors"
          >
            {formAcik ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {formAcik ? 'Kapat' : 'Yeni'}
          </button>
          <button onClick={onKapat} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Form */}
      {formAcik && (
        <form onSubmit={handleSubmit} className="border-b border-gray-100 p-4 space-y-3 bg-gray-50/50">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Baslangic Tarihi *</label>
              <input type="date" value={form.basla_tarih} onChange={e => setForm(f => ({ ...f, basla_tarih: e.target.value }))} className={inputCls} required />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Baslangic Saati</label>
              <input type="time" value={form.basla_saat} onChange={e => setForm(f => ({ ...f, basla_saat: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Bitis Tarihi</label>
              <input type="date" value={form.bitis_tarih} onChange={e => setForm(f => ({ ...f, bitis_tarih: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Bitis Saati</label>
              <input type="time" value={form.bitis_saat} onChange={e => setForm(f => ({ ...f, bitis_saat: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Proje</label>
              <select value={form.proje_id} onChange={e => setForm(f => ({ ...f, proje_id: e.target.value }))} className={inputCls}>
                <option value="">Proje secin</option>
                {projeler?.map(p => <option key={p.id} value={p.id}>{p.proje_no}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Bolge</label>
              <select value={form.bolge_id} onChange={e => setForm(f => ({ ...f, bolge_id: e.target.value }))} className={inputCls}>
                <option value="">Bolge secin</option>
                {bolgeler?.map(b => <option key={b.id} value={b.id}>{b.bolge_adi}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Etkilenen Alan</label>
            <input value={form.etkilenen_alan} onChange={e => setForm(f => ({ ...f, etkilenen_alan: e.target.value }))} className={inputCls} placeholder="Orn: TM-5 cikis, Merkez Mah. fideri" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Aciklama</label>
            <textarea value={form.aciklama} onChange={e => setForm(f => ({ ...f, aciklama: e.target.value }))} rows={2} className={inputCls} placeholder="Kesinti sebebi ve detaylar..." />
          </div>
          <button
            type="submit"
            disabled={olustur.isPending}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {olustur.isPending ? 'Kaydediliyor...' : 'Kesinti Plani Olustur'}
          </button>
        </form>
      )}

      {/* Liste */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />)}
          </div>
        ) : liste.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Zap className="mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-400">Henuz kesinti plani yok</p>
            <button onClick={() => setFormAcik(true)} className="mt-2 text-xs text-blue-500 hover:underline">
              Ilk plani olustur
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(gruplar).map(([tarih, items]) => (
              <div key={tarih}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className={`text-xs font-semibold ${tarih === bugun ? 'text-blue-600' : 'text-gray-500'}`}>
                    {formatTarih(tarih)}
                  </span>
                  {tarih === bugun && <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">Bugun</span>}
                  <div className="h-px flex-1 bg-gray-100" />
                </div>
                <div className="space-y-2">
                  {items.map(k => {
                    const dc = DURUM_CONFIG[k.durum] || DURUM_CONFIG.planli
                    const DurumIcon = dc.icon
                    return (
                      <div key={k.id} className="group rounded-lg border border-gray-100 bg-white p-3 hover:border-gray-200 hover:shadow-sm transition-all">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${dc.renk}`}>
                                <DurumIcon className="h-3 w-3" />
                                {dc.label}
                              </span>
                              {k.basla_saat && (
                                <span className="text-xs text-gray-500">
                                  {k.basla_saat?.slice(0, 5)}{k.bitis_saat ? ` - ${k.bitis_saat.slice(0, 5)}` : ''}
                                </span>
                              )}
                            </div>
                            {k.etkilenen_alan && (
                              <p className="mt-1 text-sm font-medium text-gray-700 truncate">{k.etkilenen_alan}</p>
                            )}
                            {k.aciklama && (
                              <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{k.aciklama}</p>
                            )}
                            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-gray-400">
                              {k.proje_no && <span className="rounded bg-gray-50 px-1.5 py-0.5 font-medium">{k.proje_no}</span>}
                              {k.bolge_adi && <span>{k.bolge_adi}</span>}
                            </div>
                          </div>
                          {/* Aksiyonlar */}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {k.durum === 'planli' && (
                              <button
                                onClick={() => handleDurumDegistir(k.id, 'aktif')}
                                title="Aktif et"
                                className="rounded p-1 text-orange-500 hover:bg-orange-50"
                              >
                                <Zap className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {(k.durum === 'planli' || k.durum === 'aktif') && (
                              <button
                                onClick={() => handleDurumDegistir(k.id, 'tamamlandi')}
                                title="Tamamla"
                                className="rounded p-1 text-green-500 hover:bg-green-50"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {k.durum === 'planli' && (
                              <button
                                onClick={() => handleDurumDegistir(k.id, 'iptal')}
                                title="Iptal et"
                                className="rounded p-1 text-red-400 hover:bg-red-50"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleSil(k.id)}
                              title="Sil"
                              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
