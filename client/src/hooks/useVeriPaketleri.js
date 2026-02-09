import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useVeriPaketleri(filters) {
  return useQuery({
    queryKey: ['veri-paketleri', filters],
    queryFn: () => api.get('/veri-paketleri', { params: filters }),
  })
}

export function useVeriPaketi(id) {
  return useQuery({
    queryKey: ['veri-paketleri', id],
    queryFn: () => api.get(`/veri-paketleri/${id}`),
    enabled: !!id,
  })
}

export function useVeriPaketiGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/veri-paketleri/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['veri-paketleri'] }),
  })
}

export function useVeriPaketiSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/veri-paketleri/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['veri-paketleri'] }),
  })
}

export function useVeriPaketiMedyalari(paketId) {
  return useQuery({
    queryKey: ['veri-paketleri', paketId, 'medya'],
    queryFn: () => api.get(`/veri-paketleri/${paketId}/medya`),
    enabled: !!paketId,
  })
}
