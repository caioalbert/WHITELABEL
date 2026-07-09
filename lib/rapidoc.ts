/**
 * Integração com a API TEMA da Rapidoc Telemedicina.
 *
 * Documentação: https://documenter.getpostman.com/view/17451655/U16onhqm
 * Sandbox:      https://sandbox.rapidoc.tech/tema/api
 * Produção:     https://api.rapidoc.tech/tema/api
 *
 * Autenticação:
 *   - Header "Authorization: Bearer <JWT>"  → token JWT do cliente (SHALOM SAÚDE)
 *   - Header "clientId: <UUID>"              → UUID do cliente no Rapidoc
 *
 * Fluxo de acesso do beneficiário:
 *   1. Valida se o CPF está cadastrado na Rapidoc → GET /api/beneficiaries/{cpf}
 *   2. Se encontrado, obtém UUID e chama GET /api/beneficiaries/{uuid}/request-appointment
 *   3. API retorna { url } que o paciente abre no browser
 *
 *   OU — se RAPIDOC_ACCESS_URL estiver configurada — usa template direto.
 */

const RAPIDOC_API_BASE = (() => {
  const env =
    process.env.RAPIDOC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_RAPIDOC_API_BASE_URL
  return (env || 'https://sandbox.rapidoc.tech/tema').replace(/\/$/, '')
})()

const RAPIDOC_API_URL = `${RAPIDOC_API_BASE}/api`
const RAPIDOC_JWT      = process.env.RAPIDOC_JWT_TOKEN || ''
const RAPIDOC_CLIENT_ID = process.env.RAPIDOC_CLIENT_ID || ''

export type RapidocCliente = {
  id: string
  nome: string
  email?: string | null
  cpf?: string | null
  telefone?: string | null
  data_nascimento?: string | null
}

/** Resultado tipado de uma chamada à API Rapidoc */
type RapidocResult<T> =
  | { ok: true;  data: T }
  | { ok: false; reason: 'auth' | 'not_found' | 'api_error' | 'no_config'; message: string }

function sanitizeDigits(value?: string | null) {
  return String(value || '').replace(/\D/g, '')
}

function normalizeUrl(value?: string | null) {
  const url = String(value || '').trim()
  if (!url) return null
  try { return new URL(url).toString() } catch { return null }
}

function getRapidocAccessTemplate() {
  return String(process.env.RAPIDOC_ACCESS_URL || '').trim()
}

function applyRapidocTemplate(template: string, cliente: RapidocCliente) {
  const values: Record<string, string> = {
    id:              cliente.id,
    nome:            cliente.nome || '',
    email:           cliente.email || '',
    cpf:             cliente.cpf || '',
    cpf_digits:      sanitizeDigits(cliente.cpf),
    telefone:        cliente.telefone || '',
    telefone_digits: sanitizeDigits(cliente.telefone),
    data_nascimento: cliente.data_nascimento || '',
    clientId:        RAPIDOC_CLIENT_ID,
  }
  return Object.entries(values).reduce(
    (url, [key, value]) => url.replaceAll(`{${key}}`, encodeURIComponent(value)),
    template
  )
}

export function isRapidocAccessConfigured(): boolean {
  return Boolean(getRapidocAccessTemplate()) || Boolean(RAPIDOC_JWT && RAPIDOC_CLIENT_ID)
}

/** Headers padrão de autenticação para todas as chamadas à API Rapidoc */
function rapidocHeaders(): HeadersInit {
  return {
    'Authorization': `Bearer ${RAPIDOC_JWT}`,
    'clientId':       RAPIDOC_CLIENT_ID,
    'Content-Type':   'application/vnd.rapidoc.tema-v2+json',
    'Accept':         'application/json',
  }
}

/**
 * Valida se o CPF do beneficiário existe na base da Rapidoc.
 * Retorna o UUID se encontrado, ou um erro tipado com mensagem amigável.
 */
