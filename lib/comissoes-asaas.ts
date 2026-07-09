import {
  isAsaasPaidStatus,
  listAsaasSubscriptionPayments,
  type AsaasPaymentInfo,
} from '@/lib/asaas'

type CadastroComissaoAsaasSource = {
  id: string
  status?: string | null
  asaas_subscription_id?: string | null
}

type CadastroComissaoWithPrimeiraMensalidade = CadastroComissaoAsaasSource & {
  primeira_mensalidade_paga_em: string | null
}

function parseAsaasDate(value: string | null | undefined) {
  const raw = String(value || '').trim()
  if (!raw) return null

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null

  return parsed.toISOString()
}

function resolvePaymentEffectiveDate(payment: AsaasPaymentInfo) {
  return (
    parseAsaasDate(payment.paymentDate) ||
    parseAsaasDate(payment.clientPaymentDate) ||
    parseAsaasDate(payment.confirmedDate) ||
    parseAsaasDate(payment.dueDate)
  )
}

function sortPaymentsByDueDateAsc(payments: AsaasPaymentInfo[]) {
  return [...payments].sort((a, b) => {
    const dueA = parseAsaasDate(a.dueDate)
    const dueB = parseAsaasDate(b.dueDate)
    if (!dueA && !dueB) return 0
    if (!dueA) return 1
    if (!dueB) return -1
    return dueA.localeCompare(dueB)
  })
}

async function resolvePrimeiraMensalidadePagaEm(asaasSubscriptionId: string | null | undefined) {
  const subscriptionId = String(asaasSubscriptionId || '').trim()
  if (!subscriptionId) return null

  const pagamentosAssinatura = await listAsaasSubscriptionPayments(subscriptionId)
  if (!pagamentosAssinatura.length) return null

  const primeiraMensalidade = sortPaymentsByDueDateAsc(pagamentosAssinatura)[0]
  if (!primeiraMensalidade || !isAsaasPaidStatus(primeiraMensalidade.status)) {
    return null
  }

  return resolvePaymentEffectiveDate(primeiraMensalidade)
}

export async function hydrateCadastrosWithPrimeiraMensalidadePaga<
  T extends CadastroComissaoAsaasSource
>(cadastros: T[]): Promise<Array<T & CadastroComissaoWithPrimeiraMensalidade>> {
  const hydrated = await Promise.all(
    cadastros.map(async (cadastro) => {
      const status = String(cadastro.status || '').trim().toUpperCase()
      if (status !== 'ATIVO') {
        return {
          ...cadastro,
          primeira_mensalidade_paga_em: null,
        }
      }

      const primeiraMensalidadePagaEm = await resolvePrimeiraMensalidadePagaEm(
        cadastro.asaas_subscription_id
      )

      return {
        ...cadastro,
        primeira_mensalidade_paga_em: primeiraMensalidadePagaEm,
      }
    })
  )

  return hydrated
}
