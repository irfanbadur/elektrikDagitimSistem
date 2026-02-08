import { Menu, Bell } from 'lucide-react'
import { bugununGosterimTarihi } from '@/utils/formatters'

export default function Header({ title = 'Dashboard', onMenuToggle }) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-white px-6 shadow-sm">
      {/* Left side */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted-foreground/10 lg:hidden"
          aria-label="Menüyü aç/kapat"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <span className="hidden text-sm text-muted-foreground sm:block">
          {bugununGosterimTarihi()}
        </span>
        <button
          className="relative rounded-md p-2 text-muted-foreground hover:bg-muted-foreground/10"
          aria-label="Bildirimler"
        >
          <Bell className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}
