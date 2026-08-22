"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Building2, Plus, RefreshCw, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Empresa } from "@/lib/types"

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
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

  const fetchEmpresas = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch("/api/admin/empresas")
      if (!res.ok) {
        if (res.status === 401) { router.push("/admin/login"); return }
        throw new Error("Erro ao carregar empresas")
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

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" })
    router.push("/admin/login")
  }

  const filtered = empresas.filter((e) => {
    const q = search.toLowerCase()
    return !q || e.razao_social?.toLowerCase().includes(q) || e.cnpj?.includes(q) || e.email?.toLowerCase().includes(q)
  })

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">Empresas</h1>
            <p className="text-xs text-gray-600 sm:text-sm">Gestão de empresas conveniadas</p>
          </div>
          <div className="hidden flex-wrap items-center justify-end gap-2 lg:flex">
            <Link href="/admin/dashboard"><Button variant="outline">Dashboard</Button></Link>
            <Link href="/admin/cadastros"><Button variant="outline">Clientes</Button></Link>
            <Link href="/admin/empresas/nova">
              <Button className="gap-2 bg-teal-700 hover:bg-teal-800">
                <Plus className="h-4 w-4" /> Nova Empresa
              </Button>
            </Link>
            <Button onClick={handleLogout} variant="outline">Sair</Button>
          </div>
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Abrir menu"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader><SheetTitle>Menu</SheetTitle></SheetHeader>
                <div className="flex flex-col gap-2 px-4 pb-4">
                  <SheetClose asChild><Button asChild variant="outline" className="w-full justify-start"><Link href="/admin/dashboard">Dashboard</Link></Button></SheetClose>
                  <SheetClose asChild><Button asChild variant="outline" className="w-full justify-start"><Link href="/admin/cadastros">Clientes</Link></Button></SheetClose>
                  <SheetClose asChild>
                    <Button asChild className="w-full justify-start gap-2 bg-teal-700 hover:bg-teal-800">
                      <Link href="/admin/empresas/nova"><Plus className="h-4 w-4" /> Nova Empresa</Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild><Button onClick={handleLogout} variant="outline" className="w-full justify-start">Sair</Button></SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

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
            <p className="text-sm text-gray-600">Total de Funcionários</p>
            <p className="mt-1 text-2xl font-bold text-teal-700">
              {empresas.reduce((acc, e) => acc + (e.quantidade_funcionarios || 0), 0)}
            </p>
          </div>
        </div>

        {/* Busca + botão */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            placeholder="Buscar por razão social, CNPJ ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
          <div className="flex gap-2">
            <Button onClick={fetchEmpresas} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" /> Atualizar
            </Button>
            <Link href="/admin/empresas/nova">
              <Button className="gap-2 bg-teal-700 hover:bg-teal-800">
                <Plus className="h-4 w-4" /> Nova Empresa
              </Button>
            </Link>
          </div>
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
                <Button className="mt-4 gap-2 bg-teal-700 hover:bg-teal-800">
                  <Plus className="h-4 w-4" /> Cadastrar primeira empresa
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-700">Empresa</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-700">CNPJ</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-700">Responsável</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-700">Funcionários</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-700">Mensalidade</th>
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
                          <p className="font-medium text-gray-900">{empresa.razao_social}</p>
                          {empresa.nome_fantasia && (
                            <p className="text-xs text-gray-500">{empresa.nome_fantasia}</p>
                          )}
                          <p className="text-xs text-gray-500">{empresa.email}</p>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-gray-700">
                          {empresa.cnpj.replace(/^(d{2})(d{3})(d{3})(d{4})(d{2})$/, "$1.$2.$3/$4-$5")}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{empresa.responsavel_nome}</td>
                        <td className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                          {empresa.quantidade_funcionarios ?? "—"}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-teal-700">
                          {formatCurrency(empresa.mensalidade_valor)}
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
