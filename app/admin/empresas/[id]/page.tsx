'use client'

import { AdminPageHeader } from '@/components/admin/page-header'
import { Button } from '@/components/ui/button'
import type { AsaasPaymentInfo } from '@/lib/asaas'
import type { Dependente, Empresa, EmpresaAccessException, EmpresaFuncionario } from '@/lib/types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { use, useCallback, useEffect, useState } from 'react'

type Details = { empresa: Empresa; funcionarios: EmpresaFuncionario[]; cadastros: { id: string; nome: string; cpf: string; status: string }[]; dependentes: Dependente[] }
type Terms = { mensalidade_valor: string; primeira_parcela_vencimento: string; contrato_meses: number; dia_vencimento: number; parcelas_mesmo_dia: boolean }
const currency = (value?: number | null) => value == null ? '—' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const date = (value?: string | null) => value ? value.slice(0, 10).split('-').reverse().join('/') : '—'
const paymentStatus: Record<string, string> = { PENDING: 'Em aberto', OVERDUE: 'Vencida', RECEIVED: 'Recebida', CONFIRMED: 'Confirmada', REFUNDED: 'Estornada', DELETED: 'Excluída' }
export default function EmpresaDetails({ params }: { params: Promise<{ id: string }> }) {
 const { id } = use(params); const router = useRouter()
 const [details, setDetails] = useState<Details | null>(null)
 const [payments, setPayments] = useState<AsaasPaymentInfo[]>([])
 const [paymentError, setPaymentError] = useState('')
 const [error, setError] = useState(''); const [message, setMessage] = useState('')
 const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true)
 const [terms, setTerms] = useState<Terms | null>(null)
 const [exception, setException] = useState<EmpresaAccessException | null>(null)
 const [exceptionReason, setExceptionReason] = useState('')
 const [exceptionExpiresAt, setExceptionExpiresAt] = useState(() => { const date = new Date(Date.now() + 7 * 86400000); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16) })
 const [confirmation, setConfirmation] = useState<{ title: string; text: string; url: string; method: string; body: unknown } | null>(null)
 const load = useCallback(async () => {
  setLoading(true); setError('')
  try {
   const response = await fetch(`/api/admin/empresas/${id}`)
   if (response.status === 401) { router.push('/admin/login'); return }
   const payload = await response.json()
   if (!response.ok) throw new Error(payload.error || 'Erro ao carregar a empresa.')
   setDetails(payload)
   const e = payload.empresa as Empresa
   setTerms({ mensalidade_valor: String(e.mensalidade_valor ?? ''), primeira_parcela_vencimento: e.primeira_parcela_vencimento || '', contrato_meses: e.contrato_meses || 12, dia_vencimento: e.dia_vencimento || 1, parcelas_mesmo_dia: e.parcelas_mesmo_dia !== false })
   const invoices = await fetch(`/api/admin/empresas/${id}/pagamentos`)
   const invoiceData = await invoices.json()
   setPaymentError(invoices.ok ? '' : invoiceData.error || 'Erro ao consultar faturas.'); setPayments(invoiceData.pagamentos || [])
   const exceptionResponse = await fetch(`/api/admin/empresas/${id}/acesso-excepcional`)
   const exceptionData = await exceptionResponse.json()
   if (exceptionResponse.ok) setException(exceptionData.acessoExcepcional || null)
  } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao carregar a empresa.') }
  finally { setLoading(false) }
 }, [id, router])
 useEffect(() => { void load() }, [load])
 async function execute() {
  if (!confirmation) return
  setBusy(true); setError(''); setMessage('')
  try {
   const response = await fetch(confirmation.url, { method: confirmation.method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(confirmation.body) })
   const result = await response.json()
   if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a ação.')
   setConfirmation(null); await load(); setMessage(result.message || 'Status atualizado.')
  } catch (err) { setConfirmation(null); setError(err instanceof Error ? err.message : 'Erro ao concluir a ação.') }
  finally { setBusy(false) }
 }
 function grantException() {
  setConfirmation({ title: 'Liberar acesso excepcional', text: `Os funcionários poderão acessar o app até ${new Date(exceptionExpiresAt).toLocaleString('pt-BR')}, mas o contrato continuará pendente de pagamento. Confirmar?`, url: `/api/admin/empresas/${id}/acesso-excepcional`, method: 'POST', body: { motivo: exceptionReason, expiraEm: new Date(exceptionExpiresAt).toISOString() } })
 }
 const e = details?.empresa
 const started = Boolean(e?.pagamento_confirmado_em || e?.asaas_subscription_id || ['ATIVO', 'INATIVO'].includes(e?.status || ''))
 const field = 'mt-1 w-full rounded-md border border-gray-300 bg-white p-2 disabled:bg-gray-100'
 const card = 'rounded-xl border border-gray-200 bg-white p-6 shadow-sm'
 return <main className="min-h-screen bg-gray-50">
  <AdminPageHeader title={e?.nome_fantasia || e?.razao_social || 'Detalhes da empresa'} description="Colaboradores, cobrança e condições comerciais." backHref="/admin/empresas"><Button variant="outline" onClick={() => void load()} disabled={busy || loading}>Atualizar</Button></AdminPageHeader>
  <div className="mx-auto max-w-6xl space-y-6 p-4 py-8">
   {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
   {message && <p role="status" className="rounded-lg bg-green-50 p-4 text-green-800">{message}</p>}
   {loading && <p>Carregando empresa...</p>}
   {details && e && terms && <>
    <section className={card}><h2 className="text-lg font-semibold">Dados da empresa</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2"><div><dt className="text-sm text-gray-500">Razão social</dt><dd>{e.razao_social}</dd></div><div><dt className="text-sm text-gray-500">CNPJ</dt><dd>{e.cnpj}</dd></div><div><dt className="text-sm text-gray-500">Responsável</dt><dd>{e.responsavel_nome}</dd></div><div><dt className="text-sm text-gray-500">Contato</dt><dd>{e.email}<br/>{e.telefone}</dd></div></dl>
     <div className="mt-5 flex flex-wrap items-center gap-3"><span className="rounded bg-gray-100 px-3 py-1 text-sm">{e.status === 'ATIVO' ? 'Ativa' : e.status === 'INATIVO' ? 'Inativa' : e.status === 'PENDENTE_PAGAMENTO' ? 'Pendente de pagamento' : e.status}</span>
      {['ATIVO', 'INATIVO'].includes(e.status) && <Button variant="outline" disabled={busy} onClick={() => setConfirmation({ title: e.status === 'ATIVO' ? 'Inativar empresa' : 'Reativar empresa', text: e.status === 'ATIVO' ? 'O acesso ao app dos colaboradores e seus dependentes será suspenso. As cobranças e os agendamentos já existentes serão mantidos. Deseja continuar?' : 'O acesso ao app dos colaboradores e dependentes será liberado novamente. Deseja continuar?', url: `/api/admin/empresas/${id}/status`, method: 'POST', body: { status: e.status === 'ATIVO' ? 'INATIVO' : 'ATIVO' } })}>{e.status === 'ATIVO' ? 'Inativar' : 'Reativar'}</Button>}
     </div>{!['ATIVO', 'INATIVO'].includes(e.status) && <p className="mt-3 text-sm text-gray-600">A ativação inicial ocorre após a confirmação do pagamento da primeira mensalidade.</p>}
    </section>
    <section className={card}><h2 className="text-lg font-semibold">Condições comerciais</h2><form className="mt-4 space-y-4" onSubmit={event => { event.preventDefault(); setConfirmation({ title: 'Salvar condições comerciais', text: `Mensalidade de ${currency(Number(terms.mensalidade_valor))}. Vencimento das demais parcelas: dia ${terms.parcelas_mesmo_dia ? Number(terms.primeira_parcela_vencimento.slice(8)) : terms.dia_vencimento}. As faturas mensais já emitidas mantêm as condições originais. Confirmar alteração?`, url: `/api/admin/empresas/${id}/condicoes`, method: 'PATCH', body: { ...terms, mensalidade_valor: Number(terms.mensalidade_valor) } }) }}>
     <div className="grid gap-4 sm:grid-cols-3"><label>Mensalidade (R$)<input aria-label="Mensalidade" required type="number" min="5" step="0.01" className={field} value={terms.mensalidade_valor} onChange={ev => setTerms({ ...terms, mensalidade_valor: ev.target.value })}/></label><label>Primeira parcela<input aria-label="Primeira parcela" required type="date" disabled={started} className={field} value={terms.primeira_parcela_vencimento} onChange={ev => setTerms({ ...terms, primeira_parcela_vencimento: ev.target.value })}/></label><label>Prazo (meses)<input aria-label="Prazo" required type="number" min="1" max="60" disabled={started} className={field} value={terms.contrato_meses} onChange={ev => setTerms({ ...terms, contrato_meses: Number(ev.target.value) })}/></label></div>
     <label className="flex items-center gap-2"><input type="checkbox" checked={terms.parcelas_mesmo_dia} onChange={ev => setTerms({ ...terms, parcelas_mesmo_dia: ev.target.checked })}/>Demais parcelas no mesmo dia da primeira</label>
     {!terms.parcelas_mesmo_dia && <label className="block max-w-xs">Dia das demais parcelas<select aria-label="Dia das demais parcelas" className={field} value={terms.dia_vencimento} onChange={ev => setTerms({ ...terms, dia_vencimento: Number(ev.target.value) })}>{Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></label>}
     <p className="text-sm text-gray-600">{started ? 'A primeira parcela e o prazo original são preservados após a ativação. Alterações de valor e dia valem para as próximas emissões.' : 'Alterações atualizam também a primeira fatura em aberto.'}</p>
     {started && !e.primeira_parcela_vencimento && <p role="alert" className="text-sm text-amber-800">Contrato anterior sem calendário de parcelas. A edição requer revisão das condições originais.</p>}
     <Button type="submit" disabled={busy || (started && !e.primeira_parcela_vencimento)} className="bg-blue-600 hover:bg-blue-700">Salvar condições</Button>
    </form></section>
    <section className={card}><h2 className="text-lg font-semibold">Acesso excepcional</h2><p className="mt-2 text-sm text-gray-600">Libera o acesso dos funcionários temporariamente sem marcar o contrato como pago ou alterar as condições financeiras.</p>{exception ? <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-semibold text-amber-900">Ativo até {new Date(exception.expira_em).toLocaleString('pt-BR')}</p><p className="mt-1 text-amber-900">Motivo: {exception.motivo}</p><Button variant="outline" className="mt-4" disabled={busy} onClick={() => setConfirmation({ title: 'Revogar acesso excepcional', text: 'Os funcionários perderão o acesso imediatamente. O histórico da autorização será preservado. Confirmar?', url: `/api/admin/empresas/${id}/acesso-excepcional`, method: 'DELETE', body: {} })}>Revogar acesso</Button></div> : <form className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]" onSubmit={event => { event.preventDefault(); grantException() }}><label>Motivo<textarea required minLength={10} maxLength={1000} className={field} value={exceptionReason} onChange={event => setExceptionReason(event.target.value)} placeholder="Ex.: Liberação autorizada pela diretoria durante ajuste contratual." /></label><div><label>Expira em<input required type="datetime-local" className={field} value={exceptionExpiresAt} onChange={event => setExceptionExpiresAt(event.target.value)} /></label><Button type="submit" disabled={busy || exceptionReason.trim().length < 10 || e.status === 'INATIVO'} className="mt-4 bg-amber-600 hover:bg-amber-700">Liberar funcionários</Button></div></form>}</section>
    <section className={card}><h2 className="text-lg font-semibold">Colaboradores ({details.funcionarios.length}) e dependentes ({details.dependentes.length})</h2>
     <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Colaborador</th><th className="p-3">CPF</th><th className="p-3">Contato</th><th className="p-3">Dependentes</th></tr></thead><tbody>{details.funcionarios.map(f => {
      const cadastro = details.cadastros.find(c => c.id === f.cadastro_id || c.cpf.replace(/\D/g, '') === f.cpf.replace(/\D/g, ''))
      const dependents = details.dependentes.filter(d => d.cadastro_id === cadastro?.id)
      return <tr key={f.id} className="border-b"><td className="p-3">{cadastro ? <Link className="text-blue-700 hover:underline" href={`/admin/cadastro/${cadastro.id}`}>{f.nome}</Link> : f.nome}</td><td className="p-3 font-mono">{f.cpf}</td><td className="p-3">{f.email}<br/>{f.telefone}</td><td className="p-3">{dependents.length ? dependents.map(d => <p key={d.id}>{d.nome} — {d.relacao}</p>) : 'Nenhum dependente'}</td></tr>
     })}</tbody></table></div>{!details.funcionarios.length && <p className="mt-3 text-gray-600">Nenhum colaborador importado.</p>}
    </section>
    <section className={card}><h2 className="text-lg font-semibold">Faturas</h2>{paymentError && <p role="alert" className="mt-3 text-red-800">{paymentError}</p>}<div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Vencimento</th><th className="p-3">Valor</th><th className="p-3">Status</th><th className="p-3">Ações</th></tr></thead><tbody>{payments.map(p => <tr key={p.id} className="border-b"><td className="p-3">{date(p.dueDate)}</td><td className="p-3">{currency(p.value)}</td><td className="p-3">{paymentStatus[p.status || ''] || p.status}</td><td className="flex flex-wrap gap-3 p-3">{(p.invoiceUrl || p.bankSlipUrl) && <a className="text-blue-700 hover:underline" href={p.invoiceUrl || p.bankSlipUrl} target="_blank" rel="noreferrer">Abrir fatura</a>}{['PENDING', 'OVERDUE'].includes(p.status || '') && <button disabled={busy} className="text-blue-700 hover:underline disabled:opacity-50" onClick={() => setConfirmation({ title: 'Reenviar fatura por e-mail', text: `Enviar esta fatura de ${currency(p.value)}, vencimento ${date(p.dueDate)}, para ${e.email}?`, url: `/api/admin/empresas/${id}/reenviar-fatura`, method: 'POST', body: { paymentId: p.id } })}>Reenviar por e-mail</button>}</td></tr>)}</tbody></table></div>{!paymentError && !payments.length && <p className="mt-3 text-gray-600">Nenhuma fatura emitida.</p>}</section>
   </>}
  </div>
  {confirmation && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><section role="dialog" aria-modal="true" aria-labelledby="confirmation-title" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"><h2 id="confirmation-title" className="text-xl font-semibold">{confirmation.title}</h2><p className="mt-3 text-gray-700">{confirmation.text}</p><div className="mt-6 flex justify-end gap-3"><Button variant="outline" disabled={busy} onClick={() => setConfirmation(null)}>Cancelar</Button><Button disabled={busy} onClick={() => void execute()} className="bg-blue-600 hover:bg-blue-700">{busy ? 'Processando...' : 'Confirmar'}</Button></div></section></div>}
 </main>
}
