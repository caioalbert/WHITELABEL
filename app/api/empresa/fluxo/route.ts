import { empresaNextStep, isEmpresaStatus, loadEmpresaPlan } from '@/lib/empresa-flow'
import { getAsaasPayment, isAsaasPaidStatus } from '@/lib/asaas'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireEmpresaFlowAuth } from '@/lib/supabase/empresa-auth'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const auth = await requireEmpresaFlowAuth()
    const supabase = createAdminClient()
    const { data: empresa, error } = await supabase
      .from('empresas')
      .select('id, razao_social, nome_fantasia, cnpj, email, status, tipo_plano, quantidade_funcionarios, minimo_funcionarios, valor_por_funcionario, mensalidade_valor, mensalidade_billing_type, asaas_payment_id, pagamento_confirmado_em')
      .eq('id', auth.empresaId)
      .maybeSingle()

    if (error || !empresa) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }
    if (!isEmpresaStatus(empresa.status)) {
      return NextResponse.json({ error: 'Status empresarial inválido.' }, { status: 409 })
    }

    const { data: funcionarios } = await supabase
      .from('empresa_funcionarios')
      .select('id, nome, cpf, email, telefone, data_nascimento, cargo')
      .eq('empresa_id', empresa.id)
      .order('created_at', { ascending: true })

    let pagamento = null
    let processingPayment = false
    if (empresa.asaas_payment_id) {
      const charge = await getAsaasPayment(empresa.asaas_payment_id).catch(() => null)
      if (charge) {
        processingPayment = isAsaasPaidStatus(charge.status)
        pagamento = {
          id: charge.id,
          status: charge.status,
          valor: charge.value,
          vencimento: charge.dueDate,
          billingType: charge.billingType,
          invoiceUrl: charge.invoiceUrl || null,
          bankSlipUrl: charge.bankSlipUrl || null,
        }
      }
    }

    const plan = await loadEmpresaPlan()

    return NextResponse.json({
      empresa,
      funcionarios: funcionarios || [],
      orcamento: {
        ...plan,
        valorPorFuncionario: Number(empresa.valor_por_funcionario || plan.valorPorFuncionario),
        minFuncionarios: Number(empresa.minimo_funcionarios || plan.minFuncionarios),
      },
      pagamento,
      processingPayment,
      nextStep: empresaNextStep(empresa.status),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }
    console.error('Erro ao consultar fluxo empresarial:', error)
    return NextResponse.json({ error: 'Erro ao consultar fluxo empresarial.' }, { status: 500 })
  }
}
