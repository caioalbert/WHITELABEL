import { requireClienteAuth } from '@/lib/supabase/cliente-auth'
import { createClient } from '@/lib/supabase/server'
import { getAsaasPayment, listAsaasSubscriptionPayments } from '@/lib/asaas'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireClienteAuth(request)

    const supabase = await createClient()
    const { data: cadastro, error } = await supabase
      .from('cadastros')
      .select('asaas_subscription_id, asaas_payment_id, adesao_pago_em, mensalidade_valor')
      .eq('id', auth.clienteId)
      .single()

    if (error || !cadastro) {
      return NextResponse.json({ error: 'Cadastro não encontrado.' }, { status: 404 })
    }

    // Buscar adesão e mensalidades em paralelo
    const [adesao, payments] = await Promise.all([
      cadastro.asaas_payment_id
        ? getAsaasPayment(cadastro.asaas_payment_id).catch(() => null)
        : Promise.resolve(null),
      cadastro.asaas_subscription_id
        ? listAsaasSubscriptionPayments(cadastro.asaas_subscription_id).catch(() => [])
        : Promise.resolve([]),
    ])

    const message =
      !cadastro.asaas_subscription_id
        ? 'Assinatura mensal ainda não criada. Aguarde a confirmação do pagamento de adesão.'
        : undefined

    return NextResponse.json({
      adesao,
      payments,
      subscriptionId: cadastro.asaas_subscription_id,
      adesao_pago_em: cadastro.adesao_pago_em,
      mensalidade_valor: cadastro.mensalidade_valor,
      ...(message ? { message } : {}),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }
    console.error('Erro ao buscar pagamentos:', error)
    return NextResponse.json({ error: 'Erro ao buscar pagamentos.' }, { status: 500 })
  }
}
