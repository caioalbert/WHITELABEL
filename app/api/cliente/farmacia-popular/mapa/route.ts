import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { requireActiveClienteAuth } from '@/lib/supabase/cliente-auth'
import { readPharmacyRegionStores } from '@/lib/pharmacy-server'
import { filterStores } from '@/lib/pharmacy-catalog'

export async function GET(request: NextRequest) {
  const nonce = randomUUID()
  const headers = {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': `default-src 'self'; script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com blob:; style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com; img-src 'self' data: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com; font-src https://fonts.gstatic.com; connect-src 'self' https://*.googleapis.com https://*.gstatic.com https://*.google.com data: blob:; worker-src blob:; frame-src https://*.google.com; frame-ancestors 'self'; base-uri 'none'; object-src 'none'`,
  }
  try {
    await requireActiveClienteAuth(request)
    const search = request.nextUrl.searchParams
    const uf = (search.get('uf') || '').slice(0, 2), city = (search.get('cidade') || '').slice(0, 300)
    const lojas = /^[A-Z]{2}$/.test(uf) && city.trim() ? await readPharmacyRegionStores(uf, city) : []
    const filtered = filterStores(lojas, (search.get('busca') || '').slice(0, 300), (search.get('uf') || '').slice(0, 2), (search.get('cidade') || '').slice(0, 300))
    const offset = Number(search.get('offset') || 0)
    const validOffset = Number.isSafeInteger(offset) && offset >= 0 && offset <= 10000 ? offset : 0
    const selected = search.get('uf') && search.get('cidade') ? filtered.slice(validOffset, validOffset + 20) : []
    const assetVersion = process.env.VERCEL_GIT_COMMIT_SHA || 'nearby-v1'
    // This is a browser key, restricted to Maps JavaScript/Geocoding and authorized site referrers.
    // Never use a server/service key here. No customer identity is embedded in this HTML.
    const config = encodeURIComponent(JSON.stringify({ stores: selected, assetVersion, browserKey: process.env.GOOGLE_MAPS_BROWSER_KEY || '', mapId: process.env.GOOGLE_MAPS_MAP_ID || '' })).replace(/'/g, '%27')
    return new NextResponse(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lojas Pague Menos — mapa</title><link rel="stylesheet" href="/pharmacy-map.css?v=${encodeURIComponent(assetVersion)}" nonce="${nonce}"><style nonce="${nonce}"></style></head><body><p id="map-status" role="status" aria-live="polite">Carregando mapa…</p><div id="pharmacy-map" aria-label="Mapa interativo das lojas Pague Menos" data-config="${config}"></div><script src="/pharmacy-map.js?v=${encodeURIComponent(assetVersion)}" nonce="${nonce}" defer></script></body></html>`, { headers })
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === 'Não autenticado'
    return new NextResponse(unauthorized ? 'Entre novamente para consultar o mapa.' : 'Não foi possível carregar o mapa. Tente novamente.', { status: unauthorized ? 401 : 503, headers })
  }
}
