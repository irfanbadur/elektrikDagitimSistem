import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useProjeler(filters) {
  return useQuery({
    queryKey: ['projeler', filters],
    queryFn: () => api.get('/projeler', { params: filters }),
    select: (res) => res.data,
  })
}

export function useProje(id) {
  return useQuery({
    queryKey: ['projeler', id],
    queryFn: () => api.get(`/projeler/${id}`),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useProjeOlustur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/projeler', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projeler'] }),
  })
}

export function useProjeGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/projeler/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projeler'] }),
  })
}

export function useProjeSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/projeler/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projeler'] }),
  })
}

export function useTopluProjeSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids) => api.post('/projeler/toplu-sil', { ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projeler'] }),
  })
}

export function useProjeDurumDegistir() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.patch(`/projeler/${id}/durum`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projeler'] }),
  })
}

export function useProjeIstatistikler() {
  return useQuery({
    queryKey: ['projeler', 'istatistikler'],
    queryFn: () => api.get('/projeler/istatistikler'),
    select: (res) => res.data,
  })
}

export function useProjeDurumGecmisi(id) {
  return useQuery({
    queryKey: ['projeler', id, 'durum-gecmisi'],
    queryFn: () => api.get(`/projeler/${id}/durum-gecmisi`),
    select: (res) => res.data,
    enabled: !!id,
  })
}
