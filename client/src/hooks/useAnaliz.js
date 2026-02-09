import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useAnalizler(filters) {
  return useQuery({
    queryKey: ['analiz', filters],
    queryFn: () => api.get('/analiz', { params: filters }),
  })
}

export function useAnalizDetay(id) {
  return useQuery({
    queryKey: ['analiz', id],
    queryFn: () => api.get(`/analiz/${id}`),
    enabled: !!id,
  })
}

export function useAnalizBaslat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/analiz/baslat', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analiz'] }),
  })
}

export function useAnalizOnayla() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/analiz/${id}/onayla`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analiz'] }),
  })
}

export function useAnalizIstatistik() {
  return useQuery({
    queryKey: ['analiz', 'istatistik'],
    queryFn: () => api.get('/analiz/istatistik'),
  })
}

export function useMedyaAnalizleri(medyaId) {
  return useQuery({
    queryKey: ['analiz', 'medya', medyaId],
    queryFn: () => api.get(`/analiz/medya/${medyaId}`),
    enabled: !!medyaId,
  })
}

export function useAiDurum() {
  return useQuery({
    queryKey: ['ai', 'durum'],
    queryFn: () => api.get('/ai/durum'),
  })
}

export function useAiAyarlar() {
  return useQuery({
    queryKey: ['ai', 'ayarlar'],
    queryFn: () => api.get('/ai/ayarlar'),
  })
}

export function useAiAyarlarKaydet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.put('/ai/ayarlar', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai'] }),
  })
}
