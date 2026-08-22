'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Copy, Check, Menu, ExternalLink, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

type Parceiro = {
  id: string
  nome: string
  email: string
  codigo_indicacao: string
  ativo: boolean
  comissao_percentual_mensalidade: number
  comissao_mensalidades_max: number | null
  sem_adesao: boolean
  created_at: string
}

export default function AdminParceirosPage() {
  const router = useRouter()
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [actionParceiroId, setActionParceiroId] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Create form state
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [codigoIndicacao, setCodigoIndicacao] = useState('')
  const [comissaoPercentual, setComissaoPercentual] = useState('50')
  const [comissaoPercentualAdesao, setComissaoPercentualAdesao] = useState('0')
  const [comissaoMaxInput, setComissaoMaxInput] = useState('')
  const [semAdesao, setSemAdesao] = useState(true)

  const appUrl = useMemo(
    () => (typeof window !== 'undefined' ? window.location.origin : ''),
    []
  )

  const fetchParceiros = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/admin/parceiros', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Erro ao carregar parceiros.')
      }

      setParceiros(payload?.parceiros || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar parceiros.')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchParceiros()
  }, [fetchParceiros])

  const handleToggleAtivo = async (parceiroId: string, currentAtivo: boolean) => {
    try {
      setActionParceiroId(parceiroId)
      setError(null)
      setMessage(null)

      const response = await fetch(`/api/admin/parceiros/${parceiroId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !currentAtivo }),
      })

      const payload = await response.json().catch(() => null)

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Erro ao atualizar parceiro.')
      }

      setMessage(`Parceiro ${currentAtivo ? 'desativado' : 'ativado'} com sucesso.`)
      await fetchParceiros()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar parceiro.')
    } finally {
      setActionParceiroId(null)
    }
  }

  const handleDeleteParceiro = async (parceiroId: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir o parceiro "${nome}"? Esta ação não pode ser desfeita.`)) return
    try {
      setDeletingId(parceiroId)
      setError(null)
      setMessage(null)
      const res = await fetch(`/api/admin/parceiros/${parceiroId}`, { method: 'DELETE' })
      const payload = await res.json().catch(() => null)
      if (res.status === 401) { router.push('/admin/login'); return }
      if (!res.ok) throw new Error(payload?.error || 'Erro ao excluir parceiro.')
      setMessage(`Parceiro "${nome}" excluído com sucesso.`)
      await fetchParceiros()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir parceiro.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleCreate = async () => {
    try {
      setIsSaving(true)
      setError(null)
      setMessage(null)

      const comissaoMensalidadesMax = comissaoMaxInput.trim() === '' ? null : Number(comissaoMaxInput)

      const response = await fetch('/api/admin/parceiros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          email,
          senha,
          codigoIndicacao: 'PARCEIRO-' + nome.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
          comissaoPercentualMensalidade: Number(comissaoPercentual),
          comissaoPercentualAdesao: Number(comissaoPercentualAdesao),
          comissaoMensalidadesMax,
          semAdesao,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Erro ao criar parceiro.')
      }

      setMessage('Parceiro criado com sucesso.')
      setIsCreateDialogOpen(false)
      setNome('')
      setEmail('')
      setSenha('')
      setCodigoIndicacao('')
      setComissaoPercentual('50')
      setComissaoPercentualAdesao('0')
      setComissaoMaxInput('')
      setSemAdesao(true)
      await fetchParceiros()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar parceiro.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCopyLink = async (codigo: string, id: string) => {
    try {
      await navigator.clipboard.writeText(`${appUrl}/cadastro?ref=${codigo}`)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // ignore
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
      router.push('/admin/login')
    } catch {
      // ignore
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">Parceiros/Parceiros</h1>
            <p className="text-xs text-gray-600 sm:text-sm">Cadastre parceiros com links de venda e comissões sobre mensalidades</p>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <Link href="/admin/dashboard">
              <Button variant="outline">Dashboard</Button>
            </Link>
            <Link href="/admin/configuracoes">
              <Button variant="outline">Configurações</Button>
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
                <SheetHeader><SheetTitle>Menu</SheetTitle></SheetHeader>
                <div className="flex flex-col gap-2 px-4 pb-4">
                  <SheetClose asChild><Button asChild variant="outline" className="w-full justify-start"><Link href="/admin/dashboard">Dashboard</Link></Button></SheetClose>
                  <SheetClose asChild><Button asChild variant="outline" className="w-full justify-start"><Link href="/admin/configuracoes">Configurações</Link></Button></SheetClose>
                  <SheetClose asChild><Button onClick={handleLogout} variant="outline" className="w-full justify-start">Sair</Button></SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

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

        <div className="flex justify-end">
          <Button onClick={() => { setIsCreateDialogOpen(true); setError(null); setMessage(null) }}>
            + Novo Parceiro
          </Button>
        </div>

        <div className="rounded-lg bg-white shadow overflow-hidden">
          {isLoading ? (
            <p className="p-6 text-sm text-gray-500">Carregando parceiros...</p>
          ) : parceiros.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">Nenhum parceiro cadastrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left">
                    <th className="px-4 py-3 font-medium text-gray-600">Nome</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Email</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Código</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Comissão</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Adesão</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parceiros.map((parceiro) => (
                    <tr key={parceiro.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">{parceiro.nome}</td>
                      <td className="px-4 py-3 text-gray-600">{parceiro.email}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-700">{parceiro.codigo_indicacao}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {parceiro.comissao_percentual_mensalidade}%
                        {' / '}
                        {parceiro.comissao_mensalidades_max === null
                          ? 'Vitalício'
                          : parceiro.comissao_mensalidades_max === 1
                          ? '1ª mensalidade'
                          : `${parceiro.comissao_mensalidades_max} mensalidades`}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          parceiro.sem_adesao ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {parceiro.sem_adesao ? 'Sem adesão' : 'Com adesão'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${parceiro.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {parceiro.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => handleCopyLink(parceiro.codigo_indicacao, parceiro.id)}
                          >
                            {copiedId === parceiro.id
                              ? <><Check className="h-3.5 w-3.5 text-green-600" /> Copiado</>
                              : <><Copy className="h-3.5 w-3.5" /> Link</>}
                          </Button>
                          <Link href={`/admin/parceiros/${parceiro.id}`}>
                            <Button size="sm" variant="outline">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actionParceiroId === parceiro.id}
                            onClick={() => handleToggleAtivo(parceiro.id, parceiro.ativo)}
                          >
                            {parceiro.ativo ? 'Desativar' : 'Ativar'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-500 hover:bg-red-50 hover:text-red-700"
                            disabled={deletingId === parceiro.id}
                            onClick={() => handleDeleteParceiro(parceiro.id, parceiro.nome)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Dialog de criação */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Parceiro/Parceiro</DialogTitle>
            <DialogDescription>
              Clientes captados pelo parceiro não pagam adesão. A 1ª mensalidade vence em 30 dias.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            <label className="block space-y-1">
              <span className="text-sm font-medium text-gray-700">Nome *</span>
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-gray-700">Email *</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-gray-700">Senha *</span>
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Link gerado automaticamente:</p>
              <p className="font-mono text-xs text-gray-700">/cadastro?ref=PARCEIRO-{nome.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'NOME'}</p>
            </div>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-gray-700">% Comissão sobre Mensalidade</span>
              <input type="number" min="0" max="100" step="0.5" value={comissaoPercentual} onChange={(e) => setComissaoPercentual(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className={`block space-y-1 ${semAdesao ? 'opacity-40' : ''}`}>
              <span className="text-sm font-medium text-gray-700">% Comissão sobre Adesão</span>
              <input type="number" min="0" max="100" step="0.5" value={comissaoPercentualAdesao} onChange={(e) => setComissaoPercentualAdesao(e.target.value)} disabled={semAdesao} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              {semAdesao && <p className="text-xs text-gray-400">Desabilitado (sem adesão)</p>}
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-gray-700">Nº de Mensalidades que geram comissão</span>
              <input type="number" min="1" value={comissaoMaxInput} onChange={(e) => setComissaoMaxInput(e.target.value)} placeholder="Deixe em branco para Vitalício" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <p className="text-xs text-gray-500">Vazio = Vitalício (todas as mensalidades)</p>
            </label>
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
              <input
                type="checkbox"
                id="semAdesao"
                checked={semAdesao}
                onChange={(e) => setSemAdesao(e.target.checked)}
                className="h-4 w-4 accent-teal-700"
              />
              <div>
                <label htmlFor="semAdesao" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Isentar adesão dos clientes deste parceiro
                </label>
                <p className="text-xs text-gray-500">Se marcado, clientes não pagarão taxa de adesão ao se cadastrar.</p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={isSaving || !nome || !email || !senha}>
              {isSaving ? 'Criando...' : 'Criar Parceiro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