export async function checkRapidocBeneficiary(
  cpf: string
): Promise<RapidocResult<{ uuid: string; nome?: string }>> {
  if (!RAPIDOC_JWT || !RAPIDOC_CLIENT_ID) {
    return {
      ok:      false,
      reason:  'no_config',
      message: 'Credenciais da Rapidoc não configuradas no servidor.',
    }
  }

  const cpfDigits = sanitizeDigits(cpf)
  if (cpfDigits.length !== 11) {
    return { ok: false, reason: 'api_error', message: 'CPF inválido.' }
  }

  try {
    const res = await fetch(`${RAPIDOC_API_URL}/beneficiaries/${cpfDigits}`, {
      headers: rapidocHeaders(),
    })

    const data = await res.json().catch(() => ({}))

    if (res.status === 401 || res.status === 403 || (data?.success === false && data?.message?.includes('token'))) {
      console.error('[Rapidoc] Erro de autenticação:', { status: res.status, message: data?.message })
      return {
        ok:      false,
        reason:  'auth',
        message: 'Token de acesso à Rapidoc inválido ou expirado. Contate o suporte SHALOM.',
      }
    }

    if (res.status === 404 || (data?.success === false && !data?.message?.includes('token'))) {
      return {
        ok:      false,
        reason:  'not_found',
        message: 'Seu CPF não está cadastrado na base da Rapidoc. Contate o suporte SHALOM para regularização.',
      }
    }

    if (!res.ok) {
      return {
        ok:      false,
        reason:  'api_error',
        message: `Erro na API Rapidoc (HTTP ${res.status}). Tente novamente em instantes.`,
      }
    }

    // A API retorna { success: true, beneficiary: { uuid: "..." } }
    // ou variações: { uuid }, { data: { uuid } }, { beneficiario: { uuid } }
    const uuid: string | null =
      data?.uuid ||
      data?.data?.uuid ||
      data?.beneficiario?.uuid ||
      data?.beneficiary?.uuid ||
      null

    if (!uuid) {
      return {
        ok:      false,
        reason:  'api_error',
        message: 'A Rapidoc não retornou o identificador do beneficiário.',
      }
    }

    return { ok: true, data: { uuid, nome: data?.nome || data?.data?.nome } }
  } catch {
    return {
      ok:      false,
      reason:  'api_error',
      message: 'Não foi possível conectar à Rapidoc. Verifique a conexão e tente novamente.',
    }
  }
}

/**
 * Obtém a URL de acesso do beneficiário via API TEMA (request-appointment).
 */
async function getRequestAppointmentUrl(
  beneficiaryUuid: string
): Promise<RapidocResult<{ url: string }>> {
  try {
    const res = await fetch(
      `${RAPIDOC_API_URL}/beneficiaries/${beneficiaryUuid}/request-appointment`,
      { headers: rapidocHeaders() }
    )

    const data = await res.json().catch(() => ({}))

    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: 'auth', message: 'Token Rapidoc inválido ao gerar link de acesso.' }
    }

    if (!res.ok || data?.success === false) {
      return {
        ok:      false,
        reason:  'api_error',
        message: data?.message || `Erro ao gerar link de atendimento (HTTP ${res.status}).`,
      }
    }

    const rawUrl = data?.url || data?.urlPath || data?.data?.url || null
    const url    = normalizeUrl(rawUrl)

    if (!url) {
      return { ok: false, reason: 'api_error', message: 'A Rapidoc não retornou uma URL de atendimento válida.' }
    }

    return { ok: true, data: { url } }
  } catch {
    return { ok: false, reason: 'api_error', message: 'Erro de conexão ao gerar link de atendimento.' }
  }
}

/**
 * Resolve a URL de acesso à telemedicina Rapidoc para o cliente.
 *
 * Prioridade:
 *  1. Template RAPIDOC_ACCESS_URL configurado manualmente (direto, sem chamada API)
 *  2. API TEMA: valida CPF → obtém UUID → request-appointment → URL do paciente
 */
