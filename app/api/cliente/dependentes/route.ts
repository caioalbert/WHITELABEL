import { requireClienteAuth } from '@/lib/supabase/cliente-auth'
import { createClient } from '@/lib/supabase/server'
import { updateAsaasSubscriptionValue } from '@/lib/asaas'
import { MIN_DEPENDENTES_FAMILIAR, VALOR_POR_VIDA_EXCEDENTE } from '@/lib/plan-pricing'
import { NextRequest, NextResponse } from 'next/server'

async function recalculateAndUpdateSubscription(cadastroId: string) {
  const supabase = await createClient()

  const { data: cadastro } = await supabase
    .from('cadastros')
    .select('tipo_plano, mensalidade_valor, asaas_subscription_id')
    .eq('id', cadastroId)
    .single()

  if (!cadastro || cadastro.tipo_plano !== 'FAMILIAR') {
    return // Só recalcula para plano familiar
  }

  const { count: dependentesCount } = await supabase
    .from('dependentes')
    .select('*', { count: 'exact', head: true })
    .eq('cadastro_id', cadastroId)

  const totalDependentes = dependentesCount || 0
  const baseValue = cadastro.mensalidade_valor || 0

  // Calcular novo valor
  const vidasMinimas = 1 + MIN_DEPENDENTES_FAMILIAR
  const totalVidas = 1 + totalDependentes
  const vidasExcedentes = Math.max(0, totalVidas - vidasMinimas)
  const valorExcedente = vidasExcedentes * VALOR_POR_VIDA_EXCEDENTE
  const novoValor = baseValue + valorExcedente

  // Atualizar no banco
  await supabase
    .from('cadastros')
    .update({ mensalidade_valor: novoValor })
    .eq('id', cadastroId)

  // Atualizar no Asaas
  if (cadastro.asaas_subscription_id) {
    try {
      await updateAsaasSubscriptionValue(cadastro.asaas_subscription_id, novoValor)
    } catch (error) {
      console.error('Erro ao atualizar assinatura no Asaas:', error)
    }
  }
}


// GET - Listar dependentes
export async function GET(request: NextRequest) {
  try {
    const auth = await requireClienteAuth(request)

    const supabase = await createClient()
    const { data: dependentes, error } = await supabase
      .from('dependentes')
      .select('*')
      .eq('cadastro_id', auth.clienteId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Erro ao buscar dependentes:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar dependentes.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      dependentes: dependentes || [],
      canManage: auth.tipo === 'titular',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autenticado') {
      return NextResponse.json(
        { error: 'Não autenticado.' },
        { status: 401 }
      )
    }

    console.error('Erro ao buscar dependentes:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar dependentes.' },
      { status: 500 }
    )
  }
}

