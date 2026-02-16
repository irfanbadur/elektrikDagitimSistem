import { useState } from 'react'
import api from '@/api/client'

const RISK_RENK = {
  dusuk: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800', badge: 'bg-green-200 text-green-800' },
  orta: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800', badge: 'bg-amber-200 text-amber-800' },
  yuksek: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800', badge: 'bg-red-200 text-red-800' },
}

export default function AiOnayPaneli({ islemId, anlama, aksiyonlar, uyarilar = [], sorular = [], onOnayla, onReddet, onKapat }) {
  const [yukleniyor, setYukleniyor] = useState(false)
  const [sonuc, setSonuc] = useState(null)
  const [duzenleme, setDuzenleme] = useState({})

  const handleOnayla = async () => {
    setYukleniyor(true)
    try {
      const duzeltmeler = Object.keys(duzenleme).length > 0
        ? Object.entries(duzenleme).map(([idx, params]) => ({ index: parseInt(idx), params }))
        : null
      const res = await api.put(`/ai-op/islem/${islemId}/onayla`, { duzeltmeler })
      if (res.success) {
        setSonuc(res.data)
        onOnayla?.(res.data)
      }
    } catch (err) {
      console.error('Onay hatasi:', err)
    } finally {
      setYukleniyor(false)
    }
  }

  const handleReddet = async () => {
    try {
      await api.put(`/ai-op/islem/${islemId}/reddet`, {})
      onReddet?.()
    } catch (err) {
      console.error('Red hatasi:', err)
    }
  }

  // Sonuc gosterimi
  if (sonuc) {
    return (
      <div className="bg-green-50 border border-green-300 rounded-xl p-4">
        <div className="text-base font-semibold text-green-800 mb-3">Islem Tamamlandi</div>
        {sonuc.sonuclar?.map((s, i) => (
          <div key={i} className={`p-2 px-3 mb-1 rounded-lg text-sm ${s.basarili ? 'bg-green-100' : 'bg-red-50'}`}>
            {s.basarili ? '\u2705' : '\u274C'} {s.mesaj}
          </div>
        ))}
        <button onClick={onKapat}
          className="mt-3 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          Tamam
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white overflow-hidden">
      {/* Baslik */}
      <div className="p-3.5 px-4 bg-sky-50 border-b border-sky-200 flex items-center gap-2.5">
        <span className="text-xl">🤖</span>
        <div>
          <div className="text-sm font-semibold text-sky-700">AI — {aksiyonlar.length} aksiyon belirlendi</div>
          <div className="text-xs text-gray-500">
            {anlama?.ozet}
            {anlama?.guven != null && (
              <span className="ml-2 text-gray-400">(guven: %{Math.round(anlama.guven * 100)})</span>
            )}
          </div>
        </div>
      </div>

      {/* Uyarilar */}
      {uyarilar.length > 0 && (
        <div className="p-2 px-4 bg-amber-50 border-b border-amber-300">
          {uyarilar.map((u, i) => (
            <div key={i} className="text-xs text-amber-800">{u}</div>
          ))}
        </div>
      )}

      {/* Sorular */}
      {sorular.length > 0 && (
        <div className="p-3 px-4 bg-amber-100 border-b border-amber-300">
          <div className="text-sm font-semibold text-amber-800 mb-1">Dogrulama Gerekiyor:</div>
          {sorular.map((s, i) => (
            <div key={i} className="text-sm text-amber-900">{'\u2022'} {s}</div>
          ))}
        </div>
      )}

      {/* Aksiyonlar */}
      <div className="p-3 px-4">
        {aksiyonlar.map((aksiyon, index) => {
          const stil = RISK_RENK[aksiyon.riskSeviyesi] || RISK_RENK.dusuk
          return (
            <div key={index}
              className={`border ${aksiyon.gecerli ? stil.border : 'border-red-300'} rounded-xl p-3 mb-2 ${aksiyon.gecerli ? stil.bg : 'bg-red-50'}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{aksiyon.ikon || '\u26A1'}</span>
                  <div>
                    <span className={`text-sm font-semibold ${stil.text}`}>{aksiyon.etiket || aksiyon.tip}</span>
                    <div className="text-xs text-gray-500">{aksiyon.ozet}</div>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${stil.badge}`}>
                  {aksiyon.riskSeviyesi}
                </span>
              </div>
              {/* Duzenlenebilir parametreler */}
              <div className="mt-2 text-xs text-gray-700">
                {Object.entries(aksiyon.params || {}).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-1.5 py-0.5 border-b border-gray-100">
                    <span className="text-gray-400 w-28 shrink-0">{key.replace(/_/g, ' ')}:</span>
                    <input
                      value={duzenleme[index]?.[key] ?? (typeof val === 'object' ? JSON.stringify(val) : val)}
                      onChange={(e) => setDuzenleme({
                        ...duzenleme,
                        [index]: { ...(duzenleme[index] || {}), [key]: e.target.value }
                      })}
                      className="flex-1 px-2 py-0.5 border border-gray-200 rounded text-xs" />
                  </div>
                ))}
              </div>
              {!aksiyon.gecerli && aksiyon.hatalar?.map((h, i) => (
                <div key={i} className="text-xs text-red-600 mt-1">{'\u274C'} {h}</div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Butonlar */}
      <div className="p-3 px-4 border-t border-gray-200 flex gap-2 justify-end">
        <button onClick={handleReddet} disabled={yukleniyor}
          className="px-5 py-2 text-sm bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
          Iptal
        </button>
        <button onClick={handleOnayla} disabled={yukleniyor || aksiyonlar.every(a => !a.gecerli)}
          className="px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {yukleniyor ? 'Uygulaniyor...' : 'Onayla ve Uygula'}
        </button>
      </div>
    </div>
  )
}
