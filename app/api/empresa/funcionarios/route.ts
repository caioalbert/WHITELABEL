import { EMPRESA_STATUSES, empresaNextStep } from '@/lib/empresa-flow'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireEmpresaFlowAuth } from '@/lib/supabase/empresa-auth'
import { getAgeFromIsoDate, isValidCPF, isValidEmail, normalizeCPF } from '@/lib/utils'
import { NextRequest, NextResponse } from 'next/server'

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cpfCandidates(cpf: string) {
  return [cpf, cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')]
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireEmpresaFlowAuth()
    const body = (await request.json().catch(() => null)) as { funcionarios?: unknown[] } | null
    if (!Array.isArray(body?.funcionarios)) {
      return NextResponse.json({ error: 'A lista de colaboradores é obrigatória.' }, { status: 400 })
    }

    const funcionarios = body.funcionarios.map((raw) => {
      const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
      return {
        empresa_id: auth.empresaId,
        nome: text(item.nome),
        cpf: normalizeCPF(text(item.cpf)),
        rg: text(item.rg) || null,
        email: text(item.email).toLowerCase(),
        telefone: text(item.telefone),
        data_nascimento: text(item.data_nascimento),
        sexo: text(item.sexo) || null,
        cargo: text(item.cargo) || null,
      }
    })

    const invalid = funcionarios.find((item) =>
      !item.nome || !item.cpf || !item.rg || !item.email || !item.telefone || !item.sexo ||
      getAgeFromIsoDate(item.data_nascimento) === null ||
      Number(getAgeFromIsoDate(item.data_nascimento)) < 0 ||
      !isValidCPF(item.cpf) || !isValidEmail(item.email)
    )
    if (invalid) {
      return NextResponse.json(
        { error: `Dados inválidos ou incompletos para o colaborador ${invalid.nome || 'sem nome'}.` },
        { status: 400 }
      )
    }

    const uniqueCpfs = new Set(funcionarios.map((item) => item.cpf))
    const uniqueEmails = new Set(funcionarios.map((item) => item.email))
    if (uniqueCpfs.size !== funcionarios.length || uniqueEmails.size !== funcionarios.length) {
      return NextResponse.json({ error: 'A lista contém CPF ou email duplicado.' }, { status: 409 })
    }

    const supabase = createAdminClient()
    const { data: empresa } = await supabase
      .from('empresas')
      .select('status, minimo_funcionarios, valor_por_funcionario')
      .eq('id', auth.empresaId)
      .maybeSingle()
    if (empresa?.status !== EMPRESA_STATUSES.orcamento) {
      return NextResponse.json(
        { error: 'A lista só pode ser enviada depois da solicitação de orçamento.' },
        { status: 409 }
      )
    }

    const minFuncionarios = Number(empresa.minimo_funcionarios)
    const valorPorFuncionario = Number(empresa.valor_por_funcionario)
    if (!Number.isInteger(minFuncionarios) || minFuncionarios <= 0 || !Number.isFinite(valorPorFuncionario) || valorPorFuncionario <= 0) {
      return NextResponse.json({ error: 'O orçamento da empresa está inconsistente.' }, { status: 409 })
    }
    if (funcionarios.length < minFuncionarios) {
      return NextResponse.json(
        { error: `O orçamento exige ao menos ${minFuncionarios} colaboradores.` },
        { status: 400 }
      )
    }

    const candidates = funcionarios.flatMap((item) => cpfCandidates(item.cpf))
    const emails = funcionarios.map((item) => item.email)
    const employeeCpfs = funcionarios.map((item) => item.cpf)
    const duplicateChecks = await Promise.all([
      supabase.from('cadastros').select('id').in('cpf', candidates).limit(1),
      supabase.from('cadastros').select('id').in('email', emails).limit(1),
      supabase.from('dependentes').select('id').in('cpf', candidates).limit(1),
      supabase.from('dependentes').select('id').in('email', emails).limit(1),
      supabase.from('empresa_funcionarios').select('id').in('cpf', employeeCpfs).limit(1),
      supabase.from('empresa_funcionarios').select('id').in('email', emails).limit(1),
    ])
    const duplicateCheckError = duplicateChecks.find((result) => result.error)?.error
    if (duplicateCheckError) {
      throw duplicateCheckError
    }
    if (duplicateChecks.some((result) => Boolean(result.data?.length))) {
      return NextResponse.json(
        { error: 'Um dos CPFs ou emails da lista já está cadastrado no sistema.' },
        { status: 409 }
      )
    }

    const total = Math.round((valorPorFuncionario * funcionarios.length + Number.EPSILON) * 100) / 100
    const { error: insertError } = await supabase.from('empresa_funcionarios').insert(funcionarios)
    if (insertError) throw insertError

    const { data: updated, error: updateError } = await supabase
      .from('empresas')
      .update({
        status: EMPRESA_STATUSES.lista,
        quantidade_funcionarios: funcionarios.length,
        valor_por_funcionario: valorPorFuncionario,
        mensalidade_valor: total,
        lista_funcionarios_enviada_em: new Date().toISOString(),
      })
      .eq('id', auth.empresaId)
      .eq('status', EMPRESA_STATUSES.orcamento)
      .select('id, status, quantidade_funcionarios, valor_por_funcionario, mensalidade_valor')
      .maybeSingle()

    if (updateError || !updated) {
      await supabase.from('empresa_funcionarios').delete().eq('empresa_id', auth.empresaId)
      if (updateError) throw updateError
      return NextResponse.json({ error: 'A etapa da empresa mudou. Recarregue a página.' }, { status: 409 })
    }

    return NextResponse.json({
      success: true,
      empresa: updated,
      nextStep: empresaNextStep(EMPRESA_STATUSES.lista),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }
    console.error('Erro ao enviar lista de colaboradores:', error)
    return NextResponse.json({ error: 'Erro ao enviar lista de colaboradores.' }, { status: 500 })
  }
}
