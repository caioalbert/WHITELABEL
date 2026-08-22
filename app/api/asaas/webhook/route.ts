import {
  AsaasIntegrationError,
  cancelAsaasSubscription,
  createAsaasSubscription,
  getAsaasPayment,
  isAsaasPaidStatus,
  listAsaasSubscriptions,
} from '@/lib/asaas'
import {
  MIN_ASAAS_CHARGE_VALUE,
  getBillingSettings,
  getMensalidadeValueByPlanType,
} from '@/lib/billing-settings'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncCadastroToRapidoc } from '@/lib/rapidoc-sync'
import {
  EMPRESA_STATUSES,
  getEmpresaExternalReference,
  parseEmpresaExternalReference,
} from '@/lib/empresa-flow'
import { NextRequest, NextResponse } from 'next/server'

const HANDLED_EVENTS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'])
const SUBSCRIPTION_LOCK_PREFIX = 'LOCK:'
const SUBSCRIPTION_LOCK_TTL_MS = 10 * 60 * 1000
const FIDELIDADE_MAX_PAYMENTS = 12

const CADASTRO_SELECT_FIELDS =
  'id, status, asaas_customer_id, asaas_payment_id, asaas_subscription_id, tipo_plano, mensalidade_valor, mensalidade_billing_type, updated_at'

type AsaasWebhookPayment = {
  id?: string
  customer?: string
  externalReference?: string
  status?: string
}

type AsaasWebhookPayload = {
  event?: string
  payment?: AsaasWebhookPayment
}

type CadastroWebhookRecord = {
  id: string
  status: string | null
  asaas_customer_id: string | null
  asaas_payment_id: string | null
  asaas_subscription_id: string | null
  tipo_plano: string | null
  mensalidade_valor: number | null
  mensalidade_billing_type: string | null
  updated_at: string | null
}

type EmpresaWebhookRecord = {
  id: string
  status: string
  asaas_customer_id: string | null
  asaas_payment_id: string | null
  asaas_subscription_id: string | null
  tipo_plano: string
  mensalidade_valor: number | null
  mensalidade_billing_type: string | null
  endereco: string | null
  numero: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function getAppBaseUrl(request: NextRequest) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (envUrl) return envUrl.replace(/\/$/, '')
  return request.nextUrl.origin
}

function getWebhookTokenFromRequest(request: NextRequest) {
  const accessTokenHeader = request.headers.get('asaas-access-token')?.trim()
  if (accessTokenHeader) return accessTokenHeader

  const alternateHeader = request.headers.get('x-asaas-access-token')?.trim()
  if (alternateHeader) return alternateHeader

  const auth = request.headers.get('authorization')?.trim()
  if (auth?.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim()
  }

  return ''
}

function getRequiredEnvToken(name: string) {
  const token = process.env[name]?.trim()
  if (!token) {
    throw new AsaasIntegrationError(
      `Webhook Asaas indisponível. Configure ${name}.`,
      'configuration',
      503
    )
  }

  return token
}

