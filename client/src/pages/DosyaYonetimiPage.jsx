import { useState, useEffect } from 'react'
import api from '@/api/client'
import DosyaListesi from '@/components/dosya/DosyaListesi'

const ALANLAR = [
  { kod: 'proje',    etiket: 'Projeler',        ikon: '📁', renk: '#2563eb', aciklama: 'Saha fotograflari, cizimler, proje belgeleri' },
  { kod: 'personel', etiket: 'Personel',         ikon: '👤', renk: '#8b5cf6', aciklama: 'Kimlik, sertifika, saglik, SGK belgeleri' },
  { kod: 'ekipman',  etiket: 'Ekipman / Arac',   ikon: '🔧', renk: '#f59e0b', aciklama: 'Ruhsat, muayene, bakim, kalibrasyon' },
  { kod: 'ihale',    etiket: 'Ihale',            ikon: '📋', renk: '#10b981', aciklama: 'Sartname, teklif, sozlesme, kesif' },
  { kod: 'isg',      etiket: 'ISG',              ikon: '🛡️', renk: '#f43f5e', aciklama: 'Risk degerlendirme, egitim, denetim, kaza' },
  { kod: 'firma',    etiket: 'Firma Belgeleri',   ikon: '🏢', renk: '#6366f1', aciklama: 'Yetki belgeleri, sigorta, resmi belgeler' },
  { kod: 'muhasebe', etiket: 'Muhasebe',          ikon: '💰', renk: '#84cc16', aciklama: 'Fatura, hak edis, banka, vergi' },
  { kod: 'kurum',    etiket: 'Kurum Yazisma',     ikon: '📨', renk: '#0ea5e9', aciklama: 'YEDAS, belediye, TEDAS yazismalari' },
  { kod: 'depo',     etiket: 'Depo',              ikon: '📦', renk: '#ea580c', aciklama: 'Gelen malzeme bono/irsaliye, giden malzeme' },
]

