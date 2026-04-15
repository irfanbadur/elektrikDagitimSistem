import { useState, useMemo, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import AiSohbetPanel from '../ai/AiSohbetPanel'
import GeminiChat from '../ai/GeminiChat'

export default function MainLayout({ children, title = 'Dashboard', noPadding = false }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [tenantName, setTenantName] = useState('')
  const [aiChatAcik, setAiChatAcik] = useState(false)
  const [aiYetkisi, setAiYetkisi] = useState(false)
  const location = useLocation()

  useEffect(() => {
    fetch('/api/tenant').then(r => r.json()).then(j => { if (j.data?.name) setTenantName(j.data.name) }).catch(() => {})
    const token = localStorage.getItem('token')
    if (token) {
      fetch('/api/gemini/yetki', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(j => { if (j.data?.yetkili) setAiYetkisi(true) }).catch(() => {})
    }
  }, [])

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
        <Sidebar firmaAdi={tenantName} />
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

      {/* AI Asistan — sadece yetkili kullanıcılar */}
      {aiYetkisi && <GeminiChat acik={aiChatAcik} onKapat={() => setAiChatAcik(false)} />}
      {aiYetkisi && !aiChatAcik && (
        <button onClick={() => setAiChatAcik(true)}
          className="fixed bottom-4 right-4 z-[9998] flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
          title="AI Asistan">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a5 5 0 015 5v1h1a3 3 0 013 3v1a3 3 0 01-3 3h-1v4a3 3 0 01-3 3H10a3 3 0 01-3-3v-4H6a3 3 0 01-3-3v-1a3 3 0 013-3h1V7a5 5 0 015-5z"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/></svg>
        </button>
      )}
    </div>
  )
}
