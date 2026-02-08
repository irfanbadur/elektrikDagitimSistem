import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'

export function formatTarih(tarih) {
  if (!tarih) return '-'
  const date = typeof tarih === 'string' ? parseISO(tarih) : tarih
  return format(date, 'dd.MM.yyyy', { locale: tr })
}

export function formatTarihSaat(tarih) {
  if (!tarih) return '-'
  const date = typeof tarih === 'string' ? parseISO(tarih) : tarih
  return format(date, 'dd.MM.yyyy HH:mm', { locale: tr })
}

export function formatSaat(tarih) {
  if (!tarih) return '-'
  const date = typeof tarih === 'string' ? parseISO(tarih) : tarih
  return format(date, 'HH:mm', { locale: tr })
}

export function formatGecenSure(tarih) {
  if (!tarih) return '-'
  const date = typeof tarih === 'string' ? parseISO(tarih) : tarih
  return formatDistanceToNow(date, { addSuffix: true, locale: tr })
}

export function formatYuzde(yuzde) {
  return `%${yuzde || 0}`
}

export function formatSayi(sayi) {
  if (sayi == null) return '-'
  return new Intl.NumberFormat('tr-TR').format(sayi)
}

export function formatParaBirimi(miktar) {
  if (miktar == null) return '-'
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
  }).format(miktar)
}

export function bugununTarihi() {
  return format(new Date(), 'yyyy-MM-dd')
}

export function bugununGosterimTarihi() {
  return format(new Date(), 'dd MMMM yyyy, EEEE', { locale: tr })
}
