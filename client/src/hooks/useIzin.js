import { useCallback } from 'react'

/**
 * Kullanıcının izinlerini kontrol eden hook
 *
 * Kullanım:
 *   const { izinVar, izinKapsam } = useIzin()
 *   if (izinVar('projeler', 'yazma')) { ... }
 */
export function useIzin() {
  const kullanici = JSON.parse(localStorage.getItem('kullanici') || '{}')
  const izinler = kullanici.izinler || {}

  const izinVar = useCallback(
    (modul, aksiyon) => {
      if (!izinler[modul]) return false
      return !!(izinler[modul][aksiyon] || izinler[modul]['tam'])
    },
    [izinler]
  )

  const izinKapsam = useCallback(
    (modul, aksiyon) => {
      if (!izinler[modul]) return null
      return izinler[modul][aksiyon] || izinler[modul]['tam'] || null
    },
    [izinler]
  )

  return { izinVar, izinKapsam, izinler, kullanici }
}
