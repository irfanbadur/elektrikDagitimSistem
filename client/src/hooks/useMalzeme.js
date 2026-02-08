import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useMalzemeler() {
  return useQuery({
    queryKey: ['malzemeler'],
    queryFn: () => api.get('/malzemeler'),
    select: (res) => res.data,
  })
}

export function useMalzeme(id) {
  return useQuery({
    queryKey: ['malzemeler', id],
    queryFn: () => api.get(`/malzemeler/${id}`),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useMalzemeOlustur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/malzemeler', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['malzemeler'] }),
  })
}

export function useMalzemeGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/malzemeler/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['malzemeler'] }),
  })
}

export function useKritikMalzemeler() {
  return useQuery({
    queryKey: ['malzemeler', 'kritik'],
    queryFn: () => api.get('/malzemeler/kritik'),
    select: (res) => res.data,
  })
}

export function useMalzemeHareketleri(filters) {
  return useQuery({
    queryKey: ['malzeme-hareketleri', filters],
    queryFn: () => api.get('/malzeme-hareketleri', { params: filters }),
    select: (res) => res.data,
  })
}

export function useMalzemeHareketOlustur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/malzeme-hareketleri', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['malzeme-hareketleri'] })
      qc.invalidateQueries({ queryKey: ['malzemeler'] })
    },
  })
}
