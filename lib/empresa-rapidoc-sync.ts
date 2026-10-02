import { createAdminClient } from './supabase/admin'
import { checkRapidocBeneficiary, addBeneficiariesToRapidoc, type RapidocBeneficiaryPayload } from './rapidoc'
import { getRapidocSyncServiceType } from './rapidoc-config'

function sanitizeDigits(value?: string | null) {
  return String(value || '').replace(/\D/g, '')
}

function formatDate(value?: string | null) {
  if (!value) return '2000-01-01'
  try {
    return new Date(value).toISOString().split('T')[0]
  } catch {
    return '2000-01-01'
  }
}

export type EmpresaRapidocSyncResult = {
  empresaId: string
  total: number
  synced: number
  skipped: number
  errors: string[]
}

/**
 * Busca os funcionários de uma empresa, verifica quais ainda não estão na Rapidoc
 * e cadastra apenas os ausentes.
 *
 * Usado ao conceder acesso excepcional para que os funcionários possam acessar
 * a telemedicina imediatamente.
 */
export async function syncEmpresaFuncionariosToRapidoc(
  empresaId: string,
): Promise<EmpresaRapidocSyncResult> {
  const db = createAdminClient()
  const serviceType = getRapidocSyncServiceType()
  const result: EmpresaRapidocSyncResult = {
    empresaId,
    total: 0,
    synced: 0,
    skipped: 0,
    errors: [],
  }

  // 1. Buscar funcionários da empresa
  const { data: funcionarios, error } = await db
    .from('funcionarios')
    .select('id, nome, cpf, email, telefone, data_nascimento')
    .eq('empresa_id', empresaId)

  if (error) {
    console.error('[empresa-rapidoc-sync] Erro ao buscar funcionários:', error)
    result.errors.push(`Erro ao buscar funcionários: ${error.message}`)
    return result
  }

  if (!funcionarios || funcionarios.length === 0) {
    console.log(`[empresa-rapidoc-sync] Empresa ${empresaId} sem funcionários cadastrados.`)
    return result
  }

  result.total = funcionarios.length

  // 2. Separar quem já existe na Rapidoc de quem precisa ser adicionado
  const toAdd: RapidocBeneficiaryPayload[] = []

  for (const func of funcionarios) {
    const cpf = sanitizeDigits(func.cpf)
    if (cpf.length !== 11) {
      result.errors.push(`CPF inválido para ${func.nome} (id: ${func.id}), ignorado.`)
      continue
    }

    const check = await checkRapidocBeneficiary(cpf)

    if (check.ok) {
      // Já existe na Rapidoc
      result.skipped++
      continue
    }

    if (check.reason === 'no_config') {
      // Rapidoc não está configurada — não há o que fazer
      result.errors.push('Rapidoc não está configurada no servidor.')
      break
    }

    if (check.reason === 'auth') {
      result.errors.push('Falha de autenticação com a Rapidoc — verifique as credenciais.')
      break
    }

    // reason === 'not_found' → precisa adicionar
    toAdd.push({
      name: func.nome,
      cpf,
      birthday: formatDate(func.data_nascimento),
      phone: sanitizeDigits(func.telefone) || '00000000000',
      email: func.email || 'naoinformado@novaaliancasaude.com.br',
      paymentType: 'S',
      serviceType,
    })
  }

  if (toAdd.length === 0) {
    console.log(
      `[empresa-rapidoc-sync] Todos os funcionários da empresa ${empresaId} já existem na Rapidoc (${result.skipped} ignorados).`,
    )
    return result
  }

  // 3. Cadastrar os ausentes em lote
  const addResult = await addBeneficiariesToRapidoc(toAdd)

  if (!addResult.ok) {
    console.error('[empresa-rapidoc-sync] Erro ao cadastrar na Rapidoc:', addResult.message)
    result.errors.push(`Erro ao cadastrar na Rapidoc: ${addResult.message}`)
    return result
  }

  result.synced = toAdd.length
  console.log(
    `[empresa-rapidoc-sync] Empresa ${empresaId}: ${result.synced} funcionário(s) adicionado(s) à Rapidoc, ${result.skipped} já existiam.`,
  )

  return result
}

/**
 * Remove os funcionários de uma empresa da base da Rapidoc.
 *
 * Nota: a API TEMA da Rapidoc (v2) não expõe endpoint de exclusão de beneficiários
 * no escopo atual da integração. Caso seja disponibilizado, implementar aqui.
 * Por ora a função loga a intenção e retorna para que o cron prossiga normalmente.
 */
export async function removeEmpresaFuncionariosFromRapidoc(
  empresaId: string,
): Promise<{ empresaId: string; removed: number; errors: string[] }> {
  console.warn(
    `[empresa-rapidoc-sync] removeEmpresaFuncionariosFromRapidoc chamado para empresa ${empresaId}.` +
      ' A API TEMA da Rapidoc (v2) não disponibiliza endpoint de exclusão de beneficiário.' +
      ' Quando o endpoint for liberado, implementar aqui.',
  )

  return { empresaId, removed: 0, errors: [] }
}
