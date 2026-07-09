'use client'

import { useEffect, useState } from 'react'
import { CadastroFormData } from '@/lib/types'
import { getAgeFromIsoDate, isValidCPF, isValidEmail } from '@/lib/utils'
import { StepPlano } from './steps/StepPlano'
import { StepPessoal } from './steps/StepPessoal'
import { StepEndereco } from './steps/StepEndereco'
import { StepDependentes } from './steps/StepDependentes'
import { StepTermo } from './steps/StepTermo'
import { StepConfirmacao } from './steps/StepConfirmacao'
import { Button } from '@/components/ui/button'

const STEPS = [
  'Escolha do Plano',
  'Dados Pessoais',
  'Endereço',
  'Dependentes',
  'Termo de Adesão',
  'Confirmação',
]

interface CadastroFormProps {
  onSuccess: (data: any) => void
  initialVendedorRef?: string
  initialPlanoCode?: string
  isInstituto?: boolean
}

type BillingType = 'BOLETO' | 'CREDIT_CARD'
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

type PublicBillingConfig = {
  adesaoByPlanType: Record<string, number>
  mensalidadeByPlanType: Record<string, number>
  defaultPlanType: string
  planos: PlanOption[]
  mensalidadeBillingTypes: BillingType[]
  defaultMensalidadeBillingType: BillingType
}

function normalizePlanIdentifier(value: unknown) {
  const trimmed = String(value || '').trim()
  const upper = trimmed.toUpperCase()

  return upper === 'INDIVIDUAL' || upper === 'FAMILIAR' ? upper : trimmed
}

function findPlanOptionByCode(planos: PlanOption[], planCode: string | null | undefined) {
  const normalizedCode = normalizePlanIdentifier(planCode)
  if (!normalizedCode) return null

  return (
    planos.find((plan) => plan.codigo === normalizedCode) ||
    planos.find((plan) => plan.codigo.toLowerCase() === normalizedCode.toLowerCase()) ||
    null
  )
}

const CPF_CHECK_FALLBACK_ERROR = 'Não foi possível validar o CPF no momento. Tente novamente.'

function sanitizeApiErrorMessage(value: unknown) {
  if (typeof value !== 'string') return null

  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return null

  if (/(<!doctype|<html|cloudflare|error code 52\d|ssl handshake|cf-ray)/i.test(normalized)) {
    return null
  }

  const withoutHtmlTags = normalized.replace(/<[^>]+>/g, '').trim()
  if (!withoutHtmlTags || withoutHtmlTags.length > 220) {
    return null
  }

  return withoutHtmlTags
}

async function readApiErrorMessage(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return fallbackMessage
  }

  const payload = await response.json().catch(() => null) as { error?: unknown } | null
  const safeMessage = sanitizeApiErrorMessage(payload?.error)
  return safeMessage || fallbackMessage
}

