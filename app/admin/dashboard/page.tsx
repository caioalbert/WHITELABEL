'use client'

import { AdminPageHeader } from '@/components/admin/page-header'

import { Button } from '@/components/ui/button'
import { Cadastro } from '@/lib/types'
import {
  CalendarClock,
  Download,
  RefreshCw,
  Users,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type RankingItem = {
  name: string
  shortName: string
  total: number
}

type KpiCardProps = {
  title: string
  value: number
  subtitle: string
  icon: LucideIcon
  valueFormatter?: (value: number) => string
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const formatCurrencyBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  valueFormatter,
}: KpiCardProps) {
  return (
    <div className="admin-kpi">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="admin-kpi-title">{title}</p>
          <p className="admin-kpi-value">
            {valueFormatter ? valueFormatter(value) : value.toLocaleString('pt-BR')}
          </p>
          <p className="admin-kpi-note">{subtitle}</p>
        </div>
        <div className="admin-kpi-icon">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function truncateLabel(value: string, maxLength = 20) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 1)}…`
}

function parseDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

function buildRanking(values: Array<string | undefined>, fallbackLabel: string): RankingItem[] {
  const counts = new Map<string, number>()

  values.forEach((rawValue) => {
    const normalizedValue = rawValue?.trim() || fallbackLabel
    counts.set(normalizedValue, (counts.get(normalizedValue) || 0) + 1)
  })

  return Array.from(counts.entries())
    .map(([name, total]) => ({
      name,
      shortName: truncateLabel(name),
      total,
    }))
    .sort((a, b) => b.total - a.total)
}

export default function AdminDashboard() {
  const router = useRouter()
  const [cadastros, setCadastros] = useState<Cadastro[]>([])
  const [dependentesCount, setDependentesCount] = useState(0)
  const [financeiroResumo, setFinanceiroResumo] = useState({
    receitaMesAtual: 0,
    comissoesPagasMesAtual: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exportLoading, setExportLoading] = useState(false)

  const fetchCadastros = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/admin/cadastros?includeFinance=true&includeDependentes=true')

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login')
          return
        }
        throw new Error('Erro ao carregar clientes')
      }

      const data = await response.json()
      setCadastros(data.cadastros || [])
      setDependentesCount((data.dependentes || []).length)
      setFinanceiroResumo({
        receitaMesAtual: Number(data.financeiroResumo?.receitaMesAtual || 0),
        comissoesPagasMesAtual: Number(data.financeiroResumo?.comissoesPagasMesAtual || 0),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchCadastros()
  }, [fetchCadastros])

  const handleExportAllContracts = async () => {
    try {
      setExportLoading(true)
      setError(null)

      const response = await fetch('/api/admin/exportar-contratos')

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login')
          return
        }

        let message = 'Erro ao exportar contratos'
        try {
          const data = await response.json()
          message = data.error || message
        } catch {
          // ignore parse error
        }
        throw new Error(message)
      }

      const blob = await response.blob()
      const contentDisposition = response.headers.get('content-disposition')
      const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/)
      const filename = filenameMatch?.[1] || 'contratos-novaalianca.zip'

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao exportar contratos')
    } finally {
      setExportLoading(false)
    }
  }

  const summary = useMemo(() => {
    const now = new Date()
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const start7Days = new Date(startToday)
    start7Days.setDate(startToday.getDate() - 6)

    const start30Days = new Date(startToday)
    start30Days.setDate(startToday.getDate() - 29)

    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    let withDependentes = 0
    let clientesEmDia = 0
    let adesoesNaoPagas = 0
    let mensalidadesAtrasadas = 0
    let today = 0
    let last7Days = 0
    let last30Days = 0
    let currentMonth = 0

    cadastros.forEach((cadastro) => {
      if (cadastro.tem_dependentes) withDependentes += 1

      const financeiroStatus = String(cadastro.financeiro_status || '').trim().toUpperCase()
      const statusCadastro = String(cadastro.status || '').trim().toUpperCase()

      if (financeiroStatus === 'EM_ATRASO') {
        mensalidadesAtrasadas += 1
      } else if (financeiroStatus === 'ADESAO_NAO_CONCLUIDA') {
        adesoesNaoPagas += 1
      } else if (financeiroStatus === 'EM_DIA') {
        clientesEmDia += 1
      } else if (statusCadastro === 'ATIVO') {
        // Fallback para ambientes sem integração financeira ativa.
        clientesEmDia += 1
      } else if (statusCadastro && statusCadastro !== 'ATIVO') {
        adesoesNaoPagas += 1
      }

      const createdAt = parseDate(cadastro.created_at)
      if (!createdAt) return

      if (createdAt >= startToday) today += 1
      if (createdAt >= start7Days) last7Days += 1
      if (createdAt >= start30Days) last30Days += 1
      if (createdAt >= startMonth) currentMonth += 1
    })

    return {
      total: cadastros.length + dependentesCount,
      withDependentes,
      clientesEmDia,
      clientesEmAtraso: adesoesNaoPagas + mensalidadesAtrasadas,
      adesoesNaoPagas,
      mensalidadesAtrasadas,
      today,
      last7Days,
      last30Days,
      currentMonth,
    }
  }, [cadastros, dependentesCount])

  const estadoCivilRanking = useMemo(
    () => buildRanking(cadastros.map((item) => item.estado_civil), 'Não informado'),
    [cadastros]
  )

  const monthlyTrendData = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: 6 }).map((_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
      return {
        key: `${monthDate.getFullYear()}-${monthDate.getMonth()}`,
        monthLabel: `${MONTH_LABELS[monthDate.getMonth()]} ${String(monthDate.getFullYear()).slice(-2)}`,
        total: 0,
      }
    })

    const monthKeyToIndex = new Map(months.map((item, index) => [item.key, index]))

    cadastros.forEach((cadastro) => {
      const createdAt = parseDate(cadastro.created_at)
      if (!createdAt) return

      const key = `${createdAt.getFullYear()}-${createdAt.getMonth()}`
      const monthIndex = monthKeyToIndex.get(key)

      if (monthIndex !== undefined) {
        months[monthIndex].total += 1
      }
    })

    return months
  }, [cadastros])

  const periodChartData = useMemo(
    () => [
      { period: 'Hoje', total: summary.today },
      { period: '7 dias', total: summary.last7Days },
      { period: '30 dias', total: summary.last30Days },
      { period: 'Mês atual', total: summary.currentMonth },
    ],
    [summary.currentMonth, summary.last30Days, summary.last7Days, summary.today]
  )

  const estadoCivilChartData = useMemo(() => estadoCivilRanking.slice(0, 8), [estadoCivilRanking])

  return (
    <main className="min-h-screen bg-gray-50">
      <AdminPageHeader title="Resumo" description="Clientes, pagamentos e evolução da operação."><Button onClick={fetchCadastros} variant="outline" disabled={isLoading}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button><Button onClick={handleExportAllContracts} variant="outline" disabled={exportLoading || cadastros.length === 0}><Download className="mr-2 h-4 w-4" />{exportLoading ? "Exportando…" : "Exportar contratos (.zip)"}</Button></AdminPageHeader>

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {error && (
          <div className="mb-8 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="font-medium text-red-700">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <p className="text-gray-600">Carregando clientes...</p>
          </div>
        ) : (
          <>
            <div className="admin-quick-actions"><Link href="/admin/cadastros">Consultar clientes</Link><Link href="/admin/empresas/nova">Cadastrar empresa</Link><Link href="/admin/planos">Gerenciar planos</Link></div>
<div className="admin-primary-metrics mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><KpiCard
                title="Total de Clientes"
                value={summary.total}
                subtitle="Base geral de contratantes"
                icon={Users}
              /><KpiCard
                title="Clientes em Dia"
                value={summary.clientesEmDia}
                subtitle="Base ativa adimplente"
                icon={Users}
              /><KpiCard
                title="Clientes em Atraso"
                value={summary.clientesEmAtraso}
                subtitle="Soma de pendências financeiras"
                icon={RefreshCw}
              /><KpiCard
                title="Receitas Mês"
                value={financeiroResumo.receitaMesAtual}
                subtitle="Soma das adesões pagas no mês atual"
                icon={Download}
                valueFormatter={formatCurrencyBRL}
              /></div>
<div className="admin-stat-strip">
              <div><p>Entradas hoje</p><strong>{summary.today.toLocaleString('pt-BR')}</strong></div>
              <div><p>Últimos 7 dias</p><strong>{summary.last7Days.toLocaleString('pt-BR')}</strong></div>
              <div><p>Cadastros no mês</p><strong>{summary.currentMonth.toLocaleString('pt-BR')}</strong></div>
              <div><p>Titulares com dependentes</p><strong>{summary.withDependentes.toLocaleString('pt-BR')}</strong></div>
            </div>
            <h2 className="mb-4 text-lg font-semibold">Acompanhamento financeiro</h2>
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"><KpiCard
                title="Adesões Não Pagas"
                value={summary.adesoesNaoPagas}
                subtitle="Cadastros sem pagamento inicial"
                icon={CalendarClock}
              /><KpiCard
                title="Mensalidades Atrasadas"
                value={summary.mensalidadesAtrasadas}
                subtitle="Assinaturas com cobrança vencida"
                icon={Download}
              /><KpiCard
                title="Comissões Pagas Mês"
                value={financeiroResumo.comissoesPagasMesAtual}
                subtitle="Pagamentos de comissão registrados no mês"
                icon={RefreshCw}
                valueFormatter={formatCurrencyBRL}
              /></div>
            <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Clientes por Período (6 meses)</h2>
                <p className="text-sm text-gray-600">Evolução mensal da base de adesões</p>
              </div>

              {summary.total === 0 ? (
                <div className="flex h-72 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
                  Sem dados para exibir gráfico.
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyTrendData} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(value: number | string) => [Number(value).toLocaleString('pt-BR'), 'Clientes']}
                      />
                      <Line
                        type="monotone"
                        dataKey="total"
                        stroke="#0066cc"
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2, fill: '#0066cc' }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Recorte Rápido</h2>
                <p className="text-sm text-gray-600">Clientes acumulados por janela de tempo</p>
              </div>

              {summary.total === 0 ? (
                <div className="flex h-72 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
                  Sem dados para exibir gráfico.
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={periodChartData} margin={{ top: 8, right: 10, left: -15, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="period" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(value: number | string) => [Number(value).toLocaleString('pt-BR'), 'Clientes']}
                      />
                      <Bar dataKey="total" fill="#0284c7" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <div className="mb-8 grid grid-cols-1 gap-6">
              <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Clientes por Estado Civil</h2>
                    <p className="text-sm text-gray-600">Distribuição dos perfis civis cadastrados</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                    {estadoCivilRanking.length} categorias
                  </div>
                </div>

                {estadoCivilChartData.length === 0 ? (
                  <div className="flex h-80 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
                    Nenhum dado de estado civil cadastrado.
                  </div>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={estadoCivilChartData}
                        layout="vertical"
                        margin={{ top: 8, right: 18, left: 18, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                        <YAxis
                          dataKey="shortName"
                          type="category"
                          width={140}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          formatter={(value: number | string) => [Number(value).toLocaleString('pt-BR'), 'Clientes']}
                          labelFormatter={(label, payload) => {
                            if (!payload || payload.length === 0) return label
                            return payload[0].payload.name
                          }}
                        />
                        <Bar dataKey="total" fill="#0066cc" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>
            </div>

          </>
        )}
      </div>
    </main>
  )
}
