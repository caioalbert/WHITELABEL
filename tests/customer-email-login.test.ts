import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'
const mocks = vi.hoisted(() => ({ db: vi.fn(), cookies: vi.fn() }))
vi.mock('../lib/supabase/admin', () => ({ createAdminClient: mocks.db }))
vi.mock('next/headers', () => ({ cookies: mocks.cookies }))
import { POST } from '../app/api/cliente/login/route'
import { POST as logout } from '../app/api/cliente/logout/route'
import { getClienteAuthFromRequest } from '../lib/supabase/cliente-auth'
import { createCadastroFlowToken, getCadastroFlowId } from '../lib/supabase/cadastro-flow-auth'
import { createEmpresaToken, getEmpresaFlowAuth } from '../lib/supabase/empresa-auth'
import { authKey, codeHash } from '../lib/customer-email-auth'
import { getJwtSecret } from '../lib/auth-secret'

const holder = '00000000-0000-4000-8000-000000000001', sessionId = '00000000-0000-4000-8000-000000000003'
const challengeId = '00000000-0000-4000-8000-000000000002'
const identity = { tipo: 'titular', identityId: holder, clienteId: holder, cpf: '52998224725', nome: 'Pessoa fictícia', email: 'local@example.test', status: 'ATIVO' }
let db: any, rpc: ReturnType<typeof vi.fn>, updates: unknown[], revoked: string[]
beforeEach(() => {
  vi.clearAllMocks()
  process.env.JWT_SECRET = 'only-local-tests-no-production-secret-64-characters-long'
  process.env.RESEND_API_KEY = 'local-placeholder'
  process.env.RESEND_FROM_EMAIL = 'Nova <noreply@example.test>'
  updates = []; revoked = []
  rpc = vi.fn(async (name: string) => ({ data: name === 'customer_login_identity' || name === 'customer_login_validate_session' ? identity : name === 'customer_login_consume' ? { id: sessionId, expiresAt: new Date(Date.now()+86400000).toISOString() } : true, error: null }))
  db = { rpc, from: (table: string) => { const q: any = { update: (value: unknown) => { updates.push(value); return q }, eq: (_field: string, value: string) => { if (table === 'customer_login_sessions') revoked.push(value); return q }, is: async () => ({ error: null }), then: (resolve: (v: unknown) => void) => resolve({ error: null }) }; return q } }
  mocks.db.mockReturnValue(db)
  mocks.cookies.mockResolvedValue({ get: () => undefined })
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
})
const post = (body: unknown) => POST(new NextRequest('http://localhost/api/cliente/login', { method: 'POST', body: JSON.stringify(body) }))
const verifyInput = { action: 'verify', cpf: '529.982.247-25', challengeId, code: '123456' }

