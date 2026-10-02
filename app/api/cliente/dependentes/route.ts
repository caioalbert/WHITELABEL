import { requireActiveClienteAuth } from '@/lib/supabase/cliente-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  cancelAsaasSubscription,
  createAsaasSubscription,
  getAsaasSubscription,
  updateAsaasSubscriptionStatus,
  updateAsaasSubscriptionValue,
} from '@/lib/asaas'
import { rotateDependentSubscription } from '@/lib/dependent-subscription'
import { calculatePlanChargeBreakdown } from '@/lib/plan-pricing'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessClienteDependentes } from '@/lib/cliente-access'

async function isEmpresaBeneficiary(
  supabase: ReturnType<typeof createAdminClient>,
  cadastroId: string
) {
  const { data, error } = await supabase
    .from('cadastros')
    .select('empresa_id')
    .eq('id', cadastroId)
    .maybeSingle()
  if (error) throw error
  return Boolean(data?.empresa_id)
}

async function recalculateAndUpdateSubscription(cadastroId: string) {
  const supabase = createAdminClient()

  const { data: cadastro, error: cadastroError } = await supabase
    .from('cadastros')
    .select('tipo_plano, mensalidade_valor, mensalidade_billing_type, asaas_customer_id, asaas_subscription_id, contrato_meses')
    .eq('id', cadastroId)
    .single()

  if (cadastroError || !cadastro) {
    throw cadastroError || new Error('Cadastro não encontrado para recalcular a assinatura.')
  }

  const { data: plano, error: planoError } = await supabase
    .from('planos')
    .select('valor, permite_dependentes, dependentes_minimos, valor_dependente_adicional')
    .eq('codigo', cadastro.tipo_plano)
    .eq('ativo', true)
    .single()

  if (planoError || !plano) {
    throw planoError || new Error('Plano ativo não encontrado para recalcular a assinatura.')
  }

  const { count: dependentesCount, error: countError } = await supabase
    .from('dependentes')
    .select('*', { count: 'exact', head: true })
    .eq('cadastro_id', cadastroId)

  if (countError) throw countError

  const charge = calculatePlanChargeBreakdown({
    valor: Number(plano.valor),
    permiteDependentes: Boolean(plano.permite_dependentes),
    minDependentes: Number(plano.dependentes_minimos || 0),
    valorDependenteAdicional: Number(plano.valor_dependente_adicional || 0),
  }, dependentesCount || 0)
  const currentValue = Number(cadastro.mensalidade_valor || 0)

  if (Math.abs(currentValue - charge.total) < 0.005) return

  const oldSubscriptionId = String(cadastro.asaas_subscription_id || '').trim()
  if (!oldSubscriptionId) {
    const { error } = await supabase
      .from('cadastros')
      .update({ mensalidade_valor: charge.total })
      .eq('id', cadastroId)
    if (error) throw error
    return
  }

  const customerId = String(cadastro.asaas_customer_id || '').trim()
  if (!customerId) {
    throw new Error('Cliente com assinatura ativa, mas sem identificador de cliente no Asaas.')
  }

  const oldSubscription = await getAsaasSubscription(oldSubscriptionId)
  if (!oldSubscription.id) {
    throw new Error('Assinatura atual não encontrada no Asaas.')
  }

  // Contratos com prazo definido mantêm a assinatura, os vencimentos e a quantidade
  // restante. Reiniciar uma assinatura de 12 meses cobraria parcelas adicionais.
  if (cadastro.contrato_meses != null) {
    await updateAsaasSubscriptionValue(oldSubscriptionId, charge.total)
    try {
      const { data, error } = await supabase.from('cadastros')
        .update({ mensalidade_valor: charge.total })
        .eq('id', cadastroId).eq('asaas_subscription_id', oldSubscriptionId)
        .select('id').maybeSingle()
      if (error || !data) throw error || new Error('A assinatura foi alterada por outro processo.')
    } catch (error) {
      await updateAsaasSubscriptionValue(oldSubscriptionId, Number(oldSubscription.value ?? currentValue))
      throw error
    }
    return
  }

  await rotateDependentSubscription({
    cadastroId,
    customerId,
    oldSubscription: {
      ...oldSubscription,
      billingType: oldSubscription.billingType || cadastro.mensalidade_billing_type || 'BOLETO',
    },
    newValue: charge.total,
  }, {
    createSubscription: createAsaasSubscription,
    suspendSubscription: (subscriptionId) =>
      updateAsaasSubscriptionStatus(subscriptionId, 'INACTIVE'),
    reactivateSubscription: (subscriptionId, nextDueDate) =>
      updateAsaasSubscriptionStatus(subscriptionId, 'ACTIVE', nextDueDate),
    cancelSubscription: cancelAsaasSubscription,
    persistSubscription: async (expectedOldId, newSubscriptionId, newValue) => {
      const { data, error } = await supabase
        .from('cadastros')
        .update({
          asaas_subscription_id: newSubscriptionId,
          mensalidade_valor: newValue,
        })
        .eq('id', cadastroId)
        .eq('asaas_subscription_id', expectedOldId)
        .select('id')
        .maybeSingle()

      if (error) throw error
      if (!data) {
        throw new Error('A assinatura foi alterada por outro processo. Tente novamente.')
      }
    },
  })
}

