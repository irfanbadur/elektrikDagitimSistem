import { cn } from '@/lib/utils'
import { PROJE_DURUM_RENKLERI, PROJE_DURUMLARI, ONCELIK_RENKLERI, ONCELIK_LABELS, TALEP_DURUMLARI, EKIP_DURUM_RENKLERI } from '@/utils/constants'

export function ProjeDurumBadge({ durum, asamaAdi, asamaRenk, asamaIkon, fazAdi, adimAdi, adimRenk, adimIkon, sorumluRolAdi }) {
  // Yeni faz sistemi — faz/adım bilgisi varsa göster
  if (fazAdi || adimAdi) {
    const renk = adimRenk || asamaRenk || '#6b7280'
    const ikon = adimIkon || asamaIkon || ''
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium"
          style={{ backgroundColor: `${renk}20`, color: renk }}
        >
          {ikon} {fazAdi || ''}
          {adimAdi && <span className="opacity-70">/ {adimAdi}</span>}
        </span>
        {sorumluRolAdi && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
            {sorumluRolAdi}
          </span>
        )}
      </span>
    )
  }
  // Eski döngü aşaması bilgisi varsa
  if (asamaAdi) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ backgroundColor: `${asamaRenk}20`, color: asamaRenk }}
      >
        {asamaIkon} {asamaAdi}
      </span>
    )
  }
  // Sabit değerler fallback
  const config = PROJE_DURUMLARI[durum]
  const renk = PROJE_DURUM_RENKLERI[durum]
  if (!config) return <span className="text-xs text-gray-500">{durum}</span>
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', renk)}>
      {config.emoji} {config.label}
    </span>
  )
}

export function OncelikBadge({ oncelik }) {
  const renk = ONCELIK_RENKLERI[oncelik]
  const label = ONCELIK_LABELS[oncelik]
  if (!label) return <span>{oncelik}</span>
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', renk)}>
      {label}
    </span>
  )
}

export function TalepDurumBadge({ durum }) {
  const config = TALEP_DURUMLARI[durum]
  if (!config) return <span>{durum}</span>
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.renk)}>
      {config.label}
    </span>
  )
}

export function EkipDurumBadge({ durum }) {
  const labels = { aktif: 'Aktif', izinli: 'İzinli', pasif: 'Pasif' }
  const renk = EKIP_DURUM_RENKLERI[durum]
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', renk)}>
      {labels[durum] || durum}
    </span>
  )
}
