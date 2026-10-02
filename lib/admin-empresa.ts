import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminAuth } from '@/lib/supabase/admin-auth'
import { NextRequest, NextResponse } from 'next/server'
export type EmpresaRouteContext = { params: Promise<{ id: string }> }
export async function loadAdminEmpresa(request: NextRequest, context: EmpresaRouteContext) {
  const auth = await requireAdminAuth(request)
  if (!auth.ok) return { response: NextResponse.json({ error: auth.error }, { status: auth.status }) }
  const { id } = await context.params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { response: NextResponse.json({ error: 'ID inválido.' }, { status: 400 }) }
  const db = createAdminClient()
  const { data: empresa, error } = await db.from('empresas').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!empresa) return { response: NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 }) }
  return { empresa, db, auth }
}
