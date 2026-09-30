import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Row = Record<string, unknown>
const mocks = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  createCustomer: vi.fn(), createPayment: vi.fn(), createSubscription: vi.fn(),
  getPayment: vi.fn(), listSubscriptions: vi.fn(), cancelPayment: vi.fn(), deleteCustomer: vi.fn(),
  adminAuth: vi.fn(),
}))

// A small query double exercises route persistence and the compare-and-set subscription lock.
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({
  from: (table: string) => {
    const filters: ((row: Row) => boolean)[] = []
    let operation = 'select'
    let payload: Row | Row[] = {}
    let single = false
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return query },
      is: (key: string, value: unknown) => { filters.push((row) => (row[key] ?? null) === value); return query },
      in: (key: string, values: unknown[]) => { filters.push((row) => values.includes(row[key])); return query },
      limit: () => query,
      insert: (data: Row | Row[]) => { operation = 'insert'; payload = data; return query },
      update: (data: Row) => { operation = 'update'; payload = data; return query },
      delete: () => { operation = 'delete'; return query },
      single: () => { single = true; return query },
      maybeSingle: () => { single = true; return query },
      then: (resolve: (value: unknown) => unknown) => {
        const rows = mocks.tables[table] ||= []
        let selected = rows.filter((row) => filters.every((filter) => filter(row)))
        if (operation === 'insert') {
          selected = (Array.isArray(payload) ? payload : [payload]).map((row) => ({ id: crypto.randomUUID(), ...row }))
          rows.push(...selected)
        }
        if (operation === 'update') selected.forEach((row) => Object.assign(row, payload))
        if (operation === 'delete') mocks.tables[table] = rows.filter((row) => !selected.includes(row))
        return Promise.resolve({ data: single ? selected[0] ? { ...selected[0] } : null : selected.map((row) => ({ ...row })), error: null }).then(resolve)
      },
    }
    return query
  },
}) }))
vi.mock('@/lib/supabase/admin-auth', () => ({ requireAdminAuth: mocks.adminAuth }))
vi.mock('@/lib/rapidoc-sync', () => ({ syncCadastroToRapidoc: async () => undefined }))
vi.mock('@/lib/billing-settings', () => ({
  MIN_ASAAS_CHARGE_VALUE: 5, getBillingSettings: vi.fn().mockResolvedValue({}), getMensalidadeValueByPlanType: () => 50,
}))
vi.mock('@/lib/asaas', () => ({
  AsaasIntegrationError: class extends Error {},
  createAsaasCustomer: mocks.createCustomer, createAsaasPayment: mocks.createPayment,
  createAsaasSubscription: mocks.createSubscription, getAsaasPayment: mocks.getPayment,
  listAsaasSubscriptions: mocks.listSubscriptions,
  cancelAsaasSubscription: vi.fn(), cancelAsaasPayment: mocks.cancelPayment,
  deleteAsaasCustomer: mocks.deleteCustomer,
  isAsaasPaidStatus: (status: string) => ['RECEIVED', 'CONFIRMED'].includes(status),
}))

import { POST as createEmpresa } from '../app/api/admin/empresas/route'
import { POST as webhook } from '../app/api/asaas/webhook/route'

