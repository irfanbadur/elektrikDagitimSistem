import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useBolgeler() {
  return useQuery({
    queryKey: ['bolgeler'],
    queryFn: () => api.get('/bolgeler'),
    select: (res) => res.data,
  })
}

export function useBolge(id) {
  return useQuery({
    queryKey: ['bolgeler', id],
    queryFn: () => api.get(`/bolgeler/${id}`),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useBolgeMatris() {
  return useQuery({
    queryKey: ['bolge-matris'],
    queryFn: () => api.get('/bolgeler/matris'),
    select: (res) => res.data,
  })
}

export function useBolgeOlustur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/bolgeler', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bolgeler'] })
      qc.invalidateQueries({ queryKey: ['bolge-matris'] })
    },
  })
}

export function useBolgeGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/bolgeler/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bolgeler'] })
      qc.invalidateQueries({ queryKey: ['bolge-matris'] })
    },
  })
}

export function useBolgeSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/bolgeler/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bolgeler'] })
      qc.invalidateQueries({ queryKey: ['bolge-matris'] })
    },
  })
}

export function useEkipAtama() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ekipId, varsayilan_bolge_id, varsayilan_is_tipi_id }) =>
      api.patch(`/ekipler/${ekipId}/atama`, { varsayilan_bolge_id, varsayilan_is_tipi_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bolge-matris'] })
      qc.invalidateQueries({ queryKey: ['ekipler'] })
    },
  })
}
