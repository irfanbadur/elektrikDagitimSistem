import { useState, useRef } from 'react'
import api from '@/api/client'

const ALT_ALAN_SECENEKLERI = {
  proje: [
    { value: '', label: 'Otomatik (uzantidan)' },
    { value: 'fotograf', label: 'Fotograf' },
    { value: 'cizim', label: 'Cizim (CAD)' },
    { value: 'belge', label: 'Belge (PDF/DOC)' },
    { value: 'tablo', label: 'Tablo (Excel/CSV)' },
    { value: 'harita', label: 'Harita (KML/GeoJSON)' },
  ],
  personel: [
    { value: 'kimlik', label: 'Kimlik' },
    { value: 'saglik', label: 'Saglik' },
    { value: 'sertifika', label: 'Sertifika' },
    { value: 'sgk', label: 'SGK' },
    { value: 'isg_egitim', label: 'ISG Egitim' },
    { value: 'sozlesme', label: 'Sozlesme' },
  ],
  ekipman: [
    { value: 'ruhsat', label: 'Ruhsat' },
    { value: 'sigorta', label: 'Sigorta' },
    { value: 'muayene', label: 'Muayene' },
    { value: 'bakim', label: 'Bakim' },
    { value: 'kalibrasyon', label: 'Kalibrasyon' },
    { value: 'kaza', label: 'Kaza' },
  ],
  ihale: [
    { value: 'sartname', label: 'Sartname' },
    { value: 'kesif', label: 'Kesif' },
    { value: 'teklif', label: 'Teklif' },
    { value: 'sozlesme', label: 'Sozlesme' },
  ],
  isg: [
    { value: 'risk_degerlendirme', label: 'Risk Degerlendirme' },
    { value: 'egitim', label: 'Egitim' },
    { value: 'denetim', label: 'Denetim' },
    { value: 'kaza_raporu', label: 'Kaza Raporu' },
    { value: 'form', label: 'Form' },
  ],
  firma: [
    { value: 'resmi_belge', label: 'Resmi Belge' },
    { value: 'yetki_belgesi', label: 'Yetki Belgesi' },
    { value: 'sigorta', label: 'Sigorta' },
  ],
  muhasebe: [
    { value: 'fatura_gelen', label: 'Gelen Fatura' },
    { value: 'fatura_giden', label: 'Giden Fatura' },
    { value: 'hak_edis', label: 'Hak Edis' },
    { value: 'banka', label: 'Banka' },
    { value: 'vergi', label: 'Vergi' },
  ],
  kurum: [
    { value: 'yedas', label: 'YEDAS' },
    { value: 'belediye', label: 'Belediye' },
    { value: 'tedas', label: 'TEDAS' },
  ],
  depo: [
    { value: 'gelen', label: 'Gelen' },
    { value: 'giden', label: 'Giden' },
  ],
}

