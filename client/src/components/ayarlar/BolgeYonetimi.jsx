import { useState } from 'react'
import { Plus, Edit, Trash2, MapPin, ChevronRight, Save, X } from 'lucide-react'
import { useBolgeler, useBolgeOlustur, useBolgeGuncelle, useBolgeSil } from '@/hooks/useBolgeler'
import ConfirmDialog from '@/components/shared/ConfirmDialog'

const BOLGE_TIPLERI = { il: 'İl', ilce: 'İlçe', mahalle: 'Mahalle', saha: 'Saha' }

export default function BolgeYonetimi() {
  const { data: bolgeler, isLoading } = useBolgeler()
  const olustur = useBolgeOlustur()
  const guncelle = useBolgeGuncelle()
  const sil = useBolgeSil()
  const [yeniForm, setYeniForm] = useState(null) // null = hidden, object = form data
  const [duzenleId, setDuzenleId] = useState(null)
  const [duzenleForm, setDuzenleForm] = useState({})
  const [silDialog, setSilDialog] = useState(null)

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

  // Build hierarchy
  const ilBolgeler = bolgeler?.filter(b => !b.ust_bolge_id) || []
  const altBolgeler = (ustId) => bolgeler?.filter(b => b.ust_bolge_id === ustId) || []

  const renderBolge = (bolge, depth = 0) => {
    const isEditing = duzenleId === bolge.id
    const children = altBolgeler(bolge.id)

    return (
      <div key={bolge.id}>
        <div className={`flex items-center gap-2 rounded-md p-2 hover:bg-muted/50 ${depth > 0 ? 'ml-6' : ''}`}>
          {depth > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          {isEditing ? (
            <div className="flex flex-1 items-center gap-2">
              <input value={duzenleForm.bolge_adi} onChange={e => setDuzenleForm(f => ({...f, bolge_adi: e.target.value}))} className="rounded-md border border-input bg-white px-2 py-1 text-sm flex-1" />
              <select value={duzenleForm.bolge_tipi} onChange={e => setDuzenleForm(f => ({...f, bolge_tipi: e.target.value}))} className="rounded-md border border-input bg-white px-2 py-1 text-sm">
                {Object.entries(BOLGE_TIPLERI).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button onClick={handleDuzenleKaydet} className="rounded p-1 text-green-600 hover:bg-green-50"><Save className="h-4 w-4" /></button>
              <button onClick={() => setDuzenleId(null)} className="rounded p-1 text-gray-400 hover:bg-gray-50"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <>
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium">{bolge.bolge_adi}</span>
              <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{BOLGE_TIPLERI[bolge.bolge_tipi]}</span>
              <button onClick={() => handleDuzenle(bolge)} className="rounded p-1 hover:bg-muted"><Edit className="h-3.5 w-3.5 text-muted-foreground" /></button>
              <button onClick={() => setSilDialog(bolge.id)} className="rounded p-1 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5 text-red-400" /></button>
            </>
          )}
        </div>
        {children.map(c => renderBolge(c, depth + 1))}
      </div>
    )
  }

  if (isLoading) return <div className="space-y-3">{Array.from({length:4}).map((_,i) => <div key={i} className="skeleton h-10 w-full" />)}</div>

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MapPin className="h-6 w-6 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Bölge Yönetimi</h2>
        </div>
        <button onClick={handleYeniEkle} className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Yeni Bölge
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
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
        <div className="space-y-1">
          {ilBolgeler.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Henüz bölge tanımlanmamış</p>
          ) : (
            ilBolgeler.map(b => renderBolge(b))
          )}
        </div>
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
