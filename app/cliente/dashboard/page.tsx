'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  CreditCard,
  Flower2,
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
    <ClienteNav nomeCliente={usuario?.nome || cadastro.nome} usuarioTipo={usuario?.tipo}>
      <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 sm:py-6">

        {/* ── SAUDAÇÃO ── */}
        <div className="mb-3 sm:mb-5">
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

        {/* ── SERVIÇOS AGREGADOS ── */}
        <section
          aria-labelledby="servicos-agregados-title"
          className="rounded-[1.75rem] bg-[#082F49] p-4 text-white shadow-xl shadow-sky-950/10 sm:p-5"
        >
          <p
            id="servicos-agregados-title"
            className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/65"
          >
            Serviços agregados
          </p>

          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
            <Link
              href="/cliente/telemedicina"
              className="flex min-h-20 items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-3 font-semibold text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Video className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-sm leading-tight">Telemedicina 24H</span>
            </Link>

            <a
              href={larpWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-20 items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-3 font-semibold text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Microscope className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-sm leading-tight">Exames laboratoriais</span>
              <span className="sr-only"> com {LARP_SAUDE.name}</span>
            </a>

            <div className="flex min-h-20 items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-3 font-semibold text-white">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Pill className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-sm leading-tight">Descontos em farmácias</span>
            </div>

            <div className="flex min-h-20 items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-3 font-semibold text-white">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Flower2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-sm leading-tight">Assistência funeral</span>
            </div>
          </div>

          <a
            href={`tel:${config.telefoneEmergencia.replace(/\D/g, '')}`}
            className="mt-3 flex min-h-14 items-center justify-between gap-3 rounded-full border border-red-400/60 bg-white/5 px-4 py-2.5 text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-300">
                <PhoneCall className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold">Emergência</span>
            </span>
            <span className="text-sm font-bold text-white/85">{config.telefoneEmergencia}</span>
          </a>
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
