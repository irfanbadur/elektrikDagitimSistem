import { useState } from 'react'
import {
  useProjeFazIlerleme,
  useProjeFazAta,
  useAdimBaslat,
  useAdimTamamla,
  useAdimAtla,
} from '@/hooks/useDongu'
import { useIsTipleri } from '@/hooks/useIsTipleri'
import { cn } from '@/lib/utils'

// ─── DURUM STİLLERİ ────────────────────────────
const DURUM_STILLER = {
  bekliyor:     { bg: 'bg-gray-100',   border: 'border-gray-300',  text: 'text-gray-500',   label: 'Bekliyor',       ikon: '\u23F3' },
  devam_ediyor: { bg: 'bg-blue-100',   border: 'border-blue-500',  text: 'text-blue-700',   label: 'Devam Ediyor',   ikon: '\uD83D\uDD04' },
  tamamlandi:   { bg: 'bg-green-100',  border: 'border-green-500', text: 'text-green-700',  label: 'Tamamland\u0131',ikon: '\u2705' },
  atlandi:      { bg: 'bg-yellow-100', border: 'border-yellow-500',text: 'text-yellow-700', label: 'Atland\u0131',   ikon: '\u23ED\uFE0F' },
}

function getDurumStil(durum) {
  return DURUM_STILLER[durum] || DURUM_STILLER.bekliyor
}

// ─── İLERLEME ÇUBUĞU ───────────────────────────
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
        {ilerleme.tamamlanan}/{ilerleme.toplam_adim} adim tamamlandi
        {ilerleme.aktif_faz && ` \u2022 Aktif faz: ${ilerleme.aktif_faz}`}
        {ilerleme.aktif_adim && ` \u2022 ${ilerleme.aktif_adim}`}
      </div>
    </div>
  )
}

// ─── ADIM KARTI ─────────────────────────────────
function AdimKarti({ adim, onBaslat, onTamamla, onAtla }) {
  const stil = getDurumStil(adim.durum)
  const aktif = adim.durum === 'devam_ediyor'

  let gecenGun = null
  if (adim.baslangic_tarihi) {
    const bas = new Date(adim.baslangic_tarihi)
    const bit = adim.bitis_tarihi ? new Date(adim.bitis_tarihi) : new Date()
    gecenGun = Math.ceil((bit - bas) / (1000 * 60 * 60 * 24))
  }

  return (
    <div
      className={cn(
        'ml-6 rounded-lg p-2.5 mb-1.5 border transition-all',
        aktif ? cn(stil.bg, stil.border) : 'bg-white border-gray-200 hover:border-gray-300'
      )}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-mono">{adim.adim_sira}.</span>
          <span className={cn('text-sm font-medium', aktif ? stil.text : 'text-gray-700')}>
            {adim.adim_adi}
          </span>
        </div>
        <span
          className={cn(
            'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
            stil.bg, stil.text, stil.border
          )}
        >
          {stil.ikon} {stil.label}
        </span>
      </div>

      {/* Tarih bilgisi */}
      <div className="mt-1 text-[11px] text-gray-500">
        {adim.baslangic_tarihi && <span>{adim.baslangic_tarihi}</span>}
        {adim.bitis_tarihi && <span> &rarr; {adim.bitis_tarihi}</span>}
        {gecenGun !== null && <span className="ml-1 text-gray-400">({gecenGun} gun)</span>}
        {!adim.baslangic_tarihi && adim.tahmini_gun && (
          <span className="text-gray-400">~{adim.tahmini_gun} gun</span>
        )}
      </div>

      {/* İstatistikler */}
      {(adim.paket_sayisi > 0 || adim.dosya_sayisi > 0) && (
        <div className="mt-1 text-[11px] text-gray-500 flex gap-2">
          {adim.paket_sayisi > 0 && <span>📦 {adim.paket_sayisi}</span>}
          {adim.dosya_sayisi > 0 && <span>📎 {adim.dosya_sayisi}</span>}
        </div>
      )}

      {/* Aksiyon butonları */}
      <div className="mt-1.5 flex gap-2">
        {adim.durum === 'bekliyor' && (
          <>
            <button
              onClick={() => onBaslat(adim.id)}
              className="px-2.5 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              ▶ Baslat
            </button>
            <button
              onClick={() => onAtla(adim.id)}
              className="px-2.5 py-0.5 text-xs bg-white text-gray-500 border border-gray-300 rounded hover:bg-gray-50"
            >
              Atla
            </button>
          </>
        )}
        {adim.durum === 'devam_ediyor' && (
          <button
            onClick={() => onTamamla(adim.id)}
            className="px-2.5 py-0.5 text-xs font-semibold bg-green-600 text-white rounded hover:bg-green-700"
          >
            Tamamla
          </button>
        )}
      </div>
    </div>
  )
}

