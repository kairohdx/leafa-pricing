import { useContext, useEffect, useRef } from 'react'
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router-dom'

function RouteGuard({ dirty }: { dirty: boolean }) {
  const blocker = useBlocker(dirty)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (blocker.state === 'blocked') dialog.current?.showModal(); else dialog.current?.close() }, [blocker.state])
  return <dialog ref={dialog} className="confirm-dialog" aria-labelledby="unsaved-title" onCancel={() => blocker.state === 'blocked' && blocker.reset()}><h2 id="unsaved-title">Descartar alterações?</h2><p>Há alterações que ainda não foram salvas.</p><div className="form-actions"><button type="button" className="button secondary" onClick={() => blocker.state === 'blocked' && blocker.reset()}>Continuar editando</button><button type="button" className="button danger" onClick={() => blocker.state === 'blocked' && blocker.proceed()}>Descartar e sair</button></div></dialog>
}
export function UnsavedChanges({ dirty }: { dirty: boolean }) {
  const router = useContext(UNSAFE_DataRouterContext)
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  return router ? <RouteGuard dirty={dirty} /> : null
}
