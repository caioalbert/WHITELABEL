import { EMPRESA_APP_COOKIE, EMPRESA_FLOW_COOKIE } from '@/lib/supabase/empresa-auth'
import { revokeEmailSession } from '@/lib/customer-email-auth'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
export async function POST() {
  try {
    const jar = await cookies()
    await revokeEmailSession(jar.get(EMPRESA_APP_COOKIE)?.value)
    await revokeEmailSession(jar.get(EMPRESA_FLOW_COOKIE)?.value)
    const response = NextResponse.json({ success: true })
    response.cookies.delete(EMPRESA_APP_COOKIE)
    response.cookies.delete(EMPRESA_FLOW_COOKIE)
    return response
  } catch { return NextResponse.json({ error: 'Não foi possível encerrar a sessão. Tente novamente.' }, { status: 503 }) }
}
