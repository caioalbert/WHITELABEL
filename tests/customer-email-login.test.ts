import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'
const mocks = vi.hoisted(() => ({ db: vi.fn(), cookies: vi.fn(), verify: vi.fn(), hash: vi.fn() }))
vi.mock('../lib/supabase/admin', () => ({ createAdminClient: mocks.db }))
vi.mock('next/headers', () => ({ cookies: mocks.cookies }))
vi.mock('../lib/customer-password', async importOriginal => ({ ...await importOriginal<any>(), verifyCustomerPassword: mocks.verify, hashCustomerPassword: mocks.hash }))
import { POST } from '../app/api/cliente/login/route'
import { POST as setPassword } from '../app/api/cliente/password/route'
import { POST as logout } from '../app/api/cliente/logout/route'
import { getClienteAuthFromRequest } from '../lib/supabase/cliente-auth'
import { createCadastroFlowToken, getCadastroFlowId } from '../lib/supabase/cadastro-flow-auth'
import { createEmpresaToken, getEmpresaFlowAuth } from '../lib/supabase/empresa-auth'
import { authKey, codeHash, signEmailSession } from '../lib/customer-email-auth'
import { getJwtSecret } from '../lib/auth-secret'

const holder = '00000000-0000-4000-8000-000000000001', sessionId = '00000000-0000-4000-8000-000000000003'
const challengeId = '00000000-0000-4000-8000-000000000002'
const identity = { tipo: 'titular', identityId: holder, clienteId: holder, cpf: '52998224725', nome: 'Pessoa fictícia', email: 'local@example.test', status: 'ATIVO' }
const initial = 'InitialPass123456', personal = 'Minha frase pessoal de acesso', encoding = `nas-scrypt-v1$${'a'.repeat(32)}$${'b'.repeat(64)}`
let rpc: ReturnType<typeof vi.fn>, updates: unknown[], revoked: string[], row: any, credentials: any, challengeAvailable: boolean
beforeEach(() => {
  vi.clearAllMocks()
  process.env.JWT_SECRET = 'only-local-tests-no-production-secret-64-characters-long'
  process.env.RESEND_API_KEY = 'local-placeholder'; process.env.RESEND_FROM_EMAIL = 'Nova <noreply@example.test>'
  updates = []; revoked = []; row = { ...identity }; credentials = null; challengeAvailable = true
  mocks.verify.mockImplementation(async password => password === personal)
  mocks.hash.mockResolvedValue(encoding)
  rpc = vi.fn(async (name: string, args: any) => ({ data: name === 'customer_login_identity' || name === 'customer_login_validate_session' ? row
    : name === 'customer_login_consume' ? args.p_code_hash === codeHash(challengeId, initial) ? { id: sessionId, expiresAt: new Date(Date.now()+1200000).toISOString() } : null
    : ['customer_password_set','customer_password_create_session'].includes(name) ? { id: sessionId, expiresAt: new Date(Date.now()+86400000).toISOString() } : true, error: null }))
  const db = { rpc, from: (table: string) => { const q: any = {
    select: () => q, update: (value: unknown) => { updates.push(value); return q },
    eq: (_field: string, value: string) => { if (table === 'customer_login_sessions') revoked.push(value); return q },
    is: () => q, gt: () => q, order: () => q, limit: () => q,
    maybeSingle: async () => ({ data: table === 'customer_password_credentials' ? credentials : table === 'customer_login_challenges' && challengeAvailable ? { id: challengeId, code_hash: codeHash(challengeId, initial) } : null, error: null }),
    then: (resolve: (v: unknown) => void) => resolve({ error: null }),
  }; return q } }
  mocks.db.mockReturnValue(db); mocks.cookies.mockResolvedValue({ get: () => undefined })
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
})
const post = (body: unknown) => POST(new NextRequest('http://localhost/api/cliente/login', { method: 'POST', body: JSON.stringify(body) }))
const passwordInput = { action: 'password', cpf: '529.982.247-25', password: initial }
const set = (token: string, password = personal, confirmation = password) => setPassword(new NextRequest('http://localhost/api/cliente/password', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ password, confirmation }) }))
async function setup() { return (await (await post(passwordInput)).json()).setupToken }
function personalCredential() { credentials = { password_hash: encoding, document_key: authKey('document', identity.cpf), email_key: authKey('email', identity.email) } }

