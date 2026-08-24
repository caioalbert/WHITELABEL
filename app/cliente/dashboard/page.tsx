'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  CreditCard,
  Flower2,
  MapPin,
  MessageCircle,
  Microscope,
  PhoneCall,
  Pill,
  Users,
  Video,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clienteColors, clienteRadius } from '@/lib/cliente-ui'
import { buildLarpSaudeWhatsappUrl, LARP_SAUDE } from '@/lib/laboratory-partners'
import { ClienteNav } from '@/components/cliente/cliente-nav'

type Cadastro = {
  id: string
  empresa_id?: string | null
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


  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const isTitular = usuario?.tipo !== 'dependente' && !cadastro?.empresa_id
  const dependentesCount = cadastro?.dependentes.length ?? 0
  const larpWhatsappUrl = useMemo(() => buildLarpSaudeWhatsappUrl({
    origin: 'acesso do cliente novaalianca Saúde',
    customerName: usuario?.nome || cadastro?.nome,
  }), [cadastro?.nome, usuario?.nome])

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
    <ClienteNav nomeCliente={usuario?.nome || cadastro.nome}>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">

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

        {/* ── BENEFÍCIOS E PARCEIROS ── */}
        <section aria-labelledby="beneficios-title">
          <div className="mb-3">
            <p id="beneficios-title" className="text-xs font-semibold uppercase tracking-widest" style={{ color: clienteColors.textMuted }}>
              Seus benefícios
            </p>
            <p className="mt-1 text-sm" style={{ color: clienteColors.textMuted }}>
              Acesse os serviços incluídos no seu plano.
            </p>
          </div>

          {/* 1. Rapidoc — serviço principal */}
          <Link
            href="/cliente/telemedicina"
            className="group mb-3 block overflow-hidden rounded-3xl p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:p-6"
            style={{
              background: `linear-gradient(135deg, ${clienteColors.primaryDark} 0%, ${clienteColors.primaryLight} 58%, ${clienteColors.accent} 100%)`,
              color: clienteColors.surface,
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                <Video className="h-7 w-7" />
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: clienteColors.primary }}>
                Serviço principal
              </span>
            </div>

            <div className="mt-5 max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">Telemedicina 24h</p>
              <h2 className="mt-1 text-2xl font-bold sm:text-3xl">Rapidoc</h2>
              <p className="mt-2 text-sm leading-6 text-white/85 sm:text-base">
                Atendimento médico por vídeo, com acesso rápido a profissionais de saúde onde você estiver.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2 text-xs font-medium text-white/90">
                <span className="rounded-full bg-white/10 px-3 py-1.5">Atendimento 24h</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5">Receita digital</span>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-bold">
                Acessar Rapidoc
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </Link>

          <div className="grid gap-3 md:grid-cols-3">
            {/* 2. Larp Saúde */}
            <a
              href={larpWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex min-h-52 flex-col rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ backgroundColor: clienteColors.surface, borderColor: clienteColors.borderMint }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
                  <Microscope className="h-6 w-6 text-emerald-600" />
                </div>
                <MessageCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="mt-4 flex-1">
                <h3 className="font-bold" style={{ color: clienteColors.text }}>{LARP_SAUDE.name}</h3>
                <p className="mt-1 text-sm leading-5" style={{ color: clienteColors.textMuted }}>{LARP_SAUDE.description}</p>
              </div>
              <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <MapPin className="h-3.5 w-3.5" />
                {LARP_SAUDE.coverage}
              </p>
            </a>

            {/* 3. Pague Menos */}
            <article
              className="flex min-h-52 flex-col rounded-2xl border p-5"
              style={{ backgroundColor: clienteColors.surface, borderColor: '#FDE68A' }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50">
                <Pill className="h-6 w-6 text-amber-600" />
              </div>
              <div className="mt-4 flex-1">
                <h3 className="font-bold" style={{ color: clienteColors.text }}>Pague Menos</h3>
                <p className="mt-1 text-sm leading-5" style={{ color: clienteColors.textMuted }}>
                  Benefícios e descontos em medicamentos nas farmácias parceiras.
                </p>
              </div>
              <p className="mt-4 text-xs font-semibold text-amber-700">Economia para o dia a dia</p>
            </article>

            {/* 4. Zelo */}
            <article
              className="flex min-h-52 flex-col rounded-2xl border p-5"
              style={{ backgroundColor: clienteColors.surface, borderColor: '#E7E5E4' }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100">
                <Flower2 className="h-6 w-6" style={{ color: clienteColors.funeral }} />
              </div>
              <div className="mt-4 flex-1">
                <h3 className="font-bold" style={{ color: clienteColors.text }}>Zelo</h3>
                <p className="mt-1 text-sm leading-5" style={{ color: clienteColors.textMuted }}>
                  Assistência funeral e suporte especializado para sua família.
                </p>
              </div>
              <p className="mt-4 text-xs font-semibold" style={{ color: clienteColors.funeral }}>Proteção e acolhimento</p>
            </article>
          </div>
        </section>

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

      </div>
    </ClienteNav>
  )
}
