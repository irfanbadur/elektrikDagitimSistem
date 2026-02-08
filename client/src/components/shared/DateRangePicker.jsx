export default function DateRangePicker({ startDate, endDate, onStartChange, onEndChange }) {
  return (
    <div className="flex items-center gap-2">
      <input type="date" value={startDate || ''} onChange={(e) => onStartChange(e.target.value)} className="rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
      <span className="text-muted-foreground">-</span>
      <input type="date" value={endDate || ''} onChange={(e) => onEndChange(e.target.value)} className="rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
    </div>
  )
}
