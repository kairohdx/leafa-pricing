import { useState, type FormEvent } from 'react'
import { Building2, Pencil } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import type { Company } from '../../auth/types'
import { changes, useFormAction } from '../../api/hooks'
import { FormFeedback, PageHeading } from '../../components/Forms'
import { CompanyFields, type CompanyDraft } from './CompanyFields'

function CompanyEditor({ company, onDone, onCancel }: { company: Company; onDone: () => void; onCancel: () => void }) {
  const { api, updateIdentity } = useAuth()
  const [initial] = useState<CompanyDraft>({ name: company.name, slug: company.slug, currency: company.currency, timezone: company.timezone })
  const [draft, setDraft] = useState(initial)
  const form = useFormAction()
  async function submit(event: FormEvent) {
    event.preventDefault()
    await form.run(async () => {
      const updated = await api<Company>('/companies/me', { method: 'PATCH', body: JSON.stringify(changes(initial, draft)) })
      updateIdentity({ company: updated }); onDone()
    }, { conflict: 'Este identificador de empresa já está em uso. Escolha outro.' })
  }
  return <form className="detail-card" onSubmit={submit} aria-label="Editar empresa"><h2>Editar empresa</h2><FormFeedback state={form} />
    <fieldset disabled={form.busy}><CompanyFields value={draft} onChange={setDraft} errors={form.fields} /></fieldset>
    <p className="info-note">A moeda será usada nas novas vendas. Vendas existentes mantêm sua moeda e seus valores, sem conversão. O fuso define a apresentação dos períodos e indicadores da empresa.</p>
    <div className="form-actions"><button className="button secondary" type="button" onClick={onCancel} disabled={form.busy}>Cancelar</button><button className="button primary" disabled={form.busy}>{form.busy ? 'Salvando…' : 'Salvar empresa'}</button></div>
  </form>
}

export function CompanyPage() {
  const { identity } = useAuth()
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  if (!identity) return null
  const { company, user } = identity
  return <><PageHeading section="ORGANIZAÇÃO" title="Minha empresa" description="As informações do seu espaço de trabalho.">
    {user.role === 'admin' && !editing && <button className="button secondary" onClick={() => { setEditing(true); setSaved(false) }}><Pencil size={16} />Editar empresa</button>}
  </PageHeading>
    {saved && <p className="feedback success-message" role="status">Empresa atualizada.</p>}
    {editing && user.role === 'admin' ? <CompanyEditor company={company} onCancel={() => setEditing(false)} onDone={() => { setEditing(false); setSaved(true) }} /> :
      <section className="detail-card"><div className="detail-title"><span className="card-icon"><Building2 /></span><div><h2>{company.name}</h2><span className="muted">Empresa vinculada à sua conta</span></div></div>
        <dl className="details"><div><dt>Nome</dt><dd>{company.name}</dd></div><div><dt>Identificador</dt><dd>{company.slug}</dd></div><div><dt>Moeda</dt><dd>{company.currency}</dd></div><div><dt>Fuso horário</dt><dd>{company.timezone}</dd></div><div><dt>Situação</dt><dd>{company.is_active ? 'Ativa' : 'Inativa'}</dd></div></dl>
        {user.role !== 'admin' && <p className="detail-note">A edição dos dados da empresa é exclusiva de administradores.</p>}
      </section>}
  </>
}
