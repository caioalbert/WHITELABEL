'use client'

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { calculateCadastroComissaoValue } from '@/lib/comissoes'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

type ClienteVendedor = {
  id: string
  nome: string
  email: string
  cpf: string
  status: string
  created_at: string
  adesao_pago_em?: string | null
  mensalidade_valor?: number | null
  vendedor_codigo?: string | null
  tipo_plano?: string | null
}

type ComissaoMensal = {
  mesReferencia: string
  mesLabel: string
  quantidadeVendas: number
  quantidadeMensalidadesSubsequentes: number
  valorAdesaoMes: number
  valorMensalidadeSubsequenteMes: number
  mesReferenciaBaseMensalidade: string | null
  mesLabelBaseMensalidade: string | null
  valorTotal: number
  valorPagoRegistrado: number
  valorPendente: number
  pago: boolean
  pagamentoId: string | null
  pagoEm: string | null
  comprovanteUrl: string | null
  observacao: string | null
}

type VendedorDetalhePayload = {
  vendedor: {
    id: string
    nome: string
    email: string
    codigoIndicacao: string
    ativo: boolean
    linkVenda: string
  }
  resumo: {
    totalClientes: number
    vendasFechadas: number
    totalPendentes: number
    comissaoMesAtual: number
    comissaoMesAtualBruta: number
    comissaoMesAtualPaga: number
    comissaoTotalBruta: number
    comissaoTotalPaga: number
    comissaoTotalDevida: number
  }
  comissoesMensais: ComissaoMensal[]
  clientes: ClienteVendedor[]
}

