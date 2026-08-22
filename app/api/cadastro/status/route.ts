import { AsaasIntegrationError, getAsaasPayment, isAsaasPaidStatus } from '@/lib/asaas'
import { getCadastroFlowId } from '@/lib/supabase/cadastro-flow-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const CONNECTIVITY_ERROR_REGEX =
  /fetch failed|enotfound|getaddrinfo|network|ssl handshake|tls|cloudflare|error code 52\d/i

function isConnectivityIssue(details: string) {
  return CONNECTIVITY_ERROR_REGEX.test(details)
}

export async function GET(request: NextRequest) {
  try {
    const authorizedCadastroId = await getCadastroFlowId()
    const requestedId = request.nextUrl.searchParams.get('id')?.trim()
    const id = requestedId || authorizedCadastroId
    if (!authorizedCadastroId || !id || authorizedCadastroId !== id) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('cadastros')
      .select('id, nome, email, status, asaas_payment_id, asaas_subscription_id, adesao_pago_em')
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
    let pagamento = null

    if ((data.status || 'PENDENTE_PAGAMENTO') !== 'ATIVO' && data.asaas_payment_id) {
      try {
        const payment = await getAsaasPayment(String(data.asaas_payment_id))
        asaasPaymentStatus = payment.status || null
        processingPayment = isAsaasPaidStatus(payment.status)
        pagamento = {
          id: payment.id,
          descricao: payment.description || 'Pagamento inicial',
          valor: Number(payment.value || 0),
          vencimento: String(payment.dueDate || ''),
          billingType: payment.billingType,
          invoiceUrl: payment.invoiceUrl || null,
          bankSlipUrl: payment.bankSlipUrl || null,
        }
      } catch (error) {
        // Não quebra o fluxo de status caso a consulta no Asaas falhe.
        if (!(error instanceof AsaasIntegrationError)) {
          console.error('Cadastro status Asaas lookup error:', error)
        }
      }
    }

    return NextResponse.json({
      id: data.id,
      nome: data.nome,
      email: data.email,
      status: data.status || 'PENDENTE_PAGAMENTO',
      asaasPaymentId: data.asaas_payment_id || null,
      asaasSubscriptionId: data.asaas_subscription_id || null,
      adesaoPagoEm: data.adesao_pago_em || null,
      asaasPaymentStatus,
      processingPayment,
      pagamento,
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
