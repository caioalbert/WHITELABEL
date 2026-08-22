import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { getJwtSecret } from '@/lib/auth-secret'
import { createAdminClient } from '@/lib/supabase/admin'

export type ClienteAuth = {
  clienteId: string
  cpf: string
  nome: string
  email?: string
  tipo: 'titular' | 'dependente'
  dependenteId?: string
}

async function authFromToken(token: string): Promise<ClienteAuth | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    const tipo = payload.tipo === 'dependente' ? 'dependente' : 'titular'

    return {
      clienteId: payload.clienteId as string,
      cpf: payload.cpf as string,
      nome: payload.nome as string,
      email: payload.email as string | undefined,
      tipo,
      dependenteId: tipo === 'dependente' ? (payload.dependenteId as string | undefined) : undefined,
    }
  } catch {
    return null
  }
}

export async function getClienteAuth(): Promise<ClienteAuth | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('cliente_token')?.value

    if (!token) {
      return null
    }

    return authFromToken(token)
  } catch {
    return null
  }
}

export async function getClienteAuthFromRequest(
  request: Request
): Promise<ClienteAuth | null> {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authFromToken(authHeader.slice(7))
  }

  return getClienteAuth()
}

export async function getActiveClienteAuth(request?: Request): Promise<ClienteAuth | null> {
  try {
    const auth = request
      ? await getClienteAuthFromRequest(request)
      : await getClienteAuth()
    if (!auth) return null

    const supabase = createAdminClient()
    const { data } = await supabase
      .from('cadastros')
      .select('status')
      .eq('id', auth.clienteId)
      .maybeSingle()

    return data?.status === 'ATIVO' ? auth : null
  } catch {
    return null
  }
}

export async function requireActiveClienteAuth(request?: Request): Promise<ClienteAuth> {
  const auth = await getActiveClienteAuth(request)
  if (!auth) throw new Error('Não autenticado')
  return auth
}
