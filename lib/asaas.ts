const DEFAULT_ASAAS_API_BASE_URL = 'https://api-sandbox.asaas.com/v3'
const CONNECTIVITY_ERROR_REGEX =
  /fetch failed|enotfound|getaddrinfo|network|ssl handshake|tls|cloudflare|timeout|econnreset|socket hang up/i

type AsaasErrorKind = 'configuration' | 'connectivity' | 'api' | 'invalid_response'
type AsaasBillingType = 'BOLETO' | 'CREDIT_CARD' | 'PIX'
type AsaasCycle =
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'BIMONTHLY'
  | 'QUARTERLY'
  | 'SEMIANNUALLY'
  | 'YEARLY'

type AsaasApiErrorItem = {
  code?: string
  description?: string
}

type AsaasApiErrorResponse = {
  errors?: AsaasApiErrorItem[]
  message?: string
}

type AsaasCustomerResponse = {
  id?: string
  name?: string
  cpfCnpj?: string
  email?: string
  phone?: string
  mobilePhone?: string
  address?: string
  addressNumber?: string
  complement?: string
  province?: string
  postalCode?: string
  externalReference?: string
}

type AsaasCreatePaymentResponse = {
  id?: string
  value?: number
  dueDate?: string
  billingType?: string
  status?: string
  invoiceUrl?: string
  bankSlipUrl?: string
  creditCardToken?: string
}

type AsaasPixQrCodeResponse = {
  encodedImage?: string
  payload?: string
  expirationDate?: string
}

type AsaasCreateSubscriptionResponse = {
  id?: string
  value?: number
  billingType?: string
  cycle?: string
  nextDueDate?: string
}

type AsaasSubscriptionResponse = {
  id?: string
  customer?: string
  status?: string
  billingType?: string
  value?: number
  nextDueDate?: string
  description?: string
  externalReference?: string
}

type AsaasPaymentResponse = {
  id?: string
  status?: string
  customer?: string
  externalReference?: string
  paymentDate?: string
  clientPaymentDate?: string
  confirmedDate?: string
  billingType?: string
  value?: number
  dueDate?: string
  description?: string
  invoiceUrl?: string
  bankSlipUrl?: string
  creditCardToken?: string
}

type AsaasListResponse<T> = {
  hasMore?: boolean
  limit?: number
  offset?: number
  data?: T[]
}

type AsaasSubscriptionPaymentListItem = {
  id?: string
}

export type CreateAsaasCustomerInput = {
  name: string
  cpfCnpj: string
  email?: string
  phone?: string
  mobilePhone?: string
  address?: string
  addressNumber?: string
  complement?: string
  province?: string
  postalCode?: string
  externalReference?: string
}

export type UpdateAsaasCustomerInput = {
  id: string
  name?: string
  cpfCnpj?: string
  email?: string
  phone?: string
  mobilePhone?: string
  address?: string
  addressNumber?: string
  complement?: string
  province?: string
  postalCode?: string
  externalReference?: string
}

export type CreateAsaasPixPaymentInput = {
  customer: string
  value: number
  dueDate: string
  description?: string
  externalReference?: string
}

export type CreateAsaasPaymentInput = {
  customer: string
  value: number
  dueDate: string
  billingType: AsaasBillingType
  description?: string
  externalReference?: string
}

export type CreateAsaasSubscriptionInput = {
  customer: string
  billingType: AsaasBillingType
  value: number
  nextDueDate: string
  cycle: AsaasCycle
  maxPayments?: number
  description?: string
  externalReference?: string
}

export type AsaasPixQrCode = {
  encodedImage: string
  payload: string
  expirationDate?: string
}

export type AsaasPaymentInfo = {
  id: string
  status?: string
  customer?: string
  externalReference?: string
  paymentDate?: string
  clientPaymentDate?: string
  confirmedDate?: string
  billingType?: string
  value?: number
  dueDate?: string
  description?: string
  invoiceUrl?: string
  bankSlipUrl?: string
  creditCardToken?: string
}

