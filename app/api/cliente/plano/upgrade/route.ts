import { requireClienteAuth } from '@/lib/supabase/cliente-auth'
import { createClient } from '@/lib/supabase/server'
import { updateAsaasSubscriptionValue } from '@/lib/asaas'
import { MIN_DEPENDENTES_FAMILIAR, VALOR_POR_VIDA_EXCEDENTE } from '@/lib/plan-pricing'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireClienteAuth(request)

    if (auth.tipo !== 'titular') {
      return NextResponse.json(
        { error: 'Apenas o titular pode fazer upgrade de plano.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { target_plan } = body

    if (!target_plan || target_plan !== 'FAMILIAR') {
      return NextResponse.json(
        { error: 'Plano de destino inválido.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verificar plano atual
    const { data: cadastro, error: cadastroError } = await supabase
      .from('cadastros')
      .select('tipo_plano, asaas_subscription_id, mensalidade_valor')
      .eq('id', auth.clienteId)
      .single()

    if (cadastroError || !cadastro) {
      return NextResponse.json(
        { error: 'Cadastro não encontrado.' },
        { status: 404 }
      )
    }

    if (cadastro.tipo_plano === 'FAMILIAR') {
      return NextResponse.json(
        { error: 'Você já está no plano familiar.' },
        { status: 400 }
      )
    }

    // Atualizar plano
    const { error: updateError } = await supabase
      .from('cadastros')
      .update({ tipo_plano: 'FAMILIAR' })
      .eq('id', auth.clienteId)

    if (updateError) {
      console.error('Erro ao atualizar plano:', updateError)
      return NextResponse.json(
        { error: 'Erro ao atualizar plano.' },
        { status: 500 }
      )
    }

    // Buscar dependentes para calcular valor
    const { count: dependentesCount } = await supabase
      .from('dependentes')
      .select('*', { count: 'exact', head: true })
      .eq('cadastro_id', auth.clienteId)

    const totalDependentes = dependentesCount || 0

    // Calcular novo valor
    // Plano familiar: valor base para 3 vidas (titular + 2 dependentes)
    // Se tiver menos que 2 dependentes, paga pelo mínimo (3 vidas)
    // Se tiver mais que 2 dependentes, paga valor adicional por vida excedente
    const baseValue = cadastro.mensalidade_valor || 0
    const vidasMinimas = 1 + MIN_DEPENDENTES_FAMILIAR // 3 vidas
    const totalVidas = 1 + totalDependentes
    const vidasCobradas = Math.max(totalVidas, vidasMinimas)
    const vidasExcedentes = Math.max(0, totalVidas - vidasMinimas)
    const valorExcedente = vidasExcedentes * VALOR_POR_VIDA_EXCEDENTE
    const novoValor = baseValue + valorExcedente

    // Atualizar valor no banco
    await supabase
      .from('cadastros')
      .update({ mensalidade_valor: novoValor })
      .eq('id', auth.clienteId)

    // Atualizar valor da assinatura no Asaas (se existir)
    if (cadastro.asaas_subscription_id) {
      try {
        await updateAsaasSubscriptionValue(cadastro.asaas_subscription_id, novoValor)
      } catch (error) {
        console.error('Erro ao atualizar assinatura no Asaas:', error)
        // Não falha o upgrade se o Asaas falhar, mas loga o erro
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Upgrade realizado com sucesso.',
      new_plan: 'FAMILIAR',
      dependentes_count: totalDependentes,
      vidas_cobradas: vidasCobradas,
      novo_valor: novoValor,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autenticado') {
      return NextResponse.json(
        { error: 'Não autenticado.' },
        { status: 401 }
      )
    }

    console.error('Erro ao fazer upgrade de plano:', error)
    return NextResponse.json(
      { error: 'Erro ao processar upgrade.' },
      { status: 500 }
    )
  }
}
