import { useEffect, useRef, useState } from 'react'

const KATEGORI_IKON = {
  fotograf: '📸', cizim: '📐', belge: '📄', tablo: '📊',
  harita: '🗺️', arsiv: '📦', diger: '📎',
}

function boyutFormatla(byte) {
  if (!byte) return '—'
  if (byte < 1024) return byte + ' B'
  if (byte < 1024 * 1024) return (byte / 1024).toFixed(1) + ' KB'
  return (byte / (1024 * 1024)).toFixed(1) + ' MB'
}

function tarihFormatla(tarih) {
  if (!tarih) return '—'
  const d = new Date(tarih)
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function DosyaOnizleme({ dosya, onKapat }) {
  // ESC ile kapat
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onKapat() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onKapat])

  // DOCX (Office Word) tespit + lazy-render — Hooks koşullu olamayacağı için en üstte
  const docxRef = useRef(null)
  const [docxYukleniyor, setDocxYukleniyor] = useState(false)
  const [docxHata, setDocxHata] = useState(null)

  const dosyaAdi = String(dosya?.orijinal_adi || dosya?.dosya_adi || '').toLowerCase()
  const isDocx = dosya?.mime_tipi === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || dosyaAdi.endsWith('.docx')
  // DOC eski Word formatı (binary) — docx-preview desteklemez, "indir" gösterilir
  const isDocEski = dosya?.mime_tipi === 'application/msword' || dosyaAdi.endsWith('.doc')
  const dosyaUrl = dosya ? `/api/dosya/${dosya.id}/dosya` : ''

  useEffect(() => {
    if (!isDocx || !dosya) return
    let iptal = false
    setDocxYukleniyor(true); setDocxHata(null)
    ;(async () => {
      try {
        const r = await fetch(dosyaUrl)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const blob = await r.blob()
        if (iptal) return
        const { renderAsync } = await import('docx-preview')
        if (!docxRef.current || iptal) return
        docxRef.current.innerHTML = ''
        await renderAsync(blob, docxRef.current, null, {
          className: 'docx-preview-render',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: true,
          trimXmlDeclaration: true,
          useBase64URL: true,
        })
      } catch (e) {
        if (!iptal) setDocxHata(e.message || 'Word belgesi açılamadı')
      } finally {
        if (!iptal) setDocxYukleniyor(false)
      }
    })()
    return () => { iptal = true }
  }, [isDocx, dosya?.id, dosyaUrl])

  if (!dosya) return null

  const isFoto = dosya.kategori === 'fotograf'
  const isPdf = dosya.mime_tipi === 'application/pdf'
  const indirUrl = `/api/dosya/${dosya.id}/indir`
  const ozel = dosya.ozel_alanlar ? (typeof dosya.ozel_alanlar === 'string' ? JSON.parse(dosya.ozel_alanlar) : dosya.ozel_alanlar) : {}
  const etiketler = dosya.etiketler ? (typeof dosya.etiketler === 'string' ? JSON.parse(dosya.etiketler) : dosya.etiketler) : []

  return (
    <div
      onClick={onKapat}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50, padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: '16px',
          maxWidth: (isDocx || isPdf) ? '960px' : '720px', width: '100%',
          maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: '1px solid #e5e7eb',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <span style={{ fontSize: '24px' }}>{KATEGORI_IKON[dosya.kategori] || '📎'}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {dosya.baslik || dosya.orijinal_adi || dosya.dosya_adi}
              </div>
              <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                {dosya.kategori} &bull; {boyutFormatla(dosya.dosya_boyutu)} &bull; {tarihFormatla(dosya.olusturma_tarihi)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <a
              href={indirUrl}
              style={{
                padding: '6px 14px', fontSize: '13px', fontWeight: 600,
                background: '#2563eb', color: 'white', borderRadius: '8px',
                textDecoration: 'none',
              }}
            >
              Indir
            </a>
            <button
              onClick={onKapat}
              style={{
                padding: '6px 12px', fontSize: '16px', background: '#f3f4f6',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Onizleme alani */}
        <div style={{ padding: '20px' }}>
          {isFoto && (
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <img
                src={dosyaUrl}
                alt={dosya.dosya_adi}
                style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px', objectFit: 'contain' }}
              />
            </div>
          )}

          {isPdf && (
            <div style={{ marginBottom: '16px', textAlign: 'center' }}>
              <iframe
                src={dosyaUrl}
                style={{ width: '100%', height: '400px', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                title="PDF Onizleme"
              />
            </div>
          )}

          {isDocx && (
            <div style={{ marginBottom: '16px' }}>
              {docxYukleniyor && (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
                  <div style={{ fontSize: '13px' }}>Word belgesi açılıyor…</div>
                </div>
              )}
              {docxHata && (
                <div style={{ padding: '20px', textAlign: 'center', background: '#fef2f2', borderRadius: '8px', color: '#991b1b', fontSize: '13px' }}>
                  Önizleme oluşturulamadı: {docxHata}
                  <div style={{ marginTop: '8px' }}>
                    <a href={indirUrl} style={{ color: '#2563eb' }}>İndirip Word ile açın</a>
                  </div>
                </div>
              )}
              <div
                ref={docxRef}
                style={{
                  background: '#f3f4f6', borderRadius: '8px',
                  maxHeight: '60vh', overflow: 'auto',
                  display: docxYukleniyor || docxHata ? 'none' : 'block',
                }}
              />
            </div>
          )}

          {isDocEski && !isDocx && (
            <div style={{ padding: '24px', textAlign: 'center', background: '#fffbeb', borderRadius: '8px', marginBottom: '16px', color: '#92400e' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>📄</div>
              <div style={{ fontSize: '13px', marginBottom: '6px' }}>Eski Word formatı (.doc) — tarayıcıda önizleme yok</div>
              <a href={indirUrl} style={{ color: '#2563eb', fontSize: '13px' }}>Indirmek için tıklayın</a>
            </div>
          )}

          {!isFoto && !isPdf && !isDocx && !isDocEski && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', background: '#f9fafb', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>{KATEGORI_IKON[dosya.kategori] || '📎'}</div>
              <div style={{ fontSize: '14px' }}>Bu dosya tipi icin onizleme mevcut degil</div>
              <a href={indirUrl} style={{ color: '#2563eb', fontSize: '13px' }}>Indirmek icin tiklayin</a>
            </div>
          )}

          {/* Detay bilgileri */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
            {dosya.orijinal_adi && (
              <div>
                <span style={{ color: '#9ca3af' }}>Orijinal Ad: </span>
                <span style={{ color: '#374151' }}>{dosya.orijinal_adi}</span>
              </div>
            )}
            {dosya.yukleyen_adi && (
              <div>
                <span style={{ color: '#9ca3af' }}>Yukleyen: </span>
                <span style={{ color: '#374151' }}>{dosya.yukleyen_adi}</span>
              </div>
            )}
            {dosya.alan && (
              <div>
                <span style={{ color: '#9ca3af' }}>Alan: </span>
                <span style={{ color: '#374151' }}>{dosya.alan}{dosya.alt_alan ? ` / ${dosya.alt_alan}` : ''}</span>
              </div>
            )}
            {dosya.proje_no && (
              <div>
                <span style={{ color: '#9ca3af' }}>Proje: </span>
                <span style={{ color: '#374151' }}>{dosya.proje_no}</span>
              </div>
            )}
            {dosya.kaynak && (
              <div>
                <span style={{ color: '#9ca3af' }}>Kaynak: </span>
                <span style={{ color: '#374151' }}>{dosya.kaynak}</span>
              </div>
            )}
            {dosya.konum_adi && (
              <div>
                <span style={{ color: '#9ca3af' }}>Konum: </span>
                <span style={{ color: '#374151' }}>{dosya.konum_adi}</span>
              </div>
            )}
            {dosya.notlar && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: '#9ca3af' }}>Notlar: </span>
                <span style={{ color: '#374151' }}>{dosya.notlar}</span>
              </div>
            )}
          </div>

          {/* Ozel alanlar */}
          {Object.keys(ozel).length > 0 && (
            <div style={{ marginTop: '12px', padding: '10px', background: '#f9fafb', borderRadius: '8px', fontSize: '12px' }}>
              <div style={{ fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Ozel Alanlar</div>
              {Object.entries(ozel).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span style={{ color: '#9ca3af' }}>{k.replace(/_/g, ' ')}</span>
                  <span style={{ color: '#374151' }}>{String(v)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Etiketler */}
          {etiketler.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', marginTop: '12px', flexWrap: 'wrap' }}>
              {etiketler.map(tag => (
                <span key={tag} style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                  background: '#e0e7ff', color: '#4338ca',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
