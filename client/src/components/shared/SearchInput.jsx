import { Search, X } from 'lucide-react'

export default function SearchInput({ value, onChange, placeholder = 'Ara...' }) {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-input bg-white py-2.5 pl-3 pr-16 text-sm shadow-sm outline-none transition-shadow focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-9 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      )}
      <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}
