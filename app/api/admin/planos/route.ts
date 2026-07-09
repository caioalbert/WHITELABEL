import { MIN_ASAAS_CHARGE_VALUE } from '@/lib/billing-settings'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminAuth } from '@/lib/supabase/admin-auth'
import { NextRequest, NextResponse } from 'next/server'

function normalizeCodePart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()
}

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

  if (/duplicate key|planos_codigo_idx/i.test(details)) {
    return 'Já existe um plano com este código.'
  }

  if (/fetch failed|enotfound|getaddrinfo|network/i.test(details)) {
    return 'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.'
  }

  return null
}

async function generateUniquePlanCode(
  supabase: ReturnType<typeof createAdminClient>,
  baseName: string
) {
  const base = normalizeCodePart(baseName) || 'PLANO'

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`

    const { data, error } = await supabase
      .from('planos')
      .select('id')
      .eq('codigo', candidate)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return candidate
    }
  }

  throw new Error('Não foi possível gerar um código único para o plano.')
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

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('planos')
      .select(
        'id, codigo, nome, descricao_publica, beneficios_publicos, valor, ativo, ordem, permite_dependentes, dependentes_minimos, max_dependentes, valor_dependente_adicional, created_at, updated_at'
      )
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, planos: data || [] })
  } catch (error) {
    const mappedMessage = mapDatabaseErrorMessage(error)
    if (mappedMessage) {
      return NextResponse.json({ error: mappedMessage }, { status: 500 })
    }

    console.error('Admin planos GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar planos.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const body = (await request.json().catch(() => null)) as
      | {
          nome?: string
          descricao_publica?: string | null
          beneficios_publicos?: string | null
          valor?: number | string
          permite_dependentes?: boolean
          dependentes_minimos?: number | string
          max_dependentes?: number | string | null
          valor_dependente_adicional?: number | string
        }
      | null

    if (!body) {
      return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
    }

    const nome = String(body.nome || '').trim()
    const descricaoPublica = String(body.descricao_publica || '').trim()
    const beneficiosPublicos = String(body.beneficios_publicos || '').trim()
    const valor = Number(body.valor)
    const permiteDependentes = body.permite_dependentes === true

    if (!nome) {
      return NextResponse.json({ error: 'Nome do plano é obrigatório.' }, { status: 400 })
    }

    if (!Number.isFinite(valor) || valor < MIN_ASAAS_CHARGE_VALUE) {
      return NextResponse.json(
        {
          error: `Valor inválido. O mínimo permitido pelo Asaas é R$ ${MIN_ASAAS_CHARGE_VALUE.toFixed(2).replace('.', ',')}.`,
        },
        { status: 400 }
      )
    }

    let dependentesMinimos = 0
    let maxDependentes: number | null = null
    let valorDependenteAdicional = 0

    try {
      const minFromBody = body.dependentes_minimos
      dependentesMinimos =
        minFromBody === undefined
          ? 0
          : parseIntegerField(minFromBody, 'quantidade mínima de dependentes')

      maxDependentes = parseOptionalIntegerField(
        body.max_dependentes,
        'limite máximo de dependentes'
      )

      if (maxDependentes !== null && maxDependentes > 0 && maxDependentes < dependentesMinimos) {
        return NextResponse.json(
          {
            error:
              'O limite máximo de dependentes deve ser maior ou igual à quantidade mínima.',
          },
          { status: 400 }
        )
      }

      const extraFromBody = body.valor_dependente_adicional
      valorDependenteAdicional =
        extraFromBody === undefined
          ? 0
          : parseAmountField(extraFromBody, 'valor adicional por dependente')

      if (permiteDependentes && dependentesMinimos < 1) {
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

    const supabase = createAdminClient()

    const [{ data: highestOrder, error: highestOrderError }, code] = await Promise.all([
      supabase.from('planos').select('ordem').order('ordem', { ascending: false }).limit(1).maybeSingle(),
      generateUniquePlanCode(supabase, nome),
    ])

    if (highestOrderError) {
      throw highestOrderError
    }

    const nextOrder = Number(highestOrder?.ordem || 0) + 1

    const { data, error } = await supabase
      .from('planos')
      .insert({
        nome,
        codigo: code,
        descricao_publica: descricaoPublica || null,
        beneficios_publicos: beneficiosPublicos || null,
        valor,
        ativo: true,
        ordem: nextOrder,
        permite_dependentes: permiteDependentes,
        dependentes_minimos: dependentesMinimos,
        max_dependentes: maxDependentes,
        valor_dependente_adicional: valorDependenteAdicional,
      })
      .select(
        'id, codigo, nome, descricao_publica, beneficios_publicos, valor, ativo, ordem, permite_dependentes, dependentes_minimos, max_dependentes, valor_dependente_adicional, created_at, updated_at'
      )
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, message: 'Plano criado com sucesso.', plano: data })
  } catch (error) {
    const mappedMessage = mapDatabaseErrorMessage(error)
    if (mappedMessage) {
      const status = /código/i.test(mappedMessage) ? 409 : 500
      return NextResponse.json({ error: mappedMessage }, { status })
    }

    const details = error instanceof Error ? error.message : String(error)
    if (/não foi possível gerar um código/i.test(details)) {
      return NextResponse.json({ error: details }, { status: 500 })
    }

    console.error('Admin planos POST error:', error)
    return NextResponse.json({ error: 'Erro ao criar plano.' }, { status: 500 })
  }
}
