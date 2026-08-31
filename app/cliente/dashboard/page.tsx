'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  PhoneCall,
} from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { LarpLogo } from '@/components/larp-logo'
import { buildLarpSaudeWhatsappUrl } from '@/lib/laboratory-partners'
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
}

const CONFIG_DEFAULTS: ConfigPublica = {
  telefoneEmergencia: '(85) 3000-0000',
}

const serviceButtonClassName = 'flex h-[clamp(2.75rem,8.5svh,3.5rem)] min-h-0 w-full shrink-0 items-center rounded-full bg-white px-4 text-[#0B1E36] shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1E36]'

type PartnerName = 'rapidoc' | 'larp' | 'pague-menos' | 'zelo'

const RAPIDOC_MARK_CELLS = [false, true, false, true, true, true, false, true, false]

function PartnerLogo({ partner }: { partner: PartnerName }) {
  if (partner === 'rapidoc') {
    return (
      <span className="flex items-center gap-1.5" role="img" aria-label="Rapidoc">
        <span className="grid h-8 w-8 shrink-0 grid-cols-3 gap-0.5" aria-hidden="true">
          {RAPIDOC_MARK_CELLS.map((visible, index) => (
            <span key={index} className={visible ? 'rounded-[2px] bg-sky-500' : ''} />
          ))}
        </span>
        <span className="text-[13px] font-black tracking-tight text-sky-700">rapidoc</span>
      </span>
    )
  }

  if (partner === 'larp') {
    return (
      <LarpLogo className="h-9 w-22" />
    )
  }

  if (partner === 'pague-menos') {
    return (
      <span className="flex items-center gap-1.5" role="img" aria-label="Pague Menos">
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-600" aria-hidden="true">
          <span className="absolute h-5 w-2 rounded-sm bg-white" />
          <span className="absolute h-2 w-5 rounded-sm bg-white" />
        </span>
        <span className="text-left text-[12px] font-black italic leading-[0.85] text-[#294B9B]">
          Pague<br />Menos
        </span>
      </span>
    )
  }

  return (
    <span className="flex flex-col items-center text-[#0B4F84]" role="img" aria-label="Grupo Zelo">
      <span className="text-[8px] font-extrabold uppercase leading-none">Grupo</span>
      <span className="text-[17px] font-black leading-none">ZELO</span>
      <svg viewBox="0 0 80 12" className="mt-0.5 h-2 w-14" fill="none" aria-hidden="true">
        <path d="M2 2C20 13 48 13 78 2" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </svg>
    </span>
  )
}

function ServiceContent({ partner, title, subtitle }: { partner: PartnerName; title: string; subtitle?: string }) {
  return (
    <>
      <span className="flex w-22 shrink-0 items-center justify-center border-r border-slate-200 pr-3">
        <PartnerLogo partner={partner} />
      </span>
      <span className="min-w-0 pl-3 text-left">
        <span className="block text-sm font-bold leading-tight">{title}</span>
        {subtitle ? <span className="mt-1 block text-xs font-medium text-slate-500">{subtitle}</span> : null}
      </span>
    </>
  )
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

  const isTitular = usuario?.tipo !== 'dependente' && !cadastro?.empresa_id
  const larpWhatsappUrl = useMemo(() => buildLarpSaudeWhatsappUrl({
    origin: 'acesso do cliente novaalianca Saúde',
    customerName: usuario?.nome || cadastro?.nome,
  }), [cadastro?.nome, usuario?.nome])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B1E36]">
        <p className="text-white/70">Carregando...</p>
      </div>
    )
  }

  if (error || !cadastro) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B1E36] p-4 text-center">
        <div className="w-full max-w-md">
          <p className="mb-5 text-red-200">{error || 'Erro ao carregar dados'}</p>
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="rounded-full bg-white px-6 py-3 font-semibold text-[#0B1E36]"
          >
            Voltar ao login
          </button>
        </div>
      </div>
    )
  }

  const greeting = (usuario?.nome || cadastro.nome).split(' ')[0].toLocaleUpperCase('pt-BR')
  const hasDebt = String(cadastro.financeiro_status || '').trim().toUpperCase() === 'EM_ATRASO'

  return (
    <ClienteNav nomeCliente={usuario?.nome || cadastro.nome} usuarioTipo={usuario?.tipo} appearance="midnight">
      <div className="mx-auto flex h-[calc(100svh-57px)] w-[90%] max-w-md flex-col overflow-hidden pb-[calc(clamp(4rem,11svh,4.75rem)+env(safe-area-inset-bottom))] pt-1 md:h-auto md:min-h-screen md:pb-28 md:pt-5">

        <div className="flex h-[clamp(4rem,18svh,9rem)] shrink-0 items-center justify-center">
          <BrandLogo
            logoUrl="/logo-nova-alianca.png"
            width={500}
            height={500}
            priority
            className="h-full max-h-full w-auto max-w-full object-contain"
          />
        </div>

        {/* ── SAUDAÇÃO ── */}
        <header className="mb-[clamp(0.375rem,1.3svh,0.75rem)] shrink-0">
          <h1 className="text-[clamp(1.25rem,3.8svh,1.5rem)] font-bold tracking-tight text-white">Olá, {greeting}</h1>
          {usuario?.tipo === 'dependente' && (
            <span className="mt-1.5 inline-flex rounded-full border border-white/35 bg-white/10 px-3 py-0.5 text-xs font-semibold text-white">
              Dependente
            </span>
          )}
        </header>

        {/* ── ALERTA DÍVIDA ── */}
        {hasDebt && isTitular && (
          <div className="mb-2 flex shrink-0 items-start gap-2 text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-xs leading-4">
              Você possui pagamentos em atraso.{' '}
              <Link href="/cliente/pagamentos" className="font-bold underline">Ver financeiro →</Link>
            </p>
          </div>
        )}

        <section aria-label="Serviços" className="flex flex-col gap-[clamp(0.375rem,1.2svh,0.75rem)]" role="list">
          <Link href="/cliente/telemedicina" className={serviceButtonClassName} role="listitem">
            <ServiceContent partner="rapidoc" title="Telemedicina" subtitle="Atendimento 24H" />
          </Link>

          <a
            href={larpWhatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={serviceButtonClassName}
            role="listitem"
          >
            <ServiceContent partner="larp" title="Exames laboratoriais" subtitle="Preços especiais" />
          </a>

          <div className={`${serviceButtonClassName} cursor-default`} role="listitem">
            <ServiceContent partner="pague-menos" title="Desconto em medicamentos" />
          </div>

          <div className={`${serviceButtonClassName} cursor-default`} role="listitem">
            <ServiceContent partner="zelo" title="Plano funerário" />
          </div>
        </section>

      </div>

      <a
        href={`tel:${config.telefoneEmergencia.replace(/\D/g, '')}`}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-20 flex h-[clamp(2.75rem,8.5svh,3.5rem)] w-[90%] max-w-md -translate-x-1/2 items-center justify-center gap-3 rounded-full bg-white px-5 font-semibold text-[#0B1E36] shadow-2xl shadow-black/30 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 md:left-[calc(50%+7rem)]"
      >
        <PhoneCall className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
        <span>Emergência {config.telefoneEmergencia}</span>
      </a>
    </ClienteNav>
  )
}
