import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useProjeVeriPaketleri(projeId, filters = {}) {
  return useQuery({
    queryKey: ['proje-veri-paketleri', projeId, filters],
    queryFn: () =>
      api.get('/veri-paketi', {
        params: { proje_id: projeId, ...filters },
      }),
    select: (res) => res.data,
    enabled: !!projeId,
  })
}

export function useVeriPaketiDetay(id) {
  return useQuery({
    queryKey: ['veri-paketi', id],
    queryFn: () => api.get(`/veri-paketi/${id}`),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useVeriPaketiOlustur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/veri-paketi', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-veri-paketleri'] })
    },
  })
}

export function useVeriPaketiDosyaEkle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ paketId, formData }) =>
      api.post(`/veri-paketi/${paketId}/dosya`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-veri-paketleri'] })
      qc.invalidateQueries({ queryKey: ['veri-paketi'] })
    },
  })
}

export function useVeriPaketiTamamla() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (paketId) => api.put(`/veri-paketi/${paketId}/tamamla`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-veri-paketleri'] })
      qc.invalidateQueries({ queryKey: ['veri-paketi'] })
    },
  })
}
