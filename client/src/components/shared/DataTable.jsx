import { useState, useRef, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, ChevronDown, Columns3, Check } from 'lucide-react'
import SearchInput from './SearchInput'
import { cn } from '@/lib/utils'

const SAYFA_BOYUTU_SECENEKLERI = [10, 25, 50, 100, 250]

function SutunSecici({ table }) {
  const [acik, setAcik] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setAcik(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const allColumns = table.getAllLeafColumns().filter((c) => c.id !== 'actions' && c.id !== 'secim')
  const visibleCount = allColumns.filter((c) => c.getIsVisible()).length

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAcik(!acik)}
        className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
          acik
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-input bg-background text-foreground hover:bg-muted'
        )}
      >
        <Columns3 className="h-4 w-4" />
        Sutunlar
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
          {visibleCount}/{allColumns.length}
        </span>
      </button>

      {acik && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-border bg-white shadow-xl ring-1 ring-black/5">
          <div className="flex items-center justify-between border-b border-input px-3 py-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Gorunur Sutunlar</span>
            <div className="flex gap-1">
              <button
                onClick={() => table.toggleAllColumnsVisible(true)}
                className="rounded px-1.5 py-0.5 text-xs text-primary hover:bg-primary/10"
              >
                Tumu
              </button>
              <button
                onClick={() => {
                  allColumns.forEach((c, i) => c.toggleVisibility(i === 0))
                }}
                className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
              >
                Sifirla
              </button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {allColumns.map((column) => (
              <button
                key={column.id}
                onClick={() => column.toggleVisibility()}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  column.getIsVisible()
                    ? 'text-foreground hover:bg-muted'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <div
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                    column.getIsVisible()
                      ? 'border-primary bg-primary text-white'
                      : 'border-input bg-background'
                  )}
                >
                  {column.getIsVisible() && <Check className="h-3 w-3" />}
                </div>
                {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function DataTable({ columns, data = [], searchable = true, searchPlaceholder = 'Ara...', pagination = true, pageSize = 25, onRowDoubleClick, columnToggle = true, stickyHeader = false, rowNumber = false }) {
  const [sorting, setSorting] = useState([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnVisibility, setColumnVisibility] = useState({})

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: pagination ? getPaginationRowModel() : undefined,
    initialState: { pagination: { pageSize } },
  })

  const toplamKayit = table.getFilteredRowModel().rows.length
  const sayfaBoyutu = table.getState().pagination.pageSize
  const sayfaNo = table.getState().pagination.pageIndex + 1
  const toplamSayfa = table.getPageCount()

  return (
    <div>
      {/* Toolbar: Arama + Sutun secici */}
      {(searchable || columnToggle) && (
        <div className="mb-4 flex items-center gap-3">
          {searchable && (
            <div className="max-w-sm flex-1">
              <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder={searchPlaceholder} />
            </div>
          )}
          {columnToggle && (
            <SutunSecici table={table} />
          )}
        </div>
      )}

      <div className={cn("rounded-lg border border-border bg-card shadow-sm", stickyHeader ? "overflow-auto" : "overflow-x-auto")} style={stickyHeader ? { maxHeight: 'calc(100vh - 220px)' } : undefined}>
        <table className="w-full text-sm">
          <thead className={stickyHeader ? "sticky top-0 z-10" : ""}>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className={cn("border-b-2 border-border", stickyHeader ? "bg-muted/95 backdrop-blur-sm" : "bg-muted/70")}>
                {rowNumber && <th className="w-10 px-3 py-3.5 text-center text-xs font-semibold text-muted-foreground">#</th>}
                {hg.headers.map((header) => {
                  const meta = header.column.columnDef.meta || {}
                  const thClass = meta.thClassName ?? 'px-4 py-3.5 text-left'
                  return (
                    <th
                      key={header.id}
                      className={cn(thClass, 'text-xs font-semibold uppercase tracking-wider text-muted-foreground')}
                      style={meta.thStyle}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={header.column.getCanSort() ? 'flex cursor-pointer select-none items-center gap-1' : ''}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            header.column.getIsSorted() === 'asc' ? <ChevronUp className="h-4 w-4" /> :
                            header.column.getIsSorted() === 'desc' ? <ChevronDown className="h-4 w-4" /> :
                            <ChevronsUpDown className="h-4 w-4 opacity-50" />
                          )}
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground">Kayit bulunamadi</td></tr>
            ) : (
              table.getRowModel().rows.map((row, i) => (
                <tr
                  key={row.id}
                  onDoubleClick={() => onRowDoubleClick?.(row.original)}
                  className={`border-b border-border/60 last:border-0 transition-colors ${
                    i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                  } hover:bg-primary/5 ${onRowDoubleClick ? 'cursor-pointer' : ''}`}
                >
                  {rowNumber && <td className="px-3 py-3.5 text-center text-xs text-muted-foreground">{i + 1}</td>}
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta || {}
                    return (
                      <td
                        key={cell.id}
                        className={meta.tdClassName ?? 'px-4 py-3.5'}
                        style={meta.tdStyle}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && toplamKayit > 0 && (
        <div className="mt-3 flex items-center justify-between rounded-b-lg border-t border-border/50 bg-muted/30 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Sayfa basina:</span>
              <select
                value={sayfaBoyutu}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="rounded border border-input bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {SAYFA_BOYUTU_SECENEKLERI.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <span className="text-xs text-muted-foreground">
              Toplam {toplamKayit} kayit
            </span>
          </div>
          {toplamSayfa > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                className="rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Ilk
              </button>
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 py-1 text-xs font-medium">
                {sayfaNo} / {toplamSayfa}
              </span>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => table.setPageIndex(toplamSayfa - 1)}
                disabled={!table.getCanNextPage()}
                className="rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Son
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
