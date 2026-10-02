'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Download,
  HeartPulse,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Settings,
  ShieldCheck,
  TriangleAlert,
  UserRoundCheck,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { usePublicBranding } from '@/hooks/use-public-branding'
import { Cadastro } from '@/lib/types'

type DashboardMetricProps = {
  title: string
  value: number
  description: string
  icon: LucideIcon
  tone: 'teal' | 'blue' | 'violet' | 'amber'
}

type PlanDistributionItem = {
  code: string
  label: string
  total: number
  percentage: number
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const TONE_STYLES = {
  teal: { icon: 'bg-teal-50 text-teal-700 ring-teal-100', accent: 'from-teal-500 to-emerald-500' },
  blue: { icon: 'bg-blue-50 text-blue-700 ring-blue-100', accent: 'from-blue-500 to-cyan-500' },
  violet: { icon: 'bg-violet-50 text-violet-700 ring-violet-100', accent: 'from-violet-500 to-fuchsia-500' },
  amber: { icon: 'bg-amber-50 text-amber-700 ring-amber-100', accent: 'from-amber-400 to-orange-500' },
} as const

const PLAN_LABELS: Record<string, string> = {
  INDIVIDUAL: 'Individual',
  FAMILIAR: 'Familiar',
  'PLANO-EMPRESARIAL': 'Empresarial',
  EMPRESARIAL: 'Empresarial',
}

const NAV_ITEMS = [
  { href: '/admin/clientes', label: 'Clientes', icon: UsersRound },
  { href: '/admin/empresas', label: 'Empresas', icon: BriefcaseBusiness },
  { href: '/admin/vendedores', label: 'Vendedores', icon: UserRoundCheck },
  { href: '/admin/planos', label: 'Planos', icon: CircleDollarSign },
  { href: '/admin/configuracoes', label: 'Configurações', icon: Settings },
] as const

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value?: string | null) {
  const date = parseDate(value)
  if (!date) return 'Data não informada'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function formatToday() {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date())
}

