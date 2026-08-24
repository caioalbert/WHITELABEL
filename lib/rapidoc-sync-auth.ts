export function hasValidCronAuthorization(
  authorizationHeader: string | null,
  cronSecret: string | undefined
) {
  const secret = cronSecret?.trim()
  if (!secret) return false
  return authorizationHeader === `Bearer ${secret}`
}
