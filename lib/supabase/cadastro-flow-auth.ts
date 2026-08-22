import { getJwtSecret } from '@/lib/auth-secret'
import { jwtVerify, SignJWT } from 'jose'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'cadastro_fluxo_token'

export async function createCadastroFlowToken(cadastroId: string) {
  return new SignJWT({ cadastroId, purpose: 'cadastro-flow' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getJwtSecret())
}

export async function getCadastroFlowId() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null

    const { payload } = await jwtVerify(token, getJwtSecret())
    if (payload.purpose !== 'cadastro-flow' || typeof payload.cadastroId !== 'string') {
      return null
    }

    return payload.cadastroId
  } catch {
    return null
  }
}

export const CADASTRO_FLOW_COOKIE = COOKIE_NAME
