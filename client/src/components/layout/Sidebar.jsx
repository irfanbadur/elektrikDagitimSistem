import { Link, useLocation } from 'react-router-dom'
import {
  Zap,
  LayoutDashboard,
  Users,
  FolderKanban,
  Package,
  UserCircle,
  ClipboardList,
  MessageSquare,
  CheckSquare,
  BarChart3,
  Camera,
  Wrench,
  MapPin,
  FolderOpen,
  Settings,
  Network,
  Database,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const navGroups = [
  {
    label: null,
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/', herZaman: true },
    ],
  },
  {
    label: 'Yonetim',
    items: [
      { label: 'Projeler', icon: FolderKanban, path: '/projeler', modul: 'projeler', aksiyon: 'okuma' },
      { label: 'Ekipler', icon: Users, path: '/ekipler', modul: 'ekipler', aksiyon: 'okuma' },
      { label: 'Personel', icon: UserCircle, path: '/personel', modul: 'personel', aksiyon: 'okuma' },
      { label: 'Organizasyon', icon: Network, path: '/organizasyon', herZaman: true },
    ],
  },
  {
    label: 'Operasyon',
    items: [
      { label: 'Depo', icon: Package, path: '/depo', modul: 'malzeme', aksiyon: 'okuma' },
      { label: 'Puantaj', icon: ClipboardList, path: '/puantaj', herZaman: true },
      { label: 'Gorevler', icon: CheckSquare, path: '/gorevler', herZaman: true },
      { label: 'Talepler', icon: MessageSquare, path: '/talepler', herZaman: true },
      { label: 'Saha', icon: MapPin, path: '/saha', modul: 'saha_harita', aksiyon: 'okuma' },
    ],
  },
  {
    label: 'Veriler',
    items: [
      { label: 'Dosya Yonetimi', icon: FolderOpen, path: '/dosya-yonetimi', modul: 'dosyalar', aksiyon: 'okuma' },
      { label: 'Raporlar', icon: BarChart3, path: '/raporlar', modul: 'raporlar', aksiyon: 'genel' },
      { label: 'Veri Paketleri', icon: Camera, path: '/veri-paketleri', modul: 'veri_paketi', aksiyon: 'okuma' },
    ],
  },
  {
    label: 'Katalog',
    items: [
      { label: 'Malzeme Katalog', icon: Database, path: '/malzeme-katalog', herZaman: true },
      { label: 'Ekipman Katalog', icon: Wrench, path: '/katalog', herZaman: true },
      { label: 'Saha Mesaj', icon: MessageSquare, path: '/saha-mesaj', modul: 'saha_mesaj', aksiyon: 'okuma' },
    ],
  },
]

const bottomItems = [
  { label: 'Ayarlar', icon: Settings, path: '/ayarlar', modul: 'ayarlar', aksiyon: 'genel' },
]

export default function Sidebar({ firmaAdi = 'Firma Adı' }) {
  const location = useLocation()
  const { izinVar } = useAuth()

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const gorunurMu = (item) => {
    if (item.herZaman) return true
    if (item.modul && item.aksiyon) return izinVar(item.modul, item.aksiyon)
    return true
  }

  return (
    <aside style={S.aside}>
      {/* Brand */}
      <div style={S.brand}>
        <div style={S.brandIcon}>
          <Zap size={20} color="white" />
        </div>
        <div>
          <div style={S.brandTitle}>ElektraTrack</div>
          <div style={S.brandSub}>{firmaAdi}</div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={S.nav}>
        {navGroups.map((group, gi) => {
          const visibleItems = group.items.filter(gorunurMu)
          if (visibleItems.length === 0) return null
          return (
            <div key={gi} style={{ marginBottom: '4px' }}>
              {group.label && (
                <div style={S.groupLabel}>{group.label}</div>
              )}
              {visibleItems.map(item => {
                const Icon = item.icon
                const active = isActive(item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    style={{
                      ...S.navItem,
                      background: active ? '#eff6ff' : 'transparent',
                      color: active ? '#1e40af' : '#4b5563',
                      fontWeight: active ? 600 : 500,
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f3f4f6' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                  >
                    <Icon size={18} style={{ flexShrink: 0, color: active ? '#3b82f6' : '#9ca3af' }} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <ChevronRight size={14} style={{ color: active ? '#93c5fd' : '#e5e7eb' }} />
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={S.bottom}>
        {bottomItems.filter(gorunurMu).map(item => {
          const Icon = item.icon
          const active = isActive(item.path)
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                ...S.navItem,
                background: active ? '#eff6ff' : 'transparent',
                color: active ? '#1e40af' : '#4b5563',
                fontWeight: active ? 600 : 500,
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f3f4f6' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <Icon size={18} style={{ flexShrink: 0, color: active ? '#3b82f6' : '#9ca3af' }} />
              <span style={{ flex: 1 }}>{item.label}</span>
              <ChevronRight size={14} style={{ color: active ? '#93c5fd' : '#e5e7eb' }} />
            </Link>
          )
        })}
      </div>
    </aside>
  )
}

const S = {
  aside: {
    display: 'flex', flexDirection: 'column', width: '256px', height: '100%',
    background: '#ffffff', borderRight: '1px solid #e2e8f0',
    boxShadow: '2px 0 8px rgba(0,0,0,0.04)',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '20px 20px 16px',
    borderBottom: '1px solid #f3f4f6',
  },
  brandIcon: {
    width: '36px', height: '36px', borderRadius: '10px',
    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  brandTitle: {
    fontSize: '16px', fontWeight: 800, color: '#1f2937', lineHeight: 1.2,
  },
  brandSub: {
    fontSize: '11px', color: '#9ca3af', marginTop: '1px',
  },
  nav: {
    flex: 1, overflowY: 'auto', padding: '12px 10px 8px',
  },
  groupLabel: {
    fontSize: '10px', fontWeight: 700, color: '#9ca3af',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    padding: '8px 10px 4px', marginTop: '4px',
  },
  navItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 10px', borderRadius: '8px',
    fontSize: '13px', textDecoration: 'none',
    transition: 'background 0.15s',
    cursor: 'pointer', marginBottom: '1px',
  },
  bottom: {
    padding: '8px 10px', borderTop: '1px solid #f3f4f6',
  },
}
