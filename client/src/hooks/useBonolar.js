import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export function useBonolar() {
  return useQuery({
    queryKey: ['bonolar'],
    queryFn: () => api.get('/bonolar'),
    select: (res) => res.data,
  })
}

export function useBono(id) {
  return useQuery({
    queryKey: ['bonolar', id],
    queryFn: () => api.get(`/bonolar/${id}`),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useBonoOlustur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/bonolar', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bonolar'] })
      qc.invalidateQueries({ queryKey: ['depo-stok'] })
      qc.invalidateQueries({ queryKey: ['malzemeler'] })
      qc.invalidateQueries({ queryKey: ['proje-kesif'] })
    },
  })
}

export function useBonoGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/bonolar/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bonolar'] }),
  })
}

export function useEvrakKaydet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (formData) => fetch('/api/bonolar/evrak-kaydet', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData,
    }).then(async (res) => {
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Kaydetme hatasi')
      return json
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bonolar'] })
      qc.invalidateQueries({ queryKey: ['depo-stok'] })
      qc.invalidateQueries({ queryKey: ['malzemeler'] })
      qc.invalidateQueries({ queryKey: ['proje-kesif'] })
      qc.invalidateQueries({ queryKey: ['dosyalar'] })
    },
  })
}
