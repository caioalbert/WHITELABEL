'use client'

import { CadastroFormData, DependenteFormData } from '@/lib/types'
import { getAgeFromIsoDate, isValidCPF, isValidEmail } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useEffect, useMemo, useState } from 'react'

type PlanOption = {
  codigo: string
  nome: string
  descricao: string
  beneficios: Array<{ texto: string; inclui: boolean }>
  valor: number
  permiteDependentes: boolean
  minDependentes: number
  maxDependentes: number | null
  valorDependenteAdicional: number
}

interface StepDependentesProps {
  data: Partial<CadastroFormData>
  onUpdate: (data: Partial<CadastroFormData>) => void
  planOptions?: PlanOption[] | null
  showValidation?: boolean
}

const FALLBACK_PLAN_OPTIONS: PlanOption[] = [
  {
    codigo: 'INDIVIDUAL',
    nome: 'Plano Individual',
    descricao: 'Cobertura para o titular.',
    beneficios: [],
    valor: 0,
    permiteDependentes: false,
    minDependentes: 0,
    maxDependentes: null,
    valorDependenteAdicional: 0,
  },
  {
    codigo: 'FAMILIAR',
    nome: 'Plano Familiar',
    descricao: 'Cobertura para titular e dependentes.',
    beneficios: [],
    valor: 0,
    permiteDependentes: true,
    minDependentes: 1,
    maxDependentes: 4,
    valorDependenteAdicional: 0,
  },
]

function normalizePlanIdentifier(value: unknown) {
  const trimmed = String(value || '').trim()
  const upper = trimmed.toUpperCase()

  return upper === 'INDIVIDUAL' || upper === 'FAMILIAR' ? upper : trimmed
}

function findPlanOptionByCode(planOptions: PlanOption[], planCode: string | null | undefined) {
  const normalizedCode = normalizePlanIdentifier(planCode)
  if (!normalizedCode) return null

  return (
    planOptions.find((plan) => plan.codigo === normalizedCode) ||
    planOptions.find((plan) => plan.codigo.toLowerCase() === normalizedCode.toLowerCase()) ||
    null
  )
}

function normalizePlanOptions(planOptions?: PlanOption[] | null) {
  if (!Array.isArray(planOptions) || planOptions.length === 0) {
    return FALLBACK_PLAN_OPTIONS
  }

  const mapped = planOptions
    .map((plan) => {
      const codigo = normalizePlanIdentifier(plan.codigo)
      const nome = String(plan.nome || '').trim()
      const descricao = String(plan.descricao || '').trim()
      const beneficios = Array.isArray(plan.beneficios)
        ? plan.beneficios
            .map((item) => {
              const texto = String(item?.texto || '').trim()
              if (!texto) return null
              return {
                texto,
                inclui: item?.inclui !== false,
              }
            })
            .filter((item): item is { texto: string; inclui: boolean } => Boolean(item))
        : []
      const valor = Number(plan.valor)
      if (!codigo || !nome || !Number.isFinite(valor) || valor < 0) {
        return null
      }

      const permiteDependentes = Boolean(plan.permiteDependentes || codigo === 'FAMILIAR')
      const minDependentes = permiteDependentes
        ? Math.max(0, Number(plan.minDependentes || (codigo === 'FAMILIAR' ? 1 : 0)) || 0)
        : 0
      const maxDependentes = permiteDependentes
        ? (plan.maxDependentes === null || plan.maxDependentes === undefined || String(plan.maxDependentes).trim() === ''
            ? (codigo === 'FAMILIAR' ? 4 : null)
            : Math.max(0, Number(plan.maxDependentes) || 0))
        : null
      const valorDependenteAdicional = permiteDependentes
        ? Math.max(0, Number(plan.valorDependenteAdicional || 0))
        : 0

      return {
        codigo,
        nome,
        descricao,
        beneficios,
        valor,
        permiteDependentes,
        minDependentes,
        maxDependentes,
        valorDependenteAdicional,
      } satisfies PlanOption
    })
    .filter((value): value is PlanOption => Boolean(value))

  if (mapped.length === 0) {
    return FALLBACK_PLAN_OPTIONS
  }

  return mapped
}

