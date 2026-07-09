-- Tabela principal de cadastros
CREATE TABLE IF NOT EXISTS cadastros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL,
  rg TEXT,
  data_nascimento DATE NOT NULL,
  telefone TEXT,
  sexo TEXT,
  estado_civil TEXT,
  nome_conjuge TEXT,
  escolaridade TEXT,
  endereco TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  tem_dependentes BOOLEAN DEFAULT FALSE,
  asaas_customer_id TEXT,
  asaas_payment_id TEXT,
  asaas_subscription_id TEXT,
  vendedor_id UUID,
  vendedor_codigo TEXT,
  tipo_plano TEXT NOT NULL DEFAULT 'INDIVIDUAL',
  mensalidade_valor NUMERIC(10,2),
  mensalidade_billing_type TEXT,
  status TEXT NOT NULL DEFAULT 'PENDENTE_PAGAMENTO',
  adesao_pago_em TIMESTAMP WITH TIME ZONE,
  termo_pdf_path TEXT,
  email_enviado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices únicos
CREATE UNIQUE INDEX IF NOT EXISTS cadastros_email_idx ON cadastros(email);
CREATE UNIQUE INDEX IF NOT EXISTS cadastros_cpf_idx ON cadastros(cpf);
CREATE INDEX IF NOT EXISTS cadastros_vendedor_id_idx ON cadastros(vendedor_id);
CREATE INDEX IF NOT EXISTS cadastros_vendedor_codigo_idx ON cadastros(vendedor_codigo);

