import {
  AsaasIntegrationError,
  cancelAsaasPayment,
  createAsaasCustomer,
  createAsaasPayment,
  deleteAsaasCustomer,
} from '@/lib/asaas'
import { EMPRESA_STATUSES, empresaNextStep, getEmpresaExternalReference } from '@/lib/empresa-flow'
import { MIN_ASAAS_CHARGE_VALUE } from '@/lib/billing-settings'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireEmpresaFlowAuth } from '@/lib/supabase/empresa-auth'
import { NextRequest, NextResponse } from 'next/server'

type BillingType = 'BOLETO' | 'CREDIT_CARD'

function normalizeBillingType(value: unknown): BillingType | null {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'BOLETO' || normalized === 'CREDIT_CARD') return normalized
  return null
}

function dueDate() {
  return new Date().toISOString().slice(0, 10)
}

async function rollbackAsaas(customerId: string | null, paymentId: string | null) {
  if (paymentId) await cancelAsaasPayment(paymentId).catch(() => undefined)
  if (customerId) await deleteAsaasCustomer(customerId).catch(() => undefined)
}

export async function POST(request: NextRequest) {
  let claimedEmpresaId: string | null = null
  let customerId: string | null = null
  let paymentId: string | null = null

  try {
    const auth = await requireEmpresaFlowAuth()
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const billingType = normalizeBillingType(body?.billingType)
    if (!billingType) {
      return NextResponse.json({ error: 'Forma de pagamento inválida.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: empresa, error: claimError } = await supabase
      .from('empresas')
      .update({
        status: EMPRESA_STATUSES.pagamento,
        mensalidade_billing_type: billingType,
      })
      .eq('id', auth.empresaId)
      .eq('status', EMPRESA_STATUSES.lista)
      .select('id, razao_social, cnpj, email, telefone, endereco, numero, complemento, bairro, cep, mensalidade_valor')
      .maybeSingle()

    if (claimError) throw claimError
    if (!empresa) {
      return NextResponse.json(
        { error: 'O pagamento só pode ser gerado após o envio da lista de colaboradores.' },
        { status: 409 }
      )
    }
    claimedEmpresaId = empresa.id

    const value = Number(empresa.mensalidade_valor)
    if (!Number.isFinite(value) || value < MIN_ASAAS_CHARGE_VALUE) {
      throw new Error('O valor do orçamento é inválido para cobrança.')
    }

    const externalReference = getEmpresaExternalReference(empresa.id)
    const customer = await createAsaasCustomer({
      name: empresa.razao_social,
      cpfCnpj: empresa.cnpj,
      email: empresa.email,
      phone: empresa.telefone,
      mobilePhone: empresa.telefone,
      address: empresa.endereco,
      addressNumber: empresa.numero,
      complement: empresa.complemento || undefined,
      province: empresa.bairro,
      postalCode: empresa.cep,
      externalReference,
    })
    customerId = customer.id

    const { error: customerUpdateError } = await supabase
      .from('empresas')
      .update({ asaas_customer_id: customerId })
      .eq('id', empresa.id)
      .eq('status', EMPRESA_STATUSES.pagamento)
    if (customerUpdateError) throw customerUpdateError

    const payment = await createAsaasPayment({
      customer: customerId,
      value,
      dueDate: dueDate(),
      billingType,
      description: `Adesão empresarial Aliança Saúde - ${empresa.razao_social}`,
      externalReference,
    })
    paymentId = payment.id

    const { error: paymentUpdateError } = await supabase
      .from('empresas')
      .update({ asaas_payment_id: paymentId })
      .eq('id', empresa.id)
      .eq('status', EMPRESA_STATUSES.pagamento)
    if (paymentUpdateError) throw paymentUpdateError

    return NextResponse.json({
      success: true,
      status: EMPRESA_STATUSES.pagamento,
      nextStep: empresaNextStep(EMPRESA_STATUSES.pagamento),
      pagamento: {
        id: payment.id,
        valor: payment.value || value,
        vencimento: payment.dueDate || dueDate(),
        billingType: payment.billingType || billingType,
        invoiceUrl: payment.invoiceUrl || null,
        bankSlipUrl: payment.bankSlipUrl || null,
      },
    })
  } catch (error) {
    if (claimedEmpresaId) {
      await rollbackAsaas(customerId, paymentId)
      const supabase = createAdminClient()
      await supabase
        .from('empresas')
        .update({
          status: EMPRESA_STATUSES.lista,
          asaas_customer_id: null,
          asaas_payment_id: null,
          mensalidade_billing_type: null,
        })
        .eq('id', claimedEmpresaId)
        .eq('status', EMPRESA_STATUSES.pagamento)
    }

    if (error instanceof Error && error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }
    if (error instanceof AsaasIntegrationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Erro ao gerar pagamento empresarial:', error)
    const message = error instanceof Error && /orçamento inválido/i.test(error.message)
      ? error.message
      : 'Erro ao gerar cobrança empresarial.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
