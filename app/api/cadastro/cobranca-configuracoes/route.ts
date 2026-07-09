import { BILLING_TYPE_OPTIONS, getBillingSettings } from '@/lib/billing-settings'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

// Force dynamic to prevent Next.js from caching this route — it depends on ?ref= param
export const dynamic = 'force-dynamic'

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

type PublicPlanOption = {
  codigo: string
  nome: string
  descricao: string
  beneficios: Array<{ texto: string; inclui: boolean }>
  valor: number
  permiteDependentes: boolean
  minDependentes: number
  maxDependentes: number | null
  valorDependenteAdicional: number
}

function normalizePlanCode(value: unknown) {
  return String(value || '').trim().toUpperCase()
}

function toPositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.round((parsed + Number.EPSILON) * 100) / 100
}

function toNonNegativeInteger(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    return fallback
  }

  return parsed
}

function toOptionalNonNegativeInteger(value: unknown, fallback: number | null = null) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    return fallback
  }

  return parsed
}

function toNonNegativeAmount(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback
  }

  return Math.round((parsed + Number.EPSILON) * 100) / 100
}

function parsePublicBenefits(value: unknown) {
  const lines = String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return lines
    .map((line) => {
      const marker = line[0]
      if (marker === '+' || marker === '-') {
        const texto = line.slice(1).trim()
        if (!texto) return null
        return { texto, inclui: marker === '+' }
      }

      return { texto: line, inclui: true }
    })
    .filter((item): item is { texto: string; inclui: boolean } => Boolean(item))
}

function mapLegacyPlanOptions(settings: Awaited<ReturnType<typeof getBillingSettings>>): PublicPlanOption[] {
  return [
    {
      codigo: 'INDIVIDUAL',
      nome: 'Plano Individual',
      descricao: 'Cobertura para o titular.',
      beneficios: [],
      valor: settings.mensalidadeIndividualValue,
      permiteDependentes: false,
      minDependentes: 0,
      maxDependentes: null,
      valorDependenteAdicional: 0,
    },
    {
      codigo: 'FAMILIAR',
      nome: 'Plano Familiar',
      descricao: 'Cobertura para titular e dependentes.',
      beneficios: [],
      valor: settings.mensalidadeFamiliarValue,
      permiteDependentes: true,
      minDependentes: 1,
      maxDependentes: 4,
      valorDependenteAdicional: 0,
    },
  ]
}

async function loadPublicPlanOptions(settings: Awaited<ReturnType<typeof getBillingSettings>>) {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('planos')
      .select(
        'codigo, nome, descricao_publica, beneficios_publicos, valor, permite_dependentes, dependentes_minimos, max_dependentes, valor_dependente_adicional, ordem, created_at'
      )
      .eq('ativo', true)
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    const mapped = (data || [])
      .map((plan) => {
        const codigo = normalizePlanCode(plan.codigo)
        const nome = String(plan.nome || '').trim()
        const descricao = String(plan.descricao_publica || '').trim()
        const beneficios = parsePublicBenefits(plan.beneficios_publicos)
        const valor = toPositiveNumber(plan.valor, 0)

        if (!codigo || !nome || valor <= 0) {
          return null
        }

        const isFamiliar = codigo === 'FAMILIAR'
        const permiteDependentes = Boolean(plan.permite_dependentes ?? isFamiliar)
        const minDependentes = permiteDependentes
          ? Math.max(0, toNonNegativeInteger(plan.dependentes_minimos, isFamiliar ? 1 : 0))
          : 0
        const maxDependentes = permiteDependentes
          ? toOptionalNonNegativeInteger(plan.max_dependentes, isFamiliar ? 4 : null)
          : null
        const valorDependenteAdicional = permiteDependentes
          ? toNonNegativeAmount(plan.valor_dependente_adicional, 0)
          : 0

        return {
          codigo,
          nome,
          descricao,
          beneficios,
          valor,
          permiteDependentes,
          minDependentes,
          maxDependentes,
          valorDependenteAdicional,
        } satisfies PublicPlanOption
      })
      .filter((value): value is PublicPlanOption => Boolean(value))

    if (mapped.length > 0) {
      return mapped
    }
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)
    if (
      !/relation .*planos|does not exist|42P01|permite_dependentes|dependentes_minimos|max_dependentes|valor_dependente_adicional|descricao_publica|beneficios_publicos/i.test(
        details
      )
    ) {
      throw error
    }
  }

  return mapLegacyPlanOptions(settings)
}

