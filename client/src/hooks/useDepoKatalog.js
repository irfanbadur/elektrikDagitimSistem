import { useQuery } from '@tanstack/react-query'
import api from '@/api/client'

export function useDepoKatalog(filters) {
  return useQuery({
    queryKey: ['malzeme-katalog', filters],
    queryFn: async () => {
      const res = await api.get('/malzeme-katalog', { params: filters })
      return res
    },
    select: (res) => res.data,
    enabled: !!filters,
  })
}

export function useDepoKatalogFiltreler() {
  return useQuery({
    queryKey: ['malzeme-katalog-filtreler'],
    queryFn: () => api.get('/malzeme-katalog/filtreler'),
    select: (res) => res.data,
  })
}

export function useDepoKatalogIstatistikler() {
  return useQuery({
    queryKey: ['malzeme-katalog-istatistikler'],
    queryFn: () => api.get('/malzeme-katalog/istatistikler'),
    select: (res) => res.data,
  })
}
