import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAuth } from '@/lib/supabase/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyAdminCookies, privateAdminResponse } from '@/lib/supabase/admin-session'
import { medicineSchema, storeSchema, pharmacyKinds } from '@/lib/pharmacy-catalog'
import { pharmacyColumns, pharmacyTables, readPharmacyCatalog } from '@/lib/pharmacy-server'

const envelope = z.object({ tipo: z.enum(pharmacyKinds), id: z.string().uuid().optional(), registro: z.unknown().optional() }).strict()
async function handle(request: NextRequest) {
  const auth = await requireAdminAuth(request)
  const respond = (body: object, status = 200) => privateAdminResponse(applyAdminCookies(NextResponse.json(body, { status }), auth.ok ? auth.pendingCookies : []))
  if (!auth.ok) return respond({ error: auth.error }, auth.status)
  try {
    if (request.method === 'GET') return respond(await readPharmacyCatalog(false))
    const parsed = envelope.safeParse(await request.json())
    if (!parsed.success) return respond({ error: 'Dados da operação inválidos.' }, 400)
    const { tipo, id, registro } = parsed.data
    if (request.method !== 'POST' && !id) return respond({ error: 'Informe o registro.' }, 400)
    const db = createAdminClient()
    let result
    if (request.method === 'DELETE') {
      result = await db.from(pharmacyTables[tipo]).delete().eq('id', id!).select('id').maybeSingle()
    } else {
      const schema = tipo === 'medicamentos' ? medicineSchema : storeSchema
      const body = request.method === 'PATCH' ? schema.partial().safeParse(registro) : schema.safeParse(registro)
      if (!body.success || Object.keys(body.data).length === 0) return respond({ error: body.success ? 'Nenhuma alteração informada.' : body.error.issues[0]?.message || 'Registro inválido.' }, 400)
      if (tipo === 'lojas') {
        const coordinates = body.data as { latitude?: number | null; longitude?: number | null }
        if ((coordinates.latitude == null) !== (coordinates.longitude == null)) return respond({ error: 'Informe latitude e longitude juntas, ou deixe ambas vazias.' }, 400)
      }
      result = request.method === 'POST'
        ? await db.from(pharmacyTables[tipo]).insert(body.data).select(pharmacyColumns[tipo]).single()
        : await db.from(pharmacyTables[tipo]).update({ ...body.data, updated_at: new Date().toISOString() }).eq('id', id!).select(pharmacyColumns[tipo]).maybeSingle()
    }
    if (result.error) return respond({ error: result.error.code === '23505' ? 'Este código já está cadastrado.' : 'Não foi possível salvar a alteração.' }, result.error.code === '23505' ? 409 : 500)
    if (!result.data) return respond({ error: 'Registro não encontrado.' }, 404)
    return respond({ registro: result.data }, request.method === 'POST' ? 201 : 200)
  } catch {
    return respond({ error: 'Não foi possível processar o catálogo.' }, 500)
  }
}
export const GET = handle
export const POST = handle
export const PATCH = handle
export const DELETE = handle
