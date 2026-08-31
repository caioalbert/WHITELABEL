'use client'

import { BrandLogo } from '@/components/brand-logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DEFAULT_BRAND_LOGO_ON_LIGHT_URL } from '@/lib/branding'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

type EmpresaStatus =
  | 'CADASTRO_CONCLUIDO'
  | 'ORCAMENTO_SOLICITADO'
  | 'LISTA_FUNCIONARIOS_ENVIADA'
  | 'PENDENTE_PAGAMENTO'
  | 'ATIVO'

type Employee = {
  nome: string
  cpf: string
  rg: string
  email: string
  telefone: string
  data_nascimento: string
  sexo: string
  cargo: string
}

type FlowPayload = {
  empresa: {
    razao_social: string
    nome_fantasia?: string | null
    status: EmpresaStatus
    quantidade_funcionarios?: number | null
    valor_por_funcionario?: number | null
    mensalidade_valor?: number | null
  }
  orcamento: { nome: string; valorPorFuncionario: number; minFuncionarios: number }
  pagamento?: {
    valor?: number
    vencimento?: string
    billingType?: string
    invoiceUrl?: string | null
    bankSlipUrl?: string | null
  } | null
  processingPayment?: boolean
}

const EMPTY_EMPLOYEE: Employee = {
  nome: '', cpf: '', rg: '', email: '', telefone: '', data_nascimento: '', sexo: '', cargo: '',
}

const STATUS_INDEX: Record<EmpresaStatus, number> = {
  CADASTRO_CONCLUIDO: 1,
  ORCAMENTO_SOLICITADO: 2,
  LISTA_FUNCIONARIOS_ENVIADA: 3,
  PENDENTE_PAGAMENTO: 4,
  ATIVO: 5,
}

function Field({ label, ...props }: React.ComponentProps<typeof Input> & { label: string }) {
  return (
    <label className="space-y-1.5 text-sm font-medium text-gray-700">
      <span>{label}</span>
      <Input {...props} />
    </label>
  )
}

async function api(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação.')
  return payload
}