// GET - Listar dependentes
export async function GET(request: NextRequest) {
  try {
    const auth = await requireActiveClienteAuth(request)

    if (!canAccessClienteDependentes(auth.tipo)) {
      return NextResponse.json(
        { error: 'Acesso exclusivo do titular.' },
        { status: 403 }
      )
    }

    const supabase = createAdminClient()
    const empresaBeneficiary = await isEmpresaBeneficiary(supabase, auth.clienteId)
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
      canManage: auth.tipo === 'titular' && !empresaBeneficiary,
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
    const auth = await requireActiveClienteAuth(request)

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

    const supabase = createAdminClient()
    if (await isEmpresaBeneficiary(supabase, auth.clienteId)) {
      return NextResponse.json(
        { error: 'Colaboradores de empresa não podem alterar a composição do plano empresarial.' },
        { status: 403 }
      )
    }

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

    try {
      await recalculateAndUpdateSubscription(auth.clienteId)
    } catch (subscriptionError) {
      const { error: rollbackError } = await supabase
        .from('dependentes')
        .delete()
        .eq('id', dependente.id)
        .eq('cadastro_id', auth.clienteId)

      if (rollbackError) {
        console.error('Falha ao reverter inclusão de dependente após erro de assinatura:', rollbackError)
      }
      throw subscriptionError
    }

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
    const auth = await requireActiveClienteAuth(request)

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

    const supabase = createAdminClient()
    if (await isEmpresaBeneficiary(supabase, auth.clienteId)) {
      return NextResponse.json(
        { error: 'Colaboradores de empresa não podem alterar a composição do plano empresarial.' },
        { status: 403 }
      )
    }

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
    const auth = await requireActiveClienteAuth(request)
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

    const supabase = createAdminClient()
    if (await isEmpresaBeneficiary(supabase, auth.clienteId)) {
      return NextResponse.json(
        { error: 'Colaboradores de empresa não podem alterar a composição do plano empresarial.' },
        { status: 403 }
      )
    }
    const { data: dependenteRemovido, error } = await supabase
      .from('dependentes')
      .delete()
      .eq('id', id)
      .eq('cadastro_id', auth.clienteId)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Erro ao remover dependente:', error)
      return NextResponse.json(
        { error: 'Erro ao remover dependente.' },
        { status: 500 }
      )
    }

    if (!dependenteRemovido) {
      return NextResponse.json(
        { error: 'Dependente não encontrado.' },
        { status: 404 }
      )
    }

    try {
      await recalculateAndUpdateSubscription(auth.clienteId)
    } catch (subscriptionError) {
      const { error: rollbackError } = await supabase
        .from('dependentes')
        .insert(dependenteRemovido)

      if (rollbackError) {
        console.error('Falha ao restaurar dependente após erro de assinatura:', rollbackError)
      }
      throw subscriptionError
    }

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