function getNextMonthlyDueDate(baseDate: Date = new Date()) {
  const next = new Date(baseDate)
  next.setMonth(next.getMonth() + 1)
  return toIsoDate(next)
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isSchemaIssue(details: string) {
  return /asaas_payment_id|asaas_subscription_id|status|adesao_pago_em|mensalidade_billing_type|tipo_plano|mensalidade_valor|updated_at/i.test(
    details
  )
}

function isSubscriptionLockToken(subscriptionId: string | null | undefined) {
  return String(subscriptionId || '').trim().startsWith(SUBSCRIPTION_LOCK_PREFIX)
}

function createSubscriptionLockToken(paymentId: string) {
  return `${SUBSCRIPTION_LOCK_PREFIX}${Date.now()}:${paymentId}:${crypto.randomUUID()}`
}

function getSubscriptionLockTimestamp(lockToken: string) {
  if (!isSubscriptionLockToken(lockToken)) return null

  const [, timestampPart] = lockToken.split(':')
  const timestamp = Number(timestampPart)
  if (!Number.isFinite(timestamp)) return null

  return timestamp
}

function isSubscriptionLockStale(lockToken: string, now = Date.now()) {
  const lockTimestamp = getSubscriptionLockTimestamp(lockToken)
  if (lockTimestamp === null) return true
  return now - lockTimestamp > SUBSCRIPTION_LOCK_TTL_MS
}

function normalizeSubscriptionId(value: string | null | undefined) {
  return String(value || '').trim()
}

async function fetchCadastroByPaymentReference(
  supabase: ReturnType<typeof createAdminClient>,
  paymentId: string,
  externalReference?: string
) {
  const initialResult = await supabase
    .from('cadastros')
    .select(CADASTRO_SELECT_FIELDS)
    .eq('asaas_payment_id', paymentId)
    .maybeSingle<CadastroWebhookRecord>()

  if (initialResult.data || !externalReference) {
    return initialResult
  }

  return supabase
    .from('cadastros')
    .select(CADASTRO_SELECT_FIELDS)
    .eq('id', externalReference)
    .maybeSingle<CadastroWebhookRecord>()
}

async function fetchCadastroById(supabase: ReturnType<typeof createAdminClient>, cadastroId: string) {
  return supabase
    .from('cadastros')
    .select(CADASTRO_SELECT_FIELDS)
    .eq('id', cadastroId)
    .maybeSingle<CadastroWebhookRecord>()
}

async function releaseSubscriptionLock(
  supabase: ReturnType<typeof createAdminClient>,
  cadastroId: string,
  lockToken: string
) {
  const { error } = await supabase
    .from('cadastros')
    .update({ asaas_subscription_id: null })
    .eq('id', cadastroId)
    .eq('asaas_subscription_id', lockToken)

  if (error) {
    console.error('Webhook: falha ao liberar lock da assinatura', {
      cadastroId,
      lockToken,
      error,
    })
  }
}

async function findAsaasSubscriptionByExternalReference(
  cadastroId: string,
  asaasCustomerId: string
): Promise<string | null> {
  const subscriptions = await listAsaasSubscriptions({
    customer: asaasCustomerId,
    externalReference: cadastroId,
    limit: 100,
  })

  const activeSubscription = subscriptions.find((subscription) => {
    const status = String(subscription.status || '').trim().toUpperCase()
    return status === 'ACTIVE' || status === 'INACTIVE'
  })

  const candidate = activeSubscription || subscriptions[0]
  const id = normalizeSubscriptionId(candidate?.id)
  return id || null
}

async function triggerTermoEmail(cadastroId: string, request: NextRequest) {
  const appBaseUrl = getAppBaseUrl(request)
  let lastErrorMessage = ''

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${appBaseUrl}/api/enviar-termo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': getRequiredEnvToken('ASAAS_WEBHOOK_TOKEN'),
        },
        body: JSON.stringify({ cadastroId }),
        cache: 'no-store',
      })

      if (response.ok) {
        return
      }

      const body = await response.text().catch(() => '')
      lastErrorMessage = `status=${response.status} body=${body || 'sem corpo'}`
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : String(error)
    }

    if (attempt < 3) {
      await wait(attempt * 500)
    }
  }

  throw new Error(
    `Falha ao enviar termo após confirmação de pagamento para cadastro ${cadastroId}. ${lastErrorMessage}`
  )
}

async function findEmpresaByPaymentReference(
  supabase: ReturnType<typeof createAdminClient>,
  paymentId: string,
  externalReference?: string
) {
  const byPayment = await supabase
    .from('empresas')
    .select('id, status, asaas_customer_id, asaas_payment_id, asaas_subscription_id, tipo_plano, mensalidade_valor, mensalidade_billing_type, endereco, numero, bairro, cidade, estado, cep')
    .eq('asaas_payment_id', paymentId)
    .maybeSingle<EmpresaWebhookRecord>()
  if (byPayment.data || byPayment.error) return byPayment

  const empresaId = parseEmpresaExternalReference(externalReference)
  if (!empresaId) return byPayment

  return supabase
    .from('empresas')
    .select('id, status, asaas_customer_id, asaas_payment_id, asaas_subscription_id, tipo_plano, mensalidade_valor, mensalidade_billing_type, endereco, numero, bairro, cidade, estado, cep')
    .eq('id', empresaId)
    .maybeSingle<EmpresaWebhookRecord>()
}

