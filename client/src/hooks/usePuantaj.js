import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function usePuantajlar(filters) {
  return useQuery({
    queryKey: ['puantaj', filters],
    queryFn: () => api.get('/puantaj', { params: filters }),
    select: (res) => res.data,
  })
}

export function usePuantaj(id) {
  return useQuery({
    queryKey: ['puantaj', id],
    queryFn: () => api.get(`/puantaj/${id}`),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function usePuantajOlustur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/puantaj', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['puantaj'] }),
  })
}

export function usePuantajGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/puantaj/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['puantaj'] }),
  })
}

export function usePuantajOzet(filters) {
  return useQuery({
    queryKey: ['puantaj', 'ozet', filters],
    queryFn: () => api.get('/puantaj/ozet', { params: filters }),
    select: (res) => res.data,
  })
}

export function usePuantajTakvim(ay) {
  return useQuery({
    queryKey: ['puantaj', 'takvim', ay],
    queryFn: () => api.get(`/puantaj/takvim/${ay}`),
    select: (res) => res.data,
    enabled: !!ay,
  })
}
