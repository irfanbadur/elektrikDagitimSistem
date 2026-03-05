import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function usePersonelListesi() {
  return useQuery({
    queryKey: ['personel'],
    queryFn: () => api.get('/organizasyon/personel'),
  })
}

export function usePersonelDetay(id) {
  return useQuery({
    queryKey: ['personel', id],
    queryFn: () => api.get(`/organizasyon/personel/${id}`),
    enabled: !!id,
  })
}

export function usePersonelOlustur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/organizasyon/personel', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personel'] })
      qc.invalidateQueries({ queryKey: ['organizasyon'] })
    },
  })
}

export function usePersonelGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/organizasyon/personel/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personel'] })
      qc.invalidateQueries({ queryKey: ['organizasyon'] })
    },
  })
}

export function usePersonelSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/organizasyon/personel/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personel'] })
      qc.invalidateQueries({ queryKey: ['organizasyon'] })
    },
  })
}

export function usePersonelEkipAta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ekip_id }) => api.patch(`/personel/${id}/ekip`, { ekip_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personel'] })
      qc.invalidateQueries({ queryKey: ['ekipler'] })
    },
  })
}
