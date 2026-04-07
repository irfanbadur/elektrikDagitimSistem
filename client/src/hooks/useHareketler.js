import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useHareketler(filters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
  const qs = params.toString()
  return useQuery({
    queryKey: ['hareketler', qs],
    queryFn: () => api.get(`/hareketler${qs ? `?${qs}` : ''}`).then(r => r.data),
  })
}

export function useHareket(id) {
  return useQuery({
    queryKey: ['hareketler', id],
    queryFn: () => api.get(`/hareketler/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useHareketKaydet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (formData) => fetch('/api/hareketler/kaydet', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData,
    }).then(async (res) => {
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Kaydetme hatası')
      return json
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hareketler'] })
      qc.invalidateQueries({ queryKey: ['depo-stok'] })
      qc.invalidateQueries({ queryKey: ['malzemeler'] })
      qc.invalidateQueries({ queryKey: ['proje-kesif'] })
      qc.invalidateQueries({ queryKey: ['dosyalar'] })
      qc.invalidateQueries({ queryKey: ['depolar'] })
    },
  })
}

export function useHareketSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/hareketler/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hareketler'] })
      qc.invalidateQueries({ queryKey: ['depo-stok'] })
      qc.invalidateQueries({ queryKey: ['depolar'] })
    },
  })
}

export function useHareketIptal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, neden }) => api.post(`/hareketler/${id}/iptal`, { neden }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hareketler'] })
      qc.invalidateQueries({ queryKey: ['depo-stok'] })
      qc.invalidateQueries({ queryKey: ['malzemeler'] })
      qc.invalidateQueries({ queryKey: ['depolar'] })
    },
  })
}