export type AsaasSubscriptionInfo = {
  id: string
  customer?: string
  status?: string
  billingType?: string
  value?: number
  nextDueDate?: string
  description?: string
  externalReference?: string
}

export type AsaasCustomerInfo = {
  id: string
  name?: string
  cpfCnpj?: string
  email?: string
  phone?: string
  mobilePhone?: string
  address?: string
  addressNumber?: string
  complement?: string
  province?: string
  postalCode?: string
  externalReference?: string
}

const PAID_STATUSES = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'])

export class AsaasIntegrationError extends Error {
  readonly status: number
  readonly kind: AsaasErrorKind

  constructor(message: string, kind: AsaasErrorKind, status: number) {
    super(message)
    this.name = 'AsaasIntegrationError'
    this.kind = kind
    this.status = status
  }
}

function getAsaasApiBaseUrl() {
  const configuredUrl = process.env.ASAAS_API_BASE_URL?.trim()
  const baseUrl = configuredUrl || DEFAULT_ASAAS_API_BASE_URL
  return baseUrl.replace(/\/$/, '')
}

function getAsaasApiKey() {
  const key = process.env.ASAAS_API_KEY?.trim()
  if (!key) {
    throw new AsaasIntegrationError(
      'IntegraÃ§Ã£o de pagamentos indisponÃ­vel. Configure ASAAS_API_KEY.',
      'configuration',
      503
    )
  }

  return key
}

function sanitizeDigits(value: string | undefined) {
  if (!value) return undefined
  const digits = value.replace(/\D/g, '')
  return digits || undefined
}

function compactPayload<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== '')
  )
}

function extractAsaasApiErrorMessage(payload: AsaasApiErrorResponse | null) {
  const firstError = payload?.errors?.[0]
  if (firstError?.description && firstError.description.trim()) {
    return firstError.description.trim()
  }

  if (payload?.message && payload.message.trim()) {
    return payload.message.trim()
  }

  return null
}

function isHtmlPayload(value: string) {
  return /<html|<!doctype/i.test(value)
}

function normalizeAsaasAmount(value: number, envName: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new AsaasIntegrationError(
      `Valor invalido para ${envName}.`,
      'configuration',
      503
    )
  }

  return Math.round((value + Number.EPSILON) * 100) / 100
}

function normalizeAsaasMaxPayments(value?: number) {
  if (value === undefined) return undefined

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new AsaasIntegrationError(
      'Quantidade maxima de cobranças invalida para a assinatura.',
      'configuration',
      500
    )
  }

  return parsed
}

function assertAsaasDate(value: string, fieldName: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AsaasIntegrationError(
      `Formato invalido para ${fieldName}. Use YYYY-MM-DD.`,
      'configuration',
      500
    )
  }
}

async function parseAsaasError(response: Response, fallbackMessage: string): Promise<never> {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const errorPayload = (await response.json().catch(() => null)) as AsaasApiErrorResponse | null
    const apiMessage = extractAsaasApiErrorMessage(errorPayload)
    throw new AsaasIntegrationError(apiMessage || fallbackMessage, 'api', response.status)
  }

  const rawBody = await response.text().catch(() => '')
  if (isHtmlPayload(rawBody)) {
    throw new AsaasIntegrationError(
      'Falha de comunicação com o Asaas. Tente novamente em alguns minutos.',
      'connectivity',
      503
    )
  }

  throw new AsaasIntegrationError(fallbackMessage, 'api', response.status)
}

async function parseAsaasJson<T>(response: Response, invalidMessage: string) {
  const payload = (await response.json().catch(() => null)) as T | null
  if (!payload) {
    throw new AsaasIntegrationError(invalidMessage, 'invalid_response', 502)
  }

  return payload
}

