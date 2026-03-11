import { useState, useEffect } from 'react'
import api from '@/api/client'
import DosyaListesi from '@/components/dosya/DosyaListesi'

// Alan tanımlari
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
  const [aktifSekme, setAktifSekme] = useState('alanlar')
  const [seciliAlan, setSeciliAlan] = useState(null)
  const [istatistik, setIstatistik] = useState([])
  const [suresiDolanlar, setSuresiDolanlar] = useState([])

  useEffect(() => {
    api.get('/dosya/istatistik/alan')
      .then(j => { if (j.success) setIstatistik(j.data) })
      .catch(() => {})

    api.get('/dosya/suresi-dolan?gun=30')
      .then(j => { if (j.success) setSuresiDolanlar(j.data) })
      .catch(() => {})
  }, [])

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>
        Dosya Yonetimi
      </h1>

      {/* Ust sekmeler */}
      <div style={{
        display: 'flex', gap: '4px',
        borderBottom: '2px solid #e5e7eb', marginBottom: '20px',
        overflowX: 'auto',
      }}>
        {[
          { kod: 'alanlar',      etiket: 'Alanlar' },
          { kod: 'suresi_dolan', etiket: `Suresi Dolan (${suresiDolanlar.length})` },
          { kod: 'arama',        etiket: 'Arama' },
          { kod: 'istatistik',   etiket: 'Istatistik' },
          { kod: 'sablonlar',    etiket: 'Sablonlar' },
        ].map(s => (
          <button
            key={s.kod}
            onClick={() => { setAktifSekme(s.kod); setSeciliAlan(null) }}
            style={{
              padding: '8px 16px', fontSize: '13px', fontWeight: 600,
              border: 'none', cursor: 'pointer', background: 'transparent',
              borderBottom: aktifSekme === s.kod ? '2px solid #2563eb' : '2px solid transparent',
              color: aktifSekme === s.kod ? '#2563eb' : '#6b7280',
              marginBottom: '-2px', whiteSpace: 'nowrap',
            }}
          >
            {s.etiket}
          </button>
        ))}
      </div>

      {/* Alanlar sekmesi */}
      {aktifSekme === 'alanlar' && !seciliAlan && (
        <AlanKartlari
          alanlar={ALANLAR}
          istatistik={istatistik}
          onSec={setSeciliAlan}
        />
      )}

      {/* Secili alan dosya listesi */}
      {aktifSekme === 'alanlar' && seciliAlan && (
        <div>
          <button
            onClick={() => setSeciliAlan(null)}
            style={{
              padding: '6px 12px', fontSize: '13px',
              background: '#f3f4f6', border: 'none', borderRadius: '6px',
              cursor: 'pointer', marginBottom: '12px',
            }}
          >
            ← Alanlara Don
          </button>

          <DosyaListesi
            baslik={`${ALANLAR.find(a => a.kod === seciliAlan)?.ikon || ''} ${ALANLAR.find(a => a.kod === seciliAlan)?.etiket || ''}`}
            filtreler={{ alan: seciliAlan }}
            yuklemeBilgi={{ alan: seciliAlan }}
            gizleAlanFiltre={true}
          />
        </div>
      )}

      {/* Suresi dolan belgeler */}
      {aktifSekme === 'suresi_dolan' && (
        <SuresiDolanTablo dosyalar={suresiDolanlar} />
      )}

      {/* Global arama */}
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

      {/* Sablonlar */}
      {aktifSekme === 'sablonlar' && (
        <DosyaListesi
          baslik="Sablon Dosyalar"
          filtreler={{ alan: 'sablon' }}
          yuklemeBilgi={{ alan: 'sablon' }}
          gizleAlanFiltre={true}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// ALT BILESENLER
// ═══════════════════════════════════════════

function AlanKartlari({ alanlar, istatistik, onSec }) {
  const alanIstat = {}
  for (const row of istatistik) {
    if (!alanIstat[row.alan]) alanIstat[row.alan] = { sayi: 0, boyut: 0 }
    alanIstat[row.alan].sayi += row.dosya_sayisi
    alanIstat[row.alan].boyut += row.toplam_boyut
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: '12px',
    }}>
      {alanlar.map(alan => {
        const is_ = alanIstat[alan.kod] || { sayi: 0, boyut: 0 }

        return (
          <div
            key={alan.kod}
            onClick={() => onSec(alan.kod)}
            style={{
              padding: '16px',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              borderLeft: `4px solid ${alan.renk}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.transform = 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '28px' }}>{alan.ikon}</span>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#1f2937' }}>
                  {alan.etiket}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                  {alan.aciklama}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#6b7280' }}>
              <span>{is_.sayi} dosya</span>
              <span>{boyutFormatla(is_.boyut)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SuresiDolanTablo({ dosyalar }) {
  const bugun = new Date().toISOString().slice(0, 10)

  const satirlar = dosyalar.map(d => {
    const ozel = d.ozel_alanlar ? (typeof d.ozel_alanlar === 'string' ? JSON.parse(d.ozel_alanlar) : d.ozel_alanlar) : {}
    const tarihler = [
      ozel.gecerlilik_bitis,
      ozel.muayene_bitis,
      ozel.kalibrasyon_bitis,
      ozel.sigorta_bitis,
    ].filter(Boolean)

    const enErken = tarihler.sort()[0]
    const dolmus = enErken && enErken < bugun
    const kalanGun = enErken ? Math.ceil((new Date(enErken) - new Date()) / (1000 * 60 * 60 * 24)) : null

    return { ...d, enErken, dolmus, kalanGun, ozel }
  }).sort((a, b) => (a.enErken || 'z').localeCompare(b.enErken || 'z'))

  if (satirlar.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        Suresi dolacak belge bulunamadi (30 gun ici)
      </div>
    )
  }

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
      {/* Baslik */}
      <div style={{
        display: 'grid', gridTemplateColumns: '60px 1fr 120px 100px 100px 80px',
        padding: '8px 12px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
        fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase',
      }}>
        <span>Durum</span>
        <span>Belge</span>
        <span>Alan</span>
        <span>Iliskili</span>
        <span>Bitis Tarihi</span>
        <span>Kalan</span>
      </div>

      {/* Satirlar */}
      {satirlar.map(d => {
        const alanBilgi = ALANLAR.find(a => a.kod === d.alan)
        return (
          <div key={d.id} style={{
            display: 'grid', gridTemplateColumns: '60px 1fr 120px 100px 100px 80px',
            padding: '10px 12px', borderBottom: '1px solid #f3f4f6',
            background: d.dolmus ? '#fef2f2' : 'transparent',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: '18px' }}>
              {d.dolmus ? '🔴' : d.kalanGun <= 7 ? '🟠' : '🟡'}
            </span>

            <div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>
                {d.baslik || d.orijinal_adi || d.dosya_adi}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                {d.alt_alan && d.alt_alan.replace(/_/g, ' ')}
              </div>
            </div>

            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              {alanBilgi ? `${alanBilgi.ikon} ${alanBilgi.etiket}` : d.alan || '—'}
            </span>

            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              {d.proje_no || d.yukleyen_adi || '—'}
            </span>

            <span style={{
              fontSize: '12px', fontWeight: 600,
              color: d.dolmus ? '#dc2626' : d.kalanGun <= 7 ? '#ea580c' : '#6b7280',
            }}>
              {d.enErken}
            </span>

            <span style={{
              fontSize: '12px', fontWeight: 700,
              color: d.dolmus ? '#dc2626' : d.kalanGun <= 7 ? '#ea580c' : '#6b7280',
            }}>
              {d.dolmus ? 'DOLMUS' : `${d.kalanGun} gun`}
            </span>
          </div>
        )
      })}
    </div>
  )
}

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
      {/* Genel ozet */}
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

      {/* Alan bazli detay */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
        {alanlar.map(alan => {
          const is_ = alanToplam[alan.kod]
          if (!is_) return null

          return (
            <div key={alan.kod} style={{
              border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px',
              borderLeft: `4px solid ${alan.renk}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>
                  {alan.ikon} {alan.etiket}
                </span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                  {is_.sayi} dosya • {boyutFormatla(is_.boyut)}
                </span>
              </div>

              {is_.altlar.map((alt, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: '12px', color: '#6b7280', padding: '2px 0',
                }}>
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
