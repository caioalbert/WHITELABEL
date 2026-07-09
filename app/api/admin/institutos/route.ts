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

function generateRandomSuffix(length = 6) {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase()
}

async function generateUniqueInstitutoCode(baseName: string) {
  const supabase = createAdminClient()
  const base = normalizeCodePart(baseName) || 'INSTITUTO'

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `${base}-${generateRandomSuffix(6)}`

    const { data, error } = await supabase
      .from('institutos')
      .select('id')
      .eq('codigo_indicacao', candidate)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return candidate
    }
  }

  throw new Error('Não foi possível gerar um código de indicação único.')
}

function mapDatabaseErrorMessage(error: unknown) {
  const details = (() => {
    if (error instanceof Error) {
      return error.message
    }

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

  if (/relation .*institutos|does not exist|42P01/i.test(details)) {
    return 'Banco desatualizado. Execute scripts/015_add_institutos_module.sql no Supabase SQL Editor.'
  }

  if (/duplicate key|institutos_email|institutos_codigo/i.test(details)) {
    return 'Já existe um instituto com este e-mail ou código.'
  }

  if (/fetch failed|enotfound|getaddrinfo|network/i.test(details)) {
    return 'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.'
  }

  return null
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('institutos')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, institutos: data || [] })
  } catch (error) {
    const mappedMessage = mapDatabaseErrorMessage(error)
    if (mappedMessage) {
      return NextResponse.json({ error: mappedMessage }, { status: 500 })
    }

    console.error('Admin institutos GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar institutos.' }, { status: 500 })
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
          email?: string
          senha?: string
          codigoIndicacao?: string
          comissaoPercentualMensalidade?: number
          comissaoPercentualAdesao?: number
          comissaoMensalidadesMax?: number | null
          semAdesao?: boolean
        }
      | null

    if (!body) {
      return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
    }

    const nome = String(body.nome || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const senha = String(body.senha || '').trim()
    const codigoIndicacaoInput = String(body.codigoIndicacao || '').trim()

    if (!nome || !email || !senha || !codigoIndicacaoInput) {
      return NextResponse.json(
        { error: 'Nome, email, senha e código de indicação são obrigatórios.' },
        { status: 400 }
      )
    }

    if (senha.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter ao menos 6 caracteres.' },
        { status: 400 }
      )
    }

    const comissaoPercentualMensalidade =
      typeof body.comissaoPercentualMensalidade === 'number'
        ? body.comissaoPercentualMensalidade
        : 50

    const comissaoPercentualAdesao =
      typeof body.comissaoPercentualAdesao === 'number'
        ? body.comissaoPercentualAdesao
        : 0

    const comissaoMensalidadesMax =
      typeof body.comissaoMensalidadesMax === 'number' ? body.comissaoMensalidadesMax : null

    const semAdesao = body.semAdesao !== false // default: true (institutos não cobram adesão)

    const institutoId = crypto.randomUUID()
    const codigoIndicacao = normalizeCodePart(codigoIndicacaoInput)

    if (!codigoIndicacao) {
      return NextResponse.json({ error: 'Código de indicação inválido.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: createdUserData, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: {
        is_instituto: true,
        instituto_id: institutoId,
      },
    })

    if (createUserError || !createdUserData.user) {
      const message = createUserError?.message || 'Não foi possível criar usuário de acesso do instituto.'

      if (/already registered|already exists|already been registered|duplicate/i.test(message)) {
        return NextResponse.json(
          { error: 'Já existe usuário autenticado com este email.' },
          { status: 409 }
        )
      }

      if (/fetch failed|enotfound|getaddrinfo|network/i.test(message)) {
        return NextResponse.json(
          {
            error:
              'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
          },
          { status: 503 }
        )
      }

      return NextResponse.json({ error: message }, { status: 500 })
    }

    const createdUser = createdUserData.user

    const { data: instituto, error: insertError } = await supabase
      .from('institutos')
      .insert({
        id: institutoId,
        nome,
        email,
        codigo_indicacao: codigoIndicacao,
        ativo: true,
        auth_user_id: createdUser.id,
        comissao_percentual_mensalidade: comissaoPercentualMensalidade,
        comissao_percentual_adesao: comissaoPercentualAdesao,
        comissao_mensalidades_max: comissaoMensalidadesMax,
        sem_adesao: semAdesao,
      })
      .select('*')
      .single()

    if (insertError) {
      await supabase.auth.admin.deleteUser(createdUser.id).catch(() => null)
      throw insertError
    }

    return NextResponse.json({
      success: true,
      message: 'Instituto criado com sucesso.',
      instituto,
    })
  } catch (error) {
    const mappedMessage = mapDatabaseErrorMessage(error)
    if (mappedMessage) {
      const status = /Já existe um instituto/i.test(mappedMessage) ? 409 : 500
      return NextResponse.json({ error: mappedMessage }, { status })
    }

    const details = error instanceof Error ? error.message : String(error)
    if (/não foi possível gerar um código/i.test(details)) {
      return NextResponse.json({ error: details }, { status: 500 })
    }

    console.error('Admin institutos POST error:', error)
    return NextResponse.json({ error: 'Erro ao criar instituto.' }, { status: 500 })
  }
}
