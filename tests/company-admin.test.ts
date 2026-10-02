import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
const mocks = vi.hoisted(() => ({ load: vi.fn(), payment: vi.fn(), subscription: vi.fn(), list: vi.fn(), updatePayment: vi.fn(), updateSubscription: vi.fn(), send: vi.fn() }))
vi.mock('../lib/admin-empresa', () => ({ loadAdminEmpresa: mocks.load }))
vi.mock('../lib/asaas', () => ({ getAsaasPayment: mocks.payment, getAsaasSubscription: mocks.subscription, listAsaasSubscriptionPayments: mocks.list, updateAsaasPaymentTerms: mocks.updatePayment, updateAsaasSubscriptionTerms: mocks.updateSubscription, isAsaasPaidStatus: (s: string) => ['RECEIVED', 'CONFIRMED'].includes(s) }))
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send } } }))
import { POST as status } from '../app/api/admin/empresas/[id]/status/route'
import { PATCH as conditions } from '../app/api/admin/empresas/[id]/condicoes/route'
import { POST as resend } from '../app/api/admin/empresas/[id]/reenviar-fatura/route'
import { GET as invoices } from '../app/api/admin/empresas/[id]/pagamentos/route'
const id = '00000000-0000-4000-8000-000000000001'
const context = { params: Promise.resolve({ id }) }
const company = () => ({ id, status: 'ATIVO', email: 'financeiro@example.com', razao_social: 'Empresa local', responsavel_nome: 'Responsável', asaas_customer_id: 'cus-local', asaas_payment_id: 'pay-first', asaas_subscription_id: 'sub-local', mensalidade_valor: 100, quantidade_funcionarios: 2, primeira_parcela_vencimento: '2026-09-15', contrato_meses: 12, dia_vencimento: 15, parcelas_mesmo_dia: true, updated_at: '2026-09-30T12:00:00Z' })
const request = (body: unknown, method = 'POST') => new NextRequest('http://localhost/api/admin/empresas/'+id, { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
let writes: unknown[]; let dbResult: { data: unknown; error: unknown }
beforeEach(() => {
 vi.clearAllMocks(); writes = []; dbResult = { data: { id }, error: null }
 const db = { from: () => ({ update: (payload: unknown) => { writes.push(payload); const query = { eq: () => query, select: () => query, maybeSingle: async () => dbResult }; return query } }) }
 mocks.load.mockResolvedValue({ empresa: company(), db })
 mocks.subscription.mockResolvedValue({ id: 'sub-local', customer: 'cus-local', status: 'ACTIVE', value: 100, nextDueDate: '2099-10-15' })
 mocks.payment.mockResolvedValue({ id: 'pay-first', customer: 'cus-local', status: 'PENDING', value: 100, dueDate: '2099-10-15', invoiceUrl: 'https://www.asaas.com/i/local' })
 mocks.list.mockResolvedValue([]); mocks.send.mockResolvedValue({ error: null })
 vi.stubEnv('RESEND_API_KEY', 'test-only'); vi.stubEnv('RESEND_FROM_EMAIL', 'billing@example.com')
})
describe('gestão administrativa de empresas', () => {
 it('protege todas as ações quando a autenticação é negada', async () => {
  mocks.load.mockResolvedValue({ response: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) })
  for (const fn of [status, conditions, resend, invoices]) expect((await fn(request({}), context)).status).toBe(401)
  expect(mocks.send).not.toHaveBeenCalled(); expect(mocks.subscription).not.toHaveBeenCalled(); expect(writes).toEqual([])
 })
 it('inativa sem alterar cobranças ou o histórico de pagamentos', async () => {
  expect((await status(request({ status: 'INATIVO' }), context)).status).toBe(200)
  expect(writes).toEqual([{ status: 'INATIVO' }]); expect(mocks.updateSubscription).not.toHaveBeenCalled()
 })
 it('reativa apenas empresa previamente ativada', async () => {
  const loaded = await mocks.load(); loaded.empresa.status = 'INATIVO'
  expect((await status(request({ status: 'ATIVO' }), context)).status).toBe(200)
  loaded.empresa.status = 'PENDENTE_PAGAMENTO'
  expect((await status(request({ status: 'ATIVO' }), context)).status).toBe(409)
 })
 it('detecta atualização concorrente do status', async () => {
  dbResult.data = null
  expect((await status(request({ status: 'INATIVO' }), context)).status).toBe(409)
 })
 it('edita próximas emissões preservando primeira parcela e prazo', async () => {
  const body = { ...company(), mensalidade_valor: 120, parcelas_mesmo_dia: false, dia_vencimento: 31 }
  expect((await conditions(request(body, 'PATCH'), context)).status).toBe(200)
  expect(mocks.updateSubscription).toHaveBeenCalledWith('sub-local', 120, '2099-10-31')
  expect(mocks.updatePayment).not.toHaveBeenCalled()
  expect(writes).toContainEqual(expect.objectContaining({ mensalidade_valor: 120, dia_vencimento: 31 }))
 })
 it('impede reescrever prazo depois da ativação', async () => {
  expect((await conditions(request({ ...company(), contrato_meses: 24 }, 'PATCH'), context)).status).toBe(409)
  expect(mocks.updateSubscription).not.toHaveBeenCalled(); expect(writes).toEqual([])
 })
 it('restaura condições do Asaas se o banco falhar', async () => {
  dbResult.error = { message: 'database unavailable' }; dbResult.data = null
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
   expect((await conditions(request({ ...company(), mensalidade_valor: 120 }, 'PATCH'), context)).status).toBe(502)
   expect(mocks.updateSubscription).toHaveBeenLastCalledWith('sub-local', 100, '2099-10-15')
  } finally { log.mockRestore() }
 })
 it('não envia fatura de outra empresa', async () => {
  expect((await resend(request({ paymentId: 'pay-other' }), context)).status).toBe(404)
  expect(mocks.payment).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled()
 })
 it('confere cliente e não reenvia faturas pagas', async () => {
  mocks.payment.mockResolvedValue({ id: 'pay-first', customer: 'cus-other', status: 'PENDING' })
  expect((await resend(request({ paymentId: 'pay-first' }), context)).status).toBe(409)
  mocks.payment.mockResolvedValue({ id: 'pay-first', customer: 'cus-local', status: 'RECEIVED' })
  expect((await resend(request({ paymentId: 'pay-first' }), context)).status).toBe(409)
  expect(mocks.send).not.toHaveBeenCalled()
 })
 it('envia a fatura existente apenas ao contato cadastrado', async () => {
  expect((await resend(request({ paymentId: 'pay-first', email: 'untrusted@example.com' }), context)).status).toBe(200)
  expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'financeiro@example.com', text: expect.stringContaining('https://www.asaas.com/i/local') }))
 })
 it('falha claramente se o envio de e-mail não estiver configurado', async () => {
  vi.stubEnv('RESEND_API_KEY', '')
  expect((await resend(request({ paymentId: 'pay-first' }), context)).status).toBe(503)
  expect(mocks.send).not.toHaveBeenCalled()
 })
 it('consulta faturas sem duplicar a primeira parcela', async () => {
  mocks.list.mockResolvedValue([{ id: 'pay-first' }, { id: 'pay-next', value: 100 }])
  const result = await invoices(request({}), context)
  expect((await result.json()).pagamentos).toHaveLength(2)
 })
})
