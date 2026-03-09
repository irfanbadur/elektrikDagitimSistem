import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useProjeDemontaj(projeId) {
  return useQuery({
    queryKey: ['proje-demontaj', projeId],
    queryFn: () => api.get(`/proje-demontaj/${projeId}`),
    select: (res) => res.data,
    enabled: !!projeId,
  })
}

export function useProjeDemontajOzet(projeId) {
  return useQuery({
    queryKey: ['proje-demontaj-ozet', projeId],
    queryFn: () => api.get(`/proje-demontaj/${projeId}/ozet`),
    select: (res) => res.data,
    enabled: !!projeId,
  })
}

export function useProjeDemontajEkle(projeId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post(`/proje-demontaj/${projeId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-demontaj', projeId] })
      qc.invalidateQueries({ queryKey: ['proje-demontaj-ozet', projeId] })
    },
  })
}

export function useProjeDemontajTopluEkle(projeId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post(`/proje-demontaj/${projeId}/toplu`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-demontaj', projeId] })
      qc.invalidateQueries({ queryKey: ['proje-demontaj-ozet', projeId] })
    },
  })
}

export function useProjeDemontajGuncelle(projeId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/proje-demontaj/${projeId}/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-demontaj', projeId] })
      qc.invalidateQueries({ queryKey: ['proje-demontaj-ozet', projeId] })
    },
  })
}

export function useProjeDemontajSil(projeId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/proje-demontaj/${projeId}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-demontaj', projeId] })
      qc.invalidateQueries({ queryKey: ['proje-demontaj-ozet', projeId] })
    },
  })
}
