import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

// ═══════════════════════════════════════════
// ORGANİZASYON AĞACI & POZİSYONLAR
// ═══════════════════════════════════════════

export function useOrganizasyonAgaci() {
  return useQuery({
    queryKey: ['organizasyon', 'agac'],
    queryFn: () => api.get('/organizasyon/agac'),
  })
}

export function usePozisyonlar() {
  return useQuery({
    queryKey: ['organizasyon', 'pozisyonlar'],
    queryFn: () => api.get('/organizasyon/pozisyonlar'),
  })
}

export function useUnvanlar() {
  return useQuery({
    queryKey: ['organizasyon', 'unvanlar'],
    queryFn: () => api.get('/organizasyon/unvanlar'),
  })
}

// ═══════════════════════════════════════════
// PERSONEL (kullanıcı bazlı)
// ═══════════════════════════════════════════

export function useKullaniciListesi() {
  return useQuery({
    queryKey: ['organizasyon', 'personel'],
    queryFn: () => api.get('/organizasyon/personel'),
  })
}

export function useKullaniciDetay(id) {
  return useQuery({
    queryKey: ['organizasyon', 'personel', id],
    queryFn: () => api.get(`/organizasyon/personel/${id}`),
    enabled: !!id,
  })
}

export function useKullaniciGuncelle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/organizasyon/personel/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizasyon', 'personel'] })
      qc.invalidateQueries({ queryKey: ['organizasyon', 'agac'] })
    },
  })
}

export function useAltPersonel(id) {
  return useQuery({
    queryKey: ['organizasyon', 'personel', id, 'alt'],
    queryFn: () => api.get(`/organizasyon/personel/${id}/alt-personel`),
    enabled: !!id,
  })
}

export function useUstZincir(id) {
  return useQuery({
    queryKey: ['organizasyon', 'personel', id, 'ust'],
    queryFn: () => api.get(`/organizasyon/personel/${id}/ust-zincir`),
    enabled: !!id,
  })
}

// ═══════════════════════════════════════════
// GÖREVLER
// ═══════════════════════════════════════════

export function useGorevTanimlari() {
  return useQuery({
    queryKey: ['organizasyon', 'gorev-tanimlari'],
    queryFn: () => api.get('/organizasyon/gorevler/tanimlar'),
  })
}

export function useKisininGorevleri(id) {
  return useQuery({
    queryKey: ['organizasyon', 'personel', id, 'gorevler'],
    queryFn: () => api.get(`/organizasyon/personel/${id}/gorevler`),
    enabled: !!id,
  })
}

export function useProjeninGorevleri(projeId) {
  return useQuery({
    queryKey: ['organizasyon', 'proje-gorevler', projeId],
    queryFn: () => api.get(`/organizasyon/gorevler/proje/${projeId}`),
    enabled: !!projeId,
  })
}

export function useGorevAta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/organizasyon/gorevler/ata', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizasyon'] })
    },
  })
}

export function useGorevSonlandir() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, bitis_tarihi }) => api.put(`/organizasyon/gorevler/${id}/sonlandir`, { bitis_tarihi }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizasyon'] })
    },
  })
}

// ═══════════════════════════════════════════
// İŞ GÖREVLERİ MATRİSİ
// ═══════════════════════════════════════════

export function useTumIsGorevleri() {
  return useQuery({
    queryKey: ['organizasyon', 'is-gorevleri'],
    queryFn: () => api.get('/organizasyon/is-gorevleri'),
  })
}

export function useIsGorevAta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/organizasyon/is-gorevleri/ata', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizasyon', 'is-gorevleri'] })
    },
  })
}

export function useIsGorevSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/organizasyon/is-gorevleri/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizasyon', 'is-gorevleri'] })
    },
  })
}

// ═══════════════════════════════════════════
// BELGELER
// ═══════════════════════════════════════════

export function useBelgeTurleri() {
  return useQuery({
    queryKey: ['organizasyon', 'belge-turleri'],
    queryFn: () => api.get('/organizasyon/belgeler/turler'),
  })
}

export function useKisininBelgeleri(id) {
  return useQuery({
    queryKey: ['organizasyon', 'personel', id, 'belgeler'],
    queryFn: () => api.get(`/organizasyon/personel/${id}/belgeler`),
    enabled: !!id,
  })
}

export function useBelgeEkle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/organizasyon/belgeler', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizasyon'] })
    },
  })
}

export function useBelgeSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/organizasyon/belgeler/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizasyon'] })
    },
  })
}

export function useSuresiDolacakBelgeler(gun = 30) {
  return useQuery({
    queryKey: ['organizasyon', 'belgeler', 'suresi-dolacak', gun],
    queryFn: () => api.get(`/organizasyon/belgeler/suresi-dolacak?gun=${gun}`),
  })
}

export function useSuresiDolmusBelgeler() {
  return useQuery({
    queryKey: ['organizasyon', 'belgeler', 'suresi-dolmus'],
    queryFn: () => api.get('/organizasyon/belgeler/suresi-dolmus'),
  })
}

export function useEksikZorunluBelgeler() {
  return useQuery({
    queryKey: ['organizasyon', 'belgeler', 'eksik-zorunlu'],
    queryFn: () => api.get('/organizasyon/belgeler/eksik-zorunlu'),
  })
}

// ═══════════════════════════════════════════
// YETKİNLİKLER
// ═══════════════════════════════════════════

export function useYetkinlikTanimlari() {
  return useQuery({
    queryKey: ['organizasyon', 'yetkinlik-tanimlari'],
    queryFn: () => api.get('/organizasyon/yetkinlikler/tanimlar'),
  })
}

export function useKisininYetkinlikleri(id) {
  return useQuery({
    queryKey: ['organizasyon', 'personel', id, 'yetkinlikler'],
    queryFn: () => api.get(`/organizasyon/personel/${id}/yetkinlikler`),
    enabled: !!id,
  })
}

export function useYetkinlikEkle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/organizasyon/yetkinlikler', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizasyon'] })
    },
  })
}
