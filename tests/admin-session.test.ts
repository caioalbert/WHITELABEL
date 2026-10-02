import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getSession: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), create: vi.fn() }))
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.create }))
import { ADMIN_AUTH_COOKIE, ADMIN_SESSION_SECONDS, ADMIN_WINDOW_COOKIE, clearAdminCookies, createAdminSessionClient, readAdminWindow, signAdminWindow } from '../lib/supabase/admin-session'
import { requireAdminAuth } from '../lib/supabase/admin-auth'
import { updateSession } from '../lib/supabase/middleware'
import { POST as login } from '../app/api/admin/login/route'
import { POST as logout } from '../app/api/admin/logout/route'

const user = { id: '00000000-0000-4000-8000-000000000001', email: 'admin@example.com', app_metadata: { role: 'admin' } }
const session = { access_token: 'short-lived-access', refresh_token: 'refresh-only-server' }
const secret = 'test-only-secret-with-at-least-32-characters'
let options: { cookies: { setAll: (writes: Array<{ name: string; value: string; options: object }>) => void } }
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', secret)
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:4194'); vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-only')
  mocks.getUser.mockResolvedValue({ data: { user }, error: null })
  mocks.getSession.mockResolvedValue({ data: { session }, error: null })
  mocks.signIn.mockResolvedValue({ data: { user, session }, error: null })
  mocks.signOut.mockResolvedValue({ error: null })
  mocks.create.mockImplementation((_url, _key, value) => { options = value; return { auth: { getUser: mocks.getUser, getSession: mocks.getSession, signInWithPassword: mocks.signIn, signOut: mocks.signOut } } })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })
