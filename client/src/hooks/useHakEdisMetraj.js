import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useHakEdisMetraj(projeId) {
  return useQuery({
    queryKey: ['hak-edis-metraj', projeId],
    queryFn: () => api.get(`/hak-edis-metraj/${projeId}`),
    select: (res) => res.data,
    enabled: !!projeId,
  })
}

export function useHakEdisMetrajOzet(projeId) {
  return useQuery({
    queryKey: ['hak-edis-metraj-ozet', projeId],
    queryFn: () => api.get(`/hak-edis-metraj/${projeId}/ozet`),
    select: (res) => res.data,
    enabled: !!projeId,
  })
}

export function useHakEdisMetrajEkle(projeId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post(`/hak-edis-metraj/${projeId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hak-edis-metraj', projeId] })
      qc.invalidateQueries({ queryKey: ['hak-edis-metraj-ozet', projeId] })
    },
  })
}

export function useHakEdisMetrajTopluEkle(projeId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post(`/hak-edis-metraj/${projeId}/toplu`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hak-edis-metraj', projeId] })
      qc.invalidateQueries({ queryKey: ['hak-edis-metraj-ozet', projeId] })
    },
  })
}

export function useHakEdisMetrajGuncelle(projeId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/hak-edis-metraj/${projeId}/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hak-edis-metraj', projeId] })
      qc.invalidateQueries({ queryKey: ['hak-edis-metraj-ozet', projeId] })
    },
  })
}

export function useHakEdisMetrajSil(projeId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/hak-edis-metraj/${projeId}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hak-edis-metraj', projeId] })
      qc.invalidateQueries({ queryKey: ['hak-edis-metraj-ozet', projeId] })
    },
  })
}
