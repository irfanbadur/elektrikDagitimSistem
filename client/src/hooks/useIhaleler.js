import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useIhaleler() {
  return useQuery({
    queryKey: ['ihaleler'],
    queryFn: () => api.get('/ihaleler'),
    select: (res) => res.data,
  })
}

export function useIhale(id) {
  return useQuery({
    queryKey: ['ihaleler', Number(id)],
    queryFn: () => api.get(`/ihaleler/${id}`),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useIhaleProjeleri(id) {
  return useQuery({
    queryKey: ['ihaleler', Number(id), 'projeler'],
    queryFn: () => api.get(`/ihaleler/${id}/projeler`),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useIhaleBolgeDagilimi(id) {
  return useQuery({
    queryKey: ['ihaleler', Number(id), 'bolge'],
    queryFn: () => api.get(`/ihaleler/${id}/bolge-dagilimi`),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useIhaleEkipDagilimi(id) {
  return useQuery({
    queryKey: ['ihaleler', Number(id), 'ekip'],
    queryFn: () => api.get(`/ihaleler/${id}/ekip-dagilimi`),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useIhaleAsamaDagilimi(id) {
  return useQuery({
    queryKey: ['ihaleler', Number(id), 'asama'],
    queryFn: () => api.get(`/ihaleler/${id}/asama-dagilimi`),
    select: (res) => res.data,
    enabled: !!id,
  })
}

const invalidateAll = (qc) => {
  qc.invalidateQueries({ queryKey: ['ihaleler'] })
  qc.invalidateQueries({ queryKey: ['dashboard', 'ihale-ozet'] })
  qc.invalidateQueries({ queryKey: ['projeler'] })
}

export function useIhaleOlustur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/ihaleler', data),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useIhaleGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/ihaleler/${id}`, data),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useIhaleSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/ihaleler/${id}`),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useIhaleProjeleriBagla() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.post(`/ihaleler/${id}/projeleri-bagla`, data),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useIhaleProjeyiCikar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, proje_id }) => api.post(`/ihaleler/${id}/projeyi-cikar`, { proje_id }),
    onSuccess: () => invalidateAll(qc),
  })
}