// ─── FAZ GRUBU ──────────────────────────────────
function FazGrubu({ faz, isLast, onBaslat, onTamamla, onAtla }) {
  const tamamlanan = faz.adimlar.filter(a => a.durum === 'tamamlandi' || a.durum === 'atlandi').length
  const toplam = faz.adimlar.length
  const aktif = faz.adimlar.some(a => a.durum === 'devam_ediyor')
  const tamam = tamamlanan === toplam && toplam > 0

  return (
    <div className="flex items-stretch gap-3">
      {/* Sol — Timeline */}
      <div className="flex flex-col items-center w-10 flex-shrink-0">
        <div
          className={cn(
            'rounded-full flex items-center justify-center flex-shrink-0 border-[3px]',
            tamam ? 'bg-green-100 border-green-500' : aktif ? 'bg-blue-100 border-blue-500 ring-4 ring-blue-500/20' : 'bg-gray-100 border-gray-300',
            aktif ? 'w-9 h-9 text-base' : 'w-8 h-8 text-sm'
          )}
        >
          {faz.ikon}
        </div>
        {!isLast && (
          <div
            className={cn(
              'flex-1 w-0.5 min-h-[20px]',
              tamam ? 'bg-green-500' : 'bg-gray-200'
            )}
          />
        )}
      </div>

      {/* Sağ — Faz içeriği */}
      <div className="flex-1 mb-3">
        {/* Faz başlık */}
        <div
          className={cn(
            'rounded-xl p-3 border mb-1',
            aktif ? 'bg-blue-50 border-blue-300' : tamam ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
          )}
        >
          <div className="flex justify-between items-center">
            <div>
              <span className="text-[11px] text-gray-400 font-semibold">{faz.faz_sira}. FAZ</span>
              <div className="flex items-center gap-2">
                <span
                  className="text-[15px] font-semibold"
                  style={{ color: faz.renk }}
                >
                  {faz.faz_adi}
                </span>
                {faz.sorumlu_rol_adi && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {faz.sorumlu_rol_adi}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold" style={{ color: faz.renk }}>
                {tamamlanan}/{toplam}
              </span>
              <div className="h-1.5 w-16 bg-gray-200 rounded-full overflow-hidden mt-0.5">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${toplam ? (tamamlanan / toplam) * 100 : 0}%`, backgroundColor: faz.renk }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Adımlar */}
        {faz.adimlar.map(adim => (
          <AdimKarti
            key={adim.id}
            adim={adim}
            onBaslat={onBaslat}
            onTamamla={onTamamla}
            onAtla={onAtla}
          />
        ))}
      </div>
    </div>
  )
}

// ─── FAZ ATAMA PANELİ ──────────────────────────
function FazAtamaPanel({ projeId, projeTipi }) {
  const { data: tipler, isLoading } = useIsTipleri()
  const ata = useProjeFazAta()
  const [secili, setSecili] = useState('')

  // Proje tipine göre otomatik eşleş
  const otomatikTip = tipler?.find(t => t.kod.toUpperCase() === (projeTipi || '').toUpperCase())

  const handleAta = () => {
    const tipId = secili || otomatikTip?.id
    if (!tipId) return
    ata.mutate({ projeId: parseInt(projeId), isTipiId: parseInt(tipId) })
  }

  if (isLoading) return <div className="text-sm text-gray-400 p-4">Yukleniyor...</div>

  return (
    <div className="p-6 text-center">
      <p className="text-gray-400 mb-4">Bu projeye henuz yasam dongusu atanmamis.</p>
      {otomatikTip && (
        <p className="text-sm text-blue-600 mb-3">
          Proje tipine uygun: <strong>{otomatikTip.ad}</strong> ({otomatikTip.fazlar.length} faz)
        </p>
      )}
      <div className="flex items-center justify-center gap-3">
        <select
          value={secili}
          onChange={(e) => setSecili(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">{otomatikTip ? `${otomatikTip.ad} (otomatik)` : 'Is tipi sec...'}</option>
          {tipler?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.ad} ({t.fazlar.length} faz)
            </option>
          ))}
        </select>
        <button
          onClick={handleAta}
          disabled={!secili && !otomatikTip || ata.isPending}
          className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {ata.isPending ? 'Ataniyor...' : 'Yasam Dongusu Ata'}
        </button>
      </div>
      {ata.isError && (
        <p className="mt-2 text-sm text-red-500">{ata.error.message}</p>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════
// ANA BİLEŞEN
// ═══════════════════════════════════════════════
export default function ProjeDongu({ projeId, projeTipi }) {
  const { data: ilerleme, isLoading } = useProjeFazIlerleme(projeId)
  const baslat = useAdimBaslat()
  const tamamla = useAdimTamamla()
  const atla = useAdimAtla()

  const handleBaslat = (adimId) => baslat.mutate({ adimId })
  const handleTamamla = (adimId) => tamamla.mutate({ adimId })
  const handleAtla = (adimId) => atla.mutate({ adimId })

  if (isLoading) {
    return <div className="p-5 text-gray-400">Yukleniyor...</div>
  }

  // Eğer yeni faz sistemi verisi yoksa, eski sisteme fallback
  if (!ilerleme || ilerleme.toplam_adim === 0) {
    return <FazAtamaPanel projeId={projeId} projeTipi={projeTipi} />
  }

  // Adımları faz bazlı grupla
  const fazGruplari = []
  const fazMap = new Map()

  for (const adim of ilerleme.adimlar) {
    const key = `${adim.faz_sira}-${adim.faz_kodu}`
    if (!fazMap.has(key)) {
      const fGrup = {
        faz_sira: adim.faz_sira,
        faz_adi: adim.faz_adi,
        faz_kodu: adim.faz_kodu,
        renk: adim.renk,
        ikon: adim.ikon,
        sorumlu_rol_adi: adim.sorumlu_rol_adi,
        adimlar: []
      }
      fazMap.set(key, fGrup)
      fazGruplari.push(fGrup)
    }
    fazMap.get(key).adimlar.push(adim)
  }

  return (
    <div className="p-4">
      <IlerlemeBar ilerleme={ilerleme} />
      <div className="mt-2">
        {fazGruplari.map((faz, i) => (
          <FazGrubu
            key={faz.faz_kodu}
            faz={faz}
            isLast={i === fazGruplari.length - 1}
            onBaslat={handleBaslat}
            onTamamla={handleTamamla}
            onAtla={handleAtla}
          />
        ))}
      </div>
    </div>
  )
}
