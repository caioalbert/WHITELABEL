export type PublicBranding = {
  brandName: string
  brandShortName: string
  brandLogoUrl: string
  brandLogoAlt: string
  appTagline: string
}

export const DEFAULT_BRAND_LOGO_ON_LIGHT_URL = '/logo-nova-alianca-azul.png'

export const DEFAULT_BRANDING: PublicBranding = {
  brandName: 'Nova Aliança',
  brandShortName: 'Nova Aliança',
  brandLogoUrl: '/logo-nova-alianca.png',
  brandLogoAlt: 'Nova Aliança Consultoria e Representações',
  appTagline: 'Sua saúde completa e segura',
}

export function isSupportedBrandLogoUrl(value: string | null | undefined) {
  const normalized = String(value || '').trim()
  if (!normalized) return true
  if (normalized.startsWith('/')) return true

  try {
    const parsed = new URL(normalized)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

export function normalizeBranding(input: Partial<PublicBranding> | null | undefined): PublicBranding {
  const brandName = String(input?.brandName || '').trim() || DEFAULT_BRANDING.brandName
  const brandShortName = String(input?.brandShortName || '').trim() || brandName
  const rawLogoUrl = String(input?.brandLogoUrl || '').trim()
  const brandLogoUrl = isSupportedBrandLogoUrl(rawLogoUrl) && rawLogoUrl
    ? rawLogoUrl
    : DEFAULT_BRANDING.brandLogoUrl
  const brandLogoAlt = String(input?.brandLogoAlt || '').trim() || brandName
  const appTagline = String(input?.appTagline || '').trim() || DEFAULT_BRANDING.appTagline

  return {
    brandName,
    brandShortName,
    brandLogoUrl,
    brandLogoAlt,
    appTagline,
  }
}
