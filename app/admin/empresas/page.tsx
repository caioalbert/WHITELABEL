'use client'

import { AdminPageHeader } from '@/components/admin/page-header'

import { Button } from '@/components/ui/button'
import { Empresa } from '@/lib/types'
import { Building2, Plus, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  INATIVO: { label: "Inativo", className: "bg-gray-100 text-gray-700" },
  ATIVO:                       { label: "Ativo",               className: "bg-emerald-100 text-emerald-700" },
  CADASTRO_CONCLUIDO:          { label: "Cadastro",            className: "bg-sky-100 text-sky-700" },
  ORCAMENTO_SOLICITADO:        { label: "Orçamento",           className: "bg-amber-100 text-amber-700" },
  LISTA_FUNCIONARIOS_ENVIADA:  { label: "Lista enviada",       className: "bg-violet-100 text-violet-700" },
  PENDENTE_PAGAMENTO:          { label: "Pend. Pagamento",     className: "bg-rose-100 text-rose-700" },
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "—"
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export default function AdminEmpresasPage() {
  const router = useRouter()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("TODAS")

  const fetchEmpresas = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch("/api/admin/empresas")
      if (!res.ok) {
        if (res.status === 401) { router.push("/admin/login"); return }
        const payload = await res.json().catch(() => null) as { error?: string } | null
        throw new Error(payload?.error || "Erro ao carregar empresas")
      }
      const data = await res.json()
      setEmpresas(data.empresas || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => { fetchEmpresas() }, [fetchEmpresas])

  const filtered = empresas.filter((e) => {
    const q = search.trim().toLowerCase()
    const digits = q.replace(/\D/g, '')
    const matchesSearch = !q || e.razao_social?.toLowerCase().includes(q) || e.nome_fantasia?.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q) || (digits.length > 0 && e.cnpj?.replace(/\D/g, '').includes(digits))
    const matchesStatus = statusFilter === "TODAS" || (statusFilter === "PENDENTES" ? !["ATIVO", "INATIVO"].includes(e.status) : e.status === statusFilter)
    return matchesSearch && matchesStatus
  })

  return (
    <main className="min-h-screen bg-gray-50">
      <AdminPageHeader title="Empresas" description="Convênios, colaboradores e condições comerciais."></AdminPageHeader>

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-600">Total de Empresas</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{empresas.length}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-600">Empresas Ativas</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">
              {empresas.filter((e) => e.status === "ATIVO").length}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-600">Total de Colaboradores</p>
            <p className="mt-1 text-2xl font-bold text-blue-700">
              {empresas.reduce((acc, e) => acc + (e.quantidade_funcionarios || 0), 0)}
            </p>
          </div>
        </div>

        {/* Busca + botão */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="search"
            aria-label="Buscar empresas"
            placeholder="Buscar por razão social, CNPJ ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <div className="flex gap-2">
            <Button onClick={fetchEmpresas} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" /> Atualizar
            </Button>
            <Link href="/admin/empresas/nova">
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4" /> Nova Empresa
              </Button>
            </Link>
          </div>
        </div>

        <div className="admin-status-filters" role="group" aria-label="Filtrar empresas por situação">
          {[['TODAS', 'Todas'], ['ATIVO', 'Ativas'], ['PENDENTES', 'Pendentes'], ['INATIVO', 'Inativas']].map(([value, label]) => <button key={value} type="button" aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>{label}</button>)}
        </div>
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="font-medium text-red-700">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <p className="text-gray-600">Carregando empresas...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <Building2 className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <p className="text-lg font-medium text-gray-700">
              {empresas.length === 0 ? "Nenhuma empresa cadastrada" : "Nenhuma empresa encontrada"}
            </p>
            {empresas.length === 0 && (
              <Link href="/admin/empresas/nova">
                <Button className="mt-4 gap-2 bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4" /> Cadastrar primeira empresa
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="admin-company-table w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-700">Empresa</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-700">CNPJ</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-700">Responsável</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-700">Colaboradores</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-700">Mensalidade</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-700">Condições de pagamento</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-700">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-700">Cadastro</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((empresa) => {
                    const status = STATUS_LABELS[empresa.status] ?? { label: empresa.status, className: "bg-gray-100 text-gray-700" }
                    return (
                      <tr key={empresa.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <Link href={`/admin/empresas/${empresa.id}`} className="font-medium text-blue-700 underline-offset-4 hover:underline">{empresa.razao_social}</Link>
                          {empresa.nome_fantasia && (
                            <p className="text-xs text-gray-500">{empresa.nome_fantasia}</p>
                          )}
                          <p className="text-xs text-gray-500">{empresa.email}</p>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-gray-700">
                          {empresa.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{empresa.responsavel_nome}</td>
                        <td className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                          {empresa.quantidade_funcionarios ?? "—"}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-blue-700">
                          {formatCurrency(empresa.mensalidade_valor)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {empresa.primeira_parcela_vencimento ? <>
                            <p>1ª parcela: {empresa.primeira_parcela_vencimento.split('-').reverse().join('/')}</p>
                            <p>{empresa.contrato_meses} parcela(s) no total</p>
                            {(empresa.contrato_meses ?? 0) > 1 && <p>Demais: dia {empresa.dia_vencimento}</p>}
                          </> : 'Condições anteriores'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={"inline-flex items-center rounded px-2 py-1 text-xs font-medium " + status.className}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(empresa.created_at).toLocaleDateString("pt-BR")}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
