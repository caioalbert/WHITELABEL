import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), update: vi.fn(), db: vi.fn(), cadence: { tipo_plano: 'INDIVIDUAL', empresa_id: null, mensalidade_valor: 50, asaas_subscription_id: 'sub-1' } as Record<string, unknown>, plan: { valor: 30, permite_dependentes: true, min_dependentes: 2, valor_dependente_adicional: 30, max_dependentes: null } as Record<string, unknown> | null, count: 0, writes: [] as Record<string, unknown>[], failWrite: false, failCount: false }))
vi.mock('@/lib/supabase/cliente-auth', () => ({ requireActiveClienteAuth: mocks.auth }))
vi.mock('@/lib/asaas', () => ({ updateAsaasSubscriptionValue: mocks.update }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: (table: string) => {
  let values: Record<string, unknown> | null = null
  const query = { select: () => query, eq: () => query, is: () => query, single: () => query, maybeSingle: () => query,
    update: (data: Record<string, unknown>) => { values = data; return query },
    then: (resolve: (value: unknown) => unknown) => {
      if (values) { if (mocks.failWrite) return Promise.resolve({ data: null, error: new Error('database') }).then(resolve); mocks.writes.push(values); Object.assign(mocks.cadence, values); return Promise.resolve({ data: { id: 'client-1' }, error: null }).then(resolve) }
      if (table === 'cadastros') return Promise.resolve({ data: { ...mocks.cadence }, error: null }).then(resolve)
      if (table === 'planos') return Promise.resolve({ data: mocks.plan, error: null }).then(resolve)
      return Promise.resolve({ count: mocks.count, error: mocks.failCount ? new Error('database') : null }).then(resolve)
    } }; return query
} }) }))
import { POST } from '../app/api/cliente/plano/upgrade/route'
const request = () => new NextRequest('http://localhost/api/cliente/plano/upgrade', { method: 'POST', body: JSON.stringify({ target_plan: 'FAMILIAR' }) })
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ clienteId: 'client-1', tipo: 'titular' }); mocks.update.mockResolvedValue(undefined); mocks.cadence = { tipo_plano: 'INDIVIDUAL', empresa_id: null, mensalidade_valor: 50, asaas_subscription_id: 'sub-1' }; mocks.plan = { valor: 30, permite_dependentes: true, min_dependentes: 2, valor_dependente_adicional: 30, max_dependentes: null }; mocks.count = 0; mocks.writes = []; mocks.failWrite = false; mocks.failCount = false; vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => vi.restoreAllMocks())
describe('upgrade com configuração de cobrança do banco', () => {
  it('cobra o mínimo do plano familiar cadastrado, sem reutilizar o preço individual', async () => { const response = await POST(request()); expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ novo_valor: 90, vidas_cobradas: 3 }); expect(mocks.update).toHaveBeenCalledWith('sub-1', 90); expect(mocks.writes).toEqual([{ tipo_plano: 'FAMILIAR', mensalidade_valor: 90 }]) })
  it('não muda o plano nem retorna sucesso se Asaas falha', async () => { mocks.update.mockRejectedValue(new Error('provider unavailable')); expect((await POST(request())).status).toBe(503); expect(mocks.writes).toHaveLength(0); expect(mocks.cadence.tipo_plano).toBe('INDIVIDUAL') })
  it('não cria preço de fallback quando o plano está ausente', async () => { mocks.plan = null; expect((await POST(request())).status).toBe(503); expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.writes).toHaveLength(0) })
  it('interrompe antes de cobrar se a contagem de dependentes falha', async () => { mocks.failCount = true; expect((await POST(request())).status).toBe(503); expect(mocks.update).not.toHaveBeenCalled() })
  it('tenta restaurar a cobrança após falha de persistência com estado original confirmado', async () => { mocks.failWrite = true; expect((await POST(request())).status).toBe(503); expect(mocks.update.mock.calls).toEqual([['sub-1',90],['sub-1',50]]) })
  it.each(['dependente', 'empresa'])('não permite upgrade pelo acesso %s', async tipo => { mocks.auth.mockResolvedValue({ clienteId: 'client-1', tipo }); expect((await POST(request())).status).toBe(403); expect(mocks.update).not.toHaveBeenCalled() })
  it('mantém condições empresariais sob controle da empresa', async () => { mocks.cadence.empresa_id = 'company-1'; expect((await POST(request())).status).toBe(403); expect(mocks.update).not.toHaveBeenCalled() })
})
