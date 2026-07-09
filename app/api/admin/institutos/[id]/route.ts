import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminAuth } from '@/lib/supabase/admin-auth'
import { NextRequest, NextResponse } from 'next/server'

type RouteContext = { params: Promise<{ id: string }> }

async function getValidatedId(context: RouteContext) {
  const { id } = await context.params
  return id?.trim() || null
}

function isConnectivityIssue(details: string) {
  return /fetch failed|enotfound|getaddrinfo|network/i.test(details)
}

function isInstitutosSchemaIssue(details: string) {
  return /relation .*institutos|does not exist|42P01|column .*instituto_id|auth_user_id/i.test(details)
}

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await requireAdminAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const institutoId = await getValidatedId(context)
    if (!institutoId) {
      return NextResponse.json({ error: 'ID de instituto inválido.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: instituto, error: institutoError } = await supabase
      .from('institutos')
      .select('*')
      .eq('id', institutoId)
      .maybeSingle()

    if (institutoError) {
      const details = `${institutoError.message || ''} ${institutoError.details || ''}`
      if (isInstitutosSchemaIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/015_add_institutos_module.sql no Supabase SQL Editor.',
          },
          { status: 500 }
        )
      }

      if (isConnectivityIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
          },
          { status: 503 }
        )
      }

      return NextResponse.json({ error: 'Erro ao buscar instituto.' }, { status: 500 })
    }

    if (!instituto) {
      return NextResponse.json({ error: 'Instituto não encontrado.' }, { status: 404 })
    }

    // Also fetch instituto's own plans
    const { data: institutoPlanos, error: planosError } = await supabase
      .from('instituto_planos')
      .select('*')
      .eq('instituto_id', institutoId)
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: true })

    if (planosError) {
      const d = `${planosError.message} ${planosError.details || ''}`
      if (!/relation.*instituto_planos|does not exist|42P01/i.test(d)) {
        console.warn('Admin instituto GET instituto_planos error:', planosError)
      }
    }

    return NextResponse.json({
      success: true,
      instituto,
      planos: institutoPlanos || [],
    })
  } catch (error) {
    console.error('Admin instituto GET error:', error)
    return NextResponse.json({ error: 'Erro ao processar requisição.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authResult = await requireAdminAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const institutoId = await getValidatedId(context)
    if (!institutoId) {
      return NextResponse.json({ error: 'ID de instituto inválido.' }, { status: 400 })
    }

    const body = (await request.json().catch(() => null)) as
      | {
          ativo?: unknown
          nome?: unknown
          email?: unknown
          comissaoPercentualMensalidade?: unknown
          comissaoPercentualAdesao?: unknown
          comissaoMensalidadesMax?: unknown
          semAdesao?: unknown
        }
      | null

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const updateData: Record<string, unknown> = {}

    if (typeof body.ativo === 'boolean') {
      updateData.ativo = body.ativo
    }

    if (Object.prototype.hasOwnProperty.call(body, 'nome') && body.nome !== undefined) {
      const nome = String(body.nome || '').trim()
      if (!nome) {
        return NextResponse.json({ error: 'Nome do instituto é obrigatório.' }, { status: 400 })
      }
      updateData.nome = nome
    }

    if (Object.prototype.hasOwnProperty.call(body, 'email') && body.email !== undefined) {
      const email = String(body.email || '').trim().toLowerCase()
      if (!email) {
        return NextResponse.json({ error: 'Email do instituto é obrigatório.' }, { status: 400 })
      }
      updateData.email = email
    }

    if (
      Object.prototype.hasOwnProperty.call(body, 'comissaoPercentualMensalidade') &&
      body.comissaoPercentualMensalidade !== undefined
    ) {
      updateData.comissao_percentual_mensalidade = Number(body.comissaoPercentualMensalidade)
    }

    if (
      Object.prototype.hasOwnProperty.call(body, 'comissaoPercentualAdesao') &&
      body.comissaoPercentualAdesao !== undefined
    ) {
      updateData.comissao_percentual_adesao = Number(body.comissaoPercentualAdesao)
    }

    if (Object.prototype.hasOwnProperty.call(body, 'comissaoMensalidadesMax')) {
      updateData.comissao_mensalidades_max =
        body.comissaoMensalidadesMax === null || body.comissaoMensalidadesMax === ''
          ? null
          : Number(body.comissaoMensalidadesMax)
    }

    if (Object.prototype.hasOwnProperty.call(body, 'semAdesao') && body.semAdesao !== undefined) {
      updateData.sem_adesao = Boolean(body.semAdesao)
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nenhum dado de atualização foi enviado.' }, { status: 400 })
    }

    const { data: instituto, error: updateError } = await supabase
      .from('institutos')
      .update(updateData)
      .eq('id', institutoId)
      .select('*')
      .maybeSingle()

    if (updateError) {
      const details = `${updateError.message || ''} ${updateError.details || ''}`
      if (isInstitutosSchemaIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/015_add_institutos_module.sql no Supabase SQL Editor.',
          },
          { status: 500 }
        )
      }

      if (isConnectivityIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
          },
          { status: 503 }
        )
      }

      return NextResponse.json({ error: 'Erro ao atualizar instituto.' }, { status: 500 })
    }

    if (!instituto) {
      return NextResponse.json({ error: 'Instituto não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      instituto,
      message: 'Instituto atualizado com sucesso.',
    })
  } catch (error) {
    console.error('Admin instituto PATCH error:', error)
    return NextResponse.json({ error: 'Erro ao processar requisição.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await requireAdminAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const institutoId = await getValidatedId(context)
    if (!institutoId) {
      return NextResponse.json({ error: 'ID de instituto inválido.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: instituto, error: institutoError } = await supabase
      .from('institutos')
      .select('id, nome, auth_user_id')
      .eq('id', institutoId)
      .maybeSingle()

    if (institutoError) {
      const details = `${institutoError.message || ''} ${institutoError.details || ''}`
      if (isInstitutosSchemaIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/015_add_institutos_module.sql no Supabase SQL Editor.',
          },
          { status: 500 }
        )
      }

      if (isConnectivityIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
          },
          { status: 503 }
        )
      }

      return NextResponse.json({ error: 'Erro ao buscar instituto para exclusão.' }, { status: 500 })
    }

    if (!instituto) {
      return NextResponse.json({ error: 'Instituto não encontrado.' }, { status: 404 })
    }

    if (instituto.auth_user_id) {
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(instituto.auth_user_id)
      if (authDeleteError) {
        const details = `${authDeleteError.message || ''} ${authDeleteError.status || ''}`

        if (!/user.*not found|not found/i.test(details)) {
          if (isConnectivityIssue(details)) {
            return NextResponse.json(
              {
                error:
                  'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
              },
              { status: 503 }
            )
          }

          return NextResponse.json(
            { error: 'Erro ao remover usuário de acesso do instituto.' },
            { status: 500 }
          )
        }
      }
    }

    const { error: deleteError } = await supabase.from('institutos').delete().eq('id', institutoId)
    if (deleteError) {
      const details = `${deleteError.message || ''} ${deleteError.details || ''}`
      if (isInstitutosSchemaIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/015_add_institutos_module.sql no Supabase SQL Editor.',
          },
          { status: 500 }
        )
      }

      if (isConnectivityIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
          },
          { status: 503 }
        )
      }

      return NextResponse.json({ error: 'Erro ao excluir instituto.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Instituto "${instituto.nome}" excluído com sucesso.`,
    })
  } catch (error) {
    console.error('Admin instituto DELETE error:', error)
    return NextResponse.json({ error: 'Erro ao processar requisição.' }, { status: 500 })
  }
}
