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

    const { data: planoPrecos, error } = await supabase
      .from('instituto_plano_precos')
      .select('id, instituto_id, plano_id, valor_por_pessoa, created_at, updated_at, planos(id, nome, codigo)')
      .eq('instituto_id', institutoId)

    if (error) {
      const details = `${error.message || ''} ${error.details || ''}`
      if (isConnectivityIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
          },
          { status: 503 }
        )
      }

      return NextResponse.json({ error: 'Erro ao buscar preços dos planos.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, planoPrecos: planoPrecos || [] })
  } catch (error) {
    console.error('Admin instituto plano-precos GET error:', error)
    return NextResponse.json({ error: 'Erro ao processar requisição.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const authResult = await requireAdminAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const institutoId = await getValidatedId(context)
    if (!institutoId) {
      return NextResponse.json({ error: 'ID de instituto inválido.' }, { status: 400 })
    }

    const rawBody = (await request.json().catch(() => null)) as
      | Array<{ plano_id: string; valor_por_pessoa: number }>
      | { precos: Array<{ plano_id: string; valor_por_pessoa: number }> }
      | null

    // Accept both bare array and { precos: [...] } shape
    const body = Array.isArray(rawBody)
      ? rawBody
      : Array.isArray((rawBody as any)?.precos)
      ? (rawBody as any).precos
      : null

    if (!body || !Array.isArray(body)) {
      return NextResponse.json({ error: 'Payload inválido. Esperado array de preços.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const upsertData = body.map((item) => ({
      instituto_id: institutoId,
      plano_id: item.plano_id,
      valor_por_pessoa: item.valor_por_pessoa,
    }))

    const { data, error } = await supabase
      .from('instituto_plano_precos')
      .upsert(upsertData, { onConflict: 'instituto_id,plano_id' })
      .select('id, instituto_id, plano_id, valor_por_pessoa, created_at, updated_at')

    if (error) {
      const details = `${error.message || ''} ${error.details || ''}`
      if (isConnectivityIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
          },
          { status: 503 }
        )
      }

      return NextResponse.json({ error: 'Erro ao salvar preços dos planos.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Preços dos planos salvos com sucesso.',
      planoPrecos: data || [],
    })
  } catch (error) {
    console.error('Admin instituto plano-precos PUT error:', error)
    return NextResponse.json({ error: 'Erro ao processar requisição.' }, { status: 500 })
  }
}