export function CadastroForm({
  onSuccess,
  initialVendedorRef = '',
  initialPlanoCode = '',
  isInstituto = false,
}: CadastroFormProps) {
  const [step, setStep] = useState(0)
  const [validationStep, setValidationStep] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingCpf, setIsCheckingCpf] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aceiteTermos, setAceiteTermos] = useState(false)
  const [aceitePrivacidade, setAceitePrivacidade] = useState(false)
  const [billingConfig, setBillingConfig] = useState<PublicBillingConfig | null>(null)
  const [isLoadingBillingConfig, setIsLoadingBillingConfig] = useState(false)
  const [formData, setFormData] = useState<Partial<CadastroFormData>>({
    dependentes: [],
    tem_dependentes: false,
    tipo_plano: normalizePlanIdentifier(initialPlanoCode),
    mensalidade_billing_type: 'BOLETO',
  })
  const vendedorRef = initialVendedorRef.trim().toUpperCase()

  // Pular step 0 se plano já foi selecionado
  useEffect(() => {
    if (initialPlanoCode.trim()) {
      setStep(1)
    }
  }, [initialPlanoCode])

  useEffect(() => {
    let active = true
    setIsLoadingBillingConfig(true)

    const fetchBillingConfig = async () => {
      try {
        const refParam = vendedorRef ? `?ref=${encodeURIComponent(vendedorRef)}` : ''
        const response = await fetch(`/api/cadastro/cobranca-configuracoes${refParam}`, {
          cache: 'no-store',
        })
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(payload?.error || 'Não foi possível carregar configurações de cobrança.')
        }

        const toUpperTrim = (value: unknown) => String(value || '').trim().toUpperCase()
        const toAmount = (value: unknown, fallback: number) => {
          const parsed = Number(value)
          if (!Number.isFinite(parsed) || parsed <= 0) {
            return fallback
          }

          return Math.round((parsed + Number.EPSILON) * 100) / 100
        }
        const toNonNegativeAmount = (value: unknown, fallback: number) => {
          const parsed = Number(value)
          if (!Number.isFinite(parsed) || parsed < 0) {
            return fallback
          }

          return Math.round((parsed + Number.EPSILON) * 100) / 100
        }
        const toNonNegativeInteger = (value: unknown, fallback: number) => {
          const parsed = Number(value)
          if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
            return fallback
          }

          return parsed
        }
        const toOptionalNonNegativeInteger = (value: unknown, fallback: number | null = null) => {
          if (value === null || value === undefined || String(value).trim() === '') {
            return fallback
          }

          const parsed = Number(value)
          if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
            return fallback
          }

          return parsed
        }
        const isBillingType = (value: string): value is BillingType =>
          value === 'BOLETO' || value === 'CREDIT_CARD'

        const payloadObj =
          payload && typeof payload === 'object'
            ? (payload as Record<string, unknown>)
            : {}
        const mensalidadeByPlanTypePayload =
          payloadObj.mensalidadeByPlanType && typeof payloadObj.mensalidadeByPlanType === 'object'
            ? (payloadObj.mensalidadeByPlanType as Record<string, unknown>)
            : {}
        const adesaoByPlanTypePayload =
          payloadObj.adesaoByPlanType && typeof payloadObj.adesaoByPlanType === 'object'
            ? (payloadObj.adesaoByPlanType as Record<string, unknown>)
            : {}

        const parsedPlanos: PlanOption[] = (Array.isArray(payloadObj.planos) ? payloadObj.planos : [])
          .map((rawPlan) => {
            const plan =
              rawPlan && typeof rawPlan === 'object'
                ? (rawPlan as Record<string, unknown>)
                : {}
            const codigo = normalizePlanIdentifier(plan.codigo)
            const nome = String(plan.nome || '').trim()
            const descricao = String(plan.descricao || '').trim()
            const beneficios = Array.isArray(plan.beneficios)
              ? plan.beneficios
                  .map((item) => {
                    const beneficio =
                      item && typeof item === 'object'
                        ? (item as Record<string, unknown>)
                        : {}
                    const texto = String(beneficio.texto || '').trim()
                    if (!texto) return null
                    return {
                      texto,
                      inclui: beneficio.inclui !== false,
                    }
                  })
                  .filter((item): item is { texto: string; inclui: boolean } => Boolean(item))
              : []
            const valor = toAmount(plan.valor, 0)
            if (!codigo || !nome || valor <= 0) {
              return null
            }

            const permiteDependentes = Boolean(plan.permiteDependentes || codigo === 'FAMILIAR')
            const minDependentes = permiteDependentes
              ? Math.max(0, toNonNegativeInteger(plan.minDependentes, codigo === 'FAMILIAR' ? 1 : 0))
              : 0
            const maxDependentes = permiteDependentes
              ? toOptionalNonNegativeInteger(plan.maxDependentes, codigo === 'FAMILIAR' ? 4 : null)
              : null
            const valorDependenteAdicional = permiteDependentes
              ? toNonNegativeAmount(plan.valorDependenteAdicional, 0)
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
          .filter((plan): plan is PlanOption => Boolean(plan))

        const fallbackPlanos: PlanOption[] = [
          {
            codigo: 'INDIVIDUAL',
            nome: 'Plano Individual',
            descricao: 'Cobertura para o titular.',
            beneficios: [],
            valor: toAmount(
              mensalidadeByPlanTypePayload.INDIVIDUAL ?? payloadObj.mensalidadeValue,
              0
            ),
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
            valor: toAmount(
              mensalidadeByPlanTypePayload.FAMILIAR ?? payloadObj.mensalidadeValue,
              0
            ),
            permiteDependentes: true,
            minDependentes: 1,
            maxDependentes: 4,
            valorDependenteAdicional: 0,
          },
        ].filter((plan) => plan.valor > 0)

        const planos: PlanOption[] = parsedPlanos.length > 0
          ? parsedPlanos
          : fallbackPlanos

        if (planos.length === 0) {
          throw new Error('Nenhum plano ativo disponível para cadastro no momento.')
        }

        const mensalidadeByPlanType = planos.reduce((acc: Record<string, number>, plan: PlanOption) => {
          acc[plan.codigo] = toAmount(
            mensalidadeByPlanTypePayload[plan.codigo] ?? plan.valor,
            plan.valor
          )
          return acc
        }, {})
        const adesaoByPlanType = planos.reduce((acc: Record<string, number>, plan: PlanOption) => {
          acc[plan.codigo] = toAmount(
            adesaoByPlanTypePayload[plan.codigo] ?? mensalidadeByPlanType[plan.codigo],
            mensalidadeByPlanType[plan.codigo]
          )
          return acc
        }, {})

        const allowedPlanTypes = planos.map((plan) => plan.codigo)
        const defaultPlanTypeRequested = normalizePlanIdentifier(payloadObj.defaultPlanType)
        const defaultPlanType = allowedPlanTypes.includes(defaultPlanTypeRequested)
          ? defaultPlanTypeRequested
          : allowedPlanTypes[0]

        const mensalidadeBillingTypes: BillingType[] = Array.isArray(payloadObj.mensalidadeBillingTypes)
          ? payloadObj.mensalidadeBillingTypes
              .map((item: unknown) => toUpperTrim(item))
              .map((item: string) => (item === 'PIX' ? 'BOLETO' : item))
              .filter((item: string): item is BillingType => isBillingType(item))
          : ['BOLETO', 'CREDIT_CARD']
        const effectiveBillingTypes: BillingType[] =
          mensalidadeBillingTypes.length > 0
            ? Array.from(new Set(mensalidadeBillingTypes))
            : ['BOLETO', 'CREDIT_CARD']
        const requestedDefaultBillingTypeRaw = toUpperTrim(payloadObj.defaultMensalidadeBillingType)
        const requestedDefaultBillingType: BillingType =
          requestedDefaultBillingTypeRaw === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'BOLETO'
        const defaultMensalidadeBillingType = effectiveBillingTypes.includes(
          requestedDefaultBillingType
        )
          ? requestedDefaultBillingType
          : effectiveBillingTypes[0]

        const config: PublicBillingConfig = {
          adesaoByPlanType,
          mensalidadeByPlanType,
          defaultPlanType,
          planos,
          mensalidadeBillingTypes: effectiveBillingTypes,
          defaultMensalidadeBillingType,
        }

        if (!active) return
        setBillingConfig(config)
        setFormData((prev) => ({
          ...prev,
          tipo_plano: findPlanOptionByCode(planos, prev.tipo_plano)?.codigo || config.defaultPlanType,
          mensalidade_billing_type:
            prev.mensalidade_billing_type === 'CREDIT_CARD'
              ? 'CREDIT_CARD'
              : 'BOLETO',
        }))
      } catch (error) {
        if (!active) return
        setError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar configurações de cobrança.'
        )
      } finally {
        if (active) {
          setIsLoadingBillingConfig(false)
        }
      }
    }

    fetchBillingConfig()

    return () => {
      active = false
    }
  }, [vendedorRef])

  const checkCpfAlreadyRegistered = async (cpf: string) => {
    const response = await fetch(`/api/cadastro/verificar-cpf?cpf=${encodeURIComponent(cpf)}`)

    if (!response.ok) {
      const safeMessage = await readApiErrorMessage(response, CPF_CHECK_FALLBACK_ERROR)
      throw new Error(safeMessage)
    }

    const payload = await response.json().catch(() => ({}))
    return Boolean(payload.exists)
  }

  const handleNext = async () => {
    const stepError = getStepValidationError(step)
    if (stepError) {
      setError(stepError)
      setValidationStep(step)
      return
    }

    if (step === 1 && formData.cpf) {
      try {
        setIsCheckingCpf(true)
        const alreadyRegistered = await checkCpfAlreadyRegistered(formData.cpf)

        if (alreadyRegistered) {
          setError('CPF já identificado na nossa base de cadastrados.')
          setValidationStep(1)
          return
        }
      } catch (cpfCheckError) {
        setError(
          cpfCheckError instanceof Error
            ? cpfCheckError.message
            : CPF_CHECK_FALLBACK_ERROR
        )
        setValidationStep(1)
        return
      } finally {
        setIsCheckingCpf(false)
      }
    }

    if (step < STEPS.length - 1) {
      let nextStep = step + 1

      // Pular step 3 (Dependentes) se o plano não permitir
      if (nextStep === 3) {
        const selectedPlan = getPlanByCode(formData.tipo_plano)
        if (!selectedPlan?.permiteDependentes) {
          nextStep = 4 // Pula para Termo
        }
      }

      setStep(nextStep)
      setError(null)
      setValidationStep(null)
    }
  }

  const handlePrev = () => {
    if (step > 0) {
      let prevStep = step - 1

      // Pular step 3 (Dependentes) ao voltar se o plano não permitir
      if (prevStep === 3) {
        const selectedPlan = getPlanByCode(formData.tipo_plano)
        if (!selectedPlan?.permiteDependentes) {
          prevStep = 2 // Volta para Endereço
        }
      }

      setStep(prevStep)
      setError(null)
      setValidationStep(null)
    }
  }

  const updateFormData = (data: Partial<CadastroFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }))
    if (error) {
      setError(null)
    }
  }

  const hasValue = (value?: string) => Boolean(value?.trim())
  const getPlanByCode = (planCode: string | null | undefined) => {
    if (!billingConfig || !planCode) {
      return null
    }

    return findPlanOptionByCode(billingConfig.planos, planCode)
  }

  const getStepValidationError = (currentStep: number) => {
    if (currentStep === 0) {
      if (!hasValue(formData.tipo_plano)) {
        return 'Selecione um plano para continuar.'
      }
    }

    if (currentStep === 1) {
      if (
        !hasValue(formData.nome) ||
        !hasValue(formData.cpf) ||
        !hasValue(formData.rg) ||
        !hasValue(formData.email) ||
        !hasValue(formData.telefone) ||
        !hasValue(formData.sexo) ||
        !hasValue(formData.data_nascimento) ||
        !hasValue(formData.estado_civil) ||
        !hasValue(formData.escolaridade)
      ) {
        return 'Preencha todos os campos obrigatórios dos dados pessoais para continuar.'
      }

      if (formData.estado_civil === 'Casado(a)' && !hasValue(formData.nome_conjuge)) {
        return 'Informe o nome do cônjuge para continuar.'
      }

      if (formData.cpf && !isValidCPF(formData.cpf)) {
        return 'CPF do titular inválido.'
      }

      if (formData.email && !isValidEmail(formData.email)) {
        return 'Email do titular inválido.'
      }
    }

    if (currentStep === 2) {
      if (
        !hasValue(formData.endereco) ||
        !hasValue(formData.numero) ||
        !hasValue(formData.bairro) ||
        !hasValue(formData.cidade) ||
        !hasValue(formData.estado) ||
        !hasValue(formData.cep)
      ) {
        return 'Preencha todos os campos obrigatórios do endereço para continuar.'
      }
    }

    const selectedPlan = getPlanByCode(formData.tipo_plano)

    if (currentStep === 3 && selectedPlan?.permiteDependentes) {
      const dependentes = formData.dependentes || []
      const minDependentes = Math.max(0, Number(selectedPlan.minDependentes || 0))

      if (dependentes.length < minDependentes) {
        return `O plano selecionado exige ao menos ${minDependentes + 1} pessoas (titular + dependentes).`
      }

      if (selectedPlan.maxDependentes !== null && selectedPlan.maxDependentes > 0) {
        const maxDependentes = selectedPlan.maxDependentes
        if (dependentes.length > maxDependentes) {
          return `O plano selecionado permite no máximo ${maxDependentes} dependentes.`
        }
      }

      const invalidDependente = dependentes.find(
        (dep) =>
          !hasValue(dep.nome) ||
          !hasValue(dep.rg) ||
          !hasValue(dep.relacao) ||
          !hasValue(dep.email) ||
          !hasValue(dep.telefone_celular) ||
          !hasValue(dep.sexo)
      )

      if (invalidDependente) {
        return 'Cada dependente precisa ter nome, RG, relação, email, sexo e telefone celular.'
      }

      const invalidDependenteEmail = dependentes.find((dep) => dep.email && !isValidEmail(dep.email))
      if (invalidDependenteEmail) {
        return `Email inválido para dependente: ${invalidDependenteEmail.nome || 'sem nome'}.`
      }

      const titularEmail = String(formData.email || '').trim().toLowerCase()
      const dependenteComMesmoEmailTitularSemRegra = dependentes.find((dep) => {
        const dependenteEmail = String(dep.email || '').trim().toLowerCase()
        if (!titularEmail || dependenteEmail !== titularEmail) return false

        const age = getAgeFromIsoDate(String(dep.data_nascimento || '').trim())
        return age === null || age >= 18
      })

      if (dependenteComMesmoEmailTitularSemRegra) {
        return `Dependente ${dependenteComMesmoEmailTitularSemRegra.nome || 'sem nome'} só pode usar email do titular se for menor de idade.`
      }

      const invalidDependenteCpf = dependentes.find((dep) => dep.cpf && !isValidCPF(dep.cpf))
      if (invalidDependenteCpf) {
        return `CPF inválido para dependente: ${invalidDependenteCpf.nome || 'sem nome'}.`
      }
    }

    if (currentStep === 5) {
      if (!formData.tipo_plano || !selectedPlan) {
        return 'Selecione o tipo de plano.'
      }

      if (!formData.mensalidade_billing_type) {
        return 'Selecione a forma de cobrança da mensalidade.'
      }

      if (
        billingConfig &&
        !billingConfig.mensalidadeBillingTypes.includes(formData.mensalidade_billing_type)
      ) {
        return 'A forma de cobrança selecionada não está disponível no momento.'
      }
    }

    return null
  }

  const handleSubmit = async () => {
    try {
      setIsLoading(true)
      setError(null)

      if (
        !formData.nome ||
        !formData.cpf ||
        !formData.rg ||
        !formData.email ||
        !formData.telefone ||
        !formData.sexo ||
        !formData.data_nascimento ||
        !formData.estado_civil ||
        !formData.escolaridade
      ) {
        throw new Error('Dados pessoais incompletos')
      }

      if (formData.estado_civil === 'Casado(a)' && !formData.nome_conjuge?.trim()) {
        throw new Error('Nome do cônjuge é obrigatório para estado civil casado(a)')
      }

      if (!isValidCPF(formData.cpf)) {
        throw new Error('CPF do titular inválido')
      }

      if (!isValidEmail(formData.email)) {
        throw new Error('Email do titular inválido')
      }

      const selectedPlan = getPlanByCode(formData.tipo_plano)
      if (!formData.tipo_plano || !selectedPlan) {
        throw new Error('Selecione um plano válido')
      }

      const invalidDependente = (formData.dependentes || []).find(
        (dependente) =>
          !dependente.nome?.trim() ||
          !dependente.rg?.trim() ||
          !dependente.relacao?.trim() ||
          !dependente.email?.trim() ||
          !dependente.telefone_celular?.trim() ||
          !dependente.sexo?.trim()
      )

      if (selectedPlan.permiteDependentes && invalidDependente) {
        throw new Error(
          `Cada dependente precisa ter nome, RG, relação, email, sexo e telefone celular (${invalidDependente.nome || 'sem nome'}).`
        )
      }

      if (!selectedPlan.permiteDependentes && (formData.dependentes || []).length > 0) {
        throw new Error('O plano selecionado não permite dependentes')
      }

      const totalDependentes = (formData.dependentes || []).length
      const minDependentes = Math.max(0, Number(selectedPlan.minDependentes || 0))
      if (selectedPlan.permiteDependentes && totalDependentes < minDependentes) {
        throw new Error(
          `O plano selecionado exige ao menos ${minDependentes + 1} pessoas (titular + dependentes)`
        )
      }

      if (
        selectedPlan.permiteDependentes &&
        selectedPlan.maxDependentes !== null &&
        selectedPlan.maxDependentes > 0 &&
        totalDependentes > selectedPlan.maxDependentes
      ) {
        throw new Error(`O plano selecionado permite no máximo ${selectedPlan.maxDependentes} dependentes`)
      }

      const invalidDependenteEmail = (formData.dependentes || []).find(
        (dependente) => dependente.email && !isValidEmail(dependente.email)
      )

      if (invalidDependenteEmail) {
        throw new Error(`Email inválido para dependente: ${invalidDependenteEmail.nome}`)
      }

      const titularEmail = String(formData.email || '').trim().toLowerCase()
      const dependenteComMesmoEmailTitularSemRegra = (formData.dependentes || []).find((dependente) => {
        const dependenteEmail = dependente.email?.trim().toLowerCase() || ''
        if (!titularEmail || dependenteEmail !== titularEmail) return false

        const age = getAgeFromIsoDate(dependente.data_nascimento?.trim() || '')
        return age === null || age >= 18
      })

      if (dependenteComMesmoEmailTitularSemRegra) {
        throw new Error(
          `Dependente ${dependenteComMesmoEmailTitularSemRegra.nome || 'sem nome'} só pode usar email do titular se for menor de idade.`
        )
      }

      const invalidDependenteCpf = (formData.dependentes || []).find(
        (dependente) => dependente.cpf && !isValidCPF(dependente.cpf)
      )

      if (invalidDependenteCpf) {
        throw new Error(`CPF inválido para dependente: ${invalidDependenteCpf.nome}`)
      }

      if (
        !formData.endereco ||
        !formData.numero ||
        !formData.bairro ||
        !formData.cidade ||
        !formData.estado ||
        !formData.cep
      ) {
        throw new Error('Endereço incompleto')
      }

      if (!aceiteTermos || !aceitePrivacidade) {
        throw new Error('Você precisa aceitar os termos e a política de privacidade para concluir o cadastro')
      }

      if (!formData.mensalidade_billing_type) {
        throw new Error('Selecione a forma de cobrança da mensalidade')
      }

      const submitData = new FormData()
      submitData.append('nome', formData.nome)
      submitData.append('cpf', formData.cpf)
      submitData.append('rg', formData.rg)
      submitData.append('email', formData.email)
      submitData.append('data_nascimento', formData.data_nascimento || '')
      submitData.append('telefone', formData.telefone || '')
      submitData.append('sexo', formData.sexo || '')
      submitData.append('estado_civil', formData.estado_civil || '')
      submitData.append('nome_conjuge', formData.nome_conjuge || '')
      submitData.append('escolaridade', formData.escolaridade || '')
      submitData.append('endereco', formData.endereco || '')
      submitData.append('numero', formData.numero || '')
      submitData.append('complemento', formData.complemento || '')
      submitData.append('bairro', formData.bairro || '')
      submitData.append('cidade', formData.cidade || '')
      submitData.append('estado', formData.estado || '')
      submitData.append('cep', formData.cep || '')
      submitData.append('tem_dependentes', String(selectedPlan.permiteDependentes))
      submitData.append('dependentes', JSON.stringify(formData.dependentes || []))
      submitData.append('tipo_plano', formData.tipo_plano)
      submitData.append('mensalidade_billing_type', formData.mensalidade_billing_type)
      if (vendedorRef) {
        submitData.append('vendedor_ref', vendedorRef)
      }

      const response = await fetch('/api/cadastro', {
        method: 'POST',
        body: submitData,
      })

      if (!response.ok) {
        const safeMessage = await readApiErrorMessage(response, 'Erro ao enviar cadastro')
        throw new Error(safeMessage)
      }

      const result = await response.json()
      onSuccess(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <StepPlano
            planos={billingConfig?.planos || []}
            selectedPlanCode={formData.tipo_plano || ''}
            onSelectPlan={(codigo) => updateFormData({ tipo_plano: codigo })}
            onNext={handleNext}
            isLoading={isLoadingBillingConfig}
            isInstituto={isInstituto}
          />
        )
      case 1:
        return (
          <StepPessoal
            data={formData}
            onUpdate={updateFormData}
            showValidation={validationStep === 1}
          />
        )
      case 2:
        return (
          <StepEndereco
            data={formData}
            onUpdate={updateFormData}
            showValidation={validationStep === 2}
          />
        )
      case 3:
        return (
          <StepDependentes
            data={formData}
            onUpdate={updateFormData}
            planOptions={billingConfig?.planos || null}
            showValidation={validationStep === 3}
          />
        )
      case 4:
        return <StepTermo data={formData} />
      case 5:
        return (
          <StepConfirmacao
            data={formData}
            aceiteTermos={aceiteTermos}
            aceitePrivacidade={aceitePrivacidade}
            onAceiteTermosChange={setAceiteTermos}
            onAceitePrivacidadeChange={setAceitePrivacidade}
            billingConfig={billingConfig}
            isLoadingBillingConfig={isLoadingBillingConfig}
            onMensalidadeBillingTypeChange={(value) =>
              updateFormData({ mensalidade_billing_type: value })
            }
            showValidation={validationStep === 5}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-8">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm font-medium text-gray-600">
          <span>
            Etapa {step + 1} de {STEPS.length}
          </span>
          <span>{STEPS[step]}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      {/* Step Content */}
      <div className="min-h-96">
        {renderStep()}
      </div>

      {/* Navigation Buttons */}
      {step !== 0 && (
        <div className="pt-6 border-t border-gray-200 space-y-4">
          <div className="flex justify-between">
            <Button
              onClick={handlePrev}
              disabled={step === 0 || isLoading}
              variant="outline"
            >
              Voltar
            </Button>

            {step === STEPS.length - 1 ? (
              <Button
                onClick={handleSubmit}
                disabled={isLoading || isLoadingBillingConfig || !aceiteTermos || !aceitePrivacidade}
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading ? 'Enviando...' : 'Concluir Cadastro'}
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={isLoading || isCheckingCpf}>
                {isCheckingCpf ? 'Validando CPF...' : 'Próximo'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
