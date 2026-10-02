import { NextRequest, NextResponse } from 'next/server'
import { requireActiveClienteAuth } from '@/lib/supabase/cliente-auth'
import { readPharmacyCatalog } from '@/lib/pharmacy-server'

export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store, max-age=0' }
  try {
    await requireActiveClienteAuth(request)
    return NextResponse.json(await readPharmacyCatalog(true), { headers })
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === 'Não autenticado'
    return NextResponse.json({ error: unauthorized ? 'Não autenticado.' : 'Não foi possível carregar a Farmácia Popular. Tente novamente.' }, { status: unauthorized ? 401 : 503, headers })
  }
}
