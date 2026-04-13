import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useProjeKesif(projeId, depoId) {
  return useQuery({
    queryKey: ['proje-kesif', projeId, depoId || ''],
    queryFn: () => api.get(`/proje-kesif/${projeId}`, { params: depoId ? { depo_id: depoId } : {} }),
    select: (res) => res.data,
    enabled: !!projeId,
  })
}

export function useProjeKesifOzet(projeId) {
  return useQuery({
    queryKey: ['proje-kesif-ozet', projeId],
    queryFn: () => api.get(`/proje-kesif/${projeId}/ozet`),
    select: (res) => res.data,
    enabled: !!projeId,
  })
}

export function useProjeKesifEkle(projeId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post(`/proje-kesif/${projeId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-kesif', projeId] })
      qc.invalidateQueries({ queryKey: ['proje-kesif-ozet', projeId] })
      qc.invalidateQueries({ queryKey: ['kesif-karsilastir', projeId] })
    },
  })
}

export function useProjeKesifTopluEkle(projeId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post(`/proje-kesif/${projeId}/toplu`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-kesif', projeId] })
      qc.invalidateQueries({ queryKey: ['proje-kesif-ozet', projeId] })
      qc.invalidateQueries({ queryKey: ['kesif-karsilastir', projeId] })
    },
  })
}

export function useProjeKesifGuncelle(projeId, depoId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/proje-kesif/${projeId}/${id}`, data),
    onMutate: async (yeniVeri) => {
      const qKey = ['proje-kesif', projeId, depoId || '']
      await qc.cancelQueries({ queryKey: qKey })
      const onceki = qc.getQueryData(qKey)
      qc.setQueryData(qKey, (eski) => {
        // Raw cache: { data: [...] } veya doğrudan array olabilir
        if (!eski) return eski
        const arr = Array.isArray(eski) ? eski : (eski?.data || eski)
        if (!Array.isArray(arr)) return eski
        const guncel = arr.map(k => k.id === yeniVeri.id ? { ...k, ...yeniVeri } : k)
        return Array.isArray(eski) ? guncel : { ...eski, data: guncel }
      })
      return { onceki }
    },
    onError: (_err, _yeni, ctx) => {
      if (ctx?.onceki) qc.setQueryData(['proje-kesif', projeId, depoId || ''], ctx.onceki)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['proje-kesif', projeId] })
      qc.invalidateQueries({ queryKey: ['proje-kesif-ozet', projeId] })
      qc.invalidateQueries({ queryKey: ['kesif-karsilastir', projeId] })
    },
  })
}

export function useProjeKesifSil(projeId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/proje-kesif/${projeId}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-kesif', projeId] })
      qc.invalidateQueries({ queryKey: ['proje-kesif-ozet', projeId] })
      qc.invalidateQueries({ queryKey: ['kesif-karsilastir', projeId] })
    },
  })
}
