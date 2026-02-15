import { useState } from 'react'
import {
  useProjeIlerleme,
  useDonguSablonlari,
  useProjeDonguAta,
  useProjeDonguSil,
  useAsamaBaslat,
  useAsamaTamamla,
  useAsamaAtla,
} from '@/hooks/useDongu'
import { cn } from '@/lib/utils'

// ─── DURUM STİLLERİ ────────────────────────────
const DURUM_STILLER = {
  bekliyor:     { bg: 'bg-gray-100',   border: 'border-gray-300',  text: 'text-gray-500',   label: 'Bekliyor',      ikon: '\u23F3' },
  devam_ediyor: { bg: 'bg-blue-100',   border: 'border-blue-500',  text: 'text-blue-700',   label: 'Devam Ediyor',  ikon: '\uD83D\uDD04' },
  tamamlandi:   { bg: 'bg-green-100',  border: 'border-green-500', text: 'text-green-700',  label: 'Tamamland\u0131',ikon: '\u2705' },
  atlandi:      { bg: 'bg-yellow-100', border: 'border-yellow-500',text: 'text-yellow-700', label: 'Atland\u0131',  ikon: '\u23ED\uFE0F' },
}

function getDurumStil(durum) {
  return DURUM_STILLER[durum] || DURUM_STILLER.bekliyor
}

