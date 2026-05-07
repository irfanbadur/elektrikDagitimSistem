import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Briefcase, Pencil, Users, MapPin, Layers, FileText } from 'lucide-react'
import MainLayout from '@/components/layout/MainLayout'
import {
  useIhale, useIhaleProjeleri, useIhaleBolgeDagilimi,
  useIhaleEkipDagilimi, useIhaleAsamaDagilimi,
} from '@/hooks/useIhaleler'
import IhaleForm from '@/components/ihaleler/IhaleForm'
import { cn } from '@/lib/utils'

const tl = (n) => (Number(n) || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })

function YuzdeBari({ yuzde, renk = 'bg-emerald-500' }) {
  const y = Math.max(0, Math.min(100, Number(yuzde) || 0))
  return (
    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', renk)} style={{ width: `${y}%` }} />
    </div>
  )
}

function BilgiSatiri({ etiket, deger }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-border/40 py-1.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wide w-32 shrink-0">{etiket}</span>
      <span className="text-sm flex-1 break-words">{deger || '-'}</span>
    </div>
  )
}

export default function IhaleDetayPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: ihale, isLoading } = useIhale(id)
  const { data: projeler } = useIhaleProjeleri(id)
  const { data: bolgeler } = useIhaleBolgeDagilimi(id)
  const { data: ekipler } = useIhaleEkipDagilimi(id)
  const { data: asamalar } = useIhaleAsamaDagilimi(id)
  const [duzenleAcik, setDuzenleAcik] = useState(false)
  const [aktifSekme, setAktifSekme] = useState('projeler')

  if (isLoading) return <MainLayout title="İhale"><div className="skeleton h-64 rounded-lg" /></MainLayout>
  if (!ihale) return <MainLayout title="İhale"><p>Bulunamadı.</p></MainLayout>

  const sekmeler = [
    { id: 'projeler',  label: `Projeler (${projeler?.length || 0})`, ikon: FileText },
    { id: 'bolge',     label: 'Bölge Dağılımı', ikon: MapPin },
    { id: 'ekip',      label: 'Ekip Yükü', ikon: Users },
    { id: 'asama',     label: 'Aşama Dağılımı', ikon: Layers },
  ]

  return (
    <MainLayout title={ihale.ihale_adi}>
      <div className="space-y-5">
        <Link to="/ihaleler" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> İhaleler
        </Link>

        {/* Bilgi Kartı */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">{ihale.ihale_adi}</h1>
            </div>
            <button onClick={() => setDuzenleAcik(true)}
              className="flex items-center gap-1.5 rounded border border-input px-3 py-1.5 text-sm hover:bg-muted">
              <Pencil className="h-3.5 w-3.5" /> Düzenle
            </button>
          </div>

          <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
            <BilgiSatiri etiket="İş Adı" deger={ihale.is_adi} />
            <BilgiSatiri etiket="Sözleşme No" deger={ihale.sozlesme_no} />
            <BilgiSatiri etiket="İl" deger={ihale.il} />
            <BilgiSatiri etiket="İlçe" deger={ihale.ilce} />
            <BilgiSatiri etiket="Yüklenici" deger={ihale.yuklenici} />
            <BilgiSatiri etiket="Sözleşme Bedeli" deger={`${tl(ihale.sozlesme_bedeli)} ₺`} />
            <BilgiSatiri etiket="Artırım Oranı" deger={`%${ihale.artirim_orani || 0}`} />
            <BilgiSatiri etiket="Durum" deger={ihale.durum} />
            <BilgiSatiri etiket="Başlangıç" deger={ihale.baslangic_tarihi?.slice(0, 10)} />
            <BilgiSatiri etiket="Bitiş" deger={ihale.bitis_tarihi?.slice(0, 10)} />
            <BilgiSatiri etiket="İş Tipleri" deger={(ihale.is_tipi_kodlari || []).join(', ')} />
            <BilgiSatiri etiket="Proje Sayısı" deger={ihale.proje_sayisi} />
          </div>
          {ihale.notlar && <BilgiSatiri etiket="Notlar" deger={ihale.notlar} />}
        </div>

        {/* KPI'lar */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted-foreground">Sözleşme Keşfi</span>
                <span className="font-medium">%{(((ihale.toplam_sozlesme || 0) / (ihale.sozlesme_bedeli || 1)) * 100).toFixed(1)}</span>
              </div>
              <div className="mb-1 text-base font-semibold tabular-nums text-slate-700">{tl(ihale.toplam_sozlesme)} ₺</div>
              <YuzdeBari yuzde={((ihale.toplam_sozlesme || 0) / (ihale.sozlesme_bedeli || 1)) * 100} renk="bg-slate-500" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted-foreground">Üretilen Keşif</span>
                <span className="font-medium text-blue-700">%{ihale.kesif_yuzdesi.toFixed(1)}</span>
              </div>
              <div className="mb-1 text-base font-semibold tabular-nums text-blue-700">{tl(ihale.toplam_kesif)} ₺</div>
              <YuzdeBari yuzde={ihale.kesif_yuzdesi} renk="bg-blue-500" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted-foreground">Hak Ediş İlerleme</span>
                <span className="font-medium text-emerald-700">%{ihale.ilerleme_yuzdesi.toFixed(1)}</span>
              </div>
              <div className="mb-1 text-base font-semibold tabular-nums text-emerald-700">{tl(ihale.toplam_ilerleme)} ₺</div>
              <YuzdeBari yuzde={ihale.ilerleme_yuzdesi} renk="bg-emerald-500" />
              <div className="mt-1 text-[11px] text-muted-foreground">Kalan: {tl(ihale.kalan_tutar)} ₺</div>
            </div>
          </div>
        </div>

        {/* Sekmeler */}
        <div>
          <div className="border-b border-border flex gap-1 overflow-x-auto">
            {sekmeler.map(s => (
              <button key={s.id} onClick={() => setAktifSekme(s.id)}
                className={cn('flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap',
                  aktifSekme === s.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground')}>
                <s.ikon className="h-3.5 w-3.5" /> {s.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {aktifSekme === 'projeler' && <ProjelerListesi projeler={projeler} navigate={navigate} />}
            {aktifSekme === 'bolge' && <DagilimTablosu data={bolgeler} alanAdi="bolge_adi" baslik="Bölge" />}
            {aktifSekme === 'ekip' && <EkipDagilimi data={ekipler} />}
            {aktifSekme === 'asama' && <AsamaDagilimi data={asamalar} />}
          </div>
        </div>
      </div>

      {duzenleAcik && <IhaleForm ihale={ihale} onClose={() => setDuzenleAcik(false)} />}
    </MainLayout>
  )
}

function ProjelerListesi({ projeler, navigate }) {
  if (!projeler?.length) return <p className="text-sm text-muted-foreground">Bağlı proje yok.</p>
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left">Proje No</th>
            <th className="px-3 py-2 text-left">Tür</th>
            <th className="px-3 py-2 text-left">Müşteri / Ad</th>
            <th className="px-3 py-2 text-left">Bölge</th>
            <th className="px-3 py-2 text-left">Ekip</th>
            <th className="px-3 py-2 text-right">Keşif</th>
            <th className="px-3 py-2 text-right">İlerleme</th>
          </tr>
        </thead>
        <tbody>
          {projeler.map(p => (
            <tr key={p.id} className="border-t border-border/40 hover:bg-muted/30 cursor-pointer"
              onClick={() => navigate(`/projeler/${p.id}`)}>
              <td className="px-3 py-1.5 font-medium text-primary">{p.proje_no}</td>
              <td className="px-3 py-1.5"><span className="rounded bg-gray-100 px-2 py-0.5 text-xs">{p.proje_tipi}</span></td>
              <td className="px-3 py-1.5 truncate max-w-[280px]">{p.musteri_adi || '-'}</td>
              <td className="px-3 py-1.5 text-xs">{p.bolge_adi || '-'}</td>
              <td className="px-3 py-1.5 text-xs">{p.ekip_adi || '-'}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-blue-700">{tl(p.kesif_tutari)} ₺</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700">{tl(p.ilerleme_miktari)} ₺</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DagilimTablosu({ data, alanAdi, baslik }) {
  if (!data?.length) return <p className="text-sm text-muted-foreground">Veri yok.</p>
  const enYuksekKesif = Math.max(...data.map(d => d.toplam_kesif || 0))
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left">{baslik}</th>
            <th className="px-3 py-2 text-right">Proje</th>
            <th className="px-3 py-2 text-right">Sözleşme</th>
            <th className="px-3 py-2 text-right">Keşif</th>
            <th className="px-3 py-2 text-right">İlerleme</th>
            <th className="px-3 py-2">Bar</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i} className="border-t border-border/40">
              <td className="px-3 py-1.5">{d[alanAdi]}</td>
              <td className="px-3 py-1.5 text-right">{d.proje_sayisi || d.aktif_proje}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{tl(d.toplam_sozlesme)} ₺</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-blue-700">{tl(d.toplam_kesif)} ₺</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700">{tl(d.toplam_ilerleme)} ₺</td>
              <td className="px-3 py-1.5 w-32">
                <YuzdeBari yuzde={enYuksekKesif > 0 ? ((d.toplam_kesif || 0) / enYuksekKesif) * 100 : 0} renk="bg-blue-400" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EkipDagilimi({ data }) {
  if (!data?.length) return <p className="text-sm text-muted-foreground">Veri yok.</p>
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left">Ekip</th>
            <th className="px-3 py-2 text-right">Toplam Proje</th>
            <th className="px-3 py-2 text-right">Aktif</th>
            <th className="px-3 py-2 text-right">Keşif</th>
            <th className="px-3 py-2 text-right">İlerleme</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i} className="border-t border-border/40">
              <td className="px-3 py-1.5 font-medium">{d.ekip_adi}</td>
              <td className="px-3 py-1.5 text-right">{d.proje_sayisi}</td>
              <td className="px-3 py-1.5 text-right">{d.aktif_proje}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-blue-700">{tl(d.toplam_kesif)} ₺</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700">{tl(d.toplam_ilerleme)} ₺</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AsamaDagilimi({ data }) {
  if (!data) return null
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border border-border p-4">
        <h3 className="mb-3 text-sm font-semibold">Proje (Çizim) Aşamaları</h3>
        <ul className="space-y-1.5">
          {data.proje?.map((d, i) => (
            <li key={i} className="flex justify-between text-sm border-b border-border/30 py-1">
              <span>{d.asama}</span>
              <span className="font-medium tabular-nums">{d.sayi}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-border p-4">
        <h3 className="mb-3 text-sm font-semibold">Saha Aşamaları</h3>
        <ul className="space-y-1.5">
          {data.saha?.map((d, i) => (
            <li key={i} className="flex justify-between text-sm border-b border-border/30 py-1">
              <span>{d.asama}</span>
              <span className="font-medium tabular-nums">{d.sayi}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
