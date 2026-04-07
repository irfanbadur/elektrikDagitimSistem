import { useState, useCallback, useEffect } from 'react'
import { AlertTriangle, Package, ArrowRightLeft, Trash2, CheckSquare, FileSpreadsheet, Loader2, ExternalLink } from 'lucide-react'
import api from '@/api/client'
import { useDepoStok, useDepoStokTopluSil } from '@/hooks/useDepolar'
import { useAuth } from '@/context/AuthContext'
import DataTable from '@/components/shared/DataTable'
import { MALZEME_KATEGORILERI } from '@/utils/constants'
import { formatSayi, formatParaBirimi } from '@/utils/formatters'
import { cn } from '@/lib/utils'

export default function DepoStok({ depoId, depoAdi, onTransfer }) {
  const [kategori, setKategori] = useState('')
  const { data: stoklar, isLoading } = useDepoStok(depoId)
  const topluSil = useDepoStokTopluSil(depoId)
  const { kullanici, izinVar } = useAuth()
  const isAdmin = kullanici?.kullanici_adi === 'admin' || izinVar('malzeme', 'silme')
  const [seciliIdler, setSeciliIdler] = useState(new Set())
  const [excelYukleniyor, setExcelYukleniyor] = useState(false)
  const [excelSonuc, setExcelSonuc] = useState(null)

  const handleExcelAktar = async () => {
    setExcelYukleniyor(true)
    try {
      const r = await api.post(`/depolar/${depoId}/excel-aktar`)
      setExcelSonuc(r?.data || r)
    } catch (err) {
      alert(err.message || 'Excel oluşturma hatası')
    } finally {
      setExcelYukleniyor(false)
    }
  }

  // Depo değişince seçimi temizle
  useEffect(() => { setSeciliIdler(new Set()) }, [depoId])

  const secimDegistir = useCallback((id) => {
    setSeciliIdler(prev => {
      const yeni = new Set(prev)
      yeni.has(id) ? yeni.delete(id) : yeni.add(id)
      return yeni
    })
  }, [])

  const tumunuSec = useCallback(() => {
    const gosterilen = (kategori ? stoklar?.filter(s => s.kategori === kategori) : stoklar) || []
    if (seciliIdler.size === gosterilen.length && gosterilen.length > 0) {
      setSeciliIdler(new Set())
    } else {
      setSeciliIdler(new Set(gosterilen.map(s => s.id)))
    }
  }, [stoklar, kategori, seciliIdler.size])

  const handleTopluSil = () => {
    if (seciliIdler.size === 0) return
    if (!window.confirm(`${seciliIdler.size} stok satırını silmek istediğinize emin misiniz?`)) return
    topluSil.mutate([...seciliIdler], { onSuccess: () => setSeciliIdler(new Set()) })
  }

  const filtrelenmis = kategori
    ? stoklar?.filter((s) => s.kategori === kategori)
    : stoklar

  // Sadece stoğu olan veya hepsini göster
  const gosterilecek = filtrelenmis || []

  const toplamDeger = gosterilecek.reduce(
    (t, s) => t + (s.miktar || 0) * (s.birim_fiyat || 0),
    0
  )
  const toplamCesit = gosterilecek.length
  const kritikSayisi = gosterilecek.filter(
    (s) => s.kritik_seviye > 0 && s.miktar <= s.kritik_seviye
  ).length

  const columns = [
    ...(isAdmin ? [{
      id: 'secim',
      header: () => (
        <input
          type="checkbox"
          checked={gosterilecek.length > 0 && seciliIdler.size === gosterilecek.length}
          ref={el => { if (el) el.indeterminate = seciliIdler.size > 0 && seciliIdler.size < gosterilecek.length }}
          onChange={tumunuSec}
          className="rounded border-input accent-primary"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={seciliIdler.has(row.original.id)}
          onChange={() => secimDegistir(row.original.id)}
          className="rounded border-input accent-primary"
        />
      ),
      size: 40,
    }] : []),
    {
      accessorKey: 'malzeme_kodu',
      header: 'Kod',
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{getValue()}</span>
      ),
    },
    {
      accessorKey: 'malzeme_adi',
      header: 'Malzeme Adi',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.kritik_seviye > 0 &&
            row.original.miktar <= row.original.kritik_seviye && (
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
            )}
          <span className="font-medium">{row.original.malzeme_adi}</span>
        </div>
      ),
    },
    {
      accessorKey: 'kategori',
      header: 'Kategori',
      cell: ({ getValue }) => (
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
          {MALZEME_KATEGORILERI[getValue()] || getValue()}
        </span>
      ),
    },
    {
      accessorKey: 'birim',
      header: 'Birim',
    },
    {
      accessorKey: 'miktar',
      header: 'Stok',
      cell: ({ row }) => {
        const kritik =
          row.original.kritik_seviye > 0 &&
          row.original.miktar <= row.original.kritik_seviye
        return (
          <span
            className={cn(
              'font-medium',
              kritik ? 'text-red-600' : 'text-foreground'
            )}
          >
            {formatSayi(row.original.miktar)} {row.original.birim}
          </span>
        )
      },
    },
    {
      accessorKey: 'birim_fiyat',
      header: 'Birim Fiyat',
      cell: ({ getValue }) => formatParaBirimi(getValue()),
    },
    {
      accessorKey: 'raf_konumu',
      header: 'Raf/Konum',
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">
          {getValue() || '-'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        onTransfer && (
          <button
            onClick={() =>
              onTransfer({
                malzeme_id: row.original.malzeme_id,
                malzeme_adi: row.original.malzeme_adi,
                mevcut_miktar: row.original.miktar,
              })
            }
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50"
            title="Transfer"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Transfer
          </button>
        ),
    },
  ]

  return (
    <div>
      {/* Ozet Kartlari */}
      <div className="mb-4 mt-2 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-input bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="h-4 w-4" />
            Malzeme Cesidi
          </div>
          <p className="mt-1 text-2xl font-bold">{toplamCesit}</p>
        </div>
        <div className="rounded-lg border border-input bg-card p-4">
          <div className="text-sm text-muted-foreground">Toplam Deger</div>
          <p className="mt-1 text-2xl font-bold">{formatParaBirimi(toplamDeger)}</p>
        </div>
        <div className="rounded-lg border border-input bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Kritik Stok
          </div>
          <p className={cn('mt-1 text-2xl font-bold', kritikSayisi > 0 && 'text-red-600')}>
            {kritikSayisi}
          </p>
        </div>
      </div>

      {/* Filtreler ve toplu işlem */}
      <div className="mb-4 flex items-center gap-3">
        <select
          value={kategori}
          onChange={(e) => setKategori(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Tum Kategoriler</option>
          {Object.entries(MALZEME_KATEGORILERI).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        {kategori && (
          <button
            onClick={() => setKategori('')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Filtreyi Temizle
          </button>
        )}
        <button onClick={handleExcelAktar} disabled={excelYukleniyor}
          className="flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors">
          {excelYukleniyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
          {excelYukleniyor ? 'Oluşturuluyor...' : 'Excel Aktar'}
        </button>
        {excelSonuc && (
          <a href={`/api/dosya/${excelSonuc.dosya_id}/indir`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 rounded-md border border-input px-3 py-2 text-sm text-primary hover:bg-primary/5">
            <ExternalLink className="h-4 w-4" />İndir
          </a>
        )}
        {isAdmin && seciliIdler.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="flex items-center gap-1 text-sm font-medium text-primary">
              <CheckSquare className="h-4 w-4" />
              {seciliIdler.size} satir secildi
            </span>
            <button
              onClick={() => setSeciliIdler(new Set())}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              Temizle
            </button>
            <button
              onClick={handleTopluSil}
              disabled={topluSil.isPending}
              className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {topluSil.isPending ? 'Siliniyor...' : `Sil (${seciliIdler.size})`}
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-12 w-full rounded" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={gosterilecek}
          searchPlaceholder={`${depoAdi} icinde ara...`}
        />
      )}
    </div>
  )
}
