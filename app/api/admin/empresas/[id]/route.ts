import { loadAdminEmpresa, type EmpresaRouteContext } from '@/lib/admin-empresa'
import { NextRequest, NextResponse } from 'next/server'
export async function GET(request: NextRequest, context: EmpresaRouteContext) {
 try {
  const loaded = await loadAdminEmpresa(request, context)
  if (loaded.response) return loaded.response
  const { empresa, db } = loaded
  const [staff, people] = await Promise.all([
   db.from('empresa_funcionarios').select('*').eq('empresa_id', empresa.id).order('nome'),
   db.from('cadastros').select('id, nome, cpf, status').eq('empresa_id', empresa.id),
  ])
  if (staff.error || people.error) throw staff.error || people.error
  const ids = (people.data || []).map(p => p.id)
  const dependents = ids.length ? await db.from('dependentes').select('id, cadastro_id, nome, cpf, relacao, data_nascimento').in('cadastro_id', ids) : { data: [], error: null }
  if (dependents.error) throw dependents.error
  return NextResponse.json({ empresa, funcionarios: staff.data || [], cadastros: people.data || [], dependentes: dependents.data || [] })
 } catch (error) { console.error('Detalhes empresa:', error); return NextResponse.json({ error: 'Não foi possível carregar a empresa.' }, { status: 500 }) }
}
