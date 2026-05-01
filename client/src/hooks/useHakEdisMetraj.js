import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

// Direk-bazlı metraj listesi hook factory.
// hak_edis_metraj ve proje_kesif_metraj tabloları aynı şemada olduğu için
// aynı hook seti iki tabloda kullanılır — sadece apiBase + queryPrefix değişir.
export function metrajHookFactory({ apiBase = '/hak-edis-metraj', queryPrefix = 'hak-edis-metraj' } = {}) {
  const liste = (projeId) => useQuery({
    queryKey: [queryPrefix, projeId],
    queryFn: () => api.get(`${apiBase}/${projeId}`),
    select: (res) => res.data,
    enabled: !!projeId,
  })

  const ozet = (projeId) => useQuery({
    queryKey: [`${queryPrefix}-ozet`, projeId],
    queryFn: () => api.get(`${apiBase}/${projeId}/ozet`),
    select: (res) => res.data,
    enabled: !!projeId,
  })

  const malzemeOzeti = (projeId) => useQuery({
    queryKey: [`${queryPrefix}-malzeme-ozeti`, projeId],
    queryFn: () => api.get(`${apiBase}/${projeId}/malzeme-ozeti`),
    select: (res) => res.data,
    enabled: !!projeId,
  })

  const ekle = (projeId) => {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: (data) => api.post(`${apiBase}/${projeId}`, data),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [queryPrefix, projeId] })
        qc.invalidateQueries({ queryKey: [`${queryPrefix}-ozet`, projeId] })
        qc.invalidateQueries({ queryKey: [`${queryPrefix}-malzeme-ozeti`, projeId] })
      },
    })
  }

  const topluEkle = (projeId) => {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: (data) => api.post(`${apiBase}/${projeId}/toplu`, data),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [queryPrefix, projeId] })
        qc.invalidateQueries({ queryKey: [`${queryPrefix}-ozet`, projeId] })
        qc.invalidateQueries({ queryKey: [`${queryPrefix}-malzeme-ozeti`, projeId] })
      },
    })
  }

  const guncelle = (projeId) => {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: ({ id, ...data }) => api.put(`${apiBase}/${projeId}/${id}`, data),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [queryPrefix, projeId] })
        qc.invalidateQueries({ queryKey: [`${queryPrefix}-ozet`, projeId] })
        qc.invalidateQueries({ queryKey: [`${queryPrefix}-malzeme-ozeti`, projeId] })
      },
    })
  }

  const sil = (projeId) => {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: (id) => api.delete(`${apiBase}/${projeId}/${id}`),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [queryPrefix, projeId] })
        qc.invalidateQueries({ queryKey: [`${queryPrefix}-ozet`, projeId] })
        qc.invalidateQueries({ queryKey: [`${queryPrefix}-malzeme-ozeti`, projeId] })
      },
    })
  }

  return {
    useListe: liste, useOzet: ozet, useMalzemeOzeti: malzemeOzeti,
    useEkle: ekle, useTopluEkle: topluEkle, useGuncelle: guncelle, useSil: sil,
  }
}

// Hak Ediş tablosu için varsayılan hook'lar (geriye uyumluluk)
const hakEdisHooks = metrajHookFactory({ apiBase: '/hak-edis-metraj', queryPrefix: 'hak-edis-metraj' })
export const useHakEdisMetraj            = hakEdisHooks.useListe
export const useHakEdisMetrajOzet        = hakEdisHooks.useOzet
export const useHakEdisMetrajMalzemeOzeti = hakEdisHooks.useMalzemeOzeti
export const useHakEdisMetrajEkle        = hakEdisHooks.useEkle
export const useHakEdisMetrajTopluEkle   = hakEdisHooks.useTopluEkle
export const useHakEdisMetrajGuncelle    = hakEdisHooks.useGuncelle
export const useHakEdisMetrajSil         = hakEdisHooks.useSil

// Proje-Keşif tablosu için hook'lar
const kesifHooks = metrajHookFactory({ apiBase: '/proje-kesif-metraj', queryPrefix: 'proje-kesif-metraj' })
export const useProjeKesifMetraj             = kesifHooks.useListe
export const useProjeKesifMetrajOzet         = kesifHooks.useOzet
export const useProjeKesifMetrajMalzemeOzeti = kesifHooks.useMalzemeOzeti
export const useProjeKesifMetrajEkle         = kesifHooks.useEkle
export const useProjeKesifMetrajTopluEkle    = kesifHooks.useTopluEkle
export const useProjeKesifMetrajGuncelle     = kesifHooks.useGuncelle
export const useProjeKesifMetrajSil          = kesifHooks.useSil
