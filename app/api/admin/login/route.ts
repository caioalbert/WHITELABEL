import { NextRequest, NextResponse } from 'next/server'
import { hasAdminRole } from '@/lib/supabase/auth-roles'
import { applyAdminCookies, clearAdminCookies, createAdminSessionClient, hasAllowedAdminOrigin, privateAdminResponse, setAdminWindow, signAdminWindow } from '@/lib/supabase/admin-session'

export async function POST(request: NextRequest) {
  const json = (body: object, status = 200) => privateAdminResponse(NextResponse.json(body, { status }))
  if (!hasAllowedAdminOrigin(request)) return json({ error: 'Origem da solicitação não autorizada.' }, 403)
  try {
    const { email, password } = await request.json()
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password || email.length > 254 || password.length > 1000) {
      return json({ error: 'Informe um email e uma senha válidos.' }, 400)
    }
    const { client, pendingCookies } = createAdminSessionClient(request)
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      const unavailable = (error.status ?? 0) >= 500 || error.status === 0 || /fetch failed|enotfound|getaddrinfo|network|timeout/i.test(error.message || '')
      return json({ error: unavailable ? 'Não foi possível entrar no momento. Tente novamente.' : 'Credenciais inválidas' }, unavailable ? 503 : 401)
    }
    if (!data.user || !data.session) return json({ error: 'Credenciais inválidas' }, 401)
    if (!hasAdminRole(data.user)) {
      await client.auth.signOut({ scope: 'local' })
      return clearAdminCookies(request, json({ error: 'Acesso restrito a administradores' }, 403))
    }
    const window = await signAdminWindow(data.user.id)
    const response = applyAdminCookies(json({ success: true, user: { id: data.user.id, email: data.user.email } }), pendingCookies)
    setAdminWindow(response, window.token)
    response.cookies.set('supabase-auth-token', '', { path: '/', maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' })
    return response
  } catch {
    return json({ error: 'Não foi possível entrar no momento. Tente novamente.' }, 500)
  }
}
