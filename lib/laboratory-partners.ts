export const LARP_SAUDE = {
  name: 'LARP SAÚDE',
  coverage: '+100 unidades no Ceará',
  description: 'Exames laboratoriais com qualidade, confiança e agilidade',
  phoneDisplay: '+55 85 8859-3405',
  whatsappNumber: '558588593405',
} as const

type LarpWhatsappParams = {
  origin: string
  customerName?: string | null
}

export function buildLarpSaudeWhatsappUrl({
  origin,
  customerName,
}: LarpWhatsappParams) {
  const lines = [
    'Olá, LARP SAÚDE!',
    `Vim pelo ${origin} e gostaria de usar o desconto da parceria para exames laboratoriais.`,
    customerName ? `Cliente: ${customerName}.` : null,
  ].filter(Boolean)

  return `https://wa.me/${LARP_SAUDE.whatsappNumber}?text=${encodeURIComponent(lines.join('\n'))}`
}
