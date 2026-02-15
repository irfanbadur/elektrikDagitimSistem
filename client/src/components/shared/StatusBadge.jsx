import { cn } from '@/lib/utils'
import { PROJE_DURUM_RENKLERI, PROJE_DURUMLARI, ONCELIK_RENKLERI, ONCELIK_LABELS, TALEP_DURUMLARI, EKIP_DURUM_RENKLERI } from '@/utils/constants'

export function ProjeDurumBadge({ durum, asamaAdi, asamaRenk, asamaIkon }) {
  // Döngü aşaması bilgisi varsa dinamik badge göster
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
  // Eski sabit değerler fallback
  const config = PROJE_DURUMLARI[durum]
  const renk = PROJE_DURUM_RENKLERI[durum]
  if (!config) return <span>{durum}</span>
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
