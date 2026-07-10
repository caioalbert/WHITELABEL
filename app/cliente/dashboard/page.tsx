'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  Brain,
  CreditCard,
  Flower2,
  LogOut,
  Menu,
  PhoneCall,
  Stethoscope,
  Users,
  Video,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/brand-logo'
import { DEFAULT_BRAND_LOGO_ON_LIGHT_URL } from '@/lib/branding'
import { clienteColors, clienteRadius } from '@/lib/cliente-ui'

type Cadastro = {
  id: string
  nome: string
  email: string
  cpf: string
  telefone: string
  status: string
  tipo_plano: string
  mensalidade_valor: number
  mensalidade_billing_type: string
  adesao_pago_em: string | null
  created_at: string
  financeiro_status?: string | null
  dependentes: Array<{ id: string; nome: string; relacao: string }>
}

type UsuarioCliente = {
  id: string
  tipo: 'titular' | 'dependente'
  nome: string
  email?: string | null
  cpf: string
}

type ConfigPublica = {
  telefoneEmergencia: string
  whatsappUrl: string
  appTagline: string
}

const CONFIG_DEFAULTS: ConfigPublica = {
  telefoneEmergencia: '(85) 3000-0000',
  whatsappUrl: 'https://wa.me/5585991452514',
  appTagline: 'Sua saude completa e segura',
}

