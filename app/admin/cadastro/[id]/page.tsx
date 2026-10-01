'use client'

import { AdminPageHeader } from '@/components/admin/page-header'

import { Button } from '@/components/ui/button'
import { Cadastro, Dependente } from '@/lib/types'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type AsaasPaymentInfo = {
  id: string
  status?: string
  value?: number
  dueDate?: string
  paymentDate?: string
  clientPaymentDate?: string
  confirmedDate?: string
  description?: string
  billingType?: string
  invoiceUrl?: string
  bankSlipUrl?: string
}

type PagamentosData = {
  contrato_meses: number
  parcelas_previstas: { index: number; dueDate: string }[]
  adesao: AsaasPaymentInfo | null
  mensalidades: AsaasPaymentInfo[]
  assinatura: { id: string; status?: string; value?: number; nextDueDate?: string; billingType?: string } | null
  adesao_pago_em: string | null
  mensalidade_valor: number | null
  tipo_plano: string | null
  asaas_subscription_id: string | null
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pendente', color: '#B45309', bg: '#FEF3C7' },
  OVERDUE: { label: 'Vencido', color: '#B91C1C', bg: '#FEE2E2' },
  RECEIVED: { label: 'Pago', color: '#047857', bg: '#D1FAE5' },
  CONFIRMED: { label: 'Pago', color: '#047857', bg: '#D1FAE5' },
  REFUNDED: { label: 'Reembolsado', color: '#4B5563', bg: '#E5E7EB' },
}

