import { useState } from 'react'
import { useKullanicilar, useRoller, useKullaniciOlustur, useKullaniciGuncelle, useKullaniciRolGuncelle } from '@/hooks/useYonetim'
import { Plus, Edit2, X, UserPlus, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function KullaniciYonetimi() {
  const { data: kullanicilarRes, isLoading } = useKullanicilar()
  const { data: rollerRes } = useRoller()
  const kullaniciOlustur = useKullaniciOlustur()
  const kullaniciGuncelle = useKullaniciGuncelle()
  const kullaniciRolGuncelle = useKullaniciRolGuncelle()

  const [formAcik, setFormAcik] = useState(false)
  const [duzenleKullanici, setDuzenleKullanici] = useState(null)
  const [rolAtamaAcik, setRolAtamaAcik] = useState(null)

  const kullanicilar = kullanicilarRes?.data || []
  const roller = rollerRes?.data || []

  const handleDuzenle = (k) => {
    setDuzenleKullanici(k)
    setFormAcik(true)
  }

  const handleYeni = () => {
    setDuzenleKullanici(null)
    setFormAcik(true)
  }

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Kullanıcılar yükleniyor...</div>
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Kullanıcı Yönetimi</h3>
          <p className="text-sm text-gray-500">{kullanicilar.length} kullanıcı</p>
        </div>
        <button
          onClick={handleYeni}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <UserPlus className="h-4 w-4" /> Yeni Kullanıcı
        </button>
      </div>

      {/* Kullanıcılar Tablosu */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left">
              <th className="px-4 py-3 font-medium text-gray-600">Kullanıcı</th>
              <th className="px-4 py-3 font-medium text-gray-600">Roller</th>
              <th className="px-4 py-3 font-medium text-gray-600">Durum</th>
              <th className="px-4 py-3 font-medium text-gray-600">Son Giriş</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {kullanicilar.map(k => (
              <tr key={k.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3">
                  <div>
                    <div className="font-medium text-gray-800">{k.ad_soyad}</div>
                    <div className="text-xs text-gray-500">@{k.kullanici_adi}</div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {k.roller?.map(r => (
                      <span
                        key={r.id}
                        className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold border"
                        style={{ background: `${r.renk}15`, color: r.renk, borderColor: `${r.renk}30` }}
                      >
                        {r.ikon} {r.rol_adi}
                      </span>
                    ))}
                    <button
                      onClick={() => setRolAtamaAcik(k)}
                      className="rounded-md border border-dashed border-gray-300 px-1.5 py-0.5 text-[10px] text-gray-400 hover:border-blue-400 hover:text-blue-500"
                    >
                      <Shield className="h-2.5 w-2.5 inline" /> +
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'inline-block rounded-full px-2 py-0.5 text-[11px] font-medium',
                    k.durum === 'aktif' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                  )}>
                    {k.durum === 'aktif' ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {k.son_giris ? new Date(k.son_giris).toLocaleDateString('tr-TR') : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDuzenle(k)}
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Kullanıcı Form Modal */}
      {formAcik && (
        <KullaniciFormModal
          kullanici={duzenleKullanici}
          roller={roller}
          onKaydet={(data) => {
            if (duzenleKullanici) {
              kullaniciGuncelle.mutate({ id: duzenleKullanici.id, ...data }, { onSuccess: () => setFormAcik(false) })
            } else {
              kullaniciOlustur.mutate(data, { onSuccess: () => setFormAcik(false) })
            }
          }}
          onKapat={() => setFormAcik(false)}
          kaydetYukleniyor={kullaniciOlustur.isPending || kullaniciGuncelle.isPending}
        />
      )}

      {/* Rol Atama Modal */}
      {rolAtamaAcik && (
        <RolAtamaModal
          kullanici={rolAtamaAcik}
          roller={roller}
          onKaydet={(rolIds) => {
            kullaniciRolGuncelle.mutate(
              { id: rolAtamaAcik.id, roller: rolIds },
              { onSuccess: () => setRolAtamaAcik(null) }
            )
          }}
          onKapat={() => setRolAtamaAcik(null)}
          kaydetYukleniyor={kullaniciRolGuncelle.isPending}
        />
      )}
    </div>
  )
}

function KullaniciFormModal({ kullanici, roller, onKaydet, onKapat, kaydetYukleniyor }) {
  const [form, setForm] = useState({
    kullanici_adi: kullanici?.kullanici_adi || '',
    ad_soyad: kullanici?.ad_soyad || '',
    email: kullanici?.email || '',
    telefon: kullanici?.telefon || '',
    sifre: '',
    durum: kullanici?.durum || 'aktif',
    roller: kullanici?.roller?.map(r => r.id) || [],
  })

  const handleKaydet = () => {
    onKaydet({ ...form, rol_idler: form.roller })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onKapat}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            {kullanici ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}
          </h3>
          <button onClick={onKapat} className="rounded p-1 text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kullanıcı Adı</label>
              <input
                value={form.kullanici_adi}
                onChange={e => setForm({ ...form, kullanici_adi: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ad Soyad</label>
              <input
                value={form.ad_soyad}
                onChange={e => setForm({ ...form, ad_soyad: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {kullanici ? 'Yeni Şifre (boş bırakılırsa değişmez)' : 'Şifre'}
            </label>
            <input
              type="password"
              value={form.sifre}
              onChange={e => setForm({ ...form, sifre: e.target.value })}
              placeholder={kullanici ? '••••••' : 'En az 6 karakter'}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Telefon</label>
              <input
                value={form.telefon}
                onChange={e => setForm({ ...form, telefon: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Roller</label>
            <div className="flex flex-wrap gap-2">
              {roller.map(r => {
                const secili = form.roller.includes(r.id)
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setForm({
                        ...form,
                        roller: secili
                          ? form.roller.filter(id => id !== r.id)
                          : [...form.roller, r.id],
                      })
                    }}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium border transition-colors',
                      secili
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    )}
                  >
                    {r.ikon} {r.rol_adi}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Durum</label>
            <select
              value={form.durum}
              onChange={e => setForm({ ...form, durum: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="aktif">Aktif</option>
              <option value="pasif">Pasif</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onKapat}
            className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            İptal
          </button>
          <button
            onClick={handleKaydet}
            disabled={kaydetYukleniyor || !form.kullanici_adi || !form.ad_soyad}
            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
          >
            {kaydetYukleniyor ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RolAtamaModal({ kullanici, roller, onKaydet, onKapat, kaydetYukleniyor }) {
  const [seciliRoller, setSeciliRoller] = useState(
    () => kullanici.roller?.map(r => r.id) || []
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onKapat}>
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="mb-1 text-lg font-semibold text-gray-800">Rol Ata</h3>
        <p className="mb-4 text-sm text-gray-500">{kullanici.ad_soyad}</p>

        <div className="space-y-2 mb-4">
          {roller.map(r => {
            const secili = seciliRoller.includes(r.id)
            return (
              <button
                key={r.id}
                onClick={() => {
                  setSeciliRoller(prev =>
                    secili ? prev.filter(id => id !== r.id) : [...prev, r.id]
                  )
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                  secili ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-sm"
                  style={{ background: `${r.renk}15`, color: r.renk }}
                >
                  {r.ikon || '🛡️'}
                </div>
                <div>
                  <div className="font-medium text-gray-800">{r.rol_adi}</div>
                  <div className="text-xs text-gray-500">Seviye: {r.seviye}</div>
                </div>
                {secili && <span className="ml-auto text-blue-600">✓</span>}
              </button>
            )
          })}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onKapat}
            className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            İptal
          </button>
          <button
            onClick={() => onKaydet(seciliRoller)}
            disabled={kaydetYukleniyor}
            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
          >
            {kaydetYukleniyor ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}
