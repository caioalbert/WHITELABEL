import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminAuth } from '@/lib/supabase/admin-auth'
import { NextRequest, NextResponse } from 'next/server'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const authResult = await requireAdminAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const { id } = await context.params
    if (!id?.trim()) {
      return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: cadastro, error: fetchError } = await supabase
      .from('cadastros')
      .select('id, status, nome')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      console.error('Ativar cadastro fetch error:', fetchError)
      return NextResponse.json({ error: 'Erro ao buscar cadastro.' }, { status: 500 })
    }

    if (!cadastro) {
      return NextResponse.json({ error: 'Cadastro não encontrado.' }, { status: 404 })
    }

    if (cadastro.status === 'ATIVO') {
      return NextResponse.json({ error: 'Cadastro já está ativo.' }, { status: 409 })
    }

    const { error: updateError } = await supabase
      .from('cadastros')
      .update({
        status: 'ATIVO',
        adesao_pago_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Ativar cadastro update error:', updateError)
      return NextResponse.json({ error: 'Erro ao ativar cadastro.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Cadastro de ${cadastro.nome} ativado com sucesso.`,
    })
  } catch (error) {
    console.error('Ativar cadastro error:', error)
    return NextResponse.json({ error: 'Erro ao processar requisição.' }, { status: 500 })
  }
}