async function releaseEmpresaSubscriptionLock(
  supabase: ReturnType<typeof createAdminClient>,
  empresaId: string,
  lockToken: string
) {
  await supabase
    .from('empresas')
    .update({ asaas_subscription_id: null })
    .eq('id', empresaId)
    .eq('asaas_subscription_id', lockToken)
}

async function provisionEmpresaFuncionarios(
  supabase: ReturnType<typeof createAdminClient>,
  empresa: EmpresaWebhookRecord,
  activatedAt: string
) {
  const { data: funcionarios, error } = await supabase
    .from('empresa_funcionarios')
    .select('id, cadastro_id, nome, cpf, rg, email, telefone, data_nascimento, sexo')
    .eq('empresa_id', empresa.id)
  if (error) throw error
  if (!funcionarios?.length) throw new Error('Empresa sem funcionários para provisionar.')

  const cadastroIds: string[] = []
  for (const funcionario of funcionarios) {
    let cadastroId = funcionario.cadastro_id as string | null

    if (!cadastroId) {
      const { data: existing, error: existingError } = await supabase
        .from('cadastros')
        .select('id')
        .eq('empresa_id', empresa.id)
        .eq('cpf', funcionario.cpf)
        .maybeSingle()
      if (existingError) throw existingError

      cadastroId = existing?.id || crypto.randomUUID()
      if (!existing) {
        const { error: insertError } = await supabase.from('cadastros').insert({
          id: cadastroId,
          empresa_id: empresa.id,
          nome: funcionario.nome,
          email: funcionario.email,
          cpf: funcionario.cpf,
          rg: funcionario.rg,
          data_nascimento: funcionario.data_nascimento,
          telefone: funcionario.telefone,
          sexo: funcionario.sexo,
          endereco: empresa.endereco,
          numero: empresa.numero,
          bairro: empresa.bairro,
          cidade: empresa.cidade,
          estado: empresa.estado,
          cep: empresa.cep,
          tem_dependentes: false,
          status: EMPRESA_STATUSES.pagamento,
          tipo_plano: empresa.tipo_plano,
          mensalidade_billing_type: empresa.mensalidade_billing_type,
        })
        if (insertError) throw insertError
      }

      const { error: linkError } = await supabase
        .from('empresa_funcionarios')
        .update({ cadastro_id: cadastroId })
        .eq('id', funcionario.id)
        .eq('empresa_id', empresa.id)
      if (linkError) throw linkError
    }

    if (!cadastroId) throw new Error('Não foi possível vincular o funcionário ao cadastro.')
    cadastroIds.push(cadastroId)
  }

  const { error: activationError } = await supabase
    .from('cadastros')
    .update({ status: 'ATIVO', adesao_pago_em: activatedAt })
    .eq('empresa_id', empresa.id)
    .in('id', cadastroIds)
  if (activationError) throw activationError

  await Promise.all(cadastroIds.map((id) =>
    syncCadastroToRapidoc(id).catch((syncError) => {
      console.error('Webhook: falha ao sincronizar funcionário empresarial', {
        empresaId: empresa.id,
        cadastroId: id,
        error: syncError,
      })
    })
  ))

  return cadastroIds.length
}

