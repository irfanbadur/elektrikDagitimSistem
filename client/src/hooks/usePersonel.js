import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function usePersonelListesi() {
  return useQuery({
    queryKey: ['personel'],
    queryFn: () => api.get('/personel'),
    select: (res) => res.data,
  })
}

export function usePersonelDetay(id) {
  return useQuery({
    queryKey: ['personel', id],
    queryFn: () => api.get(`/personel/${id}`),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function usePersonelOlustur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/personel', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personel'] }),
  })
}

export function usePersonelGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/personel/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personel'] }),
  })
}

export function usePersonelSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/personel/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personel'] }),
  })
}

export function usePersonelEkipAta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.patch(`/personel/${id}/ekip`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personel'] })
      qc.invalidateQueries({ queryKey: ['ekipler'] })
    },
  })
}
