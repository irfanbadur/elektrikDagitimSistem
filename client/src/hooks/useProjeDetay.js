import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

// ============================================
// DOKÜMANLAR
// ============================================

export function useProjeDokumanlari(projeId) {
  return useQuery({
    queryKey: ['projeler', projeId, 'dokumanlar'],
    queryFn: () => api.get(`/projeler/${projeId}/dokumanlar`),
    select: (res) => res.data,
    enabled: !!projeId,
  })
}

export function useProjeDokumanYukle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projeId, formData }) =>
      api.post(`/projeler/${projeId}/dokumanlar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    onSuccess: (_, { projeId }) =>
      qc.invalidateQueries({ queryKey: ['projeler', projeId, 'dokumanlar'] }),
  })
}

export function useProjeDokumanSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projeId, id }) => api.delete(`/projeler/${projeId}/dokumanlar/${id}`),
    onSuccess: (_, { projeId }) =>
      qc.invalidateQueries({ queryKey: ['projeler', projeId, 'dokumanlar'] }),
  })
}

// ============================================
// PROJE DOSYALARI (CAD)
// ============================================

export function useProjeDosyalari(projeId) {
  return useQuery({
    queryKey: ['projeler', projeId, 'proje-dosyalari'],
    queryFn: () => api.get(`/projeler/${projeId}/proje-dosyalari`),
    select: (res) => res.data,
    enabled: !!projeId,
  })
}

export function useProjeDosyaYukle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projeId, formData }) =>
      api.post(`/projeler/${projeId}/proje-dosyalari`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    onSuccess: (_, { projeId }) =>
      qc.invalidateQueries({ queryKey: ['projeler', projeId, 'proje-dosyalari'] }),
  })
}

export function useProjeDosyaSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projeId, id }) => api.delete(`/projeler/${projeId}/proje-dosyalari/${id}`),
    onSuccess: (_, { projeId }) =>
      qc.invalidateQueries({ queryKey: ['projeler', projeId, 'proje-dosyalari'] }),
  })
}

// ============================================
// NOTLAR
// ============================================

export function useProjeNotlari(projeId) {
  return useQuery({
    queryKey: ['projeler', projeId, 'notlar'],
    queryFn: () => api.get(`/projeler/${projeId}/notlar`),
    select: (res) => res.data,
    enabled: !!projeId,
  })
}

export function useProjeNotOlustur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projeId, ...data }) => api.post(`/projeler/${projeId}/notlar`, data),
    onSuccess: (_, { projeId }) =>
      qc.invalidateQueries({ queryKey: ['projeler', projeId, 'notlar'] }),
  })
}

export function useProjeNotGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projeId, id, ...data }) => api.put(`/projeler/${projeId}/notlar/${id}`, data),
    onSuccess: (_, { projeId }) =>
      qc.invalidateQueries({ queryKey: ['projeler', projeId, 'notlar'] }),
  })
}

export function useProjeNotSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projeId, id }) => api.delete(`/projeler/${projeId}/notlar/${id}`),
    onSuccess: (_, { projeId }) =>
      qc.invalidateQueries({ queryKey: ['projeler', projeId, 'notlar'] }),
  })
}

// ============================================
// FOTOĞRAFLAR
// ============================================

export function useProjeFotograflari(projeId) {
  return useQuery({
    queryKey: ['projeler', projeId, 'fotograflar'],
    queryFn: () => api.get(`/projeler/${projeId}/fotograflar`),
    select: (res) => res.data,
    enabled: !!projeId,
  })
}

export function useProjeFotoYukle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projeId, formData }) =>
      api.post(`/projeler/${projeId}/fotograflar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    onSuccess: (_, { projeId }) =>
      qc.invalidateQueries({ queryKey: ['projeler', projeId, 'fotograflar'] }),
  })
}

export function useProjeFotoSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projeId, id }) => api.delete(`/projeler/${projeId}/fotograflar/${id}`),
    onSuccess: (_, { projeId }) =>
      qc.invalidateQueries({ queryKey: ['projeler', projeId, 'fotograflar'] }),
  })
}

// ============================================
// KEŞİFLER
// ============================================

export function useProjeKesifler(projeId) {
  return useQuery({
    queryKey: ['projeler', projeId, 'kesifler'],
    queryFn: () => api.get(`/projeler/${projeId}/kesifler`),
    select: (res) => res.data,
    enabled: !!projeId,
  })
}

export function useProjeKesifOlustur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projeId, ...data }) => api.post(`/projeler/${projeId}/kesifler`, data),
    onSuccess: (_, { projeId }) =>
      qc.invalidateQueries({ queryKey: ['projeler', projeId, 'kesifler'] }),
  })
}

export function useProjeKesifDetay(projeId, kesifId) {
  return useQuery({
    queryKey: ['projeler', projeId, 'kesifler', kesifId],
    queryFn: () => api.get(`/projeler/${projeId}/kesifler/${kesifId}`),
    select: (res) => res.data,
    enabled: !!projeId && !!kesifId,
  })
}

export function useProjeKesifGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projeId, id, ...data }) => api.put(`/projeler/${projeId}/kesifler/${id}`, data),
    onSuccess: (_, { projeId }) =>
      qc.invalidateQueries({ queryKey: ['projeler', projeId, 'kesifler'] }),
  })
}

export function useProjeKesifSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projeId, id }) => api.delete(`/projeler/${projeId}/kesifler/${id}`),
    onSuccess: (_, { projeId }) =>
      qc.invalidateQueries({ queryKey: ['projeler', projeId, 'kesifler'] }),
  })
}

export function useProjeKesifFotoYukle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projeId, kesifId, formData }) =>
      api.post(`/projeler/${projeId}/kesifler/${kesifId}/fotograflar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    onSuccess: (_, { projeId, kesifId }) => {
      qc.invalidateQueries({ queryKey: ['projeler', projeId, 'kesifler'] })
      qc.invalidateQueries({ queryKey: ['projeler', projeId, 'kesifler', kesifId] })
    },
  })
}
