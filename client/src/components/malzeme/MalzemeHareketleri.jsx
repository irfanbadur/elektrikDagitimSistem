import { useState } from 'react'
import {
  Plus,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  RotateCcw,
  Flame,
  ArrowRightLeft,
  Save,
  Loader2,
} from 'lucide-react'
import {
  useMalzemeler,
  useMalzemeHareketleri,
  useMalzemeHareketOlustur,
} from '@/hooks/useMalzeme'
import { useEkipler } from '@/hooks/useEkipler'
import { useProjeler } from '@/hooks/useProjeler'
import DataTable from '@/components/shared/DataTable'
import { formatTarih, formatSayi } from '@/utils/formatters'
import { cn } from '@/lib/utils'

const HAREKET_TIPLERI = {
  cikis: { label: 'Cikis', color: 'bg-red-100 text-red-700', icon: ArrowUpCircle },
  giris: { label: 'Giris', color: 'bg-green-100 text-green-700', icon: ArrowDownCircle },
  iade: { label: 'Iade', color: 'bg-blue-100 text-blue-700', icon: RotateCcw },
  fire: { label: 'Fire', color: 'bg-orange-100 text-orange-700', icon: Flame },
  transfer: { label: 'Transfer', color: 'bg-purple-100 text-purple-700', icon: ArrowRightLeft },
}

const bosForm = {
  malzeme_id: '',
  miktar: '',
  hareket_tipi: 'cikis',
  ekip_id: '',
  proje_id: '',
  teslim_alan: '',
  teslim_eden: '',
  belge_no: '',
  notlar: '',
}

export default function MalzemeHareketleri() {
  const [formAcik, setFormAcik] = useState(false)
  const [form, setForm] = useState(bosForm)

  const { data: hareketler, isLoading } = useMalzemeHareketleri()
  const { data: malzemeler } = useMalzemeler()
  const { data: ekipler } = useEkipler()
  const { data: projeler } = useProjeler()
  const hareketOlustur = useMalzemeHareketOlustur()

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.malzeme_id || !form.miktar || !form.hareket_tipi) return

    try {
      await hareketOlustur.mutateAsync({
        ...form,
        miktar: Number(form.miktar),
        malzeme_id: Number(form.malzeme_id),
        ekip_id: form.ekip_id ? Number(form.ekip_id) : null,
        proje_id: form.proje_id ? Number(form.proje_id) : null,
      })
      setForm(bosForm)
      setFormAcik(false)
    } catch {
      // Hata hook tarafindan yonetilir
    }
  }

  const columns = [
    {
      accessorKey: 'tarih',
      header: 'Tarih',
      cell: ({ getValue }) => (
        <span className="text-sm">{formatTarih(getValue())}</span>
      ),
    },
    {
      accessorKey: 'malzeme_adi',
      header: 'Malzeme',
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue()}</span>
      ),
    },
    {
      accessorKey: 'miktar',
      header: 'Miktar',
      cell: ({ row }) => {
        const tip = row.original.hareket_tipi
        const isNegative = tip === 'cikis' || tip === 'fire'
        return (
          <span
            className={cn(
              'font-medium',
              isNegative ? 'text-red-600' : 'text-green-600'
            )}
          >
            {isNegative ? '-' : '+'}
            {formatSayi(row.original.miktar)}
          </span>
        )
      },
    },
    {
      accessorKey: 'hareket_tipi',
      header: 'Hareket Tipi',
      cell: ({ getValue }) => {
        const tip = HAREKET_TIPLERI[getValue()]
        if (!tip) return getValue()
        const Icon = tip.icon
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
              tip.color
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {tip.label}
          </span>
        )
      },
    },
    {
      accessorKey: 'ekip_adi',
      header: 'Ekip',
      cell: ({ getValue }) => getValue() || '-',
    },
    {
      accessorKey: 'proje_no',
      header: 'Proje',
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{getValue() || '-'}</span>
      ),
    },
    {
      accessorKey: 'teslim_alan',
      header: 'Teslim Alan',
      cell: ({ getValue }) => getValue() || '-',
    },
    {
      accessorKey: 'belge_no',
      header: 'Belge No',
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{getValue() || '-'}</span>
      ),
    },
  ]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Malzeme Hareketleri</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stok giris, cikis ve transfer islemlerini yonetin
          </p>
        </div>
        <button
          onClick={() => setFormAcik(!formAcik)}
          className={cn(
            'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
            formAcik
              ? 'border border-input bg-background text-foreground hover:bg-muted'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          )}
        >
          {formAcik ? (
            <>
              <X className="h-4 w-4" />
              Vazgec
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Yeni Hareket
            </>
          )}
        </button>
      </div>

      {formAcik && (
        <div className="mb-6 rounded-lg border border-input bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Yeni Malzeme Hareketi</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Malzeme Secimi */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Malzeme <span className="text-red-500">*</span>
                </label>
                <select
                  name="malzeme_id"
                  value={form.malzeme_id}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Malzeme secin</option>
                  {malzemeler?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.malzeme_kodu} - {m.malzeme_adi}
                    </option>
                  ))}
                </select>
              </div>

              {/* Hareket Tipi */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Hareket Tipi <span className="text-red-500">*</span>
                </label>
                <select
                  name="hareket_tipi"
                  value={form.hareket_tipi}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {Object.entries(HAREKET_TIPLERI).map(([key, { label }]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Miktar */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Miktar <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="miktar"
                  value={form.miktar}
                  onChange={handleChange}
                  required
                  min="0.01"
                  step="0.01"
                  placeholder="0"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Ekip */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Ekip</label>
                <select
                  name="ekip_id"
                  value={form.ekip_id}
                  onChange={handleChange}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Ekip secin</option>
                  {ekipler?.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.ekip_adi}
                    </option>
                  ))}
                </select>
              </div>

              {/* Proje */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Proje</label>
                <select
                  name="proje_id"
                  value={form.proje_id}
                  onChange={handleChange}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Proje secin</option>
                  {projeler?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.proje_no} - {p.proje_adi}
                    </option>
                  ))}
                </select>
              </div>

              {/* Belge No */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Belge No</label>
                <input
                  type="text"
                  name="belge_no"
                  value={form.belge_no}
                  onChange={handleChange}
                  placeholder="Irsaliye / fatura no"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Teslim Eden */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Teslim Eden
                </label>
                <input
                  type="text"
                  name="teslim_eden"
                  value={form.teslim_eden}
                  onChange={handleChange}
                  placeholder="Teslim eden kisi"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Teslim Alan */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Teslim Alan
                </label>
                <input
                  type="text"
                  name="teslim_alan"
                  value={form.teslim_alan}
                  onChange={handleChange}
                  placeholder="Teslim alan kisi"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Notlar */}
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1.5 block text-sm font-medium">Notlar</label>
                <textarea
                  name="notlar"
                  value={form.notlar}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Ek aciklama..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setForm(bosForm)
                  setFormAcik(false)
                }}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Iptal
              </button>
              <button
                type="submit"
                disabled={hareketOlustur.isPending}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {hareketOlustur.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Kaydet
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-12 w-full rounded" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={hareketler || []}
          searchPlaceholder="Hareket ara..."
        />
      )}
    </div>
  )
}
