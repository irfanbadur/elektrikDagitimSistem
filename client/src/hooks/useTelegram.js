import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useTelegramKullanicilar() {
  return useQuery({
    queryKey: ['telegram', 'kullanicilar'],
    queryFn: () => api.get('/telegram/kullanicilar'),
  })
}

export function useTelegramKullaniciEkle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/telegram/kullanicilar', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['telegram'] }),
  })
}

export function useTelegramKullaniciSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/telegram/kullanicilar/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['telegram'] }),
  })
}

export function useTelegramMesajLog(filters) {
  return useQuery({
    queryKey: ['telegram', 'mesaj-log', filters],
    queryFn: () => api.get('/telegram/mesaj-log', { params: filters }),
  })
}

export function useTelegramIstatistik() {
  return useQuery({
    queryKey: ['telegram', 'istatistik'],
    queryFn: () => api.get('/telegram/istatistik'),
  })
}

export function useTelegramDurum() {
  return useQuery({
    queryKey: ['telegram', 'durum'],
    queryFn: () => api.get('/telegram/durum'),
    refetchInterval: 30000,
  })
}

export function useTelegramAyarlarKaydet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/telegram/ayarlar', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['telegram'] }),
  })
}
