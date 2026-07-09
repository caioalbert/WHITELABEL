'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Menu, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

type Instituto = {
  id: string
  nome: string
  email: string
  codigo_indicacao: string
  ativo: boolean
  comissao_percentual_mensalidade: number
  comissao_percentual_adesao: number
  comissao_mensalidades_max: number | null
  sem_adesao: boolean
  created_at: string
}

type InstitutoPlano = {
  id: string
  instituto_id: string
  nome: string
  descricao: string
  valor: number
  permite_dependentes: boolean
  dependentes_minimos: number
  max_dependentes: number | null
  valor_dependente_adicional: number
  ativo: boolean
  ordem: number
}

type NewPlanoForm = {
  nome: string
  descricao: string
  valor: string
  permiteDependentes: boolean
  dependentesMinimos: string
  maxDependentes: string
  valorDependenteAdicional: string
}

const emptyNewPlano: NewPlanoForm = {
  nome: '',
  descricao: '',
  valor: '',
  permiteDependentes: false,
  dependentesMinimos: '1',
  maxDependentes: '4',
  valorDependenteAdicional: '0',
}

export default function AdminInstitutoDetailPage() {
  const router = useRouter()
  const params = useParams()
  const institutoId = params?.id as string

  const [instituto, setInstituto] = useState<Instituto | null>(null)
  const [institutoPlanos, setInstitutoPlanos] = useState<InstitutoPlano[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingComissao, setIsSavingComissao] = useState(false)
  const [isDeletingPlan, setIsDeletingPlan] = useState<string | null>(null)
  const [isAddingPlan, setIsAddingPlan] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editPlanoForm, setEditPlanoForm] = useState<NewPlanoForm>(emptyNewPlano)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Comissão form state
  const [comissaoPercentualMensalidade, setComissaoPercentualMensalidade] = useState('50')
  const [comissaoPercentualAdesao, setComissaoPercentualAdesao] = useState('0')
  const [comissaoModo, setComissaoModo] = useState<'primeiro' | 'custom' | 'vitalicio'>('primeiro')
  const [comissaoMaxCustom, setComissaoMaxCustom] = useState('1')
  const [semAdesao, setSemAdesao] = useState(true)

  // New plan form
  const [newPlano, setNewPlano] = useState<NewPlanoForm>(emptyNewPlano)

  const fetchData = useCallback(async () => {
    if (!institutoId) return
    try {
      setIsLoading(true)
      setError(null)

      const [institutoRes, planosRes] = await Promise.all([
        fetch(`/api/admin/institutos/${institutoId}`, { cache: 'no-store' }),
        fetch(`/api/admin/institutos/${institutoId}/planos`, { cache: 'no-store' }),
      ])

      if (institutoRes.status === 401) {
        router.push('/admin/login')
        return
      }

      const institutoPayload = await institutoRes.json().catch(() => null)
      if (!institutoRes.ok) {
        throw new Error(institutoPayload?.error || 'Erro ao carregar instituto.')
      }

      const inst = institutoPayload?.instituto as Instituto
      setInstituto(inst)

      // Hydrate comissão form
      setComissaoPercentualMensalidade(String(inst.comissao_percentual_mensalidade ?? 50))
      setComissaoPercentualAdesao(String(inst.comissao_percentual_adesao ?? 0))
      const maxVal = inst.comissao_mensalidades_max
      if (maxVal === null) setComissaoModo('vitalicio')
      else if (maxVal === 1) setComissaoModo('primeiro')
      else { setComissaoModo('custom'); setComissaoMaxCustom(String(maxVal)) }
      setSemAdesao(inst.sem_adesao !== false)

      const planosPayload = await planosRes.json().catch(() => null)
      setInstitutoPlanos(Array.isArray(planosPayload?.planos) ? planosPayload.planos : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados.')
    } finally {
      setIsLoading(false)
    }
  }, [institutoId, router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSaveComissao = async () => {
    try {
      setIsSavingComissao(true)
      setError(null)
      setMessage(null)

      const comissaoMensalidadesMax =
        comissaoModo === 'vitalicio' ? null
        : comissaoModo === 'primeiro' ? 1
        : Number(comissaoMaxCustom)

      const response = await fetch(`/api/admin/institutos/${institutoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comissaoPercentualMensalidade: Number(comissaoPercentualMensalidade),
          comissaoPercentualAdesao: Number(comissaoPercentualAdesao),
          comissaoMensalidadesMax,
          semAdesao,
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Erro ao salvar comissão.')

      setMessage('Configurações de comissão salvas com sucesso.')
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar comissão.')
    } finally {
      setIsSavingComissao(false)
    }
  }

  const handleAddPlan = async () => {
    const nome = newPlano.nome.trim()
    const valor = Number(newPlano.valor)
    if (!nome) { setError('Nome do plano é obrigatório.'); return }
    if (!Number.isFinite(valor) || valor <= 0) { setError('Valor do plano deve ser maior que zero.'); return }

    try {
      setIsAddingPlan(true)
      setError(null)
      setMessage(null)

      const body = {
        nome,
        descricao: newPlano.descricao.trim(),
        valor,
        permiteDependentes: newPlano.permiteDependentes,
        dependentesMinimos: newPlano.permiteDependentes ? Number(newPlano.dependentesMinimos) : 0,
        maxDependentes: newPlano.permiteDependentes && newPlano.maxDependentes !== '' ? Number(newPlano.maxDependentes) : null,
        valorDependenteAdicional: newPlano.permiteDependentes ? Number(newPlano.valorDependenteAdicional) : 0,
        ordem: institutoPlanos.length,
      }

      const res = await fetch(`/api/admin/institutos/${institutoId}/planos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || 'Erro ao adicionar plano.')

      setMessage('Plano adicionado com sucesso.')
      setNewPlano(emptyNewPlano)
      setShowAddForm(false)
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar plano.')
    } finally {
      setIsAddingPlan(false)
    }
  }

  const handleDeletePlan = async (planId: string, planNome: string) => {
    if (!confirm(`Tem certeza que deseja excluir o plano "${planNome}"?`)) return

    try {
      setIsDeletingPlan(planId)
      setError(null)
      setMessage(null)

      const res = await fetch(`/api/admin/institutos/${institutoId}/planos/${planId}`, {
        method: 'DELETE',
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || 'Erro ao excluir plano.')

      setMessage(`Plano "${planNome}" excluído.`)
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir plano.')
    } finally {
      setIsDeletingPlan(null)
    }
  }

  const handleStartEdit = (plano: InstitutoPlano) => {
    setEditingPlanId(plano.id)
    setEditPlanoForm({
      nome: plano.nome,
      descricao: plano.descricao || '',
      valor: String(plano.valor),
      permiteDependentes: plano.permite_dependentes,
      dependentesMinimos: String(plano.dependentes_minimos ?? 1),
      maxDependentes: plano.max_dependentes != null ? String(plano.max_dependentes) : '',
      valorDependenteAdicional: String(plano.valor_dependente_adicional ?? 0),
    })
    setError(null)
  }

  const handleSaveEditPlan = async () => {
    const nome = editPlanoForm.nome.trim()
    const valor = Number(editPlanoForm.valor)
    if (!nome) { setError('Nome do plano é obrigatório.'); return }
    if (!Number.isFinite(valor) || valor <= 0) { setError('Valor deve ser maior que zero.'); return }

    try {
      setIsSavingEdit(true)
      setError(null)
      setMessage(null)

      const body = {
        nome,
        descricao: editPlanoForm.descricao.trim(),
        valor,
        permiteDependentes: editPlanoForm.permiteDependentes,
        dependentesMinimos: editPlanoForm.permiteDependentes ? Number(editPlanoForm.dependentesMinimos) : 0,
        maxDependentes: editPlanoForm.permiteDependentes && editPlanoForm.maxDependentes !== '' ? Number(editPlanoForm.maxDependentes) : null,
        valorDependenteAdicional: editPlanoForm.permiteDependentes ? Number(editPlanoForm.valorDependenteAdicional) : 0,
      }

      const res = await fetch(`/api/admin/institutos/${institutoId}/planos/${editingPlanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || 'Erro ao salvar plano.')

      setMessage('Plano atualizado com sucesso.')
      setEditingPlanId(null)
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar plano.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleTogglePlanActive = async (plan: InstitutoPlano) => {
    try {
      setError(null)
      const res = await fetch(`/api/admin/institutos/${institutoId}/planos/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !plan.ativo }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || 'Erro ao atualizar plano.')
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar plano.')
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
      router.push('/admin/login')
    } catch { /* ignore */ }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/admin/institutos">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">
                {instituto ? instituto.nome : 'Carregando...'}
              </h1>
              <p className="text-xs text-gray-600">Configurações do Instituto/Parceiro</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <Link href="/admin/institutos"><Button variant="outline">Voltar à Lista</Button></Link>
            <Button onClick={handleLogout} variant="outline">Sair</Button>
          </div>
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader><SheetTitle>Menu</SheetTitle></SheetHeader>
                <div className="flex flex-col gap-2 px-4 pb-4">
                  <SheetClose asChild><Button asChild variant="outline" className="w-full justify-start"><Link href="/admin/institutos">Voltar à Lista</Link></Button></SheetClose>
                  <SheetClose asChild><Button onClick={handleLogout} variant="outline" className="w-full justify-start">Sair</Button></SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {isLoading && <p className="text-center text-sm text-gray-500">Carregando...</p>}

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

        {instituto && (
          <>
            {/* Info geral */}
            <div className="rounded-lg bg-white p-6 shadow space-y-3">
              <h2 className="text-base font-semibold text-gray-900">Informações</h2>
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-gray-500">Nome</dt>
                  <dd className="font-medium text-gray-900">{instituto.nome}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Email</dt>
                  <dd className="text-gray-700">{instituto.email}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Código de Indicação</dt>
                  <dd className="font-mono text-gray-700">{instituto.codigo_indicacao}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Status</dt>
                  <dd>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${instituto.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {instituto.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            {/* Configurações de Comissão */}
            <div className="rounded-lg bg-white p-6 shadow space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Configuração de Comissão</h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-gray-700">% sobre mensalidade</span>
                  <input
                    type="number" min="0" max="100" step="0.5"
                    value={comissaoPercentualMensalidade}
                    onChange={(e) => setComissaoPercentualMensalidade(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className={`block space-y-1 ${semAdesao ? 'opacity-40 pointer-events-none' : ''}`}>
                  <span className="text-sm font-medium text-gray-700">% sobre adesão</span>
                  <input
                    type="number" min="0" max="100" step="0.5"
                    value={comissaoPercentualAdesao}
                    onChange={(e) => setComissaoPercentualAdesao(e.target.value)}
                    disabled={semAdesao}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  {semAdesao && (
                    <p className="text-xs text-gray-400">Desabilitado (sem adesão ativa)</p>
                  )}
                </label>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Mensalidades que geram comissão</p>
                <div className="space-y-2">
                  {[
                    { value: 'primeiro', label: 'Apenas a 1ª mensalidade' },
                    { value: 'custom', label: 'Número customizado' },
                    { value: 'vitalicio', label: 'Vitalício (todas as mensalidades)' },
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center gap-3">
                      <input
                        type="radio" name="comissaoModo" value={opt.value}
                        checked={comissaoModo === opt.value}
                        onChange={() => setComissaoModo(opt.value as typeof comissaoModo)}
                        className="accent-teal-700"
                      />
                      <span className="text-sm text-gray-700">{opt.label}</span>
                    </label>
                  ))}
                </div>

                {comissaoModo === 'custom' && (
                  <input
                    type="number" min="1"
                    value={comissaoMaxCustom}
                    onChange={(e) => setComissaoMaxCustom(e.target.value)}
                    className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Ex: 3"
                  />
                )}
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
                <input
                  type="checkbox" id="semAdesaoDetail"
                  checked={semAdesao}
                  onChange={(e) => setSemAdesao(e.target.checked)}
                  className="h-4 w-4 accent-teal-700"
                />
                <div>
                  <label htmlFor="semAdesaoDetail" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Isentar adesão dos clientes deste parceiro
                  </label>
                  <p className="text-xs text-gray-500">Se marcado, clientes não pagarão taxa de adesão ao se cadastrar via link deste instituto.</p>
                </div>
              </div>

              <Button onClick={handleSaveComissao} disabled={isSavingComissao}>
                {isSavingComissao ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </div>

            {/* Planos do Instituto */}
            <div className="rounded-lg bg-white p-6 shadow space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Planos do Instituto</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Estes planos são exclusivos deste parceiro e serão exibidos no link de venda.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => { setShowAddForm(!showAddForm); setError(null) }}
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Plano
                </Button>
              </div>

              {/* Form para novo plano */}
              {showAddForm && (
                <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-teal-900">Novo Plano</p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-gray-700">Nome do plano *</span>
                      <input
                        type="text"
                        value={newPlano.nome}
                        onChange={(e) => setNewPlano(p => ({ ...p, nome: e.target.value }))}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Ex: Plano Básico"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-gray-700">Valor mensal (R$) *</span>
                      <input
                        type="number" min="0.01" step="0.01"
                        value={newPlano.valor}
                        onChange={(e) => setNewPlano(p => ({ ...p, valor: e.target.value }))}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Ex: 39.90"
                      />
                    </label>
                  </div>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-gray-700">Descrição (opcional)</span>
                    <input
                      type="text"
                      value={newPlano.descricao}
                      onChange={(e) => setNewPlano(p => ({ ...p, descricao: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      placeholder="Ex: Cobertura completa para o titular"
                    />
                  </label>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox" id="novoPlanoDependentes"
                      checked={newPlano.permiteDependentes}
                      onChange={(e) => setNewPlano(p => ({ ...p, permiteDependentes: e.target.checked }))}
                      className="h-4 w-4 accent-teal-700"
                    />
                    <label htmlFor="novoPlanoDependentes" className="text-sm text-gray-700 cursor-pointer">
                      Permite dependentes
                    </label>
                  </div>

                  {newPlano.permiteDependentes && (
                    <div className="grid grid-cols-3 gap-3">
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-gray-700">Mín. dependentes</span>
                        <input
                          type="number" min="0"
                          value={newPlano.dependentesMinimos}
                          onChange={(e) => setNewPlano(p => ({ ...p, dependentesMinimos: e.target.value }))}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-gray-700">Máx. dependentes</span>
                        <input
                          type="number" min="0"
                          value={newPlano.maxDependentes}
                          onChange={(e) => setNewPlano(p => ({ ...p, maxDependentes: e.target.value }))}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          placeholder="Vazio = sem limite"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-gray-700">Valor por dep. adicional (R$)</span>
                        <input
                          type="number" min="0" step="0.01"
                          value={newPlano.valorDependenteAdicional}
                          onChange={(e) => setNewPlano(p => ({ ...p, valorDependenteAdicional: e.target.value }))}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        />
                      </label>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button onClick={handleAddPlan} disabled={isAddingPlan} size="sm">
                      {isAddingPlan ? 'Salvando...' : 'Salvar Plano'}
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => { setShowAddForm(false); setNewPlano(emptyNewPlano) }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {/* Lista de planos existentes */}
              {institutoPlanos.length === 0 && !showAddForm ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Nenhum plano cadastrado. Adicione pelo menos um plano para que o link de venda funcione.
                </p>
              ) : (
                <div className="space-y-3">
                  {institutoPlanos.map((plano) => (
                    <div key={plano.id} className={`rounded-lg border p-4 space-y-3 ${plano.ativo ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                      {editingPlanId === plano.id ? (
                        /* Inline edit form */
                        <div className="space-y-3">
                          <p className="text-sm font-semibold text-teal-900">Editando plano</p>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="block space-y-1">
                              <span className="text-xs font-medium text-gray-700">Nome *</span>
                              <input type="text" value={editPlanoForm.nome} onChange={(e) => setEditPlanoForm(p => ({ ...p, nome: e.target.value }))} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                            </label>
                            <label className="block space-y-1">
                              <span className="text-xs font-medium text-gray-700">Valor mensal (R$) *</span>
                              <input type="number" min="0.01" step="0.01" value={editPlanoForm.valor} onChange={(e) => setEditPlanoForm(p => ({ ...p, valor: e.target.value }))} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                            </label>
                          </div>
                          <label className="block space-y-1">
                            <span className="text-xs font-medium text-gray-700">Descrição (opcional)</span>
                            <input type="text" value={editPlanoForm.descricao} onChange={(e) => setEditPlanoForm(p => ({ ...p, descricao: e.target.value }))} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Ex: Cobertura completa para o titular" />
                          </label>
                          <div className="flex items-center gap-3">
                            <input type="checkbox" id={`edit-dep-${plano.id}`} checked={editPlanoForm.permiteDependentes} onChange={(e) => setEditPlanoForm(p => ({ ...p, permiteDependentes: e.target.checked }))} className="h-4 w-4 accent-teal-700" />
                            <label htmlFor={`edit-dep-${plano.id}`} className="text-sm text-gray-700 cursor-pointer">Permite dependentes</label>
                          </div>
                          {editPlanoForm.permiteDependentes && (
                            <div className="grid grid-cols-3 gap-3">
                              <label className="block space-y-1">
                                <span className="text-xs font-medium text-gray-700">Mín. dependentes</span>
                                <input type="number" min="0" value={editPlanoForm.dependentesMinimos} onChange={(e) => setEditPlanoForm(p => ({ ...p, dependentesMinimos: e.target.value }))} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                              </label>
                              <label className="block space-y-1">
                                <span className="text-xs font-medium text-gray-700">Máx. dependentes</span>
                                <input type="number" min="0" value={editPlanoForm.maxDependentes} onChange={(e) => setEditPlanoForm(p => ({ ...p, maxDependentes: e.target.value }))} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Vazio = sem limite" />
                              </label>
                              <label className="block space-y-1">
                                <span className="text-xs font-medium text-gray-700">Valor por dep. (R$)</span>
                                <input type="number" min="0" step="0.01" value={editPlanoForm.valorDependenteAdicional} onChange={(e) => setEditPlanoForm(p => ({ ...p, valorDependenteAdicional: e.target.value }))} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                              </label>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Button onClick={handleSaveEditPlan} disabled={isSavingEdit} size="sm">
                              {isSavingEdit ? 'Salvando...' : 'Salvar'}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => { setEditingPlanId(null); setError(null) }}>
                              <X className="h-4 w-4 mr-1" />Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* Read-only view */
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-900 text-sm">{plano.nome}</span>
                              {!plano.ativo && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">Inativo</span>
                              )}
                            </div>
                            {plano.descricao && (
                              <p className="text-xs text-gray-500 mt-0.5">{plano.descricao}</p>
                            )}
                            <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-600">
                              <span className="font-semibold text-teal-700">
                                R$ {Number(plano.valor).toFixed(2).replace('.', ',')}
                              </span>
                              {plano.permite_dependentes ? (
                                <span>
                                  Dependentes: {plano.dependentes_minimos}–{plano.max_dependentes ?? '∞'}
                                  {Number(plano.valor_dependente_adicional) > 0 && (
                                    <> · +R$ {Number(plano.valor_dependente_adicional).toFixed(2).replace('.', ',')} por dep.</>
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-400">Sem dependentes</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="outline" size="icon"
                              className="h-8 w-8 text-teal-600 hover:bg-teal-50 hover:text-teal-700"
                              onClick={() => handleStartEdit(plano)}
                              title="Editar plano"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline" size="sm"
                              onClick={() => handleTogglePlanActive(plano)}
                              className="text-xs"
                            >
                              {plano.ativo ? 'Desativar' : 'Ativar'}
                            </Button>
                            <Button
                              variant="outline" size="icon"
                              className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-700"
                              onClick={() => handleDeletePlan(plano.id, plano.nome)}
                              disabled={isDeletingPlan === plano.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
