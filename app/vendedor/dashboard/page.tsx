'use client'

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { calculateCadastroComissaoValue } from '@/lib/comissoes'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { bustClientCache, useCachedFetch } from '@/lib/hooks/use-cached-fetch'

type CadastroVendedor = {
  id: string
  nome: string
  email: string
  cpf: string
  status: string
  created_at: string
  adesao_pago_em?: string | null
  mensalidade_valor?: number | null
  vendedor_codigo?: string | null
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
  vendedor: {
    id: string
    nome: string
    email: string
    codigoIndicacao: string
    linkVenda: string
  }
  resumo: {
    totalClientes: number
    totalPagos: number
    totalPendentes: number
    totalPagoMesAtual: number
    totalPagoMesAtualBruto: number
    totalPagoMesAtualPaga: number
    comissaoTotalPaga: number
    comissaoTotalDevida: number
  }
  comissoesMensais: ComissaoMensal[]
  cadastros: CadastroVendedor[]
}

export default function VendedorDashboardPage() {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSavingPerfil, setIsSavingPerfil] = useState(false)
  const [vendedorNome, setVendedorNome] = useState('')
  const [vendedorEmail, setVendedorEmail] = useState('')
  const [vendedorCodigoIndicacao, setVendedorCodigoIndicacao] = useState('')
  const [vendedorSenha, setVendedorSenha] = useState('')

  const {
    data,
    isLoading,
    isValidating,
    error,
    revalidate: revalidateResumo,
  } = useCachedFetch<ResumoPayload>('/api/vendedor/resumo', {
    ttl: 45,
    revalidateOnFocus: true,
  })

  // Redirect on 401 is handled via error message detection
  useEffect(() => {
    if (error && /401|não autenticado|unauthorized/i.test(error)) {
      router.push('/vendedor/login')
    }
  }, [error, router])

  // Hydrate perfil form whenever data loads
  useEffect(() => {
    if (!data?.vendedor) return
    setVendedorNome(data.vendedor.nome || '')
    setVendedorEmail(data.vendedor.email || '')
    setVendedorCodigoIndicacao(data.vendedor.codigoIndicacao || '')
  }, [data?.vendedor])

  const handleLogout = async () => {
    try {
      await fetch('/api/vendedor/logout', { method: 'POST' })
      router.push('/vendedor/login')
    } catch (err) {
      console.error('Vendedor logout error:', err)
    }
  }

  const handleCopyLink = async () => {
    if (!data?.vendedor.linkVenda) return

    try {
      await navigator.clipboard.writeText(data.vendedor.linkVenda)
      setMessage('Link de venda copiado com sucesso.')
    } catch {
      setMessage('Não foi possível copiar o link automaticamente.')
    }
  }

  const handleSalvarPerfil = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nome = vendedorNome.trim()
    const email = vendedorEmail.trim().toLowerCase()
    const codigoIndicacao = vendedorCodigoIndicacao.trim()
    const senha = vendedorSenha.trim()

    if (!nome || !email || !codigoIndicacao) {
      setFormError('Nome, email e código de indicação são obrigatórios.')
      return
    }

    try {
      setIsSavingPerfil(true)
      setFormError(null)
      setMessage(null)

      const response = await fetch('/api/vendedor/perfil', {
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
        router.push('/vendedor/login')
        return
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Erro ao atualizar seu cadastro.')
      }

      setMessage(payload?.message || 'Seu cadastro foi atualizado com sucesso.')
      setVendedorSenha('')
      bustClientCache('/api/vendedor/resumo')
      revalidateResumo()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao atualizar seu cadastro.')
    } finally {
      setIsSavingPerfil(false)
    }
  }

  const formatCurrency = useCallback(
    (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    []
  )

  const tableRows = useMemo(() => data?.cadastros || [], [data?.cadastros])
  const comissoesMensais = useMemo(() => data?.comissoesMensais || [], [data?.comissoesMensais])

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">Painel do Vendedor</h1>
            <p className="text-xs text-gray-600 sm:text-sm">Acompanhe suas vendas por link de indicação</p>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <Button onClick={revalidateResumo} variant="outline">Atualizar</Button>
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
                    <Button onClick={revalidateResumo} variant="outline" className="w-full justify-start">
                      Atualizar
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
        {(error || formError) && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{formError || error}</p>
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
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Seu link de venda</p>
                <div className="break-all rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-800">
                  {data.vendedor.linkVenda}
                </div>
                <Button onClick={handleCopyLink} variant="outline">Copiar Link de Venda</Button>
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Meu cadastro</h3>
              <p className="text-sm text-gray-600">
                Atualize seus dados de acesso e seu código de indicação.
              </p>

              <form className="space-y-4" onSubmit={handleSalvarPerfil}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-gray-700">Nome *</span>
                    <input
                      value={vendedorNome}
                      onChange={(event) => setVendedorNome(event.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      required
                      disabled={isSavingPerfil}
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
                      disabled={isSavingPerfil}
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm font-medium text-gray-700">Código de indicação *</span>
                    <input
                      value={vendedorCodigoIndicacao}
                      onChange={(event) => setVendedorCodigoIndicacao(event.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      required
                      disabled={isSavingPerfil}
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
                      disabled={isSavingPerfil}
                    />
                  </label>
                </div>

                <p className="text-xs text-gray-500">
                  Se deixar a senha em branco, sua senha atual será mantida.
                </p>

                <Button type="submit" disabled={isSavingPerfil}>
                  {isSavingPerfil ? 'Salvando...' : 'Salvar meu cadastro'}
                </Button>
              </form>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-600">Clientes via seu link</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{data.resumo.totalClientes}</p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-600">Adesões pagas</p>
                <p className="mt-1 text-3xl font-bold text-green-700">{data.resumo.totalPagos}</p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-600">Adesões pendentes</p>
                <p className="mt-1 text-3xl font-bold text-amber-700">{data.resumo.totalPendentes}</p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-600">Comissão pendente no mês</p>
                <p className="mt-1 text-2xl font-bold text-indigo-700">
                  {formatCurrency(data.resumo.totalPagoMesAtual)}
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-600">Comissão total pendente</p>
                <p className="mt-1 text-2xl font-bold text-amber-700">
                  {formatCurrency(data.resumo.comissaoTotalDevida)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Total já pago: {formatCurrency(data.resumo.comissaoTotalPaga)}
                </p>
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Histórico mensal de comissão</h3>
              <p className="text-sm text-gray-600">
                Regra por venda: 50% da adesão após 30 dias e 50% da 1ª mensalidade somente
                quando essa mensalidade estiver paga.
              </p>

              {comissoesMensais.length === 0 ? (
                <p className="text-sm text-gray-600">Nenhuma comissão mensal calculada até o momento.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-600">
                        <th className="py-2 pr-4">Mês</th>
                        <th className="py-2 pr-4">Vendas</th>
                        <th className="py-2 pr-4">Comissão</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Pago em</th>
                        <th className="py-2 pr-4">Comprovante</th>
                        <th className="py-2">Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comissoesMensais.map((item) => (
                        <tr key={item.mesReferencia} className="border-b border-gray-100">
                          <td className="py-2 pr-4 font-medium text-gray-900">{item.mesLabel}</td>
                          <td className="py-2 pr-4 text-gray-700">{item.quantidadeVendas}</td>
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
              <h3 className="text-lg font-semibold text-gray-900">Clientes que utilizaram seu link</h3>

              {tableRows.length === 0 ? (
                <p className="text-sm text-gray-600">Nenhum cliente vinculado ao seu link até o momento.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-600">
                        <th className="py-2 pr-4">Cliente</th>
                        <th className="py-2 pr-4">Email</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Comissão da venda</th>
                        <th className="py-2 pr-4">Pago em</th>
                        <th className="py-2">Cliente desde</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((cadastro) => {
                        const pago = cadastro.status === 'ATIVO'

                        return (
                          <tr key={cadastro.id} className="border-b border-gray-100">
                            <td className="py-2 pr-4 font-medium text-gray-900">{cadastro.nome}</td>
                            <td className="py-2 pr-4 text-gray-700">{cadastro.email}</td>
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
                              {formatCurrency(calculateCadastroComissaoValue(cadastro))}
                            </td>
                            <td className="py-2 pr-4 text-gray-700">
                              {cadastro.adesao_pago_em
                                ? new Date(cadastro.adesao_pago_em).toLocaleDateString('pt-BR')
                                : '-'}
                            </td>
                            <td className="py-2 text-gray-700">
                              {new Date(cadastro.created_at).toLocaleDateString('pt-BR')}
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
            <Link href="/vendedor/login" className="mt-3 inline-block">
              <Button variant="outline">Voltar ao Login</Button>
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
