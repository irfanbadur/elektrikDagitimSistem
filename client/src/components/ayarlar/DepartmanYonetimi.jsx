import { useState } from 'react'
import { useDepartmanlar, useDepartmanOlustur, useDepartmanSil, useDepartmanGuncelle, useBirimOlustur, useBirimSil } from '@/hooks/useYonetim'
import { ChevronDown, ChevronRight, Plus, Trash2, Edit2, X, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const RENKLER = ['#dc2626', '#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#0ea5e9', '#f43f5e', '#84cc16']

export default function DepartmanYonetimi() {
  const { data: depRes, isLoading } = useDepartmanlar()
  const departmanOlustur = useDepartmanOlustur()
  const departmanSil = useDepartmanSil()
  const departmanGuncelle = useDepartmanGuncelle()
  const birimOlustur = useBirimOlustur()
  const birimSil = useBirimSil()

  const departmanlar = depRes?.data || []

  const [aciklar, setAciklar] = useState({})
  const [yeniDepForm, setYeniDepForm] = useState(null)
  const [yeniBirimForm, setYeniBirimForm] = useState(null)
  const [duzenle, setDuzenle] = useState(null)

  const toggle = (id) => setAciklar(prev => ({ ...prev, [id]: !prev[id] }))

  const handleDepKaydet = () => {
    if (!yeniDepForm?.departman_adi?.trim()) return
    const kodu = yeniDepForm.departman_adi.toLowerCase()
      .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
      .replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_')
    departmanOlustur.mutate(
      { ...yeniDepForm, departman_kodu: kodu },
      { onSuccess: () => setYeniDepForm(null) }
    )
  }

  const handleBirimKaydet = (depId) => {
    if (!yeniBirimForm?.birim_adi?.trim()) return
    const kodu = yeniBirimForm.birim_adi.toLowerCase()
      .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
      .replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_')
    birimOlustur.mutate(
      { departmanId: depId, ...yeniBirimForm, birim_kodu: kodu },
      { onSuccess: () => setYeniBirimForm(null) }
    )
  }

  const handleDepGuncelle = () => {
    if (!duzenle?.departman_adi?.trim()) return
    departmanGuncelle.mutate(
      { id: duzenle.id, departman_adi: duzenle.departman_adi, aciklama: duzenle.aciklama, renk: duzenle.renk },
      { onSuccess: () => setDuzenle(null) }
    )
  }

  if (isLoading) return <div className="py-8 text-center text-gray-500">Yükleniyor...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Departman Yönetimi</h3>
          <p className="text-sm text-gray-500">{departmanlar.length} departman</p>
        </div>
        <button
          onClick={() => setYeniDepForm({ departman_adi: '', aciklama: '', renk: '#2563eb' })}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Yeni Departman
        </button>
      </div>

      {/* Yeni departman formu */}
      {yeniDepForm && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="mb-3 text-sm font-semibold text-blue-800">Yeni Departman</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              value={yeniDepForm.departman_adi}
              onChange={e => setYeniDepForm({ ...yeniDepForm, departman_adi: e.target.value })}
              placeholder="Departman adı"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <input
              value={yeniDepForm.aciklama}
              onChange={e => setYeniDepForm({ ...yeniDepForm, aciklama: e.target.value })}
              placeholder="Açıklama"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <div className="flex items-center gap-2">
              {RENKLER.map(r => (
                <button
                  key={r}
                  onClick={() => setYeniDepForm({ ...yeniDepForm, renk: r })}
                  className={cn('h-6 w-6 rounded-full border-2', yeniDepForm.renk === r ? 'border-gray-800 scale-110' : 'border-transparent')}
                  style={{ background: r }}
                />
              ))}
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleDepKaydet} disabled={departmanOlustur.isPending} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
              Kaydet
            </button>
            <button onClick={() => setYeniDepForm(null)} className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Departman listesi - accordion */}
      <div className="space-y-2">
        {departmanlar.map(dep => (
          <div key={dep.id} className="rounded-xl border border-gray-200 bg-white shadow-sm">
            {/* Departman başlık */}
            <div
              className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-gray-50"
              onClick={() => toggle(dep.id)}
            >
              <div className="flex items-center gap-3">
                {aciklar[dep.id] ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                <div className="h-3 w-3 rounded-full" style={{ background: dep.renk }} />
                <div>
                  <span className="font-semibold text-gray-800">{dep.departman_adi}</span>
                  {dep.aciklama && <span className="ml-2 text-xs text-gray-500">{dep.aciklama}</span>}
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                  {dep.birimler?.length || 0} birim
                </span>
              </div>
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setDuzenle({ ...dep })}
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`"${dep.departman_adi}" departmanını silmek istediğinize emin misiniz?`)) {
                      departmanSil.mutate(dep.id)
                    }
                  }}
                  className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Birimler (açılır) */}
            {aciklar[dep.id] && (
              <div className="border-t border-gray-100 px-4 py-3">
                <div className="space-y-1.5">
                  {dep.birimler?.map(birim => (
                    <div key={birim.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-sm text-gray-700">{birim.birim_adi}</span>
                        {birim.aciklama && <span className="text-xs text-gray-400">- {birim.aciklama}</span>}
                      </div>
                      <button
                        onClick={() => {
                          if (confirm(`"${birim.birim_adi}" birimini silmek istiyor musunuz?`)) {
                            birimSil.mutate(birim.id)
                          }
                        }}
                        className="rounded p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Yeni birim formu */}
                {yeniBirimForm?.depId === dep.id ? (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={yeniBirimForm.birim_adi}
                      onChange={e => setYeniBirimForm({ ...yeniBirimForm, birim_adi: e.target.value })}
                      placeholder="Birim adı"
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleBirimKaydet(dep.id)}
                    />
                    <button onClick={() => handleBirimKaydet(dep.id)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
                      Ekle
                    </button>
                    <button onClick={() => setYeniBirimForm(null)} className="rounded p-1.5 text-gray-400 hover:text-gray-600">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setYeniBirimForm({ depId: dep.id, birim_adi: '', aciklama: '' })}
                    className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                  >
                    <Plus className="h-3 w-3" /> Birim ekle
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Düzenle modal */}
      {duzenle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDuzenle(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-semibold">Departman Düzenle</h3>
            <div className="space-y-3">
              <input
                value={duzenle.departman_adi}
                onChange={e => setDuzenle({ ...duzenle, departman_adi: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <input
                value={duzenle.aciklama || ''}
                onChange={e => setDuzenle({ ...duzenle, aciklama: e.target.value })}
                placeholder="Açıklama"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <div className="flex gap-2">
                {RENKLER.map(r => (
                  <button
                    key={r}
                    onClick={() => setDuzenle({ ...duzenle, renk: r })}
                    className={cn('h-7 w-7 rounded-full border-2', duzenle.renk === r ? 'border-gray-800 scale-110' : 'border-transparent')}
                    style={{ background: r }}
                  />
                ))}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDuzenle(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600">İptal</button>
              <button onClick={handleDepGuncelle} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
