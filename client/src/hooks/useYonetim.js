import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

// ─── ROLLER ──────────────────────────────────────
export function useRoller() {
  return useQuery({
    queryKey: ['yonetim', 'roller'],
    queryFn: () => api.get('/yonetim/roller'),
  })
}

export function useRolOlustur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/yonetim/roller', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yonetim', 'roller'] }),
  })
}

export function useRolGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/yonetim/roller/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yonetim', 'roller'] }),
  })
}

export function useRolSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/yonetim/roller/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yonetim', 'roller'] }),
  })
}

// ─── İZİNLER ─────────────────────────────────────
export function useIzinTanimlari() {
  return useQuery({
    queryKey: ['yonetim', 'izinler'],
    queryFn: () => api.get('/yonetim/izinler'),
  })
}

// ─── KULLANICILAR ────────────────────────────────
export function useKullanicilar() {
  return useQuery({
    queryKey: ['yonetim', 'kullanicilar'],
    queryFn: () => api.get('/yonetim/kullanicilar'),
  })
}

export function useKullaniciOlustur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/yonetim/kullanicilar', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yonetim', 'kullanicilar'] }),
  })
}

export function useKullaniciGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/yonetim/kullanicilar/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yonetim', 'kullanicilar'] }),
  })
}

export function useKullaniciRolGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, roller }) => api.put(`/yonetim/kullanicilar/${id}/roller`, { roller }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yonetim', 'kullanicilar'] }),
  })
}
