import { useState, useEffect, useRef } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import AiOnayPaneli from '@/components/ai/AiOnayPaneli'
import AiSohbetGirdi from '@/components/ai/AiSohbetGirdi'
import api from '@/api/client'

export default function AiSohbetPage() {
  const [sohbetler, setSohbetler] = useState([])
  const [seciliSohbetId, setSeciliSohbetId] = useState(null)
  const [mesajlar, setMesajlar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [aksiyonPlan, setAksiyonPlan] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => { yukleSohbetler() }, [])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [mesajlar])

  const yukleSohbetler = async () => {
    try {
      const res = await api.get('/ai-sohbet/liste')
      if (res.success) setSohbetler(res.data)
    } catch { /* ignore */ }
  }

  const sohbetSec = async (id) => {
    setSeciliSohbetId(id)
    try {
      const res = await api.get(`/ai-sohbet/${id}`)
      if (res.success) setMesajlar(res.data.mesajlar)
    } catch { /* ignore */ }
  }

  const yeniSohbet = () => {
    setSeciliSohbetId(null)
    setMesajlar([])
    setAksiyonPlan(null)
  }

  const sohbetSil = async (id) => {
    try {
      await api.delete(`/ai-sohbet/${id}`)
      setSohbetler(prev => prev.filter(s => s.id !== id))
      if (seciliSohbetId === id) yeniSohbet()
    } catch { /* ignore */ }
  }

  const mesajGonder = async ({ metin, dosyalar = [], konum }) => {
    if ((!metin && dosyalar.length === 0) || yukleniyor) return
    setYukleniyor(true)

    // Kullanıcı mesajını hemen göster
    setMesajlar(prev => [...prev, {
      rol: 'kullanici', icerik: metin || '(medya gönderildi)',
      dosyalar: dosyalar.map(f => ({
        onizleme: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
        adi: f.name,
      })),
      konum,
    }])

    try {
      const formData = new FormData()
      if (seciliSohbetId) formData.append('sohbet_id', seciliSohbetId)
      formData.append('mesaj', metin || '')
      formData.append('baglam', JSON.stringify({ tip: 'genel' }))
      if (konum) formData.append('konum', JSON.stringify(konum))
      for (const dosya of dosyalar) {
        formData.append('dosyalar', dosya)
      }

      const res = await api.post('/ai-sohbet/mesaj', formData, {
        headers: { 'Content-Type': undefined },
      })
      const d = res.data || res
      setSeciliSohbetId(d.sohbetId)
      setMesajlar(prev => [...prev, {
        rol: 'asistan', icerik: d.yanit, tip: d.tip, meta: d.meta,
      }])
      if (d.aksiyonPlan) setAksiyonPlan(d.aksiyonPlan)
      yukleSohbetler()
    } catch (err) {
      setMesajlar(prev => [...prev, {
        rol: 'asistan', icerik: `Hata: ${err.response?.data?.error || err.message}`, tip: 'hata',
      }])
    } finally { setYukleniyor(false) }
  }

  return (
    <MainLayout title="AI Sohbet" noPadding>
      <div className="flex flex-1 min-h-0">
        {/* Sol — Sohbet listesi */}
        <div className="w-72 shrink-0 overflow-y-auto border-r-2 border-gray-300 bg-gray-50">
          <div className="flex items-center justify-between border-b-2 border-gray-300 px-4 py-3.5">
            <h3 className="text-base font-semibold">🤖 Sohbetler</h3>
            <button
              onClick={yeniSohbet}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 cursor-pointer"
            >
              + Yeni
            </button>
          </div>
          {sohbetler.map(s => (
            <div
              key={s.id}
              onClick={() => sohbetSec(s.id)}
              className={`flex cursor-pointer items-center justify-between border-b border-gray-200 px-4 py-3 hover:bg-gray-100 ${
                seciliSohbetId === s.id ? 'bg-blue-50' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{s.baslik || 'Yeni Sohbet'}</div>
                <div className="text-[11px] text-gray-400">
                  {new Date(s.son_mesaj_tarihi).toLocaleDateString('tr-TR')} · {s.mesaj_sayisi} mesaj
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); sohbetSil(s.id) }}
                className="ml-2 shrink-0 text-sm text-gray-300 hover:text-red-400 cursor-pointer bg-transparent border-none"
              >
                🗑
              </button>
            </div>
          ))}
          {sohbetler.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-gray-400">Henüz sohbet yok</div>
          )}
        </div>

        {/* Sağ — Aktif sohbet */}
        <div className="flex flex-1 flex-col min-w-0 min-h-0">
          {/* Mesajlar — scroll alanı */}
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-5 pt-5 pb-2 flex flex-col gap-3">
            {mesajlar.length === 0 && (
              <div className="mt-20 text-center text-sm text-gray-400">
                <div className="mb-3 text-5xl">🤖</div>
                Soru sor, fotoğraf gönder, konum paylaş veya komut ver.
              </div>
            )}
            {mesajlar.map((m, i) => (
              <div key={i} className={`flex ${m.rol === 'kullanici' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[70%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    m.rol === 'kullanici'
                      ? 'rounded-br-sm bg-blue-600 text-white'
                      : m.tip === 'hata'
                        ? 'bg-red-50 text-red-600'
                        : 'rounded-bl-sm bg-gray-100 text-gray-800'
                  }`}
                >
                  {/* Fotoğraf önizlemeleri */}
                  {m.dosyalar?.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {m.dosyalar.map((d, j) => d.onizleme ? (
                        <img key={j} src={d.onizleme} alt="" className="h-[80px] w-[100px] rounded-md object-cover" />
                      ) : (
                        <span key={j} className="rounded bg-white/20 px-2 py-1 text-[11px]">{d.adi}</span>
                      ))}
                    </div>
                  )}
                  {/* Konum */}
                  {m.konum && (
                    <div className="mb-1 text-[11px] opacity-70">
                      📍 {m.konum.lat.toFixed(5)}, {m.konum.lon.toFixed(5)}
                    </div>
                  )}
                  {m.icerik}
                  {/* Direk tahmin bilgisi */}
                  {m.meta?.direkTahmin && (
                    <div className="mt-1.5 rounded bg-blue-50 px-2 py-1 text-[11px] text-blue-700">
                      📍 En yakın direk: {m.meta.direkTahmin.direk.direk_no} ({m.meta.direkTahmin.mesafe}m, güven: %{Math.round(m.meta.direkTahmin.tahminGuven * 100)})
                    </div>
                  )}
                  {m.tip === 'sorgu' && m.meta?.sql && (
                    <details className="mt-2 text-xs opacity-70">
                      <summary className="cursor-pointer">SQL göster</summary>
                      <pre className="mt-1 whitespace-pre-wrap font-mono">{m.meta.sql}</pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
            {yukleniyor && (
              <div className="text-sm text-gray-400">⏳ Düşünüyor...</div>
            )}
          </div>

          {/* Aksiyon onay paneli — scroll dışında, sabit */}
          {aksiyonPlan && (
            <div className="shrink-0 max-h-[40%] overflow-y-auto border-t-2 border-gray-300">
              <AiOnayPaneli
                islemId={aksiyonPlan.islemId}
                anlama={aksiyonPlan.anlama}
                aksiyonlar={aksiyonPlan.aksiyonlar}
                uyarilar={aksiyonPlan.uyarilar}
                sorular={aksiyonPlan.sorular}
                onOnayla={() => { setAksiyonPlan(null); setMesajlar(prev => [...prev, { rol: 'asistan', icerik: 'Tamamlandı.' }]) }}
                onReddet={() => { setAksiyonPlan(null); setMesajlar(prev => [...prev, { rol: 'asistan', icerik: 'İptal edildi.' }]) }}
                onKapat={() => setAksiyonPlan(null)}
              />
            </div>
          )}

          {/* Girdi — medya destekli */}
          <div className="shrink-0">
            <AiSohbetGirdi onGonder={mesajGonder} yukleniyor={yukleniyor} />
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