export default function AdminVendedorDetalhePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const vendedorId = String(params?.id || '').trim()

  const [data, setData] = useState<VendedorDetalhePayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [mesReferenciaSelecionada, setMesReferenciaSelecionada] = useState('')
  const [valorPagamento, setValorPagamento] = useState('')
  const [observacaoPagamento, setObservacaoPagamento] = useState('')
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null)
  const [isSavingComissao, setIsSavingComissao] = useState(false)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [isSavingVendedor, setIsSavingVendedor] = useState(false)
  const [vendedorNome, setVendedorNome] = useState('')
  const [vendedorEmail, setVendedorEmail] = useState('')
  const [vendedorCodigoIndicacao, setVendedorCodigoIndicacao] = useState('')
  const [vendedorSenha, setVendedorSenha] = useState('')

  const fetchDetalhes = useCallback(async () => {
    if (!vendedorId) {
      setError('ID de vendedor inválido.')
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/admin/vendedores/${encodeURIComponent(vendedorId)}`, {
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => null)

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Erro ao carregar detalhes do vendedor.')
      }

      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar detalhes do vendedor.')
    } finally {
      setIsLoading(false)
    }
  }, [router, vendedorId])

  useEffect(() => {
    fetchDetalhes()
  }, [fetchDetalhes])

  useEffect(() => {
    if (!data?.vendedor) return

    setVendedorNome(data.vendedor.nome || '')
    setVendedorEmail(data.vendedor.email || '')
    setVendedorCodigoIndicacao(data.vendedor.codigoIndicacao || '')
  }, [data?.vendedor])

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
      router.push('/admin/login')
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  const handleCopyLink = async () => {
    if (!data?.vendedor.linkVenda) return

    try {
      await navigator.clipboard.writeText(data.vendedor.linkVenda)
      setMessage('Link de venda copiado com sucesso.')
    } catch {
      setError('Não foi possível copiar o link automaticamente.')
    }
  }

  const formatCurrency = useCallback(
    (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    []
  )

  const tableRows = useMemo(() => data?.clientes || [], [data?.clientes])

  const comissoesPendentes = useMemo(
    () => (data?.comissoesMensais || []).filter((item) => !item.pago && item.valorPendente > 0),
    [data?.comissoesMensais]
  )

  const selectedComissao = useMemo(
    () =>
      comissoesPendentes.find((item) => item.mesReferencia === mesReferenciaSelecionada) ||
      null,
    [comissoesPendentes, mesReferenciaSelecionada]
  )

  useEffect(() => {
    if (comissoesPendentes.length === 0) {
      setMesReferenciaSelecionada('')
      setValorPagamento('')
      return
    }

    const hasSelectedMonth = comissoesPendentes.some(
      (item) => item.mesReferencia === mesReferenciaSelecionada
    )

    if (!hasSelectedMonth) {
      const defaultMonth = comissoesPendentes[0]
      setMesReferenciaSelecionada(defaultMonth.mesReferencia)
      setValorPagamento(defaultMonth.valorPendente.toFixed(2))
    }
  }, [comissoesPendentes, mesReferenciaSelecionada])

  const handleMesReferenciaChange = (monthReference: string) => {
    setMesReferenciaSelecionada(monthReference)

    const month = comissoesPendentes.find((item) => item.mesReferencia === monthReference)
    if (month) {
      setValorPagamento(month.valorPendente.toFixed(2))
    }
  }

  const handleSalvarCadastroVendedor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nome = vendedorNome.trim()
    const email = vendedorEmail.trim().toLowerCase()
    const codigoIndicacao = vendedorCodigoIndicacao.trim()
    const senha = vendedorSenha.trim()

    if (!nome || !email || !codigoIndicacao) {
      setError('Nome, email e código de indicação são obrigatórios.')
      return
    }

    try {
      setIsSavingVendedor(true)
      setError(null)
      setMessage(null)

      const response = await fetch(`/api/admin/vendedores/${encodeURIComponent(vendedorId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          email,
          codigoIndicacao,
          senha: senha || undefined,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Erro ao atualizar cadastro do vendedor.')
      }

      setMessage(payload?.message || 'Cadastro do vendedor atualizado com sucesso.')
      setVendedorSenha('')
      await fetchDetalhes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar cadastro do vendedor.')
    } finally {
      setIsSavingVendedor(false)
    }
  }

  const handleRegistrarPagamento = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!mesReferenciaSelecionada) {
      setError('Selecione um mês para registrar o pagamento da comissão.')
      return
    }

    try {
      setIsSavingComissao(true)
      setError(null)
      setMessage(null)

      const formData = new FormData()
      formData.append('mesReferencia', mesReferenciaSelecionada)

      if (valorPagamento.trim()) {
        formData.append('valorPago', valorPagamento.trim())
      }

      if (observacaoPagamento.trim()) {
        formData.append('observacao', observacaoPagamento.trim())
      }

      if (comprovanteFile) {
        formData.append('comprovante', comprovanteFile)
      }

      const response = await fetch(`/api/admin/vendedores/${encodeURIComponent(vendedorId)}/comissoes`, {
        method: 'POST',
        body: formData,
      })

      const payload = await response.json().catch(() => null)

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Erro ao registrar pagamento de comissão.')
      }

      setMessage(payload?.message || 'Pagamento de comissão registrado com sucesso.')
      setObservacaoPagamento('')
      setComprovanteFile(null)
      setFileInputKey((current) => current + 1)
      await fetchDetalhes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar pagamento de comissão.')
    } finally {
      setIsSavingComissao(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">Detalhes do Vendedor</h1>
            <p className="text-xs text-gray-600 sm:text-sm">Acompanhe vendas, clientes e comissão devida</p>
          </div>
          <div className="hidden flex-wrap items-center justify-end gap-2 lg:flex">
            <Button onClick={fetchDetalhes} variant="outline">Atualizar</Button>
            <Link href="/admin/vendedores">
              <Button variant="outline">Voltar para Vendedores</Button>
            </Link>
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
                  <SheetTitle>Menu Vendedor</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 px-4 pb-4">
                  <SheetClose asChild>
                    <Button onClick={fetchDetalhes} variant="outline" className="w-full justify-start">
                      Atualizar
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button asChild variant="outline" className="w-full justify-start">
                      <Link href="/admin/vendedores">Voltar para Vendedores</Link>
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

      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-sm text-green-700">{message}</p>
          </div>
        )}

        {isLoading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-600">Carregando dados do vendedor...</p>
          </div>
        ) : data ? (
          <>
            <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-gray-900">{data.vendedor.nome}</h2>
                <p className="text-sm text-gray-600">{data.vendedor.email}</p>
                <p className="text-xs font-mono text-gray-500">Código: {data.vendedor.codigoIndicacao}</p>
                <p className="text-xs text-gray-500">Status: {data.vendedor.ativo ? 'Ativo' : 'Inativo'}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Link de venda do vendedor</p>
                <div className="break-all rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-800">
                  {data.vendedor.linkVenda}
                </div>
                <Button onClick={handleCopyLink} variant="outline">Copiar Link de Venda</Button>
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Editar cadastro do vendedor</h3>
              <p className="text-sm text-gray-600">
                Atualize nome, email, código de indicação e senha de acesso.
              </p>

              <form className="space-y-4" onSubmit={handleSalvarCadastroVendedor}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-gray-700">Nome *</span>
                    <input
                      value={vendedorNome}
                      onChange={(event) => setVendedorNome(event.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      required
                      disabled={isSavingVendedor}
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm font-medium text-gray-700">Email *</span>
                    <input
                      type="email"
                      value={vendedorEmail}
                      onChange={(event) => setVendedorEmail(event.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      required
                      disabled={isSavingVendedor}
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm font-medium text-gray-700">Código de indicação *</span>
                    <input
                      value={vendedorCodigoIndicacao}
                      onChange={(event) => setVendedorCodigoIndicacao(event.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      required
                      disabled={isSavingVendedor}
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm font-medium text-gray-700">Nova senha (opcional)</span>
                    <input
                      type="password"
                      minLength={6}
                      value={vendedorSenha}
                      onChange={(event) => setVendedorSenha(event.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      placeholder="Mínimo 6 caracteres"
                      disabled={isSavingVendedor}
                    />
                  </label>
                </div>

                <p className="text-xs text-gray-500">
                  Se deixar a senha em branco, a senha atual do vendedor será mantida.
                </p>

                <Button type="submit" disabled={isSavingVendedor}>
                  {isSavingVendedor ? 'Salvando...' : 'Salvar cadastro'}
                </Button>
              </form>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-600">Clientes no link</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{data.resumo.totalClientes}</p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-600">Vendas fechadas</p>
                <p className="mt-1 text-3xl font-bold text-green-700">{data.resumo.vendasFechadas}</p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-600">Pendentes</p>
                <p className="mt-1 text-3xl font-bold text-amber-700">{data.resumo.totalPendentes}</p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-600">Comissão pendente no mês</p>
                <p className="mt-1 text-2xl font-bold text-indigo-700">
                  {formatCurrency(data.resumo.comissaoMesAtual)}
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-600">Comissão total pendente</p>
                <p className="mt-1 text-2xl font-bold text-amber-700">
                  {formatCurrency(data.resumo.comissaoTotalDevida)}
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-600">Comissão total paga</p>
                <p className="mt-1 text-2xl font-bold text-emerald-700">
                  {formatCurrency(data.resumo.comissaoTotalPaga)}
                </p>
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Fechamento de Comissão</h3>
              <p className="text-sm text-gray-600">
                Registre o pagamento por competência mensal e anexe o comprovante para auditoria.
                Em cada venda: 50% da adesão entra após 30 dias do pagamento da adesão, e 50% da
                1ª mensalidade entra apenas quando essa mensalidade estiver paga pelo cliente.
              </p>

              {comissoesPendentes.length === 0 ? (
                <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  Não há comissões pendentes para fechamento no momento.
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleRegistrarPagamento}>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <label className="space-y-1">
                      <span className="text-sm font-medium text-gray-700">Competência *</span>
                      <select
                        value={mesReferenciaSelecionada}
                        onChange={(event) => handleMesReferenciaChange(event.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        required
                        disabled={isSavingComissao}
                      >
                        {comissoesPendentes.map((item) => (
                          <option key={item.mesReferencia} value={item.mesReferencia}>
                            Mês {item.mesLabel} - {formatCurrency(item.valorPendente)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-sm font-medium text-gray-700">Valor pago (R$) *</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={valorPagamento}
                        onChange={(event) => setValorPagamento(event.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        required
                        disabled={isSavingComissao}
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-sm font-medium text-gray-700">Comprovante (opcional)</span>
                      <input
                        key={fileInputKey}
                        type="file"
                        accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                        onChange={(event) => setComprovanteFile(event.target.files?.[0] || null)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        disabled={isSavingComissao}
                      />
                    </label>
                  </div>

                  <label className="space-y-1">
                    <span className="text-sm font-medium text-gray-700">Observação (opcional)</span>
                    <textarea
                      value={observacaoPagamento}
                      onChange={(event) => setObservacaoPagamento(event.target.value)}
                      placeholder="Ex: PIX realizado na conta do vendedor"
                      className="min-h-[96px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      disabled={isSavingComissao}
                    />
                  </label>

                  {selectedComissao && (
                    <div className="space-y-1 rounded-md border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900">
                      <p className="font-semibold text-indigo-950">Mês {selectedComissao.mesLabel}</p>
                      <p>Vendas do mês: {selectedComissao.quantidadeVendas}</p>
                      <p>
                        50% das adesões (liberadas 30 dias após pagamento da adesão):{' '}
                        {formatCurrency(selectedComissao.valorAdesaoMes)}
                      </p>
                      <p>
                        50% da 1ª mensalidade (somente quando a 1ª parcela estiver paga):{' '}
                        {formatCurrency(selectedComissao.valorMensalidadeSubsequenteMes)}
                      </p>
                      <p className="font-medium">
                        Valor pendente de referência: {formatCurrency(selectedComissao.valorPendente)}
                      </p>
                    </div>
                  )}

                  <Button type="submit" disabled={isSavingComissao}>
                    {isSavingComissao ? 'Salvando...' : 'Registrar pagamento da comissão'}
                  </Button>
                </form>
              )}
            </section>

            <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Histórico mensal de comissão</h3>

              {data.comissoesMensais.length === 0 ? (
                <p className="text-sm text-gray-600">Nenhuma comissão mensal calculada até o momento.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-600">
                        <th className="py-2 pr-4">Mês</th>
                        <th className="py-2 pr-4">Vendas do mês</th>
                        <th className="py-2 pr-4">50% adesão (30 dias)</th>
                        <th className="py-2 pr-4">50% 1ª mensalidade (se paga)</th>
                        <th className="py-2 pr-4">Total da competência</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Pago em</th>
                        <th className="py-2 pr-4">Comprovante</th>
                        <th className="py-2">Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.comissoesMensais.map((item) => (
                        <tr key={item.mesReferencia} className="border-b border-gray-100">
                          <td className="py-2 pr-4 font-medium text-gray-900">Mês {item.mesLabel}</td>
                          <td className="py-2 pr-4 text-gray-700">{item.quantidadeVendas}</td>
                          <td className="py-2 pr-4 text-gray-700">
                            {formatCurrency(item.valorAdesaoMes)}
                          </td>
                          <td className="py-2 pr-4 text-gray-700">
                            {formatCurrency(item.valorMensalidadeSubsequenteMes)}
                          </td>
                          <td className="py-2 pr-4 text-gray-700">{formatCurrency(item.valorTotal)}</td>
                          <td className="py-2 pr-4">
                            <span
                              className={`rounded px-2 py-1 text-xs font-medium ${
                                item.pago ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {item.pago ? 'Pago' : 'Pendente'}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-gray-700">
                            {item.pagoEm ? new Date(item.pagoEm).toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className="py-2 pr-4 text-gray-700">
                            {item.comprovanteUrl ? (
                              <a
                                href={item.comprovanteUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-700 underline"
                              >
                                Ver comprovante
                              </a>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-2 text-gray-700">{item.observacao || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Clientes deste vendedor</h3>

              {tableRows.length === 0 ? (
                <p className="text-sm text-gray-600">Nenhum cliente vinculado a este vendedor.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-600">
                        <th className="py-2 pr-4">Cliente</th>
                        <th className="py-2 pr-4">Email</th>
                        <th className="py-2 pr-4">Plano</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Comissão</th>
                        <th className="py-2 pr-4">Pago em</th>
                        <th className="py-2">Cliente desde</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((cliente) => {
                        const pago = cliente.status === 'ATIVO'

                        return (
                          <tr key={cliente.id} className="border-b border-gray-100">
                            <td className="py-2 pr-4 font-medium text-gray-900">{cliente.nome}</td>
                            <td className="py-2 pr-4 text-gray-700">{cliente.email}</td>
                            <td className="py-2 pr-4 text-gray-700">{cliente.tipo_plano || '-'}</td>
                            <td className="py-2 pr-4">
                              <span
                                className={`rounded px-2 py-1 text-xs font-medium ${
                                  pago ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {pago ? 'Pago' : 'Pendente'}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-gray-700">
                              {formatCurrency(calculateCadastroComissaoValue(cliente))}
                            </td>
                            <td className="py-2 pr-4 text-gray-700">
                              {cliente.adesao_pago_em
                                ? new Date(cliente.adesao_pago_em).toLocaleDateString('pt-BR')
                                : '-'}
                            </td>
                            <td className="py-2 text-gray-700">
                              {new Date(cliente.created_at).toLocaleDateString('pt-BR')}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-600">Sem dados para exibir.</p>
            <Link href="/admin/vendedores" className="mt-3 inline-block">
              <Button variant="outline">Voltar para Vendedores</Button>
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
