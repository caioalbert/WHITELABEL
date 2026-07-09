import { MIN_ASAAS_CHARGE_VALUE } from '@/lib/billing-settings'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminAuth } from '@/lib/supabase/admin-auth'
import { NextRequest, NextResponse } from 'next/server'

type RouteContext = { params: Promise<{ id: string }> }

function mapDatabaseErrorMessage(error: unknown) {
  const details = (() => {
    if (error instanceof Error) return error.message

    if (error && typeof error === 'object') {
      const maybePostgrestError = error as {
        message?: string
        details?: string
        hint?: string
        code?: string
      }

      return `${maybePostgrestError.message || ''} ${maybePostgrestError.details || ''} ${maybePostgrestError.hint || ''} ${maybePostgrestError.code || ''}`
    }

    return String(error)
  })()

  if (/relation .*planos|does not exist|42P01/i.test(details)) {
    return 'Banco desatualizado. Execute scripts/009_add_planos_module.sql no Supabase SQL Editor.'
  }

  if (/permite_dependentes|dependentes_minimos|max_dependentes|valor_dependente_adicional/i.test(details)) {
    return 'Banco desatualizado. Execute scripts/010_add_planos_dependentes_rules.sql no Supabase SQL Editor.'
  }

  if (/descricao_publica|beneficios_publicos/i.test(details)) {
    return 'Banco desatualizado. Execute scripts/011_add_planos_publico_conteudo.sql no Supabase SQL Editor.'
  }

  if (/relation .*cobranca_configuracoes|does not exist|42P01/i.test(details)) {
    return 'Banco desatualizado. Execute scripts/005_add_billing_settings_admin.sql e scripts/006_add_plan_type_pricing.sql no Supabase SQL Editor.'
  }

  if (/fetch failed|enotfound|getaddrinfo|network/i.test(details)) {
    return 'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.'
  }

  return null
}

async function getValidatedId(context: RouteContext) {
  const { id } = await context.params
  return id?.trim() || null
}

function parseIntegerField(value: unknown, fieldLabel: string) {
  const normalized = String(value ?? '').trim()
  if (!normalized) {
    throw new Error(`Informe ${fieldLabel}.`)
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} inválido(a).`)
  }

  return parsed
}

function parseOptionalIntegerField(value: unknown, fieldLabel: string) {
  const normalized = String(value ?? '').trim()
  if (!normalized) return null

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} inválido(a).`)
  }

  return parsed
}

