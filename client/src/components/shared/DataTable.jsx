import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import SearchInput from './SearchInput'

export default function DataTable({ columns, data = [], searchable = true, searchPlaceholder = 'Ara...', pagination = true, pageSize = 10 }) {
  const [sorting, setSorting] = useState([])
  const [globalFilter, setGlobalFilter] = useState('')

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: pagination ? getPaginationRowModel() : undefined,
    initialState: { pagination: { pageSize } },
  })

  return (
    <div>
      {searchable && (
        <div className="mb-4 max-w-sm">
          <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder={searchPlaceholder} />
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border bg-muted/50">
                {hg.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 text-left font-medium text-muted-foreground">
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
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">Kayıt bulunamadı</td></tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pagination && table.getPageCount() > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Toplam {table.getFilteredRowModel().rows.length} kayıt
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm">
              Sayfa {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
