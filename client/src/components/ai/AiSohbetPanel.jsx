import { useState, useRef, useEffect } from 'react'
import api from '@/api/client'
import AiOnayPaneli from './AiOnayPaneli'
import AiSohbetGirdi from './AiSohbetGirdi'

/**
 * Floating AI Sohbet Paneli — tüm sayfalarda görünür
 */
export default function AiSohbetPanel({ baglam = {} }) {
  const [acik, setAcik] = useState(false)
  const [mesajlar, setMesajlar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [sohbetId, setSohbetId] = useState(null)
  const [aksiyonPlan, setAksiyonPlan] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [mesajlar])

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
      // FormData ile gönder (dosyalar için multipart)
      const formData = new FormData()
      if (sohbetId) formData.append('sohbet_id', sohbetId)
      formData.append('mesaj', metin || '')
      formData.append('baglam', JSON.stringify(baglam))
      if (konum) formData.append('konum', JSON.stringify(konum))
      for (const dosya of dosyalar) {
        formData.append('dosyalar', dosya)
      }

      const res = await api.post('/ai-sohbet/mesaj', formData, {
        headers: { 'Content-Type': undefined },
      })
      const d = res.data || res
      setSohbetId(d.sohbetId)

      setMesajlar(prev => [...prev, {
        rol: 'asistan', icerik: d.yanit, tip: d.tip, meta: d.meta,
      }])

      if (d.aksiyonPlan) setAksiyonPlan(d.aksiyonPlan)
    } catch (err) {
      setMesajlar(prev => [...prev, {
        rol: 'asistan', icerik: `Hata: ${err.response?.data?.error || err.message}`, tip: 'hata',
      }])
    } finally {
      setYukleniyor(false)
    }
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
      <div className="flex items-center justify-between bg-blue-600 px-4 py-3 text-white shrink-0">
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
            + Yeni
          </button>
          <button
            onClick={() => setAcik(false)}
            className="text-lg hover:opacity-80 cursor-pointer bg-transparent border-none text-white"
          >
            x
          </button>
        </div>
      </div>

      {/* Mesajlar — flex-1 + overflow-y-auto = sabit kutu içinde scroll */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
        {mesajlar.length === 0 && (
          <div className="mt-10 text-center text-sm text-gray-400">
            <div className="mb-2 text-3xl">🤖</div>
            Merhaba! Soru sorabilir, fotoğraf gönderebilir veya komut verebilirsin.
            <div className="mt-3 text-xs text-gray-300">
              Örnekler:<br />
              &quot;Depoda kaç direk var?&quot;<br />
              &quot;Bu direkte 4 izolatör var&quot; + fotoğraf<br />
              &quot;Topraklama 3.5 ohm&quot; + konum
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
              {/* Fotoğraf önizlemeleri */}
              {m.dosyalar?.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1">
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

      </div>

      {/* Aksiyon onay paneli — sabit, scroll edilebilir */}
      {aksiyonPlan && (
        <div className="shrink-0 max-h-[45%] overflow-y-auto border-t border-gray-200">
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
        </div>
      )}

      {/* Girdi alanı — medya destekli */}
      <div className="shrink-0">
        <AiSohbetGirdi onGonder={mesajGonder} yukleniyor={yukleniyor} />
      </div>

      {/* Alt boşluk */}
      <div className="shrink-0 h-2 bg-white rounded-b-2xl" />
    </div>
  )
}
