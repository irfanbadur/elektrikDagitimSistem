import { useState, useEffect, useMemo } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import { useAyarlar, useAyarlarGuncelle } from '@/hooks/useAyarlar'
import { useAuth } from '@/context/AuthContext'
import { Plus, X, Tag, UserPlus, Trash2, Loader2, CheckSquare, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/api/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ─── Inline hooks (API henüz yoksa hata vermesin) ──────
function useTumIsGorevleri() {
  return useQuery({
    queryKey: ['organizasyon', 'is-gorevleri'],
    queryFn: () => api.get('/organizasyon/is-gorevleri'),
    retry: false,
  })
}

function useIsGorevAta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/organizasyon/is-gorevleri/ata', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizasyon', 'is-gorevleri'] }),
  })
}

function useIsGorevSil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/organizasyon/is-gorevleri/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizasyon', 'is-gorevleri'] }),
  })
}

// ─── Ayarlardan değer oku yardımcı ──────
function ayarOku(ayarlar, anahtar) {
  if (!ayarlar) return ''
  if (Array.isArray(ayarlar)) {
    const found = ayarlar.find(a => a.anahtar === anahtar)
    return found?.deger || ''
  }
  return ayarlar[anahtar] || ''
}

// ─── Görev Tipi Yönetimi (Ayarlar benzeri) ────────────
function GorevTipiYonetimi() {
  const { data: ayarlar, isLoading } = useAyarlar()
  const guncelle = useAyarlarGuncelle()
  const [tipler, setTipler] = useState([])
  const [yeniTip, setYeniTip] = useState('')
  const [kaydedildi, setKaydedildi] = useState(false)

  useEffect(() => {
    if (ayarlar) {
      const tipStr = ayarOku(ayarlar, 'gorev_tipleri')
      setTipler(tipStr ? tipStr.split(',').map(t => t.trim()).filter(Boolean) : [])
    }
  }, [ayarlar])

  const handleEkle = () => {
    const tip = yeniTip.trim()
    if (tip && !tipler.includes(tip)) {
      const yeniListe = [...tipler, tip]
      setTipler(yeniListe)
      setYeniTip('')
      kaydet(yeniListe)
    }
  }

  const handleSil = (tip) => {
    const yeniListe = tipler.filter(t => t !== tip)
    setTipler(yeniListe)
    kaydet(yeniListe)
  }

  const kaydet = (liste) => {
    guncelle.mutate({ gorev_tipleri: liste.join(',') }, {
      onSuccess: () => { setKaydedildi(true); setTimeout(() => setKaydedildi(false), 3000) }
    })
  }

  if (isLoading) return <div className="skeleton h-32 w-full max-w-md" />

  return (
    <div className="max-w-md">
      <div className="mb-4 flex items-center gap-3">
        <Tag className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Görev Tipleri</h3>
      </div>
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {tipler.map(tip => (
            <span key={tip} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
              {tip}
              <button onClick={() => handleSil(tip)} className="ml-1 rounded-full p-0.5 hover:bg-emerald-100">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {tipler.length === 0 && <p className="text-sm text-muted-foreground">Henüz görev tipi tanımlanmamış</p>}
        </div>
        <div className="flex gap-2">
          <input
            value={yeniTip}
            onChange={e => setYeniTip(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEkle()}
            placeholder="Yeni görev tipi"
            className="flex-1 rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <button onClick={handleEkle} className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Ekle
          </button>
        </div>
        {kaydedildi && <p className="mt-3 text-sm text-green-600">Kaydedildi!</p>}
      </div>
    </div>
  )
}

// ─── Görev Ata Modal ────────────
function GorevAtaModal({ kullanici, isTipleri, gorevTipleri, onKapat, onKaydet, mevcutGorevler }) {
  const [isTipi, setIsTipi] = useState('')
  const [gorevTipi, setGorevTipi] = useState('')
  const [gecici, setGecici] = useState(false)
  const [notlar, setNotlar] = useState('')

  useEffect(() => {
    if (isTipi && mevcutGorevler) {
      const mevcut = mevcutGorevler.find(g => g.is_tipi === isTipi)
      if (mevcut) {
        setGorevTipi(mevcut.gorev_tipi)
        setGecici(!!mevcut.gecici)
        setNotlar(mevcut.notlar || '')
      } else {
        setGorevTipi('')
        setGecici(false)
        setNotlar('')
      }
    }
  }, [isTipi, mevcutGorevler])

  const handleKaydet = () => {
    if (!isTipi || !gorevTipi) return
    onKaydet({ kullanici_id: kullanici.id, is_tipi: isTipi, gorev_tipi: gorevTipi, gecici, notlar })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onKapat}>
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Görev Ata</h3>
          <button onClick={onKapat} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          <strong>{kullanici.ad_soyad}</strong> kullanıcısına görev ata
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">İş Tipi</label>
            <select value={isTipi} onChange={e => setIsTipi(e.target.value)} className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm">
              <option value="">Seçiniz...</option>
              {(isTipleri || []).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Görev Tipi</label>
            <select value={gorevTipi} onChange={e => setGorevTipi(e.target.value)} className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm">
              <option value="">Seçiniz...</option>
              {(gorevTipleri || []).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="modal_gecici" checked={gecici} onChange={e => setGecici(e.target.checked)} className="rounded border-gray-300" />
            <label htmlFor="modal_gecici" className="text-sm">Geçici görev</label>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Notlar</label>
            <textarea value={notlar} onChange={e => setNotlar(e.target.value)} rows={2} placeholder="Opsiyonel not..." className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm resize-none" />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onKapat} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            İptal
          </button>
          <button
            onClick={handleKaydet}
            disabled={!isTipi || !gorevTipi}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" /> Kaydet
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Ana Sayfa ────────────
export default function GorevlerPage() {
  const { data: isGorevData, isLoading, isError } = useTumIsGorevleri()
  const { data: ayarlar } = useAyarlar()
  const gorevAta = useIsGorevAta()
  const gorevSil = useIsGorevSil()
  const { kullanici: mevcutKullanici } = useAuth()

  const [seciliKullanici, setSeciliKullanici] = useState(null)
  const [aktifSekme, setAktifSekme] = useState('tablo')
  const [arama, setArama] = useState('')

  // İş tiplerini ayarlardan al
  const isTipleri = useMemo(() => {
    const tipStr = ayarOku(ayarlar, 'calisan_proje_tipleri')
    return tipStr ? tipStr.split(',').map(t => t.trim()).filter(Boolean) : []
  }, [ayarlar])

  // Görev tiplerini ayarlardan al
  const gorevTipleri = useMemo(() => {
    const tipStr = ayarOku(ayarlar, 'gorev_tipleri')
    return tipStr ? tipStr.split(',').map(t => t.trim()).filter(Boolean) : []
  }, [ayarlar])

  // Data'yı güvenli diziye çevir
  const kullaniciListesi = useMemo(() => {
    if (!isGorevData) return []
    if (!Array.isArray(isGorevData)) return []
    return isGorevData
  }, [isGorevData])

  // Arama filtresi
  const filtrelenmisData = useMemo(() => {
    if (!arama.trim()) return kullaniciListesi
    const q = arama.toLowerCase()
    return kullaniciListesi.filter(k =>
      (k.ad_soyad || '').toLowerCase().includes(q) ||
      (k.pozisyon_adi || '').toLowerCase().includes(q)
    )
  }, [kullaniciListesi, arama])

  const handleGorevAta = (data) => {
    gorevAta.mutate(
      { ...data, atayan_id: mevcutKullanici?.id },
      { onSuccess: () => setSeciliKullanici(null) }
    )
  }

  const handleGorevSil = (gorevId) => {
    gorevSil.mutate(gorevId)
  }

  // Kullanıcının belirli iş tipindeki görevini bul
  const gorevBul = (kullanici, isTipi) => {
    if (!kullanici.gorevler) return null
    return kullanici.gorevler.find(g => g.is_tipi === isTipi) || null
  }

  // Geçici görevleri bul
  const geciciGorevBul = (kullanici) => {
    if (!kullanici.gorevler) return []
    return kullanici.gorevler.filter(g => g.gecici) || []
  }

  return (
    <MainLayout title="Görevler">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Görev Yönetimi</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Kullanıcılara iş tipine göre görev atayın ve yönetin.
            </p>
          </div>
        </div>

        {/* Sekmeler */}
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setAktifSekme('tablo')}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors',
              aktifSekme === 'tablo'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <CheckSquare className="h-4 w-4" /> Görev Tablosu
          </button>
          <button
            onClick={() => setAktifSekme('ayarlar')}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors',
              aktifSekme === 'ayarlar'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Settings className="h-4 w-4" /> Görev Tipleri
          </button>
        </div>

        {aktifSekme === 'ayarlar' && <GorevTipiYonetimi />}

        {aktifSekme === 'tablo' && (
          <>
            {/* Arama */}
            <div className="max-w-sm">
              <input
                value={arama}
                onChange={e => setArama(e.target.value)}
                placeholder="Kullanıcı ara..."
                className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Hata */}
            {isError && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-4">
                <p className="text-sm text-amber-700">
                  Görev verileri yüklenemedi. Sunucunun çalıştığından ve yeniden başlatıldığından emin olun.
                </p>
              </div>
            )}

            {/* Tablo */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-left font-semibold">Kullanıcı Adı</th>
                      <th className="px-4 py-3 text-left font-semibold">Pozisyon</th>
                      {isTipleri.map(tip => (
                        <th key={tip} className="px-4 py-3 text-center font-semibold">{tip}</th>
                      ))}
                      <th className="px-4 py-3 text-center font-semibold">Geçici Görev</th>
                      <th className="px-4 py-3 text-center font-semibold">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrelenmisData.length === 0 ? (
                      <tr>
                        <td colSpan={isTipleri.length + 4} className="px-4 py-8 text-center text-muted-foreground">
                          {isError ? 'Veri yüklenemedi.' : 'Kullanıcı bulunamadı.'}
                        </td>
                      </tr>
                    ) : (
                      filtrelenmisData.map(kullanici => {
                        const geciciGorevler = geciciGorevBul(kullanici)
                        return (
                          <tr key={kullanici.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-3 font-medium">{kullanici.ad_soyad}</td>
                            <td className="px-4 py-3 text-muted-foreground">{kullanici.pozisyon_adi || '-'}</td>
                            {isTipleri.map(tip => {
                              const gorev = gorevBul(kullanici, tip)
                              return (
                                <td key={tip} className="px-4 py-3 text-center">
                                  {gorev ? (
                                    <div className="inline-flex items-center gap-1">
                                      <span className={cn(
                                        'rounded-full px-2.5 py-0.5 text-xs font-medium',
                                        gorev.gecici
                                          ? 'bg-amber-50 text-amber-700'
                                          : 'bg-blue-50 text-blue-700'
                                      )}>
                                        {gorev.gorev_tipi}
                                      </span>
                                      <button
                                        onClick={() => handleGorevSil(gorev.id)}
                                        className="rounded p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50"
                                        title="Görevi kaldır"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                              )
                            })}
                            <td className="px-4 py-3 text-center">
                              {geciciGorevler.length > 0 ? (
                                <div className="flex flex-wrap justify-center gap-1">
                                  {geciciGorevler.map(g => (
                                    <span key={g.id} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                      {g.gorev_tipi}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => setSeciliKullanici(kullanici)}
                                className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                              >
                                <UserPlus className="h-3.5 w-3.5" /> Görev Ata
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {filtrelenmisData.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Toplam {filtrelenmisData.length} kullanıcı listeleniyor.
              </p>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {seciliKullanici && (
        <GorevAtaModal
          kullanici={seciliKullanici}
          isTipleri={isTipleri}
          gorevTipleri={gorevTipleri}
          mevcutGorevler={seciliKullanici.gorevler || []}
          onKapat={() => setSeciliKullanici(null)}
          onKaydet={handleGorevAta}
        />
      )}
    </MainLayout>
  )
}
