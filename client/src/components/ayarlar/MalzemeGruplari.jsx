import { useState, useRef, useEffect } from 'react'
import { Plus, Edit, Trash2, Save, X, Search, Loader2, Package, ChevronDown, ChevronRight } from 'lucide-react'
import { useMalzemeGruplari, useMalzemeGrup, useMalzemeGrupOlustur, useMalzemeGrupGuncelle, useMalzemeGrupSil } from '@/hooks/useMalzemeGruplari'
import api from '@/api/client'
import { cn } from '@/lib/utils'
import ConfirmDialog from '@/components/shared/ConfirmDialog'

// Tek kalem satırı — malzeme adı (tıkla-ara), kısa isim, miktar, sil
function KalemSatir({ kalem, onKatalogSec, onKisaIsimDegistir, onMiktarDegistir, onBirimDegistir, onSil }) {
  const [duzenle, setDuzenle] = useState(false)
  const [aramaVal, setAramaVal] = useState('')
  const [sonuclar, setSonuclar] = useState([])
  const [araniyor, setAraniyor] = useState(false)
  const [secIdx, setSecIdx] = useState(-1)
  const timerRef = useRef(null)

  const araFunc = (text) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!text || text.length < 2) { setSonuclar([]); return }
    setAraniyor(true)
    timerRef.current = setTimeout(async () => {
      try {
        const r = await api.get('/malzeme-katalog', { params: { arama: text } })
        setSonuclar((Array.isArray(r) ? r : (r?.data || [])).slice(0, 10))
      } catch { setSonuclar([]) }
      setAraniyor(false)
    }, 300)
  }
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])
  useEffect(() => { setSecIdx(-1) }, [sonuclar])

  const sec = (item) => {
    const ad = item.malzeme_cinsi || item.malzeme_tanimi_sap || ''
    onKatalogSec({ katalog_id: item.id, malzeme_adi: ad, malzeme_kodu: item.malzeme_kodu || null })
    setDuzenle(false); setSonuclar([])
  }

  const handleKeyDown = (e) => {
    if (!sonuclar.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSecIdx(p => Math.min(p + 1, sonuclar.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSecIdx(p => Math.max(p - 1, 0)) }
    else if (e.key === 'Enter' && secIdx >= 0) { e.preventDefault(); sec(sonuclar[secIdx]) }
    else if (e.key === 'Escape') { setDuzenle(false); setSonuclar([]) }
  }

  if (duzenle) {
    return (
      <div className="relative border-b border-border/20 py-1">
        <div className="flex items-center gap-1">
          <input value={aramaVal} onChange={e => { setAramaVal(e.target.value); araFunc(e.target.value) }}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => { setDuzenle(false); setSonuclar([]) }, 200)}
            autoFocus placeholder="Katalogda malzeme ara..."
            className="flex-1 rounded border border-primary bg-white px-2 py-1 text-xs focus:outline-none" />
          <button onClick={() => { setDuzenle(false); setSonuclar([]) }} className="text-muted-foreground text-xs px-1">✕</button>
        </div>
        {(araniyor || sonuclar.length > 0) && (
          <div className="absolute left-0 top-full z-50 mt-0.5 w-full max-h-48 overflow-y-auto rounded border border-border bg-white shadow-lg">
            {araniyor ? <div className="px-2 py-1 text-xs text-muted-foreground"><Loader2 className="inline h-3 w-3 animate-spin mr-1" />Aranıyor...</div> : (
              sonuclar.map((item, i) => (
                <button key={item.id} onMouseDown={e => { e.preventDefault(); sec(item) }}
                  className={cn('flex w-full items-center gap-1 px-2 py-1 text-xs text-left border-b border-border/20', i === secIdx ? 'bg-primary/10' : 'hover:bg-primary/5')}>
                  <span className="font-mono text-blue-600 w-20 shrink-0 truncate">{item.malzeme_kodu || '-'}</span>
                  <span className="flex-1 truncate">{item.malzeme_cinsi || item.malzeme_tanimi_sap}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 py-1 border-b border-border/20 text-xs">
      <span className="flex-1 truncate cursor-pointer hover:text-primary hover:underline"
        title="Tıkla — katalogdan değiştir"
        onClick={() => { setDuzenle(true); setAramaVal(kalem.malzeme_adi || '') }}>
        {kalem.malzeme_kodu && <span className="font-mono text-blue-600 mr-2">{kalem.malzeme_kodu}</span>}
        {kalem.malzeme_adi || <span className="italic text-muted-foreground">Katalogdan seç...</span>}
      </span>
      <input value={kalem.kisa_isim || ''} onChange={e => onKisaIsimDegistir(e.target.value)}
        placeholder="kısa isim" title="Kısa isim (sprite text ve liste)"
        className="w-28 rounded border border-input bg-amber-50 px-1 py-0.5 text-xs font-medium text-amber-700 focus:outline-none focus:border-amber-400" />
      <input type="number" value={kalem.miktar || 1} min={0} step={0.1}
        onChange={e => onMiktarDegistir(Number(e.target.value) || 0)}
        className="w-14 rounded border border-input px-1 py-0.5 text-center text-xs" />
      <select value={kalem.birim || 'Ad'} onChange={e => onBirimDegistir(e.target.value)}
        className="w-16 rounded border border-input px-1 py-0.5 text-xs bg-white">
        <option value="Ad">Ad</option><option value="m">m</option><option value="kg">kg</option>
        <option value="takım">takım</option><option value="m2">m²</option>
      </select>
      <button onClick={onSil} className="text-red-400 hover:text-red-600 p-0.5"><Trash2 className="h-3 w-3" /></button>
    </div>
  )
}

function GrupFormu({ grup, onKaydet, onIptal, yukleniyor }) {
  const [kisaAd, setKisaAd] = useState(grup?.kisa_ad || '')
  const [aciklama, setAciklama] = useState(grup?.aciklama || '')
  const [kalemler, setKalemler] = useState(grup?.kalemler || [])

  const guncelleKalem = (i, delta) => setKalemler(ks => ks.map((k, j) => j === i ? { ...k, ...delta } : k))
  const ekle = () => setKalemler(ks => [...ks, { malzeme_adi: '', miktar: 1, birim: 'Ad', kisa_isim: '' }])
  const sil = (i) => setKalemler(ks => ks.filter((_, j) => j !== i))

  const kaydet = () => {
    if (!kisaAd.trim()) return alert('Kısa ad zorunlu')
    const gecerli = kalemler.filter(k => k.malzeme_adi?.trim())
    onKaydet({ kisa_ad: kisaAd.trim(), aciklama: aciklama.trim() || null, kalemler: gecerli })
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-xs font-semibold text-muted-foreground">Kısa Ad (DXF/listede görünecek)</label>
          <input value={kisaAd} onChange={e => setKisaAd(e.target.value)} placeholder="örn: makara, koruma, işletme"
            className="mt-1 w-full rounded border border-input bg-white px-2 py-1 text-sm focus:border-primary focus:outline-none" />
        </div>
        <div className="flex-1">
          <label className="text-xs font-semibold text-muted-foreground">Açıklama (opsiyonel)</label>
          <input value={aciklama} onChange={e => setAciklama(e.target.value)} placeholder="Grubun açıklaması"
            className="mt-1 w-full rounded border border-input bg-white px-2 py-1 text-sm focus:border-primary focus:outline-none" />
        </div>
      </div>

      <div className="rounded border border-input bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-muted-foreground">Kalemler ({kalemler.length})</span>
          <button onClick={ekle} className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-white hover:bg-primary/90">
            <Plus className="h-3 w-3" /> Kalem Ekle
          </button>
        </div>
        {kalemler.length === 0 ? <p className="text-xs italic text-muted-foreground/60">Henüz kalem eklenmedi</p> : (
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground uppercase pb-1 border-b border-border">
              <span className="flex-1">Malzeme (Katalogdan)</span>
              <span className="w-28">Kısa İsim</span>
              <span className="w-14 text-center">Miktar</span>
              <span className="w-16 text-center">Birim</span>
              <span className="w-5"></span>
            </div>
            {kalemler.map((k, i) => (
              <KalemSatir key={i} kalem={k}
                onKatalogSec={(d) => guncelleKalem(i, d)}
                onKisaIsimDegistir={(v) => guncelleKalem(i, { kisa_isim: v })}
                onMiktarDegistir={(v) => guncelleKalem(i, { miktar: v })}
                onBirimDegistir={(v) => guncelleKalem(i, { birim: v })}
                onSil={() => sil(i)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button onClick={onIptal} className="rounded border border-input px-3 py-1.5 text-sm hover:bg-muted">İptal</button>
        <button onClick={kaydet} disabled={yukleniyor}
          className="flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
          {yukleniyor ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Kaydet
        </button>
      </div>
    </div>
  )
}

function GrupSatir({ grup, onDuzenle, onSil, acik, onToggle }) {
  const { data: detay } = useMalzemeGrup(acik ? grup.id : null)
  return (
    <div className="rounded border border-input bg-card">
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/30" onClick={onToggle}>
        {acik ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <Package className="h-4 w-4 text-amber-600" />
        <span className="font-semibold text-sm">{grup.kisa_ad}</span>
        <span className="text-xs text-muted-foreground">{grup.kalem_sayisi || 0} kalem</span>
        {grup.aciklama && <span className="text-xs text-muted-foreground truncate flex-1">— {grup.aciklama}</span>}
        <button onClick={e => { e.stopPropagation(); onDuzenle() }} className="rounded p-1 hover:bg-primary/10 text-primary"><Edit className="h-3.5 w-3.5" /></button>
        <button onClick={e => { e.stopPropagation(); onSil() }} className="rounded p-1 hover:bg-red-50 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      {acik && detay && (
        <div className="border-t border-input bg-muted/20 px-4 py-2">
          {(detay.kalemler || []).length === 0 ? <p className="text-xs italic text-muted-foreground">Kalem yok</p> : (
            <div className="space-y-1">
              {detay.kalemler.map(k => (
                <div key={k.id} className="flex items-center gap-2 text-xs py-0.5">
                  {k.malzeme_kodu && <span className="font-mono text-blue-600 w-20 shrink-0">{k.malzeme_kodu}</span>}
                  <span className="flex-1 truncate">{k.malzeme_adi}</span>
                  {k.kisa_isim && <span className="rounded bg-amber-50 px-1.5 text-amber-700 font-medium text-[10px]">{k.kisa_isim}</span>}
                  <span className="tabular-nums text-right w-10">{k.miktar}</span>
                  <span className="text-muted-foreground w-8">{k.birim}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function MalzemeGruplari() {
  const [arama, setArama] = useState('')
  const { data: gruplar, isLoading } = useMalzemeGruplari(arama)
  const olustur = useMalzemeGrupOlustur()
  const guncelle = useMalzemeGrupGuncelle()
  const sil = useMalzemeGrupSil()
  const [yeniForm, setYeniForm] = useState(false)
  const [duzenleId, setDuzenleId] = useState(null)
  const { data: duzenleGrup } = useMalzemeGrup(duzenleId)
  const [silDialog, setSilDialog] = useState(null)
  const [acikId, setAcikId] = useState(null)

  const handleOlustur = (data) => {
    olustur.mutate(data, {
      onSuccess: () => setYeniForm(false),
      onError: (err) => alert(err?.response?.data?.error || err.message),
    })
  }

  const handleGuncelle = (data) => {
    guncelle.mutate({ id: duzenleId, ...data }, {
      onSuccess: () => setDuzenleId(null),
      onError: (err) => alert(err?.response?.data?.error || err.message),
    })
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-muted-foreground" />
          <div>
            <h2 className="text-xl font-semibold">Malzeme Grupları</h2>
            <p className="text-xs text-muted-foreground">Kısa ad altında birden çok katalog malzemesini grupla — Hakediş'te kısa ad yazınca hepsi eklenir</p>
          </div>
        </div>
        {!yeniForm && !duzenleId && (
          <button onClick={() => setYeniForm(true)} className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Yeni Grup
          </button>
        )}
      </div>

      {yeniForm && (
        <div className="mb-4">
          <GrupFormu onKaydet={handleOlustur} onIptal={() => setYeniForm(false)} yukleniyor={olustur.isPending} />
        </div>
      )}

      {duzenleId && duzenleGrup && (
        <div className="mb-4">
          <GrupFormu grup={duzenleGrup} onKaydet={handleGuncelle} onIptal={() => setDuzenleId(null)} yukleniyor={guncelle.isPending} />
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={arama} onChange={e => setArama(e.target.value)} placeholder="Grup ara (kısa ad, açıklama)..."
          className="flex-1 max-w-md rounded-md border border-input bg-white px-3 py-1.5 text-sm focus:border-primary focus:outline-none" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-12 w-full" />)}</div>
      ) : !gruplar?.length ? (
        <div className="rounded border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
          <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          {arama ? 'Eşleşen grup yok' : 'Henüz grup eklenmedi'}
        </div>
      ) : (
        <div className="space-y-2">
          {gruplar.map(g => (
            <GrupSatir key={g.id} grup={g}
              acik={acikId === g.id}
              onToggle={() => setAcikId(p => p === g.id ? null : g.id)}
              onDuzenle={() => { setDuzenleId(g.id); setYeniForm(false) }}
              onSil={() => setSilDialog(g)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog open={!!silDialog} onClose={() => setSilDialog(null)}
        onConfirm={() => { sil.mutate(silDialog.id); setSilDialog(null) }}
        baslik="Grubu sil?" mesaj={`"${silDialog?.kisa_ad}" grubunu silmek istediğinizden emin misiniz? Tüm kalemleri kaybolur.`} />
    </div>
  )
}
