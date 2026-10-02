/**
 * Provisionamento de cadastros para funcionários de empresa.
 *
 * Lógica extraída do webhook Asaas para ser reutilizada em outros fluxos,
 * como a concessão de acesso excepcional.
 *
 * Comportamento:
 *  - Para cada funcionário da empresa, verifica se já existe um `cadastro`
 *    vinculado (por `cadastro_id` ou por CPF + `empresa_id`).
 *  - Se não existir, cria um novo cadastro com status `PENDENTE_PAGAMENTO`,
 *    herdando os dados de endereço da empresa.
 *  - Vincula o funcionário ao cadastro criado/encontrado via `cadastro_id`.
 *  - Se `activate = true`, atualiza o status dos cadastros para `ATIVO`.
 *  - Retorna os IDs dos cadastros provisionados.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { EMPRESA_STATUSES } from './empresa-flow'

export type EmpresaProvisionRecord = {
  id: string
  tipo_plano: string
  mensalidade_billing_type: string | null
  endereco: string | null
  numero: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
}

export type EmpresaProvisionResult = {
  cadastroIds: string[]
  created: number
  existing: number
}

/**
 * Garante que todos os funcionários de uma empresa têm um cadastro na base.
 *
 * @param db          Cliente Supabase com service role
 * @param empresa     Dados da empresa (endereço usado para preencher o cadastro)
 * @param activate    Se true, marca os cadastros como ATIVO após provisionar
 * @param activatedAt Timestamp de ativação (usado quando activate = true)
 */
export async function provisionEmpresaFuncionarios(
  db: SupabaseClient,
  empresa: EmpresaProvisionRecord,
  activate = false,
  activatedAt = new Date().toISOString(),
): Promise<EmpresaProvisionResult> {
  const { data: funcionarios, error } = await db
    .from('empresa_funcionarios')
    .select('id, cadastro_id, nome, cpf, rg, email, telefone, data_nascimento, sexo')
    .eq('empresa_id', empresa.id)

  if (error) throw error
  if (!funcionarios?.length) throw new Error('Empresa sem colaboradores para provisionar.')

  const cadastroIds: string[] = []
  let created = 0
  let existing = 0

  for (const funcionario of funcionarios) {
    let cadastroId = funcionario.cadastro_id as string | null

    if (!cadastroId) {
      // Verifica se já existe cadastro por CPF na empresa (evita duplicatas)
      const { data: existingCadastro, error: existingError } = await db
        .from('cadastros')
        .select('id')
        .eq('empresa_id', empresa.id)
        .eq('cpf', funcionario.cpf)
        .maybeSingle()

      if (existingError) throw existingError

      if (existingCadastro) {
        cadastroId = existingCadastro.id
        existing++
      } else {
        // Cria novo cadastro com dados do funcionário + endereço da empresa
        cadastroId = crypto.randomUUID()
        const { error: insertError } = await db.from('cadastros').insert({
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
          status: EMPRESA_STATUSES.pagamento, // PENDENTE_PAGAMENTO
          tipo_plano: empresa.tipo_plano,
          mensalidade_billing_type: empresa.mensalidade_billing_type,
        })
        if (insertError) throw insertError
        created++
      }

      // Vincula funcionário ao cadastro
      const { error: linkError } = await db
        .from('empresa_funcionarios')
        .update({ cadastro_id: cadastroId })
        .eq('id', funcionario.id)
        .eq('empresa_id', empresa.id)

      if (linkError) throw linkError
    } else {
      existing++
    }

    if (!cadastroId) throw new Error('Não foi possível vincular o colaborador ao cadastro.')
    cadastroIds.push(cadastroId)
  }

  if (activate && cadastroIds.length > 0) {
    const { error: activationError } = await db
      .from('cadastros')
      .update({ status: 'ATIVO', adesao_pago_em: activatedAt })
      .eq('empresa_id', empresa.id)
      .in('id', cadastroIds)

    if (activationError) throw activationError
  }

  return { cadastroIds, created, existing }
}
