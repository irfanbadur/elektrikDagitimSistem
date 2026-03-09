import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useDepolar() {
  return useQuery({
    queryKey: ['depolar'],
    queryFn: () => api.get('/depolar'),
    select: (res) => res.data,
  })
}

export function useDepo(id) {
  return useQuery({
    queryKey: ['depolar', id],
    queryFn: () => api.get(`/depolar/${id}`),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useDepoStok(depoId) {
  return useQuery({
    queryKey: ['depo-stok', depoId],
    queryFn: () => api.get(`/depolar/${depoId}/stok`),
    select: (res) => res.data,
    enabled: !!depoId,
  })
}

export function useDepoOlustur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/depolar', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['depolar'] }),
  })
}

export function useDepoGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/depolar/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['depolar'] }),
  })
}