async function processEmpresaPayment(
  supabase: ReturnType<typeof createAdminClient>,
  empresa: EmpresaWebhookRecord,
  paymentId: string
) {
  const asaasPayment = await getAsaasPayment(paymentId)
  if (!isAsaasPaidStatus(asaasPayment.status)) {
    return NextResponse.json({
      received: true,
      ignored: true,
      reason: `Pagamento empresarial ainda não confirmado no Asaas (status: ${asaasPayment.status || 'desconhecido'}).`,
    })
  }

  if (
    empresa.asaas_customer_id &&
    asaasPayment.customer &&
    empresa.asaas_customer_id !== asaasPayment.customer
  ) {
    return NextResponse.json(
      { error: 'Pagamento não corresponde à empresa esperada.' },
      { status: 409 }
    )
  }

  const activatedAt = new Date().toISOString()
  const initialSubscriptionId = normalizeSubscriptionId(empresa.asaas_subscription_id)
  if (empresa.status === EMPRESA_STATUSES.ativo) {
    const provisioned = await provisionEmpresaFuncionarios(supabase, empresa, activatedAt)
    return NextResponse.json({
      received: true,
      processed: true,
      alreadyProcessed: true,
      empresaId: empresa.id,
      funcionariosAtivados: provisioned,
    })
  }

  if (empresa.status !== EMPRESA_STATUSES.pagamento) {
    return NextResponse.json(
      { error: 'A empresa não concluiu as etapas anteriores ao pagamento.' },
      { status: 409 }
    )
  }
  if (!empresa.asaas_customer_id) {
    return NextResponse.json({ error: 'Empresa sem cliente Asaas associado.' }, { status: 500 })
  }

  let subscriptionId = initialSubscriptionId
  let lockToken: string | null = null
  let createdNewSubscription = false

  if (!subscriptionId || isSubscriptionLockToken(subscriptionId)) {
    if (subscriptionId && !isSubscriptionLockStale(subscriptionId)) {
      return NextResponse.json({ error: 'Ativação empresarial já está em processamento.' }, { status: 409 })
    }

    const newLock = createSubscriptionLockToken(paymentId)
    let query = supabase
      .from('empresas')
      .update({ asaas_subscription_id: newLock })
      .eq('id', empresa.id)
      .eq('status', EMPRESA_STATUSES.pagamento)
    query = subscriptionId
      ? query.eq('asaas_subscription_id', subscriptionId)
      : query.is('asaas_subscription_id', null)
    const { data: locked, error: lockError } = await query.select('id').maybeSingle()
    if (lockError) throw lockError
    if (!locked) {
      return NextResponse.json({ error: 'Ativação empresarial já está em processamento.' }, { status: 409 })
    }
    lockToken = newLock

    const externalReference = getEmpresaExternalReference(empresa.id)
    subscriptionId = await findAsaasSubscriptionByExternalReference(
      externalReference,
      empresa.asaas_customer_id
    ) || ''

    if (!subscriptionId) {
      const value = Number(empresa.mensalidade_valor)
      if (!Number.isFinite(value) || value < MIN_ASAAS_CHARGE_VALUE) {
        await releaseEmpresaSubscriptionLock(supabase, empresa.id, newLock)
        return NextResponse.json({ error: 'Valor empresarial inválido para assinatura.' }, { status: 500 })
      }
      const subscription = await createAsaasSubscription({
        customer: empresa.asaas_customer_id,
        billingType: empresa.mensalidade_billing_type === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'BOLETO',
        value,
        nextDueDate: getNextMonthlyDueDate(),
        cycle: 'MONTHLY',
        maxPayments: FIDELIDADE_MAX_PAYMENTS,
        description: 'Mensalidade empresarial Aliança Saúde',
        externalReference,
      })
      subscriptionId = subscription.id
      createdNewSubscription = true
    }

    const { data: activated, error: activationError } = await supabase
      .from('empresas')
      .update({
        status: EMPRESA_STATUSES.ativo,
        pagamento_confirmado_em: activatedAt,
        asaas_subscription_id: subscriptionId,
      })
      .eq('id', empresa.id)
      .eq('status', EMPRESA_STATUSES.pagamento)
      .eq('asaas_subscription_id', newLock)
      .select('id')
      .maybeSingle()
    if (activationError || !activated) {
      if (createdNewSubscription) await cancelAsaasSubscription(subscriptionId).catch(() => undefined)
      await releaseEmpresaSubscriptionLock(supabase, empresa.id, newLock)
      throw activationError || new Error('Não foi possível ativar a empresa.')
    }
  } else {
    const { error } = await supabase
      .from('empresas')
      .update({ status: EMPRESA_STATUSES.ativo, pagamento_confirmado_em: activatedAt })
      .eq('id', empresa.id)
      .eq('status', EMPRESA_STATUSES.pagamento)
    if (error) throw error
  }

  const activeEmpresa = { ...empresa, status: EMPRESA_STATUSES.ativo, asaas_subscription_id: subscriptionId }
  const provisioned = await provisionEmpresaFuncionarios(supabase, activeEmpresa, activatedAt)
  return NextResponse.json({
    received: true,
    processed: true,
    empresaId: empresa.id,
    asaasPaymentId: paymentId,
    asaasSubscriptionId: subscriptionId,
    funcionariosAtivados: provisioned,
    lockUsed: Boolean(lockToken),
  })
}

