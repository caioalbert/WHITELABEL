import { createAdminClient } from './supabase/admin'
import { RapidocBeneficiaryPayload, addBeneficiariesToRapidoc } from './rapidoc'

function sanitizeDigits(value?: string | null) {
  return String(value || '').replace(/\D/g, '')
}

function formatDate(date: string | Date | null) {
  if (!date) return '2000-01-01' // Fallback obrigatório
  try {
    const d = new Date(date)
    return d.toISOString().split('T')[0]
  } catch {
    return '2000-01-01'
  }
}

/**
 * Busca um cadastro completo (com dependentes) do Supabase e envia para a Rapidoc.
 */
export async function syncCadastroToRapidoc(cadastroId: string) {
  const supabase = createAdminClient()

  // 1. Buscar Cadastro
  const { data: cadastro, error: cadastroError } = await supabase
    .from('cadastros')
    .select('*')
    .eq('id', cadastroId)
    .single()

  if (cadastroError || !cadastro) {
    console.error('[Sync Rapidoc] Erro ao buscar cadastro:', cadastroError)
    return { success: false, error: 'Cadastro não encontrado' }
  }

  // Se não estiver ATIVO, não sincroniza
  if (cadastro.status !== 'ATIVO') {
    return { success: false, error: 'Cadastro não está ATIVO' }
  }

  const titularCpf = sanitizeDigits(cadastro.cpf)
  if (titularCpf.length !== 11) {
    return { success: false, error: 'CPF do titular inválido' }
  }

  const payload: RapidocBeneficiaryPayload[] = []

  // Prepara Titular
  payload.push({
    name: cadastro.nome,
    cpf: titularCpf,
    birthday: formatDate(cadastro.data_nascimento),
    phone: sanitizeDigits(cadastro.telefone) || '00000000000',
    email: cadastro.email || 'naoinformado@shalomsaude.com.br',
    zipCode: sanitizeDigits(cadastro.cep) || '00000000',
    address: cadastro.endereco || 'Não informado',
    city: cadastro.cidade || 'Não informado',
    state: cadastro.estado || 'NI',
    paymentType: 'S',
    serviceType: 'GP', // Premium + Psicologia, conforme solicitado
  })

  // 2. Buscar Dependentes
  const { data: dependentes } = await supabase
    .from('dependentes')
    .select('*')
    .eq('cadastro_id', cadastroId)

  if (dependentes && dependentes.length > 0) {
    for (const dep of dependentes) {
      const depCpf = sanitizeDigits(dep.cpf)
      if (depCpf.length === 11) {
        payload.push({
          name: dep.nome,
          cpf: depCpf,
          birthday: formatDate(dep.data_nascimento),
          phone: sanitizeDigits(dep.telefone_celular) || sanitizeDigits(cadastro.telefone) || '00000000000',
          email: dep.email || cadastro.email || 'naoinformado@shalomsaude.com.br',
          zipCode: sanitizeDigits(cadastro.cep) || '00000000',
          address: cadastro.endereco || 'Não informado',
          city: cadastro.cidade || 'Não informado',
          state: cadastro.estado || 'NI',
          paymentType: 'S',
          serviceType: 'GP',
          holder: titularCpf, // Vincula ao titular
        })
      } else {
        console.warn(`[Sync Rapidoc] Dependente ${dep.nome} (id: ${dep.id}) sem CPF válido, não exportado.`)
      }
    }
  }

  // 3. Enviar para a Rapidoc
  const result = await addBeneficiariesToRapidoc(payload)

  if (!result.ok) {
    console.error(`[Sync Rapidoc] Falha ao exportar ${cadastro.nome}:`, result.message)
    return { success: false, error: result.message }
  }

  console.log(`[Sync Rapidoc] Sucesso ao exportar ${cadastro.nome} e ${dependentes?.length || 0} dependentes.`)
  return { success: true, count: payload.length }
}
