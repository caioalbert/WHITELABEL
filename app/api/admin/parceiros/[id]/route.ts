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

function isParceirosSchemaIssue(details: string) {
  return /relation .*parceiros|does not exist|42P01|column .*parceiro_id|auth_user_id/i.test(details)
}

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await requireAdminAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const parceiroId = await getValidatedId(context)
    if (!parceiroId) {
      return NextResponse.json({ error: 'ID de parceiro inválido.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: parceiro, error: parceiroError } = await supabase
      .from('parceiros')
      .select('*')
      .eq('id', parceiroId)
      .maybeSingle()

    if (parceiroError) {
      const details = `${parceiroError.message || ''} ${parceiroError.details || ''}`
      if (isParceirosSchemaIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/015_add_parceiros_module.sql no Supabase SQL Editor.',
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

      return NextResponse.json({ error: 'Erro ao buscar parceiro.' }, { status: 500 })
    }

    if (!parceiro) {
      return NextResponse.json({ error: 'Parceiro não encontrado.' }, { status: 404 })
    }

    // Also fetch parceiro's own plans
    const { data: parceiroPlanos, error: planosError } = await supabase
      .from('parceiro_planos')
      .select('*')
      .eq('parceiro_id', parceiroId)
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: true })

    if (planosError) {
      const d = `${planosError.message} ${planosError.details || ''}`
      if (!/relation.*parceiro_planos|does not exist|42P01/i.test(d)) {
        console.warn('Admin parceiro GET parceiro_planos error:', planosError)
      }
    }

    return NextResponse.json({
      success: true,
      parceiro,
      planos: parceiroPlanos || [],
    })
  } catch (error) {
    console.error('Admin parceiro GET error:', error)
    return NextResponse.json({ error: 'Erro ao processar requisição.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authResult = await requireAdminAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const parceiroId = await getValidatedId(context)
    if (!parceiroId) {
      return NextResponse.json({ error: 'ID de parceiro inválido.' }, { status: 400 })
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
        return NextResponse.json({ error: 'Nome do parceiro é obrigatório.' }, { status: 400 })
      }
      updateData.nome = nome
    }

    if (Object.prototype.hasOwnProperty.call(body, 'email') && body.email !== undefined) {
      const email = String(body.email || '').trim().toLowerCase()
      if (!email) {
        return NextResponse.json({ error: 'Email do parceiro é obrigatório.' }, { status: 400 })
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

    const { data: parceiro, error: updateError } = await supabase
      .from('parceiros')
      .update(updateData)
      .eq('id', parceiroId)
      .select('*')
      .maybeSingle()

    if (updateError) {
      const details = `${updateError.message || ''} ${updateError.details || ''}`
      if (isParceirosSchemaIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/015_add_parceiros_module.sql no Supabase SQL Editor.',
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

      return NextResponse.json({ error: 'Erro ao atualizar parceiro.' }, { status: 500 })
    }

    if (!parceiro) {
      return NextResponse.json({ error: 'Parceiro não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      parceiro,
      message: 'Parceiro atualizado com sucesso.',
    })
  } catch (error) {
    console.error('Admin parceiro PATCH error:', error)
    return NextResponse.json({ error: 'Erro ao processar requisição.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await requireAdminAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const parceiroId = await getValidatedId(context)
    if (!parceiroId) {
      return NextResponse.json({ error: 'ID de parceiro inválido.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: parceiro, error: parceiroError } = await supabase
      .from('parceiros')
      .select('id, nome, auth_user_id')
      .eq('id', parceiroId)
      .maybeSingle()

    if (parceiroError) {
      const details = `${parceiroError.message || ''} ${parceiroError.details || ''}`
      if (isParceirosSchemaIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/015_add_parceiros_module.sql no Supabase SQL Editor.',
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

      return NextResponse.json({ error: 'Erro ao buscar parceiro para exclusão.' }, { status: 500 })
    }

    if (!parceiro) {
      return NextResponse.json({ error: 'Parceiro não encontrado.' }, { status: 404 })
    }

    if (parceiro.auth_user_id) {
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(parceiro.auth_user_id)
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
            { error: 'Erro ao remover usuário de acesso do parceiro.' },
            { status: 500 }
          )
        }
      }
    }

    const { error: deleteError } = await supabase.from('parceiros').delete().eq('id', parceiroId)
    if (deleteError) {
      const details = `${deleteError.message || ''} ${deleteError.details || ''}`
      if (isParceirosSchemaIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/015_add_parceiros_module.sql no Supabase SQL Editor.',
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

      return NextResponse.json({ error: 'Erro ao excluir parceiro.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Parceiro "${parceiro.nome}" excluído com sucesso.`,
    })
  } catch (error) {
    console.error('Admin parceiro DELETE error:', error)
    return NextResponse.json({ error: 'Erro ao processar requisição.' }, { status: 500 })
  }
}