export async function POST(request: NextRequest) {
  try {
    const expectedToken = getRequiredEnvToken('ASAAS_WEBHOOK_TOKEN')
    const providedToken = getWebhookTokenFromRequest(request)

    if (!providedToken || providedToken !== expectedToken) {
      return NextResponse.json({ error: 'Webhook token inválido.' }, { status: 401 })
    }

    const payload = (await request.json().catch(() => null)) as AsaasWebhookPayload | null
    if (!payload?.event || !payload.payment?.id) {
      return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
    }

    if (!HANDLED_EVENTS.has(payload.event)) {
      return NextResponse.json({
        received: true,
        ignored: true,
        reason: `Evento ${payload.event} não é tratado por esta rota.`,
      })
    }

    const paymentId = payload.payment.id
    const supabase = createAdminClient()

    const empresaResult = await findEmpresaByPaymentReference(
      supabase,
      paymentId,
      payload.payment.externalReference
    )
    if (empresaResult.error) {
      console.error('Webhook: erro ao buscar empresa', empresaResult.error)
      return NextResponse.json({ error: 'Erro ao buscar empresa local.' }, { status: 500 })
    }
    if (empresaResult.data) {
      return processEmpresaPayment(supabase, empresaResult.data, paymentId)
    }

    const cadastroResult = await fetchCadastroByPaymentReference(
      supabase,
      paymentId,
      payload.payment.externalReference
    )

    if (cadastroResult.error) {
      const details = `${cadastroResult.error.message || ''} ${cadastroResult.error.details || ''}`
      if (isSchemaIssue(details)) {
        return NextResponse.json(
          {
            error:
              'Banco desatualizado. Execute scripts/001_create_tables.sql, scripts/004_add_cadastro_pagamentos.sql, scripts/005_add_billing_settings_admin.sql e scripts/006_add_plan_type_pricing.sql.',
          },
          { status: 500 }
        )
      }

      console.error('Webhook: erro ao buscar cadastro', cadastroResult.error)
      return NextResponse.json({ error: 'Erro ao buscar cliente local.' }, { status: 500 })
    }

    const cadastro = cadastroResult.data
    if (!cadastro) {
      return NextResponse.json({
        received: true,
        ignored: true,
        reason: 'Cliente local não encontrado para este pagamento.',
      })
    }

    const initialSubscriptionId = normalizeSubscriptionId(cadastro.asaas_subscription_id)
    if (cadastro.status === 'ATIVO' && initialSubscriptionId && !isSubscriptionLockToken(initialSubscriptionId)) {
      return NextResponse.json({
        received: true,
        processed: true,
        alreadyProcessed: true,
      })
    }

    const asaasPayment = await getAsaasPayment(paymentId)
    if (!isAsaasPaidStatus(asaasPayment.status)) {
      return NextResponse.json({
        received: true,
        ignored: true,
        reason: `Pagamento ainda não confirmado no Asaas (status: ${asaasPayment.status || 'desconhecido'}).`,
      })
    }

    if (cadastro.asaas_customer_id && asaasPayment.customer && cadastro.asaas_customer_id !== asaasPayment.customer) {
      console.error('Webhook: customer mismatch', {
        cadastroId: cadastro.id,
        cadastroCustomerId: cadastro.asaas_customer_id,
        paymentCustomerId: asaasPayment.customer,
      })
      return NextResponse.json(
        { error: 'Pagamento não corresponde ao cliente esperado.' },
        { status: 409 }
      )
    }

    let lockToken: string | null = null
    let subscriptionId = normalizeSubscriptionId(cadastro.asaas_subscription_id)
    let createdNewSubscription = false

    if (!subscriptionId || isSubscriptionLockToken(subscriptionId)) {
      if (!cadastro.asaas_customer_id) {
        return NextResponse.json(
          { error: 'Cliente sem asaas_customer_id. Não é possível criar assinatura.' },
          { status: 500 }
        )
      }

      const currentLockToken = isSubscriptionLockToken(subscriptionId) ? subscriptionId : null
      if (currentLockToken && !isSubscriptionLockStale(currentLockToken)) {
        return NextResponse.json(
          { error: 'Ativação já está sendo processada para este pagamento.' },
          { status: 409 }
        )
      }

      const newLockToken = createSubscriptionLockToken(paymentId)
      let lockUpdateQuery = supabase
        .from('cadastros')
        .update({ asaas_subscription_id: newLockToken })
        .eq('id', cadastro.id)

      if (currentLockToken) {
        lockUpdateQuery = lockUpdateQuery.eq('asaas_subscription_id', currentLockToken)
      } else {
        lockUpdateQuery = lockUpdateQuery.is('asaas_subscription_id', null)
      }

      const { data: lockData, error: lockError } = await lockUpdateQuery
        .select('id')
        .maybeSingle<{ id: string }>()

      if (lockError) {
        console.error('Webhook: erro ao adquirir lock de assinatura', lockError)
        return NextResponse.json(
          { error: 'Erro ao reservar processamento de assinatura.' },
          { status: 500 }
        )
      }

      if (!lockData) {
        const refreshedCadastroResult = await fetchCadastroById(supabase, cadastro.id)
        if (refreshedCadastroResult.error) {
          console.error('Webhook: erro ao recarregar cadastro após lock concorrente', refreshedCadastroResult.error)
          return NextResponse.json(
            { error: 'Erro ao validar processamento concorrente da assinatura.' },
            { status: 500 }
          )
        }

        const refreshedCadastro = refreshedCadastroResult.data
        const refreshedSubscriptionId = normalizeSubscriptionId(refreshedCadastro?.asaas_subscription_id)

        if (
          refreshedCadastro &&
          refreshedCadastro.status === 'ATIVO' &&
          refreshedSubscriptionId &&
          !isSubscriptionLockToken(refreshedSubscriptionId)
        ) {
          return NextResponse.json({
            received: true,
            processed: true,
            alreadyProcessed: true,
            asaasSubscriptionId: refreshedSubscriptionId,
          })
        }

        return NextResponse.json(
          { error: 'Ativação já está sendo processada para este pagamento.' },
          { status: 409 }
        )
      }

      lockToken = newLockToken

      const billingSettings = await getBillingSettings()
      const billingTypeRequested = String(cadastro.mensalidade_billing_type || '')
        .trim()
        .toUpperCase()
      const billingType = billingTypeRequested === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'BOLETO'
      const storedMensalidadeValue = Number(cadastro.mensalidade_valor)
      const mensalidadeValue =
        Number.isFinite(storedMensalidadeValue) && storedMensalidadeValue > 0
          ? storedMensalidadeValue
          : getMensalidadeValueByPlanType(billingSettings, cadastro.tipo_plano)

      if (mensalidadeValue < MIN_ASAAS_CHARGE_VALUE) {
        await releaseSubscriptionLock(supabase, cadastro.id, newLockToken)
        return NextResponse.json(
          {
            error: `Configuração de cobrança inválida. O valor mínimo permitido pelo Asaas é R$ ${MIN_ASAAS_CHARGE_VALUE.toFixed(2).replace('.', ',')}.`,
          },
          { status: 500 }
        )
      }

      const alreadyExistingSubscriptionId = await findAsaasSubscriptionByExternalReference(
        cadastro.id,
        cadastro.asaas_customer_id
      )

      if (alreadyExistingSubscriptionId) {
        subscriptionId = alreadyExistingSubscriptionId
      } else {
        const nextDueDate = getNextMonthlyDueDate()

        try {
          const subscription = await createAsaasSubscription({
            customer: cadastro.asaas_customer_id,
            billingType,
            value: mensalidadeValue,
            nextDueDate,
            cycle: 'MONTHLY',
            maxPayments: FIDELIDADE_MAX_PAYMENTS,
            description: 'Mensalidade SHALOM Saúde',
            externalReference: cadastro.id,
          })

          subscriptionId = subscription.id
          createdNewSubscription = true
        } catch (error) {
          await releaseSubscriptionLock(supabase, cadastro.id, newLockToken)
          throw error
        }
      }

      const nowIso = new Date().toISOString()
      const { data: updatedCadastro, error: updateError } = await supabase
        .from('cadastros')
        .update({
          status: 'ATIVO',
          adesao_pago_em: nowIso,
          asaas_subscription_id: subscriptionId,
        })
        .eq('id', cadastro.id)
        .eq('asaas_subscription_id', newLockToken)
        .select('id')
        .maybeSingle<{ id: string }>()

      if (updateError || !updatedCadastro) {
        if (createdNewSubscription && subscriptionId) {
          try {
            await cancelAsaasSubscription(subscriptionId)
          } catch (rollbackError) {
            console.error('Webhook: falha ao cancelar assinatura após erro de persistência', {
              cadastroId: cadastro.id,
              subscriptionId,
              rollbackError,
            })
          }
        }

        await releaseSubscriptionLock(supabase, cadastro.id, newLockToken)

        console.error('Webhook: erro ao atualizar cadastro após criar assinatura', updateError)
        return NextResponse.json({ error: 'Erro ao ativar cliente.' }, { status: 500 })
      }
    } else {
      const nowIso = new Date().toISOString()
      const { error: updateError } = await supabase
        .from('cadastros')
        .update({
          status: 'ATIVO',
          adesao_pago_em: nowIso,
          asaas_subscription_id: subscriptionId,
        })
        .eq('id', cadastro.id)

      if (updateError) {
        console.error('Webhook: erro ao atualizar cadastro com assinatura existente', updateError)
        return NextResponse.json({ error: 'Erro ao ativar cliente.' }, { status: 500 })
      }
    }

    try {
      await triggerTermoEmail(cadastro.id, request)
    } catch (error) {
      console.error('Webhook: falha ao enviar termo após ativação', {
        cadastroId: cadastro.id,
        error,
      })
    }

    // --- NOVA INTEGRAÇÃO RAPIDOC ---
    try {
      await syncCadastroToRapidoc(cadastro.id)
    } catch (error) {
      console.error('Webhook: falha ao exportar paciente para Rapidoc após ativação', {
        cadastroId: cadastro.id,
        error,
      })
    }
    // -------------------------------

    return NextResponse.json({
      received: true,
      processed: true,
      cadastroId: cadastro.id,
      asaasPaymentId: paymentId,
      asaasSubscriptionId: subscriptionId,
      lockUsed: Boolean(lockToken),
    })
  } catch (error) {
    if (error instanceof AsaasIntegrationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Webhook Asaas error:', error)
    return NextResponse.json({ error: 'Erro ao processar webhook Asaas.' }, { status: 500 })
  }
}
