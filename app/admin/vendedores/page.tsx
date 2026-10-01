'use client'

import { AdminPageHeader } from '@/components/admin/page-header'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

type Vendedor = {
  id: string
  nome: string
  email: string
  codigo_indicacao: string
  ativo: boolean
  created_at: string
}

export default function AdminVendedoresPage() {
  const router = useRouter()
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [actionVendedorId, setActionVendedorId] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [codigoIndicacao, setCodigoIndicacao] = useState('')

  const appUrl = useMemo(
    () => (typeof window !== 'undefined' ? window.location.origin : ''),
    []
  )

  const fetchVendedores = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/admin/vendedores', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Erro ao buscar vendedores.')
      }

      setVendedores(payload?.vendedores || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar vendedores.')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchVendedores()
  }, [fetchVendedores])

  const handleCreate = async () => {
    try {
      setIsSaving(true)
      setError(null)
      setMessage(null)

      const response = await fetch('/api/admin/vendedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          email,
          senha,
          codigoIndicacao,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Erro ao criar vendedor.')
      }

      setMessage(payload?.message || 'Vendedor criado com sucesso.')
      setNome('')
      setEmail('')
      setSenha('')
      setCodigoIndicacao('')
      setIsCreateDialogOpen(false)
      await fetchVendedores()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar vendedor.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCopyLink = async (codigoIndicacao: string) => {
    const link = `${appUrl}/cadastro?ref=${encodeURIComponent(codigoIndicacao)}`

    try {
      await navigator.clipboard.writeText(link)
      setMessage(`Link copiado: ${codigoIndicacao}`)
    } catch {
      setError('Não foi possível copiar automaticamente.')
    }
  }

  const handleToggleStatus = async (vendedor: Vendedor) => {
    const nextAtivo = !vendedor.ativo
    const confirmMessage = nextAtivo
      ? `Deseja desbloquear o vendedor "${vendedor.nome}"?`
      : `Deseja bloquear o vendedor "${vendedor.nome}"?`

    if (!window.confirm(confirmMessage)) {
      return
    }

    try {
      setActionVendedorId(vendedor.id)
      setError(null)
      setMessage(null)

      const response = await fetch(`/api/admin/vendedores/${encodeURIComponent(vendedor.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: nextAtivo }),
      })

      const payload = await response.json().catch(() => null)

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Erro ao atualizar status do vendedor.')
      }

      setMessage(
        payload?.message ||
          (nextAtivo ? 'Vendedor desbloqueado com sucesso.' : 'Vendedor bloqueado com sucesso.')
      )
      await fetchVendedores()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status do vendedor.')
    } finally {
      setActionVendedorId(null)
    }
  }

  const handleDelete = async (vendedor: Vendedor) => {
    const confirmed = window.confirm(
      `Deseja realmente excluir o vendedor "${vendedor.nome}"?\n\nEssa ação remove o acesso do vendedor e não pode ser desfeita.`
    )

    if (!confirmed) {
      return
    }

    try {
      setActionVendedorId(vendedor.id)
      setError(null)
      setMessage(null)

      const response = await fetch(`/api/admin/vendedores/${encodeURIComponent(vendedor.id)}`, {
        method: 'DELETE',
      })

      const payload = await response.json().catch(() => null)

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Erro ao excluir vendedor.')
      }

      setMessage(payload?.message || 'Vendedor excluído com sucesso.')
      await fetchVendedores()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir vendedor.')
    } finally {
      setActionVendedorId(null)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <AdminPageHeader title="Vendedores" description="Equipe comercial, links de venda e comissões."><Button onClick={() => setIsCreateDialogOpen(true)}>Cadastrar novo vendedor</Button></AdminPageHeader>

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
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

        <section className="rounded-lg bg-white p-6 shadow space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Vendedores Cadastrados</h2>

          {isLoading ? (
            <p className="text-sm text-gray-600">Carregando vendedores...</p>
          ) : vendedores.length === 0 ? (
            <p className="text-sm text-gray-600">Nenhum vendedor cadastrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600">
                    <th className="py-2 pr-4">Nome</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Código</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {vendedores.map((vendedor) => (
                    <tr key={vendedor.id} className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-medium">
                        <Link
                          href={`/admin/vendedores/${vendedor.id}`}
                          className="text-blue-700 hover:text-blue-800 hover:underline"
                        >
                          {vendedor.nome}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-gray-700">{vendedor.email}</td>
                      <td className="py-2 pr-4 font-mono text-xs text-gray-700">{vendedor.codigo_indicacao}</td>
                      <td className="py-2 pr-4">
                        <span className={`rounded px-2 py-1 text-xs font-medium ${vendedor.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {vendedor.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyLink(vendedor.codigo_indicacao)}
                            disabled={actionVendedorId === vendedor.id}
                          >
                            Copiar Link
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleStatus(vendedor)}
                            disabled={actionVendedorId === vendedor.id}
                          >
                            {actionVendedorId === vendedor.id
                              ? 'Processando...'
                              : vendedor.ativo
                                ? 'Bloquear'
                                : 'Desbloquear'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(vendedor)}
                            disabled={actionVendedorId === vendedor.id}
                          >
                            Excluir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          if (!isSaving) {
            setIsCreateDialogOpen(open)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo vendedor</DialogTitle>
            <DialogDescription>
              Preencha os dados para criar o acesso e o link de venda do vendedor.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault()
              await handleCreate()
            }}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-medium text-gray-700">Nome *</span>
                <input
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Nome do vendedor"
                  required
                  disabled={isSaving}
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-gray-700">Email *</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="vendedor@empresa.com"
                  required
                  disabled={isSaving}
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-gray-700">Senha inicial *</span>
                <input
                  type="password"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  disabled={isSaving}
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-gray-700">Código de indicação (opcional)</span>
                <input
                  value={codigoIndicacao}
                  onChange={(event) => setCodigoIndicacao(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Ex: JOAO-SILVA"
                  disabled={isSaving}
                />
              </label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Criando...' : 'Cadastrar vendedor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  )
}
