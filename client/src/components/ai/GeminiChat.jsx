import { useState, useRef, useEffect } from 'react'
import { X, Send, Bot, User, Loader2, Trash2, MessageSquare, ChevronDown } from 'lucide-react'

const ONERI_SORULAR = [
  'Projelerimin genel durumunu özetle',
  'Keşif listesinde dikkat etmem gerekenler neler?',
  'KET ve YB projeleri arasındaki fark nedir?',
  'Malzeme yönetiminde en iyi uygulamalar neler?',
]

export default function GeminiChat({ acik, onKapat }) {
  const [mesajlar, setMesajlar] = useState([])
  const [girdi, setGirdi] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (acik) setTimeout(() => inputRef.current?.focus(), 200)
  }, [acik])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [mesajlar, yukleniyor])

  const gonder = async (text) => {
    const mesaj = (text || girdi).trim()
    if (!mesaj || yukleniyor) return

    const yeniMesajlar = [...mesajlar, { role: 'user', content: mesaj }]
    setMesajlar(yeniMesajlar)
    setGirdi('')
    setYukleniyor(true)

    try {
      const token = localStorage.getItem('token')
      const r = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ mesajlar: yeniMesajlar }),
      })
      const j = await r.json()
      if (j.success) {
        setMesajlar(prev => [...prev, { role: 'assistant', content: j.data.yanit }])
      } else {
        const hataMsg = j.error?.includes('429') || j.error?.includes('quota')
          ? 'API kotası doldu. Lütfen birkaç dakika bekleyip tekrar deneyin.'
          : j.error?.includes('API_KEY')
            ? 'API anahtarı geçersiz veya eksik.'
            : `Bir hata oluştu: ${j.error}`
        setMesajlar(prev => [...prev, { role: 'assistant', content: hataMsg, hata: true }])
      }
    } catch {
      setMesajlar(prev => [...prev, { role: 'assistant', content: 'Sunucuya bağlanılamadı.', hata: true }])
    } finally {
      setYukleniyor(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  if (!acik) return null

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-white/95 backdrop-blur-xl shadow-2xl"
      style={{ width: 420, height: 560 }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5"
        style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%)' }}>
        <div className="flex items-center gap-2.5 text-white">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <span className="font-semibold text-sm block leading-tight">AI Asistan</span>
            <span className="text-[10px] text-white/70">Gemini ile güçlendirildi</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMesajlar([])} className="rounded-lg p-1.5 text-white/60 hover:text-white hover:bg-white/10 transition-colors" title="Sohbeti temizle">
            <Trash2 className="h-4 w-4" />
          </button>
          <button onClick={onKapat} className="rounded-lg p-1.5 text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mesajlar */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db transparent' }}>

        {mesajlar.length === 0 && (
          <div className="flex flex-col items-center pt-6 pb-2">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mb-4">
              <Bot className="h-9 w-9 text-indigo-500" />
            </div>
            <p className="text-sm font-semibold text-gray-800">Merhaba!</p>
            <p className="text-xs text-gray-500 mt-1 text-center max-w-[280px]">
              Projeler, keşifler, malzemeler ve sistem hakkında sorularınızı yanıtlayabilirim.
            </p>
            <div className="mt-5 w-full space-y-2">
              {ONERI_SORULAR.map((s, i) => (
                <button key={i} onClick={() => gonder(s)}
                  className="w-full text-left rounded-xl border border-gray-200 bg-gray-50/80 px-3.5 py-2.5 text-xs text-gray-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {mesajlar.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center shadow-sm ${
              m.role === 'user'
                ? 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white'
                : m.hata ? 'bg-red-100 text-red-500' : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600'
            }`}>
              {m.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
            </div>
            <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
              m.role === 'user'
                ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-tr-md'
                : m.hata
                  ? 'bg-red-50 text-red-700 border border-red-200 rounded-tl-md'
                  : 'bg-gray-100 text-gray-800 rounded-tl-md'
            }`}>
              {m.content.split('\n').map((line, j) => {
                if (line.startsWith('**') && line.endsWith('**')) {
                  return <p key={j} className={`${j > 0 ? 'mt-2' : ''} font-semibold`}>{line.replace(/\*\*/g, '')}</p>
                }
                if (line.startsWith('- ') || line.startsWith('• ')) {
                  return <p key={j} className={`${j > 0 ? 'mt-0.5' : ''} pl-3`}>• {line.replace(/^[-•]\s*/, '')}</p>
                }
                return <p key={j} className={j > 0 ? 'mt-1.5' : ''}>{line || '\u00A0'}</p>
              })}
            </div>
          </div>
        ))}

        {yukleniyor && (
          <div className="flex gap-2.5">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-sm">
              <Bot className="h-3.5 w-3.5 text-gray-600" />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={girdi}
            onChange={e => setGirdi(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && gonder()}
            placeholder="Mesajınızı yazın..."
            disabled={yukleniyor}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm placeholder-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none disabled:opacity-50 transition-all"
          />
          <button onClick={() => gonder()} disabled={yukleniyor || !girdi.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg disabled:opacity-40 transition-all hover:scale-105 active:scale-95">
            {yukleniyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-2">AI yanıtları her zaman doğru olmayabilir</p>
      </div>
    </div>
  )
}
