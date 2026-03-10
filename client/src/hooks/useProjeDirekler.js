import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useProjeDirekler(projeId) {
  return useQuery({
    queryKey: ['proje-direkler', projeId],
    queryFn: () => api.get(`/proje-direkler/${projeId}`),
    select: (res) => res.data || res,
    enabled: !!projeId,
  })
}

export function useProjeDireklerTopluKaydet(projeId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (kalemler) => api.post(`/proje-direkler/${projeId}/toplu`, { kalemler }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-direkler', projeId] })
    },
  })
}

export function useProjeDirekGuncelle(projeId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/proje-direkler/${projeId}/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-direkler', projeId] })
    },
  })
}

export function useProjeDirekSil(projeId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/proje-direkler/${projeId}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-direkler', projeId] })
    },
  })
}
