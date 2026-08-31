import { createAdminClient } from '@/lib/supabase/admin'

export const EMPRESA_STATUSES = {
  cadastro: 'CADASTRO_CONCLUIDO',
  orcamento: 'ORCAMENTO_SOLICITADO',
  lista: 'LISTA_FUNCIONARIOS_ENVIADA',
  pagamento: 'PENDENTE_PAGAMENTO',
  ativo: 'ATIVO',
} as const

export type EmpresaStatus = (typeof EMPRESA_STATUSES)[keyof typeof EMPRESA_STATUSES]

export const EMPRESA_STATUS_ORDER: EmpresaStatus[] = [
  EMPRESA_STATUSES.cadastro,
  EMPRESA_STATUSES.orcamento,
  EMPRESA_STATUSES.lista,
  EMPRESA_STATUSES.pagamento,
  EMPRESA_STATUSES.ativo,
]

export function isEmpresaStatus(value: unknown): value is EmpresaStatus {
  return EMPRESA_STATUS_ORDER.includes(value as EmpresaStatus)
}

export function empresaNextStep(status: EmpresaStatus) {
  switch (status) {
    case EMPRESA_STATUSES.cadastro:
      return 'ORCAMENTO'
    case EMPRESA_STATUSES.orcamento:
      return 'COLABORADORES'
    case EMPRESA_STATUSES.lista:
      return 'PAGAMENTO'
    case EMPRESA_STATUSES.pagamento:
      return 'AGUARDAR_PAGAMENTO'
    case EMPRESA_STATUSES.ativo:
      return 'APP'
  }
}

export async function loadEmpresaPlan() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('planos')
    .select('codigo, nome, valor, dependentes_minimos, ativo')
    .eq('ativo', true)
    .or('codigo.ilike.%EMPRESARIAL%,nome.ilike.%EMPRESARIAL%')
    .order('ordem', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Plano empresarial ativo não encontrado.')

  const value = Number(data.valor)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('O plano empresarial está sem valor válido.')
  }

  return {
    codigo: String(data.codigo),
    nome: String(data.nome),
    valorPorFuncionario: Math.round((value + Number.EPSILON) * 100) / 100,
    // A configuração existente representa 10 vidas como titular + 9 dependentes.
    minFuncionarios: Math.max(1, Number(data.dependentes_minimos || 0) + 1),
  }
}

export function getEmpresaExternalReference(empresaId: string) {
  return `empresa:${empresaId}`
}

export function parseEmpresaExternalReference(value: string | null | undefined) {
  const match = String(value || '').match(/^empresa:([0-9a-f-]{36})$/i)
  return match?.[1] || null
}