describe('shared customer login boundary', () => {
  it('rejects both predictable password representations before touching the database', async () => {
    expect((await post({ cpf: '52998224725', cpf_prefix: '5299' })).status).toBe(426)
    expect((await post({ cnpj: '05251823000103', cnpj_prefix: '0525' })).status).toBe(426)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejects document aliases with letters, dual identities, invalid checksums, and non-ASCII codes', async () => {
    for (const input of [{ ...verifyInput, cpf: 'x52998224725' }, { ...verifyInput, cnpj: '05251823000103' }, { ...verifyInput, email: 'attacker@example.test' }, { ...verifyInput, cpf: '52998224726' }, { ...verifyInput, code: '１２３４５６' }, { ...verifyInput, code: '1234567' }]) expect((await post(input)).status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('sends one named text message through Resend without issuing any session', async () => {
    const response = await post({ action: 'request', cpf: identity.cpf })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.challengeId).toMatch(/^[0-9a-f-]{36}$/)
    expect(json.token).toBeUndefined(); expect(response.headers.get('set-cookie')).toBeNull()
    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    const message = JSON.parse(options!.body as string)
    expect(message.to).toEqual(['local@example.test']); expect(message.text).toContain('Pessoa fictícia')
    expect(message.text).toMatch(/\d{6}/); expect(message.text).not.toContain(identity.cpf)
    expect(updates).toContainEqual({ delivered: true })
  })
  it('unknown contacts receive the same request contract with no email or session', async () => {
    rpc.mockImplementation(async name => ({ data: name === 'customer_login_identity' ? null : true, error: null }))
    const response = await post({ action: 'request', cpf: identity.cpf })
    expect(response.status).toBe(200); expect((await response.json()).challengeId).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled(); expect(response.headers.get('set-cookie')).toBeNull()
  })
  it('provider/configuration outages and durable send limits never create a session', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
    expect((await post({ action: 'request', cpf: identity.cpf })).status).toBe(503)
    expect(updates.some(v => Boolean((v as any).consumed_at))).toBe(true)
    delete process.env.RESEND_API_KEY
    expect((await post({ action: 'request', cpf: identity.cpf })).status).toBe(503)
    expect(rpc.mock.calls.every(([name]) => name !== 'customer_login_consume')).toBe(true)
  })
  it('failed or replayed codes do not issue cookies/Bearer tokens', async () => {
    rpc.mockImplementation(async name => ({ data: name === 'customer_login_consume' ? null : name === 'customer_login_identity' ? identity : true, error: null }))
    const response = await post(verifyInput)
    expect(response.status).toBe(401); expect(response.headers.get('set-cookie')).toBeNull()
    expect((await response.json()).token).toBeUndefined()
  })
  it('valid proof issues a normalized, versioned 24-hour session and validates both cookie and Bearer', async () => {
    const response = await post(verifyInput), json = await response.json()
    expect(response.status).toBe(200)
    const { payload } = await jwtVerify(json.token, getJwtSecret())
    expect(payload).toMatchObject({ authVersion: 2, authMethod: 'email-otp-v1', purpose: 'cliente', jti: sessionId, cpf: identity.cpf })
    expect(payload.exp! - payload.iat!).toBeLessThanOrEqual(86400)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=86400')
    expect(await getClienteAuthFromRequest(new Request('http://localhost', { headers: { Authorization: `Bearer ${json.token}` } }))).toMatchObject({ clienteId: holder })
    mocks.cookies.mockResolvedValue({ get: () => ({ value: json.token }) })
    expect(await getClienteAuthFromRequest(new Request('http://localhost'))).not.toBeNull()
  })
  it('rejects old signed tokens and rejects revoked/expired/changed-email database sessions', async () => {
    const legacy = await new SignJWT({ clienteId: holder, cpf: identity.cpf, nome: identity.nome, tipo: 'titular' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('7d').sign(getJwtSecret())
    expect(await getClienteAuthFromRequest(new Request('http://localhost', { headers: { Authorization: `Bearer ${legacy}` } }))).toBeNull()
    const response = await post(verifyInput), { token } = await response.json()
    rpc.mockResolvedValue({ data: null, error: null })
    expect(await getClienteAuthFromRequest(new Request('http://localhost', { headers: { Authorization: `Bearer ${token}` } }))).toBeNull()
  })
  it('propagates a database outage instead of turning it into logout', async () => {
    const response = await post(verifyInput), { token } = await response.json()
    rpc.mockResolvedValue({ data: null, error: { message: 'outage' } })
    await expect(getClienteAuthFromRequest(new Request('http://localhost', { headers: { Authorization: `Bearer ${token}` } }))).rejects.toThrow('Não foi possível verificar seu acesso')
  })
  it('revokes different Bearer and cookie sessions on logout', async () => {
    const response = await post(verifyInput), { token } = await response.json()
    const other = await new SignJWT({ authVersion: 2, authMethod: 'email-otp-v1' }).setProtectedHeader({ alg: 'HS256' })
      .setJti(challengeId).setExpirationTime('24h').sign(getJwtSecret())
    mocks.cookies.mockResolvedValue({ get: (name: string) => name === 'cliente_token' ? { value: other } : undefined })
    const result = await logout(new NextRequest('http://localhost/api/cliente/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }))
    expect(result.status).toBe(200); expect(revoked).toEqual([sessionId, challengeId])
  })
  it('preserves pending titular activation and denies pending dependent only after valid proof', async () => {
    let row: any = { ...identity, status: 'PENDENTE_PAGAMENTO' }
    rpc.mockImplementation(async name => ({ data: name === 'customer_login_identity' ? row : name === 'customer_login_consume' ? { id: sessionId, expiresAt: new Date(Date.now()+86400000).toISOString() } : true, error: null }))
    const response = await post(verifyInput)
    expect((await response.json()).nextPath).toBe('/cadastro/status'); expect(response.headers.get('set-cookie')).toContain('cadastro_fluxo_token')
    row = { ...row, tipo: 'dependente', identityId: challengeId }
    const denied = await post(verifyInput)
    expect(denied.status).toBe(403); expect(denied.headers.get('set-cookie')).toBeNull(); expect(revoked).toContain(sessionId)
    rpc.mockImplementation(async name => ({ data: name === 'customer_login_identity' ? row : name === 'customer_login_consume' ? null : true, error: null }))
    expect((await post(verifyInput)).status).toBe(401)
  })
  it('preserves corporate access by CNPJ only after email proof', async () => {
    const row = { tipo: 'empresa', identityId: holder, cnpj: '05251823000103', nome: 'Empresa fictícia', razaoSocial: 'Empresa local', email: 'company@example.test', status: 'ATIVO' }
    rpc.mockImplementation(async name => ({ data: name === 'customer_login_identity' ? row : name === 'customer_login_consume' ? { id: sessionId, expiresAt: new Date(Date.now()+86400000).toISOString() } : true, error: null }))
    const result = await post({ action: 'verify', cnpj: row.cnpj, challengeId, code: '123456' })
    expect(result.status).toBe(200); expect((await result.json()).nextPath).toBe('/empresa/dashboard')
    expect(result.headers.get('set-cookie')).toContain('empresa_token=')
  })
  it('keeps fresh registration flows restricted and rejects legacy flow tokens', async () => {
    const flow = await createCadastroFlowToken(holder)
    mocks.cookies.mockResolvedValue({ get: () => ({ value: flow }) })
    expect(await getCadastroFlowId()).toBe(holder)
    expect(await getClienteAuthFromRequest(new Request('http://localhost', { headers: { Authorization: `Bearer ${flow}` } }))).toBeNull()
    const company = await createEmpresaToken({ id: holder, cnpj: '05251823000103', razao_social: 'Local' }, 'empresa-flow')
    mocks.cookies.mockResolvedValue({ get: () => ({ value: company }) })
    expect(await getEmpresaFlowAuth()).toMatchObject({ purpose: 'empresa-flow' })
    await expect(createEmpresaToken({ id: holder, cnpj: '05251823000103', razao_social: 'Local' }, 'empresa-app')).rejects.toThrow('confirmação')
    const old = await new SignJWT({ cadastroId: holder, purpose: 'cadastro-flow' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('24h').sign(getJwtSecret())
    mocks.cookies.mockResolvedValue({ get: () => ({ value: old }) }); expect(await getCadastroFlowId()).toBeNull()
  })
  it('uses domain-separated hashes and binds the code to its challenge', () => {
    expect(authKey('document', identity.cpf)).not.toBe(authKey('email', identity.cpf))
    expect(codeHash(challengeId, '123456')).not.toBe(codeHash(sessionId, '123456'))
  })
})
