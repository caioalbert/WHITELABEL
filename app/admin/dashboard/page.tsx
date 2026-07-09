'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
import {
  CalendarClock,
  Download,
  Menu,
  RefreshCw,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { usePublicBranding } from '@/hooks/use-public-branding'
import { Cadastro } from '@/lib/types'

type RankingItem = {
  name: string
  shortName: string
  total: number
}

type KpiCardProps = {
  title: string
  value: number
  subtitle: string
  valueClassName: string
  icon: LucideIcon
  iconClassName: string
  valueFormatter?: (value: number) => string
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const formatCurrencyBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function KpiCard({
  title,
  value,
  subtitle,
  valueClassName,
  icon: Icon,
  iconClassName,
  valueFormatter,
}: KpiCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-gray-600 sm:text-sm">{title}</p>
          <p className={`mt-2 text-2xl font-bold sm:text-3xl ${valueClassName}`}>
            {valueFormatter ? valueFormatter(value) : value.toLocaleString('pt-BR')}
          </p>
          <p className="mt-1 text-[11px] text-gray-500 sm:text-xs">{subtitle}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${iconClassName}`}>
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
  const branding = usePublicBranding()
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

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
      router.push('/admin/login')
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

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
      const filename = filenameMatch?.[1] || 'contratos-shalom.zip'

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
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">{branding.brandName} - Admin</h1>
            <p className="text-xs text-gray-600 sm:text-sm">Dashboard de Clientes e Indicadores</p>
          </div>
          <div className="hidden flex-wrap items-center justify-end gap-2 lg:flex">
            <Link href="/admin/clientes">
              <Button variant="outline">Clientes</Button>
            </Link>
            <Link href="/admin/vendedores">
              <Button variant="outline">Vendedores</Button>
            </Link>
            <Link href="/admin/configuracoes">
              <Button variant="outline">Configurações</Button>
            </Link>
            <Button
              onClick={handleExportAllContracts}
              disabled={exportLoading || cadastros.length === 0}
              className="bg-teal-700 hover:bg-teal-800"
            >
              {exportLoading ? 'Exportando...' : 'Exportar Contratos (.zip)'}
            </Button>
            <Button onClick={handleLogout} variant="outline">
              Sair
            </Button>
          </div>

          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Menu Administrativo</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 px-4 pb-4">
                  <SheetClose asChild>
                    <Button asChild variant="outline" className="w-full justify-start">
                      <Link href="/admin/clientes">Clientes</Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button asChild variant="outline" className="w-full justify-start">
                      <Link href="/admin/vendedores">Vendedores</Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button asChild variant="outline" className="w-full justify-start">
                      <Link href="/admin/configuracoes">Configurações</Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button onClick={fetchCadastros} variant="outline" className="w-full justify-start gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Atualizar indicadores
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button
                      onClick={handleExportAllContracts}
                      disabled={exportLoading || cadastros.length === 0}
                      className="w-full justify-start bg-teal-700 hover:bg-teal-800"
                    >
                      {exportLoading ? 'Exportando...' : 'Exportar Contratos (.zip)'}
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button onClick={handleLogout} variant="outline" className="w-full justify-start">
                      Sair
                    </Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-end">
          <Button onClick={fetchCadastros} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar indicadores
          </Button>
        </div>

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
            <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
              <KpiCard
                title="Total de Clientes"
                value={summary.total}
                subtitle="Base geral de contratantes"
                valueClassName="text-gray-900"
                icon={Users}
                iconClassName="bg-slate-100 text-slate-700"
              />
              <KpiCard
                title="Clientes Hoje"
                value={summary.today}
                subtitle="Entradas registradas hoje"
                valueClassName="text-cyan-700"
                icon={CalendarClock}
                iconClassName="bg-cyan-100 text-cyan-700"
              />
              <KpiCard
                title="Últimos 7 Dias"
                value={summary.last7Days}
                subtitle="Volume da semana atual"
                valueClassName="text-blue-700"
                icon={RefreshCw}
                iconClassName="bg-blue-100 text-blue-700"
              />
              <KpiCard
                title="Mês Atual"
                value={summary.currentMonth}
                subtitle="Clientes no mês corrente"
                valueClassName="text-indigo-700"
                icon={Download}
                iconClassName="bg-indigo-100 text-indigo-700"
              />
            </div>

            <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-5">
              <KpiCard
                title="Com Dependentes"
                value={summary.withDependentes}
                subtitle="Titulares com família vinculada"
                valueClassName="text-green-700"
                icon={Users}
                iconClassName="bg-green-100 text-green-700"
              />
              <KpiCard
                title="Clientes em Dia"
                value={summary.clientesEmDia}
                subtitle="Base ativa adimplente"
                valueClassName="text-emerald-700"
                icon={Users}
                iconClassName="bg-emerald-100 text-emerald-700"
              />
              <KpiCard
                title="Clientes em Atraso"
                value={summary.clientesEmAtraso}
                subtitle="Soma de pendências financeiras"
                valueClassName="text-rose-700"
                icon={RefreshCw}
                iconClassName="bg-rose-100 text-rose-700"
              />
              <KpiCard
                title="Adesões Não Pagas"
                value={summary.adesoesNaoPagas}
                subtitle="Cadastros sem pagamento inicial"
                valueClassName="text-amber-700"
                icon={CalendarClock}
                iconClassName="bg-amber-100 text-amber-700"
              />
              <KpiCard
                title="Mensalidades Atrasadas"
                value={summary.mensalidadesAtrasadas}
                subtitle="Assinaturas com cobrança vencida"
                valueClassName="text-red-700"
                icon={Download}
                iconClassName="bg-red-100 text-red-700"
              />
            </div>

            <div className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <KpiCard
                title="Receitas Mês"
                value={financeiroResumo.receitaMesAtual}
                subtitle="Soma das adesões pagas no mês atual"
                valueClassName="text-teal-700"
                icon={Download}
                iconClassName="bg-teal-100 text-teal-700"
                valueFormatter={formatCurrencyBRL}
              />
              <KpiCard
                title="Comissões Pagas Mês"
                value={financeiroResumo.comissoesPagasMesAtual}
                subtitle="Pagamentos de comissão registrados no mês"
                valueClassName="text-fuchsia-700"
                icon={RefreshCw}
                iconClassName="bg-fuchsia-100 text-fuchsia-700"
                valueFormatter={formatCurrencyBRL}
              />
            </div>

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
                        stroke="#0f766e"
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2, fill: '#0f766e' }}
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
                        <Bar dataKey="total" fill="#059669" radius={[0, 8, 8, 0]} />
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
