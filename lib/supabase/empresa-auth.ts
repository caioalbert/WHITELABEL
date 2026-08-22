import { getJwtSecret } from '@/lib/auth-secret'
import { createAdminClient } from '@/lib/supabase/admin'
import { jwtVerify, SignJWT } from 'jose'
import { cookies } from 'next/headers'

export const EMPRESA_APP_COOKIE = 'empresa_token'
export const EMPRESA_FLOW_COOKIE = 'empresa_fluxo_token'

export type EmpresaAuth = {
  empresaId: string
  cnpj: string
  razaoSocial: string
  purpose: 'empresa-app' | 'empresa-flow'
}

async function readToken(token: string): Promise<EmpresaAuth | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    if (
      typeof payload.empresaId !== 'string' ||
      typeof payload.cnpj !== 'string' ||
      typeof payload.razaoSocial !== 'string' ||
      (payload.purpose !== 'empresa-app' && payload.purpose !== 'empresa-flow')
    ) {
      return null
    }

    return {
      empresaId: payload.empresaId,
      cnpj: payload.cnpj,
      razaoSocial: payload.razaoSocial,
      purpose: payload.purpose,
    }
  } catch {
    return null
  }
}

export async function createEmpresaToken(
  empresa: { id: string; cnpj: string; razao_social: string },
  purpose: EmpresaAuth['purpose']
) {
  return new SignJWT({
    empresaId: empresa.id,
    cnpj: empresa.cnpj,
    razaoSocial: empresa.razao_social,
    purpose,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(purpose === 'empresa-app' ? '7d' : '24h')
    .sign(getJwtSecret())
}

export async function getEmpresaFlowAuth(): Promise<EmpresaAuth | null> {
  const cookieStore = await cookies()
  const flowToken = cookieStore.get(EMPRESA_FLOW_COOKIE)?.value
  const appToken = cookieStore.get(EMPRESA_APP_COOKIE)?.value

  const auth = flowToken ? await readToken(flowToken) : appToken ? await readToken(appToken) : null
  return auth
}

export async function requireEmpresaFlowAuth() {
  const auth = await getEmpresaFlowAuth()
  if (!auth) throw new Error('Não autenticado')
  return auth
}

export async function getActiveEmpresaAuth(): Promise<EmpresaAuth | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(EMPRESA_APP_COOKIE)?.value
    if (!token) return null

    const auth = await readToken(token)
    if (!auth || auth.purpose !== 'empresa-app') return null

    const supabase = createAdminClient()
    const { data } = await supabase
      .from('empresas')
      .select('status')
      .eq('id', auth.empresaId)
      .maybeSingle()

    return data?.status === 'ATIVO' ? auth : null
  } catch {
    return null
  }
}

export async function requireActiveEmpresaAuth() {
  const auth = await getActiveEmpresaAuth()
  if (!auth) throw new Error('Não autenticado')
  return auth
}
