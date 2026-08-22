import { createAdminClient } from '@/lib/supabase/admin'
import { requireParceiroAuth } from '@/lib/supabase/parceiro-auth'
import { buildParceiroComissaoResumo } from '@/lib/comissoes'
import { hydrateCadastrosWithPrimeiraMensalidadePaga } from '@/lib/comissoes-asaas'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const authResult = await requireParceiroAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { parceiroId } = authResult

  try {
    const supabase = createAdminClient()

    // Buscar dados do parceiro
    const { data: parceiro, error: parceiroError } = await supabase
      .from('parceiros')
      .select('id, nome, email, codigo_indicacao, ativo, comissao_percentual_mensalidade, comissao_mensalidades_max')
      .eq('id', parceiroId)
      .maybeSingle()

    if (parceiroError) {
      const details = `${parceiroError.message || ''} ${parceiroError.details || ''}`
      if (/relation .*parceiros|does not exist|42P01/i.test(details)) {
        return NextResponse.json(
          { error: 'Banco desatualizado. Execute scripts/015_add_parceiros_module.sql no Supabase SQL Editor.' },
          { status: 500 }
        )
      }
      throw parceiroError
    }

    if (!parceiro) {
      return NextResponse.json({ error: 'Parceiro não encontrado.' }, { status: 404 })
    }

    // Buscar cadastros deste parceiro
    const { data: cadastros, error: cadastrosError } = await supabase
      .from('cadastros')
      .select(
        'id, nome, email, status, created_at, mensalidade_valor, parceiro_codigo, asaas_subscription_id, sem_adesao'
      )
      .eq('parceiro_id', parceiroId)
      .order('created_at', { ascending: false })

    if (cadastrosError) {
      const details = `${cadastrosError.message || ''} ${cadastrosError.details || ''}`
      if (/column .*parceiro_id|parceiro_id.*column/i.test(details)) {
        return NextResponse.json(
          { error: 'Banco desatualizado. Execute scripts/015_add_parceiros_module.sql no Supabase SQL Editor.' },
          { status: 500 }
        )
      }
      throw cadastrosError
    }

    // Buscar pagamentos de comissão já registrados
    const { data: pagamentosComissao, error: pagamentosError } = await supabase
      .from('parceiro_comissao_pagamentos')
      .select('*')
      .eq('parceiro_id', parceiroId)
      .order('mes_referencia', { ascending: false })

    if (pagamentosError) {
      const details = `${pagamentosError.message || ''} ${pagamentosError.details || ''}`
      if (/relation .*parceiro_comissao_pagamentos|does not exist|42P01/i.test(details)) {
        // Tabela ainda não existe; continua com array vazio
      } else {
        throw pagamentosError
      }
    }

    const allCadastros = cadastros || []

    // Mapear para o formato esperado pelo buildParceiroComissaoResumo
    // Parceiro não cobra adesão, apenas mensalidades
    const cadastrosMapped = allCadastros.map((c) => ({
      id: c.id,
      status: c.status,
      adesao_valor: 0, // sem adesão
      mensalidade_valor: Number(c.mensalidade_valor || 0),
      criado_em: c.created_at,
      asaas_subscription_id: c.asaas_subscription_id,
      primeira_mensalidade_paga_em: null as string | null,
    }))

    const cadastrosComMensalidade = await hydrateCadastrosWithPrimeiraMensalidadePaga(cadastrosMapped)

    const comissaoConfig = {
      percentualMensalidade: Number(parceiro.comissao_percentual_mensalidade ?? 50),
      mensalidadesMax: parceiro.comissao_mensalidades_max != null
        ? Number(parceiro.comissao_mensalidades_max)
        : null,
    }

    const comissaoResumo = buildParceiroComissaoResumo(
      cadastrosComMensalidade,
      (pagamentosComissao || []) as any,
      new Date(),
      comissaoConfig
    )

    const appBaseUrl = request.nextUrl.origin.replace(/\/$/, '')
    const linkVenda = `${appBaseUrl}/cadastro?ref=${parceiro.codigo_indicacao}`

    return NextResponse.json({
      success: true,
      parceiro: {
        id: parceiro.id,
        nome: parceiro.nome,
        email: parceiro.email,
        codigoIndicacao: parceiro.codigo_indicacao,
        linkVenda,
        comissaoPercentualMensalidade: comissaoConfig.percentualMensalidade,
        comissaoMensalidadesMax: comissaoConfig.mensalidadesMax,
      },
      cadastros: allCadastros,
      comissaoResumo,
      totalPendentes: allCadastros.length - comissaoResumo.totalVendasPagas,
    })
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)
    if (/fetch failed|enotfound|getaddrinfo|network/i.test(details)) {
      return NextResponse.json(
        { error: 'Falha ao conectar no Supabase. Verifique as configurações de ambiente.' },
        { status: 503 }
      )
    }

    console.error('Parceiro resumo GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar dados do parceiro.' }, { status: 500 })
  }
}
