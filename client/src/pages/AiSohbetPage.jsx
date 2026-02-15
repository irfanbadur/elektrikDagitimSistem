import { useState, useEffect, useRef } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import AiOnayPaneli from '@/components/ai/AiOnayPaneli'
import api from '@/api/client'

export default function AiSohbetPage() {
  const [sohbetler, setSohbetler] = useState([])
  const [seciliSohbetId, setSeciliSohbetId] = useState(null)
  const [mesajlar, setMesajlar] = useState([])
  const [girdi, setGirdi] = useState('')
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

  const mesajGonder = async () => {
    if (!girdi.trim() || yukleniyor) return
    const metin = girdi.trim()
    setGirdi('')
    setMesajlar(prev => [...prev, { rol: 'kullanici', icerik: metin }])
    setYukleniyor(true)

    try {
      const res = await api.post('/ai-sohbet/mesaj', {
        sohbet_id: seciliSohbetId, mesaj: metin, baglam: { tip: 'genel' },
      })
      const d = res.data
      setSeciliSohbetId(d.sohbetId)
      setMesajlar(prev => [...prev, { rol: 'asistan', icerik: d.yanit, tip: d.tip, meta: d.meta }])
      if (d.aksiyonPlan) setAksiyonPlan(d.aksiyonPlan)
      yukleSohbetler()
    } catch (err) {
      setMesajlar(prev => [...prev, {
        rol: 'asistan', icerik: `Hata: ${err.message}`, tip: 'hata',
      }])
    } finally { setYukleniyor(false) }
  }

  return (
    <MainLayout title="AI Sohbet" noPadding>
      <div className="flex flex-1 min-h-0">
        {/* Sol — Sohbet listesi */}
        <div className="w-72 shrink-0 overflow-y-auto border-r border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3.5">
            <h3 className="text-base font-semibold">🤖 Sohbetler</h3>
            <button
              onClick={yeniSohbet}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 cursor-pointer"
            >
              ➕ Yeni
            </button>
          </div>
          {sohbetler.map(s => (
            <div
              key={s.id}
              onClick={() => sohbetSec(s.id)}
              className={`flex cursor-pointer items-center justify-between border-b border-gray-100 px-4 py-3 hover:bg-gray-100 ${
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
        <div className="flex flex-1 flex-col min-w-0">
          <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
            {mesajlar.length === 0 && (
              <div className="mt-20 text-center text-sm text-gray-400">
                <div className="mb-3 text-5xl">🤖</div>
                Soru sor, komut ver veya bilgi iste.
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
                  {m.icerik}
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

            {aksiyonPlan && (
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
            )}
          </div>

          {/* Girdi */}
          <div className="flex gap-2.5 border-t border-gray-200 px-5 py-4">
            <textarea
              value={girdi}
              onChange={(e) => setGirdi(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mesajGonder() } }}
              placeholder="Soru sor veya komut ver..."
              rows={1}
              className="flex-1 resize-none rounded-lg border border-gray-200 px-3.5 py-3 text-sm outline-none focus:border-blue-400"
              style={{ fontFamily: 'inherit' }}
            />
            <button
              onClick={mesajGonder}
              disabled={!girdi.trim() || yukleniyor}
              className={`rounded-lg px-5 py-3 text-[15px] text-white ${
                girdi.trim() ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer' : 'bg-gray-200 cursor-default'
              }`}
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
