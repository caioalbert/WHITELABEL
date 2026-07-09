import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_BRANDING, normalizeBranding } from '@/lib/branding'
import { invalidateCache, serverCache } from '@/lib/server-cache'

export const BILLING_TYPE_OPTIONS = ['BOLETO', 'CREDIT_CARD'] as const
export type BillingTypeOption = (typeof BILLING_TYPE_OPTIONS)[number]

export const PLAN_TYPE_OPTIONS = ['INDIVIDUAL', 'FAMILIAR'] as const
export type PlanTypeOption = (typeof PLAN_TYPE_OPTIONS)[number]
export const MIN_ASAAS_CHARGE_VALUE = 5

type BillingSettingsRow = {
  id: boolean
  adesao_value: number | string
  mensalidade_value?: number | string | null
  mensalidade_individual_value?: number | string | null
  mensalidade_familiar_value?: number | string | null
  mensalidade_billing_types: string[] | null
  default_mensalidade_billing_type: string
  default_plan_type?: string | null
  updated_at: string
  comissao_percentual_adesao?: number | null
  comissao_percentual_mensalidade?: number | null
  comissao_mensalidades_max?: number | null
  telefone_emergencia?: string | null
  whatsapp_url?: string | null
  app_tagline?: string | null
  brand_name?: string | null
  brand_short_name?: string | null
  brand_logo_url?: string | null
  brand_logo_alt?: string | null
}

export type BillingSettings = {
  // Compatibilidade legada: valor padrão do plano selecionado como default
  adesaoValue: number
  mensalidadeValue: number
  // Valor por plano
  adesaoByPlanType: Record<PlanTypeOption, number>
  mensalidadeByPlanType: Record<PlanTypeOption, number>
  mensalidadeIndividualValue: number
  mensalidadeFamiliarValue: number
  mensalidadeBillingTypes: BillingTypeOption[]
  defaultMensalidadeBillingType: BillingTypeOption
  defaultPlanType: string
  updatedAt?: string
  source: 'database'
  // Configurações de comissão
  comissaoPercentualAdesao: number
  comissaoPercentualMensalidade: number
  comissaoMensalidadesMax: number | null
  // Configurações operacionais
  telefoneEmergencia: string
  whatsappUrl: string
  appTagline: string
  brandName: string
  brandShortName: string
  brandLogoUrl: string
  brandLogoAlt: string
}

type UpdateBillingSettingsInput = {
  adesaoValue?: number
  mensalidadeIndividualValue: number
  mensalidadeFamiliarValue: number
  mensalidadeBillingTypes: string[]
  defaultMensalidadeBillingType: string
  defaultPlanType: string
  comissaoPercentualAdesao?: number | null
  comissaoPercentualMensalidade?: number | null
  comissaoMensalidadesMax?: number | null
  telefoneEmergencia?: string | null
  whatsappUrl?: string | null
  appTagline?: string | null
  brandName?: string | null
  brandShortName?: string | null
  brandLogoUrl?: string | null
  brandLogoAlt?: string | null
}

function toUpperTrim(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toUpperCase()
}

function isBillingTypeOption(value: string): value is BillingTypeOption {
  return BILLING_TYPE_OPTIONS.includes(value as BillingTypeOption)
}

function normalizeBillingTypeValue(value: string | null | undefined): BillingTypeOption | null {
  const normalized = toUpperTrim(value)
  if (normalized === 'PIX') {
    return 'BOLETO'
  }

  return isBillingTypeOption(normalized) ? normalized : null
}

function normalizePlanType(value: string | null | undefined, fallback = 'INDIVIDUAL') {
  const normalized = toUpperTrim(value)
  if (normalized) return normalized

  const normalizedFallback = toUpperTrim(fallback)
  return normalizedFallback || 'INDIVIDUAL'
}

function normalizeBillingTypeList(values: string[]) {
  const unique = Array.from(new Set(values.map((value) => normalizeBillingTypeValue(value)).filter(Boolean)))
  const allowed = unique.filter((value): value is BillingTypeOption => Boolean(value))

  if (allowed.length === 0) {
    throw new Error('Nenhuma forma de cobrança válida foi configurada no banco.')
  }

  return allowed
}

