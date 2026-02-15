import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import EkiplerPage from '@/pages/EkiplerPage'
import ProjelerPage from '@/pages/ProjelerPage'
import MalzemePage from '@/pages/MalzemePage'
import PersonelPage from '@/pages/PersonelPage'
import PuantajPage from '@/pages/PuantajPage'
import TaleplerPage from '@/pages/TaleplerPage'
import RaporlarPage from '@/pages/RaporlarPage'
import VeriPaketleriPage from '@/pages/VeriPaketleriPage'
import KatalogPage from '@/pages/KatalogPage'
import TelegramPage from '@/pages/TelegramPage'
import SahaPage from '@/pages/SahaPage'
import SahaMesajPage from '@/pages/SahaMesajPage'
import AyarlarPage from '@/pages/AyarlarPage'
import DosyaYonetimiPage from '@/pages/DosyaYonetimiPage'
import AiSohbetPage from '@/pages/AiSohbetPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function AppRoutes() {
  const { girisYapildi, yukleniyor } = useAuth()

  // Auth yüklenirken splash göster
  if (yukleniyor) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-gray-500">
        <div className="text-4xl">⚡</div>
        <div className="text-sm">Yükleniyor...</div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Public — Login */}
      <Route
        path="/giris"
        element={girisYapildi ? <Navigate to="/" replace /> : <LoginPage />}
      />

      {/* Protected — Uygulama */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/ekipler/*" element={<EkiplerPage />} />
        <Route path="/projeler/*" element={<ProjelerPage />} />
        <Route path="/malzeme/*" element={<MalzemePage />} />
        <Route path="/personel/*" element={<PersonelPage />} />
        <Route path="/puantaj/*" element={<PuantajPage />} />
        <Route path="/talepler/*" element={<TaleplerPage />} />
        <Route path="/raporlar" element={<RaporlarPage />} />
        <Route path="/veri-paketleri/*" element={<VeriPaketleriPage />} />
        <Route path="/katalog" element={<KatalogPage />} />
        <Route path="/saha" element={<SahaPage />} />
        <Route path="/saha-mesaj" element={<SahaMesajPage />} />
        <Route path="/telegram" element={<TelegramPage />} />
        <Route path="/ayarlar" element={<AyarlarPage />} />
        <Route path="/dosya-yonetimi" element={<DosyaYonetimiPage />} />
        <Route path="/ai-sohbet" element={<AiSohbetPage />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
