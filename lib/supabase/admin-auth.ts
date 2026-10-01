import type { User } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { hasAdminRole } from '@/lib/supabase/auth-roles'
import { ADMIN_WINDOW_COOKIE, createAdminSessionClient, hasAllowedAdminOrigin, readAdminWindow, type AdminCookieWrite } from '@/lib/supabase/admin-session'

type AdminAuthSuccess = { ok: true; token: string; user: User; pendingCookies: AdminCookieWrite[] }
type AdminAuthFailure = { ok: false; status: 401 | 403 | 503 | 500; error: string }
export type AdminAuthResult = AdminAuthSuccess | AdminAuthFailure

function isUnavailable(error: { status?: number; message?: string } | null) {
  return Boolean(error && ((error.status ?? 0) >= 500 || error.status === 0 || /fetch failed|enotfound|getaddrinfo|network|timeout/i.test(error.message || '')))
}

export async function requireAdminAuth(request: NextRequest): Promise<AdminAuthResult> {
  if (!hasAllowedAdminOrigin(request)) return { ok: false, status: 403, error: 'Origem da solicitação não autorizada.' }
  try {
    const window = await readAdminWindow(request.cookies.get(ADMIN_WINDOW_COOKIE)?.value)
    if (!window) return { ok: false, status: 401, error: 'Sessão inválida ou expirada. Entre novamente.' }
    const { client, pendingCookies } = createAdminSessionClient(request, window.expiresAt)
    // getUser validates with Auth and refreshes an expired access token using the HTTP-only SSR cookies.
    const { data, error } = await client.auth.getUser()
    if (isUnavailable(error)) return { ok: false, status: 503, error: 'Não foi possível validar sua sessão no momento. Tente novamente.' }
    if (error || !data.user || data.user.id !== window.userId) return { ok: false, status: 401, error: 'Sessão inválida ou expirada. Entre novamente.' }
    if (!hasAdminRole(data.user)) return { ok: false, status: 403, error: 'Acesso restrito a administradores.' }
    // Only read the token after the user and role have been verified server-side.
    const { data: sessionData, error: sessionError } = await client.auth.getSession()
    if (isUnavailable(sessionError)) return { ok: false, status: 503, error: 'Não foi possível validar sua sessão no momento. Tente novamente.' }
    if (sessionError || !sessionData.session) return { ok: false, status: 401, error: 'Sessão inválida ou expirada. Entre novamente.' }
    return { ok: true, token: sessionData.session.access_token, user: data.user, pendingCookies }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const unavailable = /fetch failed|enotfound|getaddrinfo|network|timeout/i.test(message)
    return { ok: false, status: unavailable ? 503 : 500, error: 'Não foi possível validar sua sessão no momento. Tente novamente.' }
  }
}
