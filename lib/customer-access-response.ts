import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveEmpresaAccessException } from '@/lib/empresa-access'
import { CADASTRO_FLOW_COOKIE, createCadastroFlowToken } from '@/lib/supabase/cadastro-flow-auth'
import { EMPRESA_APP_COOKIE, EMPRESA_FLOW_COOKIE, createEmpresaToken } from '@/lib/supabase/empresa-auth'
import { signEmailSession, SESSION_SECONDS, type LoginIdentity, type LoginSession } from '@/lib/customer-email-auth'

export function authResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
export async function customerAccessPlan(identity: LoginIdentity) {
  if (identity.tipo === 'empresa') return { purpose: identity.status === 'ATIVO' ? 'empresa-app' : 'empresa-flow', pendingDependent: false }
  const active = identity.empresaId
    ? identity.companyStatus !== 'INATIVO' && ((identity.status === 'ATIVO' && identity.companyStatus === 'ATIVO') || Boolean(await getActiveEmpresaAccessException(createAdminClient(), identity.empresaId)))
    : identity.status === 'ATIVO'
  return { purpose: active || identity.tipo === 'dependente' ? 'cliente' : 'cadastro-flow', pendingDependent: !active && identity.tipo === 'dependente' }
}
export async function customerAccessResponse(identity: LoginIdentity, doc: string, session: LoginSession, plan: Awaited<ReturnType<typeof customerAccessPlan>>, passwordUpdated = false) {
  const { purpose, pendingDependent } = plan
  if (pendingDependent) {
    const { error } = await createAdminClient().from('customer_login_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', session.id)
    if (error) throw error
    return authResponse({ error: 'A ativação deste cadastro precisa ser acompanhada pelo titular.', passwordUpdated }, 403)
  }
  const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: SESSION_SECONDS, path: '/' }
  if (identity.tipo === 'empresa') {
    const token = await createEmpresaToken({ id: identity.identityId, cnpj: doc, razao_social: identity.razaoSocial! }, purpose as 'empresa-app' | 'empresa-flow', { session, email: identity.email })
    const response = authResponse({ success: true, nextPath: purpose === 'empresa-app' ? '/empresa/dashboard' : '/empresa/cadastro' })
    response.cookies.set(purpose === 'empresa-app' ? EMPRESA_APP_COOKIE : EMPRESA_FLOW_COOKIE, token, options)
    response.cookies.delete(purpose === 'empresa-app' ? EMPRESA_FLOW_COOKIE : EMPRESA_APP_COOKIE)
    return response
  }
  if (purpose === 'cadastro-flow') {
    const token = await createCadastroFlowToken(identity.clienteId!, { session, email: identity.email, cpf: doc })
    const response = authResponse({ success: true, nextPath: '/cadastro/status', status: identity.status })
    response.cookies.set(CADASTRO_FLOW_COOKIE, token, options)
    response.cookies.delete('cliente_token')
    return response
  }
  const token = await signEmailSession({ purpose: 'cliente', clienteId: identity.clienteId, cpf: doc, nome: identity.nome,
    email: identity.email, tipo: identity.tipo, ...(identity.tipo === 'dependente' ? { dependenteId: identity.identityId } : {}) }, session)
  const response = authResponse({ success: true, nextPath: '/cliente/dashboard', token,
    cliente: { id: identity.clienteId, dependenteId: identity.tipo === 'dependente' ? identity.identityId : undefined,
      tipo: identity.tipo, nome: identity.nome, email: identity.email } })
  response.cookies.set('cliente_token', token, options)
  response.cookies.delete(CADASTRO_FLOW_COOKIE)
  return response
}
