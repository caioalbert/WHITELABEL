import { createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildCustomerAccessEmail } from '@/lib/customer-access-email'
import { isIP } from 'node:net'
import { z } from 'zod'
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { getJwtSecret } from '@/lib/auth-secret'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidCPF, isValidCNPJ } from '@/lib/utils'

export const AUTH_VERSION = 3
export const EMAIL_AUTH_METHOD = 'customer-password-v1'
export const SESSION_SECONDS = 24 * 60 * 60
const uuid = z.string().uuid()
const document = z.string().max(18).regex(/^[\d.\-/]+$/).transform(v => v.replace(/\D/g, ''))
const base = { cpf: document.optional(), cnpj: document.optional() }
export const loginInput = z.discriminatedUnion('action', [
  z.object({ ...base, action: z.literal('request') }).strict(),
  z.object({ ...base, action: z.literal('password'), password: z.string().min(1).max(512) }).strict(),
]).refine(v => Boolean(v.cpf) !== Boolean(v.cnpj) && (v.cnpj ? isValidCNPJ(v.cnpj) : isValidCPF(v.cpf!)))

export type LoginIdentity = {
  tipo: 'titular' | 'dependente' | 'empresa'; identityId: string; clienteId?: string;
  cpf?: string; cnpj?: string; nome: string; razaoSocial?: string; email: string;
  status: string; empresaId?: string; companyStatus?: string
}
export type LoginSession = { id: string; expiresAt: string }
type Db = ReturnType<typeof createAdminClient>

export function authKey(domain: string, value: string) {
  return createHmac('sha256', getJwtSecret()).update(JSON.stringify([EMAIL_AUTH_METHOD, domain, value])).digest('hex')
}
export function codeHash(id: string, code: string) { return authKey('code', `${id}:${code}`) }
export function requestIpKey(request: Request) {
  // Only the deployment platform's overwritten header is trusted. Other origins share a conservative bucket.
  const value = process.env.VERCEL === '1' ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() : undefined
  return authKey('ip', value && isIP(value) ? value : 'unknown-origin')
}
export async function rpc<T>(db: Db, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(name, args)
  if (error) throw new Error('Não foi possível verificar seu acesso. Tente novamente.')
  return data as T
}
export function resolveIdentity(db: Db, kind: 'cliente' | 'empresa', doc: string, email: string | null = null) {
  return rpc<LoginIdentity | null>(db, 'customer_login_identity', { p_kind: kind, p_document: doc, p_email: email })
}

export function emailDeliveryConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim(), from = process.env.RESEND_FROM_EMAIL?.trim()
  if (!apiKey || !from) throw new Error('Envio de código indisponível.')
  return { apiKey, from }
}
export async function sendInitialPassword(email: string, id: string, password: string, nome: string, documentLabel: 'CPF' | 'CNPJ', reset = false) {
  const { apiKey, from } = emailDeliveryConfig()
  const message = buildCustomerAccessEmail({ nome, password, documentLabel, reset })
  const logo = await readFile(join(process.cwd(), 'public', 'logo-nova-alianca-azul.png'))
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `initial-password-${id}` },
    body: JSON.stringify({ from, to: [email], reply_to: 'suporte@novaaliancasaude.com.br', ...message,
      html: message.html.replace('https://novaaliancasaude.com.br/logo-nova-alianca-azul.png', 'cid:nova-alianca-logo'),
      attachments: [{ filename: 'nova-alianca-logo.png', content: logo.toString('base64'), content_id: 'nova-alianca-logo' }] }),
  })
  if (!response.ok) throw new Error('Envio de senha indisponível.')
}

export async function signEmailSession(claims: Record<string, unknown>, session: LoginSession) {
  return new SignJWT({ ...claims, authVersion: AUTH_VERSION, authMethod: EMAIL_AUTH_METHOD })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setJti(session.id)
    .setExpirationTime(Math.floor(new Date(session.expiresAt).getTime() / 1000)).sign(getJwtSecret())
}
export async function readAuthToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), { algorithms: ['HS256'] })
    if (payload.authVersion !== AUTH_VERSION || !Number.isFinite(payload.exp)) return null
    return payload
  } catch { return null }
}
export async function validateEmailSession(payload: JWTPayload, purpose: string, kind: string, id: string, cadastroId: string | null, doc: string) {
  if (payload.authMethod !== EMAIL_AUTH_METHOD || !uuid.safeParse(payload.jti).success ||
      !uuid.safeParse(id).success || (cadastroId !== null && !uuid.safeParse(cadastroId).success) ||
      typeof payload.email !== 'string' || payload.purpose !== purpose) return null
  return rpc<LoginIdentity | null>(createAdminClient(), 'customer_login_validate_session', {
    p_id: payload.jti, p_kind: kind, p_identity_id: id, p_cadastro_id: cadastroId,
    p_purpose: purpose, p_document: doc, p_email: payload.email,
    p_document_key: authKey('document', doc), p_email_key: authKey('email', payload.email),
  })
}
export async function revokeEmailSession(token: string | undefined) {
  if (!token) return
  const payload = await readAuthToken(token)
  if (!payload || payload.authMethod !== EMAIL_AUTH_METHOD || !uuid.safeParse(payload.jti).success) return
  const { error } = await createAdminClient().from('customer_login_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', payload.jti!)
  if (error) throw new Error('Não foi possível encerrar a sessão. Tente novamente.')
}