function DashboardMetric({ title, value, description, icon: Icon, tone }: DashboardMetricProps) {
  const styles = TONE_STYLES[tone]
  return (
    <Card className="relative gap-4 overflow-hidden border-slate-200/80 py-5 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.45)] transition-transform duration-200 hover:-translate-y-0.5">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${styles.accent}`} />
      <CardHeader className="flex-row items-start justify-between gap-4 px-5">
        <div className="space-y-1.5">
          <CardDescription className="font-medium text-slate-500">{title}</CardDescription>
          <CardTitle className="text-3xl font-bold tracking-tight text-slate-950">{value.toLocaleString('pt-BR')}</CardTitle>
        </div>
        <div className={`rounded-2xl p-3 ring-1 ${styles.icon}`}><Icon className="h-5 w-5" aria-hidden="true" /></div>
      </CardHeader>
      <CardContent className="px-5"><p className="text-xs leading-relaxed text-slate-500">{description}</p></CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Carregando indicadores">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-40 rounded-2xl bg-slate-200/70" />)}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
        <Skeleton className="h-[390px] rounded-2xl bg-slate-200/70" />
        <Skeleton className="h-[390px] rounded-2xl bg-slate-200/70" />
      </div>
    </div>
  )
}

function StatusBadge({ cadastro }: { cadastro: Cadastro }) {
  const status = String(cadastro.status || '').trim().toUpperCase()
  const financeiroStatus = String(cadastro.financeiro_status || '').trim().toUpperCase()
  if (financeiroStatus === 'EM_ATRASO') return <Badge className="border-rose-200 bg-rose-50 text-rose-700">Em atraso</Badge>
  if (status === 'ATIVO') return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Ativo</Badge>
  return <Badge className="border-amber-200 bg-amber-50 text-amber-700">Pendente</Badge>
}

export default function AdminDashboard() {
  const router = useRouter()
  const branding = usePublicBranding()
  const [cadastros, setCadastros] = useState<Cadastro[]>([])
  const [dependentesCount, setDependentesCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exportLoading, setExportLoading] = useState(false)

  const fetchCadastros = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/admin/cadastros?includeDependentes=true')
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login')
          return
        }
        throw new Error('Não foi possível carregar os indicadores.')
      }
      const data = await response.json()
      setCadastros(data.cadastros || [])
      setDependentesCount((data.dependentes || []).length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => { fetchCadastros() }, [fetchCadastros])

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
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Erro ao exportar contratos')
      }
      const blob = await response.blob()
      const contentDisposition = response.headers.get('content-disposition')
      const filenameMatch = contentDisposition?.match(/filename="?([^";]+)"?/)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filenameMatch?.[1] || 'contratos-novaalianca.zip'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao exportar contratos')
    } finally {
      setExportLoading(false)
    }
  }

  const summary = useMemo(() => {
    let activeHolders = 0
    let pendingRegistrations = 0
    let overduePayments = 0
    let incompleteDependentRecords = 0
    cadastros.forEach((cadastro) => {
      const status = String(cadastro.status || '').trim().toUpperCase()
      const financialStatus = String(cadastro.financeiro_status || '').trim().toUpperCase()
      if (status === 'ATIVO') activeHolders += 1
      else pendingRegistrations += 1
      if (financialStatus === 'EM_ATRASO') overduePayments += 1
      incompleteDependentRecords += Number(cadastro.dependentes_sem_rg_count || 0)
      incompleteDependentRecords += Number(cadastro.dependentes_sem_email_count || 0)
    })
    return {
      totalLives: cadastros.length + dependentesCount,
      activeHolders,
      dependentes: dependentesCount,
      pendingRegistrations,
      overduePayments,
      incompleteDependentRecords,
      attentionItems: pendingRegistrations + overduePayments + incompleteDependentRecords,
    }
  }, [cadastros, dependentesCount])

  const monthlyTrendData = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
      return { key: `${date.getFullYear()}-${date.getMonth()}`, month: MONTH_LABELS[date.getMonth()], titulares: 0 }
    })
    const monthIndex = new Map(months.map((item, index) => [item.key, index]))
    cadastros.forEach((cadastro) => {
      const createdAt = parseDate(cadastro.created_at)
      if (!createdAt) return
      const index = monthIndex.get(`${createdAt.getFullYear()}-${createdAt.getMonth()}`)
      if (index !== undefined) months[index].titulares += 1
    })
    return months
  }, [cadastros])

  const planDistribution = useMemo<PlanDistributionItem[]>(() => {
    const counts = new Map<string, number>()
    cadastros.forEach((cadastro) => {
      const code = String(cadastro.tipo_plano || 'NAO_INFORMADO').trim().toUpperCase()
      counts.set(code, (counts.get(code) || 0) + 1)
    })
    return Array.from(counts.entries())
      .map(([code, total]) => ({ code, label: PLAN_LABELS[code] || 'Não informado', total, percentage: cadastros.length ? Math.round((total / cadastros.length) * 100) : 0 }))
      .sort((a, b) => b.total - a.total)
  }, [cadastros])

  const recentCadastros = useMemo(
    () => [...cadastros].sort((a, b) => (parseDate(b.created_at)?.getTime() || 0) - (parseDate(a.created_at)?.getTime() || 0)).slice(0, 5),
    [cadastros]
  )

  return (
    <main className="min-h-screen bg-[#f5f7f8] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/admin/dashboard" className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-teal-700 text-white shadow-lg shadow-teal-700/20"><HeartPulse className="h-5 w-5" aria-hidden="true" /></span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold tracking-tight text-slate-950">{branding.brandName}</span>
              <span className="block text-xs text-slate-500">Painel administrativo</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação administrativa">
            {NAV_ITEMS.map((item) => (
              <Button key={item.href} asChild variant="ghost" size="sm" className="text-slate-600 hover:bg-slate-100 hover:text-slate-950"><Link href={item.href}>{item.label}</Link></Button>
            ))}
            <span className="mx-2 h-6 w-px bg-slate-200" />
            <Button onClick={handleLogout} variant="ghost" size="sm" className="text-slate-500">Sair</Button>
          </nav>
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild><Button variant="outline" size="icon" aria-label="Abrir menu administrativo" className="rounded-xl"><Menu className="h-5 w-5" /></Button></SheetTrigger>
              <SheetContent side="right">
                <SheetHeader><SheetTitle>Menu administrativo</SheetTitle></SheetHeader>
                <div className="flex flex-col gap-2 px-4 pb-4">
                  {NAV_ITEMS.map((item) => (
                    <SheetClose key={item.href} asChild><Button asChild variant="ghost" className="w-full justify-start gap-3"><Link href={item.href}><item.icon className="h-4 w-4" />{item.label}</Link></Button></SheetClose>
                  ))}
                  <SheetClose asChild><Button onClick={handleLogout} variant="outline" className="mt-3 w-full justify-start">Sair</Button></SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section className="relative mb-6 overflow-hidden rounded-[28px] bg-[linear-gradient(125deg,#0f172a_0%,#123f43_52%,#0f766e_100%)] px-6 py-7 text-white shadow-[0_24px_70px_-36px_rgba(15,118,110,0.8)] sm:px-8 sm:py-9">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-teal-300/15 blur-3xl" />
          <div className="absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <div className="mb-4 flex items-center gap-2 text-xs font-medium text-teal-100"><LayoutDashboard className="h-4 w-4" />Visão geral da operação<span className="h-1 w-1 rounded-full bg-teal-200/70" /><span className="capitalize">{formatToday()}</span></div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tudo que importa, em uma única visão.</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-200 sm:text-base">Acompanhe a base de beneficiários e identifique rapidamente o que precisa de atenção.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={fetchCadastros} disabled={isLoading} className="gap-2 rounded-xl bg-white text-slate-900 hover:bg-slate-100"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Atualizar</Button>
              <Button onClick={handleExportAllContracts} disabled={exportLoading || cadastros.length === 0} variant="outline" className="gap-2 rounded-xl border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"><Download className="h-4 w-4" />{exportLoading ? 'Exportando...' : 'Exportar contratos'}</Button>
            </div>
          </div>
        </section>

        {error && (
          <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div><p className="font-semibold">Não foi possível atualizar o painel</p><p className="mt-0.5 text-sm text-rose-700">{error}</p></div>
          </div>
        )}

        {isLoading ? <DashboardSkeleton /> : (
          <div className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores principais">
              <DashboardMetric title="Vidas cobertas" value={summary.totalLives} description="Titulares e dependentes na base" icon={Users} tone="teal" />
              <DashboardMetric title="Titulares ativos" value={summary.activeHolders} description={`${cadastros.length.toLocaleString('pt-BR')} titulares cadastrados`} icon={ShieldCheck} tone="blue" />
              <DashboardMetric title="Dependentes" value={summary.dependentes} description="Pessoas vinculadas aos titulares" icon={UsersRound} tone="violet" />
              <DashboardMetric title="Itens de atenção" value={summary.attentionItems} description="Cadastros, cobranças ou dados pendentes" icon={TriangleAlert} tone="amber" />
            </section>

            {summary.attentionItems > 0 ? (
              <section className="grid gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-100 text-amber-700"><TriangleAlert className="h-5 w-5" /></div>
                <div><h2 className="font-semibold text-slate-900">A operação tem itens que merecem atenção</h2><p className="mt-1 text-sm text-slate-600">{summary.pendingRegistrations} cadastros pendentes · {summary.overduePayments} cobranças atrasadas · {summary.incompleteDependentRecords} campos de dependentes incompletos</p></div>
                <Button asChild variant="outline" className="justify-self-start rounded-xl border-amber-300 bg-white md:justify-self-end"><Link href="/admin/clientes">Revisar clientes <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
              </section>
            ) : (
              <section className="flex items-center gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-4"><CheckCircle2 className="h-5 w-5 text-emerald-700" /><p className="text-sm font-medium text-emerald-900">Nenhuma pendência operacional identificada neste momento.</p></section>
            )}

            <div className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
              <Card className="border-slate-200/80 shadow-[0_12px_40px_-30px_rgba(15,23,42,0.45)]">
                <CardHeader className="flex-row items-start justify-between gap-4">
                  <div><CardTitle className="text-lg text-slate-950">Evolução da base</CardTitle><CardDescription className="mt-1">Novos titulares nos últimos seis meses</CardDescription></div>
                  <div className="rounded-xl bg-teal-50 p-2.5 text-teal-700"><Activity className="h-5 w-5" /></div>
                </CardHeader>
                <CardContent>
                  {cadastros.length === 0 ? <div className="grid h-64 place-items-center rounded-xl bg-slate-50 text-sm text-slate-500">Sem dados para exibir.</div> : (
                    <div className="h-64 w-full sm:h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyTrendData} margin={{ top: 12, right: 10, left: -22, bottom: 0 }}>
                          <defs><linearGradient id="cadastrosGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0f766e" stopOpacity={0.3} /><stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} /></linearGradient></defs>
                          <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                          <Tooltip cursor={{ stroke: '#99f6e4', strokeWidth: 1 }} contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', boxShadow: '0 12px 30px -18px rgba(15,23,42,.4)' }} formatter={(value: number | string) => [Number(value).toLocaleString('pt-BR'), 'Titulares']} />
                          <Area type="monotone" dataKey="titulares" stroke="#0f766e" strokeWidth={3} fill="url(#cadastrosGradient)" activeDot={{ r: 5, fill: '#0f766e', stroke: '#fff', strokeWidth: 2 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 shadow-[0_12px_40px_-30px_rgba(15,23,42,0.45)]">
                <CardHeader><CardTitle className="text-lg text-slate-950">Composição por plano</CardTitle><CardDescription>Distribuição atual dos titulares</CardDescription></CardHeader>
                <CardContent className="space-y-6">
                  {planDistribution.length === 0 ? <div className="grid h-48 place-items-center rounded-xl bg-slate-50 text-sm text-slate-500">Nenhum plano encontrado.</div> : planDistribution.map((item, index) => (
                    <div key={item.code} className="space-y-2.5">
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <div className="flex items-center gap-2.5 font-medium text-slate-700"><span className={`h-2.5 w-2.5 rounded-full ${index === 0 ? 'bg-teal-600' : index === 1 ? 'bg-blue-500' : 'bg-violet-500'}`} />{item.label}</div>
                        <span className="font-semibold tabular-nums text-slate-950">{item.total} <span className="font-normal text-slate-400">({item.percentage}%)</span></span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${index === 0 ? 'bg-teal-600' : index === 1 ? 'bg-blue-500' : 'bg-violet-500'}`} style={{ width: `${Math.max(item.percentage, 3)}%` }} /></div>
                    </div>
                  ))}
                  <Button asChild variant="outline" className="w-full rounded-xl"><Link href="/admin/planos">Gerenciar planos <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
              <Card className="border-slate-200/80 shadow-[0_12px_40px_-30px_rgba(15,23,42,0.45)]">
                <CardHeader className="flex-row items-start justify-between gap-4">
                  <div><CardTitle className="text-lg text-slate-950">Cadastros recentes</CardTitle><CardDescription className="mt-1">Últimos titulares adicionados à base</CardDescription></div>
                  <Button asChild variant="ghost" size="sm" className="text-teal-700 hover:bg-teal-50 hover:text-teal-800"><Link href="/admin/clientes">Ver todos <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
                </CardHeader>
                <CardContent>
                  {recentCadastros.length === 0 ? <div className="grid h-48 place-items-center rounded-xl bg-slate-50 text-sm text-slate-500">Nenhum cadastro encontrado.</div> : (
                    <div className="divide-y divide-slate-100">
                      {recentCadastros.map((cadastro) => (
                        <Link key={cadastro.id} href={`/admin/cadastro/${cadastro.id}`} className="group flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 group-hover:bg-teal-50 group-hover:text-teal-700">{cadastro.nome?.trim().charAt(0).toUpperCase() || '?'}</div>
                          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900 group-hover:text-teal-700">{cadastro.nome}</p><p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(cadastro.created_at)}</p></div>
                          <StatusBadge cadastro={cadastro} />
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 shadow-[0_12px_40px_-30px_rgba(15,23,42,0.45)]">
                <CardHeader><CardTitle className="text-lg text-slate-950">Acessos rápidos</CardTitle><CardDescription>Atalhos para as tarefas mais frequentes</CardDescription></CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {[
                    { href: '/admin/clientes', label: 'Gerenciar clientes', description: 'Consultar cadastros e dependentes', icon: UsersRound, color: 'bg-teal-50 text-teal-700' },
                    { href: '/admin/empresas', label: 'Gerenciar empresas', description: 'Acompanhar contratos empresariais', icon: BriefcaseBusiness, color: 'bg-blue-50 text-blue-700' },
                    { href: '/admin/vendedores', label: 'Equipe comercial', description: 'Vendedores, indicações e comissões', icon: UserRoundCheck, color: 'bg-violet-50 text-violet-700' },
                  ].map((item) => (
                    <Link key={item.href} href={item.href} className="group flex items-center gap-3 rounded-2xl border border-slate-200 p-3.5 transition-colors hover:border-teal-200 hover:bg-teal-50/40">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.color}`}><item.icon className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">{item.label}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{item.description}</span></span>
                      <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-600" />
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </div>

            <footer className="flex flex-col gap-2 border-t border-slate-200 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> Indicadores atualizados ao abrir ou atualizar o painel</span>
              <span>Somente dados operacionais confirmados são destacados.</span>
            </footer>
          </div>
        )}
      </div>
    </main>
  )
}
