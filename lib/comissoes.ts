type CadastroComissaoBase = {
  status?: string | null
  adesao_pago_em?: string | null
  adesao_valor?: number | string | null
  mensalidade_valor?: number | string | null
  primeira_mensalidade_paga_em?: string | null
}

type PagamentoComissaoBase = {
  id: string
  mes_referencia: string
  valor_total?: number | string | null
  pago_em?: string | null
  comprovante_url?: string | null
  comprovante_path?: string | null
  observacao?: string | null
}

export type ComissaoMensalResumo = {
  mesReferencia: string
  mesLabel: string
  quantidadeVendas: number
  quantidadeMensalidadesSubsequentes: number
  valorAdesaoMes: number
  valorMensalidadeSubsequenteMes: number
  mesReferenciaBaseMensalidade: string | null
  mesLabelBaseMensalidade: string | null
  valorTotal: number
  valorPagoRegistrado: number
  valorPendente: number
  pago: boolean
  pagamentoId: string | null
  pagoEm: string | null
  comprovanteUrl: string | null
  comprovantePath: string | null
  observacao: string | null
}

export type ComissaoResumo = {
  totalVendasPagas: number
  comissaoMesAtualBruta: number
  comissaoMesAtualPaga: number
  comissaoMesAtualPendente: number
  comissaoTotalBruta: number
  comissaoTotalPaga: number
  comissaoTotalDevida: number
  comissoesMensais: ComissaoMensalResumo[]
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function normalizeCurrencyValue(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

export type ComissaoConfig = {
  percentualAdesao: number // 0–100, default 50
  percentualMensalidade: number // 0–100, default 50
  mensalidadesMax: number | null // null = vitalício; 1 = only first; N = first N
}

export const DEFAULT_COMISSAO_CONFIG: ComissaoConfig = {
  percentualAdesao: 50,
  percentualMensalidade: 50,
  mensalidadesMax: 1,
}

export function calculateCadastroComissaoValue(
  cadastro: Pick<CadastroComissaoBase, 'adesao_valor' | 'mensalidade_valor'>,
  config: ComissaoConfig = DEFAULT_COMISSAO_CONFIG
) {
  const breakdown = calculateCadastroComissaoBreakdown(cadastro, config)
  return breakdown.total
}

export function calculateCadastroComissaoBreakdown(
  cadastro: Pick<CadastroComissaoBase, 'adesao_valor' | 'mensalidade_valor'>,
  config: ComissaoConfig = DEFAULT_COMISSAO_CONFIG
) {
  const mensalidadeValor = normalizeCurrencyValue(cadastro.mensalidade_valor)
  const adesaoValorInformado = normalizeCurrencyValue(cadastro.adesao_valor)
  const adesaoValor = adesaoValorInformado > 0 ? adesaoValorInformado : mensalidadeValor

  const valorAdesao = roundCurrency(adesaoValor * (config.percentualAdesao / 100))
  const valorMensalidadeSubsequente = roundCurrency(mensalidadeValor * (config.percentualMensalidade / 100))

  return {
    valorAdesao,
    valorMensalidadeSubsequente,
    total: roundCurrency(valorAdesao + valorMensalidadeSubsequente),
  }
}

export function toMonthReferenceUTC(date: Date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${date.getUTCFullYear()}-${month}-01`
}

export function parseMonthReference(value: string) {
  const normalized = String(value || '').trim()
  if (!normalized) return null

  if (/^\d{4}-\d{2}$/.test(normalized)) {
    return `${normalized}-01`
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return `${normalized.slice(0, 7)}-01`
  }

  return null
}

export function getMonthRangeUTC(monthReference: string) {
  const parsed = parseMonthReference(monthReference)
  if (!parsed) return null

  const [yearStr, monthStr] = parsed.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null
  }

  const monthStartDate = new Date(Date.UTC(year, month - 1, 1))
  if (Number.isNaN(monthStartDate.getTime())) return null

  const monthEndDate = new Date(Date.UTC(year, month, 1))
  return {
    monthReference: parsed,
    monthStartDate,
    monthEndDate,
    startIso: monthStartDate.toISOString(),
    endIso: monthEndDate.toISOString(),
  }
}

export function formatMonthReferenceLabel(monthReference: string) {
  const range = getMonthRangeUTC(monthReference)
  if (!range) return monthReference

  return new Intl.DateTimeFormat('pt-BR', {
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(range.monthStartDate)
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

export function buildComissaoResumo(
  cadastros: CadastroComissaoBase[],
  pagamentos: PagamentoComissaoBase[],
  referenceDate: Date = new Date(),
  config: ComissaoConfig = DEFAULT_COMISSAO_CONFIG
): ComissaoResumo {
  const competenciaByMonth = new Map<
    string,
    {
      quantidadeVendas: number
      quantidadeMensalidadesSubsequentes: number
      valorAdesaoMes: number
      valorMensalidadeSubsequenteMes: number
    }
  >()
  let totalVendasPagas = 0

  cadastros.forEach((cadastro) => {
    const status = String(cadastro.status || '').trim().toUpperCase()
    if (status !== 'ATIVO' || !cadastro.adesao_pago_em) return

    const paidDate = new Date(String(cadastro.adesao_pago_em))
    if (Number.isNaN(paidDate.getTime())) return

    const adesaoCompetenciaDate = addDays(paidDate, 30)
    const monthReferenceVenda = toMonthReferenceUTC(adesaoCompetenciaDate)
    const breakdown = calculateCadastroComissaoBreakdown(cadastro, config)
    const vendaMonth = competenciaByMonth.get(monthReferenceVenda) || {
      quantidadeVendas: 0,
      quantidadeMensalidadesSubsequentes: 0,
      valorAdesaoMes: 0,
      valorMensalidadeSubsequenteMes: 0,
    }

    vendaMonth.quantidadeVendas += 1
    vendaMonth.valorAdesaoMes += breakdown.valorAdesao
    competenciaByMonth.set(monthReferenceVenda, vendaMonth)

    const primeiraMensalidadePagaEm = String(cadastro.primeira_mensalidade_paga_em || '').trim()
    if (primeiraMensalidadePagaEm) {
      const primeiraMensalidadePagaDate = new Date(primeiraMensalidadePagaEm)
      if (Number.isNaN(primeiraMensalidadePagaDate.getTime())) {
        totalVendasPagas += 1
        return
      }

      const monthReferenceMensalidade = toMonthReferenceUTC(primeiraMensalidadePagaDate)
      const mensalidadeMonth = competenciaByMonth.get(monthReferenceMensalidade) || {
        quantidadeVendas: 0,
        quantidadeMensalidadesSubsequentes: 0,
        valorAdesaoMes: 0,
        valorMensalidadeSubsequenteMes: 0,
      }

      mensalidadeMonth.quantidadeMensalidadesSubsequentes += 1
      mensalidadeMonth.valorMensalidadeSubsequenteMes += breakdown.valorMensalidadeSubsequente
      competenciaByMonth.set(monthReferenceMensalidade, mensalidadeMonth)
    }

    totalVendasPagas += 1
  })

  const pagamentosByMonth = new Map<string, PagamentoComissaoBase>()
  pagamentos.forEach((pagamento) => {
    const monthReference = parseMonthReference(String(pagamento.mes_referencia || ''))
    if (!monthReference) return
    pagamentosByMonth.set(monthReference, pagamento)
  })

  const allMonthReferences = new Set<string>([
    ...Array.from(competenciaByMonth.keys()),
    ...Array.from(pagamentosByMonth.keys()),
  ])

  const currentMonthReference = toMonthReferenceUTC(referenceDate)

  let comissaoMesAtualBruta = 0
  let comissaoMesAtualPaga = 0
  let comissaoMesAtualPendente = 0
  let comissaoTotalBruta = 0
  let comissaoTotalPaga = 0
  let comissaoTotalDevida = 0

  const comissoesMensais: ComissaoMensalResumo[] = Array.from(allMonthReferences)
    .sort((a, b) => b.localeCompare(a))
    .map((monthReference) => {
      const competencia = competenciaByMonth.get(monthReference) || {
        quantidadeVendas: 0,
        quantidadeMensalidadesSubsequentes: 0,
        valorAdesaoMes: 0,
        valorMensalidadeSubsequenteMes: 0,
      }
      const pagamento = pagamentosByMonth.get(monthReference) || null
      const valorAdesaoMes = roundCurrency(competencia.valorAdesaoMes)
      const valorMensalidadeSubsequenteMes = roundCurrency(
        competencia.valorMensalidadeSubsequenteMes
      )
      const valorTotal = roundCurrency(valorAdesaoMes + valorMensalidadeSubsequenteMes)
      const mesReferenciaBaseMensalidade = null
      const mesLabelBaseMensalidade = null
      const valorPagoRegistrado = pagamento
        ? roundCurrency(
            normalizeCurrencyValue(pagamento.valor_total) || normalizeCurrencyValue(valorTotal)
          )
        : 0
      const pago = Boolean(pagamento)
      const valorPendente = pago ? 0 : valorTotal

      comissaoTotalBruta += valorTotal
      if (pago) {
        comissaoTotalPaga += valorPagoRegistrado
      } else {
        comissaoTotalDevida += valorPendente
      }

      if (monthReference === currentMonthReference) {
        comissaoMesAtualBruta += valorTotal
        comissaoMesAtualPaga += pago ? valorPagoRegistrado : 0
        comissaoMesAtualPendente += valorPendente
      }

      return {
        mesReferencia: monthReference,
        mesLabel: formatMonthReferenceLabel(monthReference),
        quantidadeVendas: competencia.quantidadeVendas,
        quantidadeMensalidadesSubsequentes: competencia.quantidadeMensalidadesSubsequentes,
        valorAdesaoMes,
        valorMensalidadeSubsequenteMes,
        mesReferenciaBaseMensalidade,
        mesLabelBaseMensalidade,
        valorTotal,
        valorPagoRegistrado,
        valorPendente,
        pago,
        pagamentoId: pagamento?.id || null,
        pagoEm: pagamento?.pago_em || null,
        comprovanteUrl: pagamento?.comprovante_url || null,
        comprovantePath: pagamento?.comprovante_path || null,
        observacao: pagamento?.observacao || null,
      }
    })

  return {
    totalVendasPagas,
    comissaoMesAtualBruta: roundCurrency(comissaoMesAtualBruta),
    comissaoMesAtualPaga: roundCurrency(comissaoMesAtualPaga),
    comissaoMesAtualPendente: roundCurrency(comissaoMesAtualPendente),
    comissaoTotalBruta: roundCurrency(comissaoTotalBruta),
    comissaoTotalPaga: roundCurrency(comissaoTotalPaga),
    comissaoTotalDevida: roundCurrency(comissaoTotalDevida),
    comissoesMensais,
  }
}

/**
 * Builds a commission summary for an instituto.
 * Instituto clients have sem_adesao=true so there is no adesão commission.
 * This wraps buildComissaoResumo with percentualAdesao forced to 0.
 */
export function buildInstitutoComissaoResumo(
  cadastros: CadastroComissaoBase[],
  pagamentos: PagamentoComissaoBase[],
  referenceDate: Date = new Date(),
  config: Pick<ComissaoConfig, 'percentualMensalidade' | 'mensalidadesMax'> = {
    percentualMensalidade: DEFAULT_COMISSAO_CONFIG.percentualMensalidade,
    mensalidadesMax: DEFAULT_COMISSAO_CONFIG.mensalidadesMax,
  }
): ComissaoResumo {
  // TODO: vitalicio mode requires mensalidades_pagas array from Asaas subscription payments
  return buildComissaoResumo(cadastros, pagamentos, referenceDate, {
    percentualAdesao: 0,
    percentualMensalidade: config.percentualMensalidade,
    mensalidadesMax: config.mensalidadesMax,
  })
}