async function asaasRequest(path: string, init: RequestInit, fallbackErrorMessage: string) {
  const url = `${getAsaasApiBaseUrl()}/${path.replace(/^\/+/, '')}`
  const headers = new Headers(init.headers)
  headers.set('access_token', getAsaasApiKey())

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  try {
    const response = await fetch(url, {
      ...init,
      headers,
      cache: 'no-store',
    })

    if (!response.ok) {
      await parseAsaasError(response, fallbackErrorMessage)
    }

    return response
  } catch (error) {
    if (error instanceof AsaasIntegrationError) {
      throw error
    }

    const details = error instanceof Error ? error.message : String(error)
    if (CONNECTIVITY_ERROR_REGEX.test(details)) {
      throw new AsaasIntegrationError(
        'Falha de comunicação com o Asaas. Tente novamente em alguns minutos.',
        'connectivity',
        503
      )
    }

    console.error('Asaas request unexpected error:', error)
    throw new AsaasIntegrationError(
      'Erro inesperado ao integrar com o Asaas.',
      'api',
      500
    )
  }
}

function mapAsaasCustomer(
  customer: AsaasCustomerResponse,
  invalidMessage: string
): AsaasCustomerInfo {
  if (!customer.id) {
    throw new AsaasIntegrationError(invalidMessage, 'invalid_response', 502)
  }

  return {
    id: customer.id,
    name: customer.name,
    cpfCnpj: customer.cpfCnpj,
    email: customer.email,
    phone: customer.phone,
    mobilePhone: customer.mobilePhone,
    address: customer.address,
    addressNumber: customer.addressNumber,
    complement: customer.complement,
    province: customer.province,
    postalCode: customer.postalCode,
    externalReference: customer.externalReference,
  }
}

export function isAsaasPaidStatus(status?: string | null) {
  if (!status) return false
  return PAID_STATUSES.has(status.toUpperCase())
}

export async function createAsaasCustomer(
  input: CreateAsaasCustomerInput
): Promise<{ id: string }> {
  const payload = compactPayload({
    name: input.name.trim(),
    cpfCnpj: sanitizeDigits(input.cpfCnpj) || input.cpfCnpj.trim(),
    email: input.email?.trim(),
    phone: sanitizeDigits(input.phone),
    mobilePhone: sanitizeDigits(input.mobilePhone),
    address: input.address?.trim(),
    addressNumber: input.addressNumber?.trim(),
    complement: input.complement?.trim(),
    province: input.province?.trim(),
    postalCode: sanitizeDigits(input.postalCode),
    externalReference: input.externalReference?.trim(),
  })

  const response = await asaasRequest(
    'customers',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    'NÃ£o foi possÃ­vel criar o cliente no Asaas.'
  )

  const data = await parseAsaasJson<AsaasCustomerResponse>(
    response,
    'Asaas retornou uma resposta invÃ¡lida ao criar o cliente.'
  )

  const customer = mapAsaasCustomer(data, 'Asaas retornou uma resposta invÃ¡lida ao criar o cliente.')

  return { id: customer.id }
}

