import { EMPRESA_STATUSES, empresaNextStep, loadEmpresaPlan } from '@/lib/empresa-flow'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireEmpresaFlowAuth } from '@/lib/supabase/empresa-auth'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const auth = await requireEmpresaFlowAuth()
    const plan = await loadEmpresaPlan()
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('empresas')
      .update({
        status: EMPRESA_STATUSES.orcamento,
        tipo_plano: plan.codigo,
        valor_por_funcionario: plan.valorPorFuncionario,
        minimo_funcionarios: plan.minFuncionarios,
        orcamento_solicitado_em: new Date().toISOString(),
      })
      .eq('id', auth.empresaId)
      .eq('status', EMPRESA_STATUSES.cadastro)
      .select('id, status, tipo_plano, valor_por_funcionario, minimo_funcionarios')
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json(
        { error: 'O orçamento só pode ser solicitado após a conclusão do cadastro.' },
        { status: 409 }
      )
    }

    return NextResponse.json({
      success: true,
      empresa: data,
      orcamento: { ...plan },
      nextStep: empresaNextStep(EMPRESA_STATUSES.orcamento),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }
    console.error('Erro ao solicitar orçamento:', error)
    return NextResponse.json({ error: 'Erro ao solicitar orçamento.' }, { status: 500 })
  }
}
