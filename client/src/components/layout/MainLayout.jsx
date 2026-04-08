import { useState, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import AiSohbetPanel from '../ai/AiSohbetPanel'

export default function MainLayout({ children, title = 'Dashboard', noPadding = false }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  // Sayfa bağlamını URL'den otomatik çıkar
  const baglam = useMemo(() => {
    const parts = location.pathname.split('/')
    if (parts[1] === 'projeler' && parts[2]) {
      return { tip: 'proje', projeId: parseInt(parts[2]), sayfaYolu: location.pathname }
    }
    if (parts[1] === 'malzeme') {
      return { tip: 'malzeme', sayfaYolu: location.pathname }
    }
    return { tip: 'genel', sayfaYolu: location.pathname }
  }, [location])

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ flexShrink: 0 }}
      >
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className={`flex-1 min-h-0 ${noPadding ? 'flex flex-col' : 'overflow-y-auto'}`} style={noPadding ? undefined : { padding: '28px 36px 40px' }}>
          <div className={noPadding ? 'flex flex-1 flex-col min-h-0' : 'w-full'}>
            {children}
          </div>
        </main>
      </div>

      {/* Floating AI Sohbet Paneli - geçici olarak devre dışı */}
      {/* <AiSohbetPanel baglam={baglam} /> */}
    </div>
  )
}
