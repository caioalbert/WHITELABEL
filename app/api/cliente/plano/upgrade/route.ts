import { requireActiveClienteAuth } from '@/lib/supabase/cliente-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateAsaasSubscriptionValue } from '@/lib/asaas'
import { calculatePlanChargeBreakdown } from '@/lib/plan-pricing'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireActiveClienteAuth(request)
    if (auth.tipo !== 'titular') return NextResponse.json({ error: 'Apenas o titular pode fazer upgrade de plano.' }, { status: 403 })
    const body = await request.json().catch(() => null)
    if (body?.target_plan !== 'FAMILIAR') return NextResponse.json({ error: 'Plano de destino inválido.' }, { status: 400 })
    const db = createAdminClient()
    const { data: cadastro, error: cadastroError } = await db.from('cadastros')
      .select('empresa_id,tipo_plano,asaas_subscription_id,mensalidade_valor').eq('id', auth.clienteId).single()
    if (cadastroError) throw new Error('Não foi possível consultar o cadastro.')
    if (!cadastro) return NextResponse.json({ error: 'Cadastro não encontrado.' }, { status: 404 })
    if (cadastro.empresa_id) return NextResponse.json({ error: 'O plano empresarial só pode ser alterado pela empresa.' }, { status: 403 })
    if (cadastro.tipo_plano === 'FAMILIAR') return NextResponse.json({ error: 'Você já está no plano familiar.' }, { status: 409 })
    const { data: plan, error: planError } = await db.from('planos')
      .select('valor,permite_dependentes,min_dependentes,valor_dependente_adicional,max_dependentes')
      .eq('codigo', 'FAMILIAR').eq('ativo', true).maybeSingle()
    const { count, error: countError } = await db.from('dependentes')
      .select('id', { count: 'exact', head: true }).eq('cadastro_id', auth.clienteId)
    if (planError || !plan || countError || count === null || count === undefined) throw new Error('Configuração de plano indisponível.')
    const price = Number(plan.valor), extra = Number(plan.valor_dependente_adicional), minimum = Number(plan.min_dependentes)
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(extra) || extra < 0 || !Number.isInteger(minimum) || minimum < 0 || !plan.permite_dependentes)
      throw new Error('Configuração de plano inválida.')
    if (plan.max_dependentes !== null && plan.max_dependentes !== undefined && count > plan.max_dependentes)
      return NextResponse.json({ error: 'Quantidade de dependentes incompatível com o plano.' }, { status: 409 })
    const charge = calculatePlanChargeBreakdown({ valor: price, permiteDependentes: true, minDependentes: minimum, valorDependenteAdicional: extra }, count)
    // Do not grant the new plan when the billing provider rejects the change.
    if (cadastro.asaas_subscription_id) await updateAsaasSubscriptionValue(cadastro.asaas_subscription_id, charge.total)
    let query = db.from('cadastros').update({ tipo_plano: 'FAMILIAR', mensalidade_valor: charge.total })
      .eq('id', auth.clienteId).eq('tipo_plano', cadastro.tipo_plano)
    query = cadastro.asaas_subscription_id ? query.eq('asaas_subscription_id', cadastro.asaas_subscription_id) : query.is('asaas_subscription_id', null)
    const { data: updated, error: updateError } = await query.select('id').maybeSingle()
    if (updateError || !updated) {
      const { data: current, error: currentError } = await db.from('cadastros')
        .select('tipo_plano,mensalidade_valor,asaas_subscription_id').eq('id', auth.clienteId).maybeSingle()
      // An identical concurrent request may have committed the same result.
      const applied = !currentError && current && current.tipo_plano === 'FAMILIAR' && Number(current.mensalidade_valor) === charge.total && current.asaas_subscription_id === cadastro.asaas_subscription_id
      if (!applied) {
        // Compensate only after verifying the original state; never undo another plan change.
        if (!currentError && current && current.tipo_plano === cadastro.tipo_plano && current.asaas_subscription_id === cadastro.asaas_subscription_id && Number(current.mensalidade_valor) === Number(cadastro.mensalidade_valor) && cadastro.asaas_subscription_id && Number(cadastro.mensalidade_valor) > 0) {
          await updateAsaasSubscriptionValue(cadastro.asaas_subscription_id, Number(cadastro.mensalidade_valor))
        }
        throw new Error('Não foi possível confirmar o plano no banco. Verificar conciliação de cobrança.')
      }
    }
    return NextResponse.json({ success: true, message: 'Upgrade realizado com sucesso.', new_plan: 'FAMILIAR', dependentes_count: count, vidas_cobradas: Math.max(charge.minimumLives, charge.selectedLives), novo_valor: charge.total })
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    console.error('Erro ao fazer upgrade de plano:', error)
    return NextResponse.json({ error: 'Não foi possível concluir a alteração do plano. Tente novamente mais tarde.' }, { status: 503 })
  }
}
