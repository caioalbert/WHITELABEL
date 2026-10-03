import { requireActiveClienteAuth } from '@/lib/supabase/cliente-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireActiveClienteAuth(request)

    const supabase = createAdminClient()
    const { data: cadastro, error: cadastroError } = await supabase
      .from('cadastros')
      .select('tipo_plano')
      .eq('id', auth.clienteId)
      .single()

    if (cadastroError) throw new Error('Consulta de cadastro indisponível')
    if (!cadastro) {
      return NextResponse.json(
        { error: 'Cadastro não encontrado.' },
        { status: 404 }
      )
    }

    // Buscar plano na tabela planos
    const { data: plano, error: planoError } = await supabase
      .from('planos')
      .select('*')
      .eq('codigo', cadastro.tipo_plano)
      .eq('ativo', true)
      .single()

    if (plano) {
      return NextResponse.json({ plano })
    }

    if (planoError) throw new Error('Consulta de plano indisponível')
    return NextResponse.json({ error: 'Plano não disponível. Entre em contato com o suporte.' }, { status: 503 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autenticado') {
      return NextResponse.json(
        { error: 'Não autenticado.' },
        { status: 401 }
      )
    }

    console.error('Erro ao buscar plano:', error)
    return NextResponse.json({ error: 'Não foi possível consultar o plano.' }, { status: 503 })
  }
}
