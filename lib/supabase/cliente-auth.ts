import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveEmpresaAccessException } from '@/lib/empresa-access'
import { readAuthToken, validateEmailSession } from '@/lib/customer-email-auth'
export type ClienteAuth = { clienteId: string; cpf: string; nome: string; email?: string; tipo: 'titular' | 'dependente'; dependenteId?: string }
async function authFromToken(token: string): Promise<ClienteAuth | null> {
  const payload = await readAuthToken(token)
  if (!payload || typeof payload.clienteId !== 'string' || typeof payload.cpf !== 'string' || !/^\d{11}$/.test(payload.cpf) ||
      typeof payload.nome !== 'string' || !payload.nome.trim() || (payload.tipo !== 'titular' && payload.tipo !== 'dependente')) return null
  const id = payload.tipo === 'dependente' ? payload.dependenteId : payload.clienteId
  if (typeof id !== 'string') return null
  const identity = await validateEmailSession(payload, 'cliente', payload.tipo, id, payload.clienteId, payload.cpf)
  if (!identity) return null
  return { clienteId: payload.clienteId, cpf: payload.cpf, nome: identity.nome, email: identity.email,
    tipo: payload.tipo, dependenteId: payload.tipo === 'dependente' ? id : undefined }
}
export async function getClienteAuth(): Promise<ClienteAuth | null> {
  const token = (await cookies()).get('cliente_token')?.value
  return token ? authFromToken(token) : null
}
export async function getClienteAuthFromRequest(request: Request): Promise<ClienteAuth | null> {
  const header = request.headers.get('Authorization')
  return header?.startsWith('Bearer ') ? authFromToken(header.slice(7)) : getClienteAuth()
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
