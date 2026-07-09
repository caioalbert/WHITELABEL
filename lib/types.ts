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