export function StepDependentes({
  data,
  onUpdate,
  planOptions,
  showValidation = false,
}: StepDependentesProps) {
  const availablePlans = useMemo(() => normalizePlanOptions(planOptions), [planOptions])
  const fallbackPlanCode = availablePlans[0]?.codigo || 'INDIVIDUAL'

  const [tipo_plano, setTipoPlano] = useState<string>(data.tipo_plano || fallbackPlanCode)
  const [dependentes, setDependentes] = useState<DependenteFormData[]>(data.dependentes || [])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [cpfError, setCpfError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [formData, setFormData] = useState<DependenteFormData>({
    nome: '',
    rg: '',
    cpf: '',
    data_nascimento: '',
    relacao: '',
    email: '',
    telefone_celular: '',
    sexo: '',
  })

  useEffect(() => {
    if (data.tipo_plano && data.tipo_plano !== tipo_plano) {
      setTipoPlano(data.tipo_plano)
    }
  }, [data.tipo_plano, tipo_plano])

  const selectedPlan = findPlanOptionByCode(availablePlans, tipo_plano) || availablePlans[0]
  const planPermiteDependentes = Boolean(selectedPlan?.permiteDependentes)
  const dependentesMinimos = selectedPlan?.permiteDependentes
    ? Math.max(0, Number(selectedPlan.minDependentes || 0))
    : 0
  const dependentesLimit =
    selectedPlan?.permiteDependentes &&
    selectedPlan.maxDependentes !== null &&
    selectedPlan.maxDependentes !== undefined
      ? Math.max(0, Number(selectedPlan.maxDependentes) || 0)
      : null

  const resetDependenteForm = () => {
    setEditingIndex(null)
    setFormData({
      nome: '',
      rg: '',
      cpf: '',
      data_nascimento: '',
      relacao: '',
      email: '',
      telefone_celular: '',
      sexo: '',
    })
    setCpfError(null)
    setEmailError(null)
  }

  useEffect(() => {
    if (!selectedPlan) return
    if (tipo_plano && findPlanOptionByCode(availablePlans, tipo_plano)) return

    const nextPlanCode = selectedPlan.codigo
    setTipoPlano(nextPlanCode)
    onUpdate({
      tipo_plano: nextPlanCode,
      tem_dependentes: selectedPlan.permiteDependentes,
      dependentes: selectedPlan.permiteDependentes ? dependentes : [],
    })
  }, [availablePlans, dependentes, onUpdate, selectedPlan, tipo_plano])

  const handleAddDependente = () => {
    if (!planPermiteDependentes) {
      return
    }

    if (editingIndex === null && dependentesLimit !== null && dependentesLimit > 0 && dependentes.length >= dependentesLimit) {
      return
    }

    const dependente = {
      ...formData,
      nome: formData.nome.trim(),
      rg: formData.rg.trim(),
      email: formData.email.trim(),
      telefone_celular: formatPhone(formData.telefone_celular),
    }

    if (
      !dependente.nome ||
      !dependente.rg ||
      !dependente.relacao ||
      !dependente.email ||
      !dependente.telefone_celular ||
      !dependente.sexo
    ) {
      return
    }

    if (dependente.cpf && !isValidCPF(dependente.cpf)) {
      setCpfError('CPF do dependente inválido')
      return
    }

    if (!isValidEmail(dependente.email)) {
      setEmailError('Email do dependente inválido')
      return
    }

    const titularEmail = String(data.email || '').trim().toLowerCase()
    const dependenteEmail = dependente.email.toLowerCase()
    const isSameAsTitular = titularEmail && dependenteEmail === titularEmail

    if (isSameAsTitular) {
      const age = getAgeFromIsoDate(dependente.data_nascimento || '')
      if (age === null) {
        setEmailError('Para usar o email do titular, informe a data de nascimento do dependente.')
        return
      }

      if (age >= 18) {
        setEmailError('Dependente maior de idade deve possuir email próprio.')
        return
      }
    }

    setCpfError(null)
    setEmailError(null)

    const nextDependentes =
      editingIndex !== null
        ? dependentes.map((dep, index) => (index === editingIndex ? dependente : dep))
        : [...dependentes, dependente]

    setDependentes(nextDependentes)
    onUpdate({
      tipo_plano: selectedPlan?.codigo || tipo_plano,
      tem_dependentes: planPermiteDependentes,
      dependentes: nextDependentes,
    })

    setFormData({
      nome: '',
      rg: '',
      cpf: '',
      data_nascimento: '',
      relacao: '',
      email: '',
      telefone_celular: '',
      sexo: '',
    })

    if (editingIndex !== null) {
      setEditingIndex(null)
    }
  }

  const handleRemoveDependente = (index: number) => {
    const newDependentes = dependentes.filter((_, i) => i !== index)
    setDependentes(newDependentes)
    onUpdate({
      tipo_plano: selectedPlan?.codigo || tipo_plano,
      tem_dependentes: planPermiteDependentes,
      dependentes: newDependentes,
    })
  }

  const handleEditDependente = (index: number) => {
    const dependente = dependentes[index]
    setFormData({
      ...dependente,
      rg: dependente.rg || '',
      email: dependente.email || '',
      telefone_celular: dependente.telefone_celular || '',
      sexo: dependente.sexo || '',
    })
    setEditingIndex(index)
    setCpfError(null)
    setEmailError(null)
  }

  const handleTipoPlanoChange = (planCode: string) => {
    const selected = findPlanOptionByCode(availablePlans, planCode)
    if (!selected) {
      return
    }

    setTipoPlano(selected.codigo)

    if (!selected.permiteDependentes) {
      setDependentes([])
      resetDependenteForm()
      onUpdate({ tipo_plano: selected.codigo, tem_dependentes: false, dependentes: [] })
      return
    }

    onUpdate({ tipo_plano: selected.codigo, tem_dependentes: true, dependentes })
  }

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .substring(0, 14)
  }

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '')
    return cleaned
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .substring(0, 15)
  }

  const highlightRequired = showValidation && planPermiteDependentes && dependentes.length === 0
  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-lg border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-800">Tipo de plano *</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {availablePlans.map((plan) => {
            const isSelected = selectedPlan?.codigo === plan.codigo
            const isPerLifeMode =
              plan.permiteDependentes &&
              plan.valorDependenteAdicional > 0 &&
              Math.abs(plan.valor - plan.valorDependenteAdicional) < 0.0001
            const displayPlanValue = plan.valor
            const dependentesDescription = plan.permiteDependentes
              ? plan.maxDependentes !== null && plan.maxDependentes > 0
                ? `Mínimo ${plan.minDependentes + 1} e máximo ${plan.maxDependentes + 1} pessoas.`
                : `Mínimo ${plan.minDependentes + 1} pessoas (sem limite máximo).`
              : 'Cobertura apenas para o titular.'

            return (
              <button
                key={plan.codigo}
                type="button"
                onClick={() => handleTipoPlanoChange(plan.codigo)}
                className={`h-full rounded-2xl border p-4 text-left shadow-sm transition ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <p className="text-base font-semibold text-gray-900">{plan.nome}</p>
                <p className="mt-1 text-xs text-gray-600">
                  {plan.descricao || dependentesDescription}
                </p>

                <div className="mt-3 rounded-lg bg-gray-100 px-3 py-2">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(displayPlanValue)}
                    <span className="ml-1 text-xs font-medium text-gray-600">
                      {isPerLifeMode ? '/vida' : '/mês'}
                    </span>
                  </p>
                  {isPerLifeMode && (
                    <p className="mt-1 text-xs text-gray-600">
                      Valor por pessoa
                    </p>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  {plan.beneficios.length > 0 ? (
                    plan.beneficios.map((beneficio, index) => (
                      <div key={`${plan.codigo}-beneficio-${index}`} className="flex items-start gap-2 text-xs">
                        <span
                          className={`mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                            beneficio.inclui
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                          aria-hidden
                        >
                          {beneficio.inclui ? '✓' : '✕'}
                        </span>
                        <span className={beneficio.inclui ? 'text-gray-700' : 'text-gray-500'}>{beneficio.texto}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-600">{dependentesDescription}</p>
                  )}
                </div>

                {plan.permiteDependentes && plan.valorDependenteAdicional > 0 ? (
                  <p className="mt-3 text-xs text-gray-700">
                    {isPerLifeMode
                      ? `Regra por vida: mínimo ${plan.minDependentes + 1} pessoas. Cada vida excedente: ${formatCurrency(plan.valorDependenteAdicional)}.`
                      : `Acréscimo por dependente excedente: ${formatCurrency(plan.valorDependenteAdicional)}.`}
                  </p>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {!planPermiteDependentes ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            Plano sem dependentes selecionado. A cobertura será apenas para o titular.
          </p>
        </div>
      ) : null}

      {planPermiteDependentes ? (
        <p className="text-xs text-gray-500">
          Cada dependente deve ter email. Se for menor de idade, pode usar o mesmo email do titular.
          {' '}Este plano exige mínimo de {dependentesMinimos + 1} pessoas (titular + dependentes).
          {dependentesLimit !== null && dependentesLimit > 0 ? ` Máximo de ${dependentesLimit + 1} pessoas.` : ' Sem limite máximo de pessoas.'}
          {selectedPlan && selectedPlan.valorDependenteAdicional > 0
            ? ` Acréscimo de ${formatCurrency(selectedPlan.valorDependenteAdicional)} por dependente acima do mínimo.`
            : ''}
        </p>
      ) : null}

      {planPermiteDependentes && (
        <div className="space-y-6 border-t pt-6">
          <div className="bg-blue-50 p-6 rounded-lg space-y-4">
            <h3 className="font-semibold text-gray-800">
              {editingIndex !== null ? 'Editar Dependente' : 'Adicionar Dependente'}
            </h3>

            <div>
              <Label htmlFor="dep_nome" className="text-gray-700 font-medium">
                Nome *
              </Label>
              <Input
                id="dep_nome"
                type="text"
                placeholder="Nome do dependente"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className={`mt-2 ${
                  highlightRequired && !formData.nome.trim()
                    ? 'border-red-400 focus-visible:ring-red-500'
                    : 'border-gray-300'
                }`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dep_rg" className="text-gray-700 font-medium">
                  RG *
                </Label>
                <Input
                  id="dep_rg"
                  type="text"
                  placeholder="RG do dependente"
                  value={formData.rg}
                  onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                  className={`mt-2 ${
                    highlightRequired && !formData.rg.trim()
                      ? 'border-red-400 focus-visible:ring-red-500'
                      : 'border-gray-300'
                  }`}
                />
              </div>

              <div>
                <Label htmlFor="dep_cpf" className="text-gray-700 font-medium">
                  CPF
                </Label>
                <Input
                  id="dep_cpf"
                  type="text"
                  placeholder="000.000.000-00"
                  value={formatCPF(formData.cpf)}
                  onChange={(e) => {
                    setFormData({ ...formData, cpf: formatCPF(e.target.value) })
                    setCpfError(null)
                  }}
                  onBlur={() => {
                    if (!formData.cpf) {
                      setCpfError(null)
                      return
                    }

                    setCpfError(isValidCPF(formData.cpf) ? null : 'CPF do dependente inválido')
                  }}
                  className="mt-2 border-gray-300"
                  maxLength={14}
                />
                {cpfError && <p className="mt-1 text-xs text-red-600">{cpfError}</p>}
              </div>

              <div>
                <Label htmlFor="dep_data" className="text-gray-700 font-medium">
                  Data de Nascimento
                </Label>
                <Input
                  id="dep_data"
                  type="date"
                  value={formData.data_nascimento}
                  onChange={(e) =>
                    setFormData({ ...formData, data_nascimento: e.target.value })
                  }
                  className="mt-2 border-gray-300"
                />
              </div>

              <div>
                <Label htmlFor="dep_email" className="text-gray-700 font-medium">
                  Email *
                </Label>
                <Input
                  id="dep_email"
                  type="email"
                  placeholder="dependente@email.com"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value })
                    setEmailError(null)
                  }}
                  onBlur={() => {
                    if (!formData.email.trim()) {
                      setEmailError(null)
                      return
                    }

                    setEmailError(isValidEmail(formData.email) ? null : 'Email do dependente inválido')
                  }}
                  className={`mt-2 ${
                    (highlightRequired && !formData.email.trim()) || emailError
                      ? 'border-red-400 focus-visible:ring-red-500'
                      : 'border-gray-300'
                  }`}
                />
                {emailError && <p className="mt-1 text-xs text-red-600">{emailError}</p>}
              </div>

              <div>
                <Label htmlFor="dep_celular" className="text-gray-700 font-medium">
                  Telefone Celular *
                </Label>
                <Input
                  id="dep_celular"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={formatPhone(formData.telefone_celular)}
                  onChange={(e) =>
                    setFormData({ ...formData, telefone_celular: formatPhone(e.target.value) })
                  }
                  className={`mt-2 ${
                    highlightRequired && !formData.telefone_celular.trim()
                      ? 'border-red-400 focus-visible:ring-red-500'
                      : 'border-gray-300'
                  }`}
                  maxLength={15}
                />
              </div>

              <div>
                <Label htmlFor="dep_sexo" className="text-gray-700 font-medium">
                  Sexo *
                </Label>
                <select
                  id="dep_sexo"
                  value={formData.sexo}
                  onChange={(e) => setFormData({ ...formData, sexo: e.target.value })}
                  className={`mt-2 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    highlightRequired && !formData.sexo
                      ? 'border-red-400 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                >
                  <option value="">Selecione...</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="dep_relacao" className="text-gray-700 font-medium">
                Relação *
              </Label>
              <select
                id="dep_relacao"
                value={formData.relacao}
                onChange={(e) => setFormData({ ...formData, relacao: e.target.value })}
                className={`mt-2 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  highlightRequired && !formData.relacao
                    ? 'border-red-400 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
              >
                <option value="">Selecione...</option>
                <option value="cônjuge">Cônjuge</option>
                <option value="filho">Filho(a)</option>
                <option value="enteado">Enteado(a)</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleAddDependente}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={
                  (editingIndex === null && dependentesLimit !== null && dependentesLimit > 0 && dependentes.length >= dependentesLimit) ||
                  !formData.nome ||
                  !formData.rg ||
                  !formData.relacao ||
                  !formData.email ||
                  !formData.telefone_celular ||
                  !formData.sexo
                }
              >
                {editingIndex !== null ? 'Atualizar' : 'Adicionar'}
              </Button>
              {editingIndex !== null && (
                <Button
                  onClick={resetDependenteForm}
                  variant="outline"
                >
                  Cancelar
                </Button>
              )}
            </div>

            {dependentesLimit !== null && dependentesLimit > 0 && dependentes.length >= dependentesLimit && editingIndex === null && (
              <p className="text-xs text-amber-700">
                Limite atingido: este plano permite no máximo {dependentesLimit} dependentes.
              </p>
            )}
          </div>

          {dependentes.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800">Dependentes Adicionados</h3>
              {dependentes.map((dep, index) => (
                <div
                  key={index}
                  className="p-4 bg-gray-50 rounded-lg flex justify-between items-start"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{dep.nome}</p>
                    <p className="text-sm text-gray-600">
                      {dep.relacao && `Relação: ${dep.relacao}`}
                    </p>
                    {dep.sexo && (
                      <p className="text-sm text-gray-600">Sexo: {dep.sexo}</p>
                    )}
                    {dep.telefone_celular && (
                      <p className="text-sm text-gray-600">Celular: {dep.telefone_celular}</p>
                    )}
                    {dep.cpf && (
                      <p className="text-sm text-gray-600">CPF: {dep.cpf}</p>
                    )}
                    {dep.email && (
                      <p className="text-sm text-gray-600">Email: {dep.email}</p>
                    )}
                    {dep.rg && (
                      <p className="text-sm text-gray-600">RG: {dep.rg}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleEditDependente(index)}
                      variant="outline"
                      size="sm"
                    >
                      Editar
                    </Button>
                    <Button
                      onClick={() => handleRemoveDependente(index)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
