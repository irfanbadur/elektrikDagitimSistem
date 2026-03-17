import { useQuery } from '@tanstack/react-query'
import api from '@/api/client'

export function useDisKisiler() {
  return useQuery({
    queryKey: ['dis-kisiler'],
    queryFn: () => api.get('/dis-kisiler'),
    select: (res) => res?.data || res || [],
  })
}

export function useDisKisiAra(q) {
  return useQuery({
    queryKey: ['dis-kisiler', 'ara', q],
    queryFn: () => api.get('/dis-kisiler/ara', { params: { q } }),
    select: (res) => res?.data || res || [],
    enabled: !!q && q.length >= 2,
    staleTime: 30000,
  })
}
