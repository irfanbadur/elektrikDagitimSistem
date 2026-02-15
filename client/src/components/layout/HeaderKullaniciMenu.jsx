import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { LogOut, User, Lock, ChevronDown } from 'lucide-react'

export default function HeaderKullaniciMenu() {
  const { kullanici, cikisYap } = useAuth()
  const [menuAcik, setMenuAcik] = useState(false)
  const [sifreDegistirAcik, setSifreDegistirAcik] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuAcik(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!kullanici) return null

  const birincilRol = kullanici.roller?.[0]

  const basHarfler = (kullanici.ad_soyad || 'K')
    .split(' ')
    .map(s => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <>
      <div ref={menuRef} className="relative">
        {/* Profil Butonu */}
        <button
          onClick={() => setMenuAcik(!menuAcik)}
          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100"
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: birincilRol?.renk || '#2563eb' }}
          >
            {basHarfler}
          </div>
          <div className="hidden text-left sm:block">
            <div className="text-[13px] font-semibold text-gray-800 leading-tight">{kullanici.ad_soyad}</div>
            <div className="text-[11px] font-medium leading-tight" style={{ color: birincilRol?.renk || '#6b7280' }}>
              {birincilRol?.ikon} {birincilRol?.adi || 'Kullanıcı'}
            </div>
          </div>
          <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${menuAcik ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menü */}
        {menuAcik && (
          <div className="absolute right-0 top-full mt-1.5 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg z-50">
            {/* Kullanıcı bilgisi */}
            <div className="border-b border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: birincilRol?.renk || '#2563eb' }}
                >
                  {basHarfler}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-gray-800">{kullanici.ad_soyad}</div>
                  <div className="text-xs text-gray-500">{kullanici.kullanici_adi}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {kullanici.roller?.map(rol => (
                      <span
                        key={rol.id}
                        className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold border"
                        style={{
                          background: `${rol.renk}15`,
                          color: rol.renk,
                          borderColor: `${rol.renk}30`,
                        }}
                      >
                        {rol.ikon} {rol.adi}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Menü öğeleri */}
            <div className="p-1.5">
              <button
                onClick={() => { setMenuAcik(false); setSifreDegistirAcik(true) }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] text-gray-700 transition-colors hover:bg-gray-50"
              >
                <Lock className="h-4 w-4 text-gray-400" />
                Şifre Değiştir
              </button>
            </div>

            {/* Çıkış */}
            <div className="border-t border-gray-100 p-1.5">
              <button
                onClick={() => { setMenuAcik(false); cikisYap() }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Çıkış Yap
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Şifre Değiştir Modal */}
      {sifreDegistirAcik && (
        <SifreDegistirModal onKapat={() => setSifreDegistirAcik(false)} />
      )}
    </>
  )
}

function SifreDegistirModal({ onKapat }) {
  const { sifreDegistir } = useAuth()
  const [mevcutSifre, setMevcutSifre] = useState('')
  const [yeniSifre, setYeniSifre] = useState('')
  const [yeniSifreTekrar, setYeniSifreTekrar] = useState('')
  const [hata, setHata] = useState('')
  const [basarili, setBasarili] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setHata('')

    if (yeniSifre !== yeniSifreTekrar) {
      setHata('Yeni şifreler eşleşmiyor')
      return
    }
    if (yeniSifre.length < 6) {
      setHata('Yeni şifre en az 6 karakter olmalıdır')
      return
    }

    setYukleniyor(true)
    try {
      await sifreDegistir(mevcutSifre, yeniSifre)
      setBasarili(true)
      setTimeout(onKapat, 1500)
    } catch (err) {
      setHata(err.message)
    } finally {
      setYukleniyor(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={onKapat}>
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold text-gray-800">Şifre Değiştir</h3>

        {basarili ? (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            Şifre başarıyla değiştirildi!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {hata && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[13px] text-red-700">
                {hata}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mevcut Şifre</label>
              <input
                type="password"
                value={mevcutSifre}
                onChange={e => setMevcutSifre(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Yeni Şifre</label>
              <input
                type="password"
                value={yeniSifre}
                onChange={e => setYeniSifre(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Yeni Şifre (Tekrar)</label>
              <input
                type="password"
                value={yeniSifreTekrar}
                onChange={e => setYeniSifreTekrar(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onKapat}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={yukleniyor}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
              >
                {yukleniyor ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
