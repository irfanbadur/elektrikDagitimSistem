import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useKatalog(filters) {
  return useQuery({
    queryKey: ['katalog', filters],
    queryFn: () => api.get('/katalog', { params: filters }),
  })
}

export function useKatalogKategoriler() {
  return useQuery({
    queryKey: ['katalog', 'kategoriler'],
    queryFn: () => api.get('/katalog/kategoriler'),
  })
}

export function useKatalogDetay(id) {
  return useQuery({
    queryKey: ['katalog', id],
    queryFn: () => api.get(`/katalog/${id}`),
    enabled: !!id,
  })
}

export function useKatalogOlustur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/katalog', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['katalog'] }),
  })
}

export function useKatalogGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/katalog/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['katalog'] }),
  })
}

export function useKatalogSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/katalog/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['katalog'] }),
  })
}
