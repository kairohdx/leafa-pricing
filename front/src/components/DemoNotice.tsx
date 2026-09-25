export function DemoNotice() {
  if (import.meta.env.VITE_DEMO_MODE !== 'true') return null
  return <aside className="info-note" aria-label="Ambiente de demonstração"><strong>Ambiente de demonstração.</strong> Os dados podem ser apagados sem aviso. Use apenas dados fictícios.</aside>
}
