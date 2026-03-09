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
  MessageCircle,
  Settings,
  Network,
  Database,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/', herZaman: true },
  { label: 'Ekipler', icon: Users, path: '/ekipler', modul: 'ekipler', aksiyon: 'okuma' },
  { label: 'Projeler', icon: FolderKanban, path: '/projeler', modul: 'projeler', aksiyon: 'okuma' },
  { label: 'Malzeme', icon: Package, path: '/malzeme', modul: 'malzeme', aksiyon: 'okuma' },
  { label: 'Personel', icon: UserCircle, path: '/personel', modul: 'personel', aksiyon: 'okuma' },
  { label: 'Organizasyon', icon: Network, path: '/organizasyon', herZaman: true },
  { label: 'Puantaj', icon: ClipboardList, path: '/puantaj', herZaman: true },
  { label: 'Talepler', icon: MessageSquare, path: '/talepler', herZaman: true },
  { label: 'Görevler', icon: CheckSquare, path: '/gorevler', herZaman: true },
  { label: 'Raporlar', icon: BarChart3, path: '/raporlar', modul: 'raporlar', aksiyon: 'genel' },
  { label: 'Veri Paketleri', icon: Camera, path: '/veri-paketleri', modul: 'veri_paketi', aksiyon: 'okuma' },
  { label: 'Saha', icon: MapPin, path: '/saha', modul: 'saha_harita', aksiyon: 'okuma' },
  { label: 'Depo Katalog', icon: Database, path: '/depo-katalog', herZaman: true },
  { label: 'Ekipman Katalog', icon: Wrench, path: '/katalog', herZaman: true },
  { label: 'Saha Mesaj', icon: MessageSquare, path: '/saha-mesaj', modul: 'saha_mesaj', aksiyon: 'okuma' },
  { label: 'Dosya Yonetimi', icon: FolderOpen, path: '/dosya-yonetimi', modul: 'dosyalar', aksiyon: 'okuma' },
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

  const renderNavItem = (item) => {
    const Icon = item.icon
    const active = isActive(item.path)

    return (
      <Link
        key={item.path}
        to={item.path}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
          active
            ? 'bg-sidebar-accent text-white'
            : 'text-sidebar-muted hover:text-white hover:bg-sidebar-accent/50'
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span>{item.label}</span>
        {item.placeholder && (
          <span className="ml-auto rounded bg-sidebar-accent/30 px-1.5 py-0.5 text-[10px] leading-none text-sidebar-muted">
            Yakında
          </span>
        )}
      </Link>
    )
  }

  const filteredNavItems = navItems.filter(gorunurMu)
  const filteredBottomItems = bottomItems.filter(gorunurMu)

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight text-white">ElektraTrack</h1>
          <p className="text-xs text-sidebar-muted">{firmaAdi}</p>
        </div>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {filteredNavItems.map(renderNavItem)}

        {filteredBottomItems.length > 0 && (
          <>
            <div className="my-3 border-t border-sidebar-accent/40" />
            {filteredBottomItems.map(renderNavItem)}
          </>
        )}
      </nav>
    </aside>
  )
}
