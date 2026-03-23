import { useState, useEffect } from 'react'
import { X, Download, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Plus } from 'lucide-react'
import api from '@/api/client'

// ─── YARDIMCI ────────────────────────────────────────────────────
function normalize(str) {
  return String(str || '').toUpperCase().trim().replace(/\s+/g, ' ')
}

// ─── ANA BİLEŞEN ─────────────────────────────────────────────────
export default function MalzemeTalepModal({ projeler, onKapat }) {
  const [sablonBilgi, setSablonBilgi] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [olusturuluyor, setOlusturuluyor] = useState(false)
  const [hata, setHata] = useState(null)
  const [basarili, setBasarili] = useState(false)

  useEffect(() => {
    const fetchSablon = async () => {
      try {
        const res = await api.get('/malzeme-talep/sablon-bilgi')
        if (res.success) setSablonBilgi(res.data)
        else setHata(res.error || 'Şablon bilgisi alınamadı')
      } catch (err) {
        setHata(err.message || 'Şablon bilgisi alınamadı')
      } finally {
        setYukleniyor(false)
      }
    }
    fetchSablon()
  }, [])

  // Her proje için hangi Excel sütununa yazılacağını belirle
  const projeEslesmeler = projeler.map((proje) => {
    const normMusteri = normalize(proje.musteri_adi || '')
    const normProjeNo = normalize(proje.proje_no || '')
    const mevcut = (sablonBilgi?.projKolonlar || []).find(
      (k) => normalize(k.ad) === normMusteri || normalize(k.ad) === normProjeNo
    )
    return {
      ...proje,
      eslesen_kolon: mevcut ? mevcut.kolon : null,
      eslesen_ad: mevcut ? mevcut.ad : null,
      yeni_kolon: !mevcut,
    }
  })

  const handleOlustur = async () => {
    setOlusturuluyor(true)
    setHata(null)
    try {
      const res = await fetch('/api/malzeme-talep/olustur', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proje_idler: projeler.map((p) => p.id) }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || `Sunucu hatası: ${res.status}`)
      }

      // Dosyayı indir
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const tarih = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `Kesifler-Malzeme-Talep-${tarih}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setBasarili(true)
    } catch (err) {
      setHata(err.message)
    } finally {
      setOlusturuluyor(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-xl border border-border bg-white shadow-2xl">
        {/* Başlık */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-semibold">Malzeme Talebi Oluştur</h2>
          </div>
          <button onClick={onKapat} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* İçerik */}
        <div className="p-6 space-y-5">
          {/* Şablon bilgisi */}
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <p className="font-medium">Şablon: Keşifler KET-YB.xlsx</p>
            {yukleniyor ? (
              <p className="mt-1 text-emerald-600 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Şablon okunuyor...
              </p>
            ) : sablonBilgi ? (
              <p className="mt-1 text-emerald-600">
                {sablonBilgi.malzemeSayisi} malzeme satırı •{' '}
                {sablonBilgi.projKolonlar.length} mevcut proje sütunu
              </p>
            ) : null}
          </div>

          {/* Proje - Sütun eşleşmeleri */}
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">
              Seçili Projeler ({projeler.length})
            </p>
            <div className="space-y-2">
              {projeEslesmeler.map((proje) => (
                <div
                  key={proje.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-white px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{proje.proje_no}</p>
                    {proje.musteri_adi && (
                      <p className="text-xs text-muted-foreground">{proje.musteri_adi}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {yukleniyor ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : proje.eslesen_kolon ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span className="text-xs text-emerald-700 font-medium">
                          Sütun {proje.eslesen_kolon}: {proje.eslesen_ad}
                        </span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 text-amber-500" />
                        <span className="text-xs text-amber-700 font-medium">
                          Yeni sütun eklenecek
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Açıklama */}
          <p className="text-xs text-muted-foreground">
            Her proje için keşif listesindeki malzemeler şablona aktarılır. Mevcut
            proje sütunu bulunanlar güncellenir, bulunamayanlar yeni sütun olarak eklenir.
            Eşleştirme müşteri adı veya proje numarasına göre yapılır.
          </p>

          {/* Hata */}
          {hata && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{hata}</span>
            </div>
          )}

          {/* Başarılı */}
          {basarili && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Excel oluşturuldu ve indirildi.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <button
            onClick={onKapat}
            className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Kapat
          </button>
          <button
            onClick={handleOlustur}
            disabled={olusturuluyor || yukleniyor || !!hata}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {olusturuluyor ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Oluşturuluyor...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Oluştur ve İndir
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
