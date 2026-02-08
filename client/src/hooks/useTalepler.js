import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useTalepler(filters) {
  return useQuery({
    queryKey: ['talepler', filters],
    queryFn: () => api.get('/talepler', { params: filters }),
    select: (res) => res.data,
  })
}

export function useTalep(id) {
  return useQuery({
    queryKey: ['talepler', id],
    queryFn: () => api.get(`/talepler/${id}`),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useTalepOlustur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/talepler', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['talepler'] }),
  })
}

export function useTalepGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/talepler/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['talepler'] }),
  })
}

export function useTalepDurumDegistir() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.patch(`/talepler/${id}/durum`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['talepler'] }),
  })
}

export function useBekleyenTalepler() {
  return useQuery({
    queryKey: ['talepler', 'bekleyen'],
    queryFn: () => api.get('/talepler/bekleyen'),
    select: (res) => res.data,
  })
}
