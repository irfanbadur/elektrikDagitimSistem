import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useEnerjiKesintileri(filters) {
  return useQuery({
    queryKey: ['enerji-kesintileri', filters],
    queryFn: () => api.get('/enerji-kesintileri', { params: filters }),
    select: (res) => res.data || res,
  })
}

export function useEnerjiKesintisiOlustur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/enerji-kesintileri', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enerji-kesintileri'] }),
  })
}

export function useEnerjiKesintisiDurumDegistir() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, durum }) => api.patch(`/enerji-kesintileri/${id}/durum`, { durum }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enerji-kesintileri'] }),
  })
}

export function useEnerjiKesintisiSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/enerji-kesintileri/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enerji-kesintileri'] }),
  })
}