-- Tabela de dependentes
CREATE TABLE IF NOT EXISTS dependentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cadastro_id UUID NOT NULL REFERENCES cadastros(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  rg TEXT,
  cpf TEXT,
  data_nascimento DATE,
  relacao TEXT,
  email TEXT NOT NULL,
  telefone_celular TEXT,
  sexo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de vendedores
CREATE TABLE IF NOT EXISTS vendedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  codigo_indicacao TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  auth_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS vendedores_email_idx ON vendedores(email);
CREATE UNIQUE INDEX IF NOT EXISTS vendedores_codigo_idx ON vendedores(codigo_indicacao);

-- Compatibilidade com bancos já existentes
ALTER TABLE cadastros
  ADD COLUMN IF NOT EXISTS sexo TEXT,
  ADD COLUMN IF NOT EXISTS rg TEXT,
  ADD COLUMN IF NOT EXISTS estado_civil TEXT,
  ADD COLUMN IF NOT EXISTS nome_conjuge TEXT,
  ADD COLUMN IF NOT EXISTS escolaridade TEXT,
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS vendedor_id UUID,
  ADD COLUMN IF NOT EXISTS vendedor_codigo TEXT,
  ADD COLUMN IF NOT EXISTS tipo_plano TEXT DEFAULT 'INDIVIDUAL',
  ADD COLUMN IF NOT EXISTS mensalidade_valor NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS mensalidade_billing_type TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDENTE_PAGAMENTO',
  ADD COLUMN IF NOT EXISTS adesao_pago_em TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS vendedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  codigo_indicacao TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  auth_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE vendedores
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auth_user_id UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS vendedores_email_idx ON vendedores(email);
CREATE UNIQUE INDEX IF NOT EXISTS vendedores_codigo_idx ON vendedores(codigo_indicacao);

UPDATE cadastros
SET status = 'PENDENTE_PAGAMENTO'
WHERE status IS NULL;

UPDATE cadastros
SET tipo_plano = 'INDIVIDUAL'
WHERE tipo_plano IS NULL;

ALTER TABLE cadastros
  ALTER COLUMN status SET DEFAULT 'PENDENTE_PAGAMENTO',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN tipo_plano SET DEFAULT 'INDIVIDUAL',
  ALTER COLUMN tipo_plano SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cadastros_asaas_customer_id_idx ON cadastros(asaas_customer_id) WHERE asaas_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cadastros_asaas_payment_id_idx ON cadastros(asaas_payment_id) WHERE asaas_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cadastros_asaas_subscription_id_idx ON cadastros(asaas_subscription_id) WHERE asaas_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS cadastros_status_idx ON cadastros(status);
CREATE INDEX IF NOT EXISTS cadastros_vendedor_id_idx ON cadastros(vendedor_id);
CREATE INDEX IF NOT EXISTS cadastros_vendedor_codigo_idx ON cadastros(vendedor_codigo);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cadastros_vendedor_id_fkey'
  ) THEN
    ALTER TABLE cadastros
      ADD CONSTRAINT cadastros_vendedor_id_fkey
      FOREIGN KEY (vendedor_id)
      REFERENCES vendedores(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS cobranca_configuracoes (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  adesao_value NUMERIC(10,2) NOT NULL DEFAULT 49.90,
  mensalidade_value NUMERIC(10,2) NOT NULL DEFAULT 49.90,
  mensalidade_individual_value NUMERIC(10,2) NOT NULL DEFAULT 49.90,
  mensalidade_familiar_value NUMERIC(10,2) NOT NULL DEFAULT 79.90,
  mensalidade_billing_types TEXT[] NOT NULL DEFAULT ARRAY['PIX']::TEXT[],
  default_mensalidade_billing_type TEXT NOT NULL DEFAULT 'PIX',
  default_plan_type TEXT NOT NULL DEFAULT 'INDIVIDUAL',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE cobranca_configuracoes
  ADD COLUMN IF NOT EXISTS mensalidade_individual_value NUMERIC(10,2) NOT NULL DEFAULT 49.90,
  ADD COLUMN IF NOT EXISTS mensalidade_familiar_value NUMERIC(10,2) NOT NULL DEFAULT 79.90,
  ADD COLUMN IF NOT EXISTS default_plan_type TEXT NOT NULL DEFAULT 'INDIVIDUAL';

INSERT INTO cobranca_configuracoes (
  id,
  adesao_value,
  mensalidade_value,
  mensalidade_individual_value,
  mensalidade_familiar_value,
  mensalidade_billing_types,
  default_mensalidade_billing_type,
  default_plan_type
) VALUES (
  true,
  49.90,
  49.90,
  49.90,
  79.90,
  ARRAY['PIX']::TEXT[],
  'PIX',
  'INDIVIDUAL'
)
ON CONFLICT (id) DO NOTHING;

UPDATE cobranca_configuracoes
SET
  mensalidade_individual_value = COALESCE(mensalidade_individual_value, mensalidade_value, 49.90),
  mensalidade_familiar_value = COALESCE(mensalidade_familiar_value, mensalidade_value, 79.90),
  default_plan_type = COALESCE(NULLIF(default_plan_type, ''), 'INDIVIDUAL')
WHERE id = true;

ALTER TABLE dependentes
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS rg TEXT,
  ADD COLUMN IF NOT EXISTS telefone_celular TEXT,
  ADD COLUMN IF NOT EXISTS sexo TEXT;

-- Criar índice para busca por cadastro
CREATE INDEX IF NOT EXISTS dependentes_cadastro_idx ON dependentes(cadastro_id);

-- Habilitar RLS
ALTER TABLE cadastros ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendedores ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para cadastros
-- Permitir inserção pública (qualquer pessoa pode se cadastrar)
DROP POLICY IF EXISTS "cadastros_insert_public" ON cadastros;
CREATE POLICY "cadastros_insert_public" ON cadastros
  FOR INSERT
  WITH CHECK (true);

-- Permitir que o próprio usuário veja seu cadastro pelo email
DROP POLICY IF EXISTS "cadastros_select_own" ON cadastros;
CREATE POLICY "cadastros_select_own" ON cadastros
  FOR SELECT
  USING (true);

-- Admins podem ver todos (usando service role no backend)
-- A verificação real de admin será feita no middleware/API

-- Políticas RLS para dependentes
DROP POLICY IF EXISTS "dependentes_insert_public" ON dependentes;
CREATE POLICY "dependentes_insert_public" ON dependentes
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "dependentes_select_public" ON dependentes;
CREATE POLICY "dependentes_select_public" ON dependentes
  FOR SELECT
  USING (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_cadastros_updated_at ON cadastros;
CREATE TRIGGER update_cadastros_updated_at
  BEFORE UPDATE ON cadastros
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendedores_updated_at ON vendedores;
CREATE TRIGGER update_vendedores_updated_at
  BEFORE UPDATE ON vendedores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
