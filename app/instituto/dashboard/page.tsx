'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Menu, Copy, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useCachedFetch } from '@/lib/hooks/use-cached-fetch'

type CadastroInstituto = {
  id: string
  nome: string
  email: string
  status: string
  created_at: string
  mensalidade_valor?: number | null
  instituto_codigo?: string | null
  sem_adesao?: boolean
}

type ComissaoMensal = {
  mesReferencia: string
  mesLabel: string
  quantidadeVendas: number
  valorTotal: number
  valorPagoRegistrado: number
  valorPendente: number
  pago: boolean
  pagamentoId: string | null
  pagoEm: string | null
  comprovanteUrl: string | null
  observacao: string | null
}

type ResumoPayload = {
  instituto: {
    id: string
    nome: string
    email: string
    codigoIndicacao: string
    linkVenda: string
    comissaoPercentualMensalidade: number
    comissaoMensalidadesMax: number | null
  }
  comissaoResumo: {
    totalClientes: number
    totalVendasPagas: number
    comissaoTotalPaga: number
    comissaoTotalDevida: number
    comissoesMensais: ComissaoMensal[]
  }
  cadastros: CadastroInstituto[]
  totalPendentes: number
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  return d.toLocaleDateString('pt-BR')
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ATIVO: 'bg-green-100 text-green-800',
    PENDENTE_PAGAMENTO: 'bg-yellow-100 text-yellow-800',
    INATIVO: 'bg-gray-100 text-gray-600',
    CANCELADO: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export default function InstitutoDashboardPage() {
  const router = useRouter()
  const [linkCopied, setLinkCopied] = useState(false)

  const {
    data,
    isLoading,
    isValidating,
    error,
    revalidate,
  } = useCachedFetch<ResumoPayload>('/api/instituto/resumo', {
    ttl: 45,
    revalidateOnFocus: true,
  })

  useEffect(() => {
    if (error && /401|não autenticado|unauthorized/i.test(error)) {
      router.push('/instituto/login')
    }
  }, [error, router])

  const handleLogout = async () => {
    try {
      await fetch('/api/instituto/logout', { method: 'POST' })
      router.push('/instituto/login')
    } catch {
      router.push('/instituto/login')
    }
  }

  const handleCopyLink = async () => {
    if (!data?.instituto.linkVenda) return
    try {
      await navigator.clipboard.writeText(data.instituto.linkVenda)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const comissaoMensalidadesLabel = useMemo(() => {
    if (!data) return ''
    const max = data.instituto.comissaoMensalidadesMax
    if (max === null) return 'Vitalício (todas as mensalidades)'
    if (max === 1) return 'Apenas a 1ª mensalidade'
    return `Primeiras ${max} mensalidades`
  }, [data])

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">
              Painel do Instituto
            </h1>
            {data?.instituto && (
              <p className="text-xs text-gray-500 sm:text-sm">{data.instituto.nome}</p>
            )}
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <Button onClick={revalidate} variant="outline" disabled={isLoading}>
              {isValidating ? 'Atualizando...' : 'Atualizar'}
            </Button>
            <Button onClick={handleLogout} variant="outline">Sair</Button>
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
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 px-4 pb-4">
                  <SheetClose asChild>
                    <Button onClick={handleLogout} variant="outline" className="w-full justify-start">Sair</Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {isLoading && (
          <p className="text-center text-sm text-gray-500">Carregando dados...</p>
        )}
        {!isLoading && isValidating && (
          <p className="text-right text-xs text-gray-400">Atualizando dados...</p>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {data && (
          <>
            {/* Link de Venda */}
            <div className="rounded-lg bg-white p-6 shadow space-y-3">
              <h2 className="text-base font-semibold text-gray-900">Seu Link de Venda</h2>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={data.instituto.linkVenda}
                  className="flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="shrink-0 gap-1.5"
                >
                  {linkCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  {linkCopied ? 'Copiado!' : 'Copiar'}
                </Button>
                <a
                  href={data.instituto.linkVenda}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                >
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <p>Código: <strong className="font-medium text-gray-700">{data.instituto.codigoIndicacao}</strong></p>
                <p>Comissão: <strong>{data.instituto.comissaoPercentualMensalidade}%</strong> sobre mensalidades pagas</p>
                <p>Período: <strong>{comissaoMensalidadesLabel}</strong></p>
                <p className="text-teal-700">ℹ️ Clientes cadastrados via este link não pagam adesão. A 1ª mensalidade vence em 30 dias.</p>
              </div>
            </div>

            {/* Resumo Financeiro */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-white p-5 shadow text-center">
                <p className="text-2xl font-bold text-gray-900">{data.comissaoResumo.totalClientes}</p>
                <p className="mt-1 text-xs text-gray-500">Total de Clientes</p>
              </div>
              <div className="rounded-lg bg-white p-5 shadow text-center">
                <p className="text-2xl font-bold text-green-700">{data.comissaoResumo.totalVendasPagas}</p>
                <p className="mt-1 text-xs text-gray-500">Com 1ª Mensalidade Paga</p>
              </div>
              <div className="rounded-lg bg-white p-5 shadow text-center">
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(data.comissaoResumo.comissaoTotalPaga)}</p>
                <p className="mt-1 text-xs text-gray-500">Comissão Paga</p>
              </div>
              <div className="rounded-lg bg-white p-5 shadow text-center">
                <p className="text-2xl font-bold text-amber-700">{formatCurrency(data.comissaoResumo.comissaoTotalDevida)}</p>
                <p className="mt-1 text-xs text-gray-500">Comissão a Receber</p>
              </div>
            </div>

            {/* Comissões Mensais */}
            {data.comissaoResumo.comissoesMensais.length > 0 && (
              <div className="rounded-lg bg-white p-6 shadow space-y-4">
                <h2 className="text-base font-semibold text-gray-900">Comissões por Mês</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="pb-3 pr-4 font-medium text-gray-600">Mês</th>
                        <th className="pb-3 pr-4 font-medium text-gray-600">Clientes</th>
                        <th className="pb-3 pr-4 font-medium text-gray-600">Comissão</th>
                        <th className="pb-3 pr-4 font-medium text-gray-600">Status</th>
                        <th className="pb-3 font-medium text-gray-600">Pago em</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.comissaoResumo.comissoesMensais.map((mes) => (
                        <tr key={mes.mesReferencia}>
                          <td className="py-3 pr-4 text-gray-900">{mes.mesLabel}</td>
                          <td className="py-3 pr-4 text-gray-700">{mes.quantidadeVendas}</td>
                          <td className="py-3 pr-4 font-medium text-gray-900">{formatCurrency(mes.valorTotal)}</td>
                          <td className="py-3 pr-4">
                            {mes.pago ? (
                              <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">Pago</span>
                            ) : (
                              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">Pendente</span>
                            )}
                          </td>
                          <td className="py-3 text-gray-600">{mes.pago ? formatDate(mes.pagoEm) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Lista de Clientes */}
            <div className="rounded-lg bg-white p-6 shadow space-y-4">
              <h2 className="text-base font-semibold text-gray-900">
                Clientes Indicados ({data.cadastros.length})
              </h2>
              {data.cadastros.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum cliente cadastrado ainda. Compartilhe seu link de venda!</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="pb-3 pr-4 font-medium text-gray-600">Nome</th>
                        <th className="pb-3 pr-4 font-medium text-gray-600">Email</th>
                        <th className="pb-3 pr-4 font-medium text-gray-600">Mensalidade</th>
                        <th className="pb-3 pr-4 font-medium text-gray-600">Status</th>
                        <th className="pb-3 font-medium text-gray-600">Cadastrado em</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.cadastros.map((c) => (
                        <tr key={c.id}>
                          <td className="py-3 pr-4 font-medium text-gray-900">{c.nome}</td>
                          <td className="py-3 pr-4 text-gray-600">{c.email}</td>
                          <td className="py-3 pr-4 text-gray-700">
                            {c.mensalidade_valor ? formatCurrency(Number(c.mensalidade_valor)) : '—'}
                          </td>
                          <td className="py-3 pr-4"><StatusBadge status={c.status} /></td>
                          <td className="py-3 text-gray-600">{formatDate(c.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
