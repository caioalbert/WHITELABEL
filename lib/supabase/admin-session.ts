import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { SignJWT, jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

export const ADMIN_SESSION_SECONDS = 24 * 60 * 60
export const ADMIN_AUTH_COOKIE = 'admin-auth'
export const ADMIN_WINDOW_COOKIE = 'admin-session-window'
export type AdminCookieWrite = { name: string; value: string; options: CookieOptions }

const cookieOptions = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
}

// Domain-separated key derived from the mandatory server-only credential.
// This does not introduce a new deployment secret or reuse customer JWT signatures.
async function getAdminWindowSecret() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!value || value.length < 32) throw new Error('Credencial administrativa do servidor ausente ou inválida.')
  const input = new TextEncoder().encode(`whitelabel-admin-session-window:v1:${value}`)
  return new Uint8Array(await crypto.subtle.digest('SHA-256', input))
}

export async function signAdminWindow(userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer('whitelabel-admin')
    .setAudience('admin-session')
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(await getAdminWindowSecret())
  return { token, expiresAt }
}

export async function readAdminWindow(token?: string) {
  if (!token) return null
  const secret = await getAdminWindowSecret()
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'whitelabel-admin',
      audience: 'admin-session',
    })
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null
    return { userId: payload.sub, expiresAt: payload.exp }
  } catch {
    return null
  }
}

export function createAdminSessionClient(request: NextRequest, expiresAt?: number) {
  const pendingCookies: AdminCookieWrite[] = []
  const remaining = expiresAt
    ? Math.max(0, expiresAt - Math.floor(Date.now() / 1000))
    : ADMIN_SESSION_SECONDS
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: ADMIN_AUTH_COOKIE, ...cookieOptions, maxAge: remaining },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (writes) => {
          for (const write of writes) {
            const options = { ...write.options, ...cookieOptions, maxAge: write.options.maxAge === 0 ? 0 : remaining }
            request.cookies.set(write.name, write.value)
            pendingCookies.push({ name: write.name, value: write.value, options })
          }
        },
      },
    },
  )
  return { client, pendingCookies }
}

export function applyAdminCookies(response: NextResponse, writes: AdminCookieWrite[]) {
  for (const { name, value, options } of writes) response.cookies.set(name, value, options)
  return response
}

export function setAdminWindow(response: NextResponse, token: string) {
  response.cookies.set(ADMIN_WINDOW_COOKIE, token, { ...cookieOptions, maxAge: ADMIN_SESSION_SECONDS })
}

export function clearAdminCookies(request: NextRequest, response: NextResponse) {
  const names = new Set([ADMIN_AUTH_COOKIE, ADMIN_WINDOW_COOKIE, 'supabase-auth-token'])
  for (const { name } of request.cookies.getAll()) {
    if (name.startsWith(`${ADMIN_AUTH_COOKIE}.`)) names.add(name)
  }
  for (const name of names) response.cookies.set(name, '', { ...cookieOptions, maxAge: 0 })
  return response
}

export function hasAllowedAdminOrigin(request: NextRequest) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true
  const origin = request.headers.get('origin')
  if (origin) {
    const expected = new URL(request.url)
    // NextURL normalizes loopback hosts; preserve the actual incoming host.
    expected.host = request.headers.get('host') || expected.host
    return origin === expected.origin
  }
  return request.headers.get('sec-fetch-site') !== 'cross-site'
}

export function privateAdminResponse(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Content-Security-Policy', "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'")
  return response
}
