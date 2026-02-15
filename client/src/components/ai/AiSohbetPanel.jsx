import { useState, useRef, useEffect } from 'react'
import api from '@/api/client'
import AiOnayPaneli from './AiOnayPaneli'

/**
 * Floating AI Sohbet Paneli — tüm sayfalarda görünür
 */
export default function AiSohbetPanel({ baglam = {} }) {
  const [acik, setAcik] = useState(false)
  const [mesajlar, setMesajlar] = useState([])
  const [girdi, setGirdi] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [sohbetId, setSohbetId] = useState(null)
  const [aksiyonPlan, setAksiyonPlan] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [mesajlar])

  const mesajGonder = async () => {
    if (!girdi.trim() || yukleniyor) return
    const metin = girdi.trim()
    setGirdi('')

    setMesajlar(prev => [...prev, { rol: 'kullanici', icerik: metin }])
    setYukleniyor(true)

    try {
      const res = await api.post('/ai-sohbet/mesaj', {
        sohbet_id: sohbetId, mesaj: metin, baglam,
      })
      const d = res.data
      setSohbetId(d.sohbetId)

      setMesajlar(prev => [...prev, {
        rol: 'asistan', icerik: d.yanit, tip: d.tip, meta: d.meta,
      }])

      if (d.aksiyonPlan) setAksiyonPlan(d.aksiyonPlan)
    } catch (err) {
      setMesajlar(prev => [...prev, {
        rol: 'asistan', icerik: `Hata: ${err.message}`, tip: 'hata',
      }])
    } finally {
      setYukleniyor(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mesajGonder() }
  }

  // Kapalı — Floating buton
  if (!acik) {
    return (
      <button
        onClick={() => setAcik(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white text-2xl shadow-lg hover:bg-blue-700 transition-colors cursor-pointer"
        title="AI Asistan"
      >
        <span>🤖</span>
      </button>
    )
  }

  // Açık — Sohbet paneli
  return (
    <div className="fixed bottom-6 right-6 z-50 flex w-[420px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ height: '600px', maxHeight: '80vh' }}>
      {/* Başlık */}
      <div className="flex items-center justify-between bg-blue-600 px-4 py-3.5 text-white">
        <div>
          <div className="text-[15px] font-semibold">🤖 AI Asistan</div>
          <div className="text-[11px] opacity-80">
            {baglam.projeNo ? `📍 ${baglam.projeNo} — ${baglam.projeAdi || ''}` : 'Genel'}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setMesajlar([]); setSohbetId(null); setAksiyonPlan(null) }}
            className="rounded-md bg-white/20 px-2 py-1 text-xs hover:bg-white/30 transition-colors cursor-pointer"
          >
            ➕ Yeni
          </button>
          <button
            onClick={() => setAcik(false)}
            className="text-lg hover:opacity-80 cursor-pointer bg-transparent border-none text-white"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Mesajlar */}
      <div ref={scrollRef} className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4">
        {mesajlar.length === 0 && (
          <div className="mt-10 text-center text-sm text-gray-400">
            <div className="mb-2 text-3xl">🤖</div>
            Merhaba! Soru sorabilir veya komut verebilirsin.
            <div className="mt-3 text-xs text-gray-300">
              Örnekler:<br />
              &quot;Depoda kaç direk var?&quot;<br />
              &quot;Koşu köy projesi ne durumda?&quot;<br />
              &quot;Ekip-2&apos;ye 5 adet N-12 direk gönder&quot;
            </div>
          </div>
        )}

        {mesajlar.map((m, i) => (
          <div key={i} className={`flex ${m.rol === 'kullanici' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                m.rol === 'kullanici'
                  ? 'rounded-br-sm bg-blue-600 text-white'
                  : m.tip === 'hata'
                    ? 'bg-red-50 text-red-600'
                    : 'rounded-bl-sm bg-gray-100 text-gray-800'
              }`}
            >
              {m.icerik}
              {m.tip === 'sorgu' && m.meta?.sql && (
                <details className="mt-2 text-[11px] opacity-70">
                  <summary className="cursor-pointer">SQL göster</summary>
                  <pre className="mt-1 whitespace-pre-wrap font-mono">{m.meta.sql}</pre>
                  <span>{m.meta.satirSayisi} satır sonuç</span>
                </details>
              )}
            </div>
          </div>
        ))}

        {yukleniyor && (
          <div className="flex gap-1 px-2 py-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-gray-300" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-gray-300" style={{ animationDelay: '0.2s' }} />
            <span className="h-2 w-2 animate-pulse rounded-full bg-gray-300" style={{ animationDelay: '0.4s' }} />
          </div>
        )}

        {aksiyonPlan && (
          <AiOnayPaneli
            islemId={aksiyonPlan.islemId}
            anlama={aksiyonPlan.anlama}
            aksiyonlar={aksiyonPlan.aksiyonlar}
            uyarilar={aksiyonPlan.uyarilar}
            sorular={aksiyonPlan.sorular}
            onOnayla={() => {
              setAksiyonPlan(null)
              setMesajlar(prev => [...prev, { rol: 'asistan', icerik: 'İşlem tamamlandı.', tip: 'sohbet' }])
            }}
            onReddet={() => {
              setAksiyonPlan(null)
              setMesajlar(prev => [...prev, { rol: 'asistan', icerik: 'İşlem iptal edildi.', tip: 'sohbet' }])
            }}
            onKapat={() => setAksiyonPlan(null)}
          />
        )}
      </div>

      {/* Girdi alanı */}
      <div className="flex items-end gap-2 border-t border-gray-200 px-4 py-3">
        <textarea
          value={girdi}
          onChange={(e) => setGirdi(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Soru sor veya komut ver..."
          rows={1}
          className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-[13px] outline-none focus:border-blue-400"
          style={{ maxHeight: '80px', fontFamily: 'inherit' }}
          onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px' }}
        />
        <button
          onClick={mesajGonder}
          disabled={!girdi.trim() || yukleniyor}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white text-base ${
            girdi.trim() ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer' : 'bg-gray-200 cursor-default'
          }`}
        >
          ➤
        </button>
      </div>
    </div>
  )
}