async function authenticated(path = '/admin/empresas', init?: ConstructorParameters<typeof NextRequest>[1]) {
  const { token } = await signAdminWindow(user.id)
  const request = new NextRequest(`http://localhost${path}`, init)
  request.cookies.set(ADMIN_WINDOW_COOKIE, token)
  request.cookies.set(ADMIN_AUTH_COOKIE, 'test-session')
  return request
}
describe('prazo e integridade da sessão administrativa', () => {
  it('vence exatamente após 24 horas sem prolongar o prazo a cada navegação', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-01T10:00:00Z'))
    const { token, expiresAt } = await signAdminWindow(user.id)
    expect(expiresAt - Math.floor(Date.now() / 1000)).toBe(ADMIN_SESSION_SECONDS)
    vi.setSystemTime(new Date('2026-10-02T09:59:59Z')); expect(await readAdminWindow(token)).not.toBeNull()
    vi.setSystemTime(new Date('2026-10-02T10:00:00Z')); expect(await readAdminWindow(token)).toBeNull()
  })
  it('exige credencial privada válida sem aceitar segredo padrão', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    await expect(signAdminWindow(user.id)).rejects.toThrow()
  })
  it('não aceita prazo adulterado nem JWT de outra finalidade', async () => {
    const { token } = await signAdminWindow(user.id)
    expect(await readAdminWindow(token.slice(0, -5) + 'xxxxx')).toBeNull()
    const other = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setExpirationTime('24h').setAudience('cliente').sign(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`whitelabel-admin-session-window:v1:${secret}`))))
    expect(await readAdminWindow(other)).toBeNull()
  })
  it('rejeita sessão sem assinatura ou de outro usuário', async () => {
    expect((await requireAdminAuth(new NextRequest('http://localhost/admin/empresas'))).ok).toBe(false)
    const req = await authenticated(); mocks.getUser.mockResolvedValue({ data: { user: { ...user, id: 'other-user' } }, error: null })
    expect(await requireAdminAuth(req)).toMatchObject({ ok: false, status: 401 })
  })
  it('não concede privilégio vindo de user_metadata', async () => {
    const req = await authenticated(); mocks.getUser.mockResolvedValue({ data: { user: { ...user, app_metadata: {}, user_metadata: { role: 'admin', is_admin: true } } }, error: null })
    expect(await requireAdminAuth(req)).toMatchObject({ ok: false, status: 403 })
  })
  it('limita o cookie renovado ao restante das 24 horas e mantém HttpOnly', () => {
    const req = new NextRequest('http://localhost/admin/empresas')
    const { pendingCookies } = createAdminSessionClient(req, Math.floor(Date.now() / 1000) + 120)
    options.cookies.setAll([{ name: 'admin-auth.0', value: 'rotated', options: { maxAge: 9999999, httpOnly: false } }])
    expect(pendingCookies[0].options).toMatchObject({ maxAge: 120, httpOnly: true, sameSite: 'lax', path: '/' })
  })
})
describe('navegação e falhas de autenticação', () => {
  it('propaga tokens renovados para o pedido atual e para o navegador', async () => {
    const req = await authenticated()
    mocks.getUser.mockImplementation(async () => { options.cookies.setAll([{ name: 'admin-auth.0', value: 'renewed', options: {} }]); return { data: { user }, error: null } })
    const response = await updateSession(req)
    expect(req.cookies.get('admin-auth.0')?.value).toBe('renewed')
    expect(response.cookies.get('admin-auth.0')?.value).toBe('renewed')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
  it('uma indisponibilidade não redireciona nem apaga os cookies', async () => {
    const req = await authenticated(); mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503, message: 'Auth indisponível' } })
    const response = await updateSession(req)
    expect(response.status).toBe(503); expect(response.headers.get('location')).toBeNull(); expect(response.headers.get('set-cookie')).toBeNull()
  })
  it('expiração efetiva redireciona páginas e devolve 401 para APIs', async () => {
    const page = await updateSession(new NextRequest('http://localhost/admin/empresas'))
    expect(page.status).toBe(307); expect(page.headers.get('location')).toBe('http://localhost/admin/login')
    expect((await updateSession(new NextRequest('http://localhost/api/admin/empresas'))).status).toBe(401)
  })
  it('bloqueia a origem externa antes de autenticar ou executar ações', async () => {
    const req = await authenticated('/api/admin/empresas', { method: 'POST', headers: { origin: 'https://attacker.example' } })
    expect((await updateSession(req)).status).toBe(403); expect(mocks.create).not.toHaveBeenCalled()
  })
  it('aceita a origem local mesmo quando NextURL normaliza o host', async () => {
    const req = await authenticated('/api/admin/empresas', { method: 'POST', headers: { origin: 'http://127.0.0.1', host: '127.0.0.1' } })
    expect((await requireAdminAuth(req)).ok).toBe(true)
  })
  it('preserva cron autorizado sem conceder acesso a outro endpoint', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-only-test')
    const init = { method: 'POST', headers: { authorization: 'Bearer cron-only-test' } }
    expect((await updateSession(new NextRequest('http://localhost/api/admin/sync-rapidoc', init))).status).toBe(200)
    expect((await updateSession(new NextRequest('http://localhost/api/admin/empresas', init))).status).toBe(401)
  })
})
describe('entrada e saída', () => {
  it('login não entrega tokens no JSON e cria prazo assinado de 24 horas', async () => {
    const req = new NextRequest('http://localhost/api/admin/login', { method: 'POST', body: JSON.stringify({ email: user.email, password: 'test-only' }) })
    const response = await login(req)
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ success: true, user: { id: user.id, email: user.email } })
    const window = response.cookies.get(ADMIN_WINDOW_COOKIE)!
    expect(window.httpOnly).toBe(true); expect(window.maxAge).toBe(ADMIN_SESSION_SECONDS); expect(await readAdminWindow(window.value)).toMatchObject({ userId: user.id })
  })
  it('recusa login de perfil sem privilégio e revoga a sessão criada', async () => {
    mocks.signIn.mockResolvedValue({ data: { user: { ...user, app_metadata: {} }, session }, error: null })
    const req = new NextRequest('http://localhost/api/admin/login', { method: 'POST', body: JSON.stringify({ email: user.email, password: 'test-only' }) })
    expect((await login(req)).status).toBe(403); expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
  it('logout revoga a sessão e remove cookies, inclusive fragmentos', async () => {
    const req = await authenticated('/api/admin/logout', { method: 'POST' }); req.cookies.set('admin-auth.0', 'chunk')
    const response = await logout(req)
    expect(response.status).toBe(200); expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(response.cookies.get('admin-auth.0')?.maxAge).toBe(0); expect(response.cookies.get(ADMIN_WINDOW_COOKIE)?.maxAge).toBe(0)
    expect(clearAdminCookies(req, NextResponse.json({})).cookies.get('supabase-auth-token')?.maxAge).toBe(0)
  })
})
