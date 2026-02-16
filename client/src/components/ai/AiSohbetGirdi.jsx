import { useState, useRef } from 'react'

/**
 * AI Sohbet Girdi Alanı — metin + dosya + konum
 *
 * Props:
 *   onGonder({ metin, dosyalar, konum })
 *   yukleniyor: boolean
 */
export default function AiSohbetGirdi({ onGonder, yukleniyor }) {
  const [metin, setMetin] = useState('')
  const [dosyalar, setDosyalar] = useState([])
  const [konum, setKonum] = useState(null)
  const [konumYukleniyor, setKonumYukleniyor] = useState(false)
  const dosyaRef = useRef(null)
  const kameraRef = useRef(null)

  const dosyaEkle = (e) => {
    const yeniDosyalar = Array.from(e.target.files).map(file => ({
      file,
      onizleme: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }))
    setDosyalar(prev => [...prev, ...yeniDosyalar])
    e.target.value = ''
  }

  const dosyaSil = (index) => {
    setDosyalar(prev => {
      const yeni = [...prev]
      if (yeni[index].onizleme) URL.revokeObjectURL(yeni[index].onizleme)
      yeni.splice(index, 1)
      return yeni
    })
  }

  const konumPaylas = () => {
    if (!navigator.geolocation) {
      alert('Tarayıcınız konum paylaşmayı desteklemiyor')
      return
    }
    setKonumYukleniyor(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setKonum({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          dogruluk: Math.round(pos.coords.accuracy),
        })
        setKonumYukleniyor(false)
      },
      (err) => {
        alert('Konum alınamadı: ' + err.message)
        setKonumYukleniyor(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const gonder = () => {
    if ((!metin.trim() && dosyalar.length === 0) || yukleniyor) return

    onGonder({
      metin: metin.trim(),
      dosyalar: dosyalar.map(d => d.file),
      konum,
    })

    setMetin('')
    dosyalar.forEach(d => { if (d.onizleme) URL.revokeObjectURL(d.onizleme) })
    setDosyalar([])
    setKonum(null)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); gonder() }
  }

  return (
    <div className="border-t-2 border-gray-300 bg-gray-50/50">
      {/* Dosya önizlemeleri + konum badge */}
      {(dosyalar.length > 0 || konum) && (
        <div className="flex flex-wrap gap-2 bg-gray-50 px-3 py-2">
          {dosyalar.map((d, i) => (
            <div key={i} className="relative">
              {d.onizleme ? (
                <img src={d.onizleme} alt="" className="h-[60px] w-[60px] rounded-lg border border-gray-200 object-cover" />
              ) : (
                <div className="flex h-[60px] w-[60px] items-center justify-center rounded-lg bg-gray-200 text-[10px] text-gray-500">
                  {d.file.name.split('.').pop()}
                </div>
              )}
              <button
                onClick={() => dosyaSil(i)}
                className="absolute -right-1 -top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-red-500 text-[10px] text-white border-none cursor-pointer"
              >
                x
              </button>
            </div>
          ))}
          {konum && (
            <div className="flex items-center gap-1 rounded-lg bg-blue-100 px-2.5 py-1 text-[11px] text-blue-700">
              <span>{konum.lat.toFixed(5)}, {konum.lon.toFixed(5)}</span>
              <span className="opacity-60">(+/-{konum.dogruluk}m)</span>
              <button onClick={() => setKonum(null)} className="ml-1 bg-transparent border-none text-blue-700 cursor-pointer text-xs">x</button>
            </div>
          )}
        </div>
      )}

      {/* Girdi alanı */}
      {/* Buton satırı */}
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1">
        <input type="file" ref={dosyaRef} onChange={dosyaEkle} multiple accept="image/*,.pdf" className="hidden" />
        <button
          onClick={() => dosyaRef.current?.click()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm border-none cursor-pointer hover:bg-gray-200"
          title="Dosya/fotoğraf ekle"
        >
          📎
        </button>

        <input type="file" ref={kameraRef} onChange={dosyaEkle} capture="environment" accept="image/*" className="hidden" />
        <button
          onClick={() => kameraRef.current?.click()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm border-none cursor-pointer hover:bg-gray-200"
          title="Fotoğraf çek"
        >
          📷
        </button>

        <button
          onClick={konumPaylas}
          disabled={konumYukleniyor || !!konum}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm border-none cursor-pointer ${
            konum ? 'bg-blue-100' : 'bg-gray-100 hover:bg-gray-200'
          }`}
          title={konum ? 'Konum eklendi' : 'Konum paylaş'}
        >
          {konumYukleniyor ? '⏳' : '📍'}
        </button>
      </div>

      {/* Textarea + gönder */}
      <div className="flex items-end gap-2 px-3 pb-3">
        <textarea
          value={metin}
          onChange={(e) => setMetin(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Mesaj, not veya komut yaz..."
          rows={3}
          className="flex-1 resize-none rounded-xl border-2 border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors"
          style={{ minHeight: '80px', maxHeight: '140px', fontFamily: 'inherit' }}
          onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px' }}
        />

        <button
          onClick={gonder}
          disabled={(!metin.trim() && dosyalar.length === 0) || yukleniyor}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white text-base mb-1 ${
            (metin.trim() || dosyalar.length > 0) ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer' : 'bg-gray-300 cursor-default'
          }`}
        >
          ➤
        </button>
      </div>
    </div>
  )
}
