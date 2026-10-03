import { NextRequest, NextResponse } from 'next/server'
import { requireActiveClienteAuth } from '@/lib/supabase/cliente-auth'
import { readPharmacyCatalog, readPharmacyInitialCatalog, readPharmacyRegionStores } from '@/lib/pharmacy-server'

import { filterStores } from '@/lib/pharmacy-catalog'

export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store, max-age=0' }
  try {
    await requireActiveClienteAuth(request)
    const params = request.nextUrl.searchParams
    if (params.get('tipo') === 'medicamentos') return NextResponse.json(await readPharmacyInitialCatalog(), { headers })
    if (params.get('tipo') === 'lojas') {
      const uf = params.get('uf') || '', city = params.get('cidade') || '', search = params.get('busca') || ''
      const offset = Number(params.get('offset') || 0)
      if (!/^[A-Z]{2}$/.test(uf) || !city.trim() || city.length > 300 || search.length > 300 || !Number.isSafeInteger(offset) || offset < 0 || offset > 10000) return NextResponse.json({ error: 'Escolha um estado e uma cidade válidos.' }, { status: 400, headers })
      const filtered = filterStores(await readPharmacyRegionStores(uf, city), search)
      return NextResponse.json({ lojas: filtered.slice(offset, offset + 20), total: filtered.length }, { headers })
    }
    // Compatibility for installed native versions. New clients request only the selected region.
    return NextResponse.json(await readPharmacyCatalog(true), { headers })
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === 'Não autenticado'
    return NextResponse.json({ error: unauthorized ? 'Não autenticado.' : 'Não foi possível carregar a Farmácia Popular. Tente novamente.' }, { status: unauthorized ? 401 : 503, headers })
  }
}
