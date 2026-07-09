import { listCadastrosWithIndicadores } from '@/lib/admin-cadastros'
import { requireAdminAuth } from '@/lib/supabase/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request)
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const includeDependentes = request.nextUrl.searchParams.get('includeDependentes') === 'true'
    const includePlanos = request.nextUrl.searchParams.get('includePlanos') === 'true'
    const includeFinance = request.nextUrl.searchParams.get('includeFinance') === 'true'
    const supabase = createAdminClient()

    const cadastrosComIndicadores = await listCadastrosWithIndicadores(supabase)
    const cadastroIds = cadastrosComIndicadores.map((cadastro) => String(cadastro.id))
    let dependentes: Array<{
      id: string
      cadastro_id: string
      nome: string
      email: string
      cpf: string | null
      created_at: string
    }> = []
    let planos: Array<{
      codigo: string
      nome: string
      ativo: boolean
      ordem: number
    }> = []
    let financeiroResumo: {
      receitaMesAtual: number
      comissoesPagasMesAtual: number
    } | null = null

    if (includeDependentes && cadastroIds.length > 0) {
      const { data, error } = await supabase
        .from('dependentes')
        .select('id, cadastro_id, nome, email, cpf, created_at')
        .in('cadastro_id', cadastroIds)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      dependentes = (data || []) as typeof dependentes
    }

    if (includePlanos) {
      const { data, error } = await supabase
        .from('planos')
        .select('codigo, nome, ativo, ordem')
        .order('ordem', { ascending: true })
        .order('nome', { ascending: true })

      if (error) {
        const details = `${error.message || ''} ${error.details || ''}`
        if (!/relation .*planos|does not exist|42P01/i.test(details)) {
          throw error
        }
      } else {
        planos = ((data || []) as typeof planos).map((item) => ({
          codigo: String(item.codigo || '').trim().toUpperCase(),
          nome: String(item.nome || '').trim(),
          ativo: Boolean(item.ativo),
          ordem: Number.isFinite(Number(item.ordem)) ? Number(item.ordem) : 0,
        }))
      }
    }

    if (includeFinance) {
      const now = new Date()
      const monthStartDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      const nextMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
      const monthStartIso = monthStartDate.toISOString()
      const nextMonthIso = nextMonthDate.toISOString()

      const receitaMesAtual = cadastrosComIndicadores.reduce((acc, cadastro) => {
        const status = String(cadastro.status || '').trim().toUpperCase()
        if (status !== 'ATIVO') return acc

        const adesaoPagoEm = String(cadastro.adesao_pago_em || '').trim()
        if (!adesaoPagoEm) return acc

        const paidAt = new Date(adesaoPagoEm)
        if (Number.isNaN(paidAt.getTime())) return acc
        if (paidAt.toISOString() < monthStartIso || paidAt.toISOString() >= nextMonthIso) return acc

        const valor = Number(cadastro.mensalidade_valor)
        if (!Number.isFinite(valor)) return acc
        return acc + valor
      }, 0)

      let comissoesPagasMesAtual = 0
      const { data: pagamentosComissao, error: pagamentosComissaoError } = await supabase
        .from('vendedor_comissao_pagamentos')
        .select('valor_total, pago_em')
        .gte('pago_em', monthStartIso)
        .lt('pago_em', nextMonthIso)

      if (pagamentosComissaoError) {
        const details = `${pagamentosComissaoError.message || ''} ${pagamentosComissaoError.details || ''}`
        if (!/relation .*vendedor_comissao_pagamentos|does not exist|42P01|column .*pago_em|valor_total/i.test(details)) {
          throw pagamentosComissaoError
        }
      } else {
        comissoesPagasMesAtual = (pagamentosComissao || []).reduce((acc, pagamento) => {
          const valor = Number((pagamento as { valor_total?: unknown }).valor_total)
          if (!Number.isFinite(valor)) return acc
          return acc + valor
        }, 0)
      }

      financeiroResumo = {
        receitaMesAtual: Math.round((receitaMesAtual + Number.EPSILON) * 100) / 100,
        comissoesPagasMesAtual: Math.round((comissoesPagasMesAtual + Number.EPSILON) * 100) / 100,
      }
    }

    return NextResponse.json({
      success: true,
      cadastros: cadastrosComIndicadores,
      dependentes,
      planos,
      financeiroResumo,
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
