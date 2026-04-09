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

export function useProjeKesifGuncelle(projeId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/proje-kesif/${projeId}/${id}`, data),
    onSuccess: () => {
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
