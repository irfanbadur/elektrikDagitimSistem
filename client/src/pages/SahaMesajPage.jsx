import { useState, useEffect, useRef } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import { MessageSquareText, Send, Loader2, Camera, MapPin, X } from 'lucide-react'

// ─── İŞLEM TİPİ ETİKETLERİ ─────────────────────────────
const ISLEM_TIPLERI = {
  malzeme_talep:    { ikon: 'cube',     renk: '#2563eb', etiket: 'Malzeme Talebi' },
  malzeme_kullanim: { ikon: 'wrench',   renk: '#16a34a', etiket: 'Malzeme Kullanım' },
  gunluk_rapor:     { ikon: 'chart',    renk: '#0891b2', etiket: 'Günlük Rapor' },
  enerji_kesintisi: { ikon: 'bolt',     renk: '#ea580c', etiket: 'Enerji Kesintisi' },
  ariza_bildirim:   { ikon: 'alert',    renk: '#dc2626', etiket: 'Arıza Bildirim' },
  ilerleme_notu:    { ikon: 'note',     renk: '#9333ea', etiket: 'İlerleme Notu' },
  genel_not:        { ikon: 'chat',     renk: '#6b7280', etiket: 'Genel Not' },
}

function getTipBilgisi(tip) {
  return ISLEM_TIPLERI[tip] || ISLEM_TIPLERI.genel_not
}

// ─── TİP İKONU ─────────────────────────────────────────
function TipIkonu({ tip }) {
  const bilgi = getTipBilgisi(tip)
  const ikonMap = {
    cube: '📦', wrench: '🔧', chart: '📊', bolt: '⚡',
    alert: '🚨', note: '📝', chat: '💬'
  }
  return <span>{ikonMap[bilgi.ikon] || '💬'}</span>
}

// ─── PARSE SONUÇ KARTI ─────────────────────────────────
function ParseSonucKarti({ islem }) {
  const tipBilgisi = getTipBilgisi(islem.tip)
  const detay = islem.detay || {}

  return (
    <div
      className="mt-2 rounded-lg border p-2.5 text-[13px]"
      style={{
        background: '#f8fafc',
        borderColor: `${tipBilgisi.renk}30`,
        borderLeftWidth: '4px',
        borderLeftColor: tipBilgisi.renk,
      }}
    >
      {/* Tip etiketi */}
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold mb-1.5"
        style={{ background: `${tipBilgisi.renk}15`, color: tipBilgisi.renk }}
      >
        <TipIkonu tip={islem.tip} /> {tipBilgisi.etiket}
      </span>

      {/* Konum */}
      {islem.konum && (
        <div className="mt-1">📍 <strong>{islem.konum}</strong></div>
      )}

      {/* Malzeme listesi */}
      {detay.malzemeler && detay.malzemeler.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {detay.malzemeler.map((m, i) => (
            <div key={i}>
              • {m.miktar != null && `${m.miktar} ${m.birim || 'adet'} `}
              <strong>{m.ad}</strong>
              {m.kesit_mm2 && ` ${m.kesit_mm2}mm²`}
              {m.boy_m && ` ${m.boy_m}m`}
              {m.tip && ` (${m.tip})`}
            </div>
          ))}
        </div>
      )}

      {/* Günlük rapor */}
      {detay.kisi_sayisi && (
        <div className="mt-1">
          👥 {detay.kisi_sayisi} kişi
          {detay.yapilan_is && ` — ${detay.yapilan_is}`}
        </div>
      )}
      {detay.detay && islem.tip === 'gunluk_rapor' && (
        <div className="mt-0.5 text-gray-600">{detay.detay}</div>
      )}

      {/* Enerji kesintisi */}
      {islem.tip === 'enerji_kesintisi' && (
        <>
          {detay.tarih && <div className="mt-1">📅 {detay.tarih} {detay.baslama_saati || ''}</div>}
          {detay.sebep && <div>Sebep: {detay.sebep}</div>}
          {detay.adres && <div>📍 {detay.adres}</div>}
        </>
      )}

      {/* Arıza bildirim */}
      {islem.tip === 'ariza_bildirim' && (
        <>
          {detay.aciklama && <div className="mt-1">{detay.aciklama}</div>}
          {detay.konum_detay && <div>📍 {detay.konum_detay}</div>}
        </>
      )}

      {/* İlerleme notu */}
      {islem.tip === 'ilerleme_notu' && (
        <>
          {detay.aciklama && <div className="mt-1">{detay.aciklama}</div>}
          {detay.tamamlanan && <div className="text-green-600">✅ {detay.tamamlanan}</div>}
          {detay.siradaki && <div className="text-orange-600">⏭️ {detay.siradaki}</div>}
        </>
      )}

      {/* Genel not */}
      {islem.tip === 'genel_not' && detay.mesaj && (
        <div className="mt-1">{detay.mesaj}</div>
      )}

      {/* Aciliyet */}
      {detay.aciliyet === 'acil' && (
        <div className="mt-1.5 text-xs font-semibold text-red-600">
          🔴 ACİL
        </div>
      )}
    </div>
  )
}

