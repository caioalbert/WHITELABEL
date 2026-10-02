import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { requireAdminAuth } from '@/lib/supabase/admin-auth'
import { isProtectedAdminPage } from '@/lib/supabase/admin-route-access'
import { applyAdminCookies, clearAdminCookies, hasAllowedAdminOrigin, privateAdminResponse } from '@/lib/supabase/admin-session'
import { hasValidCronAuthorization } from '@/lib/rapidoc-sync-auth'

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname
  const adminApi = path.startsWith('/api/admin/')
  const adminLoginOrLogout = path === '/api/admin/login' || path === '/api/admin/logout'
  const protectedExtra = path === '/api/init-db' || path === '/api/enviar-termo'
  const adminArea = path === '/admin' || path.startsWith('/admin/') || adminApi || protectedExtra
  const cron = path === '/api/admin/sync-rapidoc' && hasValidCronAuthorization(request.headers.get('authorization'), process.env.CRON_SECRET)
  const internalEmail = path === '/api/enviar-termo' && Boolean(process.env.ASAAS_WEBHOOK_TOKEN?.trim()) && request.headers.get('x-internal-token')?.trim() === process.env.ASAAS_WEBHOOK_TOKEN?.trim()
  if (adminArea) {
    if (!hasAllowedAdminOrigin(request)) return privateAdminResponse(NextResponse.json({ error: 'Origem da solicitação não autorizada.' }, { status: 403 }))
    if (adminLoginOrLogout || path === '/admin/login' || path === '/admin/login/' || cron || internalEmail) {
      return privateAdminResponse(NextResponse.next({ request }))
    }
    const auth = await requireAdminAuth(request)
    if (!auth.ok) {
      if (auth.status === 401 && isProtectedAdminPage(path)) {
        const url = request.nextUrl.clone(); url.pathname = '/admin/login'; url.search = ''
        return privateAdminResponse(clearAdminCookies(request, NextResponse.redirect(url)))
      }
      const response = adminApi || protectedExtra
        ? NextResponse.json({ error: auth.error }, { status: auth.status })
        : new NextResponse(auth.error, { status: auth.status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
      if (auth.status === 503) response.headers.set('Retry-After', '5')
      if (auth.status === 401) clearAdminCookies(request, response)
      return privateAdminResponse(response)
    }
    return privateAdminResponse(applyAdminCookies(NextResponse.next({ request }), auth.pendingCookies))
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getUser() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (
    // if the user is not logged in and the app path, in this case, /protected, is accessed, redirect to the login page
    request.nextUrl.pathname.startsWith('/protected') &&
    !user
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
