import { createAdminClient } from '@/lib/supabase/admin'
import { requireInstitutoAuth } from '@/lib/supabase/instituto-auth'
import { buildInstitutoComissaoResumo } from '@/lib/comissoes'
import { hydrateCadastrosWithPrimeiraMensalidadePaga } from '@/lib/comissoes-asaas'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const authResult = await requireInstitutoAuth(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { institutoId } = authResult

  try {
    const supabase = createAdminClient()

    // Buscar dados do instituto
    const { data: instituto, error: institutoError } = await supabase
      .from('institutos')
      .select('id, nome, email, codigo_indicacao, ativo, comissao_percentual_mensalidade, comissao_mensalidades_max')
      .eq('id', institutoId)
      .maybeSingle()

    if (institutoError) {
      const details = `${institutoError.message || ''} ${institutoError.details || ''}`
      if (/relation .*institutos|does not exist|42P01/i.test(details)) {
        return NextResponse.json(
          { error: 'Banco desatualizado. Execute scripts/015_add_institutos_module.sql no Supabase SQL Editor.' },
          { status: 500 }
        )
      }
      throw institutoError
    }

    if (!instituto) {
      return NextResponse.json({ error: 'Instituto não encontrado.' }, { status: 404 })
    }

    // Buscar cadastros deste instituto
    const { data: cadastros, error: cadastrosError } = await supabase
      .from('cadastros')
      .select(
        'id, nome, email, status, created_at, mensalidade_valor, instituto_codigo, asaas_subscription_id, sem_adesao'
      )
      .eq('instituto_id', institutoId)
      .order('created_at', { ascending: false })

    if (cadastrosError) {
      const details = `${cadastrosError.message || ''} ${cadastrosError.details || ''}`
      if (/column .*instituto_id|instituto_id.*column/i.test(details)) {
        return NextResponse.json(
          { error: 'Banco desatualizado. Execute scripts/015_add_institutos_module.sql no Supabase SQL Editor.' },
          { status: 500 }
        )
      }
      throw cadastrosError
    }

    // Buscar pagamentos de comissão já registrados
    const { data: pagamentosComissao, error: pagamentosError } = await supabase
      .from('instituto_comissao_pagamentos')
      .select('*')
      .eq('instituto_id', institutoId)
      .order('mes_referencia', { ascending: false })

    if (pagamentosError) {
      const details = `${pagamentosError.message || ''} ${pagamentosError.details || ''}`
      if (/relation .*instituto_comissao_pagamentos|does not exist|42P01/i.test(details)) {
        // Tabela ainda não existe; continua com array vazio
      } else {
        throw pagamentosError
      }
    }

    const allCadastros = cadastros || []

    // Mapear para o formato esperado pelo buildInstitutoComissaoResumo
    // Instituto não cobra adesão, apenas mensalidades
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
      percentualMensalidade: Number(instituto.comissao_percentual_mensalidade ?? 50),
      mensalidadesMax: instituto.comissao_mensalidades_max != null
        ? Number(instituto.comissao_mensalidades_max)
        : null,
    }

    const comissaoResumo = buildInstitutoComissaoResumo(
      cadastrosComMensalidade,
      (pagamentosComissao || []) as any,
      new Date(),
      comissaoConfig
    )

    const appBaseUrl = request.nextUrl.origin.replace(/\/$/, '')
    const linkVenda = `${appBaseUrl}/cadastro?ref=${instituto.codigo_indicacao}`

    return NextResponse.json({
      success: true,
      instituto: {
        id: instituto.id,
        nome: instituto.nome,
        email: instituto.email,
        codigoIndicacao: instituto.codigo_indicacao,
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

    console.error('Instituto resumo GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar dados do instituto.' }, { status: 500 })
  }
}
