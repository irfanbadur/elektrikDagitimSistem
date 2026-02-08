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
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Ekipler', icon: Users, path: '/ekipler' },
  { label: 'Projeler', icon: FolderKanban, path: '/projeler' },
  { label: 'Malzeme', icon: Package, path: '/malzeme' },
  { label: 'Personel', icon: UserCircle, path: '/personel' },
  { label: 'Puantaj', icon: ClipboardList, path: '/puantaj' },
  { label: 'Talepler', icon: MessageSquare, path: '/talepler' },
  { label: 'Görevler', icon: CheckSquare, path: '/gorevler', placeholder: true },
  { label: 'Raporlar', icon: BarChart3, path: '/raporlar' },
]

const bottomItems = [
  { label: 'Ayarlar', icon: Settings, path: '/ayarlar' },
]

export default function Sidebar({ firmaAdi = 'Firma Adı' }) {
  const location = useLocation()

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
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
        {navItems.map(renderNavItem)}

        {/* Separator */}
        <div className="my-3 border-t border-sidebar-accent/40" />

        {bottomItems.map(renderNavItem)}
      </nav>
    </aside>
  )
}
