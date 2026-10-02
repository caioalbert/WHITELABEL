import type { SupabaseClient } from '@supabase/supabase-js'

export const EMPRESA_ACCESS_EXCEPTION_SCOPE = 'FUNCIONARIOS' as const

export type EmpresaAccessException = {
  id: string
  empresa_id: string
  escopo: typeof EMPRESA_ACCESS_EXCEPTION_SCOPE
  motivo: string
  concedido_por: string | null
  concedido_em: string
  expira_em: string
  revogado_em: string | null
  revogado_por: string | null
  observacao: string | null
}

export async function getActiveEmpresaAccessException(
  db: SupabaseClient,
  empresaId: string,
  now = new Date().toISOString(),
) {
  const { data, error } = await db
    .from('empresa_acesso_excecoes')
    .select('id, empresa_id, escopo, motivo, concedido_por, concedido_em, expira_em, revogado_em, revogado_por, observacao')
    .eq('empresa_id', empresaId)
    .eq('escopo', EMPRESA_ACCESS_EXCEPTION_SCOPE)
    .is('revogado_em', null)
    .gt('expira_em', now)
    .order('expira_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as EmpresaAccessException | null
}
