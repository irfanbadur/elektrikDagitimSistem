import { useQuery } from '@tanstack/react-query'
import api from '@/api/client'

export function useDepoKatalog(filters) {
  return useQuery({
    queryKey: ['depo-katalog', filters],
    queryFn: async () => {
      const res = await api.get('/depo-katalog', { params: filters })
      console.log('[depo-katalog] API response:', typeof res, Array.isArray(res?.data), res?.data?.length)
      return res
    },
    select: (res) => res.data,
  })
}

export function useDepoKatalogFiltreler() {
  return useQuery({
    queryKey: ['depo-katalog-filtreler'],
    queryFn: () => api.get('/depo-katalog/filtreler'),
    select: (res) => res.data,
  })
}

export function useDepoKatalogIstatistikler() {
  return useQuery({
    queryKey: ['depo-katalog-istatistikler'],
    queryFn: () => api.get('/depo-katalog/istatistikler'),
    select: (res) => res.data,
  })
}
