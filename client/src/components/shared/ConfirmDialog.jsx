import { cn } from '@/lib/utils'
import { AlertTriangle, X } from 'lucide-react'

export default function ConfirmDialog({ open, onClose, onConfirm, title = 'Emin misiniz?', message, confirmText = 'Onayla', cancelText = 'İptal', variant = 'destructive' }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-start gap-4">
          {variant === 'destructive' && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {message && <p className="mt-2 text-sm text-gray-500">{message}</p>}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {cancelText}
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium text-white',
              variant === 'destructive' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-blue-700'
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