export async function resolveRapidocUrl(
  cliente: RapidocCliente
): Promise<RapidocResult<{ url: string }>> {
  // 1. Template configurado manualmente
  const template = getRapidocAccessTemplate()
  if (template) {
    const url = normalizeUrl(applyRapidocTemplate(template, cliente))
    if (url) return { ok: true, data: { url } }
  }

  // 2. API TEMA
  if (!RAPIDOC_JWT || !RAPIDOC_CLIENT_ID) {
    return {
      ok:      false,
      reason:  'no_config',
      message: 'Integração com telemedicina não configurada. Contate o suporte SHALOM.',
    }
  }

  if (!cliente.cpf) {
    return { ok: false, reason: 'api_error', message: 'CPF do cliente não disponível.' }
  }

  // 2a. Verificar se o CPF existe na Rapidoc
  const beneficiaryResult = await checkRapidocBeneficiary(cliente.cpf)

  if (!beneficiaryResult.ok) {
    return beneficiaryResult
  }

  // 2b. Gerar URL de acesso (request-appointment)
  const appointmentResult = await getRequestAppointmentUrl(beneficiaryResult.data.uuid)
  return appointmentResult
}

export type RapidocBeneficiaryPayload = {
  name: string
  cpf: string
  birthday: string // yyyy-MM-dd
  phone?: string
  email?: string
  zipCode?: string
  address?: string
  city?: string
  state?: string
  paymentType?: 'S' | 'A' // S = recorrente, A = consulta (default S)
  serviceType?: 'G' | 'P' | 'GP' | 'GS' | 'GSP'
  holder?: string // CPF do titular (opcional)
  general?: string
}

/**
 * Cadastra (importa) uma lista de beneficiários (titulares e/ou dependentes) na base da Rapidoc.
 * A API espera um Content-Type específico e um array JSON.
 */
export async function addBeneficiariesToRapidoc(
  beneficiaries: RapidocBeneficiaryPayload[]
): Promise<RapidocResult<any>> {
  if (!RAPIDOC_JWT || !RAPIDOC_CLIENT_ID) {
    return {
      ok: false,
      reason: 'no_config',
      message: 'Credenciais da Rapidoc não configuradas.',
    }
  }

  if (!beneficiaries || beneficiaries.length === 0) {
    return { ok: false, reason: 'api_error', message: 'Nenhum beneficiário informado para cadastro.' }
  }

  try {
    const res = await fetch(`${RAPIDOC_API_URL}/beneficiaries`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RAPIDOC_JWT}`,
        'clientId': RAPIDOC_CLIENT_ID,
        'Content-Type': 'application/vnd.rapidoc.tema-v2+json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(beneficiaries),
    })

    const textResponse = await res.text()
    let data
    try {
      data = textResponse ? JSON.parse(textResponse) : {}
    } catch {
      data = { raw: textResponse }
    }

    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: 'auth', message: 'Token de acesso à Rapidoc inválido ao tentar cadastrar.' }
    }

    // Retornos 200, 201 e 202 normalmente indicam sucesso na importação.
    if (!res.ok) {
      console.error('[Rapidoc API] Erro ao cadastrar beneficiário:', res.status, data)
      return {
        ok: false,
        reason: 'api_error',
        message: data?.message || `Erro ao cadastrar na Rapidoc (HTTP ${res.status}).`,
      }
    }

    return { ok: true, data }
  } catch (err) {
    console.error('[Rapidoc API] Erro de rede ao cadastrar:', err)
    return {
      ok: false,
      reason: 'api_error',
      message: 'Não foi possível conectar à Rapidoc para efetuar o cadastro.',
    }
  }
}

/** @deprecated Usar resolveRapidocUrl — mantido para compatibilidade */
export const RAPIDOC_FALLBACK_URL =
  normalizeUrl(
    process.env.RAPIDOC_FALLBACK_URL ||
      process.env.NEXT_PUBLIC_RAPIDOC_FALLBACK_URL
  ) || 'https://api.rapidoc.tech/tema'
