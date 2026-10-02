import type { AsaasSubscriptionInfo, CreateAsaasSubscriptionInput } from './asaas'

type RotationInput = {
  cadastroId: string
  customerId: string
  oldSubscription: AsaasSubscriptionInfo
  newValue: number
  baseDate?: Date
}

type RotationDependencies = {
  createSubscription: (
    input: CreateAsaasSubscriptionInput
  ) => Promise<{ id: string; nextDueDate?: string }>
  suspendSubscription: (subscriptionId: string) => Promise<void>
  reactivateSubscription: (subscriptionId: string, nextDueDate: string) => Promise<void>
  cancelSubscription: (subscriptionId: string) => Promise<void>
  persistSubscription: (oldSubscriptionId: string, newSubscriptionId: string, newValue: number) => Promise<void>
}

const SUPPORTED_BILLING_TYPES = new Set(['BOLETO', 'CREDIT_CARD', 'PIX'])

function toIsoDate(year: number, month: number, day: number) {
  return [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-')
}

export function getNextMonthDueDate(baseDate: Date = new Date()) {
  const sourceYear = baseDate.getUTCFullYear()
  const sourceMonth = baseDate.getUTCMonth()
  const targetMonthDate = new Date(Date.UTC(sourceYear, sourceMonth + 1, 1))
  const targetYear = targetMonthDate.getUTCFullYear()
  const targetMonth = targetMonthDate.getUTCMonth()
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const targetDay = Math.min(baseDate.getUTCDate(), lastDay)

  return toIsoDate(targetYear, targetMonth + 1, targetDay)
}

function normalizeBillingType(value: string | undefined): CreateAsaasSubscriptionInput['billingType'] {
  const normalized = String(value || '').trim().toUpperCase()
  return SUPPORTED_BILLING_TYPES.has(normalized)
    ? normalized as CreateAsaasSubscriptionInput['billingType']
    : 'BOLETO'
}

export async function rotateDependentSubscription(
  input: RotationInput,
  dependencies: RotationDependencies
) {
  const nextDueDate = getNextMonthDueDate(input.baseDate)
  const oldSubscriptionId = input.oldSubscription.id.trim()
  const oldNextDueDate = input.oldSubscription.nextDueDate || nextDueDate
  let newSubscriptionId: string | null = null
  let oldSubscriptionSuspended = false

  try {
    const created = await dependencies.createSubscription({
      customer: input.customerId,
      billingType: normalizeBillingType(input.oldSubscription.billingType),
      value: input.newValue,
      nextDueDate,
      cycle: 'MONTHLY',
      maxPayments: 12,
      description: 'Mensalidade Nova Aliança Saúde',
      externalReference: input.cadastroId,
    })
    newSubscriptionId = created.id

    await dependencies.suspendSubscription(oldSubscriptionId)
    oldSubscriptionSuspended = true

    await dependencies.persistSubscription(
      oldSubscriptionId,
      newSubscriptionId,
      input.newValue
    )

    return { subscriptionId: newSubscriptionId, nextDueDate }
  } catch (error) {
    const rollbackErrors: unknown[] = []

    if (newSubscriptionId) {
      try {
        await dependencies.cancelSubscription(newSubscriptionId)
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
    }

    if (oldSubscriptionSuspended) {
      try {
        await dependencies.reactivateSubscription(oldSubscriptionId, oldNextDueDate)
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
    }

    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        'Falha ao trocar a assinatura e ao concluir a reversão no Asaas.'
      )
    }

    throw error
  }
}
