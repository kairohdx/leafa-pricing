import { useId, useRef } from 'react'
import { useFormAction } from '../api/hooks'
import { FormFeedback } from './Forms'

export function ConfirmButton({ label, title, description, onConfirm, disabled = false, intent = 'danger' }: {
  label: string; title: string; description: string; onConfirm: () => Promise<void>; disabled?: boolean; intent?: 'danger' | 'positive'
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const form = useFormAction()
  return <><button type="button" ref={trigger} className={`button ${intent === "danger" ? "danger-outline" : "primary"}`} disabled={disabled} onClick={() => dialog.current?.showModal()}>{label}</button>
    <dialog className="confirm-dialog" ref={dialog} aria-labelledby={titleId} onCancel={(event) => { if (form.busy) event.preventDefault() }}>
      <h2 id={titleId}>{title}</h2><p>{description}</p><FormFeedback state={form} />
      <div className="form-actions"><button type="button" className="button secondary" disabled={form.busy} onClick={() => dialog.current?.close()}>Voltar</button><button type="button" className={`button ${intent === "danger" ? "danger" : "primary"}`} disabled={form.busy} onClick={() => void form.run(async () => {
        await onConfirm()
        dialog.current?.close()
        requestAnimationFrame(() => {
          if (!trigger.current?.isConnected) document.getElementById('main-content')?.focus({ preventScroll: true })
        })
      })}>{form.busy ? 'Aguarde…' : label}</button></div>
    </dialog>
  </>
}