function parseAmountField(value: unknown, fieldLabel: string) {
  const normalized = String(value ?? '').replace(',', '.').trim()
  if (!normalized) {
    throw new Error(`Informe ${fieldLabel}.`)
  }

  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} inválido(a).`)
  }

  return Math.round((parsed + Number.EPSILON) * 100) / 100
}

async function syncBasePlanValueToBilling(
  supabase: ReturnType<typeof createAdminClient>,
  planCode: string,
  planValue: number
) {
  if (planCode !== 'INDIVIDUAL' && planCode !== 'FAMILIAR') {
    return
  }

  const { data: row, error } = await supabase
    .from('cobranca_configuracoes')
    .select(
      'id, adesao_value, mensalidade_value, mensalidade_individual_value, mensalidade_familiar_value, default_plan_type'
    )
    .eq('id', true)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!row) {
    return
  }

  const currentDefaultPlanType = String(row.default_plan_type || 'INDIVIDUAL').trim().toUpperCase()

  const nextIndividualValue =
    planCode === 'INDIVIDUAL' ? planValue : Number(row.mensalidade_individual_value || row.mensalidade_value || row.adesao_value || 49.9)

  const nextFamiliarValue =
    planCode === 'FAMILIAR' ? planValue : Number(row.mensalidade_familiar_value || row.mensalidade_value || row.adesao_value || 79.9)

  const defaultPlanValue = currentDefaultPlanType === 'FAMILIAR' ? nextFamiliarValue : nextIndividualValue

  const { error: updateError } = await supabase
    .from('cobranca_configuracoes')
    .update({
      mensalidade_individual_value: nextIndividualValue,
      mensalidade_familiar_value: nextFamiliarValue,
      mensalidade_value: defaultPlanValue,
      adesao_value: defaultPlanValue,
      updated_at: new Date().toISOString(),
    })
    .eq('id', true)

  if (updateError) {
    throw updateError
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authResult = await requireAdminAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const planId = await getValidatedId(context)
    if (!planId) {
      return NextResponse.json({ error: 'ID de plano inválido.' }, { status: 400 })
    }

    const body = (await request.json().catch(() => null)) as
      | {
          nome?: string
          descricao_publica?: string | null
          beneficios_publicos?: string | null
          valor?: number | string
          ativo?: boolean
          permite_dependentes?: boolean
          dependentes_minimos?: number | string
          max_dependentes?: number | string | null
          valor_dependente_adicional?: number | string
        }
      | null

    if (!body) {
      return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
    }

    const nome =
      body.nome === undefined
        ? undefined
        : String(body.nome || '').trim()
    const hasDescricaoPublicaField = body.descricao_publica !== undefined
    const descricaoPublica =
      body.descricao_publica === undefined
        ? undefined
        : String(body.descricao_publica || '').trim()
    const hasBeneficiosPublicosField = body.beneficios_publicos !== undefined
    const beneficiosPublicos =
      body.beneficios_publicos === undefined
        ? undefined
        : String(body.beneficios_publicos || '').trim()

    const hasValorField = body.valor !== undefined
    const valor = hasValorField ? Number(body.valor) : undefined
    const hasPermiteDependentesField = body.permite_dependentes !== undefined
    const hasDependentesMinimosField = body.dependentes_minimos !== undefined
    const hasMaxDependentesField = body.max_dependentes !== undefined
    const hasValorDependenteAdicionalField = body.valor_dependente_adicional !== undefined

    if (nome !== undefined && !nome) {
      return NextResponse.json({ error: 'Nome do plano é obrigatório.' }, { status: 400 })
    }

    if (hasValorField) {
      if (!Number.isFinite(valor) || Number(valor) < MIN_ASAAS_CHARGE_VALUE) {
        return NextResponse.json(
          {
            error: `Valor inválido. O mínimo permitido pelo Asaas é R$ ${MIN_ASAAS_CHARGE_VALUE.toFixed(2).replace('.', ',')}.`,
          },
          { status: 400 }
        )
      }
    }

    if (
      nome === undefined &&
      !hasDescricaoPublicaField &&
      !hasBeneficiosPublicosField &&
      !hasValorField &&
      typeof body.ativo !== 'boolean' &&
      !hasPermiteDependentesField &&
      !hasDependentesMinimosField &&
      !hasMaxDependentesField &&
      !hasValorDependenteAdicionalField
    ) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: currentPlan, error: currentPlanError } = await supabase
      .from('planos')
      .select(
        'id, codigo, nome, descricao_publica, beneficios_publicos, valor, ativo, ordem, permite_dependentes, dependentes_minimos, max_dependentes, valor_dependente_adicional, created_at, updated_at'
      )
      .eq('id', planId)
      .maybeSingle()

    if (currentPlanError) {
      throw currentPlanError
    }

    if (!currentPlan) {
      return NextResponse.json({ error: 'Plano não encontrado.' }, { status: 404 })
    }

    const nextPermiteDependentes =
      hasPermiteDependentesField
        ? body.permite_dependentes === true
        : Boolean(currentPlan.permite_dependentes)

    let nextDependentesMinimos = Number(currentPlan.dependentes_minimos || 0)
    let nextMaxDependentes =
      currentPlan.max_dependentes === null || currentPlan.max_dependentes === undefined
        ? null
        : Number(currentPlan.max_dependentes)
    let nextValorDependenteAdicional = Number(currentPlan.valor_dependente_adicional || 0)

    try {
      if (hasDependentesMinimosField) {
        nextDependentesMinimos = parseIntegerField(
          body.dependentes_minimos,
          'quantidade mínima de dependentes'
        )
      } else if (!Number.isFinite(nextDependentesMinimos) || nextDependentesMinimos < 0) {
        nextDependentesMinimos = 0
      }

      if (hasMaxDependentesField) {
        nextMaxDependentes = parseOptionalIntegerField(
          body.max_dependentes,
          'limite máximo de dependentes'
        )
      } else if (nextMaxDependentes !== null && (!Number.isFinite(nextMaxDependentes) || nextMaxDependentes < 0)) {
        nextMaxDependentes = null
      }

      if (
        nextMaxDependentes !== null &&
        nextMaxDependentes > 0 &&
        nextMaxDependentes < nextDependentesMinimos
      ) {
        return NextResponse.json(
          {
            error:
              'O limite máximo de dependentes deve ser maior ou igual à quantidade mínima.',
          },
          { status: 400 }
        )
      }

      if (hasValorDependenteAdicionalField) {
        nextValorDependenteAdicional = parseAmountField(
          body.valor_dependente_adicional,
          'valor adicional por dependente'
        )
      } else if (!Number.isFinite(nextValorDependenteAdicional) || nextValorDependenteAdicional < 0) {
        nextValorDependenteAdicional = 0
      }

      if (nextPermiteDependentes && nextDependentesMinimos < 1) {
        return NextResponse.json(
          { error: 'Quando o plano permite dependentes, o mínimo deve ser pelo menos 1.' },
          { status: 400 }
        )
      }
    } catch (parseError) {
      return NextResponse.json(
        {
          error: parseError instanceof Error ? parseError.message : 'Regras de dependentes inválidas.',
        },
        { status: 400 }
      )
    }

    const payload: {
      nome?: string
      descricao_publica?: string | null
      beneficios_publicos?: string | null
      valor?: number
      ativo?: boolean
      permite_dependentes?: boolean
      dependentes_minimos?: number
      max_dependentes?: number | null
      valor_dependente_adicional?: number
      updated_at: string
    } = {
      updated_at: new Date().toISOString(),
    }

    if (nome !== undefined) payload.nome = nome
    if (hasDescricaoPublicaField) payload.descricao_publica = descricaoPublica || null
    if (hasBeneficiosPublicosField) payload.beneficios_publicos = beneficiosPublicos || null
    if (hasValorField && valor !== undefined) payload.valor = valor
    if (typeof body.ativo === 'boolean') payload.ativo = body.ativo
    if (
      hasPermiteDependentesField ||
      hasDependentesMinimosField ||
      hasMaxDependentesField ||
      hasValorDependenteAdicionalField
    ) {
      payload.permite_dependentes = nextPermiteDependentes
      payload.dependentes_minimos = nextDependentesMinimos
      payload.max_dependentes = nextMaxDependentes
      payload.valor_dependente_adicional = nextValorDependenteAdicional
    }

    const { data: updatedPlan, error: updateError } = await supabase
      .from('planos')
      .update(payload)
      .eq('id', planId)
      .select(
        'id, codigo, nome, descricao_publica, beneficios_publicos, valor, ativo, ordem, permite_dependentes, dependentes_minimos, max_dependentes, valor_dependente_adicional, created_at, updated_at'
      )
      .single()

    if (updateError) {
      throw updateError
    }

    if (hasValorField && valor !== undefined) {
      await syncBasePlanValueToBilling(supabase, String(updatedPlan.codigo || ''), valor)
    }

    return NextResponse.json({
      success: true,
      message: 'Plano atualizado com sucesso.',
      plano: updatedPlan,
    })
  } catch (error) {
    const mappedMessage = mapDatabaseErrorMessage(error)
    if (mappedMessage) {
      return NextResponse.json({ error: mappedMessage }, { status: 500 })
    }

    console.error('Admin planos PATCH error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar plano.' }, { status: 500 })
  }
}
