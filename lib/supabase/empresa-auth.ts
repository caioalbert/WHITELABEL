import { getJwtSecret } from '@/lib/auth-secret'
import { createAdminClient } from '@/lib/supabase/admin'
import { SignJWT } from 'jose'
import { cookies } from 'next/headers'
import { AUTH_VERSION, readAuthToken, signEmailSession, validateEmailSession, type LoginSession } from '@/lib/customer-email-auth'

export const EMPRESA_APP_COOKIE = 'empresa_token'
export const EMPRESA_FLOW_COOKIE = 'empresa_fluxo_token'
export type EmpresaAuth = { empresaId: string; cnpj: string; razaoSocial: string; purpose: 'empresa-app' | 'empresa-flow' }
async function readToken(token: string): Promise<EmpresaAuth | null> {
  const payload = await readAuthToken(token)
  if (!payload || typeof payload.empresaId !== 'string' || typeof payload.cnpj !== 'string' ||
      typeof payload.razaoSocial !== 'string' || (payload.purpose !== 'empresa-app' && payload.purpose !== 'empresa-flow')) return null
  if (payload.authMethod === 'registration') {
    if (payload.purpose !== 'empresa-flow') return null
  } else if (!await validateEmailSession(payload, payload.purpose, 'empresa', payload.empresaId, null, payload.cnpj)) return null
  return { empresaId: payload.empresaId, cnpj: payload.cnpj, razaoSocial: payload.razaoSocial, purpose: payload.purpose }
}
export async function createEmpresaToken(empresa: { id: string; cnpj: string; razao_social: string }, purpose: EmpresaAuth['purpose'], verified?: { session: LoginSession; email: string }) {
  const claims = { empresaId: empresa.id, cnpj: empresa.cnpj, razaoSocial: empresa.razao_social, purpose }
  if (verified) return signEmailSession({ ...claims, email: verified.email }, verified.session)
  if (purpose !== 'empresa-flow') throw new Error('Acesso requer confirmação do e-mail.')
  return new SignJWT({ ...claims, authVersion: AUTH_VERSION, authMethod: 'registration' }).setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt().setExpirationTime('24h').sign(getJwtSecret())
}
export async function getEmpresaFlowAuth() {
  const jar = await cookies(), token = jar.get(EMPRESA_FLOW_COOKIE)?.value || jar.get(EMPRESA_APP_COOKIE)?.value
  return token ? readToken(token) : null
}
export async function requireEmpresaFlowAuth() {
  const auth = await getEmpresaFlowAuth()
  if (!auth) throw new Error('Não autenticado')
  return auth
}
export async function getActiveEmpresaAuth() {
  const token = (await cookies()).get(EMPRESA_APP_COOKIE)?.value
  if (!token) return null
  const auth = await readToken(token)
  if (!auth || auth.purpose !== 'empresa-app') return null
  const { data, error } = await createAdminClient().from('empresas').select('status').eq('id', auth.empresaId).maybeSingle()
  if (error) throw new Error('Não foi possível verificar seu acesso. Tente novamente.')
  return data?.status === 'ATIVO' ? auth : null
}
export async function requireActiveEmpresaAuth() {
  const auth = await getActiveEmpresaAuth()
  if (!auth) throw new Error('Não autenticado')
  return auth
}