// POST - Adicionar dependente
export async function POST(request: NextRequest) {
  try {
    const auth = await requireClienteAuth(request)

    if (auth.tipo !== 'titular') {
      return NextResponse.json(
        { error: 'Apenas o titular pode adicionar dependentes.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { nome, cpf, data_nascimento, relacao, email, telefone_celular, sexo } = body

    if (!nome || !cpf || !data_nascimento || !relacao) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: nome, cpf, data_nascimento, relacao' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verificar CPF duplicado
    const cpfClean = cpf.replace(/\D/g, '')
    const { data: cpfExists } = await supabase
      .from('cadastros')
      .select('id')
      .eq('cpf', cpfClean)
      .maybeSingle()

    if (cpfExists) {
      return NextResponse.json(
        { error: 'Este CPF já está cadastrado como titular.' },
        { status: 409 }
      )
    }

    const { data: cpfDependenteExists } = await supabase
      .from('dependentes')
      .select('id')
      .eq('cpf', cpfClean)
      .maybeSingle()

    if (cpfDependenteExists) {
      return NextResponse.json(
        { error: 'Este CPF já está cadastrado como dependente.' },
        { status: 409 }
      )
    }

    // Verificar se o plano permite dependentes
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

    // Buscar configuração do plano
    const { data: plano } = await supabase
      .from('planos')
      .select('permite_dependentes, max_dependentes')
      .eq('codigo', cadastro.tipo_plano)
      .eq('ativo', true)
      .single()

    if (!plano || !plano.permite_dependentes) {
      return NextResponse.json(
        { error: 'Seu plano não permite adicionar dependentes. Faça upgrade para um plano familiar.' },
        { status: 403 }
      )
    }

    // Verificar limite de dependentes
    if (plano.max_dependentes !== null) {
      const { count } = await supabase
        .from('dependentes')
        .select('*', { count: 'exact', head: true })
        .eq('cadastro_id', auth.clienteId)

      if (count !== null && count >= plano.max_dependentes) {
        return NextResponse.json(
          { error: `Você atingiu o limite de ${plano.max_dependentes} dependentes do seu plano.` },
          { status: 403 }
        )
      }
    }

    const { data: dependente, error } = await supabase
      .from('dependentes')
      .insert([
        {
          cadastro_id: auth.clienteId,
          nome,
          cpf: cpf.replace(/\D/g, ''),
          data_nascimento,
          relacao,
          email: email || null,
          telefone_celular: telefone_celular || null,
          sexo: sexo || null,
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Erro ao adicionar dependente:', error)
      return NextResponse.json(
        { error: 'Erro ao adicionar dependente.' },
        { status: 500 }
      )
    }

    // Recalcular e atualizar valor da assinatura
    await recalculateAndUpdateSubscription(auth.clienteId)

    return NextResponse.json({ dependente })
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autenticado') {
      return NextResponse.json(
        { error: 'Não autenticado.' },
        { status: 401 }
      )
    }

    console.error('Erro ao adicionar dependente:', error)
    return NextResponse.json(
      { error: 'Erro ao adicionar dependente.' },
      { status: 500 }
    )
  }
}

// PUT - Atualizar dependente
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireClienteAuth(request)

    if (auth.tipo !== 'titular') {
      return NextResponse.json(
        { error: 'Apenas o titular pode alterar dependentes.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, nome, cpf, data_nascimento, relacao, email, telefone_celular, sexo } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID do dependente é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verificar se o dependente pertence ao cliente
    const { data: existing } = await supabase
      .from('dependentes')
      .select('id, cpf')
      .eq('id', id)
      .eq('cadastro_id', auth.clienteId)
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: 'Dependente não encontrado.' },
        { status: 404 }
      )
    }

    // Verificar CPF duplicado apenas se o CPF foi alterado
    if (cpf) {
      const cpfClean = cpf.replace(/\D/g, '')
      const cpfExistente = existing.cpf?.replace(/\D/g, '')

      if (cpfClean !== cpfExistente) {
        const { data: cpfCadastro } = await supabase
          .from('cadastros')
          .select('id')
          .eq('cpf', cpfClean)
          .maybeSingle()

        if (cpfCadastro) {
          return NextResponse.json(
            { error: 'Este CPF já está cadastrado como titular.' },
            { status: 409 }
          )
        }

        const { data: cpfDependente } = await supabase
          .from('dependentes')
          .select('id')
          .eq('cpf', cpfClean)
          .neq('id', id)
          .maybeSingle()

        if (cpfDependente) {
          return NextResponse.json(
            { error: 'Este CPF já está cadastrado como dependente.' },
            { status: 409 }
          )
        }
      }
    }

    const { data: dependente, error } = await supabase
      .from('dependentes')
      .update({
        nome,
        cpf: cpf?.replace(/\D/g, ''),
        data_nascimento,
        relacao,
        email: email || null,
        telefone_celular: telefone_celular || null,
        sexo: sexo || null,
      })
      .eq('id', id)
      .eq('cadastro_id', auth.clienteId)
      .select()
      .single()

    if (error) {
      console.error('Erro ao atualizar dependente:', error)
      return NextResponse.json(
        { error: 'Erro ao atualizar dependente.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ dependente })
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autenticado') {
      return NextResponse.json(
        { error: 'Não autenticado.' },
        { status: 401 }
      )
    }

    console.error('Erro ao atualizar dependente:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar dependente.' },
      { status: 500 }
    )
  }
}

// DELETE - Remover dependente
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireClienteAuth(request)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (auth.tipo !== 'titular') {
      return NextResponse.json(
        { error: 'Apenas o titular pode remover dependentes.' },
        { status: 403 }
      )
    }

    if (!id) {
      return NextResponse.json(
        { error: 'ID do dependente é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('dependentes')
      .delete()
      .eq('id', id)
      .eq('cadastro_id', auth.clienteId)

    if (error) {
      console.error('Erro ao remover dependente:', error)
      return NextResponse.json(
        { error: 'Erro ao remover dependente.' },
        { status: 500 }
      )
    }

    // Recalcular e atualizar valor da assinatura
    await recalculateAndUpdateSubscription(auth.clienteId)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autenticado') {
      return NextResponse.json(
        { error: 'Não autenticado.' },
        { status: 401 }
      )
    }

    console.error('Erro ao remover dependente:', error)
    return NextResponse.json(
      { error: 'Erro ao remover dependente.' },
      { status: 500 }
    )
  }
}
