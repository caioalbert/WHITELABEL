export const RAPIDOC_SERVICE_TYPES = ['G', 'P', 'GP', 'GS', 'GSP'] as const

export type RapidocServiceType = (typeof RAPIDOC_SERVICE_TYPES)[number]

export function getRapidocSyncServiceType(value = process.env.RAPIDOC_SERVICE_TYPE): RapidocServiceType {
  const normalized = String(value || '').trim().toUpperCase()
  return RAPIDOC_SERVICE_TYPES.includes(normalized as RapidocServiceType)
    ? (normalized as RapidocServiceType)
    : 'GS'
}

export function shouldLinkRapidocHolder(value = process.env.RAPIDOC_INCLUDE_HOLDER): boolean {
  return String(value || '').trim().toLowerCase() === 'true'
}

export function isRapidocAuthenticationFailure(status: number, message?: unknown): boolean {
  if (status === 401 || status === 403) return true
  return /token|authorization|client\s*id/i.test(String(message || ''))
}
