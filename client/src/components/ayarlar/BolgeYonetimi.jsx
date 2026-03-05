import { useState } from 'react'
import { Plus, Edit, Trash2, MapPin, Save, X, UserPlus } from 'lucide-react'
import { useBolgeler, useBolgeOlustur, useBolgeGuncelle, useBolgeSil, useBolgeMatris, useEkipAtama } from '@/hooks/useBolgeler'
import { useEkipler } from '@/hooks/useEkipler'
import ConfirmDialog from '@/components/shared/ConfirmDialog'

const BOLGE_TIPLERI = { il: 'İl', ilce: 'İlçe', mahalle: 'Mahalle', saha: 'Saha' }

export default function BolgeYonetimi() {
  const { data: bolgeler, isLoading } = useBolgeler()
  const { data: matris, isLoading: matrisLoading } = useBolgeMatris()
  const { data: tumEkipler } = useEkipler()
  const olustur = useBolgeOlustur()
  const guncelle = useBolgeGuncelle()
  const sil = useBolgeSil()
  const ekipAtama = useEkipAtama()
  const [yeniForm, setYeniForm] = useState(null)
  const [duzenleId, setDuzenleId] = useState(null)
  const [duzenleForm, setDuzenleForm] = useState({})
  const [silDialog, setSilDialog] = useState(null)
  const [atamaHucre, setAtamaHucre] = useState(null)

  const handleYeniEkle = () => {
    setYeniForm({ bolge_adi: '', bolge_tipi: 'ilce', ust_bolge_id: '' })
  }

  const handleYeniKaydet = () => {
    if (!yeniForm.bolge_adi.trim()) return
    olustur.mutate({
      ...yeniForm,
      ust_bolge_id: yeniForm.ust_bolge_id || null
    }, { onSuccess: () => setYeniForm(null) })
  }

  const handleDuzenle = (bolge) => {
    setDuzenleId(bolge.id)
    setDuzenleForm({ bolge_adi: bolge.bolge_adi, bolge_tipi: bolge.bolge_tipi, ust_bolge_id: bolge.ust_bolge_id || '' })
  }

  const handleDuzenleKaydet = () => {
    guncelle.mutate({ id: duzenleId, ...duzenleForm, ust_bolge_id: duzenleForm.ust_bolge_id || null }, {
      onSuccess: () => { setDuzenleId(null); setDuzenleForm({}) }
    })
  }

  const handleEkipAta = (ekipId, bolgeId, isTipiId) => {
    ekipAtama.mutate({
      ekipId,
      varsayilan_bolge_id: bolgeId,
      varsayilan_is_tipi_id: isTipiId,
    }, { onSuccess: () => setAtamaHucre(null) })
  }

  const handleEkipKaldir = (ekipId) => {
    ekipAtama.mutate({
      ekipId,
      varsayilan_bolge_id: null,
      varsayilan_is_tipi_id: null,
    })
  }

  if (isLoading || matrisLoading) return <div className="space-y-3">{Array.from({length:4}).map((_,i) => <div key={i} className="skeleton h-10 w-full" />)}</div>

  const matrisBolgeler = matris?.bolgeler || []
  const isTipleri = matris?.isTipleri || []
  const atamalar = matris?.atamalar || {}

  // Tüm aktif ekipler (hücrede zaten atanmış olanlar hariç)
  const aktifEkipler = (tumEkipler || []).filter(e => e.durum === 'aktif')

  const getAtanabilirEkipler = (bolgeId, isTipiId) => {
    const hucreEkipIds = (atamalar[`${bolgeId}_${isTipiId}`] || []).map(e => e.ekip_id)
    return aktifEkipler.filter(e => !hucreEkipIds.includes(e.id))
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MapPin className="h-6 w-6 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Bölge Yönetimi</h2>
        </div>
        <button onClick={handleYeniEkle} className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Yeni Bölge
        </button>
      </div>

      {yeniForm && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-dashed border-primary/50 bg-primary/5 p-3">
          <input value={yeniForm.bolge_adi} onChange={e => setYeniForm(f => ({...f, bolge_adi: e.target.value}))} placeholder="Bölge adı" className="flex-1 rounded-md border border-input bg-white px-2 py-1 text-sm" />
          <select value={yeniForm.bolge_tipi} onChange={e => setYeniForm(f => ({...f, bolge_tipi: e.target.value}))} className="rounded-md border border-input bg-white px-2 py-1 text-sm">
            {Object.entries(BOLGE_TIPLERI).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={yeniForm.ust_bolge_id} onChange={e => setYeniForm(f => ({...f, ust_bolge_id: e.target.value}))} className="rounded-md border border-input bg-white px-2 py-1 text-sm">
            <option value="">Üst bölge yok</option>
            {bolgeler?.map(b => <option key={b.id} value={b.id}>{b.bolge_adi}</option>)}
          </select>
          <button onClick={handleYeniKaydet} disabled={olustur.isPending} className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-blue-700">Ekle</button>
          <button onClick={() => setYeniForm(null)} className="rounded p-1 text-gray-400 hover:bg-gray-50"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Matris Tablo */}
      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 px-4 py-3 text-left font-semibold min-w-[200px]">Bölge</th>
              {isTipleri.map(it => (
                <th key={it.id} className="px-4 py-3 text-center font-semibold min-w-[140px]">
                  <div className="text-xs text-muted-foreground">{it.kod}</div>
                  <div>{it.ad}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrisBolgeler.length === 0 ? (
              <tr>
                <td colSpan={1 + isTipleri.length} className="py-8 text-center text-muted-foreground">
                  Henüz bölge tanımlanmamış
                </td>
              </tr>
            ) : (
              matrisBolgeler.map(bolge => {
                const isEditing = duzenleId === bolge.id
                return (
                  <tr key={bolge.id} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-card px-4 py-3">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input value={duzenleForm.bolge_adi} onChange={e => setDuzenleForm(f => ({...f, bolge_adi: e.target.value}))} className="rounded-md border border-input bg-white px-2 py-1 text-sm flex-1 min-w-[100px]" />
                          <select value={duzenleForm.bolge_tipi} onChange={e => setDuzenleForm(f => ({...f, bolge_tipi: e.target.value}))} className="rounded-md border border-input bg-white px-2 py-1 text-sm">
                            {Object.entries(BOLGE_TIPLERI).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                          <button onClick={handleDuzenleKaydet} className="rounded p-1 text-green-600 hover:bg-green-50"><Save className="h-4 w-4" /></button>
                          <button onClick={() => setDuzenleId(null)} className="rounded p-1 text-gray-400 hover:bg-gray-50"><X className="h-4 w-4" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium">{bolge.bolge_adi}</span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{BOLGE_TIPLERI[bolge.bolge_tipi]}</span>
                          <div className="ml-auto flex items-center gap-1 shrink-0">
                            <button onClick={() => handleDuzenle(bolge)} className="rounded p-1 hover:bg-muted"><Edit className="h-3.5 w-3.5 text-muted-foreground" /></button>
                            <button onClick={() => setSilDialog(bolge.id)} className="rounded p-1 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5 text-red-400" /></button>
                          </div>
                        </div>
                      )}
                    </td>
                    {isTipleri.map(it => {
                      const ekipler = atamalar[`${bolge.id}_${it.id}`] || []
                      const isActiveCell = atamaHucre?.bolgeId === bolge.id && atamaHucre?.isTipiId === it.id
                      const atanabilir = isActiveCell ? getAtanabilirEkipler(bolge.id, it.id) : []
                      return (
                        <td key={it.id} className="relative px-4 py-3 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            {ekipler.map(e => (
                              <span key={e.ekip_id} className="group inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                                {e.ekip_adi}
                                <button
                                  onClick={() => handleEkipKaldir(e.ekip_id)}
                                  className="ml-0.5 hidden rounded-full p-0.5 hover:bg-blue-200 group-hover:inline-flex"
                                  title="Ekibi kaldır"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                            <button
                              onClick={() => setAtamaHucre(isActiveCell ? null : { bolgeId: bolge.id, isTipiId: it.id })}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-blue-50 hover:text-blue-600"
                              title="Ekip ata"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Atama popover with backdrop */}
                          {isActiveCell && (
                            <>
                              <div className="fixed inset-0 z-20" onClick={() => setAtamaHucre(null)} />
                              <div className="absolute left-1/2 top-full z-30 mt-1 w-56 -translate-x-1/2 rounded-lg border border-border bg-white p-2 shadow-lg">
                                <div className="mb-2 flex items-center justify-between">
                                  <span className="text-xs font-semibold text-muted-foreground">Ekip Ata</span>
                                  <button onClick={() => setAtamaHucre(null)} className="rounded p-0.5 hover:bg-gray-100">
                                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                                  </button>
                                </div>
                                {atanabilir.length === 0 ? (
                                  <p className="py-2 text-center text-xs text-muted-foreground">Atanabilir ekip yok</p>
                                ) : (
                                  <div className="max-h-48 space-y-0.5 overflow-y-auto">
                                    {atanabilir.map(e => (
                                      <button
                                        key={e.id}
                                        onClick={() => handleEkipAta(e.id, bolge.id, it.id)}
                                        disabled={ekipAtama.isPending}
                                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-blue-50 disabled:opacity-50"
                                      >
                                        <span className="font-medium">{e.ekip_adi}</span>
                                        {e.ekip_kodu && <span className="text-xs text-muted-foreground">{e.ekip_kodu}</span>}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!silDialog}
        onClose={() => setSilDialog(null)}
        onConfirm={() => sil.mutate(silDialog)}
        title="Bölge Sil"
        message="Bu bölgeyi silmek istediğinize emin misiniz?"
        confirmText="Sil"
      />
    </div>
  )
}
