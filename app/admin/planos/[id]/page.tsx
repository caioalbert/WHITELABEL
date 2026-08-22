'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

type Plano = {
  id: string
  codigo: string
  nome: string
  descricao_publica: string | null
  beneficios_publicos: string | null
  valor: number
  ativo: boolean
  ordem: number
  permite_dependentes: boolean
  dependentes_minimos: number
  max_dependentes: number | null
  valor_dependente_adicional: number
  created_at: string
  updated_at: string
}

type EditablePlan = {
  nome: string
  descricao_publica: string
  beneficios_publicos: string
  valor: string
  ativo: boolean
  permite_dependentes: boolean
  dependentes_minimos: string
  max_dependentes: string
  valor_dependente_adicional: string
}

const MIN_CHARGE_VALUE = 5

export default function AdminPlanoDetailPage() {
  const router = useRouter()
  const params = useParams()
  const planId = String(params?.id || '')

  const [plano, setPlano] = useState<Plano | null>(null)
  const [form, setForm] = useState<EditablePlan | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const fetchPlano = useCallback(async () => {
    if (!planId) return
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/admin/planos', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Erro ao carregar planos.')
      }

      const list: Plano[] = Array.isArray(payload?.planos) ? payload.planos : []
      const found = list.find((p) => p.id === planId) || null

      if (!found) {
        setError('Plano não encontrado.')
        return
      }

      setPlano(found)
      setForm({
        nome: String(found.nome || ''),
        descricao_publica: String(found.descricao_publica || ''),
        beneficios_publicos: String(found.beneficios_publicos || ''),
        valor: String(found.valor ?? ''),
        ativo: Boolean(found.ativo),
        permite_dependentes: Boolean(found.permite_dependentes),
        dependentes_minimos: String(found.dependentes_minimos ?? 0),
        max_dependentes: found.max_dependentes === null ? '' : String(found.max_dependentes),
        valor_dependente_adicional: String(found.valor_dependente_adicional ?? 0),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar plano.')
    } finally {
      setIsLoading(false)
    }
  }, [planId, router])

  useEffect(() => {
    fetchPlano()
  }, [fetchPlano])

  const updateForm = (next: Partial<EditablePlan>) => {
    setForm((prev) => (prev ? { ...prev, ...next } : prev))
  }

  const handleSave = async () => {
    if (!form) return

    try {
      setIsSaving(true)
      setError(null)
      setMessage(null)

      const nome = form.nome.trim()
      const valor = Number(form.valor)
      const permiteDependentes = Boolean(form.permite_dependentes)
      const dependentesMinimos = Number(form.dependentes_minimos)
      const valorDependenteAdicional = Number(form.valor_dependente_adicional)

      if (!nome) throw new Error('Nome do plano é obrigatório.')
      if (!Number.isFinite(valor) || valor < MIN_CHARGE_VALUE)
        throw new Error(`Valor inválido. Mínimo R$ ${MIN_CHARGE_VALUE.toFixed(2).replace('.', ',')}.`)
      if (!Number.isInteger(dependentesMinimos) || dependentesMinimos < 0)
        throw new Error('Quantidade mínima de dependentes inválida.')

      let maxDependentes: number | null = null
      const maxRaw = form.max_dependentes.trim()
      if (maxRaw) {
        maxDependentes = Number(maxRaw)
        if (!Number.isInteger(maxDependentes) || maxDependentes < 0)
          throw new Error('Limite máximo de dependentes inválido.')
        if (maxDependentes > 0 && maxDependentes < dependentesMinimos)
          throw new Error('Limite máximo deve ser maior ou igual ao mínimo.')
      }

      if (!Number.isFinite(valorDependenteAdicional) || valorDependenteAdicional < 0)
        throw new Error('Valor adicional por dependente inválido.')

      const response = await fetch(`/api/admin/planos/${encodeURIComponent(planId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          descricao_publica: form.descricao_publica.trim() || null,
          beneficios_publicos: form.beneficios_publicos.trim() || null,
          valor,
          ativo: form.ativo,
          permite_dependentes: permiteDependentes,
          dependentes_minimos: dependentesMinimos,
          max_dependentes: maxDependentes,
          valor_dependente_adicional: valorDependenteAdicional,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Erro ao atualizar plano.')
      }

      setMessage('Plano atualizado com sucesso.')
      await fetchPlano()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar plano.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
      router.push('/admin/login')
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/admin/planos">
              <Button variant="ghost" size="icon" aria-label="Voltar">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">
                {isLoading ? 'Carregando...' : (plano?.nome || 'Plano')}
              </h1>
              {plano && (
                <p className="font-mono text-xs text-gray-500">{plano.codigo}</p>
              )}
            </div>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <Link href="/admin/planos">
              <Button variant="outline">Voltar aos Planos</Button>
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
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 px-4 pb-4">
                  <SheetClose asChild>
                    <Button asChild variant="outline" className="w-full justify-start">
                      <Link href="/admin/planos">Voltar aos Planos</Link>
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

      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        {isLoading ? (
          <p className="text-sm text-gray-600">Carregando...</p>
        ) : error && !form ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
            <Link href="/admin/planos">
              <Button variant="outline" className="mt-3">Voltar aos Planos</Button>
            </Link>
          </div>
        ) : form ? (
          <div className="space-y-6">
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

            {/* Informações básicas */}
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Informações básicas</h2>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Nome</label>
                <input
                  value={form.nome}
                  onChange={(e) => updateForm({ nome: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Valor por pessoa (R$)
                </label>
                <input
                  type="number"
                  min={MIN_CHARGE_VALUE}
                  step="0.01"
                  value={form.valor}
                  onChange={(e) => {
                    const v = e.target.value
                    const updates: Partial<EditablePlan> = { valor: v }
                    if (form.permite_dependentes) updates.valor_dependente_adicional = v
                    updateForm(updates)
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isSaving}
                />
                {form.valor && Number(form.valor) > 0 && (
                  <p className="text-xs text-gray-500">
                    {form.permite_dependentes
                      ? `Total mínimo: R$ ${(Number(form.valor) * (Number(form.dependentes_minimos) + 1)).toFixed(2).replace('.', ',')}`
                      : `R$ ${Number(form.valor).toFixed(2).replace('.', ',')}`}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Descrição pública
                </label>
                <textarea
                  value={form.descricao_publica}
                  onChange={(e) => updateForm({ descricao_publica: e.target.value })}
                  rows={2}
                  placeholder="Resumo exibido na tela de cadastro"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Benefícios
                </label>
                <p className="text-xs text-gray-500">
                  Um item por linha. Use <span className="font-mono">+</span> para incluído e{' '}
                  <span className="font-mono">-</span> para não incluído.
                </p>
                <textarea
                  value={form.beneficios_publicos}
                  onChange={(e) => updateForm({ beneficios_publicos: e.target.value })}
                  rows={6}
                  placeholder={'+ Telemedicina 24h\n+ Clube de descontos\n- Odontologia'}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isSaving}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => updateForm({ ativo: e.target.checked })}
                  disabled={isSaving}
                  className="rounded border-gray-300"
                />
                Plano ativo (visível no cadastro)
              </label>
            </section>

            {/* Regras de dependentes */}
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Dependentes</h2>

              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={form.permite_dependentes}
                  onChange={(e) => {
                    const checked = e.target.checked
                    const updates: Partial<EditablePlan> = { permite_dependentes: checked }
                    if (checked) updates.valor_dependente_adicional = form.valor
                    updateForm(updates)
                  }}
                  disabled={isSaving}
                  className="rounded border-gray-300"
                />
                Permite dependentes
              </label>

              {form.permite_dependentes && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Mínimo de dependentes
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={form.dependentes_minimos}
                      onChange={(e) => updateForm({ dependentes_minimos: e.target.value })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      disabled={isSaving}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Máximo de dependentes
                    </label>
                    <label className="mb-1 flex items-center gap-1.5 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={form.max_dependentes.trim() === ''}
                        onChange={(e) => {
                          if (e.target.checked) {
                            updateForm({ max_dependentes: '' })
                          } else {
                            updateForm({
                              max_dependentes: String(
                                Math.max(Number(form.dependentes_minimos || 0), 0)
                              ),
                            })
                          }
                        }}
                        disabled={isSaving}
                      />
                      Sem limite
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={form.max_dependentes}
                      onChange={(e) => updateForm({ max_dependentes: e.target.value })}
                      placeholder="Sem limite"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      disabled={isSaving || form.max_dependentes.trim() === ''}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Valor por excedente (R$)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.valor_dependente_adicional}
                      onChange={(e) => updateForm({ valor_dependente_adicional: e.target.value })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      disabled={isSaving}
                    />
                    <p className="text-xs text-gray-500">
                      Se igual ao valor por pessoa, o plano cobra por vida (cada dependente paga o mesmo valor do titular).
                    </p>
                  </div>
                </div>
              )}
            </section>

            <div className="flex items-center justify-between gap-4">
              <Link href="/admin/planos">
                <Button variant="outline" disabled={isSaving}>Cancelar</Button>
              </Link>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar Plano'}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}
