import { listCadastrosWithIndicadores, type CadastroComIndicadores } from '@/lib/admin-cadastros'
import { getMissingCadastroFields } from '@/lib/cadastro-completeness'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminAuth } from '@/lib/supabase/admin-auth'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { CadastrosListPDF } from './CadastrosListPDF'

type FinanceiroFilterOption = 'TODOS' | 'EM_DIA' | 'EM_ATRASO' | 'ADESAO_NAO_CONCLUIDA'
type DadosFilterOption = 'TODOS' | 'PENDENTES' | 'COMPLETOS'
type PlanoFilterOption = 'TODOS' | string
type ExportTemplateOption = 'DEFAULT' | 'PARTNER'

type ExportRow = {
  nome: string
  email: string
  cpf: string
  dataCadastro: string
  financeiroStatus: string
  dadosStatus: string
  statusCadastro: string
  plano: string
  mensalidade: string
  telefone: string
  cidade: string
  estado: string
}

const FINANCEIRO_FILTERS = new Set<FinanceiroFilterOption>([
  'TODOS',
  'EM_DIA',
  'EM_ATRASO',
  'ADESAO_NAO_CONCLUIDA',
])
const DADOS_FILTERS = new Set<DadosFilterOption>(['TODOS', 'PENDENTES', 'COMPLETOS'])

function toText(value: unknown) {
  if (value === null || value === undefined) return ''
  return String(value)
}

function formatDate(value: unknown) {
  const raw = toText(value)
  if (!raw) return '-'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('pt-BR')
}

function formatDateTime(value: unknown) {
  const raw = toText(value)
  if (!raw) return '-'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('pt-BR')
}

