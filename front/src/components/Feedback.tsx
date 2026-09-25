import { AlertCircle, LoaderCircle } from 'lucide-react'

export function Feedback({ message, error = false }: { message: string; error?: boolean }) {
  return <div className={`feedback ${error ? 'feedback-error' : ''}`} role={error ? 'alert' : 'status'}>
    {error ? <AlertCircle size={18} aria-hidden="true" /> : <LoaderCircle className="spin" size={18} aria-hidden="true" />}
    <span>{message}</span>
  </div>
}