// ─── MESAJ BALONU ────────────────────────────────────────
function MesajBalonu({ mesaj }) {
  const isKullanici = mesaj.tip === 'giden'
  const parseData = mesaj.parseData

  return (
    <div className={`flex mb-3 px-3 ${isKullanici ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%] min-w-[200px]">
        {/* Kullanıcı mesajı */}
        {isKullanici && (
          <div className="bg-blue-600 text-white px-3.5 py-2.5 rounded-2xl rounded-br-sm text-sm leading-relaxed">
            {mesaj.metin}
          </div>
        )}

        {/* Sistem yanıtı (parse sonucu) */}
        {!isKullanici && parseData && (
          <div className="bg-white border border-gray-200 px-3.5 py-2.5 rounded-2xl rounded-bl-sm">
            {parseData.islemler && parseData.islemler.map((islem, i) => (
              <ParseSonucKarti key={i} islem={islem} />
            ))}

            {/* Anlaşılamayan kısım */}
            {parseData.anlasilamayan && (
              <div className="mt-2 px-2.5 py-1.5 bg-amber-50 rounded-md text-xs text-amber-800">
                ⚠️ Anlaşılamayan: {parseData.anlasilamayan}
              </div>
            )}

            {/* Güven skoru */}
            {parseData.guven_skoru != null && (
              <div className="mt-1.5 text-right text-[11px] text-gray-400">
                Güven: %{Math.round(parseData.guven_skoru * 100)}
              </div>
            )}
          </div>
        )}

        {/* Hata durumu */}
        {!isKullanici && mesaj.hata && (
          <div className="bg-red-50 border border-red-200 px-3.5 py-2.5 rounded-2xl rounded-bl-sm text-red-800 text-[13px]">
            ❌ {mesaj.hata}
          </div>
        )}

        {/* Zaman */}
        <div className={`text-[11px] text-gray-400 mt-1 ${isKullanici ? 'text-right' : 'text-left'}`}>
          {mesaj.zaman}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// ANA SAYFA
// ═══════════════════════════════════════════════════════════
export default function SahaMesajPage() {
  const [mesajlar, setMesajlar] = useState([])
  const [girdi, setGirdi] = useState('')
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [seciliFotolar, setSeciliFotolar] = useState([])
  const [konum, setKonum] = useState(null)
  const [konumYukleniyor, setKonumYukleniyor] = useState(false)
  const [konumHata, setKonumHata] = useState(null)
  const [manuelKonum, setManuelKonum] = useState(false)
  const mesajListeRef = useRef(null)
  const inputRef = useRef(null)
  const fotoInputRef = useRef(null)

  // Geçmiş mesajları yükle
  useEffect(() => {
    const yukle = async () => {
      try {
        const res = await fetch('/api/mesaj/gecmis?limit=30')
        const json = await res.json()
        if (json.success && json.data.length > 0) {
          const gecmis = json.data.reverse().flatMap(m => {
            const items = []
            items.push({
              id: `giden-${m.id}`,
              tip: 'giden',
              metin: m.ham_mesaj,
              zaman: new Date(m.olusturma_tarihi).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            })
            items.push({
              id: `gelen-${m.id}`,
              tip: 'gelen',
              parseData: {
                islemler: [{
                  tip: m.islem_tipi,
                  konum: m.konum,
                  proje_no: m.proje_no,
                  detay: m.islem_detay ? JSON.parse(m.islem_detay) : null
                }],
                guven_skoru: m.guven_skoru
              },
              zaman: new Date(m.olusturma_tarihi).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            })
            return items
          })
          setMesajlar(gecmis)
        }
      } catch (err) {
        console.error('Geçmiş yükleme hatası:', err)
      }
    }
    yukle()
  }, [])

  // Yeni mesaj geldiğinde en alta scroll
  useEffect(() => {
    if (mesajListeRef.current) {
      mesajListeRef.current.scrollTop = mesajListeRef.current.scrollHeight
    }
  }, [mesajlar])

  // Fotoğraf seçimi
  const fotoSec = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const yeniFotolar = files.map(f => ({
      file: f,
      onizleme: URL.createObjectURL(f),
      ad: f.name
    }))
    setSeciliFotolar(prev => [...prev, ...yeniFotolar])
    e.target.value = ''
  }

  const fotoSil = (index) => {
    setSeciliFotolar(prev => {
      const yeni = [...prev]
      URL.revokeObjectURL(yeni[index].onizleme)
      yeni.splice(index, 1)
      return yeni
    })
  }

  // Konum al
  const konumAl = () => {
    if (konum) {
      setKonum(null)
      setKonumHata(null)
      setManuelKonum(false)
      return
    }
    if (!navigator.geolocation) {
      setKonumHata('Tarayıcı konum desteklemiyor')
      setManuelKonum(true)
      return
    }
    setKonumYukleniyor(true)
    setKonumHata(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setKonum({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setKonumYukleniyor(false)
        setManuelKonum(false)
      },
      (err) => {
        setKonumYukleniyor(false)
        if (err.code === 1) {
          setKonumHata('Konum izni reddedildi')
        } else if (err.code === 2) {
          setKonumHata('Konum alınamadı')
        } else if (err.code === 3) {
          setKonumHata('Konum zaman aşımı')
        } else {
          setKonumHata('Konum alınamadı (HTTPS gerekli olabilir)')
        }
        setManuelKonum(true)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Manuel konum kaydet
  const manuelKonumKaydet = (latStr, lngStr) => {
    const lat = parseFloat(latStr)
    const lng = parseFloat(lngStr)
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      setKonum({ lat, lng })
      setKonumHata(null)
    }
  }

  // Mesaj gönder
  const mesajGonder = async () => {
    const metin = girdi.trim()
    if (!metin || gonderiliyor) return

    const simdi = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

    const kullaniciMesaj = {
      id: `giden-${Date.now()}`,
      tip: 'giden',
      metin: metin,
      zaman: simdi,
    }

    setMesajlar(prev => [...prev, kullaniciMesaj])
    setGirdi('')
    setGonderiliyor(true)

    try {
      const res = await fetch('/api/mesaj/gonder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesaj: metin,
          kaynak: 'mobil'
        })
      })

      const json = await res.json()

      const sistemYaniti = {
        id: `gelen-${Date.now()}`,
        tip: 'gelen',
        parseData: json.success ? json.data.parse : null,
        hata: json.success ? null : (json.error || 'Parse hatası'),
        zaman: simdi,
      }

      setMesajlar(prev => [...prev, sistemYaniti])
    } catch (error) {
      setMesajlar(prev => [...prev, {
        id: `hata-${Date.now()}`,
        tip: 'gelen',
        hata: 'Sunucuya bağlanılamadı',
        zaman: simdi,
      }])
    } finally {
      setGonderiliyor(false)
      inputRef.current?.focus()
    }
  }

  // Enter ile gönder
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      mesajGonder()
    }
  }

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto">
        {/* ─── BAŞLIK ──────────────────────────────── */}
        <div className="mb-4">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-blue-600" />
            Saha Mesaj
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Doğal dille mesaj gönderin, AI otomatik sınıflandırsın
          </p>
        </div>

        {/* ─── MESAJ GİRİŞ ALANI ──────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={girdi}
              onChange={(e) => setGirdi(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Mesajınızı yazın... (ör: 2 tane 12I direk lazım)"
              rows={2}
              className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-xl text-[15px] resize-none outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition-colors"
              style={{ maxHeight: '120px', lineHeight: 1.4, fontFamily: 'inherit' }}
              onInput={(e) => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
            />
            <button
              onClick={mesajGonder}
              disabled={!girdi.trim() || gonderiliyor}
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors disabled:bg-gray-300 disabled:cursor-default bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
            >
              {gonderiliyor
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <Send className="h-5 w-5" />
              }
            </button>
          </div>

          {/* ─── Fotoğraf & Konum Butonları ──────── */}
          <div className="flex items-center gap-2 mt-2">
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={fotoSec}
            />
            <button
              type="button"
              onClick={() => fotoInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors"
            >
              <Camera className="h-4 w-4" />
              Fotoğraf
            </button>
            <button
              type="button"
              onClick={konumAl}
              disabled={konumYukleniyor}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                konum
                  ? 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100'
                  : 'text-gray-600 hover:bg-gray-100 border-gray-200'
              }`}
            >
              {konumYukleniyor
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <MapPin className="h-4 w-4" />
              }
              {konum ? 'Konum Eklendi' : 'Konum Ekle'}
            </button>
            {konum && (
              <span className="text-[11px] text-gray-400">
                {konum.lat.toFixed(5)}, {konum.lng.toFixed(5)}
              </span>
            )}
          </div>

          {/* Konum hata / manuel giriş */}
          {konumHata && !konum && (
            <div className="mt-2 text-[13px]">
              <div className="text-red-500 mb-1">{konumHata}</div>
              {manuelKonum && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Enlem (ör: 41.52)"
                    className="w-28 px-2 py-1 border border-gray-300 rounded text-[13px] outline-none focus:border-blue-400"
                    id="manuel-lat"
                  />
                  <input
                    type="text"
                    placeholder="Boylam (ör: 35.98)"
                    className="w-28 px-2 py-1 border border-gray-300 rounded text-[13px] outline-none focus:border-blue-400"
                    id="manuel-lng"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const lat = document.getElementById('manuel-lat').value
                      const lng = document.getElementById('manuel-lng').value
                      manuelKonumKaydet(lat, lng)
                    }}
                    className="px-2 py-1 bg-blue-600 text-white rounded text-[13px] hover:bg-blue-700"
                  >
                    Kaydet
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ─── Seçilen Fotoğraf Önizlemeleri ──────── */}
          {seciliFotolar.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {seciliFotolar.map((foto, i) => (
                <div key={i} className="relative group">
                  <img
                    src={foto.onizleme}
                    alt={foto.ad}
                    className="h-16 w-16 object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    onClick={() => fotoSil(i)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Örnek mesajlar (sadece boş durumdayken) */}
          {mesajlar.length === 0 && (
            <div className="mt-3 text-[13px] text-gray-500 leading-relaxed">
              <strong className="text-gray-600">Örnek mesajlar:</strong>
              <div className="mt-1 space-y-0.5">
                <div>📦 "2 tane 12I direk ve 70lik alpek lazım"</div>
                <div>📊 "Bugün 4 kişi 350m kablo çektik"</div>
                <div>⚡ "Salı günü acil enerji kesintisi lazım"</div>
                <div>📝 "3 nolu direğe konsol taktık"</div>
                <div>🚨 "Bafra hattında izolatör kırıldı"</div>
              </div>
            </div>
          )}
        </div>

        {/* Yazıyor göstergesi */}
        {gonderiliyor && (
          <div className="px-4 py-2 text-gray-400 text-[13px] flex items-center gap-2 mb-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analiz ediliyor...
          </div>
        )}

        {/* ─── MESAJ GEÇMİŞİ ───────────────────────── */}
        <div ref={mesajListeRef} className="space-y-3">
          {mesajlar.map(mesaj => (
            <MesajBalonu key={mesaj.id} mesaj={mesaj} />
          ))}
        </div>
      </div>
    </MainLayout>
  )
}
