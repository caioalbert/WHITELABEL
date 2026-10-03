import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { revokeEmailSession } from '@/lib/customer-email-auth'

export async function POST(request: NextRequest) {
  try {
    const jar = await cookies(), header = request.headers.get('Authorization')
    if (header?.startsWith('Bearer ')) await revokeEmailSession(header.slice(7))
    await revokeEmailSession(jar.get('cliente_token')?.value)
    await revokeEmailSession(jar.get('cadastro_fluxo_token')?.value)
    const response = NextResponse.json({ success: true })
    response.cookies.delete('cliente_token')
    response.cookies.delete('cadastro_fluxo_token')
    return response
  } catch { return NextResponse.json({ error: 'Não foi possível encerrar a sessão. Tente novamente.' }, { status: 503 }) }
}
