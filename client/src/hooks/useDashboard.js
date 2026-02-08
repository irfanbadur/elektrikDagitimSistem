import { useQuery } from '@tanstack/react-query'
import api from '@/api/client'

export function useDashboardOzet() {
  return useQuery({
    queryKey: ['dashboard', 'ozet'],
    queryFn: () => api.get('/dashboard/ozet'),
    select: (res) => res.data,
  })
}

export function useDashboardAktiviteler(limit) {
  return useQuery({
    queryKey: ['dashboard', 'aktiviteler', limit],
    queryFn: () => api.get('/dashboard/aktiviteler', { params: { limit } }),
    select: (res) => res.data,
  })
}

export function useEkipDurumlari() {
  return useQuery({
    queryKey: ['dashboard', 'ekip-durumlari'],
    queryFn: () => api.get('/dashboard/ekip-durumlari'),
    select: (res) => res.data,
  })
}
