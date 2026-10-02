import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ verify: vi.fn(), db: vi.fn(), cookies: vi.fn() }))
vi.mock('jose', () => ({ jwtVerify: mocks.verify }))
vi.mock('next/headers', () => ({ cookies: mocks.cookies }))
vi.mock('../lib/auth-secret', () => ({ getJwtSecret: () => new Uint8Array([1]) }))
vi.mock('../lib/supabase/admin', () => ({ createAdminClient: mocks.db }))
import { getActiveClienteAuth } from '../lib/supabase/cliente-auth'
const request = () => new Request('http://localhost', { headers: { Authorization: 'Bearer local-only' } })
beforeEach(() => { vi.clearAllMocks(); mocks.verify.mockResolvedValue({ payload: { clienteId: 'local-id', cpf: '52998224725', nome: 'Pessoa local', tipo: 'titular' } }) })
function database(companyStatus: string | null, empresaId: string | null = 'empresa-local', exception: unknown = null, cadastroStatus = 'ATIVO') {
 mocks.db.mockReturnValue({ from: (table: string) => {
  const query: any = { eq: () => query, is: () => query, gt: () => query, order: () => query, limit: () => query, maybeSingle: async () => ({ data: table === 'cadastros' ? { status: cadastroStatus, empresa_id: empresaId } : table === 'empresas' ? companyStatus ? { status: companyStatus } : null : exception, error: null }) }
  return { select: () => query }
 } })
}
describe('acesso empresarial após inativação', () => {
 it('bloqueia um token já emitido quando a empresa está inativa', async () => { database('INATIVO'); expect(await getActiveClienteAuth(request())).toBeNull() })
 it('bloqueia dependentes da empresa inativa', async () => { database('INATIVO'); mocks.verify.mockResolvedValue({ payload: { clienteId: 'local-id', tipo: 'dependente', dependenteId: 'dep-local' } }); expect(await getActiveClienteAuth(request())).toBeNull() })
 it('libera após reativação sem mudar histórico financeiro', async () => { database('ATIVO'); expect(await getActiveClienteAuth(request())).toMatchObject({ clienteId: 'local-id' }) })
 it('preserva acesso de cadastro individual ativo', async () => { database(null, null); expect(await getActiveClienteAuth(request())).not.toBeNull() })
 it('nega quando a empresa vinculada não é encontrada', async () => { database(null); expect(await getActiveClienteAuth(request())).toBeNull() })
 it('libera funcionário pendente com exceção vigente sem mudar o status financeiro', async () => { database('PENDENTE_PAGAMENTO', 'empresa-local', { id: 'exception-1' }, 'PENDENTE_PAGAMENTO'); expect(await getActiveClienteAuth(request())).toMatchObject({ clienteId: 'local-id' }) })
 it('nega funcionário pendente sem exceção', async () => { database('PENDENTE_PAGAMENTO', 'empresa-local', null, 'PENDENTE_PAGAMENTO'); expect(await getActiveClienteAuth(request())).toBeNull() })
 it('não permite exceção para empresa inativa', async () => { database('INATIVO', 'empresa-local', { id: 'exception-1' }, 'PENDENTE_PAGAMENTO'); expect(await getActiveClienteAuth(request())).toBeNull() })
})
