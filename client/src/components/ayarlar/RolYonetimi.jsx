import { useState } from 'react'
import { useRoller, useIzinTanimlari, useRolOlustur, useRolGuncelle, useRolSil } from '@/hooks/useYonetim'
import { Shield, Plus, Edit2, Trash2, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const VARSAYILAN_RENKLER = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#be185d', '#4f46e5']

export default function RolYonetimi() {
  const { data: rollerRes, isLoading: rollerLoading } = useRoller()
  const { data: izinlerRes } = useIzinTanimlari()
  const rolOlustur = useRolOlustur()
  const rolGuncelle = useRolGuncelle()
  const rolSil = useRolSil()

  const [duzenleRol, setDuzenleRol] = useState(null)
  const [formAcik, setFormAcik] = useState(false)

  const roller = rollerRes?.data || []
  const izinGruplari = izinlerRes?.data || []

  const handleSil = (rol) => {
    if (rol.sistem_rolu) return
    if (confirm(`"${rol.rol_adi}" rolünü silmek istediğinize emin misiniz?`)) {
      rolSil.mutate(rol.id)
    }
  }

  const handleDuzenle = (rol) => {
    setDuzenleRol(rol)
    setFormAcik(true)
  }

  const handleYeniRol = () => {
    setDuzenleRol(null)
    setFormAcik(true)
  }

  if (rollerLoading) {
    return <div className="text-center py-8 text-gray-500">Roller yükleniyor...</div>
  }

  return (
    <div className="space-y-6">
      {/* Başlık + Yeni Rol */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Rol Yönetimi</h3>
          <p className="text-sm text-gray-500">{roller.length} rol tanımlı</p>
        </div>
        <button
          onClick={handleYeniRol}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Yeni Rol
        </button>
      </div>

      {/* Roller Listesi */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roller.map(rol => (
          <div key={rol.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
                  style={{ background: `${rol.renk}15`, color: rol.renk }}
                >
                  {rol.ikon || <Shield className="h-5 w-5" />}
                </div>
                <div>
                  <div className="font-semibold text-gray-800">{rol.rol_adi}</div>
                  <div className="text-xs text-gray-500">Seviye: {rol.seviye} &bull; {rol.kullanici_sayisi || 0} kullanıcı</div>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleDuzenle(rol)}
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                {!rol.sistem_rolu && (
                  <button
                    onClick={() => handleSil(rol)}
                    className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* İzin sayısı */}
            <div className="mt-3 flex flex-wrap gap-1">
              <span
                className="inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: `${rol.renk}15`, color: rol.renk }}
              >
                {rol.izinler?.length || 0} izin
              </span>
              {rol.sistem_rolu && (
                <span className="inline-block rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                  Sistem Rolü
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Rol Form Modal */}
      {formAcik && (
        <RolFormModal
          rol={duzenleRol}
          izinGruplari={izinGruplari}
          onKaydet={(data) => {
            if (duzenleRol) {
              rolGuncelle.mutate({ id: duzenleRol.id, ...data }, { onSuccess: () => setFormAcik(false) })
            } else {
              rolOlustur.mutate(data, { onSuccess: () => setFormAcik(false) })
            }
          }}
          onKapat={() => setFormAcik(false)}
          kaydetYukleniyor={rolOlustur.isPending || rolGuncelle.isPending}
        />
      )}
    </div>
  )
}

function RolFormModal({ rol, izinGruplari, onKaydet, onKapat, kaydetYukleniyor }) {
  const [form, setForm] = useState({
    rol_adi: rol?.rol_adi || '',
    rol_kodu: rol?.rol_kodu || '',
    renk: rol?.renk || '#2563eb',
    ikon: rol?.ikon || '',
    seviye: rol?.seviye ?? 50,
  })
  const [seciliIzinler, setSeciliIzinler] = useState(() => {
    if (!rol?.izinler) return {}
    const map = {}
    rol.izinler.forEach(i => { map[i.izin_id] = i.veri_kapsami || 'tum' })
    return map
  })

  const handleIzinToggle = (izinId) => {
    setSeciliIzinler(prev => {
      const yeni = { ...prev }
      if (yeni[izinId]) {
        delete yeni[izinId]
      } else {
        yeni[izinId] = 'tum'
      }
      return yeni
    })
  }

  const handleKaydet = () => {
    const izinler = Object.entries(seciliIzinler).map(([izin_id, veri_kapsami]) => ({
      izin_id: Number(izin_id),
      veri_kapsami,
    }))
    onKaydet({ ...form, izinler })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-20" onClick={onKapat}>
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-800">
            {rol ? 'Rol Düzenle' : 'Yeni Rol'}
          </h3>
          <button onClick={onKapat} className="rounded p-1 text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4 space-y-4">
          {/* Temel bilgiler */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Rol Adı</label>
              <input
                value={form.rol_adi}
                onChange={e => setForm({ ...form, rol_adi: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Rol Kodu</label>
              <input
                value={form.rol_kodu}
                onChange={e => setForm({ ...form, rol_kodu: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Renk</label>
              <div className="flex gap-2">
                {VARSAYILAN_RENKLER.map(r => (
                  <button
                    key={r}
                    onClick={() => setForm({ ...form, renk: r })}
                    className={cn('h-7 w-7 rounded-full border-2 transition-transform', form.renk === r ? 'border-gray-800 scale-110' : 'border-transparent')}
                    style={{ background: r }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Seviye (0-100)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.seviye}
                onChange={e => setForm({ ...form, seviye: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* İzinler */}
          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-700">İzinler</h4>
            <div className="space-y-3">
              {izinGruplari.map(grup => (
                <div key={grup.modul} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="mb-2 text-xs font-semibold text-gray-600 uppercase">{grup.modul_etiketi || grup.modul}</div>
                  <div className="flex flex-wrap gap-2">
                    {grup.izinler.map(izin => {
                      const secili = !!seciliIzinler[izin.id]
                      return (
                        <button
                          key={izin.id}
                          onClick={() => handleIzinToggle(izin.id)}
                          className={cn(
                            'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium border transition-colors',
                            secili
                              ? 'bg-blue-50 border-blue-300 text-blue-700'
                              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                          )}
                        >
                          {secili && <Check className="h-3 w-3" />}
                          {izin.aksiyon_etiketi || izin.aksiyon}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onKapat}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            İptal
          </button>
          <button
            onClick={handleKaydet}
            disabled={kaydetYukleniyor || !form.rol_adi}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
          >
            {kaydetYukleniyor ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}
