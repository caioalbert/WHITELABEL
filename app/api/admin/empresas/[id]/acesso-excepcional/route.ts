import { getActiveEmpresaAccessException, EMPRESA_ACCESS_EXCEPTION_SCOPE } from '@/lib/empresa-access'
import { loadAdminEmpresa, type EmpresaRouteContext } from '@/lib/admin-empresa'
import { NextRequest, NextResponse } from 'next/server'

const MAX_EXCEPTION_DAYS = 90

function response(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, { ...init, headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
}

export async function GET(request: NextRequest, context: EmpresaRouteContext) {
  try {
    const loaded = await loadAdminEmpresa(request, context)
    if (loaded.response) return loaded.response
    const exception = await getActiveEmpresaAccessException(loaded.db, loaded.empresa.id)
    return response({ acessoExcepcional: exception })
  } catch (error) {
    console.error('Consultar acesso excepcional:', error)
    return response({ error: 'Não foi possível consultar o acesso excepcional.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: EmpresaRouteContext) {
  try {
    const loaded = await loadAdminEmpresa(request, context)
    if (loaded.response) return loaded.response
    const body = await request.json().catch(() => null)
    const motivo = typeof body?.motivo === 'string' ? body.motivo.trim() : ''
    const expiresAt = typeof body?.expiraEm === 'string' ? new Date(body.expiraEm) : null
    const now = new Date()
    const maximum = new Date(now.getTime() + MAX_EXCEPTION_DAYS * 24 * 60 * 60 * 1000)

    if (motivo.length < 10 || motivo.length > 1000) return response({ error: 'Informe um motivo entre 10 e 1000 caracteres.' }, { status: 400 })
    if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt <= now) return response({ error: 'Informe uma data de expiração futura.' }, { status: 400 })
    if (expiresAt > maximum) return response({ error: `A exceção pode durar no máximo ${MAX_EXCEPTION_DAYS} dias.` }, { status: 400 })
    if (loaded.empresa.status === 'INATIVO') return response({ error: 'Não é possível liberar acesso para uma empresa inativa.' }, { status: 409 })
    if (loaded.empresa.status === 'ATIVO') return response({ error: 'A empresa já está ativa pelo fluxo normal de pagamento.' }, { status: 409 })

    const active = await getActiveEmpresaAccessException(loaded.db, loaded.empresa.id, now.toISOString())
    if (active) return response({ error: 'Já existe uma exceção de acesso vigente para esta empresa.', acessoExcepcional: active }, { status: 409 })

    const { data, error } = await loaded.db
      .from('empresa_acesso_excecoes')
      .insert({
        empresa_id: loaded.empresa.id,
        escopo: EMPRESA_ACCESS_EXCEPTION_SCOPE,
        motivo,
        expira_em: expiresAt.toISOString(),
        concedido_por: loaded.auth.user.id,
      })
      .select('id, empresa_id, escopo, motivo, concedido_por, concedido_em, expira_em, revogado_em, revogado_por, observacao')
      .single()
    if (error) throw error
    return response({ success: true, acessoExcepcional: data, message: 'Acesso excepcional liberado para os funcionários.' }, { status: 201 })
  } catch (error) {
    console.error('Conceder acesso excepcional:', error)
    return response({ error: 'Não foi possível liberar o acesso excepcional.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: EmpresaRouteContext) {
  try {
    const loaded = await loadAdminEmpresa(request, context)
    if (loaded.response) return loaded.response
    const active = await getActiveEmpresaAccessException(loaded.db, loaded.empresa.id)
    if (!active) return response({ success: true, message: 'Não havia exceção de acesso vigente.' })

    const { data, error } = await loaded.db
      .from('empresa_acesso_excecoes')
      .update({ revogado_em: new Date().toISOString(), revogado_por: loaded.auth.user.id })
      .eq('id', active.id)
      .is('revogado_em', null)
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (!data) return response({ error: 'A exceção já foi alterada. Atualize a página.' }, { status: 409 })
    return response({ success: true, message: 'Acesso excepcional revogado.' })
  } catch (error) {
    console.error('Revogar acesso excepcional:', error)
    return response({ error: 'Não foi possível revogar o acesso excepcional.' }, { status: 500 })
  }
}
