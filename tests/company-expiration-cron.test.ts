import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ remove: vi.fn(), exception: vi.fn(), companyStatus: 'ATIVO', companyError: false, revoked: false }))
vi.mock('@/lib/empresa-rapidoc-sync', () => ({ removeEmpresaFuncionariosFromRapidoc: mocks.remove }))
vi.mock('@/lib/empresa-access', () => ({ getActiveEmpresaAccessException: mocks.exception }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: (table: string) => {
  let updating = false
  const query = { select: () => query, eq: () => query, is: () => query, lte: () => query, maybeSingle: () => query,
    update: () => { updating = true; return query }, then: (resolve: (value: unknown) => unknown) => {
      if (updating) { mocks.revoked = true; return Promise.resolve({ error: null }).then(resolve) }
      if (table === 'empresas') return Promise.resolve({ data: { status: mocks.companyStatus }, error: mocks.companyError ? new Error('database') : null }).then(resolve)
      return Promise.resolve({ data: [{ id: 'expired-1', empresa_id: 'company-1' }], error: null }).then(resolve)
    } }; return query
} }) }))
import { GET } from '../app/api/cron/empresa-acesso-excepcional/route'
const request = () => new NextRequest('http://localhost/api/cron/empresa-acesso-excepcional', { headers: { authorization: 'Bearer local-cron-secret' } })
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('CRON_SECRET','local-cron-secret'); mocks.companyStatus = 'ATIVO'; mocks.companyError = false; mocks.revoked = false; mocks.remove.mockResolvedValue(undefined); mocks.exception.mockResolvedValue(null); vi.spyOn(console, 'error').mockImplementation(() => {}); vi.spyOn(console, 'log').mockImplementation(() => {}) })
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })
describe('expiração de acesso excepcional empresarial', () => {
  it('não remove da Rapidoc a empresa que já foi ativada', async () => { expect((await GET(request())).status).toBe(200); expect(mocks.remove).not.toHaveBeenCalled(); expect(mocks.revoked).toBe(true) })
  it('preserva uma nova exceção vigente ao processar a antiga expirada', async () => { mocks.companyStatus = 'PENDENTE_PAGAMENTO'; mocks.exception.mockResolvedValue({ id: 'new-exception' }); expect((await GET(request())).status).toBe(200); expect(mocks.remove).not.toHaveBeenCalled() })
  it('remove o acesso sem pagamento ou autorização vigente', async () => { mocks.companyStatus = 'PENDENTE_PAGAMENTO'; expect((await GET(request())).status).toBe(200); expect(mocks.remove).toHaveBeenCalledWith('company-1'); expect(mocks.revoked).toBe(true) })
  it('não remove beneficiários quando não consegue verificar a empresa', async () => { mocks.companyError = true; expect((await GET(request())).status).toBe(503); expect(mocks.remove).not.toHaveBeenCalled(); expect(mocks.revoked).toBe(false) })
  it('retorna falha para o monitoramento e permite retry quando o provedor está indisponível', async () => { mocks.companyStatus = 'INATIVO'; mocks.remove.mockRejectedValue(new Error('provider')); expect((await GET(request())).status).toBe(503); expect(mocks.revoked).toBe(false) })
  it('nega execução sem o segredo do cron', async () => { vi.stubEnv('CRON_SECRET',''); expect((await GET(request())).status).toBe(401); expect(mocks.remove).not.toHaveBeenCalled() })
})
