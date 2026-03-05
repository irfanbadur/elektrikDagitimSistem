import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useIsTipleri() {
  return useQuery({
    queryKey: ['is-tipleri'],
    queryFn: () => api.get('/is-tipleri'),
    select: (res) => res.data,
  })
}

export function useIsTipi(id) {
  return useQuery({
    queryKey: ['is-tipi', id],
    queryFn: () => api.get(`/is-tipleri/${id}`),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useIsTipiOlustur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/is-tipleri', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['is-tipleri'] })
    },
  })
}

export function useIsTipiGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/is-tipleri/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['is-tipleri'] })
      qc.invalidateQueries({ queryKey: ['is-tipi'] })
    },
  })
}

export function useIsTipiSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/is-tipleri/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['is-tipleri'] })
    },
  })
}
