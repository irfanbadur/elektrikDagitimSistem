import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useProjeKrokiKesif(projeId) {
  return useQuery({
    queryKey: ['proje-kroki-kesif', projeId],
    queryFn: () => api.get(`/proje-kroki-kesif/${projeId}`),
    select: (res) => res.data || res,
    enabled: !!projeId,
  })
}

export function useProjeKrokiKesifOzet(projeId) {
  return useQuery({
    queryKey: ['proje-kroki-kesif-ozet', projeId],
    queryFn: () => api.get(`/proje-kroki-kesif/${projeId}/ozet`),
    select: (res) => res.data || res,
    enabled: !!projeId,
  })
}

export function useKesifKarsilastir(projeId) {
  return useQuery({
    queryKey: ['kesif-karsilastir', projeId],
    queryFn: () => api.get(`/proje-kroki-kesif/${projeId}/karsilastir`),
    select: (res) => res.data || res,
    enabled: !!projeId,
  })
}

export function useProjeKrokiKesifEkle(projeId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post(`/proje-kroki-kesif/${projeId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-kroki-kesif', projeId] })
      qc.invalidateQueries({ queryKey: ['proje-kroki-kesif-ozet', projeId] })
      qc.invalidateQueries({ queryKey: ['kesif-karsilastir', projeId] })
    },
  })
}

export function useProjeKrokiKesifTopluEkle(projeId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post(`/proje-kroki-kesif/${projeId}/toplu`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-kroki-kesif', projeId] })
      qc.invalidateQueries({ queryKey: ['proje-kroki-kesif-ozet', projeId] })
      qc.invalidateQueries({ queryKey: ['kesif-karsilastir', projeId] })
    },
  })
}

export function useProjeKrokiKesifGuncelle(projeId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/proje-kroki-kesif/${projeId}/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-kroki-kesif', projeId] })
      qc.invalidateQueries({ queryKey: ['proje-kroki-kesif-ozet', projeId] })
      qc.invalidateQueries({ queryKey: ['kesif-karsilastir', projeId] })
    },
  })
}

export function useProjeKrokiKesifSil(projeId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/proje-kroki-kesif/${projeId}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-kroki-kesif', projeId] })
      qc.invalidateQueries({ queryKey: ['proje-kroki-kesif-ozet', projeId] })
      qc.invalidateQueries({ queryKey: ['kesif-karsilastir', projeId] })
    },
  })
}
