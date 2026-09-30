export const DEFAULT_CONTRACT_MONTHS = 12

export type BillingSchedule = {
  primeira_parcela_vencimento: string
  dia_vencimento: number
  parcelas_mesmo_dia: boolean
  contrato_meses: number
}

export type StoredBillingSchedule = Partial<BillingSchedule> | null

export function billingToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now)
}

export function isBillingDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function parseBillingSchedule(input: Record<string, unknown>, today = billingToday()): BillingSchedule {
  const first = input.primeira_parcela_vencimento
  if (!isBillingDate(first) || first < today) {
    throw new Error('Informe uma data válida para a primeira parcela, a partir de hoje.')
  }
  if (typeof input.parcelas_mesmo_dia !== 'boolean') {
    throw new Error('Informe se as demais parcelas vencem no mesmo dia da primeira.')
  }
  const months = Number(input.contrato_meses ?? DEFAULT_CONTRACT_MONTHS)
  if (!Number.isInteger(months) || months < 1 || months > 60) {
    throw new Error('Informe um prazo de contrato entre 1 e 60 meses.')
  }
  const sameDay = months === 1 || input.parcelas_mesmo_dia
  const day = sameDay ? Number(first.slice(8, 10)) : Number(input.dia_vencimento)
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error('Escolha um dia de vencimento entre 1 e 31.')
  }
  return { primeira_parcela_vencimento: first, dia_vencimento: day, parcelas_mesmo_dia: sameDay, contrato_meses: months }
}

/** Always anchor on the agreed first due date, never on the payment/confirmation date. */
export function installmentDueDate(first: string, day: number, monthOffset: number): string {
  const [year, month] = first.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + monthOffset, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}

export function subsequentInstallments(schedule: StoredBillingSchedule, legacyFirstDate?: string | null) {
  const first = schedule?.primeira_parcela_vencimento || legacyFirstDate?.slice(0, 10)
  if (!first || !isBillingDate(first)) return []
  // Old contracts retain their original schedule; new contracts include the first payment.
  const count = schedule?.contrato_meses != null ? schedule.contrato_meses - 1 : 12
  const day = schedule?.dia_vencimento || Number(first.slice(8, 10))
  return Array.from({ length: Math.max(0, count) }, (_, i) => ({
    index: schedule?.contrato_meses != null ? i + 2 : i + 1,
    dueDate: installmentDueDate(first, day, i + 1),
  }))
}

export function recurringBillingTerms(schedule: StoredBillingSchedule, legacyFirstDate: string) {
  const installments = subsequentInstallments(schedule, legacyFirstDate)
  return { nextDueDate: installments[0]?.dueDate, maxPayments: installments.length }
}