describe('initial password and mandatory setup boundary', () => {
  it('rejects legacy prefix/code clients before touching the database', async () => {
    for (const body of [{ cpf: identity.cpf, cpf_prefix: '5299' }, { cnpj: '05251823000103', cnpj_prefix: '0525' }, { action: 'verify', cpf: identity.cpf, code: '123456', challengeId }]) expect((await post(body)).status).toBe(426)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejects invalid checksums, aliases, caller recipient and dual identities', async () => {
    for (const input of [{ ...passwordInput, cpf: 'x52998224725' }, { ...passwordInput, cnpj: '05251823000103' }, { ...passwordInput, email: 'attacker@example.test' }, { ...passwordInput, cpf: '52998224726' }, { ...passwordInput, password: 'a'.repeat(513) }]) expect((await post(input)).status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('sends one named HTML/text email with inline logo to the stored contact and issues no session', async () => {
    const response = await post({ action: 'request', cpf: identity.cpf })
    expect(response.status).toBe(200); const json = await response.json()
    expect(json.challengeId).toBeUndefined(); expect(json.token).toBeUndefined(); expect(response.headers.get('set-cookie')).toBeNull()
    const [url, options] = vi.mocked(fetch).mock.calls[0]; expect(url).toBe('https://api.resend.com/emails')
    const message = JSON.parse(options!.body as string)
    expect(message.to).toEqual(['local@example.test']); expect(message.html).toContain('Pessoa fictícia'); expect(message.text).toContain('Pessoa fictícia')
    expect(message.text).toMatch(/temporária.*[A-Za-z0-9_-]{16}/); expect(message.text).not.toContain(identity.cpf)
    expect(message.html).toContain('cid:nova-alianca-logo'); expect(message.attachments[0].content_id).toBe('nova-alianca-logo')
    expect(message.html).toContain('Válida até o primeiro uso'); expect(updates).toContainEqual({ delivered: true })
    expect(rpc.mock.calls.some(([name]) => name === 'customer_password_reserve')).toBe(true)
  })
  it('unknown contacts keep the same request contract without an email or session', async () => {
    row = null
    const response = await post({ action: 'request', cpf: identity.cpf })
    expect(response.status).toBe(200); expect((await response.json()).retryAfter).toBe(60)
    expect(fetch).not.toHaveBeenCalled(); expect(response.headers.get('set-cookie')).toBeNull()
  })
  it('provider/configuration outages consume failed delivery without granting access', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
    expect((await post({ action: 'request', cpf: identity.cpf })).status).toBe(503)
    expect(updates.some(v => Boolean((v as any).consumed_at))).toBe(true)
    delete process.env.RESEND_API_KEY; expect((await post({ action: 'request', cpf: identity.cpf })).status).toBe(503)
  })
  it('enforces durable password limits before expensive hashing and identity lookup', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    expect((await post(passwordInput)).status).toBe(429); expect(mocks.verify).not.toHaveBeenCalled()
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(['customer_password_attempt'])
  })
  it('invalid or already-used initial passwords grant no cookie or account token', async () => {
    const bad = await post({ ...passwordInput, password: 'WrongInitialPass' }); expect(bad.status).toBe(401)
    challengeAvailable = false; const replay = await post(passwordInput); expect(replay.status).toBe(401)
    expect(replay.headers.get('set-cookie')).toBeNull(); expect((await replay.json()).token).toBeUndefined()
  })
  it('a first-use proof grants only a 20-minute setup token, unusable by the account reader', async () => {
    const response = await post(passwordInput), data = await response.json()
    expect(data).toMatchObject({ requiresPasswordChange: true }); expect(data.token).toBeUndefined(); expect(data.cliente).toBeUndefined()
    expect(response.headers.get('set-cookie')).toBeNull(); expect(response.headers.get('cache-control')).toBe('no-store')
    const { payload } = await jwtVerify(data.setupToken, getJwtSecret())
    expect(payload).toMatchObject({ purpose: 'password-setup', challengeId, authVersion: 3, authMethod: 'customer-password-v1' })
    expect(payload.exp! - payload.iat!).toBeLessThanOrEqual(1200)
    expect(await getClienteAuthFromRequest(new Request('http://localhost', { headers: { Authorization: `Bearer ${data.setupToken}` } }))).toBeNull()
    expect(rpc.mock.calls.find(([name]) => name === 'customer_login_consume')![1].p_purpose).toBe('password-setup')
  })
  it('requires matching, strong, different personal passwords and a valid live setup session', async () => {
    const token = await setup()
    expect((await set(token, initial)).status).toBe(400)
    expect((await set(token, 'short')).status).toBe(400)
    expect((await set(token, personal, 'different confirmation')).status).toBe(400)
    expect((await set('not-a-token')).status).toBe(401)
    rpc.mockResolvedValue({ data: null, error: null }); expect((await set(token)).status).toBe(401)
    expect(mocks.hash).not.toHaveBeenCalled()
  })
  it('only completed setup saves a hash and creates a versioned 24-hour account session', async () => {
    const response = await set(await setup()), data = await response.json()
    expect(response.status).toBe(200); expect(response.headers.get('set-cookie')).toContain('Max-Age=86400')
    const args = rpc.mock.calls.find(([name]) => name === 'customer_password_set')![1]
    expect(args.p_password_hash).toBe(encoding); expect(args.p_challenge_id).toBe(challengeId); expect(JSON.stringify(args)).not.toContain(personal)
    const { payload } = await jwtVerify(data.token, getJwtSecret())
    expect(payload).toMatchObject({ authVersion: 3, authMethod: 'customer-password-v1', purpose: 'cliente', cpf: identity.cpf, jti: sessionId })
    expect(payload.exp! - payload.iat!).toBeLessThanOrEqual(86400)
    expect(await getClienteAuthFromRequest(new Request('http://localhost', { headers: { Authorization: `Bearer ${data.token}` } }))).toMatchObject({ clienteId: holder })
    mocks.cookies.mockResolvedValue({ get: () => ({ value: data.token }) }); expect(await getClienteAuthFromRequest(new Request('http://localhost'))).not.toBeNull()
  })
  it('subsequent personal-password login does not send email or require setup again', async () => {
    personalCredential(); const response = await post({ ...passwordInput, password: personal }), data = await response.json()
    expect(response.status).toBe(200); expect(data.token).toBeTruthy(); expect(data.requiresPasswordChange).toBeUndefined()
    expect(fetch).not.toHaveBeenCalled(); expect(rpc.mock.calls.some(([name]) => name === 'customer_login_consume')).toBe(false)
  })
  it('unknown users perform dummy verification and changed email bindings deny personal access', async () => {
    row = null; expect((await post(passwordInput)).status).toBe(401); expect(mocks.verify).toHaveBeenCalledWith(initial, null)
    row = identity; personalCredential(); credentials.email_key = 'x'.repeat(64)
    expect((await post({ ...passwordInput, password: personal })).status).toBe(401)
    expect(rpc.mock.calls.some(([name]) => name === 'customer_password_create_session')).toBe(false)
  })
  it('rejects old signed sessions and propagates database outages instead of causing logout', async () => {
    const old = await new SignJWT({ authVersion: 2, authMethod: 'email-otp-v1', clienteId: holder, cpf: identity.cpf, nome: identity.nome, tipo: 'titular' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('24h').sign(getJwtSecret())
    expect(await getClienteAuthFromRequest(new Request('http://localhost', { headers: { Authorization: `Bearer ${old}` } }))).toBeNull()
    personalCredential(); const { token } = await (await post({ ...passwordInput, password: personal })).json()
    rpc.mockResolvedValue({ data: null, error: { message: 'outage' } })
    await expect(getClienteAuthFromRequest(new Request('http://localhost', { headers: { Authorization: `Bearer ${token}` } }))).rejects.toThrow('Não foi possível verificar seu acesso')
  })
  it('revokes separate Bearer and cookie sessions on logout', async () => {
    personalCredential(); const { token } = await (await post({ ...passwordInput, password: personal })).json()
    const other = await signEmailSession({ purpose: 'cliente' }, { id: challengeId, expiresAt: new Date(Date.now()+86400000).toISOString() })
    mocks.cookies.mockResolvedValue({ get: (name: string) => name === 'cliente_token' ? { value: other } : undefined })
    const response = await logout(new NextRequest('http://localhost/api/cliente/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }))
    expect(response.status).toBe(200); expect(revoked).toEqual([sessionId, challengeId])
  })
  it('preserves pending titular activation and denies pending dependent after completed setup', async () => {
    row = { ...identity, status: 'PENDENTE_PAGAMENTO' }
    const response = await set(await setup()); expect((await response.json()).nextPath).toBe('/cadastro/status')
    expect(response.headers.get('set-cookie')).toContain('cadastro_fluxo_token')
    row = { ...row, tipo: 'dependente', identityId: challengeId }
    const denied = await set(await setup()); expect(denied.status).toBe(403); expect((await denied.json()).passwordUpdated).toBe(true)
    expect(denied.headers.get('set-cookie')).toBeNull(); expect(revoked).toContain(sessionId)
  })
  it('preserves corporate CNPJ access only after password creation', async () => {
    row = { tipo: 'empresa', identityId: holder, cnpj: '05251823000103', nome: 'Empresa fictícia', razaoSocial: 'Empresa local', email: 'company@example.test', status: 'ATIVO' }
    const first = await post({ action: 'password', cnpj: row.cnpj, password: initial }), data = await first.json()
    expect(data.requiresPasswordChange).toBe(true); expect(first.headers.get('set-cookie')).toBeNull()
    const response = await set(data.setupToken); expect(response.status).toBe(200); expect((await response.json()).nextPath).toBe('/empresa/dashboard')
    expect(response.headers.get('set-cookie')).toContain('empresa_token=')
  })
  it('keeps new registration flows restricted and rejects legacy flow tokens', async () => {
    const flow = await createCadastroFlowToken(holder); mocks.cookies.mockResolvedValue({ get: () => ({ value: flow }) })
    expect(await getCadastroFlowId()).toBe(holder)
    expect(await getClienteAuthFromRequest(new Request('http://localhost', { headers: { Authorization: `Bearer ${flow}` } }))).toBeNull()
    const company = await createEmpresaToken({ id: holder, cnpj: '05251823000103', razao_social: 'Local' }, 'empresa-flow')
    mocks.cookies.mockResolvedValue({ get: () => ({ value: company }) }); expect(await getEmpresaFlowAuth()).toMatchObject({ purpose: 'empresa-flow' })
    await expect(createEmpresaToken({ id: holder, cnpj: '05251823000103', razao_social: 'Local' }, 'empresa-app')).rejects.toThrow('confirmação')
    const old = await new SignJWT({ cadastroId: holder, purpose: 'cadastro-flow' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('24h').sign(getJwtSecret())
    mocks.cookies.mockResolvedValue({ get: () => ({ value: old }) }); expect(await getCadastroFlowId()).toBeNull()
  })
  it('binds initial password hashes to their challenge and keeps document/email domains separate', () => {
    expect(authKey('document', identity.cpf)).not.toBe(authKey('email', identity.cpf))
    expect(codeHash(challengeId, initial)).not.toBe(codeHash(sessionId, initial))
  })
})
