import { getJwtSecret } from '@/lib/auth-secret'
import { SignJWT } from 'jose'
import { cookies } from 'next/headers'
import { AUTH_VERSION, readAuthToken, signEmailSession, validateEmailSession, type LoginSession } from '@/lib/customer-email-auth'

export const CADASTRO_FLOW_COOKIE = 'cadastro_fluxo_token'
export async function createCadastroFlowToken(cadastroId: string, verified?: { session: LoginSession; email: string; cpf: string }) {
  const claims = { cadastroId, purpose: 'cadastro-flow' }
  if (verified) return signEmailSession({ ...claims, email: verified.email, cpf: verified.cpf }, verified.session)
  return new SignJWT({ ...claims, authVersion: AUTH_VERSION, authMethod: 'registration' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('24h').sign(getJwtSecret())
}
export async function getCadastroFlowId() {
  const token = (await cookies()).get(CADASTRO_FLOW_COOKIE)?.value
  if (!token) return null
  const payload = await readAuthToken(token)
  if (!payload || payload.purpose !== 'cadastro-flow' || typeof payload.cadastroId !== 'string') return null
  if (payload.authMethod === 'registration') return payload.cadastroId
  if (typeof payload.cpf !== 'string' || !await validateEmailSession(payload, 'cadastro-flow', 'titular', payload.cadastroId, payload.cadastroId, payload.cpf)) return null
  return payload.cadastroId
}
