import { NextRequest, NextResponse } from 'next/server'
import { clearAdminCookies, createAdminSessionClient, hasAllowedAdminOrigin, privateAdminResponse } from '@/lib/supabase/admin-session'

export async function POST(request: NextRequest) {
  if (!hasAllowedAdminOrigin(request)) return privateAdminResponse(NextResponse.json({ error: 'Origem da solicitação não autorizada.' }, { status: 403 }))
  try {
    const { client } = createAdminSessionClient(request)
    const { error } = await client.auth.signOut({ scope: 'local' })
    if (error && error.status !== 401 && error.status !== 403) {
      return privateAdminResponse(NextResponse.json({ error: 'Não foi possível encerrar a sessão no momento. Tente novamente.' }, { status: 503 }))
    }
    return privateAdminResponse(clearAdminCookies(request, NextResponse.json({ success: true })))
  } catch {
    return privateAdminResponse(NextResponse.json({ error: 'Não foi possível encerrar a sessão no momento. Tente novamente.' }, { status: 503 }))
  }
}