export async function GET(request: NextRequest) {
  try {
    const ref = String(request.nextUrl.searchParams.get('ref') || '').trim().toUpperCase()

    const settings = await getBillingSettings()
    let planos = await loadPublicPlanOptions(settings)

    // --- Instituto/Vendedor ref: personalise plans and flags ---
    let tipoRef: 'instituto' | 'vendedor' | null = null
    let semAdesao = false
    let refNome: string | null = null

    if (ref) {
      const isInstitutoRef = ref.startsWith('INSTITUTO-')

      try {
        const supabase = createAdminClient()

        // Fast-path: INSTITUTO- prefix means it can only be an instituto
        if (!isInstitutoRef) {
          // Try vendedor first (codes without prefix are always vendedores)
          const { data: vendedor } = await supabase
            .from('vendedores')
            .select('id, nome, ativo')
            .eq('codigo_indicacao', ref)
            .maybeSingle()

          if (vendedor && vendedor.ativo) {
            tipoRef = 'vendedor'
            refNome = vendedor.nome
          }
        }

        if (!tipoRef) {
          // Try instituto
          const { data: instituto, error: institutoError } = await supabase
            .from('institutos')
            .select('id, nome, ativo, sem_adesao')
            .eq('codigo_indicacao', ref)
            .maybeSingle()

          if (institutoError) {
            const details = `${institutoError.message || ''} ${institutoError.details || ''} ${institutoError.code || ''}`

            if (/relation .*institutos|does not exist|42P01/i.test(details)) {
              return NextResponse.json(
                {
                  error:
                    'Banco desatualizado. Execute scripts/015_add_institutos_module.sql no Supabase SQL Editor.',
                },
                { status: 500 }
              )
            }

            if (/fetch failed|enotfound|getaddrinfo|network/i.test(details)) {
              return NextResponse.json(
                {
                  error:
                    'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
                },
                { status: 503 }
              )
            }

            console.error('[cobranca-config] instituto lookup error:', institutoError)
            return NextResponse.json(
              { error: 'Erro ao validar link de instituto.' },
              { status: 500 }
            )
          }

          if (isInstitutoRef && (!instituto || instituto.ativo !== true)) {
            return NextResponse.json(
              { error: 'Link de instituto inválido ou inativo.' },
              { status: 404 }
            )
          }

          if (instituto && instituto.ativo) {
            tipoRef = 'instituto'
            refNome = instituto.nome
            semAdesao = instituto.sem_adesao === true

            // Fetch instituto's OWN plans (replaces global plans entirely)
            const { data: institutoPlanos, error: planosErr } = await supabase
              .from('instituto_planos')
              .select('id, nome, descricao, valor, permite_dependentes, dependentes_minimos, max_dependentes, valor_dependente_adicional, ordem')
              .eq('instituto_id', instituto.id)
              .eq('ativo', true)
              .order('ordem', { ascending: true })
              .order('created_at', { ascending: true })

            if (planosErr) {
              const details = `${planosErr.message || ''} ${planosErr.details || ''} ${planosErr.code || ''}`
              if (/does not exist|42P01|relation.*instituto_planos/i.test(details)) {
                return NextResponse.json(
                  {
                    error:
                      'Banco desatualizado. Execute scripts/017_instituto_own_plans.sql no Supabase SQL Editor.',
                  },
                  { status: 500 }
                )
              }

              console.error('[cobranca-config] instituto_planos query error:', planosErr.message, planosErr.details)
              return NextResponse.json(
                { error: 'Erro ao carregar planos do instituto.' },
                { status: 500 }
              )
            } else {
              console.log(`[cobranca-config] instituto ${instituto.id} (${ref}) — ${institutoPlanos?.length ?? 0} planos encontrados`)
            }

            if (institutoPlanos && institutoPlanos.length > 0) {
              planos = institutoPlanos.map((p) => ({
                codigo: p.id,
                nome: String(p.nome || '').trim(),
                descricao: String(p.descricao || '').trim(),
                beneficios: [],
                valor: Number(p.valor),
                permiteDependentes: Boolean(p.permite_dependentes),
                minDependentes: Number(p.dependentes_minimos) || 0,
                maxDependentes: p.max_dependentes != null ? Number(p.max_dependentes) : null,
                valorDependenteAdicional: Number(p.valor_dependente_adicional) || 0,
              }))
            } else {
              return NextResponse.json(
                { error: 'Nenhum plano ativo disponível para este instituto.' },
                { status: 404 }
              )
            }
          }
        }
      } catch (err) {
        console.error('[cobranca-config] ref lookup failed:', err)

        if (isInstitutoRef) {
          const details = err instanceof Error ? err.message : String(err)

          if (/fetch failed|enotfound|getaddrinfo|network/i.test(details)) {
            return NextResponse.json(
              {
                error:
                  'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
              },
              { status: 503 }
            )
          }

          return NextResponse.json(
            { error: 'Erro ao validar link de instituto.' },
            { status: 500 }
          )
        }
      }
    }
    // -----------------------------------------------------------

    // These must be computed AFTER the instituto override so they reflect the final plan list
    const allowedPlanTypes = planos.map((plan) => plan.codigo)
    const defaultPlanType = allowedPlanTypes[0] || settings.defaultPlanType

    const mensalidadeByPlanType = planos.reduce<Record<string, number>>((acc, plan) => {
      acc[plan.codigo] = plan.valor
      return acc
    }, {})
    const adesaoByPlanType = { ...mensalidadeByPlanType }

    const displayMensalidadeByPlanType = Object.entries(mensalidadeByPlanType).reduce<Record<string, string>>(
      (acc, [code, value]) => {
        acc[code] = formatCurrency(value)
        return acc
      },
      {}
    )
    const displayAdesaoByPlanType = Object.entries(adesaoByPlanType).reduce<Record<string, string>>(
      (acc, [code, value]) => {
        acc[code] = formatCurrency(value)
        return acc
      },
      {}
    )

    const defaultPlanValue = mensalidadeByPlanType[defaultPlanType] ?? settings.mensalidadeValue

    return NextResponse.json({
      success: true,
      adesaoValue: defaultPlanValue,
      mensalidadeValue: defaultPlanValue,
      adesaoByPlanType,
      mensalidadeByPlanType,
      planos,
      defaultPlanType,
      mensalidadeBillingTypes: settings.mensalidadeBillingTypes,
      defaultMensalidadeBillingType: settings.defaultMensalidadeBillingType,
      display: {
        adesaoValue: formatCurrency(defaultPlanValue),
        mensalidadeValue: formatCurrency(defaultPlanValue),
        adesaoByPlanType: displayAdesaoByPlanType,
        mensalidadeByPlanType: displayMensalidadeByPlanType,
      },
      allowedBillingTypes: BILLING_TYPE_OPTIONS,
      allowedPlanTypes,
      source: settings.source,
      // Instituto/vendedor info
      tipoRef,
      refNome,
      semAdesao,
    })
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)
    if (/fetch failed|enotfound|getaddrinfo|network/i.test(details)) {
      return NextResponse.json(
        {
          error:
            'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
        },
        { status: 503 }
      )
    }

    console.error('Public billing settings GET error:', error)
    return NextResponse.json({ error: 'Erro ao carregar configurações de cobrança.' }, { status: 500 })
  }
}