export default function DosyaYukleModal({ yuklemeBilgi = {}, onKapat, onBasarili }) {
  const [dosyalar, setDosyalar] = useState([])
  const [baslik, setBaslik] = useState('')
  const [notlar, setNotlar] = useState('')
  const [altAlan, setAltAlan] = useState(yuklemeBilgi.altAlan || '')
  const [etiketler, setEtiketler] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState('')
  const [ilerleme, setIlerleme] = useState(0)
  const fileRef = useRef()

  const alan = yuklemeBilgi.alan || 'proje'
  const altAlanSec = ALT_ALAN_SECENEKLERI[alan] || []

  const dosyaSec = (e) => {
    setDosyalar(Array.from(e.target.files))
    setHata('')
  }

  const yukle = async () => {
    if (dosyalar.length === 0) {
      setHata('Dosya seciniz')
      return
    }

    setYukleniyor(true)
    setHata('')

    try {
      const toplamDosya = dosyalar.length
      let yuklenen = 0

      for (const dosya of dosyalar) {
        const formData = new FormData()
        formData.append('dosya', dosya)

        // Alan bilgileri
        if (alan) formData.append('alan', alan)
        if (altAlan) formData.append('alt_alan', altAlan)
        if (yuklemeBilgi.iliskiliKaynakTipi) formData.append('iliskili_kaynak_tipi', yuklemeBilgi.iliskiliKaynakTipi)
        if (yuklemeBilgi.iliskiliKaynakId) formData.append('iliskili_kaynak_id', yuklemeBilgi.iliskiliKaynakId)
        if (yuklemeBilgi.personelKodu) formData.append('personel_kodu', yuklemeBilgi.personelKodu)
        if (yuklemeBilgi.ekipmanKodu) formData.append('ekipman_kodu', yuklemeBilgi.ekipmanKodu)
        if (yuklemeBilgi.ihaleNo) formData.append('ihale_no', yuklemeBilgi.ihaleNo)
        if (yuklemeBilgi.kurumAdi) formData.append('kurum_adi', yuklemeBilgi.kurumAdi)

        // Mevcut parametreler
        if (yuklemeBilgi.projeNo) formData.append('proje_no', yuklemeBilgi.projeNo)
        if (yuklemeBilgi.projeId) formData.append('proje_id', yuklemeBilgi.projeId)
        if (yuklemeBilgi.ekipId) formData.append('ekip_id', yuklemeBilgi.ekipId)
        if (yuklemeBilgi.ekipKodu) formData.append('ekip_kodu', yuklemeBilgi.ekipKodu)
        if (yuklemeBilgi.veriPaketiId) formData.append('veri_paketi_id', yuklemeBilgi.veriPaketiId)

        if (baslik) formData.append('baslik', baslik)
        if (notlar) formData.append('notlar', notlar)
        if (etiketler.trim()) {
          formData.append('etiketler', JSON.stringify(etiketler.split(',').map(t => t.trim()).filter(Boolean)))
        }

        formData.append('kaynak', 'web')

        await api.post('/dosya/yukle', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })

        yuklenen++
        setIlerleme(Math.round((yuklenen / toplamDosya) * 100))
      }

      onBasarili()
    } catch (err) {
      setHata(err.message || 'Yukleme hatasi')
    } finally {
      setYukleniyor(false)
    }
  }

  return (
    <div
      onClick={onKapat}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50, padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: '16px', maxWidth: '500px', width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: '1px solid #e5e7eb',
        }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Dosya Yukle</h3>
          <button onClick={onKapat} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Dosya sec */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
              Dosya(lar)
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                border: '2px dashed #d1d5db', borderRadius: '10px', padding: '24px',
                textAlign: 'center', cursor: 'pointer', background: '#f9fafb',
              }}
            >
              {dosyalar.length > 0 ? (
                <div style={{ fontSize: '13px', color: '#374151' }}>
                  {dosyalar.length} dosya secildi ({dosyalar.map(f => f.name).join(', ')})
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '28px', marginBottom: '4px' }}>📂</div>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>Dosya secmek icin tiklayin</div>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              onChange={dosyaSec}
              style={{ display: 'none' }}
            />
          </div>

          {/* Alt alan (alan belirtilmisse ve secenekleri varsa) */}
          {altAlanSec.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
                Alt Kategori
              </label>
              <select
                value={altAlan}
                onChange={(e) => setAltAlan(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
                  borderRadius: '8px', fontSize: '13px',
                }}
              >
                <option value="">Sec...</option>
                {altAlanSec.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Baslik */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
              Baslik (opsiyonel)
            </label>
            <input
              value={baslik}
              onChange={(e) => setBaslik(e.target.value)}
              placeholder="Kisa aciklama..."
              style={{
                width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
                borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Etiketler */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
              Etiketler (virgul ile)
            </label>
            <input
              value={etiketler}
              onChange={(e) => setEtiketler(e.target.value)}
              placeholder="direk, montaj, acil"
              style={{
                width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
                borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Notlar */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
              Notlar (opsiyonel)
            </label>
            <textarea
              value={notlar}
              onChange={(e) => setNotlar(e.target.value)}
              placeholder="Ek aciklama..."
              rows={2}
              style={{
                width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
                borderRadius: '8px', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Hata */}
          {hata && (
            <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#dc2626', borderRadius: '8px', fontSize: '13px' }}>
              {hata}
            </div>
          )}

          {/* Ilerleme */}
          {yukleniyor && (
            <div style={{ background: '#f3f4f6', borderRadius: '8px', overflow: 'hidden', height: '6px' }}>
              <div style={{
                width: `${ilerleme}%`, height: '100%', background: '#2563eb',
                transition: 'width 0.3s',
              }} />
            </div>
          )}

          {/* Buton */}
          <button
            onClick={yukle}
            disabled={yukleniyor || dosyalar.length === 0}
            style={{
              padding: '10px 16px', fontSize: '14px', fontWeight: 600,
              background: yukleniyor || dosyalar.length === 0 ? '#9ca3af' : '#2563eb',
              color: 'white', border: 'none', borderRadius: '10px', cursor: yukleniyor ? 'wait' : 'pointer',
            }}
          >
            {yukleniyor ? `Yukleniyor... %${ilerleme}` : `Yukle (${dosyalar.length} dosya)`}
          </button>
        </div>
      </div>
    </div>
  )
}
