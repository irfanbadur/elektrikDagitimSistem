import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const { girisYap } = useAuth()
  const navigate = useNavigate()

  const [kullaniciAdi, setKullaniciAdi] = useState('')
  const [sifre, setSifre] = useState('')
  const [hata, setHata] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setHata('')
    setYukleniyor(true)

    try {
      await girisYap(kullaniciAdi, sifre)
      navigate('/')
    } catch (err) {
      setHata(err.message)
    } finally {
      setYukleniyor(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5"
      style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 50%, #3b82f6 100%)' }}>
      <div className="w-full max-w-[400px] bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Başlık */}
        <div className="bg-blue-700 px-6 pt-8 pb-6 text-center">
          <div className="text-4xl mb-2">⚡</div>
          <h1 className="text-2xl font-bold text-white tracking-wide">enerjabze</h1>
          <p className="text-blue-300 text-[13px] mt-1">Elektrik Dağıtım Yönetim Sistemi</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '28px 56px' }}>

          {/* Hata mesajı */}
          {hata && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-800">
              <span>⚠️</span> {hata}
            </div>
          )}

          {/* Kullanıcı Adı */}
          <div className="mb-4">
            <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
              Kullanıcı Adı
            </label>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base text-gray-400">👤</span>
              <input
                type="text"
                value={kullaniciAdi}
                onChange={(e) => setKullaniciAdi(e.target.value)}
                placeholder="Kullanıcı adınız"
                autoComplete="username"
                autoFocus
                required
                className="w-full rounded-[10px] border border-gray-300 py-3 pl-4 pr-10 text-[15px] outline-none transition-colors focus:border-blue-500"
              />
            </div>
          </div>

          {/* Şifre */}
          <div className="mb-6">
            <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
              Şifre
            </label>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base text-gray-400">🔒</span>
              <input
                type="password"
                value={sifre}
                onChange={(e) => setSifre(e.target.value)}
                placeholder="Şifreniz"
                autoComplete="current-password"
                required
                className="w-full rounded-[10px] border border-gray-300 py-3 pl-4 pr-10 text-[15px] outline-none transition-colors focus:border-blue-500"
              />
            </div>
          </div>

          {/* Giriş Butonu */}
          <button
            type="submit"
            disabled={yukleniyor || !kullaniciAdi || !sifre}
            className="w-full rounded-[10px] bg-blue-600 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            {yukleniyor ? '⏳ Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        {/* Alt bilgi */}
        <div className="pb-5 text-center text-[11px] text-gray-400">
          enerjabze &bull; {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}
