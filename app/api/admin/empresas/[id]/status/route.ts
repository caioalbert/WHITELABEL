import { loadAdminEmpresa, type EmpresaRouteContext } from '@/lib/admin-empresa'
import { NextRequest, NextResponse } from 'next/server'
export async function POST(request: NextRequest, context: EmpresaRouteContext) {
 try {
  const loaded = await loadAdminEmpresa(request, context)
  if (loaded.response) return loaded.response
  const { empresa, db } = loaded
  const body = await request.json().catch(() => null)
  const status = body?.status
  if (!['ATIVO', 'INATIVO'].includes(status)) return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
  if (!['ATIVO', 'INATIVO'].includes(empresa.status)) return NextResponse.json({ error: 'A ativação inicial depende da confirmação da primeira mensalidade. Esta ação reativa empresas previamente ativadas.' }, { status: 409 })
  if (status === empresa.status) return NextResponse.json({ success: true })
  const { data, error } = await db.from('empresas').update({ status }).eq('id', empresa.id).eq('status', empresa.status).select('id').maybeSingle()
  if (error) throw error
  if (!data) return NextResponse.json({ error: 'A empresa foi alterada. Atualize a página.' }, { status: 409 })
  return NextResponse.json({ success: true, status })
 } catch (error) { console.error('Status empresa:', error); return NextResponse.json({ error: 'Não foi possível alterar o status. Confira a migração de status empresarial.' }, { status: 500 }) }
}
