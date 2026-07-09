import { AsaasIntegrationError, getAsaasPayment, isAsaasPaidStatus } from '@/lib/asaas'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const CONNECTIVITY_ERROR_REGEX =
  /fetch failed|enotfound|getaddrinfo|network|ssl handshake|tls|cloudflare|error code 52\d/i

function isConnectivityIssue(details: string) {
  return CONNECTIVITY_ERROR_REGEX.test(details)
}

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id')?.trim()
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cadastros')
      .select('id, status, asaas_payment_id, asaas_subscription_id, adesao_pago_em')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      const details = `${error.message || ''} ${error.details || ''}`
      if (/status|asaas_payment_id|asaas_subscription_id|adesao_pago_em/i.test(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/001_create_tables.sql e scripts/004_add_cadastro_pagamentos.sql.',
          },
          { status: 500 }
        )
      }

      if (isConnectivityIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
          },
          { status: 503 }
        )
      }

      console.error('Cadastro status error:', error)
      return NextResponse.json({ error: 'Erro ao consultar status do cliente.' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    }

    let asaasPaymentStatus: string | null = null
    let processingPayment = false

    if ((data.status || 'PENDENTE_PAGAMENTO') !== 'ATIVO' && data.asaas_payment_id) {
      try {
        const payment = await getAsaasPayment(String(data.asaas_payment_id))
        asaasPaymentStatus = payment.status || null
        processingPayment = isAsaasPaidStatus(payment.status)
      } catch (error) {
        // Não quebra o fluxo de status caso a consulta no Asaas falhe.
        if (!(error instanceof AsaasIntegrationError)) {
          console.error('Cadastro status Asaas lookup error:', error)
        }
      }
    }

    return NextResponse.json({
      id: data.id,
      status: data.status || 'PENDENTE_PAGAMENTO',
      asaasPaymentId: data.asaas_payment_id || null,
      asaasSubscriptionId: data.asaas_subscription_id || null,
      adesaoPagoEm: data.adesao_pago_em || null,
      asaasPaymentStatus,
      processingPayment,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (isConnectivityIssue(message)) {
      return NextResponse.json(
        {
          error:
            'Falha ao conectar no Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL e as chaves no arquivo .env/.env.local.',
        },
        { status: 503 }
      )
    }

    console.error('Cadastro status API error:', error)
    return NextResponse.json({ error: 'Erro ao processar requisição.' }, { status: 500 })
  }
}
