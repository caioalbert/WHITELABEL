export function getJwtSecret() {
  const value = process.env.JWT_SECRET?.trim()

  if (!value || value.length < 32) {
    throw new Error('JWT_SECRET deve estar configurado com pelo menos 32 caracteres.')
  }

  return new TextEncoder().encode(value)
}
