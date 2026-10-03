import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { getJwtSecret } from '@/lib/auth-secret'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveEmpresaAccessException } from '@/lib/empresa-access'

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
    const { payload } = await jwtVerify(token, getJwtSecret(), { algorithms: ['HS256'] })
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (typeof payload.clienteId !== 'string' || !uuid.test(payload.clienteId) ||
        typeof payload.cpf !== 'string' || !/^\d{11}$/.test(payload.cpf) ||
        typeof payload.nome !== 'string' || !payload.nome.trim() ||
        typeof payload.exp !== 'number' || (payload.tipo !== 'titular' && payload.tipo !== 'dependente')) return null
    const tipo = payload.tipo
    if (tipo === 'dependente' && (typeof payload.dependenteId !== 'string' || !uuid.test(payload.dependenteId))) return null

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
  const auth = request ? await getClienteAuthFromRequest(request) : await getClienteAuth()
  if (!auth) return null
  const supabase = createAdminClient()
  const { data, error: cadastroError } = await supabase.from('cadastros').select('status, empresa_id').eq('id', auth.clienteId).maybeSingle()
  // Distinguish a revoked membership from an unavailable database. The latter must not cause logout.
  if (cadastroError) throw new Error('Não foi possível verificar seu acesso. Tente novamente.')
  if (!data) return null
  if (auth.tipo === 'dependente') {
    const { data: dependent, error } = await supabase.from('dependentes').select('id')
      .eq('id', auth.dependenteId!).eq('cadastro_id', auth.clienteId).maybeSingle()
    if (error) throw new Error('Não foi possível verificar seu acesso. Tente novamente.')
    if (!dependent) return null
  }
  if (!data.empresa_id) return data.status === 'ATIVO' ? auth : null
  const { data: empresa, error } = await supabase.from('empresas').select('status').eq('id', data.empresa_id).maybeSingle()
  if (error) throw new Error('Não foi possível verificar seu acesso. Tente novamente.')
  if (!empresa || empresa.status === 'INATIVO') return null
  if (data.status === 'ATIVO' && empresa.status === 'ATIVO') return auth
  const exception = await getActiveEmpresaAccessException(supabase, data.empresa_id)
  return exception ? auth : null
}

export async function requireActiveClienteAuth(request?: Request): Promise<ClienteAuth> {
  const auth = await getActiveClienteAuth(request)
  if (!auth) throw new Error('Não autenticado')
  return auth
}
