import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { authKey, codeHash, rpc, type LoginSession } from '@/lib/customer-email-auth'
import { hashCustomerPassword, passwordPolicy } from '@/lib/customer-password'
import { readPasswordSetup } from '@/lib/customer-password-setup'
import { authResponse, customerAccessPlan, customerAccessResponse } from '@/lib/customer-access-response'

export const runtime = 'nodejs'
const input = z.object({ password: z.string().min(1).max(512), confirmation: z.string().min(1).max(512) }).strict()
const invalid = () => authResponse({ error: 'Esta etapa expirou ou já foi concluída. Solicite outra senha temporária para continuar.' }, 401)
export async function POST(request: NextRequest) {
  try {
    const setup = await readPasswordSetup(request)
    if (!setup) return invalid()
    const parsed = input.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return authResponse({ error: 'Informe e confirme sua nova senha.' }, 400)
    const password = parsed.data.password.normalize('NFC')
    if (password !== parsed.data.confirmation.normalize('NFC')) return authResponse({ error: 'As senhas não coincidem.' }, 400)
    const policy = passwordPolicy(password, setup.claims.document)
    if (policy) return authResponse({ error: policy }, 400)
    const { claims, identity } = setup, db = createAdminClient()
    const newInitialHash = codeHash(claims.challengeId, password)
    const challenge = await db.from('customer_login_challenges').select('code_hash').eq('id', claims.challengeId).maybeSingle()
    if (challenge.error) throw challenge.error
    if (!challenge.data) return invalid()
    if (challenge.data.code_hash === newInitialHash) return authResponse({ error: 'Crie uma senha pessoal diferente da senha temporária.' }, 400)
    const plan = await customerAccessPlan(identity)
    const session = await rpc<LoginSession | null>(db, 'customer_password_set', {
      p_setup_id: claims.jti, p_kind: identity.tipo, p_identity_id: identity.identityId, p_cadastro_id: identity.clienteId || null,
      p_document: claims.document, p_email: identity.email, p_document_key: authKey('document', claims.document), p_email_key: authKey('email', identity.email),
      p_password_hash: await hashCustomerPassword(password), p_challenge_id: claims.challengeId, p_new_initial_hash: newInitialHash,
      p_purpose: plan.purpose, p_session_id: randomUUID(),
    })
    return session ? await customerAccessResponse(identity, claims.document, session, plan, true) : invalid()
  } catch {
    return authResponse({ error: 'Não foi possível salvar sua senha. Tente novamente em alguns minutos.' }, 503)
  }
}
