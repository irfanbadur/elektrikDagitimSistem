import { useState } from 'react'
import {
  useDonguSablonlari,
  useDonguSablonOlustur,
  useDonguSablonGuncelle,
} from '@/hooks/useDongu'
import { cn } from '@/lib/utils'

const RENKLER = ['#6366f1','#8b5cf6','#0ea5e9','#f59e0b','#10b981','#3b82f6','#14b8a6','#f43f5e','#ec4899','#84cc16']
const IKONLAR = ['\uD83D\uDCCD','\uD83D\uDCD0','\uD83D\uDCE6','\uD83D\uDD27','\uD83D\uDDFA\uFE0F','\uD83D\uDCB0','\u2705','\uD83D\uDD34','\uD83D\uDCCB','\u26A1','\uD83C\uDFD7\uFE0F','\uD83D\uDCCA','\uD83D\uDD0D','\uD83D\uDCDD']

function kodUret(adi) {
  return adi
    .toLowerCase()
    .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
    .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

export default function DonguSablonYonetimi() {
  const { data: sablonlar, isLoading } = useDonguSablonlari()
  const olustur = useDonguSablonOlustur()
  const guncelle = useDonguSablonGuncelle()

  const [secili, setSecili] = useState(null)
  const [yeniMod, setYeniMod] = useState(false)
  const [form, setForm] = useState({
    sablonAdi: '',
    sablonKodu: '',
    aciklama: '',
    asamalar: [],
  })

  const sablonSec = (sablon) => {
    setSecili(sablon)
    setYeniMod(false)
    setForm({
      sablonAdi: sablon.sablon_adi,
      sablonKodu: sablon.sablon_kodu,
      aciklama: sablon.aciklama || '',
      asamalar: sablon.asamalar.map(a => ({
        sira: a.sira,
        asama_adi: a.asama_adi,
        asama_kodu: a.asama_kodu,
        renk: a.renk,
        ikon: a.ikon,
        tahmini_gun: a.tahmini_gun,
      })),
    })
  }

  const yeniBaslat = () => {
    setSecili(null)
    setYeniMod(true)
    setForm({
      sablonAdi: '',
      sablonKodu: '',
      aciklama: '',
      asamalar: [
        { sira: 1, asama_adi: '', asama_kodu: '', renk: RENKLER[0], ikon: '\uD83D\uDCCB', tahmini_gun: null },
      ],
    })
  }

  const asamaEkle = () => {
    const yeniSira = form.asamalar.length + 1
    setForm({
      ...form,
      asamalar: [...form.asamalar, {
        sira: yeniSira,
        asama_adi: '',
        asama_kodu: '',
        renk: RENKLER[(yeniSira - 1) % RENKLER.length],
        ikon: '\uD83D\uDCCB',
        tahmini_gun: null,
      }],
    })
  }

  const asamaSil = (sira) => {
    const yeni = form.asamalar
      .filter(a => a.sira !== sira)
      .map((a, i) => ({ ...a, sira: i + 1 }))
    setForm({ ...form, asamalar: yeni })
  }

  const asamaGuncelle = (sira, alan, deger) => {
    setForm({
      ...form,
      asamalar: form.asamalar.map(a =>
        a.sira === sira ? { ...a, [alan]: deger } : a
      ),
    })
  }

  const kaydet = () => {
    const body = {
      sablonAdi: form.sablonAdi,
      sablonKodu: form.sablonKodu,
      aciklama: form.aciklama,
      asamalar: form.asamalar.map(a => ({
        ...a,
        asama_kodu: a.asama_kodu || kodUret(a.asama_adi),
      })),
    }

    if (yeniMod) {
      olustur.mutate(body, {
        onSuccess: (res) => {
          setYeniMod(false)
          const data = res.data || res
          setSecili(data)
        },
      })
    } else {
      guncelle.mutate({ id: secili.id, ...body })
    }
  }

  if (isLoading) return <div className="p-4 text-sm text-gray-400">Yukleniyor...</div>

  return (
    <div className="flex gap-5 min-h-[400px]">
      {/* Sol: Sablon Listesi */}
      <div className="w-60 border-r border-gray-200 pr-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold">Sablonlar</h3>
          <button
            onClick={yeniBaslat}
            className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Yeni
          </button>
        </div>
        {sablonlar?.map(s => (
          <div
            key={s.id}
            onClick={() => sablonSec(s)}
            className={cn(
              'p-2.5 rounded-lg cursor-pointer mb-1',
              secili?.id === s.id
                ? 'bg-blue-50 border border-blue-200'
                : 'hover:bg-gray-50 border border-transparent'
            )}
          >
            <div className="font-semibold text-sm">{s.sablon_adi}</div>
            <div className="text-xs text-gray-500">
              {s.asamalar.length} asama &bull; {s.sablon_kodu}
            </div>
          </div>
        ))}
      </div>

      {/* Sag: Duzenleme */}
      <div className="flex-1">
        {!secili && !yeniMod ? (
          <div className="p-10 text-center text-gray-400">
            Bir sablon secin veya yeni olusturun
          </div>
        ) : (
          <div>
            {/* Sablon bilgileri */}
            <div className="flex gap-3 mb-4">
              <input
                value={form.sablonAdi}
                onChange={e => setForm({ ...form, sablonAdi: e.target.value })}
                placeholder="Sablon Adi"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <input
                value={form.sablonKodu}
                onChange={e => setForm({ ...form, sablonKodu: e.target.value.toUpperCase() })}
                placeholder="Kod"
                disabled={!yeniMod}
                className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm text-center disabled:bg-gray-100"
              />
            </div>

            {/* Asamalar */}
            <div className="mb-3">
              <h4 className="text-xs font-semibold text-gray-700 mb-2">Asamalar</h4>
              {form.asamalar.map(a => (
                <div
                  key={a.sira}
                  className="flex gap-2 items-center p-2 mb-1 bg-gray-50 rounded-md"
                >
                  <span
                    className="w-6 h-6 rounded-full text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                    style={{ background: a.renk }}
                  >
                    {a.sira}
                  </span>

                  <select
                    value={a.ikon}
                    onChange={e => asamaGuncelle(a.sira, 'ikon', e.target.value)}
                    className="w-12 px-1 py-1 border border-gray-300 rounded text-sm"
                  >
                    {IKONLAR.map(ikon => (
                      <option key={ikon} value={ikon}>{ikon}</option>
                    ))}
                  </select>

                  <input
                    value={a.asama_adi}
                    onChange={e => asamaGuncelle(a.sira, 'asama_adi', e.target.value)}
                    placeholder="Asama Adi"
                    className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-sm"
                  />

                  <input
                    value={a.tahmini_gun || ''}
                    onChange={e => asamaGuncelle(a.sira, 'tahmini_gun', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Gun"
                    type="number"
                    className="w-14 px-2 py-1.5 border border-gray-300 rounded text-sm text-center"
                  />

                  <input
                    type="color"
                    value={a.renk}
                    onChange={e => asamaGuncelle(a.sira, 'renk', e.target.value)}
                    className="w-8 h-8 border-none cursor-pointer"
                  />

                  <button
                    onClick={() => asamaSil(a.sira)}
                    className="w-7 h-7 bg-red-100 text-red-600 rounded text-sm hover:bg-red-200 flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                onClick={asamaEkle}
                className="w-full mt-1 py-1.5 text-xs text-blue-600 bg-white border border-dashed border-blue-300 rounded-md hover:bg-blue-50"
              >
                + Asama Ekle
              </button>
            </div>

            {/* Kaydet */}
            <button
              onClick={kaydet}
              disabled={!form.sablonAdi || form.asamalar.length === 0 || olustur.isPending || guncelle.isPending}
              className="px-6 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {olustur.isPending || guncelle.isPending
                ? 'Kaydediliyor...'
                : yeniMod ? 'Sablon Olustur' : 'Guncelle'}
            </button>
            {(olustur.isError || guncelle.isError) && (
              <p className="mt-2 text-sm text-red-500">
                {olustur.error?.message || guncelle.error?.message}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
