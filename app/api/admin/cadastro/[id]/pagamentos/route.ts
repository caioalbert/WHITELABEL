import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminAuth } from '@/lib/supabase/admin-auth'
import { getAsaasPayment, getAsaasSubscription, listAsaasSubscriptionPayments } from '@/lib/asaas'
import { NextRequest, NextResponse } from 'next/server'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminAuth(request)
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: cadastro, error } = await supabase
      .from('cadastros')
      .select('asaas_payment_id, asaas_subscription_id, adesao_pago_em, mensalidade_valor, tipo_plano')
      .eq('id', id)
      .single()

    if (error || !cadastro) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    const [adesao, mensalidades, assinatura] = await Promise.all([
      cadastro.asaas_payment_id
        ? getAsaasPayment(cadastro.asaas_payment_id).catch(() => null)
        : Promise.resolve(null),
      cadastro.asaas_subscription_id
        ? listAsaasSubscriptionPayments(cadastro.asaas_subscription_id).catch(() => [])
        : Promise.resolve([]),
      cadastro.asaas_subscription_id
        ? getAsaasSubscription(cadastro.asaas_subscription_id).catch(() => null)
        : Promise.resolve(null),
    ])

    return NextResponse.json({
      adesao,
      mensalidades,
      assinatura,
      adesao_pago_em: cadastro.adesao_pago_em,
      mensalidade_valor: cadastro.mensalidade_valor,
      tipo_plano: cadastro.tipo_plano,
      asaas_subscription_id: cadastro.asaas_subscription_id,
    })
  } catch (error) {
    console.error('Erro ao buscar pagamentos do cliente:', error)
    return NextResponse.json({ error: 'Erro ao buscar pagamentos' }, { status: 500 })
  }
}
