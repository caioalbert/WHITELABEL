import { requireClienteAuth } from '@/lib/supabase/cliente-auth'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireClienteAuth(request)

    const supabase = await createClient()
    const { data: cadastro } = await supabase
      .from('cadastros')
      .select('tipo_plano')
      .eq('id', auth.clienteId)
      .single()

    if (!cadastro) {
      return NextResponse.json(
        { error: 'Cadastro não encontrado.' },
        { status: 404 }
      )
    }

    // Buscar plano na tabela planos
    const { data: plano } = await supabase
      .from('planos')
      .select('*')
      .eq('codigo', cadastro.tipo_plano)
      .eq('ativo', true)
      .single()

    if (plano) {
      return NextResponse.json({ plano })
    }

    // Fallback: planos legados (INDIVIDUAL, FAMILIAR)
    if (cadastro.tipo_plano === 'INDIVIDUAL' || cadastro.tipo_plano === 'FAMILIAR') {
      const planoLegado = {
        codigo: cadastro.tipo_plano,
        nome: cadastro.tipo_plano === 'INDIVIDUAL' ? 'Plano Individual' : 'Plano Familiar',
        permite_dependentes: cadastro.tipo_plano !== 'INDIVIDUAL',
        min_dependentes: cadastro.tipo_plano === 'INDIVIDUAL' ? 0 : 2,
        max_dependentes: cadastro.tipo_plano === 'INDIVIDUAL' ? 0 : null,
      }
      return NextResponse.json({ plano: planoLegado })
    }

    // Plano não identificado
    return NextResponse.json({ plano: null })
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autenticado') {
      return NextResponse.json(
        { error: 'Não autenticado.' },
        { status: 401 }
      )
    }

    console.error('Erro ao buscar plano:', error)
    return NextResponse.json({ plano: null })
  }
}
