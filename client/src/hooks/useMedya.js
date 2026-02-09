import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useMedyalar(filters) {
  return useQuery({
    queryKey: ['medya', filters],
    queryFn: () => api.get('/medya', { params: filters }),
  })
}

export function useMedya(id) {
  return useQuery({
    queryKey: ['medya', id],
    queryFn: () => api.get(`/medya/${id}`),
    enabled: !!id,
  })
}

export function useMedyaHarita() {
  return useQuery({
    queryKey: ['medya', 'harita'],
    queryFn: () => api.get('/medya/harita'),
  })
}

export function useMedyaSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/medya/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['medya'] }),
  })
}
