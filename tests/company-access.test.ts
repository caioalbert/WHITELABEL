import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ verify: vi.fn(), db: vi.fn(), cookies: vi.fn() }))
vi.mock('jose', () => ({ jwtVerify: mocks.verify }))
vi.mock('next/headers', () => ({ cookies: mocks.cookies }))
vi.mock('../lib/auth-secret', () => ({ getJwtSecret: () => new Uint8Array([1]) }))
vi.mock('../lib/supabase/admin', () => ({ createAdminClient: mocks.db }))
import { getActiveClienteAuth } from '../lib/supabase/cliente-auth'
const request = () => new Request('http://localhost', { headers: { Authorization: 'Bearer local-only' } })
beforeEach(() => { vi.clearAllMocks(); mocks.verify.mockResolvedValue({ payload: { clienteId: '00000000-0000-4000-8000-000000000001', cpf: '52998224725', nome: 'Pessoa local', exp: Math.floor(Date.now()/1000)+3600, tipo: 'titular' } }) })
function database(companyStatus: string | null, empresaId: string | null = 'empresa-local', exception: unknown = null, cadastroStatus = 'ATIVO') {
 mocks.db.mockReturnValue({ from: (table: string) => {
  const query: any = { eq: () => query, is: () => query, gt: () => query, order: () => query, limit: () => query, maybeSingle: async () => ({ data: table === 'cadastros' ? { status: cadastroStatus, empresa_id: empresaId } : table === 'dependentes' ? { id: '00000000-0000-4000-8000-000000000002' } : table === 'empresas' ? companyStatus ? { status: companyStatus } : null : exception, error: null }) }
  return { select: () => query }
 } })
}
describe('acesso empresarial após inativação', () => {
 it('rejeita token de outro fluxo sem identidade completa', async () => { database('ATIVO'); mocks.verify.mockResolvedValue({ payload: { clienteId: '00000000-0000-4000-8000-000000000001' } }); expect(await getActiveClienteAuth(request())).toBeNull() })
 it('propaga indisponibilidade do banco em vez de considerar a sessão inválida', async () => { mocks.db.mockReturnValue({ from: () => { const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: null, error: new Error('outage') }) }; return query } }); await expect(getActiveClienteAuth(request())).rejects.toThrow('Não foi possível verificar seu acesso') })
 it('bloqueia um token já emitido quando a empresa está inativa', async () => { database('INATIVO'); expect(await getActiveClienteAuth(request())).toBeNull() })
 it('bloqueia dependentes da empresa inativa', async () => { database('INATIVO'); mocks.verify.mockResolvedValue({ payload: { clienteId: '00000000-0000-4000-8000-000000000001', cpf: '52998224725', nome: 'Pessoa local', exp: Math.floor(Date.now()/1000)+3600, tipo: 'dependente', dependenteId: '00000000-0000-4000-8000-000000000002' } }); expect(await getActiveClienteAuth(request())).toBeNull() })
 it('libera após reativação sem mudar histórico financeiro', async () => { database('ATIVO'); expect(await getActiveClienteAuth(request())).toMatchObject({ clienteId: '00000000-0000-4000-8000-000000000001' }) })
 it('preserva acesso de cadastro individual ativo', async () => { database(null, null); expect(await getActiveClienteAuth(request())).not.toBeNull() })
 it('nega quando a empresa vinculada não é encontrada', async () => { database(null); expect(await getActiveClienteAuth(request())).toBeNull() })
 it('libera funcionário pendente com exceção vigente sem mudar o status financeiro', async () => { database('PENDENTE_PAGAMENTO', 'empresa-local', { id: 'exception-1' }, 'PENDENTE_PAGAMENTO'); expect(await getActiveClienteAuth(request())).toMatchObject({ clienteId: '00000000-0000-4000-8000-000000000001' }) })
 it('nega funcionário pendente sem exceção', async () => { database('PENDENTE_PAGAMENTO', 'empresa-local', null, 'PENDENTE_PAGAMENTO'); expect(await getActiveClienteAuth(request())).toBeNull() })
 it('não permite exceção para empresa inativa', async () => { database('INATIVO', 'empresa-local', { id: 'exception-1' }, 'PENDENTE_PAGAMENTO'); expect(await getActiveClienteAuth(request())).toBeNull() })
})
