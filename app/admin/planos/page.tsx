'use client'

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

type BillingType = 'BOLETO' | 'CREDIT_CARD'

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

function normalizeBillingType(value: unknown): BillingType | null {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'CREDIT_CARD') {
    return 'CREDIT_CARD'
  }

  if (normalized === 'BOLETO' || normalized === 'PIX') {
    return 'BOLETO'
  }

  return null
}

function normalizeBillingTypeList(values: unknown): BillingType[] {
  if (!Array.isArray(values)) {
    return []
  }

  return Array.from(
    new Set(values.map((value) => normalizeBillingType(value)).filter((value): value is BillingType => Boolean(value)))
  )
}

export default function AdminPlanosPage() {
  const router = useRouter()

  const [planos, setPlanos] = useState<Plano[]>([])
  const [editablePlanos, setEditablePlanos] = useState<Record<string, EditablePlan>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null)
  const [isSavingDefaultPlan, setIsSavingDefaultPlan] = useState(false)
  const [isSavingAll, setIsSavingAll] = useState(false)

  const [defaultPlanType, setDefaultPlanType] = useState('')
  const [mensalidadeBillingTypes, setMensalidadeBillingTypes] = useState<BillingType[]>(['BOLETO', 'CREDIT_CARD'])
  const [defaultMensalidadeBillingType, setDefaultMensalidadeBillingType] =
    useState<BillingType>('BOLETO')

  const [novoPlanoNome, setNovoPlanoNome] = useState('')
  const [novoPlanoValor, setNovoPlanoValor] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const fetchPlanos = useCallback(async () => {
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
      setPlanos(list)

      const editable = list.reduce<Record<string, EditablePlan>>((acc, plano) => {
        acc[plano.id] = {
          nome: String(plano.nome || ''),
          descricao_publica: String(plano.descricao_publica || ''),
          beneficios_publicos: String(plano.beneficios_publicos || ''),
          valor: String(plano.valor ?? ''),
          ativo: Boolean(plano.ativo),
          permite_dependentes: Boolean(plano.permite_dependentes),
          dependentes_minimos: String(plano.dependentes_minimos ?? 0),
          max_dependentes: plano.max_dependentes === null ? '' : String(plano.max_dependentes),
          valor_dependente_adicional: String(plano.valor_dependente_adicional ?? 0),
        }
        return acc
      }, {})

      setEditablePlanos(editable)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar planos.')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  const fetchBillingSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/cobranca-configuracoes', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Erro ao carregar configuração de plano padrão.')
      }

      const types = normalizeBillingTypeList(payload?.settings?.mensalidadeBillingTypes)
      const effectiveTypes: BillingType[] =
        types.length > 0 ? types : ['BOLETO', 'CREDIT_CARD']
      const nextDefaultPlanType = String(payload?.settings?.defaultPlanType || '')
        .trim()
        .toUpperCase()

      if (nextDefaultPlanType) {
        setDefaultPlanType(nextDefaultPlanType)
      }
      setMensalidadeBillingTypes(effectiveTypes)
      const requestedDefault = normalizeBillingType(payload?.settings?.defaultMensalidadeBillingType)
      setDefaultMensalidadeBillingType(
        requestedDefault && effectiveTypes.includes(requestedDefault)
          ? requestedDefault
          : effectiveTypes[0]
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao carregar configuração de plano padrão.'
      )
    }
  }, [router])

  useEffect(() => {
    fetchPlanos()
    fetchBillingSettings()
  }, [fetchPlanos, fetchBillingSettings])

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
      router.push('/admin/login')
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  const sortedPlanos = useMemo(
    () => [...planos].sort((a, b) => a.ordem - b.ordem),
    [planos]
  )

  const defaultPlanOptions = useMemo(
    () =>
      sortedPlanos.reduce<Array<{ codigo: string; nome: string }>>((acc, plano) => {
        const codigo = String(plano.codigo || '').trim().toUpperCase()
        if (!codigo || acc.some((entry) => entry.codigo === codigo)) {
          return acc
        }

        acc.push({
          codigo,
          nome: String(plano.nome || '').trim() || codigo,
        })

        return acc
      }, []),
    [sortedPlanos]
  )

  useEffect(() => {
    if (defaultPlanOptions.length === 0) return

    if (!defaultPlanOptions.some((plan) => plan.codigo === defaultPlanType)) {
      setDefaultPlanType(defaultPlanOptions[0].codigo)
    }
  }, [defaultPlanOptions, defaultPlanType])

  const updateEditablePlan = (planId: string, next: Partial<EditablePlan>) => {
    setEditablePlanos((prev) => ({
      ...prev,
      [planId]: {
        ...(prev[planId] || {
          nome: '',
          descricao_publica: '',
          beneficios_publicos: '',
          valor: '',
          ativo: true,
          permite_dependentes: false,
          dependentes_minimos: '0',
          max_dependentes: '',
          valor_dependente_adicional: '0',
        }),
        ...next,
      },
    }))
  }

  const handleCreatePlano = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      setIsCreating(true)
      setError(null)
      setMessage(null)

      const nome = novoPlanoNome.trim()
      const valor = Number(novoPlanoValor)

      if (!nome) {
        throw new Error('Informe o nome do novo plano.')
      }

      if (!Number.isFinite(valor) || valor < MIN_CHARGE_VALUE) {
        throw new Error('Informe um valor válido (mínimo R$ 5,00).')
      }

      const response = await fetch('/api/admin/planos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, valor }),
      })

      const payload = await response.json().catch(() => null)

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Erro ao criar plano.')
      }

      setMessage(payload?.message || 'Plano criado com sucesso.')
      setNovoPlanoNome('')
      setNovoPlanoValor('')
      await fetchPlanos()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar plano.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleSavePlano = async (planId: string) => {
    const plan = editablePlanos[planId]
    if (!plan) return

    try {
      setSavingPlanId(planId)
      setError(null)
      setMessage(null)

      const nome = plan.nome.trim()
      const descricaoPublica = String(plan.descricao_publica || '').trim()
      const beneficiosPublicos = String(plan.beneficios_publicos || '').trim()
      const valor = Number(plan.valor)
      const permiteDependentes = Boolean(plan.permite_dependentes)

      if (!nome) {
        throw new Error('Nome do plano é obrigatório.')
      }

      if (!Number.isFinite(valor) || valor < MIN_CHARGE_VALUE) {
        throw new Error('Valor do plano inválido. Mínimo R$ 5,00.')
      }
      const dependentesMinimos = Number(plan.dependentes_minimos)
      let maxDependentes: number | null = null
      const valorDependenteAdicional = Number(plan.valor_dependente_adicional)

      if (!Number.isInteger(dependentesMinimos) || dependentesMinimos < 0) {
        throw new Error('Quantidade mínima de dependentes inválida. Informe um inteiro maior ou igual a 0.')
      }

      const maxRaw = String(plan.max_dependentes || '').trim()
      if (maxRaw) {
        maxDependentes = Number(maxRaw)
        if (!Number.isInteger(maxDependentes) || maxDependentes < 0) {
          throw new Error('Limite máximo de dependentes inválido. Informe inteiro não negativo ou deixe vazio.')
        }

        if (maxDependentes > 0 && maxDependentes < dependentesMinimos) {
          throw new Error('Limite máximo de dependentes deve ser maior ou igual ao mínimo.')
        }
      }

      if (!Number.isFinite(valorDependenteAdicional) || valorDependenteAdicional < 0) {
        throw new Error('Valor adicional por dependente inválido.')
      }

      if (permiteDependentes && dependentesMinimos < 1) {
        throw new Error('Quando o plano permite dependentes, o mínimo deve ser pelo menos 1.')
      }

      const response = await fetch(`/api/admin/planos/${encodeURIComponent(planId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          descricao_publica: descricaoPublica || null,
          beneficios_publicos: beneficiosPublicos || null,
          valor,
          ativo: plan.ativo,
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

      setMessage(payload?.message || 'Plano atualizado com sucesso.')
      await fetchPlanos()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar plano.')
    } finally {
      setSavingPlanId(null)
    }
  }

  const handleSaveDefaultPlan = async () => {
    const selectedDefaultPlan = defaultPlanOptions.find((plan) => plan.codigo === defaultPlanType)
    if (!selectedDefaultPlan) {
      setError('Selecione um plano padrão válido.')
      return
    }

    try {
      setIsSavingDefaultPlan(true)
      setError(null)
      setMessage(null)

      const response = await fetch('/api/admin/cobranca-configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensalidadeBillingTypes,
          defaultMensalidadeBillingType,
          defaultPlanType: selectedDefaultPlan.codigo,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (response.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Erro ao atualizar plano padrão.')
      }

      setMessage('Plano padrão atualizado com sucesso.')
      const nextDefaultPlanType = String(payload?.settings?.defaultPlanType || selectedDefaultPlan.codigo)
        .trim()
        .toUpperCase()
      setDefaultPlanType(nextDefaultPlanType || selectedDefaultPlan.codigo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar plano padrão.')
    } finally {
      setIsSavingDefaultPlan(false)
    }
  }

  const handleSaveAllPlanos = async () => {
    try {
      setIsSavingAll(true)
      setError(null)
      setMessage(null)

      let successCount = 0
      let errorCount = 0

      for (const plano of sortedPlanos) {
        try {
          await handleSavePlano(plano.id)
          successCount++
        } catch {
          errorCount++
        }
      }

      if (errorCount === 0) {
        setMessage(`${successCount} plano(s) atualizado(s) com sucesso.`)
      } else {
        setError(`${successCount} plano(s) atualizado(s), ${errorCount} erro(s).`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar planos.')
    } finally {
      setIsSavingAll(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">Planos</h1>
            <p className="text-xs text-gray-600 sm:text-sm">Gerencie nome e valor dos planos disponíveis</p>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <Button onClick={fetchPlanos} variant="outline">Atualizar</Button>
            <Link href="/admin/configuracoes">
              <Button variant="outline">Configurações</Button>
            </Link>
            <Link href="/admin/dashboard">
              <Button variant="outline">Dashboard</Button>
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
                  <SheetTitle>Menu Planos</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 px-4 pb-4">
                  <SheetClose asChild>
                    <Button onClick={fetchPlanos} variant="outline" className="w-full justify-start">Atualizar</Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button asChild variant="outline" className="w-full justify-start">
                      <Link href="/admin/configuracoes">Configurações</Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button asChild variant="outline" className="w-full justify-start">
                      <Link href="/admin/dashboard">Dashboard</Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button onClick={handleLogout} variant="outline" className="w-full justify-start">Sair</Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
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

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Plano padrão para novos clientes</h2>

          {defaultPlanOptions.length === 0 ? (
            <p className="text-sm text-gray-600">Cadastre ao menos um plano para definir o padrão.</p>
          ) : (
            <RadioGroup
              value={defaultPlanType}
              onValueChange={(value) => setDefaultPlanType(String(value || '').trim().toUpperCase())}
              className="space-y-2"
            >
              {defaultPlanOptions.map((plan) => (
                <label key={plan.codigo} className="flex items-center gap-3">
                  <RadioGroupItem
                    value={plan.codigo}
                    id={`plan-${plan.codigo}`}
                    disabled={isSavingDefaultPlan}
                  />
                  <span className="text-sm text-gray-800">{plan.nome}</span>
                </label>
              ))}
            </RadioGroup>
          )}

          <p className="text-xs text-gray-600">
            As regras de dependentes são configuradas individualmente em cada plano.
          </p>

          <div className="flex justify-end">
            <Button onClick={handleSaveDefaultPlan} disabled={isSavingDefaultPlan}>
              {isSavingDefaultPlan ? 'Salvando...' : 'Salvar plano padrão'}
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Criar novo plano</h2>
          <p className="mt-1 text-sm text-gray-600">O código é gerado automaticamente a partir do nome.</p>

          <form className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4" onSubmit={handleCreatePlano}>
            <label className="md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-gray-700">Nome</span>
              <input
                value={novoPlanoNome}
                onChange={(event) => setNovoPlanoNome(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Ex: Plano Empresarial"
                disabled={isCreating}
                required
              />
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium text-gray-700">Valor por pessoa (R$)</span>
              <input
                type="number"
                min={MIN_CHARGE_VALUE}
                step="0.01"
                value={novoPlanoValor}
                onChange={(event) => setNovoPlanoValor(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="49.90"
                disabled={isCreating}
                required
              />
              {novoPlanoValor && Number(novoPlanoValor) > 0 && (
                <p className="mt-1 text-xs text-gray-500">R$ {Number(novoPlanoValor).toFixed(2).replace('.', ',')}</p>
              )}
            </label>

            <div className="flex items-end">
              <Button type="submit" disabled={isCreating} className="w-full">
                {isCreating ? 'Criando...' : 'Criar Plano'}
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Planos existentes</h2>
              <p className="mt-1 text-xs text-gray-600">
                O mínimo e máximo de dependentes podem ser configurados em qualquer plano. Para visualizar em pessoas, some 1 (titular + dependentes).
              </p>
              <p className="mt-1 text-xs text-gray-600">
                Valor por pessoa: informe o valor cobrado por cada pessoa. O valor total do plano = valor por pessoa × mínimo de pessoas. Excedentes pagam o mesmo valor por pessoa adicional.
              </p>
              <p className="mt-1 text-xs text-gray-600">
                Benefícios: informe um item por linha, começando com <span className="font-mono">+</span> para incluído
                ou <span className="font-mono">-</span> para não incluído.
              </p>
            </div>
            {sortedPlanos.length > 0 && (
              <Button
                onClick={handleSaveAllPlanos}
                disabled={isSavingAll || savingPlanId !== null}
                className="shrink-0"
              >
                {isSavingAll ? 'Salvando...' : 'Salvar Tudo'}
              </Button>
            )}
          </div>

          {isLoading ? (
            <p className="mt-4 text-sm text-gray-600">Carregando planos...</p>
          ) : sortedPlanos.length === 0 ? (
            <p className="mt-4 text-sm text-gray-600">Nenhum plano cadastrado.</p>
          ) : (
            <>
              <div className="mt-4 rounded-md bg-blue-50 border border-blue-200 p-3">
                <p className="text-xs text-blue-700">
                  💡 <strong>Dica:</strong> Role a tabela para a direita para ver as colunas de dependentes (Mínimo, Máximo, Valor Adicional) e o botão Salvar.
                </p>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600">
                    <th className="py-2 pr-4">Código</th>
                    <th className="py-2 pr-4">Nome</th>
                    <th className="py-2 pr-4">Descrição</th>
                    <th className="py-2 pr-4">Benefícios</th>
                    <th className="py-2 pr-4">Valor por pessoa (R$)</th>
                    <th className="py-2 pr-4">Permite Dependentes</th>
                    <th className="py-2 pr-4">Mínimo</th>
                    <th className="py-2 pr-4">Máximo</th>
                    <th className="py-2 pr-4">Adicional por Excedente (R$)</th>
                    <th className="py-2 pr-4">Ativo</th>
                    <th className="py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlanos.map((plano) => {
                    const editable = editablePlanos[plano.id] || {
                      nome: plano.nome,
                      descricao_publica: String(plano.descricao_publica || ''),
                      beneficios_publicos: String(plano.beneficios_publicos || ''),
                      valor: String(plano.valor),
                      ativo: plano.ativo,
                      permite_dependentes: Boolean(plano.permite_dependentes),
                      dependentes_minimos: String(plano.dependentes_minimos ?? 0),
                      max_dependentes: plano.max_dependentes === null ? '' : String(plano.max_dependentes),
                      valor_dependente_adicional: String(plano.valor_dependente_adicional ?? 0),
                    }

                    const isSavingThisPlan = savingPlanId === plano.id

                    return (
                      <tr key={plano.id} className="border-b border-gray-100 align-top">
                        <td className="py-2 pr-4 font-mono text-xs text-gray-700">{plano.codigo}</td>
                        <td className="py-2 pr-4">
                          <input
                            value={editable.nome}
                            onChange={(event) => updateEditablePlan(plano.id, { nome: event.target.value })}
                            className="w-full min-w-[180px] rounded-md border border-gray-300 px-2 py-1.5"
                            disabled={isSavingThisPlan}
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <textarea
                            value={editable.descricao_publica}
                            onChange={(event) =>
                              updateEditablePlan(plano.id, { descricao_publica: event.target.value })
                            }
                            className="min-h-[72px] w-full min-w-[220px] rounded-md border border-gray-300 px-2 py-1.5"
                            placeholder="Resumo comercial do plano"
                            disabled={isSavingThisPlan}
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <textarea
                            value={editable.beneficios_publicos}
                            onChange={(event) =>
                              updateEditablePlan(plano.id, { beneficios_publicos: event.target.value })
                            }
                            className="min-h-[96px] w-full min-w-[260px] rounded-md border border-gray-300 px-2 py-1.5 font-mono text-xs"
                            placeholder={'+ Telemedicina 24h\n+ Clube de descontos\n- Odontologia'}
                            disabled={isSavingThisPlan}
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <input
                            type="number"
                            min={MIN_CHARGE_VALUE}
                            step="0.01"
                            value={editable.valor}
                            onChange={(event) => {
                              const newValor = event.target.value
                              const updates: Partial<EditablePlan> = { valor: newValor }
                              // Auto-sync valor_dependente_adicional when in per-person mode
                              if (editable.permite_dependentes) {
                                updates.valor_dependente_adicional = newValor
                              }
                              updateEditablePlan(plano.id, updates)
                            }}
                            className="w-32 rounded-md border border-gray-300 px-2 py-1.5"
                            disabled={isSavingThisPlan}
                          />
                          {editable.permite_dependentes ? (
                            <p className="mt-1 text-xs text-gray-500">
                              Total: R$ {(
                                Number(editable.valor) * (Number(editable.dependentes_minimos) + 1)
                              ).toFixed(2).replace('.', ',')}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-gray-500">
                              R$ {Number(editable.valor).toFixed(2).replace('.', ',')}
                            </p>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={editable.permite_dependentes}
                              onChange={(event) => {
                                const checked = event.target.checked
                                const updates: Partial<EditablePlan> = {
                                  permite_dependentes: checked,
                                }
                                // Auto-ajustar mínimo para 1 quando marcar
                                if (checked && Number(editable.dependentes_minimos) < 1) {
                                  updates.dependentes_minimos = '1'
                                }
                                // Auto-sync valor_dependente_adicional para modo por pessoa
                                if (checked) {
                                  updates.valor_dependente_adicional = editable.valor
                                }
                                updateEditablePlan(plano.id, updates)
                              }}
                              disabled={isSavingThisPlan}
                            />
                            {editable.permite_dependentes ? 'Sim' : 'Não'}
                          </label>
                        </td>
                        <td className="py-2 pr-4">
                          <input
                            type="number"
                            min={0}
                            step="1"
                            value={editable.dependentes_minimos}
                            onChange={(event) =>
                              updateEditablePlan(plano.id, { dependentes_minimos: event.target.value })
                            }
                            className="w-24 rounded-md border border-gray-300 px-2 py-1.5"
                            disabled={isSavingThisPlan}
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <div className="space-y-1">
                            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                              <input
                                type="checkbox"
                                checked={editable.max_dependentes.trim() === ''}
                                onChange={(event) => {
                                  if (event.target.checked) {
                                    updateEditablePlan(plano.id, { max_dependentes: '' })
                                    return
                                  }

                                  updateEditablePlan(plano.id, {
                                    max_dependentes: String(
                                      Math.max(
                                        Number(editable.dependentes_minimos || 0) || 0,
                                        0
                                      )
                                    ),
                                  })
                                }}
                                disabled={isSavingThisPlan}
                              />
                              Sem limite
                            </label>
                            <input
                              type="number"
                              min={0}
                              step="1"
                              value={editable.max_dependentes}
                              onChange={(event) =>
                                updateEditablePlan(plano.id, { max_dependentes: event.target.value })
                              }
                              className="w-24 rounded-md border border-gray-300 px-2 py-1.5"
                              placeholder="Sem limite"
                              disabled={isSavingThisPlan || editable.max_dependentes.trim() === ''}
                            />
                          </div>
                        </td>
                        <td className="py-2 pr-4">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={editable.valor_dependente_adicional}
                            onChange={(event) =>
                              updateEditablePlan(plano.id, { valor_dependente_adicional: event.target.value })
                            }
                            className="w-32 rounded-md border border-gray-300 px-2 py-1.5"
                            disabled={isSavingThisPlan}
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={editable.ativo}
                              onChange={(event) => updateEditablePlan(plano.id, { ativo: event.target.checked })}
                              disabled={isSavingThisPlan}
                            />
                            {editable.ativo ? 'Sim' : 'Não'}
                          </label>
                        </td>
                        <td className="py-2">
                          <Button
                            size="sm"
                            onClick={() => handleSavePlano(plano.id)}
                            disabled={isSavingThisPlan || isSavingAll}
                          >
                            {isSavingThisPlan ? 'Salvando...' : 'Salvar'}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
