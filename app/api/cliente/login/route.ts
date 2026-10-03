import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveEmpresaAccessException } from '@/lib/empresa-access'
import { CADASTRO_FLOW_COOKIE, createCadastroFlowToken } from '@/lib/supabase/cadastro-flow-auth'
import { EMPRESA_APP_COOKIE, EMPRESA_FLOW_COOKIE, createEmpresaToken } from '@/lib/supabase/empresa-auth'
import { authKey, codeHash, emailDeliveryConfig, loginInput, newChallenge, requestIpKey, resolveIdentity, rpc, sendLoginCode, signEmailSession, SESSION_SECONDS, type LoginSession } from '@/lib/customer-email-auth'

export const runtime = 'nodejs'
const invalid = () => NextResponse.json({ error: 'Código inválido ou expirado. Solicite um novo código.' }, { status: 401 })
const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: SESSION_SECONDS, path: '/' }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (body && typeof body === 'object' && ('cpf_prefix' in body || 'cnpj_prefix' in body)) return NextResponse.json({ error: 'Atualize o aplicativo e entre usando o código enviado ao seu e-mail.' }, { status: 426 })
    const parsed = loginInput.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Informe um documento válido. O código deve ter 6 dígitos.' }, { status: 400 })
    const input = parsed.data, doc = input.cnpj || input.cpf!, kind = input.cnpj ? 'empresa' : 'cliente'
    const db = createAdminClient(), documentKey = authKey('document', doc)
    const identity = await resolveIdentity(db, kind, doc)
    const emailKey = authKey('email', identity?.email || `no-contact:${doc}`)
    if (input.action === 'request') {
      emailDeliveryConfig()
      const challenge = newChallenge()
      const reserved = await rpc<boolean>(db, 'customer_login_reserve', {
        p_id: challenge.id, p_kind: identity?.tipo || (kind === 'empresa' ? 'empresa' : 'titular'),
        p_identity_id: identity?.identityId || null, p_cadastro_id: identity?.clienteId || null,
        p_document_key: documentKey, p_email_key: emailKey, p_ip_key: requestIpKey(request), p_code_hash: codeHash(challenge.id, challenge.code),
      })
      if (!reserved) return NextResponse.json({ error: 'Aguarde um minuto antes de tentar novamente. Se necessário, procure o suporte.' }, { status: 429 })
      if (identity) {
        try {
          await sendLoginCode(identity.email, challenge.id, challenge.code, identity.nome)
          const { error } = await db.from('customer_login_challenges').update({ delivered: true }).eq('id', challenge.id).is('consumed_at', null)
          if (error) throw error
        } catch {
          await db.from('customer_login_challenges').update({ consumed_at: new Date().toISOString() }).eq('id', challenge.id)
          throw new Error('Envio de código indisponível.')
        }
      }
      return NextResponse.json({ success: true, challengeId: challenge.id, retryAfter: 60,
        message: 'Se houver um cadastro com e-mail válido, enviaremos um código. Se o contato for da empresa, solicite o código ao responsável. Confira também o spam.' })
    }
    const allowed = await rpc<boolean>(db, 'customer_login_take_limit', { p_key: `verify-ip:${requestIpKey(request)}`, p_limit: 600, p_window: 3600, p_cooldown: 0 })
    if (!allowed) return NextResponse.json({ error: 'Muitas tentativas. Tente novamente mais tarde.' }, { status: 429 })
    let purpose = kind === 'empresa' ? 'empresa-flow' : 'cadastro-flow'
    let dependentPending = false
    if (identity?.tipo === 'empresa') purpose = identity.status === 'ATIVO' ? 'empresa-app' : 'empresa-flow'
    else if (identity) {
      const active = identity.empresaId
        ? (identity.status === 'ATIVO' && identity.companyStatus === 'ATIVO') || Boolean(await getActiveEmpresaAccessException(db, identity.empresaId))
        : identity.status === 'ATIVO'
      if (active) purpose = 'cliente'
      else if (identity.tipo === 'dependente') { purpose = 'cliente'; dependentPending = true }
    }
    const session = await rpc<LoginSession | null>(db, 'customer_login_consume', {
      p_id: input.challengeId, p_code_hash: codeHash(input.challengeId, input.code), p_document_key: documentKey, p_email_key: emailKey,
      p_identity_kind: identity?.tipo || null, p_identity_id: identity?.identityId || null, p_cadastro_id: identity?.clienteId || null,
      p_purpose: purpose, p_session_id: randomUUID(),
    })
    if (!identity || !session) return invalid()
    if (dependentPending) {
      await db.from('customer_login_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', session.id)
      return NextResponse.json({ error: 'A ativação deste cadastro precisa ser acompanhada pelo titular.' }, { status: 403 })
    }
    if (identity.tipo === 'empresa') {
      const token = await createEmpresaToken({ id: identity.identityId, cnpj: doc, razao_social: identity.razaoSocial! }, purpose as 'empresa-app' | 'empresa-flow', { session, email: identity.email })
      const response = NextResponse.json({ success: true, nextPath: purpose === 'empresa-app' ? '/empresa/dashboard' : '/empresa/cadastro' })
      response.cookies.set(purpose === 'empresa-app' ? EMPRESA_APP_COOKIE : EMPRESA_FLOW_COOKIE, token, options)
      response.cookies.delete(purpose === 'empresa-app' ? EMPRESA_FLOW_COOKIE : EMPRESA_APP_COOKIE)
      return response
    }
    if (purpose === 'cadastro-flow') {
      const token = await createCadastroFlowToken(identity.clienteId!, { session, email: identity.email, cpf: doc })
      const response = NextResponse.json({ success: true, nextPath: '/cadastro/status', status: identity.status })
      response.cookies.set(CADASTRO_FLOW_COOKIE, token, options)
      response.cookies.delete('cliente_token')
      return response
    }
    const token = await signEmailSession({ purpose: 'cliente', clienteId: identity.clienteId, cpf: doc, nome: identity.nome,
      email: identity.email, tipo: identity.tipo, ...(identity.tipo === 'dependente' ? { dependenteId: identity.identityId } : {}) }, session)
    const response = NextResponse.json({ success: true, nextPath: '/cliente/dashboard', token,
      cliente: { id: identity.clienteId, dependenteId: identity.tipo === 'dependente' ? identity.identityId : undefined,
        tipo: identity.tipo, nome: identity.nome, email: identity.email } })
    response.cookies.set('cliente_token', token, options)
    response.cookies.delete(CADASTRO_FLOW_COOKIE)
    return response
  } catch {
    // Neither provider errors nor auth material belong in application logs.
    return NextResponse.json({ error: 'Não foi possível concluir o acesso. Tente novamente em alguns minutos.' }, { status: 503 })
  }
}
