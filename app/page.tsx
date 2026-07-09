'use client'

import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BrandLogo } from '@/components/brand-logo'
import { usePublicBranding } from '@/hooks/use-public-branding'
import {
  BadgeCheck,
  Brain,
  Building2,
  CalendarCheck,
  Check,
  ChevronRight,
  FileCheck2,
  FileText,
  Fingerprint,
  HeartPulse,
  Lock,
  Menu,
  MessageCircle,
  MonitorSmartphone,
  Phone,
  ShieldCheck,
  Star,
  Stethoscope,
  Users,
  UserCircle2,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'

type Audience = 'cliente' | 'empresa'

type PlanOption = {
  codigo: string
  nome: string
  descricao: string
  beneficios: Array<{ texto: string; inclui: boolean }>
  valor: number
  permiteDependentes: boolean
  minDependentes: number
  maxDependentes: number | null
  valorDependenteAdicional: number
}

type AudienceBenefit = {
  Icon: LucideIcon
  label: string
  badge?: string
  highlight?: boolean
}

const STATS = [
  { value: '14', label: 'Especialidades médicas' },
  { value: '24h', label: 'Telemedicina disponível' },
  { value: '100%', label: 'Digital e sem papel' },
  { value: '5min', label: 'Para completar cadastro' },
]

const BENEFITS = [
  {
    title: 'Cadastro 100% digital',
    description: 'Processo rápido, seguro e sem papel. Faça de qualquer lugar.',
    icon: ShieldCheck,
    color: 'teal',
  },
  {
    title: 'Identidade validada',
    description: 'Dados cadastrais revisados antes da confirmação.',
    icon: Lock,
    color: 'sky',
  },
  {
    title: 'Termo digital online',
    description: 'Documento pronto para download imediato após o cadastro.',
    icon: FileCheck2,
    color: 'blue',
  },
  {
    title: 'Gestão de dependentes',
    description: 'Inclusão de familiares no mesmo fluxo de cadastro.',
    icon: Users,
    color: 'emerald',
  },
  {
    title: 'Telemedicina 24h',
    description: 'Consultas médicas online sem hora marcada, a qualquer hora.',
    icon: HeartPulse,
    color: 'rose',
  },
  {
    title: 'Receita e atestado digital',
    description: 'Receba documentos médicos digitais de forma prática.',
    icon: FileText,
    color: 'violet',
  },
]

const SPECIALTIES = [
  'Cardiologia', 'Ortopedia', 'Otorrinolaringologia', 'Nutrição',
  'Dermatologia', 'Geriatria', 'Neurologia', 'Psiquiatria',
  'Traumatologia', 'Urologia', 'Psicologia', 'Endocrinologia',
  'Ginecologia', 'Pediatria',
]

const STEPS = [
  { number: '01', title: 'Escolha seu plano', description: 'Selecione o plano que melhor atende você e sua família.' },
  { number: '02', title: 'Preencha seus dados', description: 'Nome, CPF, endereço e informações dos dependentes.' },
  { number: '03', title: 'Assine o termo', description: 'Revise e assine digitalmente o termo de adesão.' },
  { number: '04', title: 'Pronto!', description: 'Cadastro confirmado. Acesse seus benefícios imediatamente.' },
]

const NAV_ITEMS = [
  ['#inicio', 'Início'],
  ['#planos', 'Planos'],
  ['#servicos', 'Como funciona'],
  ['#beneficios', 'Benefícios'],
  ['#contato', 'Contato'],
]

const AUDIENCE_BENEFITS: Record<Audience, AudienceBenefit[]> = {
  cliente: [
    {
      Icon: Star,
      label: 'Clube de vantagens SHALOM',
      badge: 'Novidade',
      highlight: true,
    },
    { Icon: HeartPulse, label: 'Urgência 24h' },
    { Icon: Fingerprint, label: 'Identificação biométrica' },
    { Icon: CalendarCheck, label: 'Tratamento planejado e com hora marcada' },
    { Icon: MonitorSmartphone, label: 'Marcação de consultas online' },
    { Icon: Building2, label: 'Ampla rede de clínicas próprias e credenciadas' },
  ],
  empresa: [
    {
      Icon: Star,
      label: 'Clube de vantagens empresarial',
      badge: 'Novidade',
      highlight: true,
    },
    { Icon: Users, label: 'Gestão de colaboradores' },
    { Icon: Brain, label: 'Saúde mental para a equipe' },
    { Icon: HeartPulse, label: 'Telemedicina 24h' },
    { Icon: CalendarCheck, label: 'Consultas agendadas sem burocracia' },
    { Icon: Building2, label: 'Rede credenciada em todo o Brasil' },
  ],
}

const colorMap: Record<string, { bg: string; icon: string; border: string }> = {
  teal:    { bg: 'bg-teal-50',    icon: 'bg-teal-100 text-teal-700',    border: 'border-teal-100' },
  sky:     { bg: 'bg-sky-50',     icon: 'bg-sky-100 text-sky-700',      border: 'border-sky-100' },
  blue:    { bg: 'bg-blue-50',    icon: 'bg-blue-100 text-blue-700',    border: 'border-blue-100' },
  emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-100' },
  rose:    { bg: 'bg-rose-50',    icon: 'bg-rose-100 text-rose-600',    border: 'border-rose-100' },
  violet:  { bg: 'bg-violet-50',  icon: 'bg-violet-100 text-violet-700', border: 'border-violet-100' },
}

export default function Home() {
  const [planos, setPlanos] = useState<PlanOption[]>([])
  const [isLoadingPlanos, setIsLoadingPlanos] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeTab, setActiveTab] = useState<Audience>('empresa')
  const branding = usePublicBranding()
  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const fetchPlanos = async () => {
      try {
        const response = await fetch('/api/cadastro/cobranca-configuracoes', { cache: 'no-store' })
        const payload = await response.json().catch(() => null)
        if (response.ok && Array.isArray(payload?.planos)) {
          setPlanos(payload.planos.filter((p: PlanOption) => p.valor > 0))
        }
      } catch (error) {
        console.error('Erro ao carregar planos:', error)
      } finally {
        setIsLoadingPlanos(false)
      }
    }
    fetchPlanos()
  }, [])

  return (
    <main className="min-h-screen overflow-x-hidden bg-white font-sans">
      {/*  HEADER  */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur-md'
            : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" className="shrink-0">
            <BrandLogo
              width={180}
              height={58}
              priority
              className="h-12 w-auto"
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-7 text-sm font-medium text-gray-600 md:flex">
            {NAV_ITEMS.map(([href, label]) => (
              <a key={href} href={href} className="transition-colors hover:text-teal-700">{label}</a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link href="/cadastro">
              <Button className="rounded-full bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-teal-800 hover:shadow-lg">
                Faça seu plano
              </Button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="rounded-lg p-2 text-gray-600 md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t border-gray-100 bg-white px-5 pb-4 md:hidden">
            <nav className="flex flex-col gap-1 py-2">
              {NAV_ITEMS.map(([href, label]) => (
                <a
                  key={href} href={href}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-teal-700"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {label}
                </a>
              ))}
            </nav>
            <Link href="/cadastro" onClick={() => setMobileMenuOpen(false)}>
              <Button className="mt-2 w-full rounded-full bg-teal-700 py-3 text-sm font-semibold text-white">
                Faça seu plano
              </Button>
            </Link>
          </div>
        )}
      </header>

      {/*  HERO  */}
      <section
        id="inicio"
        className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 pt-20"
      >
        {/* Background decorations */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />
          <div className="absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-teal-400/5 blur-3xl" />
        </div>

        <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-7xl flex-col items-center justify-center px-5 py-16 sm:px-8 lg:px-12 lg:flex-row lg:gap-16">
          {/* Left - Text */}
          <div className="max-w-2xl flex-1 space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 text-sm font-medium text-teal-300">
              <Zap className="h-3.5 w-3.5" />
              <span>Cadastro 100% digital e seguro</span>
            </div>

            <div className="space-y-4">
              <h1 className="text-5xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl">
                Sua Saúde{' '}
                <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                  Completa
                </span>{' '}
                e Segura.
              </h1>
              <p className="text-lg leading-relaxed text-slate-300 sm:text-xl">
                Acesso à telemedicina, saúde mental, especialidades médicas e muito mais.
                Cadastre-se em minutos e cuide de quem você ama.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link href="/cadastro">
                <Button className="group w-full rounded-full bg-teal-500 px-8 py-6 text-base font-bold text-white shadow-[0_0_30px_rgba(20,184,166,0.4)] transition-all hover:-translate-y-0.5 hover:bg-teal-400 hover:shadow-[0_0_40px_rgba(20,184,166,0.6)] sm:w-auto">
                  Faça seu plano
                  <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <a href="#planos">
                <Button
                  variant="outline"
                  className="w-full rounded-full border-white/20 bg-white/5 px-8 py-6 text-base font-semibold text-white backdrop-blur transition-all hover:bg-white/10 sm:w-auto"
                >
                  Ver planos
                </Button>
              </a>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2 lg:justify-start">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                <Lock className="h-3.5 w-3.5 text-teal-400" /> Conforme LGPD
              </span>
              <span className="h-1 w-1 rounded-full bg-slate-700" />
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                <BadgeCheck className="h-3.5 w-3.5 text-teal-400" /> Conexão criptografada
              </span>
              <span className="h-1 w-1 rounded-full bg-slate-700" />
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-teal-400" /> Dados protegidos
              </span>
            </div>
          </div>

          {/* Right - Service cards */}
          <div className="mt-10 w-full max-w-sm flex-shrink-0 lg:mt-0 lg:max-w-md">
            <div className="space-y-3">
              {/* Telemedicina card */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-teal-500/20 p-3 text-teal-400">
                    <HeartPulse className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Telemedicina 24h</p>
                    <p className="mt-0.5 text-sm text-slate-400">Consultas online sem sair de casa, a qualquer hora.</p>
                    <div className="mt-2 flex gap-2">
                      {['Receita digital', 'Atestado', 'Urgência'].map(t => (
                        <span key={t} className="rounded-full bg-teal-500/15 px-2.5 py-0.5 text-[11px] font-medium text-teal-300">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Saúde Mental card */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-violet-500/20 p-3 text-violet-400">
                    <Brain className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Saúde mental</p>
                    <p className="mt-0.5 text-sm text-slate-400">Acesso ilimitado a psicólogos especializados.</p>
                  </div>
                </div>
              </div>

              {/* Especialidades card */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <div className="mb-3 flex items-center gap-3">
                  <div className="rounded-xl bg-sky-500/20 p-3 text-sky-400">
                    <Stethoscope className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">14 especialidades</p>
                    <p className="text-xs text-slate-400">Médicos especialistas disponíveis</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SPECIALTIES.slice(0, 8).map(s => (
                    <span key={s} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-300">{s}</span>
                  ))}
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-400">+{SPECIALTIES.length - 8} mais</span>
                </div>
              </div>

              {/* Assistência funeral */}
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-sm font-semibold text-amber-300">Assistência funeral - Grupo Zelo</p>
                <p className="mt-0.5 text-xs text-amber-400/80">Suporte especializado para sua família em momentos sensíveis.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom curve */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 60L1440 60L1440 20C1200 60 960 0 720 20C480 40 240 0 0 20L0 60Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/*  STATS BAR  */}
      <section className="bg-white py-12">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-4xl font-extrabold text-teal-700 sm:text-5xl">{stat.value}</p>
                <p className="mt-1 text-sm font-medium text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/*  DIVIDER  */}
      <div className="mx-auto w-full max-w-7xl px-5">
        <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
      </div>

      {/*  PILL TABS  */}
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="mx-auto mt-10 max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md">
          <div className="flex">
            {([
              { id: 'cliente' as const, Icon: UserCircle2, label: 'Sou', sub: 'cliente' },
              { id: 'empresa' as const, Icon: Building2, label: 'Sou', sub: 'empresa' },
            ]).map((tab, i) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-3 px-6 py-4 transition-all duration-200 ${
                  i > 0 ? 'border-l border-gray-200' : ''
                } ${
                  activeTab === tab.id
                    ? 'bg-teal-800'
                    : 'bg-white hover:bg-gray-50'
                }`}
              >
                <tab.Icon className={`h-7 w-7 shrink-0 ${
                  activeTab === tab.id ? 'text-white' : 'text-gray-700'
                }`} />
                <div className="text-left">
                  <p className={`text-xs ${activeTab === tab.id ? 'text-teal-200' : 'text-gray-400'}`}>
                    {tab.label}
                  </p>
                  <p className={`text-lg font-extrabold leading-tight ${
                    activeTab === tab.id ? 'text-white' : 'text-gray-900'
                  }`}>
                    {tab.sub}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/*  VANTAGENS SECTION  */}
      <section className="mt-0 overflow-hidden">
        {/* Dark header */}
        <div className="bg-teal-900 py-14 text-center">
          <h2 className="px-4 text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            {activeTab === 'cliente'
              ? <>Vantagens para você<br />e sua família</>
              : <>Vantagens para<br />sua empresa</>}
          </h2>
        </div>

        {/* Cards grid */}
        <div className="bg-gray-50 px-5 pb-16 pt-8 sm:px-8 lg:px-12">
          <div className="mx-auto w-full max-w-7xl">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {AUDIENCE_BENEFITS[activeTab].map((item) => {
                const itemLabel = item.label === 'Clube de vantagens SHALOM'
                  ? `Clube de vantagens ${branding.brandShortName}`
                  : item.label

                return (
                  <div
                    key={item.label}
                    className={`relative flex flex-col items-center rounded-3xl bg-white p-8 text-center shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${
                      item.highlight ? 'border-2 border-teal-100' : 'border border-gray-100'
                    }`}
                  >
                    {item.badge && (
                      <span className="absolute right-4 top-4 rounded-full bg-teal-500 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                        {item.badge}
                      </span>
                    )}
                    <div className={`mb-5 flex h-20 w-20 items-center justify-center rounded-full ${
                      item.highlight ? 'bg-teal-50' : 'bg-gray-50'
                    }`}>
                      <item.Icon className={`h-10 w-10 ${
                        item.highlight ? 'text-teal-700' : 'text-gray-800'
                      }`} strokeWidth={1.5} />
                    </div>
                    <p className="text-sm font-semibold leading-snug text-gray-800">{itemLabel}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/*  CTA BANNER  */}
      <section className="bg-teal-800 py-16 text-center">
        <div className="mx-auto w-full max-w-3xl px-5">
          <h2 className="text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            Encontre especialistas em nossa<br />
            rede credenciada por todo o Brasil
          </h2>
          <div className="mt-8">
            <Link href="/cadastro">
              <Button className="rounded-full bg-teal-600 px-8 py-6 text-base font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-teal-500">
                Ver rede completa <ChevronRight className="ml-1 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/*  AUDIENCE CARDS  */}
      <section className="bg-white py-16">
        <div className="mx-auto w-full max-w-5xl px-5 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Empresa card */}
            <div className="flex items-center gap-5 rounded-3xl border border-gray-100 bg-white p-8 shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gray-50">
                <Building2 className="h-12 w-12 text-gray-800" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-xl font-extrabold leading-tight text-gray-900">
                  Planos para<br />sua empresa
                </h3>
                <Link href="/cadastro">
                  <Button className="mt-4 rounded-full bg-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-500">
                    Faça seu plano <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Família card */}
            <div className="flex items-center gap-5 rounded-3xl border border-gray-100 bg-white p-8 shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gray-50">
                <Users className="h-12 w-12 text-gray-800" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-xl font-extrabold leading-tight text-gray-900">
                  Planos para você<br />e sua família
                </h3>
                <Link href="/cadastro">
                  <Button className="mt-4 rounded-full bg-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-500">
                    Faça seu plano <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/*  PLANOS  */}
      <section id="planos" className="py-20">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
          <div className="mb-14 text-center">
            <span className="inline-block rounded-full bg-teal-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-teal-700">
              Planos
            </span>
            <h2 className="mt-4 text-4xl font-extrabold text-gray-900 sm:text-5xl">
              Escolha o seu plano
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              Planos acessíveis para você e toda sua família
            </p>
          </div>

          {isLoadingPlanos ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-80 animate-pulse rounded-3xl bg-gray-100" />
              ))}
            </div>
          ) : planos.length === 0 ? (
            <p className="text-center text-gray-500">Nenhum plano disponível no momento.</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {planos.map((plano, index) => {
                const isPerLifeMode = plano.permiteDependentes && plano.valorDependenteAdicional > 0 && Math.abs(plano.valor - plano.valorDependenteAdicional) < 0.0001
                const isHighlighted = index === Math.floor(planos.length / 2)

                return (
                  <div
                    key={plano.codigo}
                    className={`group relative flex flex-col overflow-hidden rounded-3xl border transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${
                      isHighlighted
                        ? 'border-teal-500 bg-gradient-to-b from-teal-700 to-teal-900 shadow-xl shadow-teal-900/20'
                        : 'border-gray-200 bg-white shadow-md'
                    }`}
                  >
                    {isHighlighted && (
                      <div className="bg-teal-500 py-2 text-center text-xs font-bold uppercase tracking-widest text-white">
                         Mais popular
                      </div>
                    )}

                    <div className="flex flex-1 flex-col p-8">
                      <div className="mb-6">
                        <h3 className={`text-xl font-bold ${isHighlighted ? 'text-white' : 'text-gray-900'}`}>
                          {plano.nome}
                        </h3>
                        {plano.descricao && (
                          <p className={`mt-1 text-sm ${isHighlighted ? 'text-teal-200' : 'text-gray-500'}`}>
                            {plano.descricao}
                          </p>
                        )}
                      </div>

                      <div className="mb-6">
                        <div className="flex items-baseline gap-1">
                          <span className={`text-5xl font-extrabold ${isHighlighted ? 'text-white' : 'text-teal-700'}`}>
                            {formatCurrency(plano.valor)}
                          </span>
                          <span className={`text-sm ${isHighlighted ? 'text-teal-200' : 'text-gray-500'}`}>
                            {isPerLifeMode ? '/vida' : '/mês'}
                          </span>
                        </div>
                        {isPerLifeMode && (
                          <p className={`mt-1 text-xs ${isHighlighted ? 'text-teal-200' : 'text-gray-500'}`}>
                            Valor por pessoa
                          </p>
                        )}
                      </div>

                      {plano.beneficios.length > 0 && (
                        <ul className="mb-6 space-y-2.5">
                          {plano.beneficios.map((beneficio, idx) => (
                            <li key={idx} className="flex items-start gap-3">
                              {beneficio.inclui ? (
                                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${isHighlighted ? 'bg-teal-400/30 text-teal-200' : 'bg-teal-100 text-teal-700'}`}>
                                  <Check className="h-3 w-3" />
                                </span>
                              ) : (
                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                                  <X className="h-3 w-3" />
                                </span>
                              )}
                              <span className={`text-sm ${beneficio.inclui ? (isHighlighted ? 'text-teal-100' : 'text-gray-700') : 'text-gray-400 line-through'}`}>
                                {beneficio.texto}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {plano.permiteDependentes && (
                        <div className={`mb-6 rounded-2xl p-3 text-sm ${isHighlighted ? 'bg-white/10 text-teal-100' : 'bg-blue-50 text-blue-800'}`}>
                          <p className="font-semibold"> Permite dependentes</p>
                          {plano.maxDependentes !== null && (
                            <p className="mt-0.5 text-xs opacity-80">Até {plano.maxDependentes + 1} pessoa(s)</p>
                          )}
                          {plano.valorDependenteAdicional > 0 && (
                            <p className="mt-0.5 text-xs opacity-80">
                              + R$ {plano.valorDependenteAdicional.toFixed(2)} por {isPerLifeMode ? 'vida' : 'dependente'}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="mt-auto">
                        <Link href={`/cadastro?plano=${plano.codigo}`}>
                          <Button className={`w-full rounded-full py-6 text-base font-bold transition-all ${
                            isHighlighted
                              ? 'bg-white text-teal-700 hover:bg-gray-100'
                              : 'bg-teal-700 text-white hover:bg-teal-800'
                          }`}>
                            Escolher plano
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-12 text-center">
            <p className="text-sm text-gray-500">
              Dúvidas sobre qual plano escolher?{' '}
              <a
                href="https://wa.me/5511900000000"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-teal-700 hover:underline"
              >
                Fale conosco pelo WhatsApp
              </a>
            </p>
          </div>
        </div>
      </section>

      {/*  COMO FUNCIONA  */}
      <section id="servicos" className="bg-gradient-to-b from-gray-50 to-white py-20">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
          <div className="mb-14 text-center">
            <span className="inline-block rounded-full bg-sky-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-sky-700">
              Como funciona
            </span>
            <h2 className="mt-4 text-4xl font-extrabold text-gray-900 sm:text-5xl">
              Simples e rápido
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              Em menos de 5 minutos você já tem acesso a todos os benefícios
            </p>
          </div>

          <div className="relative grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {/* Connector line (desktop) */}
            <div className="absolute left-0 right-0 top-10 hidden h-px bg-gradient-to-r from-transparent via-teal-200 to-transparent lg:block" style={{ top: '2.5rem' }} />

            {STEPS.map((step, index) => (
              <div key={step.number} className="relative text-center">
                <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-teal-500 to-teal-700 shadow-lg shadow-teal-200">
                  <span className="text-2xl font-extrabold text-white">{step.number}</span>
                </div>
                <h3 className="mb-2 text-lg font-bold text-gray-900">{step.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{step.description}</p>
                {index < STEPS.length - 1 && (
                  <ChevronRight className="absolute -right-4 top-10 hidden h-8 w-8 -translate-y-1/2 text-teal-300 lg:block" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-14 text-center">
            <Link href="/cadastro">
              <Button className="rounded-full bg-teal-700 px-10 py-6 text-base font-bold text-white shadow-lg shadow-teal-200 transition-all hover:-translate-y-0.5 hover:bg-teal-800">
                Começar agora
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/*  BENEFÍCIOS  */}
      <section id="beneficios" className="py-20">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
          <div className="mb-14 text-center">
            <span className="inline-block rounded-full bg-emerald-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700">
              Benefícios
            </span>
            <h2 className="mt-4 text-4xl font-extrabold text-gray-900 sm:text-5xl">
              Por que escolher a {branding.brandName}?
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((benefit) => {
              const Icon = benefit.icon
              const colors = colorMap[benefit.color]
              return (
                <div
                  key={benefit.title}
                  className={`group rounded-3xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${colors.bg} ${colors.border}`}
                >
                  <div className={`mb-4 inline-flex rounded-2xl p-3 ${colors.icon}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2 text-base font-bold text-gray-900">{benefit.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-600">{benefit.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/*  ESPECIALIDADES  */}
      <section className="bg-gradient-to-br from-teal-700 via-teal-800 to-slate-900 py-20">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
          <div className="mb-12 flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
                14 especialidades médicas
              </h2>
              <p className="mt-2 text-teal-200">
                Toda a cobertura que você precisa, em um só plano.
              </p>
            </div>
            <Link href="/cadastro">
              <Button className="shrink-0 rounded-full bg-white px-8 py-3 text-sm font-bold text-teal-700 hover:bg-gray-100">
                Ver planos
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap gap-3">
            {SPECIALTIES.map(specialty => (
              <span
                key={specialty}
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                {specialty}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/*  CTA  */}
      <section className="bg-white py-20">
        <div className="mx-auto w-full max-w-4xl px-5 text-center sm:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-teal-700 to-cyan-600 p-12 shadow-2xl shadow-teal-900/20">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
              Pronto para cuidar da sua saúde?
            </h2>
            <p className="mt-4 text-lg text-teal-100">
              Leva menos de 5 minutos para completar o cadastro. Simples, seguro e digital.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/cadastro">
                <Button className="w-full rounded-full bg-white px-10 py-6 text-base font-bold text-teal-700 shadow-lg transition-all hover:-translate-y-0.5 hover:bg-gray-50 sm:w-auto">
                  Começar cadastro
                </Button>
              </Link>
              <a
                href="https://wa.me/5511900000000"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  className="w-full rounded-full border-white/30 bg-white/10 px-8 py-6 text-base font-semibold text-white backdrop-blur hover:bg-white/20 sm:w-auto"
                >
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Falar no WhatsApp
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/*  FOOTER  */}
      <footer id="contato" className="border-t border-gray-100 bg-slate-900">
        <div className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
            <div className="md:col-span-1">
              <BrandLogo
                width={160}
                height={52}
                className="h-10 w-auto brightness-0 invert"
              />
              <p className="mt-4 text-sm leading-relaxed text-slate-400">
                Sistema de cadastro digital seguro para planos de saúde e telemedicina.
              </p>
            </div>

            <div>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-300">Plataforma</h3>
              <ul className="space-y-2.5 text-sm text-slate-400">
                <li><Link href="/cadastro" className="transition-colors hover:text-white">Cadastro</Link></li>
                <li><Link href="/admin/login" className="transition-colors hover:text-white">Área administrativa</Link></li>
                <li><Link href="/vendedor/login" className="transition-colors hover:text-white">Área do consultor</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-300">Legal</h3>
              <ul className="space-y-2.5 text-sm text-slate-400">
                <li><span className="cursor-default">Política de privacidade</span></li>
                <li><span className="cursor-default">Termos de serviço</span></li>
                <li><span className="cursor-default">LGPD</span></li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-300">Contato</h3>
              <ul className="space-y-3 text-sm text-slate-400">
                <li>
                  <a
                    href="https://wa.me/5511900000000"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 transition-colors hover:text-white"
                  >
                    <MessageCircle className="h-4 w-4 text-green-400" />
                    WhatsApp
                  </a>
                </li>
                <li>
                  <a href="mailto:suporte@shalom.com.br" className="flex items-center gap-2 transition-colors hover:text-white">
                    <Phone className="h-4 w-4 text-teal-400" />
                    suporte@shalom.com.br
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-slate-800 pt-8">
            <p className="text-center text-xs text-slate-500">
              © {new Date().getFullYear()} {branding.brandName}. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>

      {/*  WhatsApp FAB  */}
      <a
        href="https://wa.me/5511900000000"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-900/30 transition-all hover:scale-110 hover:bg-green-400"
        aria-label="WhatsApp"
      >
        <MessageCircle className="h-6 w-6 text-white" />
      </a>
    </main>
  )
}
