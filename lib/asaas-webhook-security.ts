export const HANDLED_ASAAS_WEBHOOK_EVENTS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'])

type HeaderReader = {
  get(name: string): string | null
}

export function getAsaasWebhookToken(headers: HeaderReader) {
  const accessToken = headers.get('asaas-access-token')?.trim()
  if (accessToken) return accessToken

  const alternateToken = headers.get('x-asaas-access-token')?.trim()
  if (alternateToken) return alternateToken

  const authorization = headers.get('authorization')?.trim()
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim()
  }

  return ''
}

export function isHandledAsaasWebhookEvent(event: string) {
  return HANDLED_ASAAS_WEBHOOK_EVENTS.has(event)
}