export default function EmpresaCadastroPage() {
  const [flow, setFlow] = useState<FlowPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [billingType, setBillingType] = useState<'BOLETO' | 'CREDIT_CARD'>('BOLETO')
  const [employees, setEmployees] = useState<Employee[]>([{ ...EMPTY_EMPLOYEE }])
  const [company, setCompany] = useState({
    razao_social: '', nome_fantasia: '', cnpj: '', email: '', telefone: '',
    responsavel_nome: '', endereco: '', numero: '', complemento: '', bairro: '',
    cidade: '', estado: '', cep: '',
  })

  const refreshFlow = useCallback(async () => {
    try {
      const payload = await api('/api/empresa/fluxo') as FlowPayload
      setFlow(payload)
      const minimum = Math.max(1, payload.orcamento?.minFuncionarios || 1)
      if (payload.empresa.status === 'ORCAMENTO_SOLICITADO') {
        setEmployees((current) => current.length >= minimum
          ? current
          : Array.from({ length: minimum }, (_, index) => current[index] || { ...EMPTY_EMPLOYEE }))
      }
    } catch (err) {
      if (!(err instanceof Error && err.message === 'Não autenticado.')) setError(err instanceof Error ? err.message : 'Erro ao carregar fluxo.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { refreshFlow() }, [refreshFlow])

  useEffect(() => {
    if (flow?.empresa.status !== 'PENDENTE_PAGAMENTO') return
    const timer = window.setInterval(refreshFlow, 5000)
    return () => window.clearInterval(timer)
  }, [flow?.empresa.status, refreshFlow])

  const run = async (action: () => Promise<unknown>) => {
    setIsSubmitting(true)
    setError('')
    try {
      await action()
      await refreshFlow()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao concluir etapa.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalPreview = useMemo(() => {
    const unit = flow?.orcamento?.valorPorFuncionario || 0
    return unit * employees.length
  }, [employees.length, flow?.orcamento?.valorPorFuncionario])

  const step = flow ? STATUS_INDEX[flow.empresa.status] : 0
  const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  if (isLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-teal-50 text-teal-900">Carregando fluxo empresarial...</main>
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <BrandLogo logoUrl={DEFAULT_BRAND_LOGO_ON_LIGHT_URL} width={240} height={80} className="h-16 w-auto object-contain" />
          <Link href="/login?tipo=empresa" className="text-sm font-semibold text-teal-800 underline">Já tenho cadastro</Link>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          <div className="mb-7">
            <p className="text-sm font-bold uppercase tracking-widest text-teal-700">Pessoa Jurídica</p>
            <h1 className="mt-1 text-3xl font-bold text-gray-900">Adesão empresarial</h1>
            <p className="mt-2 text-gray-600">Cadastro → Orçamento → Colaboradores → Pagamento → App</p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full bg-teal-600 transition-all" style={{ width: `${((step + 1) / 6) * 100}%` }} />
            </div>
          </div>

          {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          {!flow && (
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault()
                run(() => api('/api/empresa/cadastro', company))
              }}
            >
              <Field label="Razão social *" value={company.razao_social} onChange={(e) => setCompany({ ...company, razao_social: e.target.value })} required />
              <Field label="Nome fantasia" value={company.nome_fantasia} onChange={(e) => setCompany({ ...company, nome_fantasia: e.target.value })} />
              <Field label="CNPJ *" value={company.cnpj} onChange={(e) => setCompany({ ...company, cnpj: e.target.value })} required />
              <Field label="Responsável *" value={company.responsavel_nome} onChange={(e) => setCompany({ ...company, responsavel_nome: e.target.value })} required />
              <Field label="Email *" type="email" value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} required />
              <Field label="Telefone *" value={company.telefone} onChange={(e) => setCompany({ ...company, telefone: e.target.value })} required />
              <Field label="Endereço *" value={company.endereco} onChange={(e) => setCompany({ ...company, endereco: e.target.value })} required />
              <Field label="Número *" value={company.numero} onChange={(e) => setCompany({ ...company, numero: e.target.value })} required />
              <Field label="Complemento" value={company.complemento} onChange={(e) => setCompany({ ...company, complemento: e.target.value })} />
              <Field label="Bairro *" value={company.bairro} onChange={(e) => setCompany({ ...company, bairro: e.target.value })} required />
              <Field label="Cidade *" value={company.cidade} onChange={(e) => setCompany({ ...company, cidade: e.target.value })} required />
              <div className="grid grid-cols-2 gap-3">
                <Field label="UF *" maxLength={2} value={company.estado} onChange={(e) => setCompany({ ...company, estado: e.target.value.toUpperCase() })} required />
                <Field label="CEP *" value={company.cep} onChange={(e) => setCompany({ ...company, cep: e.target.value })} required />
              </div>
              <Button type="submit" disabled={isSubmitting} className="sm:col-span-2 bg-teal-700 hover:bg-teal-800">
                {isSubmitting ? 'Salvando...' : 'Concluir cadastro da empresa'}
              </Button>
            </form>
          )}

          {flow?.empresa.status === 'CADASTRO_CONCLUIDO' && (
            <div className="space-y-5">
              <h2 className="text-2xl font-bold">Cadastro concluído</h2>
              <p className="text-gray-600">Agora solicite o orçamento empresarial. O valor será obtido do plano empresarial ativo, sem criar cobrança nesta etapa.</p>
              <Button disabled={isSubmitting} onClick={() => run(() => api('/api/empresa/orcamento', {}))} className="bg-teal-700 hover:bg-teal-800">
                {isSubmitting ? 'Solicitando...' : 'Solicitar orçamento'}
              </Button>
            </div>
          )}

          {flow?.empresa.status === 'ORCAMENTO_SOLICITADO' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Orçamento solicitado</h2>
                <p className="mt-2 text-gray-600">{flow.orcamento.nome}: {money(flow.orcamento.valorPorFuncionario)} por colaborador. Mínimo de {flow.orcamento.minFuncionarios} colaboradores.</p>
              </div>
              <div className="space-y-4">
                {employees.map((employee, index) => (
                  <div key={index} className="rounded-xl border border-gray-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-semibold">Colaborador {index + 1}</h3>
                      {employees.length > flow.orcamento.minFuncionarios && (
                        <button type="button" className="text-sm text-red-600" onClick={() => setEmployees(employees.filter((_, itemIndex) => itemIndex !== index))}>Remover</button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {([
                        ['nome', 'Nome completo', 'text'], ['cpf', 'CPF', 'text'], ['rg', 'RG', 'text'],
                        ['email', 'Email', 'email'], ['telefone', 'Telefone', 'text'],
                        ['data_nascimento', 'Data de nascimento', 'date'], ['sexo', 'Sexo', 'text'], ['cargo', 'Cargo', 'text'],
                      ] as const).map(([key, label, type]) => (
                        <Field key={key} label={`${label}${key === 'cargo' ? '' : ' *'}`} type={type} value={employee[key]} required={key !== 'cargo'} onChange={(e) => setEmployees(employees.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: e.target.value } : item))} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button type="button" variant="outline" onClick={() => setEmployees([...employees, { ...EMPTY_EMPLOYEE }])}>Adicionar colaborador</Button>
                <p className="font-semibold">Total mensal: {money(totalPreview)}</p>
                <Button disabled={isSubmitting} onClick={() => run(() => api('/api/empresa/funcionarios', { funcionarios: employees }))} className="bg-teal-700 hover:bg-teal-800">
                  {isSubmitting ? 'Enviando...' : 'Enviar lista de colaboradores'}
                </Button>
              </div>
            </div>
          )}

          {flow?.empresa.status === 'LISTA_FUNCIONARIOS_ENVIADA' && (
            <div className="space-y-5">
              <h2 className="text-2xl font-bold">Lista de colaboradores enviada</h2>
              <p className="text-gray-600">{flow.empresa.quantidade_funcionarios} colaboradores · mensalidade de {money(Number(flow.empresa.mensalidade_valor || 0))}.</p>
              <label className="block max-w-sm space-y-2 text-sm font-medium">
                <span>Forma de pagamento</span>
                <select value={billingType} onChange={(e) => setBillingType(e.target.value as 'BOLETO' | 'CREDIT_CARD')} className="h-11 w-full rounded-md border border-gray-300 px-3">
                  <option value="BOLETO">BolePIX</option>
                  <option value="CREDIT_CARD">Cartão de crédito</option>
                </select>
              </label>
              <Button disabled={isSubmitting} onClick={() => run(() => api('/api/empresa/pagamento', { billingType }))} className="bg-teal-700 hover:bg-teal-800">
                {isSubmitting ? 'Gerando...' : 'Gerar cobrança'}
              </Button>
            </div>
          )}

          {flow?.empresa.status === 'PENDENTE_PAGAMENTO' && (
            <div className="space-y-5">
              <h2 className="text-2xl font-bold">Pagamento pendente</h2>
              <p className="text-gray-600">O acesso da empresa e dos colaboradores será liberado somente após a confirmação do Asaas.</p>
              {flow.pagamento && <p className="text-lg font-semibold">Valor: {money(Number(flow.pagamento.valor || flow.empresa.mensalidade_valor || 0))}</p>}
              <div className="flex flex-wrap gap-3">
                {flow.pagamento?.invoiceUrl && <Button asChild className="bg-teal-700 hover:bg-teal-800"><a href={flow.pagamento.invoiceUrl} target="_blank" rel="noreferrer">Abrir cobrança</a></Button>}
                {flow.pagamento?.bankSlipUrl && flow.pagamento.bankSlipUrl !== flow.pagamento.invoiceUrl && <Button asChild variant="outline"><a href={flow.pagamento.bankSlipUrl} target="_blank" rel="noreferrer">Abrir boleto</a></Button>}
                <Button variant="outline" onClick={refreshFlow}>Verificar pagamento</Button>
              </div>
              {flow.processingPayment && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Pagamento identificado. A ativação está sendo processada.</p>}
            </div>
          )}

          {flow?.empresa.status === 'ATIVO' && (
            <div className="space-y-5 text-center">
              <h2 className="text-3xl font-bold text-emerald-700">Empresa ativada</h2>
              <p className="text-gray-600">Pagamento confirmado. O acesso ao app está liberado.</p>
              <Button asChild className="bg-teal-700 hover:bg-teal-800"><Link href="/login?tipo=empresa">Acessar o app</Link></Button>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
