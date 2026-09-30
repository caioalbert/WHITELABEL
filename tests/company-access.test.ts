import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ verify: vi.fn(), db: vi.fn(), cookies: vi.fn() }))
vi.mock('jose', () => ({ jwtVerify: mocks.verify }))
vi.mock('next/headers', () => ({ cookies: mocks.cookies }))
vi.mock('../lib/auth-secret', () => ({ getJwtSecret: () => new Uint8Array([1]) }))
vi.mock('../lib/supabase/admin', () => ({ createAdminClient: mocks.db }))
import { getActiveClienteAuth } from '../lib/supabase/cliente-auth'
const request = () => new Request('http://localhost', { headers: { Authorization: 'Bearer local-only' } })
beforeEach(() => { vi.clearAllMocks(); mocks.verify.mockResolvedValue({ payload: { clienteId: 'local-id', cpf: '52998224725', nome: 'Pessoa local', tipo: 'titular' } }) })
function database(companyStatus: string | null, empresaId: string | null = 'empresa-local') {
 mocks.db.mockReturnValue({ from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'cadastros' ? { status: 'ATIVO', empresa_id: empresaId } : companyStatus ? { status: companyStatus } : null, error: null }) }) }) }) })
}
describe('acesso empresarial após inativação', () => {
 it('bloqueia um token já emitido quando a empresa está inativa', async () => { database('INATIVO'); expect(await getActiveClienteAuth(request())).toBeNull() })
 it('bloqueia dependentes da empresa inativa', async () => { database('INATIVO'); mocks.verify.mockResolvedValue({ payload: { clienteId: 'local-id', tipo: 'dependente', dependenteId: 'dep-local' } }); expect(await getActiveClienteAuth(request())).toBeNull() })
 it('libera após reativação sem mudar histórico financeiro', async () => { database('ATIVO'); expect(await getActiveClienteAuth(request())).toMatchObject({ clienteId: 'local-id' }) })
 it('preserva acesso de cadastro individual ativo', async () => { database(null, null); expect(await getActiveClienteAuth(request())).not.toBeNull() })
 it('nega quando a empresa vinculada não é encontrada', async () => { database(null); expect(await getActiveClienteAuth(request())).toBeNull() })
})
