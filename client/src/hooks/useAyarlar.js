import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useAyarlar() {
  return useQuery({
    queryKey: ['ayarlar'],
    queryFn: () => api.get('/ayarlar'),
    select: (res) => res.data,
  })
}

export function useAyarlarGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.put('/ayarlar', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ayarlar'] }),
  })
}
