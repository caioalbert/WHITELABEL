import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'shalom-saude-secret-key-change-in-production'
)

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
    const { payload } = await jwtVerify(token, JWT_SECRET)
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

export async function requireClienteAuth(request?: Request): Promise<ClienteAuth> {
  const auth = request
    ? await getClienteAuthFromRequest(request)
    : await getClienteAuth()

  if (!auth) {
    throw new Error('Não autenticado')
  }

  return auth
}