function boyutFormatla(byte) {
  if (!byte) return '0 B'
  if (byte < 1024) return byte + ' B'
  if (byte < 1024 * 1024) return (byte / 1024).toFixed(1) + ' KB'
  if (byte < 1024 * 1024 * 1024) return (byte / (1024 * 1024)).toFixed(1) + ' MB'
  return (byte / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}

export default function DosyaYonetimiPage() {
  const [seciliAlan, setSeciliAlan] = useState(null)
  const [istatistik, setIstatistik] = useState([])
  const [suresiDolanlar, setSuresiDolanlar] = useState([])
  const [aktifSekme, setAktifSekme] = useState('explorer') // 'explorer' | 'suresi_dolan' | 'arama' | 'istatistik'

  useEffect(() => {
    api.get('/dosya/istatistik/alan')
      .then(j => { if (j.success) setIstatistik(j.data) })
      .catch(() => {})
    api.get('/dosya/suresi-dolan?gun=30')
      .then(j => { if (j.success) setSuresiDolanlar(j.data) })
      .catch(() => {})
  }, [])

  const alanIstat = {}
  for (const row of istatistik) {
    if (!alanIstat[row.alan]) alanIstat[row.alan] = { sayi: 0, boyut: 0 }
    alanIstat[row.alan].sayi += row.dosya_sayisi
    alanIstat[row.alan].boyut += row.toplam_boyut
  }

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Baslik */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Dosya Yonetimi</h1>
        <div style={{ display: 'flex', gap: '2px', background: '#f3f4f6', borderRadius: '8px', padding: '2px' }}>
          {[
            { kod: 'explorer', etiket: '📂 Dosyalar' },
            { kod: 'suresi_dolan', etiket: `⏰ Suresi Dolan (${suresiDolanlar.length})` },
            { kod: 'arama', etiket: '🔍 Arama' },
            { kod: 'istatistik', etiket: '📊 Istatistik' },
          ].map(s => (
            <button
              key={s.kod}
              onClick={() => { setAktifSekme(s.kod); if (s.kod !== 'explorer') setSeciliAlan(null) }}
              style={{
                padding: '6px 14px', fontSize: '12px', fontWeight: 600,
                border: 'none', cursor: 'pointer', borderRadius: '6px',
                background: aktifSekme === s.kod ? 'white' : 'transparent',
                color: aktifSekme === s.kod ? '#1f2937' : '#6b7280',
                boxShadow: aktifSekme === s.kod ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {s.etiket}
            </button>
          ))}
        </div>
      </div>

      {/* Explorer Sekmesi */}
      {aktifSekme === 'explorer' && !seciliAlan && (
        <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
          {/* Sol panel — Alan listesi */}
          <div style={{
            width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px',
            borderRight: '1px solid #e5e7eb', paddingRight: '12px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px', padding: '0 8px' }}>
              Alanlar
            </div>
            {ALANLAR.map(alan => {
              const is_ = alanIstat[alan.kod] || { sayi: 0, boyut: 0 }
              return (
                <button
                  key={alan.kod}
                  onClick={() => setSeciliAlan(alan.kod)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px', border: 'none', borderRadius: '8px',
                    cursor: 'pointer', background: 'transparent', textAlign: 'left',
                    width: '100%', transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: '24px' }}>{alan.ikon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>{alan.etiket}</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                      {is_.sayi} dosya · {boyutFormatla(is_.boyut)}
                    </div>
                  </div>
                  <span style={{ fontSize: '14px', color: '#d1d5db' }}>›</span>
                </button>
              )
            })}
          </div>

          {/* Sag panel — Ozet */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📂</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Dosya Yoneticisi</div>
              <div style={{ fontSize: '13px' }}>Sol taraftaki alanlardan birini secin</div>
            </div>
          </div>
        </div>
      )}

      {/* Explorer — Alan secili */}
      {aktifSekme === 'explorer' && seciliAlan && (
        <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
          {/* Sol panel — Alan listesi (dar) */}
          <div style={{
            width: '200px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '2px',
            borderRight: '1px solid #e5e7eb', paddingRight: '10px', overflow: 'auto',
          }}>
            {ALANLAR.map(alan => (
              <button
                key={alan.kod}
                onClick={() => setSeciliAlan(alan.kod)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 10px', border: 'none', borderRadius: '6px',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  background: seciliAlan === alan.kod ? '#eff6ff' : 'transparent',
                  fontWeight: seciliAlan === alan.kod ? 600 : 400,
                  color: seciliAlan === alan.kod ? '#1e40af' : '#374151',
                  fontSize: '13px', transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (seciliAlan !== alan.kod) e.currentTarget.style.background = '#f3f4f6' }}
                onMouseLeave={e => { if (seciliAlan !== alan.kod) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: '16px' }}>{alan.ikon}</span>
                <span>{alan.etiket}</span>
              </button>
            ))}
          </div>

          {/* Sag panel — Dosya listesi */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <DosyaListesi
              key={seciliAlan}
              filtreler={{ alan: seciliAlan }}
              yuklemeBilgi={{ alan: seciliAlan }}
              gizleAlanFiltre={true}
            />
          </div>
        </div>
      )}

      {/* Suresi Dolan */}
      {aktifSekme === 'suresi_dolan' && (
        <SuresiDolanTablo dosyalar={suresiDolanlar} />
      )}

      {/* Arama */}
      {aktifSekme === 'arama' && (
        <DosyaListesi
          baslik="Tum Dosyalarda Ara"
          gizleAlanFiltre={false}
          gizleYukleButon={true}
        />
      )}

      {/* Istatistik */}
      {aktifSekme === 'istatistik' && (
        <DosyaIstatistik istatistik={istatistik} alanlar={ALANLAR} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// SURESI DOLAN TABLO
// ═══════════════════════════════════════════

function SuresiDolanTablo({ dosyalar }) {
  const bugun = new Date().toISOString().slice(0, 10)

  const satirlar = dosyalar.map(d => {
    const ozel = d.ozel_alanlar ? (typeof d.ozel_alanlar === 'string' ? JSON.parse(d.ozel_alanlar) : d.ozel_alanlar) : {}
    const tarihler = [ozel.gecerlilik_bitis, ozel.muayene_bitis, ozel.kalibrasyon_bitis, ozel.sigorta_bitis].filter(Boolean)
    const enErken = tarihler.sort()[0]
    const dolmus = enErken && enErken < bugun
    const kalanGun = enErken ? Math.ceil((new Date(enErken) - new Date()) / (1000 * 60 * 60 * 24)) : null
    return { ...d, enErken, dolmus, kalanGun, ozel }
  }).sort((a, b) => (a.enErken || 'z').localeCompare(b.enErken || 'z'))

  if (satirlar.length === 0) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Suresi dolacak belge bulunamadi (30 gun ici)</div>
  }

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '50px 1fr 110px 100px 100px 70px',
        padding: '8px 12px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
        fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase',
      }}>
        <span></span><span>Belge</span><span>Alan</span><span>Iliskili</span><span>Bitis</span><span>Kalan</span>
      </div>
      {satirlar.map(d => (
        <div key={d.id} style={{
          display: 'grid', gridTemplateColumns: '50px 1fr 110px 100px 100px 70px',
          padding: '10px 12px', borderBottom: '1px solid #f3f4f6', background: d.dolmus ? '#fef2f2' : 'transparent', alignItems: 'center',
        }}>
          <span style={{ fontSize: '16px' }}>{d.dolmus ? '🔴' : d.kalanGun <= 7 ? '🟠' : '🟡'}</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>{d.baslik || d.orijinal_adi || d.dosya_adi}</div>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>{d.alt_alan?.replace(/_/g, ' ')}</div>
          </div>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>{d.alan || '—'}</span>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>{d.proje_no || d.yukleyen_adi || '—'}</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: d.dolmus ? '#dc2626' : '#6b7280' }}>{d.enErken}</span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: d.dolmus ? '#dc2626' : d.kalanGun <= 7 ? '#ea580c' : '#6b7280' }}>
            {d.dolmus ? 'DOLMUS' : `${d.kalanGun} gun`}
          </span>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════
// ISTATISTIK
// ═══════════════════════════════════════════

function DosyaIstatistik({ istatistik, alanlar }) {
  const alanToplam = {}
  let genelToplam = { sayi: 0, boyut: 0 }
  for (const row of istatistik) {
    if (!alanToplam[row.alan]) alanToplam[row.alan] = { sayi: 0, boyut: 0, altlar: [] }
    alanToplam[row.alan].sayi += row.dosya_sayisi
    alanToplam[row.alan].boyut += row.toplam_boyut
    alanToplam[row.alan].altlar.push({ altAlan: row.alt_alan, sayi: row.dosya_sayisi, boyut: row.toplam_boyut })
    genelToplam.sayi += row.dosya_sayisi
    genelToplam.boyut += row.toplam_boyut
  }

  return (
    <div>
      <div style={{
        display: 'flex', gap: '20px', marginBottom: '20px',
        padding: '16px', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd',
      }}>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0369a1' }}>{genelToplam.sayi}</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Toplam Dosya</div>
        </div>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0369a1' }}>{boyutFormatla(genelToplam.boyut)}</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Toplam Boyut</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
        {alanlar.map(alan => {
          const is_ = alanToplam[alan.kod]
          if (!is_) return null
          return (
            <div key={alan.kod} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px', borderLeft: `4px solid ${alan.renk}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>{alan.ikon} {alan.etiket}</span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>{is_.sayi} dosya · {boyutFormatla(is_.boyut)}</span>
              </div>
              {is_.altlar.map((alt, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', padding: '2px 0' }}>
                  <span>{alt.altAlan?.replace(/_/g, ' ') || 'genel'}</span>
                  <span>{alt.sayi} dosya ({boyutFormatla(alt.boyut)})</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