function formatCurrency(value?: number | null) {
  if (value == null) return '-'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(date?: string | null) {
  return date ? new Date(date).toLocaleDateString('pt-BR') : '-'
}

function isPaid(status?: string) {
  return ['RECEIVED', 'CONFIRMED'].includes(status || '')
}

function PaymentRow({ payment, label }: { payment: AsaasPaymentInfo; label?: string }) {
  const statusInfo = STATUS_LABEL[payment.status || ''] || {
    label: payment.status || '-',
    color: '#6B7280',
    bg: '#F3F4F6',
  }
  const paid = isPaid(payment.status)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-gray-200 rounded p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{label || payment.description || 'Mensalidade'}</p>
        <p className="text-xs text-gray-500">
          {paid ? 'Pago em: ' : 'Vencimento: '}
          {formatDate(paid ? payment.paymentDate || payment.clientPaymentDate || payment.dueDate : payment.dueDate)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-900">{formatCurrency(payment.value)}</span>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}
        >
          {statusInfo.label}
        </span>
        {payment.invoiceUrl && (
          <a
            href={payment.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            Ver fatura
          </a>
        )}
      </div>
    </div>
  )
}

export default function CadastroDetail() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [cadastro, setCadastro] = useState<Cadastro | null>(null)
  const [dependentes, setDependentes] = useState<Dependente[]>([])
  const [pagamentos, setPagamentos] = useState<PagamentosData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAtivando, setIsAtivando] = useState(false)
  const [ativarError, setAtivarError] = useState<string | null>(null)
  const [ativarMessage, setAtivarMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchCadastro()
  }, [id])

  const fetchCadastro = async () => {
    try {
      setIsLoading(true)
      const [cadastroRes, pagamentosRes] = await Promise.all([
        fetch(`/api/admin/cadastro/${id}`),
        fetch(`/api/admin/cadastro/${id}/pagamentos`),
      ])

      if (!cadastroRes.ok) {
        if (cadastroRes.status === 401) {
          router.push('/admin/login')
          return
        }
        throw new Error('Cliente não encontrado')
      }

      const data = await cadastroRes.json()
      setCadastro(data.cadastro)
      setDependentes(data.dependentes || [])

      if (pagamentosRes.ok) {
        const pagData = await pagamentosRes.json()
        setPagamentos(pagData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }

  const downloadPDF = async () => {
    if (!cadastro) return

    try {
      const response = await fetch('/api/admin/gerar-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cadastroId: cadastro.id }),
      })

      if (!response.ok) {
        throw new Error('Erro ao gerar PDF')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `termo-adesao-${cadastro.cpf}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao baixar PDF')
    }
  }

  const handleAtivar = async () => {
    if (!cadastro) return
    setIsAtivando(true)
    setAtivarError(null)
    setAtivarMessage(null)
    try {
      const res = await fetch(`/api/admin/cadastro/${id}/ativar`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setAtivarError(json.error || 'Erro ao ativar cadastro.')
      } else {
        setAtivarMessage(json.message || 'Cadastro ativado com sucesso.')
        // Recarrega os dados para refletir o novo status
        await fetchCadastro()
      }
    } catch {
      setAtivarError('Erro de conexão ao ativar cadastro.')
    } finally {
      setIsAtivando(false)
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <AdminPageHeader title={cadastro?.nome || 'Detalhes do cliente'} description="Dados pessoais, dependentes e contrato." backHref="/admin/cadastros"><Button onClick={downloadPDF} disabled={!cadastro}>Baixar termo</Button></AdminPageHeader>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-gray-600">Carregando dados...</p>
        </div>
      </main>
    )
  }

  if (error || !cadastro) {
    return (
      <main className="min-h-screen bg-gray-50">
        <AdminPageHeader title={cadastro?.nome || 'Detalhes do cliente'} description="Dados pessoais, dependentes e contrato." backHref="/admin/cadastros"><Button onClick={downloadPDF} disabled={!cadastro}>Baixar termo</Button></AdminPageHeader>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 font-medium">{error || 'Cliente não encontrado'}</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <AdminPageHeader title={cadastro?.nome || 'Detalhes do cliente'} description="Dados pessoais, dependentes e contrato." backHref="/admin/cadastros"><Button onClick={downloadPDF} disabled={!cadastro}>Baixar termo</Button></AdminPageHeader>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1">
          <div>
            <div className="space-y-6">
              {/* Dados Pessoais */}
              <div className="bg-white rounded-lg shadow p-6 space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">Dados Pessoais</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-medium">Nome</p>
                    <p className="text-lg font-medium text-gray-900">{cadastro.nome}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-medium">CPF</p>
                    <p className="text-lg font-medium text-gray-900 font-mono">{cadastro.cpf}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-medium">RG</p>
                    <p className="text-lg font-medium text-gray-900">{cadastro.rg || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-medium">Email</p>
                    <p className="text-lg font-medium text-gray-900">{cadastro.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-medium">Telefone</p>
                    <p className="text-lg font-medium text-gray-900">{cadastro.telefone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-medium">Data de Nascimento</p>
                    <p className="text-lg font-medium text-gray-900">
                      {cadastro.data_nascimento
                        ? new Date(cadastro.data_nascimento).toLocaleDateString('pt-BR')
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-medium">Sexo</p>
                    <p className="text-lg font-medium text-gray-900">{cadastro.sexo || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-medium">Estado Civil</p>
                    <p className="text-lg font-medium text-gray-900">{cadastro.estado_civil || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-medium">Nome do Cônjuge</p>
                    <p className="text-lg font-medium text-gray-900">{cadastro.nome_conjuge || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-medium">Escolaridade</p>
                    <p className="text-lg font-medium text-gray-900">{cadastro.escolaridade || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div className="bg-white rounded-lg shadow p-6 space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">Endereço</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="sm:col-span-2">
                    <p className="text-xs text-gray-600 uppercase font-medium">Endereço</p>
                    <p className="text-lg font-medium text-gray-900">
                      {cadastro.endereco} {cadastro.numero && `, ${cadastro.numero}`}
                    </p>
                    {cadastro.complemento && (
                      <p className="text-sm text-gray-600">{cadastro.complemento}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-medium">Bairro</p>
                    <p className="text-lg font-medium text-gray-900">{cadastro.bairro || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-medium">Cidade</p>
                    <p className="text-lg font-medium text-gray-900">{cadastro.cidade || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-medium">Estado</p>
                    <p className="text-lg font-medium text-gray-900">{cadastro.estado || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-medium">CEP</p>
                    <p className="text-lg font-medium text-gray-900 font-mono">{cadastro.cep || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Dependentes */}
              {cadastro.tem_dependentes && dependentes.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900">Dependentes</h2>
                  <div className="space-y-3">
                    {dependentes.map((dep) => (
                      <div key={dep.id} className="border border-gray-200 rounded p-4">
                        <p className="font-medium text-gray-900">{dep.nome}</p>
                        <p className="text-sm text-gray-600">
                          {dep.relacao && `Relação: ${dep.relacao}`}
                        </p>
                        {dep.cpf && (
                          <p className="text-sm text-gray-600 font-mono">CPF: {dep.cpf}</p>
                        )}
                        {dep.email && (
                          <p className="text-sm text-gray-600">Email: {dep.email}</p>
                        )}
                        {dep.rg && (
                          <p className="text-sm text-gray-600">RG: {dep.rg}</p>
                        )}
                        {dep.data_nascimento && (
                          <p className="text-sm text-gray-600">
                            Data de Nascimento:{' '}
                            {new Date(dep.data_nascimento).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                        {dep.sexo && (
                          <p className="text-sm text-gray-600">Sexo: {dep.sexo}</p>
                        )}
                        {dep.telefone_celular && (
                          <p className="text-sm text-gray-600">Celular: {dep.telefone_celular}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Informações do Termo */}
              <div className="bg-white rounded-lg shadow p-6 space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">Termo de Adesão</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-medium">Cliente desde</p>
                    <p className="text-lg font-medium text-gray-900">
                      {new Date(cadastro.created_at).toLocaleDateString('pt-BR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-medium">Email enviado em</p>
                    <p className="text-lg font-medium text-gray-900">
                      {cadastro.email_enviado_em
                        ? new Date(cadastro.email_enviado_em).toLocaleDateString('pt-BR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Pagamentos */}
              <div className="bg-white rounded-lg shadow p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Pagamentos</h2>
                  {cadastro.status !== 'ATIVO' && (
                    <button
                      id="btn-ativar-manualmente"
                      onClick={handleAtivar}
                      disabled={isAtivando}
                      className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      {isAtivando ? '⏳ Ativando...' : '✅ Ativar manualmente'}
                    </button>
                  )}
                </div>

                {ativarMessage && (
                  <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
                    {ativarMessage}
                  </div>
                )}
                {ativarError && (
                  <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
                    {ativarError}
                  </div>
                )}

                {pagamentos === null ? (
                  <p className="text-sm text-gray-500">Carregando pagamentos...</p>
                ) : (
                  <>
                    {/* Primeira parcela */}
                    <div>
                      <p className="text-xs text-gray-600 uppercase font-medium mb-2">Primeira parcela</p>
                      {pagamentos.adesao ? (
                        <PaymentRow payment={pagamentos.adesao} label="Primeira parcela" />
                      ) : pagamentos.adesao_pago_em ? (
                        <div className="border border-gray-200 rounded p-3">
                          <p className="text-sm font-medium text-gray-900">Primeira parcela</p>
                          <p className="text-xs text-gray-500">
                            Pago em: {formatDate(pagamentos.adesao_pago_em)}
                          </p>
                          <span className="inline-block mt-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-700">
                            Pago
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">Nenhum pagamento da primeira parcela encontrado.</p>
                      )}
                    </div>

                    {/* Mensalidades */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-600 uppercase font-medium">
                          Mensalidades
                          {pagamentos.tipo_plano && (
                            <span className="ml-2 normal-case font-normal text-gray-400">
                              ({pagamentos.tipo_plano === 'FAMILIAR' ? 'Familiar' : 'Individual'}
                              {pagamentos.mensalidade_valor != null
                                ? ` · ${formatCurrency(pagamentos.mensalidade_valor)}/mês`
                                : ''})
                            </span>
                          )}
                        </p>
                      </div>

                      {(() => {
                        if (pagamentos.mensalidades.length > 0) {
                          return (
                            <div className="space-y-2">
                              {pagamentos.mensalidades.map((m) => (
                                <PaymentRow key={m.id} payment={m} />
                              ))}
                            </div>
                          )
                        }

                        const valor = pagamentos.assinatura?.value ?? pagamentos.mensalidade_valor
                        const parcelas = pagamentos.parcelas_previstas || []
                        if (parcelas.length > 0 && valor != null) {
                          const hoje = new Date().toISOString().slice(0, 10)
                          return (
                            <div className="space-y-2">
                              {parcelas.map(({ index, dueDate }) => (
                                <div key={index} className="flex flex-wrap items-center justify-between gap-3 border border-gray-200 rounded p-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900">Parcela {index}/{pagamentos.contrato_meses}</p>
                                    <p className="text-xs text-gray-500">Vencimento: {formatDate(dueDate)}</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold text-gray-900">{formatCurrency(valor)}</span>
                                    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={dueDate < hoje ? { backgroundColor: '#FEE2E2', color: '#B91C1C' } : { backgroundColor: '#F3F4F6', color: '#6B7280' }}>
                                      {dueDate < hoje ? 'Não gerado' : 'Agendado'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        }

                        return (
                          <p className="text-sm text-gray-400">
                            {pagamentos.asaas_subscription_id ? 'Nenhuma mensalidade encontrada.' : 'Assinatura não criada ainda.'}
                          </p>
                        )
                      })()}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
