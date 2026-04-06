import { useState } from 'react'
import { Menu, Bell, Zap } from 'lucide-react'
import { bugununGosterimTarihi } from '@/utils/formatters'
import HeaderKullaniciMenu from './HeaderKullaniciMenu'
import EnerjiKesintisiPlanlayici from './EnerjiKesintisiPlanlayici'

export default function Header({ title = 'Dashboard', onMenuToggle }) {
  const [kesintPanelAcik, setKesintPanelAcik] = useState(false)

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-white shadow-sm" style={{ paddingLeft: 36, paddingRight: 36 }}>
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
        {/* Enerji Kesintisi Planlayici */}
        <button
          onClick={() => setKesintPanelAcik(p => !p)}
          className={`relative rounded-md p-2 transition-colors ${kesintPanelAcik ? 'bg-amber-50 text-amber-600' : 'text-muted-foreground hover:bg-muted-foreground/10'}`}
          aria-label="Enerji Kesintisi Planlayici"
          title="Enerji Kesintisi Planlayici"
        >
          <Zap className="h-5 w-5" />
        </button>
        <EnerjiKesintisiPlanlayici acik={kesintPanelAcik} onKapat={() => setKesintPanelAcik(false)} />
        <button
          className="relative rounded-md p-2 text-muted-foreground hover:bg-muted-foreground/10"
          aria-label="Bildirimler"
        >
          <Bell className="h-5 w-5" />
        </button>
        <HeaderKullaniciMenu />
      </div>
    </header>
  )
}
