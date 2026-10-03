import { z } from 'zod'
import { readAuthToken, validateEmailSession } from '@/lib/customer-email-auth'
import { isValidCPF, isValidCNPJ } from '@/lib/utils'

const setupClaims = z.object({
  jti: z.string().uuid(), challengeId: z.string().uuid(), purpose: z.literal('password-setup'),
  identityKind: z.enum(['titular', 'dependente', 'empresa']), identityId: z.string().uuid(),
  clienteId: z.string().uuid().optional(), document: z.string().regex(/^\d{11}$|^\d{14}$/), email: z.string().email(),
}).refine(v => v.identityKind === 'empresa' ? !v.clienteId && isValidCNPJ(v.document) : Boolean(v.clienteId) && isValidCPF(v.document))

export async function readPasswordSetup(request: Request) {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ') || header.length > 4096) return null
  const payload = await readAuthToken(header.slice(7))
  const parsed = setupClaims.safeParse(payload)
  if (!parsed.success || !payload) return null
  const claims = parsed.data
  const identity = await validateEmailSession(payload, 'password-setup', claims.identityKind, claims.identityId, claims.clienteId || null, claims.document)
  return identity ? { claims, identity } : null
}