export default function ClienteDashboard() {
  const router = useRouter()
  const [cadastro, setCadastro] = useState<Cadastro | null>(null)
  const [usuario, setUsuario] = useState<UsuarioCliente | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [config, setConfig] = useState<ConfigPublica>(CONFIG_DEFAULTS)

  const fetchCadastro = useCallback(async () => {
    try {
      const response = await fetch('/api/cliente/me')
      if (response.status === 401) { router.push('/login'); return }
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'Erro ao carregar dados'); return }
      setCadastro(data.cadastro)
      setUsuario(data.usuario || null)
    } catch {
      setError('Erro ao conectar com o servidor')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/configuracoes-publicas')
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
      }
    } catch {
      // mantém defaults
    }
  }, [])

  useEffect(() => {
    fetchCadastro()
    fetchConfig()
  }, [fetchCadastro, fetchConfig])

  const handleLogout = async () => {
    await fetch('/api/cliente/logout', { method: 'POST' })
    router.push('/login')
  }

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const isTitular = usuario?.tipo !== 'dependente'
  const dependentesCount = cadastro?.dependentes.length ?? 0

  // ── Serviços principais (sempre visíveis, em destaque)
  const services = useMemo(() => [
    {
      title: 'Telemedicina',
      description: 'Agendar ou entrar na fila de atendimento',
      href: '/cliente/telemedicina',
      icon: Video,
      color: clienteColors.accent,
      badge: 'Online',
    },
    {
      title: 'Consultas Médicas',
      description: 'Especialistas disponíveis 24h',
      icon: Stethoscope,
      color: clienteColors.primary,
    },
    {
      title: 'Saúde Mental',
      description: 'Psicólogos e suporte emocional',
      icon: Brain,
      color: '#7C3AED',
    },
    {
      title: 'Assistência Funerária',
      description: 'Cobertura Grupo Zelo',
      icon: Flower2,
      color: clienteColors.funeral,
    },
  ], [])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: clienteColors.background }}>
        <p style={{ color: clienteColors.textMuted }}>Carregando...</p>
      </div>
    )
  }

  if (error || !cadastro) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: clienteColors.background }}>
        <div className="w-full max-w-md border p-6" style={{ backgroundColor: clienteColors.surface, borderColor: '#FECACA', borderRadius: clienteRadius.lg }}>
          <p className="mb-4" style={{ color: clienteColors.danger }}>{error || 'Erro ao carregar dados'}</p>
          <Button onClick={() => router.push('/login')} style={{ backgroundColor: clienteColors.primary, color: clienteColors.surface, borderRadius: clienteRadius.full }}>
            Voltar ao login
          </Button>
        </div>
      </div>
    )
  }

  const greeting = (usuario?.nome || cadastro.nome).split(' ')[0]
  const isActive = cadastro.status === 'ATIVO'
  const hasDebt = String(cadastro.financeiro_status || '').trim().toUpperCase() === 'EM_ATRASO'

  return (
    <div className="min-h-screen" style={{ backgroundColor: clienteColors.background }}>

      {/* ── HEADER ── */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 shadow-sm sm:px-6"
        style={{ backgroundColor: clienteColors.surface, borderBottom: `1px solid ${clienteColors.border}` }}
      >
        <BrandLogo
          logoUrl={DEFAULT_BRAND_LOGO_ON_LIGHT_URL}
          width={500}
          height={500}
          className="h-16 w-16 object-contain"
        />
        <div className="flex items-center gap-2">
          {/* Hamburger — só mobile */}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full transition md:hidden"
            style={{ backgroundColor: `${clienteColors.primary}12` }}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" style={{ color: clienteColors.primary }} />
          </button>
          {/* Logout — desktop */}
          <Button
            variant="outline"
            className="hidden items-center gap-2 md:flex"
            onClick={handleLogout}
            style={{ borderRadius: clienteRadius.full, borderColor: clienteColors.border }}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>

      {/* ── DRAWER MOBILE ── */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          {/* Panel */}
          <aside
            className="absolute right-0 top-0 h-full w-80 max-w-[90vw] overflow-y-auto shadow-2xl"
            style={{ backgroundColor: clienteColors.surface }}
          >
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: clienteColors.border }}>
              <p className="font-bold text-base" style={{ color: clienteColors.text }}>Minha Conta</p>
              <button onClick={() => setMenuOpen(false)} className="rounded-full p-1" aria-label="Fechar menu">
                <X className="h-5 w-5" style={{ color: clienteColors.textMuted }} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Informações do plano */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: clienteColors.textMuted }}>
                  Meu Plano
                </p>
                <div className="rounded-2xl border p-4 space-y-3 text-sm" style={{ borderColor: clienteColors.borderMint, backgroundColor: `${clienteColors.primary}08` }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: clienteColors.textMuted }}>Plano</span>
                    <span className="font-semibold" style={{ color: clienteColors.text }}>{cadastro.tipo_plano}</span>
                  </div>
                  {isTitular && (
                    <div className="flex items-center justify-between">
                      <span style={{ color: clienteColors.textMuted }}>Mensalidade</span>
                      <span className="font-semibold" style={{ color: clienteColors.text }}>{formatCurrency(cadastro.mensalidade_valor)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span style={{ color: clienteColors.textMuted }}>Status</span>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ backgroundColor: isActive ? '#D1FAE5' : '#FEF3C7', color: isActive ? clienteColors.success : clienteColors.warning }}
                    >
                      {cadastro.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financeiro */}
              {isTitular && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: clienteColors.textMuted }}>
                    Financeiro
                  </p>
                  <Link href="/cliente/pagamentos" onClick={() => setMenuOpen(false)}>
                    <div className="flex items-center gap-4 rounded-2xl border p-4 transition hover:opacity-80" style={{ borderColor: clienteColors.border }}>
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: '#2196F318' }}>
                        <CreditCard className="h-5 w-5" style={{ color: '#2196F3' }} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm" style={{ color: clienteColors.text }}>
                          Financeiro
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: clienteColors.textMuted }}>
                          Mensalidades e faturas
                        </p>
                      </div>
                    </div>
                  </Link>
                </div>
              )}

              {/* Dependentes */}
              {isTitular && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: clienteColors.textMuted }}>
                    Dependentes
                  </p>
                  <Link href="/cliente/dependentes" onClick={() => setMenuOpen(false)}>
                    <div className="flex items-center gap-4 rounded-2xl border p-4 transition hover:opacity-80" style={{ borderColor: clienteColors.border }}>
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: '#FF980018' }}>
                        <Users className="h-5 w-5" style={{ color: '#FF9800' }} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm" style={{ color: clienteColors.text }}>
                          Dependentes
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: clienteColors.textMuted }}>
                          {dependentesCount} cadastrado{dependentesCount !== 1 ? 's' : ''} no plano
                        </p>
                      </div>
                    </div>
                  </Link>
                </div>
              )}

              {/* Sair */}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleLogout}
                style={{ borderRadius: clienteRadius.full, borderColor: clienteColors.border }}
              >
                <LogOut className="h-4 w-4" />
                Sair da conta
              </Button>
            </div>
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">

        {/* ── SAUDAÇÃO ── */}
        <div className="mb-5">
          <p className="text-2xl font-bold" style={{ color: clienteColors.text }}>
            Olá, {greeting} 👋
          </p>
          {usuario?.tipo === 'dependente' && (
            <span className="mt-1 inline-block rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: '#DBEAFE', color: '#2563EB' }}>
              Dependente
            </span>
          )}
          <p className="mt-1 text-sm" style={{ color: clienteColors.textMuted }}>
            {config.appTagline}
          </p>
        </div>

        {/* ── ALERTA DÍVIDA ── */}
        {hasDebt && isTitular && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border p-4" style={{ backgroundColor: clienteColors.amberBg, borderColor: '#FDE68A' }}>
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: clienteColors.amber }} />
            <p className="text-sm leading-5" style={{ color: clienteColors.amber }}>
              Você possui pagamentos em atraso.{' '}
              <Link href="/cliente/pagamentos" className="font-bold underline">Ver financeiro →</Link>
            </p>
          </div>
        )}

        <div
          className="mb-6 flex items-center justify-between gap-3 rounded-2xl p-4"
          style={{ backgroundColor: clienteColors.danger }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Emergência</p>
            <p className="text-lg font-bold text-white">{config.telefoneEmergencia}</p>
          </div>
          <a
            href={`tel:${config.telefoneEmergencia.replace(/\D/g, '')}`}
            className="flex shrink-0 items-center gap-2 rounded-full border border-white/40 px-4 py-2 text-sm font-semibold text-white"
          >
            <PhoneCall className="h-4 w-4" />
            Ligar
          </a>
        </div>

        {/* ── SERVIÇOS ── */}
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: clienteColors.textMuted }}>
          Serviços disponíveis
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          {services.map((s) => {
            const Icon = s.icon
            const card = (
              <div
                key={s.title}
                className={`flex flex-col gap-3 rounded-2xl border p-4 transition ${s.href ? 'hover:opacity-90 active:scale-95' : 'opacity-60'}`}
                style={{ backgroundColor: clienteColors.surface, borderColor: clienteColors.border }}
              >
                <div className="flex items-center justify-between">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${s.color}18` }}
                  >
                    <Icon className="h-6 w-6" style={{ color: s.color }} />
                  </div>
                  {s.badge && (
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: s.color }}>
                      {s.badge}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-sm leading-snug" style={{ color: clienteColors.text }}>{s.title}</p>
                  <p className="mt-0.5 text-xs leading-snug" style={{ color: clienteColors.textMuted }}>{s.description}</p>
                </div>
              </div>
            )
            return s.href
              ? <Link key={s.title} href={s.href}>{card}</Link>
              : <div key={s.title} aria-disabled>{card}</div>
          })}
        </div>

        {/* ── DESKTOP: Plano + Financeiro + Dependentes (visível apenas md+) ── */}
        <div className="mt-8 hidden md:block space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: clienteColors.textMuted }}>
            Minha Conta
          </p>

          {/* Plano */}
          <div className="rounded-2xl border p-5" style={{ backgroundColor: clienteColors.surface, borderColor: clienteColors.border }}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-base" style={{ color: clienteColors.text }}>Meu Plano</h2>
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: isActive ? '#D1FAE5' : '#FEF3C7', color: isActive ? clienteColors.success : clienteColors.warning }}
              >
                {cadastro.status}
              </span>
            </div>
            <div className={`grid ${isTitular ? 'grid-cols-2' : 'grid-cols-1'} gap-4 text-sm`}>
              <div>
                <p style={{ color: clienteColors.textMuted }}>Plano</p>
                <p className="mt-1 font-semibold" style={{ color: clienteColors.text }}>{cadastro.tipo_plano}</p>
              </div>
              {isTitular && (
                <div>
                  <p style={{ color: clienteColors.textMuted }}>Mensalidade</p>
                  <p className="mt-1 font-semibold" style={{ color: clienteColors.text }}>{formatCurrency(cadastro.mensalidade_valor)}</p>
                </div>
              )}
            </div>
          </div>

          {isTitular && (
            <div className="grid grid-cols-2 gap-3">
              <Link href="/cliente/pagamentos">
                <div className="flex items-center gap-4 rounded-2xl border p-4 transition hover:opacity-80" style={{ backgroundColor: clienteColors.surface, borderColor: clienteColors.border }}>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: '#2196F318' }}>
                    <CreditCard className="h-5 w-5" style={{ color: '#2196F3' }} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: clienteColors.text }}>Financeiro</p>
                    <p className="text-xs mt-0.5" style={{ color: clienteColors.textMuted }}>Mensalidades e faturas</p>
                  </div>
                </div>
              </Link>
              <Link href="/cliente/dependentes">
                <div className="flex items-center gap-4 rounded-2xl border p-4 transition hover:opacity-80" style={{ backgroundColor: clienteColors.surface, borderColor: clienteColors.border }}>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: '#FF980018' }}>
                    <Users className="h-5 w-5" style={{ color: '#FF9800' }} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: clienteColors.text }}>Dependentes</p>
                    <p className="text-xs mt-0.5" style={{ color: clienteColors.textMuted }}>{dependentesCount} cadastrado{dependentesCount !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              </Link>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