function parsePositiveAmount(value: number | string | null | undefined, fieldLabel: string) {
  const raw = String(value ?? '')
  const normalized = raw.replace(',', '.').trim()
  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Valor invÃ¡lido para ${fieldLabel}.`)
  }

  return Math.round((parsed + Number.EPSILON) * 100) / 100
}

export function getPlanValueByPlanType(
  settings: Pick<BillingSettings, 'mensalidadeIndividualValue' | 'mensalidadeFamiliarValue' | 'defaultPlanType'>,
  planType: string | null | undefined
) {
  const normalizedPlanType = normalizePlanType(planType, settings.defaultPlanType)
  if (normalizedPlanType === 'FAMILIAR') {
    return settings.mensalidadeFamiliarValue
  }

  if (normalizedPlanType === 'INDIVIDUAL') {
    return settings.mensalidadeIndividualValue
  }

  const normalizedDefaultPlanType = normalizePlanType(settings.defaultPlanType, 'INDIVIDUAL')
  return normalizedDefaultPlanType === 'FAMILIAR'
    ? settings.mensalidadeFamiliarValue
    : settings.mensalidadeIndividualValue
}

export const getMensalidadeValueByPlanType = getPlanValueByPlanType
export const getAdesaoValueByPlanType = getPlanValueByPlanType

function buildBillingSettings(params: {
  mensalidadeIndividualValue: number
  mensalidadeFamiliarValue: number
  mensalidadeBillingTypes: BillingTypeOption[]
  defaultMensalidadeBillingType: BillingTypeOption
  defaultPlanType: string
  defaultPlanValue?: number
  source: 'database'
  updatedAt?: string
  comissaoPercentualAdesao?: number | null
  comissaoPercentualMensalidade?: number | null
  comissaoMensalidadesMax?: number | null
  telefoneEmergencia?: string | null
  whatsappUrl?: string | null
  appTagline?: string | null
  brandName?: string | null
  brandShortName?: string | null
  brandLogoUrl?: string | null
  brandLogoAlt?: string | null
}): BillingSettings {
  const valorByPlanType: Record<PlanTypeOption, number> = {
    INDIVIDUAL: params.mensalidadeIndividualValue,
    FAMILIAR: params.mensalidadeFamiliarValue,
  }

  const normalizedDefaultPlanType = normalizePlanType(params.defaultPlanType, 'INDIVIDUAL')
  const defaultPlanValue =
    params.defaultPlanValue ??
    (normalizedDefaultPlanType === 'FAMILIAR'
      ? params.mensalidadeFamiliarValue
      : params.mensalidadeIndividualValue)
  const branding = normalizeBranding({
    brandName: params.brandName || DEFAULT_BRANDING.brandName,
    brandShortName: params.brandShortName || DEFAULT_BRANDING.brandShortName,
    brandLogoUrl: params.brandLogoUrl || DEFAULT_BRANDING.brandLogoUrl,
    brandLogoAlt: params.brandLogoAlt || DEFAULT_BRANDING.brandLogoAlt,
    appTagline: params.appTagline || DEFAULT_BRANDING.appTagline,
  })

  return {
    adesaoValue: defaultPlanValue,
    mensalidadeValue: defaultPlanValue,
    adesaoByPlanType: { ...valorByPlanType },
    mensalidadeByPlanType: { ...valorByPlanType },
    mensalidadeIndividualValue: params.mensalidadeIndividualValue,
    mensalidadeFamiliarValue: params.mensalidadeFamiliarValue,
    mensalidadeBillingTypes: params.mensalidadeBillingTypes,
    defaultMensalidadeBillingType: params.defaultMensalidadeBillingType,
    defaultPlanType: normalizedDefaultPlanType,
    updatedAt: params.updatedAt,
    source: params.source,
    comissaoPercentualAdesao: params.comissaoPercentualAdesao ?? 50,
    comissaoPercentualMensalidade: params.comissaoPercentualMensalidade ?? 50,
    comissaoMensalidadesMax: params.comissaoMensalidadesMax !== undefined ? params.comissaoMensalidadesMax : 1,
    telefoneEmergencia: params.telefoneEmergencia || '(85) 3000-0000',
    whatsappUrl: params.whatsappUrl || 'https://wa.me/5585991452514',
    appTagline: branding.appTagline,
    brandName: branding.brandName,
    brandShortName: branding.brandShortName,
    brandLogoUrl: branding.brandLogoUrl,
    brandLogoAlt: branding.brandLogoAlt,
  }
}

function normalizeSettingsRow(row: BillingSettingsRow): BillingSettings {
  const legacyMensalidadeValue = row.mensalidade_value ?? row.adesao_value

  const mensalidadeIndividualValue = parsePositiveAmount(
    row.mensalidade_individual_value ?? legacyMensalidadeValue,
    'valor do plano individual'
  )
  const mensalidadeFamiliarValue = parsePositiveAmount(
    row.mensalidade_familiar_value ?? legacyMensalidadeValue,
    'valor do plano familiar'
  )

  const mensalidadeBillingTypes = normalizeBillingTypeList(row.mensalidade_billing_types || [])
  const requestedDefault = normalizeBillingTypeValue(row.default_mensalidade_billing_type)

  const defaultMensalidadeBillingType = requestedDefault && mensalidadeBillingTypes.includes(requestedDefault)
    ? requestedDefault
    : mensalidadeBillingTypes[0]
  const normalizedDefaultPlanType = normalizePlanType(row.default_plan_type, 'INDIVIDUAL')
  const defaultPlanValue = legacyMensalidadeValue === null || legacyMensalidadeValue === undefined
    ? undefined
    : parsePositiveAmount(legacyMensalidadeValue, 'valor padrÃ£o do plano')

  return buildBillingSettings({
    mensalidadeIndividualValue,
    mensalidadeFamiliarValue,
    mensalidadeBillingTypes,
    defaultMensalidadeBillingType,
    defaultPlanType: normalizedDefaultPlanType,
    defaultPlanValue,
    updatedAt: row.updated_at,
    source: 'database',
    comissaoPercentualAdesao: row.comissao_percentual_adesao ?? 50,
    comissaoPercentualMensalidade: row.comissao_percentual_mensalidade ?? 50,
    comissaoMensalidadesMax: row.comissao_mensalidades_max !== undefined && row.comissao_mensalidades_max !== null
      ? row.comissao_mensalidades_max
      : 1,
    telefoneEmergencia: row.telefone_emergencia || null,
    whatsappUrl: row.whatsapp_url || null,
    appTagline: row.app_tagline || null,
    brandName: row.brand_name || null,
    brandShortName: row.brand_short_name || null,
    brandLogoUrl: row.brand_logo_url || null,
    brandLogoAlt: row.brand_logo_alt || null,
  })
}

async function fetchBillingSettingsRow() {
  const supabase = createAdminClient()
  return supabase
    .from('cobranca_configuracoes')
    .select(
      'id, adesao_value, mensalidade_value, mensalidade_individual_value, mensalidade_familiar_value, mensalidade_billing_types, default_mensalidade_billing_type, default_plan_type, updated_at, comissao_percentual_adesao, comissao_percentual_mensalidade, comissao_mensalidades_max, telefone_emergencia, whatsapp_url, app_tagline, brand_name, brand_short_name, brand_logo_url, brand_logo_alt'
    )
    .eq('id', true)
    .maybeSingle()
}

async function syncPlanCatalogBaseValues(input: {
  individualValue: number
  familiarValue: number
}) {
  const supabase = createAdminClient()

  const ensurePlan = async (plan: {
    code: 'INDIVIDUAL' | 'FAMILIAR'
    defaultName: string
    value: number
    order: number
  }) => {
    const { data, error } = await supabase
      .from('planos')
      .select('id')
      .eq('codigo', plan.code)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (data?.id) {
      const { error: updateError } = await supabase
        .from('planos')
        .update({
          valor: plan.value,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id)

      if (updateError) {
        throw updateError
      }

      return
    }

    const { error: insertError } = await supabase
      .from('planos')
      .insert({
        codigo: plan.code,
        nome: plan.defaultName,
        valor: plan.value,
        ativo: true,
        ordem: plan.order,
      })

    if (insertError) {
      throw insertError
    }
  }

  try {
    await ensurePlan({
      code: 'INDIVIDUAL',
      defaultName: 'Plano Individual',
      value: input.individualValue,
      order: 1,
    })
    await ensurePlan({
      code: 'FAMILIAR',
      defaultName: 'Plano Familiar',
      value: input.familiarValue,
      order: 2,
    })
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)
    if (/relation .*planos|does not exist|42P01/i.test(details)) {
      return
    }
    throw error
  }
}

export async function getBillingSettings(): Promise<BillingSettings> {
  return serverCache('billing-settings', 120, async () => {
    const { data, error } = await fetchBillingSettingsRow()

    if (error) {
      const details = `${error.message || ''} ${error.details || ''}`
      if (/relation .*cobranca_configuracoes|does not exist|42P01/i.test(details)) {
        throw new Error(
          'Configurações de cobrança não encontradas. Execute as migrations de cobrança e configure os valores no banco.'
        )
      }

      throw error
    }

    if (!data) {
      throw new Error('Configurações de cobrança não cadastradas no banco.')
    }

    return normalizeSettingsRow(data as BillingSettingsRow)
  })
}

async function resolveDefaultPlanValue(params: {
  supabase: ReturnType<typeof createAdminClient>
  defaultPlanType: string
  mensalidadeIndividualValue: number
  mensalidadeFamiliarValue: number
}) {
  const normalizedDefaultPlanType = normalizePlanType(params.defaultPlanType, 'INDIVIDUAL')

  if (normalizedDefaultPlanType === 'INDIVIDUAL') {
    return params.mensalidadeIndividualValue
  }

  if (normalizedDefaultPlanType === 'FAMILIAR') {
    return params.mensalidadeFamiliarValue
  }

  try {
    const { data, error } = await params.supabase
      .from('planos')
      .select('valor')
      .eq('codigo', normalizedDefaultPlanType)
      .maybeSingle()

    if (error) {
      throw error
    }

    const parsedPlanValue = Number(data?.valor)
    if (Number.isFinite(parsedPlanValue) && parsedPlanValue >= MIN_ASAAS_CHARGE_VALUE) {
      return Math.round((parsedPlanValue + Number.EPSILON) * 100) / 100
    }
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)
    if (!/relation .*planos|does not exist|42P01/i.test(details)) {
      throw error
    }
  }

  return params.mensalidadeIndividualValue
}

export async function updateBillingSettings(input: UpdateBillingSettingsInput): Promise<BillingSettings> {
  const mensalidadeIndividualValue = parsePositiveAmount(
    input.mensalidadeIndividualValue,
    'valor do plano individual'
  )
  const mensalidadeFamiliarValue = parsePositiveAmount(
    input.mensalidadeFamiliarValue,
    'valor do plano familiar'
  )

  if (mensalidadeIndividualValue < MIN_ASAAS_CHARGE_VALUE) {
    throw new Error(
      `Valor invÃ¡lido para o plano individual. O mÃ­nimo permitido pelo Asaas Ã© R$ ${MIN_ASAAS_CHARGE_VALUE.toFixed(2).replace('.', ',')}.`
    )
  }

  if (mensalidadeFamiliarValue < MIN_ASAAS_CHARGE_VALUE) {
    throw new Error(
      `Valor invÃ¡lido para o plano familiar. O mÃ­nimo permitido pelo Asaas Ã© R$ ${MIN_ASAAS_CHARGE_VALUE.toFixed(2).replace('.', ',')}.`
    )
  }

  const mensalidadeBillingTypes = normalizeBillingTypeList(input.mensalidadeBillingTypes)

  const defaultBillingTypeRaw = normalizeBillingTypeValue(input.defaultMensalidadeBillingType)
  const defaultMensalidadeBillingType =
    defaultBillingTypeRaw && mensalidadeBillingTypes.includes(defaultBillingTypeRaw)
    ? defaultBillingTypeRaw
    : mensalidadeBillingTypes[0]

  const defaultPlanType = normalizePlanType(input.defaultPlanType, 'INDIVIDUAL')

  const supabase = createAdminClient()
  const defaultPlanValue = await resolveDefaultPlanValue({
    supabase,
    defaultPlanType,
    mensalidadeIndividualValue,
    mensalidadeFamiliarValue,
  })

  const { data, error } = await supabase
    .from('cobranca_configuracoes')
    .upsert(
      {
        id: true,
        adesao_value: defaultPlanValue,
        mensalidade_value: defaultPlanValue,
        mensalidade_individual_value: mensalidadeIndividualValue,
        mensalidade_familiar_value: mensalidadeFamiliarValue,
        mensalidade_billing_types: mensalidadeBillingTypes,
        default_mensalidade_billing_type: defaultMensalidadeBillingType,
        default_plan_type: defaultPlanType,
        updated_at: new Date().toISOString(),
        comissao_percentual_adesao: input.comissaoPercentualAdesao ?? undefined,
        comissao_percentual_mensalidade: input.comissaoPercentualMensalidade ?? undefined,
        comissao_mensalidades_max: input.comissaoMensalidadesMax !== undefined
          ? input.comissaoMensalidadesMax
          : undefined,
        ...(input.telefoneEmergencia !== undefined && { telefone_emergencia: input.telefoneEmergencia }),
        ...(input.whatsappUrl !== undefined && { whatsapp_url: input.whatsappUrl }),
        ...(input.appTagline !== undefined && { app_tagline: input.appTagline }),
        ...(input.brandName !== undefined && { brand_name: input.brandName }),
        ...(input.brandShortName !== undefined && { brand_short_name: input.brandShortName }),
        ...(input.brandLogoUrl !== undefined && { brand_logo_url: input.brandLogoUrl }),
        ...(input.brandLogoAlt !== undefined && { brand_logo_alt: input.brandLogoAlt }),
      },
      { onConflict: 'id' }
    )
    .select(
      'id, adesao_value, mensalidade_value, mensalidade_individual_value, mensalidade_familiar_value, mensalidade_billing_types, default_mensalidade_billing_type, default_plan_type, updated_at, comissao_percentual_adesao, comissao_percentual_mensalidade, comissao_mensalidades_max, telefone_emergencia, whatsapp_url, app_tagline, brand_name, brand_short_name, brand_logo_url, brand_logo_alt'
    )
    .single()

  if (error) {
    throw error
  }

  await syncPlanCatalogBaseValues({
    individualValue: mensalidadeIndividualValue,
    familiarValue: mensalidadeFamiliarValue,
  })

  // Invalidate server cache so next request fetches fresh data
  invalidateCache('billing-settings')
  invalidateCache('public-planos')

  return normalizeSettingsRow(data as BillingSettingsRow)
}