// ─── TEK AŞAMA KARTI ───────────────────────────
function AsamaKarti({ asama, onBaslat, onTamamla, onAtla, isLast }) {
  const stil = getDurumStil(asama.durum)
  const aktif = asama.durum === 'devam_ediyor'

  let gecenGun = null
  if (asama.baslangic_tarihi) {
    const bas = new Date(asama.baslangic_tarihi)
    const bit = asama.bitis_tarihi ? new Date(asama.bitis_tarihi) : new Date()
    gecenGun = Math.ceil((bit - bas) / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="flex items-stretch gap-3">
      {/* Sol — Timeline */}
      <div className="flex flex-col items-center w-10 flex-shrink-0">
        <div
          className={cn(
            'rounded-full flex items-center justify-center flex-shrink-0 border-[3px]',
            stil.bg, stil.border,
            aktif ? 'w-9 h-9 text-base ring-4 ring-blue-500/20' : 'w-7 h-7 text-sm'
          )}
        >
          {asama.ikon || stil.ikon}
        </div>
        {!isLast && (
          <div
            className={cn(
              'flex-1 w-0.5 min-h-[20px]',
              asama.durum === 'tamamlandi' ? 'bg-green-500' : 'bg-gray-200'
            )}
          />
        )}
      </div>

      {/* Sag — icerik */}
      <div
        className={cn(
          'flex-1 rounded-xl p-3 mb-2 border transition-all',
          aktif ? cn(stil.bg, stil.border) : 'bg-white border-gray-200'
        )}
      >
        {/* Baslik satiri */}
        <div className="flex justify-between items-center">
          <div>
            <span className="text-[11px] text-gray-400 font-semibold">
              {asama.sira}. ASAMA
            </span>
            <div className={cn('text-[15px] font-semibold', stil.text)}>
              {asama.asama_adi}
            </div>
          </div>
          <span
            className={cn(
              'text-[11px] font-semibold px-2.5 py-0.5 rounded-full border',
              stil.bg, stil.text, stil.border
            )}
          >
            {stil.ikon} {stil.label}
          </span>
        </div>

        {/* Tarih */}
        <div className="mt-2 text-xs text-gray-500">
          {asama.baslangic_tarihi && <span>{asama.baslangic_tarihi}</span>}
          {asama.bitis_tarihi && <span> &rarr; {asama.bitis_tarihi}</span>}
          {gecenGun !== null && (
            <span className="ml-2 text-gray-400">({gecenGun} gun)</span>
          )}
          {!asama.baslangic_tarihi && asama.tahmini_gun && (
            <span className="text-gray-400">Tahmini: ~{asama.tahmini_gun} gun</span>
          )}
        </div>

        {/* Istatistikler */}
        {(asama.paket_sayisi > 0 || asama.dosya_sayisi > 0) && (
          <div className="mt-1.5 text-xs text-gray-500 flex gap-3">
            {asama.paket_sayisi > 0 && <span>📦 {asama.paket_sayisi} veri paketi</span>}
            {asama.dosya_sayisi > 0 && <span>📎 {asama.dosya_sayisi} dosya</span>}
          </div>
        )}

        {/* Aksiyon butonlari */}
        <div className="mt-2.5 flex gap-2">
          {asama.durum === 'bekliyor' && (
            <>
              <button
                onClick={() => onBaslat(asama.id)}
                className="px-3 py-1 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                ▶ Baslat
              </button>
              <button
                onClick={() => onAtla(asama.id)}
                className="px-3 py-1 text-xs bg-white text-gray-500 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Atla
              </button>
            </>
          )}
          {asama.durum === 'devam_ediyor' && (
            <button
              onClick={() => onTamamla(asama.id)}
              className="px-3 py-1 text-xs font-semibold bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Tamamla
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ILERLEME CUBUGU ───────────────────────────
function IlerlemeBar({ ilerleme }) {
  return (
    <div className="mb-5">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm font-semibold text-gray-700">Genel Ilerleme</span>
        <span className="text-xl font-bold text-blue-600">%{ilerleme.yuzde}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            ilerleme.yuzde === 100 ? 'bg-green-500' : 'bg-blue-600'
          )}
          style={{ width: `${ilerleme.yuzde}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-gray-500">
        {ilerleme.tamamlanan}/{ilerleme.toplam_asama} asama tamamlandi
        {ilerleme.devam_eden && ` \u2022 Su an: ${ilerleme.devam_eden}`}
      </div>
    </div>
  )
}

// ─── SABLON ATAMA ────────────────────────────
function SablonAtamaPanel({ projeId }) {
  const { data: sablonlar, isLoading } = useDonguSablonlari()
  const ata = useProjeDonguAta()
  const [secili, setSecili] = useState('')

  const handleAta = () => {
    if (!secili) return
    ata.mutate({ projeId: parseInt(projeId), sablonId: parseInt(secili) })
  }

  if (isLoading) return <div className="text-sm text-gray-400 p-4">Yukleniyor...</div>

  return (
    <div className="p-6 text-center">
      <p className="text-gray-400 mb-4">Bu projeye henuz dongu atanmamis.</p>
      <div className="flex items-center justify-center gap-3">
        <select
          value={secili}
          onChange={(e) => setSecili(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">Sablon sec...</option>
          {sablonlar?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.sablon_adi} ({s.asamalar.length} asama)
            </option>
          ))}
        </select>
        <button
          onClick={handleAta}
          disabled={!secili || ata.isPending}
          className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {ata.isPending ? 'Ataniyor...' : 'Dongu Ata'}
        </button>
      </div>
      {ata.isError && (
        <p className="mt-2 text-sm text-red-500">{ata.error.message}</p>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════
// ANA BILESEN
// ═══════════════════════════════════════════════
export default function ProjeDongu({ projeId }) {
  const { data: ilerleme, isLoading } = useProjeIlerleme(projeId)
  const baslat = useAsamaBaslat()
  const tamamla = useAsamaTamamla()
  const atla = useAsamaAtla()

  const handleBaslat = (asamaId) => baslat.mutate({ asamaId })
  const handleTamamla = (asamaId) => tamamla.mutate({ asamaId })
  const handleAtla = (asamaId) => atla.mutate({ asamaId })

  if (isLoading) {
    return <div className="p-5 text-gray-400">Yukleniyor...</div>
  }

  if (!ilerleme || ilerleme.asamalar.length === 0) {
    return <SablonAtamaPanel projeId={projeId} />
  }

  return (
    <div className="p-4">
      <IlerlemeBar ilerleme={ilerleme} />
      <div className="mt-2">
        {ilerleme.asamalar.map((asama, i) => (
          <AsamaKarti
            key={asama.id}
            asama={asama}
            isLast={i === ilerleme.asamalar.length - 1}
            onBaslat={handleBaslat}
            onTamamla={handleTamamla}
            onAtla={handleAtla}
          />
        ))}
      </div>
    </div>
  )
}
