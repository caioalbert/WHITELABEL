export interface Cadastro {
  id: string
  email: string
  nome: string
  cpf: string
  rg?: string
  data_nascimento: string
  telefone?: string
  sexo?: string
  estado_civil?: string
  nome_conjuge?: string
  escolaridade?: string
  endereco?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  cep?: string
  tem_dependentes: boolean
  status?: 'PENDENTE_PAGAMENTO' | 'ATIVO' | string
  asaas_customer_id?: string
  asaas_payment_id?: string
  asaas_subscription_id?: string
  vendedor_id?: string
  vendedor_codigo?: string
  instituto_id?: string
  instituto_codigo?: string
  empresa_id?: string
  sem_adesao?: boolean
  tipo_plano?: 'INDIVIDUAL' | 'FAMILIAR' | string
  mensalidade_valor?: number
  mensalidade_billing_type?: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | string
  adesao_pago_em?: string
  termo_pdf_path?: string
  email_enviado_em?: string
  dependentes_sem_rg_count?: number
  dependentes_sem_email_count?: number
  financeiro_status?: 'EM_DIA' | 'EM_ATRASO' | 'ADESAO_NAO_CONCLUIDA' | string | null
  created_at: string
  updated_at: string
}

export type EmpresaStatus =
  | 'CADASTRO_CONCLUIDO'
  | 'ORCAMENTO_SOLICITADO'
  | 'LISTA_FUNCIONARIOS_ENVIADA'
  | 'PENDENTE_PAGAMENTO'
  | 'ATIVO'

export interface Empresa {
  id: string
  razao_social: string
  nome_fantasia?: string | null
  cnpj: string
  email: string
  telefone: string
  responsavel_nome: string
  status: EmpresaStatus
  tipo_plano: string
  quantidade_funcionarios?: number | null
  minimo_funcionarios?: number | null
  valor_por_funcionario?: number | null
  mensalidade_valor?: number | null
  mensalidade_billing_type?: string | null
  asaas_customer_id?: string | null
  asaas_payment_id?: string | null
  asaas_subscription_id?: string | null
  orcamento_solicitado_em?: string | null
  lista_funcionarios_enviada_em?: string | null
  pagamento_confirmado_em?: string | null
  created_at: string
  updated_at: string
}

export interface EmpresaFuncionario {
  id: string
  empresa_id: string
  cadastro_id?: string | null
  nome: string
  cpf: string
  rg?: string | null
  email: string
  telefone: string
  data_nascimento: string
  sexo?: string | null
  cargo?: string | null
  created_at: string
  updated_at: string
}

export interface Dependente {
  id: string
  cadastro_id: string
  nome: string
  rg?: string
  cpf?: string
  data_nascimento?: string
  relacao: string
  email: string
  telefone_celular?: string
  sexo?: string
  created_at: string
}

export interface CadastroFormData {
  // Dados pessoais
  nome: string
  cpf: string
  rg: string
  data_nascimento: string
  telefone: string
  sexo: string
  estado_civil: string
  nome_conjuge: string
  escolaridade: string

  // Endereço
  endereco: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  cep: string

  // Dependentes
  tem_dependentes: boolean
  dependentes: DependenteFormData[]

  // Plano
  tipo_plano: string

  // Email para contato
  email: string

  // Referência de vendedor (link de indicação)
  vendedor_ref?: string

  // Cobrança recorrente (mensalidade)
  mensalidade_billing_type: 'BOLETO' | 'CREDIT_CARD'
}

export interface Vendedor {
  id: string
  nome: string
  email: string
  codigo_indicacao: string
  ativo: boolean
  auth_user_id?: string
  created_at: string
  updated_at: string
}

export interface Instituto {
  id: string
  nome: string
  email: string
  codigo_indicacao: string
  ativo: boolean
  comissao_percentual_mensalidade: number
  comissao_mensalidades_max: number | null // null = vitalício (all monthly payments)
  auth_user_id?: string
  created_at: string
  updated_at: string
}

export interface InstitutoPlanoPreco {
  id: string
  instituto_id: string
  plano_id: string
  valor_por_pessoa: number
  created_at: string
  updated_at: string
}

export interface DependenteFormData {
  nome: string
  rg: string
  cpf: string
  data_nascimento: string
  relacao: string
  email: string
  telefone_celular: string
  sexo: string
}
