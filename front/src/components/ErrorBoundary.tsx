import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <main className="standalone"><h1>Algo não saiu como esperado.</h1><p>Recarregue a página para tentar novamente.</p><button className="button primary" onClick={() => window.location.reload()}>Recarregar página</button></main>
    return this.props.children
  }
}
