import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useMalzemeGruplari(arama) {
  return useQuery({
    queryKey: ['malzeme-gruplari', arama || ''],
    queryFn: () => api.get('/malzeme-gruplari', { params: arama ? { arama } : {} }),
    select: (res) => res.data || [],
  })
}

export function useMalzemeGrup(id) {
  return useQuery({
    queryKey: ['malzeme-gruplari', 'tek', id],
    queryFn: () => api.get(`/malzeme-gruplari/${id}`),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useMalzemeGrupOlustur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/malzeme-gruplari', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['malzeme-gruplari'] }),
  })
}

export function useMalzemeGrupGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/malzeme-gruplari/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['malzeme-gruplari'] }),
  })
}

export function useMalzemeGrupSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/malzeme-gruplari/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['malzeme-gruplari'] }),
  })
}
