import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useEkipler() {
  return useQuery({
    queryKey: ['ekipler'],
    queryFn: () => api.get('/ekipler'),
    select: (res) => res.data,
  })
}

export function useEkip(id) {
  return useQuery({
    queryKey: ['ekipler', id],
    queryFn: () => api.get(`/ekipler/${id}`),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useEkipRaporlari(id) {
  return useQuery({
    queryKey: ['ekipler', id, 'raporlar'],
    queryFn: () => api.get(`/ekipler/${id}/raporlar`),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useEkipProjeleri(id) {
  return useQuery({
    queryKey: ['ekipler', id, 'projeler'],
    queryFn: () => api.get(`/ekipler/${id}/projeler`),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useEkipOlustur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/ekipler', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ekipler'] }),
  })
}

export function useEkipGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/ekipler/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ekipler'] }),
  })
}

export function useEkipSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/ekipler/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ekipler'] }),
  })
}