export async function updateAsaasCustomer(input: UpdateAsaasCustomerInput): Promise<AsaasCustomerInfo> {
  const customerId = String(input.id || '').trim()
  if (!customerId) {
    throw new AsaasIntegrationError(
      'Identificador do cliente no Asaas Ã© obrigatÃ³rio.',
      'configuration',
      500
    )
  }

  const payload = compactPayload({
    name: input.name?.trim(),
    cpfCnpj: sanitizeDigits(input.cpfCnpj),
    email: input.email?.trim(),
    phone: sanitizeDigits(input.phone),
    mobilePhone: sanitizeDigits(input.mobilePhone),
    address: input.address?.trim(),
    addressNumber: input.addressNumber?.trim(),
    complement: input.complement?.trim(),
    province: input.province?.trim(),
    postalCode: sanitizeDigits(input.postalCode),
    externalReference: input.externalReference?.trim(),
  })

  const response = await asaasRequest(
    `customers/${encodeURIComponent(customerId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
    'NÃo foi possivel atualizar o cliente no Asaas.'
  )

  const data = await parseAsaasJson<AsaasCustomerResponse>(
    response,
    'Asaas retornou uma resposta invalida ao atualizar o cliente.'
  )

  return mapAsaasCustomer(data, 'Asaas retornou uma resposta invÃ¡lida ao atualizar o cliente.')
}

type ListAsaasCustomersInput = {
  offset?: number
  limit?: number
  email?: string
  cpfCnpj?: string
  externalReference?: string
}

export async function listAsaasCustomers(input: ListAsaasCustomersInput = {}): Promise<{
  customers: AsaasCustomerInfo[]
  hasMore: boolean
  nextOffset: number
}> {
  const offset =
    typeof input.offset === 'number' && Number.isFinite(input.offset)
      ? Math.max(0, Math.trunc(input.offset))
      : 0
  const limitInput =
    typeof input.limit === 'number' && Number.isFinite(input.limit)
      ? Math.trunc(input.limit)
      : 100
  const limit = Math.min(100, Math.max(1, limitInput))

  const params = new URLSearchParams()
  params.set('offset', String(offset))
  params.set('limit', String(limit))

  if (input.email?.trim()) {
    params.set('email', input.email.trim())
  }

  if (input.cpfCnpj?.trim()) {
    params.set('cpfCnpj', sanitizeDigits(input.cpfCnpj) || input.cpfCnpj.trim())
  }

  if (input.externalReference?.trim()) {
    params.set('externalReference', input.externalReference.trim())
  }

  const response = await asaasRequest(
    `customers?${params.toString()}`,
    { method: 'GET' },
    'NÃ£o foi possÃ­vel listar os clientes no Asaas.'
  )

  const data = await parseAsaasJson<AsaasListResponse<AsaasCustomerResponse>>(
    response,
    'Asaas retornou uma resposta invÃ¡lida ao listar clientes.'
  )

  const customers = Array.isArray(data.data)
    ? data.data
        .filter((customer) => customer.id)
        .map((customer) =>
          mapAsaasCustomer(customer, 'Asaas retornou um cliente invalido na listagem.')
        )
    : []

  const hasMore = Boolean(data.hasMore)
  const nextOffset = offset + customers.length

  return {
    customers,
    hasMore,
    nextOffset,
  }
}

export async function listAllAsaasCustomers(): Promise<AsaasCustomerInfo[]> {
  const allCustomers: AsaasCustomerInfo[] = []
  let offset = 0
  const limit = 100

  while (true) {
    const page = await listAsaasCustomers({ offset, limit })
    allCustomers.push(...page.customers)

    if (!page.hasMore || page.customers.length === 0) {
      break
    }

    offset = page.nextOffset
  }

  return allCustomers
}

export async function createAsaasPixPayment(
  input: CreateAsaasPixPaymentInput
): Promise<{ id: string; value?: number; dueDate?: string; status?: string }> {
  const result = await createAsaasPayment({
    customer: input.customer,
    value: input.value,
    dueDate: input.dueDate,
    billingType: 'PIX',
    description: input.description,
    externalReference: input.externalReference,
  })

  return {
    id: result.id,
    value: result.value,
    dueDate: result.dueDate,
    status: result.status,
  }
}

export async function createAsaasPayment(
  input: CreateAsaasPaymentInput
): Promise<{
  id: string
  value?: number
  dueDate?: string
  status?: string
  billingType?: string
  invoiceUrl?: string
  bankSlipUrl?: string
  creditCardToken?: string
}> {
  assertAsaasDate(input.dueDate, 'dueDate')
  const value = normalizeAsaasAmount(input.value, 'valor da adesão')

  const payload = compactPayload({
    customer: input.customer.trim(),
    billingType: input.billingType,
    value,
    dueDate: input.dueDate,
    description: input.description?.trim(),
    externalReference: input.externalReference?.trim(),
  })

  const response = await asaasRequest(
    'payments',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    'Não foi possivel criar a cobranças de adesão no Asaas.'
  )

  const data = await parseAsaasJson<AsaasCreatePaymentResponse>(
    response,
    'Asaas retornou uma resposta invalida ao criar a cobranças.'
  )

  if (!data.id) {
    throw new AsaasIntegrationError(
      'Asaas retornou uma resposta invalida ao criar a cobranças.',
      'invalid_response',
      502
    )
  }

  return {
    id: data.id,
    value: data.value,
    dueDate: data.dueDate,
    status: data.status,
    billingType: data.billingType,
    invoiceUrl: data.invoiceUrl,
    bankSlipUrl: data.bankSlipUrl,
    creditCardToken: data.creditCardToken,
  }
}

export async function cancelAsaasPayment(paymentId: string): Promise<void> {
  const normalizedPaymentId = String(paymentId || '').trim()
  if (!normalizedPaymentId) {
    throw new AsaasIntegrationError(
      'Identificador da cobranças no Asaas Ã© obrigatÃ³rio.',
      'configuration',
      500
    )
  }

  await asaasRequest(
    `payments/${encodeURIComponent(normalizedPaymentId)}`,
    { method: 'DELETE' },
    'NÃ£o foi possÃ­vel cancelar a cobranÃ§a no Asaas.'
  )
}

export async function getAsaasPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  const response = await asaasRequest(
    `payments/${paymentId}/pixQrCode`,
    { method: 'GET' },
    'NÃ£o foi possÃ­vel obter o QR Code PIX no Asaas.'
  )

  const data = await parseAsaasJson<AsaasPixQrCodeResponse>(
    response,
    'Asaas retornou uma resposta invÃ¡lida ao obter o QR Code PIX.'
  )

  if (!data.encodedImage || !data.payload) {
    throw new AsaasIntegrationError(
      'Asaas retornou uma resposta invÃ¡lida ao obter o QR Code PIX.',
      'invalid_response',
      502
    )
  }

  return {
    encodedImage: data.encodedImage,
    payload: data.payload,
    expirationDate: data.expirationDate,
  }
}

export async function getAsaasPayment(paymentId: string): Promise<AsaasPaymentInfo> {
  const response = await asaasRequest(
    `payments/${paymentId}`,
    { method: 'GET' },
    'NÃ£o foi possÃ­vel consultar o pagamento no Asaas.'
  )

  const data = await parseAsaasJson<AsaasPaymentResponse>(
    response,
    'Asaas retornou uma resposta invÃ¡lida ao consultar o pagamento.'
  )

  if (!data.id) {
    throw new AsaasIntegrationError(
      'Asaas retornou uma resposta invÃ¡lida ao consultar o pagamento.',
      'invalid_response',
      502
    )
  }

  return {
    id: data.id,
    status: data.status,
    customer: data.customer,
    externalReference: data.externalReference,
    paymentDate: data.paymentDate,
    clientPaymentDate: data.clientPaymentDate,
    confirmedDate: data.confirmedDate,
    billingType: data.billingType,
    value: data.value,
    invoiceUrl: data.invoiceUrl,
    bankSlipUrl: data.bankSlipUrl,
    creditCardToken: data.creditCardToken,
  }
}

export async function getAsaasSubscription(subscriptionId: string): Promise<AsaasSubscriptionInfo> {
  const response = await asaasRequest(
    `subscriptions/${subscriptionId}`,
    { method: 'GET' },
    'NÃ£o foi possÃ­vel consultar a assinatura no Asaas.'
  )

  const data = await parseAsaasJson<AsaasSubscriptionResponse>(
    response,
    'Asaas retornou uma resposta invÃ¡lida ao consultar a assinatura.'
  )

  if (!data.id) {
    throw new AsaasIntegrationError(
      'Asaas retornou uma resposta invÃ¡lida ao consultar a assinatura.',
      'invalid_response',
      502
    )
  }

  return {
    id: data.id,
    customer: data.customer,
    status: data.status,
    billingType: data.billingType,
    value: data.value,
    nextDueDate: data.nextDueDate,
    description: data.description,
    externalReference: data.externalReference,
  }
}

export async function listAsaasPayments(customerId: string): Promise<AsaasPaymentInfo[]> {
  const response = await asaasRequest(
    `payments?customer=${customerId}&limit=100`,
    { method: 'GET' },
    'NÃ£o foi possÃ­vel listar os pagamentos no Asaas.'
  )

  const data = await parseAsaasJson<{ data?: AsaasPaymentResponse[] }>(
    response,
    'Asaas retornou uma resposta invÃ¡lida ao listar pagamentos.'
  )

  if (!Array.isArray(data.data)) {
    return []
  }

  return data.data
    .filter((p) => p.id)
    .map((p) => ({
      id: p.id!,
      status: p.status,
      customer: p.customer,
      externalReference: p.externalReference,
      paymentDate: p.paymentDate,
      clientPaymentDate: p.clientPaymentDate,
      confirmedDate: p.confirmedDate,
      billingType: p.billingType,
      value: p.value,
      dueDate: p.dueDate,
      description: p.description,
      invoiceUrl: p.invoiceUrl,
      bankSlipUrl: p.bankSlipUrl,
      creditCardToken: p.creditCardToken,
    }))
}

export async function listAsaasSubscriptionPayments(subscriptionId: string): Promise<AsaasPaymentInfo[]> {
  const response = await asaasRequest(
    `subscriptions/${subscriptionId}/payments?limit=100`,
    { method: 'GET' },
    'NÃ£o foi possÃ­vel listar os pagamentos da assinatura no Asaas.'
  )

  const data = await parseAsaasJson<{ data?: AsaasPaymentResponse[] }>(
    response,
    'Asaas retornou uma resposta invÃ¡lida ao listar pagamentos da assinatura.'
  )

  if (!Array.isArray(data.data)) {
    return []
  }

  return data.data
    .filter((p) => p.id)
    .map((p) => ({
      id: p.id!,
      status: p.status,
      customer: p.customer,
      externalReference: p.externalReference,
      paymentDate: p.paymentDate,
      clientPaymentDate: p.clientPaymentDate,
      confirmedDate: p.confirmedDate,
      billingType: p.billingType,
      value: p.value,
      dueDate: p.dueDate,
      description: p.description,
      invoiceUrl: p.invoiceUrl,
      bankSlipUrl: p.bankSlipUrl,
      creditCardToken: p.creditCardToken,
    }))
}

type ListAsaasSubscriptionsInput = {
  customer?: string
  externalReference?: string
  status?: 'ACTIVE' | 'INACTIVE' | 'EXPIRED'
  limit?: number
}

export async function listAsaasSubscriptions(
  input: ListAsaasSubscriptionsInput = {}
): Promise<AsaasSubscriptionInfo[]> {
  const params = new URLSearchParams()
  const limitInput =
    typeof input.limit === 'number' && Number.isFinite(input.limit)
      ? Math.trunc(input.limit)
      : 100
  params.set('limit', String(Math.min(100, Math.max(1, limitInput))))

  if (input.customer?.trim()) {
    params.set('customer', input.customer.trim())
  }

  if (input.externalReference?.trim()) {
    params.set('externalReference', input.externalReference.trim())
  }

  if (input.status) {
    params.set('status', input.status)
  }

  const response = await asaasRequest(
    `subscriptions?${params.toString()}`,
    { method: 'GET' },
    'NÃ£o foi possÃ­vel listar as assinaturas no Asaas.'
  )

  const data = await parseAsaasJson<AsaasListResponse<AsaasSubscriptionResponse>>(
    response,
    'Asaas retornou uma resposta invÃ¡lida ao listar assinaturas.'
  )

  if (!Array.isArray(data.data)) {
    return []
  }

  return data.data
    .filter((subscription) => subscription.id)
    .map((subscription) => ({
      id: subscription.id!,
      customer: subscription.customer,
      status: subscription.status,
      billingType: subscription.billingType,
      value: subscription.value,
      nextDueDate: subscription.nextDueDate,
      description: subscription.description,
      externalReference: subscription.externalReference,
    }))
}

export async function createAsaasSubscription(
  input: CreateAsaasSubscriptionInput
): Promise<{ id: string; nextDueDate?: string }> {
  assertAsaasDate(input.nextDueDate, 'nextDueDate')
  const value = normalizeAsaasAmount(input.value, 'valor da mensalidade')
  const maxPayments = normalizeAsaasMaxPayments(input.maxPayments)

  const payload = compactPayload({
    customer: input.customer.trim(),
    billingType: input.billingType,
    value,
    nextDueDate: input.nextDueDate,
    cycle: input.cycle,
    maxPayments,
    description: input.description?.trim(),
    externalReference: input.externalReference?.trim(),
  })

  const response = await asaasRequest(
    'subscriptions',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    'NÃ£o foi possÃ­vel criar a assinatura recorrente no Asaas.'
  )

  const data = await parseAsaasJson<AsaasCreateSubscriptionResponse>(
    response,
    'Asaas retornou uma resposta invÃ¡lida ao criar a assinatura.'
  )

  if (!data.id) {
    throw new AsaasIntegrationError(
      'Asaas retornou uma resposta invÃ¡lida ao criar a assinatura.',
      'invalid_response',
      502
    )
  }

  return {
    id: data.id,
    nextDueDate: data.nextDueDate,
  }
}

export async function cancelAsaasSubscription(subscriptionId: string): Promise<void> {
  const normalizedSubscriptionId = String(subscriptionId || '').trim()
  if (!normalizedSubscriptionId) {
    throw new AsaasIntegrationError(
      'Identificador da assinatura no Asaas Ã© obrigatÃ³rio.',
      'configuration',
      500
    )
  }

  await asaasRequest(
    `subscriptions/${encodeURIComponent(normalizedSubscriptionId)}`,
    { method: 'DELETE' },
    'NÃ£o foi possÃ­vel cancelar a assinatura no Asaas.'
  )
}

export async function updateAsaasSubscriptionValue(
  subscriptionId: string,
  newValue: number
): Promise<void> {
  const normalizedSubscriptionId = String(subscriptionId || '').trim()
  if (!normalizedSubscriptionId) {
    throw new AsaasIntegrationError(
      'Identificador da assinatura no Asaas Ã© obrigatÃ³rio.',
      'configuration',
      500
    )
  }

  const value = normalizeAsaasAmount(newValue, 'valor da mensalidade')

  const payload = { value }

  await asaasRequest(
    `subscriptions/${encodeURIComponent(normalizedSubscriptionId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
    'NÃ£o foi possÃ­vel atualizar o valor da assinatura no Asaas.'
  )
}

export async function deleteAsaasCustomer(customerId: string): Promise<void> {
  const normalizedCustomerId = String(customerId || '').trim()
  if (!normalizedCustomerId) {
    throw new AsaasIntegrationError(
      'Identificador do cliente no Asaas Ã© obrigatÃ³rio.',
      'configuration',
      500
    )
  }

  await asaasRequest(
    `customers/${encodeURIComponent(normalizedCustomerId)}`,
    { method: 'DELETE' },
    'NÃ£o foi possÃ­vel remover o cliente no Asaas.'
  )
}

export async function hasAsaasOverdueSubscriptionPayment(subscriptionId: string): Promise<boolean> {
  const normalizedSubscriptionId = String(subscriptionId || '').trim()
  if (!normalizedSubscriptionId) {
    throw new AsaasIntegrationError(
      'Identificador da assinatura no Asaas Ã© obrigatÃ³rio.',
      'configuration',
      500
    )
  }

  const response = await asaasRequest(
    `subscriptions/${encodeURIComponent(normalizedSubscriptionId)}/payments?status=OVERDUE&limit=1`,
    { method: 'GET' },
    'NÃ£o foi possÃ­vel consultar as cobranÃ§as da assinatura no Asaas.'
  )

  const data = await parseAsaasJson<AsaasListResponse<AsaasSubscriptionPaymentListItem>>(
    response,
    'Asaas retornou uma resposta invÃ¡lida ao consultar cobranÃ§as da assinatura.'
  )

  if (!Array.isArray(data.data)) {
    throw new AsaasIntegrationError(
      'Asaas retornou uma resposta invÃ¡lida ao consultar cobranÃ§as da assinatura.',
      'invalid_response',
      502
    )
  }

  return data.data.length > 0
}
