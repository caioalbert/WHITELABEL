-- Fluxo empresarial (PJ): cadastro -> orçamento -> funcionários -> pagamento -> app.

CREATE TABLE IF NOT EXISTS empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT NOT NULL,
  responsavel_nome TEXT NOT NULL,
  endereco TEXT NOT NULL,
  numero TEXT NOT NULL,
  complemento TEXT,
  bairro TEXT NOT NULL,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  cep TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CADASTRO_CONCLUIDO',
  tipo_plano TEXT NOT NULL DEFAULT 'PLANO-EMPRESARIAL',
  quantidade_funcionarios INTEGER,
  minimo_funcionarios INTEGER,
  valor_por_funcionario NUMERIC(10,2),
  mensalidade_valor NUMERIC(10,2),
  mensalidade_billing_type TEXT,
  asaas_customer_id TEXT,
  asaas_payment_id TEXT,
  asaas_subscription_id TEXT,
  orcamento_solicitado_em TIMESTAMP WITH TIME ZONE,
  lista_funcionarios_enviada_em TIMESTAMP WITH TIME ZONE,
  pagamento_confirmado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT empresas_status_check CHECK (status IN (
    'CADASTRO_CONCLUIDO',
    'ORCAMENTO_SOLICITADO',
    'LISTA_FUNCIONARIOS_ENVIADA',
    'PENDENTE_PAGAMENTO',
    'ATIVO'
  )),
  CONSTRAINT empresas_quantidade_funcionarios_check CHECK (
    quantidade_funcionarios IS NULL OR quantidade_funcionarios > 0
  ),
  CONSTRAINT empresas_minimo_funcionarios_check CHECK (
    minimo_funcionarios IS NULL OR minimo_funcionarios > 0
  ),
  CONSTRAINT empresas_valor_por_funcionario_check CHECK (
    valor_por_funcionario IS NULL OR valor_por_funcionario > 0
  ),
  CONSTRAINT empresas_mensalidade_valor_check CHECK (
    mensalidade_valor IS NULL OR mensalidade_valor > 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS empresas_cnpj_idx ON empresas(cnpj);
CREATE UNIQUE INDEX IF NOT EXISTS empresas_email_idx ON empresas(LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS empresas_asaas_customer_id_idx
  ON empresas(asaas_customer_id) WHERE asaas_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS empresas_asaas_payment_id_idx
  ON empresas(asaas_payment_id) WHERE asaas_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS empresas_asaas_subscription_id_idx
  ON empresas(asaas_subscription_id) WHERE asaas_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS empresas_status_idx ON empresas(status);

CREATE TABLE IF NOT EXISTS empresa_funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cadastro_id UUID,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL,
  rg TEXT,
  email TEXT NOT NULL,
  telefone TEXT NOT NULL,
  data_nascimento DATE NOT NULL,
  sexo TEXT,
  cargo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS empresa_funcionarios_cpf_idx ON empresa_funcionarios(cpf);
CREATE UNIQUE INDEX IF NOT EXISTS empresa_funcionarios_email_idx ON empresa_funcionarios(LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS empresa_funcionarios_cadastro_id_idx
  ON empresa_funcionarios(cadastro_id) WHERE cadastro_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS empresa_funcionarios_empresa_id_idx
  ON empresa_funcionarios(empresa_id);

ALTER TABLE cadastros
  ADD COLUMN IF NOT EXISTS empresa_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cadastros_empresa_id_fkey'
  ) THEN
    ALTER TABLE cadastros
      ADD CONSTRAINT cadastros_empresa_id_fkey
      FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS cadastros_empresa_id_idx ON cadastros(empresa_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'empresa_funcionarios_cadastro_id_fkey'
  ) THEN
    ALTER TABLE empresa_funcionarios
      ADD CONSTRAINT empresa_funcionarios_cadastro_id_fkey
      FOREIGN KEY (cadastro_id) REFERENCES cadastros(id) ON DELETE SET NULL;
  END IF;
END
$$;

ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresa_funcionarios ENABLE ROW LEVEL SECURITY;

-- As operações passam exclusivamente pelas APIs server-side com service role.
-- Remove as políticas antigas que expunham todos os dados pessoais à chave anônima.
DROP POLICY IF EXISTS "cadastros_insert_public" ON cadastros;
DROP POLICY IF EXISTS "cadastros_select_own" ON cadastros;
DROP POLICY IF EXISTS "dependentes_insert_public" ON dependentes;
DROP POLICY IF EXISTS "dependentes_select_public" ON dependentes;

DROP TRIGGER IF EXISTS update_empresas_updated_at ON empresas;
CREATE TRIGGER update_empresas_updated_at
  BEFORE UPDATE ON empresas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_empresa_funcionarios_updated_at ON empresa_funcionarios;
CREATE TRIGGER update_empresa_funcionarios_updated_at
  BEFORE UPDATE ON empresa_funcionarios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
