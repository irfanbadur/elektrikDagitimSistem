import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

// ─── ŞABLON HOOKS ───────────────────────────

export function useDonguSablonlari() {
  return useQuery({
    queryKey: ['dongu-sablonlari'],
    queryFn: () => api.get('/dongu/sablon'),
    select: (res) => res.data,
  })
}

export function useDonguSablon(id) {
  return useQuery({
    queryKey: ['dongu-sablon', id],
    queryFn: () => api.get(`/dongu/sablon/${id}`),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useDonguSablonOlustur() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/dongu/sablon', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dongu-sablonlari'] })
    },
  })
}

export function useDonguSablonGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/dongu/sablon/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dongu-sablonlari'] })
      qc.invalidateQueries({ queryKey: ['dongu-sablon'] })
    },
  })
}

// ─── PROJE AŞAMA HOOKS ─────────────────────

export function useProjeAsamalari(projeId) {
  return useQuery({
    queryKey: ['proje-asamalari', projeId],
    queryFn: () => api.get(`/dongu/proje/${projeId}`),
    select: (res) => res.data,
    enabled: !!projeId,
  })
}

export function useProjeIlerleme(projeId) {
  return useQuery({
    queryKey: ['proje-ilerleme', projeId],
    queryFn: () => api.get(`/dongu/proje/${projeId}/ilerleme`),
    select: (res) => res.data,
    enabled: !!projeId,
  })
}

export function useProjeDonguAta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projeId, sablonId }) =>
      api.post(`/dongu/proje/${projeId}/ata`, { sablon_id: sablonId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-asamalari'] })
      qc.invalidateQueries({ queryKey: ['proje-ilerleme'] })
    },
  })
}

export function useProjeDonguSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (projeId) => api.delete(`/dongu/proje/${projeId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-asamalari'] })
      qc.invalidateQueries({ queryKey: ['proje-ilerleme'] })
    },
  })
}

export function useAsamaBaslat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ asamaId, ...data }) =>
      api.put(`/dongu/asama/${asamaId}/baslat`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-asamalari'] })
      qc.invalidateQueries({ queryKey: ['proje-ilerleme'] })
    },
  })
}

export function useAsamaTamamla() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ asamaId, ...data }) =>
      api.put(`/dongu/asama/${asamaId}/tamamla`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-asamalari'] })
      qc.invalidateQueries({ queryKey: ['proje-ilerleme'] })
    },
  })
}

export function useAsamaAtla() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ asamaId, ...data }) =>
      api.put(`/dongu/asama/${asamaId}/atla`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-asamalari'] })
      qc.invalidateQueries({ queryKey: ['proje-ilerleme'] })
    },
  })
}

// ─── FAZ/ADIM HOOKS (yeni sistem) ─────────────

export function useProjeFazlar(projeId) {
  return useQuery({
    queryKey: ['proje-fazlar', projeId],
    queryFn: () => api.get(`/dongu/proje/${projeId}/faz`),
    select: (res) => res.data,
    enabled: !!projeId,
  })
}

export function useProjeFazIlerleme(projeId) {
  return useQuery({
    queryKey: ['proje-faz-ilerleme', projeId],
    queryFn: () => api.get(`/dongu/proje/${projeId}/faz-ilerleme`),
    select: (res) => res.data,
    enabled: !!projeId,
  })
}

export function useProjeFazAta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projeId, isTipiId }) =>
      api.post(`/dongu/proje/${projeId}/faz-ata`, { is_tipi_id: isTipiId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-fazlar'] })
      qc.invalidateQueries({ queryKey: ['proje-faz-ilerleme'] })
      qc.invalidateQueries({ queryKey: ['proje'] })
    },
  })
}

export function useAdimBaslat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ adimId, ...data }) =>
      api.put(`/dongu/adim/${adimId}/baslat`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-fazlar'] })
      qc.invalidateQueries({ queryKey: ['proje-faz-ilerleme'] })
      qc.invalidateQueries({ queryKey: ['proje'] })
    },
  })
}

export function useAdimTamamla() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ adimId, ...data }) =>
      api.put(`/dongu/adim/${adimId}/tamamla`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-fazlar'] })
      qc.invalidateQueries({ queryKey: ['proje-faz-ilerleme'] })
      qc.invalidateQueries({ queryKey: ['proje'] })
    },
  })
}

export function useAdimMetaGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ adimId, ...meta }) =>
      api.put(`/dongu/adim/${adimId}/meta`, meta),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-fazlar'] })
      qc.invalidateQueries({ queryKey: ['proje-faz-ilerleme'] })
    },
  })
}

export function useAdimAtla() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ adimId, ...data }) =>
      api.put(`/dongu/adim/${adimId}/atla`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proje-fazlar'] })
      qc.invalidateQueries({ queryKey: ['proje-faz-ilerleme'] })
      qc.invalidateQueries({ queryKey: ['proje'] })
    },
  })
}
