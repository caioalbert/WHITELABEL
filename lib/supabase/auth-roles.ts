type AuthUserWithAppMetadata = {
  app_metadata?: Record<string, unknown> | null
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function metadata(user: AuthUserWithAppMetadata | null | undefined) {
  return user?.app_metadata || {}
}

function metadataId(user: AuthUserWithAppMetadata | null | undefined, key: string) {
  const value = metadata(user)[key]
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : null
}

export function hasAdminRole(user: AuthUserWithAppMetadata | null | undefined) {
  const value = metadata(user)
  return value.role === 'admin' || value.is_admin === true
}

export function getVendedorId(user: AuthUserWithAppMetadata | null | undefined) {
  const value = metadata(user)
  if (value.role !== 'vendedor' && value.is_vendedor !== true) return null
  return metadataId(user, 'vendedor_id')
}

export function getParceiroId(user: AuthUserWithAppMetadata | null | undefined) {
  const value = metadata(user)
  if (value.role !== 'parceiro' && value.is_parceiro !== true) return null
  return metadataId(user, 'parceiro_id')
}