const commercial = {
  primeira_parcela_vencimento: '2026-10-15', parcelas_mesmo_dia: false, dia_vencimento: 5, contrato_meses: 12,
}
const empresaBody = {
  razao_social: 'Empresa de Teste', cnpj: '11222333000181', email: 'empresa@example.com',
  telefone: '11999999999', responsavel_nome: 'Responsável', valor_mensal: 500,
  ...commercial,
  funcionarios: [{ nome: 'Colaborador', email: 'colaborador@example.com', cpf: '52998224725', data_nascimento: '1990-01-01' }],
}
function adminRequest(body = empresaBody) {
  return new NextRequest('http://localhost/api/admin/empresas', { method: 'POST', body: JSON.stringify(body) })
}
function paymentEvent() {
  return new NextRequest('http://localhost/api/asaas/webhook', {
    method: 'POST', headers: { 'asaas-access-token': 'test-token' },
    body: JSON.stringify({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay-first' } }),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-30T12:00:00Z'))
  vi.stubEnv('ASAAS_WEBHOOK_TOKEN', 'test-token')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))
  mocks.tables = {}
  mocks.adminAuth.mockResolvedValue({ ok: true })
  mocks.createCustomer.mockResolvedValue({ id: 'cus-1' })
  mocks.createPayment.mockResolvedValue({ id: 'pay-first', invoiceUrl: 'https://example.com/invoice' })
  mocks.createSubscription.mockResolvedValue({ id: 'sub-1' })
  mocks.listSubscriptions.mockResolvedValue([])
  mocks.getPayment.mockResolvedValue({ id: 'pay-first', status: 'RECEIVED', customer: 'cus-1', dueDate: '2026-10-15' })
  mocks.cancelPayment.mockResolvedValue(undefined)
  mocks.deleteCustomer.mockResolvedValue(undefined)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('cadastro empresarial e confirmação de parcelas', () => {
  it('cobra o valor acordado na data escolhida, ativa só após pagamento e cria apenas 11 parcelas', async () => {
    const response = await createEmpresa(adminRequest())
    expect(response.status).toBe(200)
    expect(mocks.createPayment).toHaveBeenCalledWith(expect.objectContaining({ value: 500, dueDate: '2026-10-15' }))
    expect(mocks.tables.empresas[0]).toMatchObject({ ...commercial, status: 'PENDENTE_PAGAMENTO', pagamento_confirmado_em: null })
    expect(mocks.createSubscription).not.toHaveBeenCalled()

    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'))
    expect((await webhook(paymentEvent())).status).toBe(200)
    expect(mocks.tables.empresas[0].status).toBe('ATIVO')
    expect(mocks.createSubscription).toHaveBeenCalledWith(expect.objectContaining({ value: 500, nextDueDate: '2026-11-05', maxPayments: 11 }))
    expect(mocks.tables.cadastros[0].status).toBe('ATIVO')

    expect((await webhook(paymentEvent())).status).toBe(200)
    expect(mocks.createSubscription).toHaveBeenCalledTimes(1)
  })

  it('rejeita vencimento inválido antes de criar empresa ou cobrança', async () => {
    const response = await createEmpresa(adminRequest({ ...empresaBody, dia_vencimento: 32 }))
    expect(response.status).toBe(400)
    expect(mocks.createCustomer).not.toHaveBeenCalled()
    expect(mocks.tables.empresas).toBeUndefined()
  })

  it('contrato empresarial de um mês não cria parcelas posteriores', async () => {
    expect((await createEmpresa(adminRequest({ ...empresaBody, contrato_meses: 1 }))).status).toBe(200)
    expect((await webhook(paymentEvent())).status).toBe(200)
    expect(mocks.createSubscription).not.toHaveBeenCalled()
    expect(mocks.tables.empresas[0].status).toBe('ATIVO')
  })

  it('não libera empresa se o provedor ainda não confirmou pagamento', async () => {
    await createEmpresa(adminRequest())
    mocks.getPayment.mockResolvedValue({ id: 'pay-first', status: 'PENDING' })
    expect((await webhook(paymentEvent())).status).toBe(200)
    expect(mocks.createSubscription).not.toHaveBeenCalled()
    expect(mocks.tables.empresas[0].status).toBe('PENDENTE_PAGAMENTO')
  })

  it('permite repetir a confirmação após falha temporária ao criar a assinatura', async () => {
    await createEmpresa(adminRequest())
    mocks.createSubscription.mockRejectedValueOnce(new Error('Asaas indisponível'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      expect((await webhook(paymentEvent())).status).toBe(500)
      expect(mocks.tables.empresas[0]).toMatchObject({ status: 'PENDENTE_PAGAMENTO', asaas_subscription_id: null })
      expect((await webhook(paymentEvent())).status).toBe(200)
      expect(mocks.tables.empresas[0].status).toBe('ATIVO')
    } finally { log.mockRestore() }
  })

  it('remove o cadastro incompleto se a criação da primeira parcela falhar', async () => {
    mocks.createPayment.mockRejectedValueOnce(new Error('Asaas indisponível'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      expect((await createEmpresa(adminRequest())).status).toBe(500)
      expect(mocks.deleteCustomer).toHaveBeenCalledWith('cus-1')
      expect(mocks.tables.empresas).toHaveLength(0)
    } finally { log.mockRestore() }
  })

  it('aplica a mesma quantidade e o dia escolhido ao cliente comum', async () => {
    mocks.tables.cadastros = [{ id: 'cadastro-1', status: 'PENDENTE_PAGAMENTO', asaas_customer_id: 'cus-1', asaas_payment_id: 'pay-first', asaas_subscription_id: null, mensalidade_valor: 50, mensalidade_billing_type: 'BOLETO', ...commercial }]
    expect((await webhook(paymentEvent())).status).toBe(200)
    expect(mocks.createSubscription).toHaveBeenCalledWith(expect.objectContaining({ maxPayments: 11, nextDueDate: '2026-11-05' }))
    expect((await webhook(paymentEvent())).status).toBe(200)
    expect(mocks.createSubscription).toHaveBeenCalledTimes(1)
  })
})
