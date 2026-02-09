import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
import AyarlarPage from '@/pages/AyarlarPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
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
          <Route path="/telegram" element={<TelegramPage />} />
          <Route path="/ayarlar" element={<AyarlarPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
