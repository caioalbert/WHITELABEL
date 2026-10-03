import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authKey, codeHash, emailDeliveryConfig, loginInput, requestIpKey, resolveIdentity, rpc, sendInitialPassword, signEmailSession, type LoginSession } from '@/lib/customer-email-auth'
import { initialPassword, verifyCustomerPassword } from '@/lib/customer-password'
import { authResponse, customerAccessPlan, customerAccessResponse } from '@/lib/customer-access-response'

export const runtime = 'nodejs'
const invalid = () => authResponse({ error: 'CPF/CNPJ ou senha incorretos. Se necessário, solicite uma nova senha temporária.' }, 401)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (body && typeof body === 'object' && ('cpf_prefix' in body || 'cnpj_prefix' in body || body.action === 'verify')) {
      return authResponse({ error: 'Atualize o aplicativo para entrar com CPF e senha.' }, 426)
    }
    const parsed = loginInput.safeParse(body)
    if (!parsed.success) return authResponse({ error: 'Informe um documento válido e sua senha.' }, 400)
    const input = parsed.data, doc = input.cnpj || input.cpf!, kind = input.cnpj ? 'empresa' : 'cliente'
    const db = createAdminClient(), documentKey = authKey('document', doc), ipKey = requestIpKey(request)
    if (input.action === 'password' && !await rpc<boolean>(db, 'customer_password_attempt', { p_document_key: documentKey, p_ip_key: ipKey })) {
      return authResponse({ error: 'Muitas tentativas. Tente novamente mais tarde.' }, 429)
    }
    const identity = await resolveIdentity(db, kind, doc)
    const emailKey = authKey('email', identity?.email || `no-contact:${doc}`)
    const credentials = identity ? await db.from('customer_password_credentials').select('password_hash,document_key,email_key').eq('identity_kind', identity.tipo).eq('identity_id', identity.identityId).maybeSingle() : { data: null, error: null }
    if (credentials.error) throw credentials.error
    if (input.action === 'request') {
      emailDeliveryConfig()
      const id = randomUUID(), password = initialPassword()
      const reserved = await rpc<boolean>(db, 'customer_password_reserve', {
        p_id: id, p_kind: identity?.tipo || (kind === 'empresa' ? 'empresa' : 'titular'),
        p_identity_id: identity?.identityId || null, p_cadastro_id: identity?.clienteId || null,
        p_document_key: documentKey, p_email_key: emailKey, p_ip_key: ipKey, p_code_hash: codeHash(id, password),
      })
      if (!reserved) return authResponse({ error: 'Aguarde um minuto antes de tentar novamente. Se necessário, procure o suporte.' }, 429)
      if (identity) {
        try {
          await sendInitialPassword(identity.email, id, password, identity.nome, kind === 'empresa' ? 'CNPJ' : 'CPF', Boolean(credentials.data))
          const { error } = await db.from('customer_login_challenges').update({ delivered: true }).eq('id', id).is('consumed_at', null)
          if (error) throw error
        } catch {
          await db.from('customer_login_challenges').update({ consumed_at: new Date().toISOString() }).eq('id', id)
          throw new Error('Envio indisponível.')
        }
      }
      return authResponse({ success: true, retryAfter: 60,
        message: 'Se houver um cadastro com e-mail válido, enviaremos uma senha temporária. Se o contato for da empresa, solicite a mensagem ao responsável. Confira também o spam.' })
    }
    const validPersonal = await verifyCustomerPassword(input.password, credentials.data?.password_hash || null)
    if (!identity) return invalid()
    if (validPersonal && credentials.data?.document_key === documentKey && credentials.data?.email_key === emailKey) {
      const plan = await customerAccessPlan(identity)
      const session = await rpc<LoginSession | null>(db, 'customer_password_create_session', {
        p_kind: identity.tipo, p_identity_id: identity.identityId, p_cadastro_id: identity.clienteId || null,
        p_document: doc, p_email: identity.email, p_document_key: documentKey, p_email_key: emailKey,
        p_expected_hash: credentials.data.password_hash, p_purpose: plan.purpose, p_session_id: randomUUID(),
      })
      return session ? await customerAccessResponse(identity, doc, session, plan) : invalid()
    }
    const { data: challenge, error } = await db.from('customer_login_challenges').select('id')
      .eq('identity_kind', identity.tipo).eq('identity_id', identity.identityId).eq('document_key', documentKey).eq('email_key', emailKey)
      .eq('delivered', true).is('consumed_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (error) throw error
    if (!challenge) return invalid()
    const session = await rpc<LoginSession | null>(db, 'customer_login_consume', {
      p_id: challenge.id, p_code_hash: codeHash(challenge.id, input.password.normalize('NFC')), p_document_key: documentKey, p_email_key: emailKey,
      p_identity_kind: identity.tipo, p_identity_id: identity.identityId, p_cadastro_id: identity.clienteId || null,
      p_purpose: 'password-setup', p_session_id: randomUUID(),
    })
    if (!session) return invalid()
    const setupToken = await signEmailSession({ purpose: 'password-setup', identityKind: identity.tipo, identityId: identity.identityId,
      clienteId: identity.clienteId, document: doc, email: identity.email, challengeId: challenge.id }, session)
    // This response never contains the account token, cookie or personal account data.
    return authResponse({ success: true, requiresPasswordChange: true, setupToken })
  } catch {
    return authResponse({ error: 'Não foi possível concluir o acesso. Tente novamente em alguns minutos.' }, 503)
  }
}
