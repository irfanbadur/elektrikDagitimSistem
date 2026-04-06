import { useState } from 'react'
import { X, FileSpreadsheet, Loader2, CheckCircle, ExternalLink, Pencil } from 'lucide-react'
import api from '@/api/client'
import { cn } from '@/lib/utils'

const KOLONLAR = [
  { key: 'sira', label: '#', width: 'w-10', readOnly: true },
  { key: 'il', label: 'İl', width: 'w-24' },
  { key: 'ilce', label: 'İlçe', width: 'w-28' },
  { key: 'mahalle', label: 'Mahalle', width: 'w-28' },
  { key: 'proje_adi', label: 'Proje Adı', width: 'min-w-[160px] flex-1' },
  { key: 'teknik_birim', label: 'Teknik Birim', width: 'w-28' },
  { key: 'pyp_id', label: 'PYP ID', width: 'w-28' },
  { key: 'kesinti', label: 'Kesinti', width: 'w-20' },
  { key: 'yer_teslim_tarihi', label: 'Yer Teslim', width: 'w-28' },
  { key: 'ise_baslama_tarihi', label: 'İşe Başlama', width: 'w-28' },
  { key: 'is_bitirme_tarihi', label: 'İş Bitirme', width: 'w-28' },
]

export default function YerTeslimXlsxModal({ projeler, onKapat }) {
  // Proje verilerini düzenlenebilir satırlara dönüştür
  const [satirlar, setSatirlar] = useState(() =>
    projeler.map((p, i) => ({
      _id: p.id,
      sira: i + 1,
      il: p.il || '',
      ilce: p.ilce || '',
      mahalle: p.mahalle || '',
      proje_adi: p.musteri_adi || p.proje_no || '',
      teknik_birim: '',
      pyp_id: p.proje_no || '',
      kesinti: p.kesinti_ihtiyaci ? 'Var' : p.kesinti_ihtiyaci === 0 ? 'Yok' : '',
      yer_teslim_tarihi: p.teslim_tarihi || '',
      ise_baslama_tarihi: p.baslama_tarihi || '',
      is_bitirme_tarihi: p.bitis_tarihi || '',
    }))
  )
  const [yukleniyor, setYukleniyor] = useState(false)
  const [sonuc, setSonuc] = useState(null)
  const [hataMsg, setHataMsg] = useState('')
  const tarih = new Date().toISOString().slice(0, 10)
  const [dosyaAdi, setDosyaAdi] = useState(`Yer_Teslim_Tutanagi_${tarih}`)

  const handleDegistir = (index, key, val) => {
    setSatirlar(prev => prev.map((s, i) => i === index ? { ...s, [key]: val } : s))
  }

  const handleOlustur = async () => {
    setYukleniyor(true)
    setHataMsg('')
    try {
      const res = await api.post('/projeler/yer-teslim-xlsx', {
        satirlar,
        dosya_adi: dosyaAdi || undefined
      })
      const data = res?.data || res
      setSonuc(data)
      if (data.dosya_adi) setDosyaAdi(data.dosya_adi.replace(/\.xlsx$/i, ''))
    } catch (err) {
      setHataMsg(err.message || 'Yer teslim tutanağı oluşturulurken hata')
    } finally {
      setYukleniyor(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onKapat}>
      <div className="flex max-h-[90vh] w-full max-w-[95vw] flex-col rounded-lg bg-card shadow-xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-input px-5 py-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-semibold">Yer Teslim Tutanağı Oluştur</h3>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              {satirlar.length} proje
            </span>
          </div>
          <button onClick={onKapat} className="rounded p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        {/* Tablo */}
        <div className="flex-1 overflow-auto p-5">
          {/* Dosya adı ayarı */}
          <div className="mb-3 flex items-center gap-3 rounded-lg border border-input bg-muted/30 px-4 py-3">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Dosya Adı:</label>
              <input
                value={dosyaAdi}
                onChange={e => setDosyaAdi(e.target.value)}
                className="flex-1 min-w-0 rounded border border-input bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none"
              />
              <span className="text-xs text-muted-foreground">.xlsx</span>
            </div>
          </div>

          <p className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Pencil className="h-3.5 w-3.5" />
            Verileri kontrol edin, gerekli düzeltmeleri yapın ve oluşturun.
          </p>

          {hataMsg && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{hataMsg}</div>
          )}

          {sonuc && (
            <div className="mb-3 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800">Tutanak oluşturuldu — {sonuc.proje_sayisi} proje</p>
                <p className="text-xs text-emerald-600">{sonuc.dosya_adi}</p>
              </div>
              <a
                href={`/api/dosya/${sonuc.dosya_id}/indir`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <ExternalLink className="h-4 w-4" />
                İndir
              </a>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-input">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-input bg-muted/50">
                  {KOLONLAR.map(col => (
                    <th key={col.key} className={cn('px-2 py-2 text-left font-medium text-muted-foreground whitespace-nowrap', col.width)}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {satirlar.map((satir, idx) => (
                  <tr key={satir._id} className="border-b border-input/50 hover:bg-muted/20 transition-colors">
                    {KOLONLAR.map(col => (
                      <td key={col.key} className={cn('px-1 py-1', col.width)}>
                        {col.readOnly ? (
                          <span className="block px-1 py-1 text-center text-muted-foreground">{satir[col.key]}</span>
                        ) : (
                          <input
                            value={satir[col.key] || ''}
                            onChange={e => handleDegistir(idx, col.key, e.target.value)}
                            className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-xs hover:border-input focus:border-primary focus:outline-none"
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-input px-5 py-4">
          <button onClick={onKapat} className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-muted">
            {sonuc ? 'Kapat' : 'İptal'}
          </button>
          <button
            onClick={handleOlustur}
            disabled={yukleniyor || satirlar.length === 0}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {yukleniyor ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Oluşturuluyor...</>
            ) : sonuc ? (
              <><FileSpreadsheet className="h-4 w-4" />Yeniden Oluştur</>
            ) : (
              <><FileSpreadsheet className="h-4 w-4" />{satirlar.length} Proje ile Oluştur</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
