import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export default function ProtectedRoute({ children, modul, aksiyon }) {
  const { girisYapildi, yukleniyor, izinVar } = useAuth()
  const location = useLocation()

  // Yükleniyor — splash
  if (yukleniyor) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-gray-500">
        <div className="text-4xl">⚡</div>
        <div className="text-sm">Yükleniyor...</div>
      </div>
    )
  }

  // Giriş yapılmamış → Login'e yönlendir
  if (!girisYapildi) {
    return <Navigate to="/giris" state={{ from: location }} replace />
  }

  // Modül/aksiyon belirtilmişse izin kontrolü
  if (modul && aksiyon && !izinVar(modul, aksiyon)) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3 text-gray-500">
        <div className="text-6xl">🚫</div>
        <h2 className="text-lg font-semibold text-gray-700">Erişim Engellendi</h2>
        <p className="text-sm">Bu sayfayı görüntülemek için yetkiniz yok.</p>
        <a href="/" className="text-sm text-blue-600 hover:underline">Ana sayfaya dön</a>
      </div>
    )
  }

  return children || <Outlet />
}
