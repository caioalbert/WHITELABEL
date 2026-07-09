import { getBillingSettings } from '@/lib/billing-settings'
import { DEFAULT_BRANDING } from '@/lib/branding'
import { NextResponse } from 'next/server'

/**
 * GET /api/configuracoes-publicas
 * Retorna configurações operacionais que o frontend do cliente pode usar.
 * Não requer autenticação — dados são não-sensíveis (telefone, tagline, whatsapp).
 */
export async function GET() {
  try {
    const settings = await getBillingSettings()
    return NextResponse.json({
      telefoneEmergencia: settings.telefoneEmergencia,
      whatsappUrl: settings.whatsappUrl,
      appTagline: settings.appTagline,
      brandName: settings.brandName,
      brandShortName: settings.brandShortName,
      brandLogoUrl: settings.brandLogoUrl,
      brandLogoAlt: settings.brandLogoAlt,
    })
  } catch {
    // Fallback para defaults caso o banco ainda não tenha a migration
    return NextResponse.json({
      telefoneEmergencia: '(85) 3000-0000',
      whatsappUrl: 'https://wa.me/5585991452514',
      appTagline: DEFAULT_BRANDING.appTagline,
      brandName: DEFAULT_BRANDING.brandName,
      brandShortName: DEFAULT_BRANDING.brandShortName,
      brandLogoUrl: DEFAULT_BRANDING.brandLogoUrl,
      brandLogoAlt: DEFAULT_BRANDING.brandLogoAlt,
    })
  }
}