function formatCurrency(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return '-'
  return numeric.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function getFinanceiroStatusLabel(value: unknown) {
  const normalized = toText(value).trim().toUpperCase()
  if (normalized === 'EM_DIA') return 'Em dias'
  if (normalized === 'EM_ATRASO') return 'Em atraso'
  if (normalized === 'ADESAO_NAO_CONCLUIDA') return 'Adesão não concluída'
  return '-'
}

function getDadosStatusLabel(cadastro: CadastroComIndicadores) {
  const missingCount = getMissingCadastroFields(cadastro).length
  if (missingCount === 0) return 'Completos'
  return `Pendentes (${missingCount})`
}

function filterCadastros(
  cadastros: CadastroComIndicadores[],
  {
    searchTerm,
    financeiroFilter,
    dadosFilter,
    planoFilter,
  }: {
    searchTerm: string
    financeiroFilter: FinanceiroFilterOption
    dadosFilter: DadosFilterOption
    planoFilter: PlanoFilterOption
  }
) {
  const normalizedSearch = searchTerm.trim().toLowerCase()

  return cadastros.filter((cadastro) => {
    const nome = toText(cadastro.nome).toLowerCase()
    const email = toText(cadastro.email).toLowerCase()
    const cpf = toText(cadastro.cpf)
    const matchesSearch =
      !normalizedSearch ||
      nome.includes(normalizedSearch) ||
      email.includes(normalizedSearch) ||
      cpf.includes(normalizedSearch)

    if (!matchesSearch) {
      return false
    }

    if (financeiroFilter !== 'TODOS') {
      const financeiro = toText(cadastro.financeiro_status).trim().toUpperCase()
      if (financeiro !== financeiroFilter) {
        return false
      }
    }

    if (planoFilter !== 'TODOS') {
      const plano = toText(cadastro.tipo_plano).trim().toUpperCase()
      if (plano !== planoFilter) {
        return false
      }
    }

    if (dadosFilter === 'TODOS') {
      return true
    }

    const hasMissingData = getMissingCadastroFields(cadastro).length > 0
    if (dadosFilter === 'PENDENTES') return hasMissingData
    return !hasMissingData
  })
}

function escapeCsv(value: string) {
  if (/[;"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function buildCsvContent(rows: ExportRow[]) {
  const headers = [
    'Nome',
    'Email',
    'CPF',
    'Data do cliente',
    'Status financeiro',
    'Status dos dados',
    'Status do cliente',
    'Plano',
    'Mensalidade',
    'Telefone',
    'Cidade',
    'UF',
  ]

  const lines = [headers.join(';')]
  for (const row of rows) {
    lines.push(
      [
        row.nome,
        row.email,
        row.cpf,
        row.dataCadastro,
        row.financeiroStatus,
        row.dadosStatus,
        row.statusCadastro,
        row.plano,
        row.mensalidade,
        row.telefone,
        row.cidade,
        row.estado,
      ]
        .map((item) => escapeCsv(item || ''))
        .join(';')
    )
  }

  return `\uFEFF${lines.join('\n')}`
}

function buildPartnerCsvContent(cadastros: CadastroComIndicadores[]) {
  const headers = [
    'Nome',
    'CPF',
    'Data de Nascimento',
    'Telefone',
    'E-mail',
    'CEP',
    'Endereço',
    'Cidade',
    'UF',
    'Titular',
    'Status',
    'Criado em',
    'Inativado em',
    'Planos',
  ]

  const lines = [headers.join(';')]
  for (const cadastro of cadastros) {
    const enderecoBase = [
      toText(cadastro.endereco).trim(),
      toText(cadastro.numero).trim(),
      toText(cadastro.complemento).trim(),
      toText(cadastro.bairro).trim(),
    ]
      .filter(Boolean)
      .join(', ')
    const planoRaw = toText(cadastro.tipo_plano).trim().toUpperCase()
    const plano =
      planoRaw === 'FAMILIAR' ? 'Familiar' : planoRaw === 'INDIVIDUAL' ? 'Individual' : planoRaw || '-'
    const financeiroRaw = toText(cadastro.financeiro_status).trim().toUpperCase()
    const statusCadastroRaw = toText(cadastro.status).trim().toUpperCase()
    const status =
      statusCadastroRaw === 'ATIVO'
        ? 'Ativo'
        : financeiroRaw === 'EM_ATRASO'
          ? 'Em atraso'
          : financeiroRaw === 'ADESAO_NAO_CONCLUIDA'
            ? 'Adesão não concluída'
            : statusCadastroRaw || '-'
    const inativadoEm = statusCadastroRaw && statusCadastroRaw !== 'ATIVO'
      ? formatDateTime(cadastro.updated_at)
      : '-'

    lines.push(
      [
        toText(cadastro.nome) || '-',
        toText(cadastro.cpf) || '-',
        formatDate(cadastro.data_nascimento),
        toText(cadastro.telefone) || '-',
        toText(cadastro.email) || '-',
        toText(cadastro.cep) || '-',
        enderecoBase || '-',
        toText(cadastro.cidade) || '-',
        toText(cadastro.estado) || '-',
        'Sim',
        status,
        formatDateTime(cadastro.created_at),
        inativadoEm,
        plano,
      ]
        .map((item) => escapeCsv(item || ''))
        .join(';')
    )
  }

  return `\uFEFF${lines.join('\n')}`
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request)
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const searchParams = request.nextUrl.searchParams
    const format = toText(searchParams.get('format')).trim().toLowerCase()
    const scope = toText(searchParams.get('scope')).trim().toLowerCase() === 'all' ? 'all' : 'filtered'

    if (format !== 'csv' && format !== 'pdf') {
      return NextResponse.json(
        { error: 'Formato inválido. Use format=csv ou format=pdf.' },
        { status: 400 }
      )
    }

    const searchTerm = toText(searchParams.get('search'))
    const templateRaw = toText(searchParams.get('template')).trim().toLowerCase()
    const template: ExportTemplateOption = templateRaw === 'partner' ? 'PARTNER' : 'DEFAULT'
    const daysRaw = Number(searchParams.get('days'))
    const partnerDays =
      Number.isFinite(daysRaw) && daysRaw > 0
        ? Math.min(Math.floor(daysRaw), 365)
        : 30
    const financeiroFilterRaw = toText(searchParams.get('financeiroStatus')).trim().toUpperCase()
    const dadosFilterRaw = toText(searchParams.get('dadosStatus')).trim().toUpperCase()
    const planoFilterRaw = toText(searchParams.get('plano')).trim().toUpperCase()

    const financeiroFilter = (
      FINANCEIRO_FILTERS.has(financeiroFilterRaw as FinanceiroFilterOption)
        ? financeiroFilterRaw
        : 'TODOS'
    ) as FinanceiroFilterOption
    const dadosFilter = (
      DADOS_FILTERS.has(dadosFilterRaw as DadosFilterOption)
        ? dadosFilterRaw
        : 'TODOS'
    ) as DadosFilterOption
    const planoFilter: PlanoFilterOption = planoFilterRaw || 'TODOS'

    const supabase = createAdminClient()
    const allCadastros = await listCadastrosWithIndicadores(supabase)
    const cadastrosWithFilters =
      scope === 'all'
        ? allCadastros
        : filterCadastros(allCadastros, {
            searchTerm,
            financeiroFilter,
            dadosFilter,
            planoFilter,
          })

    const cadastros =
      template === 'PARTNER'
        ? (() => {
            const now = new Date()
            const maxMs = partnerDays * 24 * 60 * 60 * 1000
            return cadastrosWithFilters.filter((cadastro) => {
              const createdAt = new Date(toText(cadastro.created_at))
              if (Number.isNaN(createdAt.getTime())) return false
              const diffMs = now.getTime() - createdAt.getTime()
              return diffMs >= 0 && diffMs <= maxMs
            })
          })()
        : cadastrosWithFilters

    const rows: ExportRow[] = cadastros.map((cadastro) => ({
      nome: toText(cadastro.nome),
      email: toText(cadastro.email),
      cpf: toText(cadastro.cpf),
      dataCadastro: formatDate(cadastro.created_at),
      financeiroStatus: getFinanceiroStatusLabel(cadastro.financeiro_status),
      dadosStatus: getDadosStatusLabel(cadastro),
      statusCadastro: toText(cadastro.status).trim().toUpperCase() || '-',
      plano: toText(cadastro.tipo_plano).trim().toUpperCase() || '-',
      mensalidade: formatCurrency(cadastro.mensalidade_valor),
      telefone: toText(cadastro.telefone) || '-',
      cidade: toText(cadastro.cidade) || '-',
      estado: toText(cadastro.estado) || '-',
    }))

    const now = new Date()
    const dateStamp = now.toISOString().slice(0, 10)
    const scopeLabel = scope === 'all' ? 'Todos os clientes' : 'Somente filtros aplicados'
    const filtrosSummary =
      scope === 'all'
        ? 'Sem filtros'
        : `Busca: ${searchTerm || '-'} | Financeiro: ${financeiroFilter} | Dados: ${dadosFilter} | Plano: ${planoFilter}`

    if (format === 'csv') {
      const csv =
        template === 'PARTNER' ? buildPartnerCsvContent(cadastros) : buildCsvContent(rows)
      const fileName =
        template === 'PARTNER'
          ? `clientes-parceiro-${partnerDays}dias-${dateStamp}.csv`
          : `clientes-${scope}-${dateStamp}.csv`

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    if (template === 'PARTNER') {
      return NextResponse.json(
        { error: 'Template partner disponível apenas para formato CSV.' },
        { status: 400 }
      )
    }

    const pdfDocument = React.createElement(CadastrosListPDF, {
      generatedAt: now.toLocaleString('pt-BR'),
      scopeLabel,
      filtersSummary: filtrosSummary,
      total: rows.length,
      rows: rows.map((row) => ({
        nome: row.nome,
        email: row.email,
        cpf: row.cpf,
        dataCadastro: row.dataCadastro,
        financeiroStatus: row.financeiroStatus,
        dadosStatus: row.dadosStatus,
      })),
    }) as unknown as React.ReactElement<DocumentProps>

    const pdfBuffer = Buffer.from(await renderToBuffer(pdfDocument))
    const fileName = `clientes-${scope}-${dateStamp}.pdf`

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Clientes export API error:', error)
    return NextResponse.json(
      { error: 'Erro ao exportar lista de clientes.' },
      { status: 500 }
    )
  }
}
