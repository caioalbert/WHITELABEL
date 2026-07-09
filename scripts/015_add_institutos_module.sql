-- Migration 015: Add institutos module
-- Idempotent: uses CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS

-- ============================================================
-- 1. Table: institutos
-- ============================================================
CREATE TABLE IF NOT EXISTS institutos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  codigo_indicacao TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  -- Per-institute commission % on monthly payment (overrides global setting)
  comissao_percentual_mensalidade NUMERIC(5,2) DEFAULT 50,
  -- How many monthly payments generate commission; NULL = vitalício (all)
  comissao_mensalidades_max INTEGER DEFAULT NULL,
  auth_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS institutos_email_idx ON institutos(email);
CREATE UNIQUE INDEX IF NOT EXISTS institutos_codigo_idx ON institutos(codigo_indicacao);

ALTER TABLE institutos ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_institutos_updated_at ON institutos;
CREATE TRIGGER update_institutos_updated_at
  BEFORE UPDATE ON institutos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. Table: instituto_plano_precos
--    Custom per-person price per plan for a given instituto
-- ============================================================
CREATE TABLE IF NOT EXISTS instituto_plano_precos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instituto_id UUID NOT NULL REFERENCES institutos(id) ON DELETE CASCADE,
  plano_id UUID NOT NULL REFERENCES planos(id) ON DELETE CASCADE,
  -- Custom price per person charged for members of this instituto
  valor_por_pessoa NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT instituto_plano_precos_unique UNIQUE (instituto_id, plano_id)
);

CREATE INDEX IF NOT EXISTS instituto_plano_precos_instituto_idx ON instituto_plano_precos(instituto_id);
CREATE INDEX IF NOT EXISTS instituto_plano_precos_plano_idx ON instituto_plano_precos(plano_id);

ALTER TABLE instituto_plano_precos ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_instituto_plano_precos_updated_at ON instituto_plano_precos;
CREATE TRIGGER update_instituto_plano_precos_updated_at
  BEFORE UPDATE ON instituto_plano_precos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. Table: instituto_comissao_pagamentos
--    Same structure as vendedor_comissao_pagamentos
-- ============================================================
CREATE TABLE IF NOT EXISTS instituto_comissao_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instituto_id UUID NOT NULL REFERENCES institutos(id) ON DELETE CASCADE,
  mes_referencia DATE NOT NULL,
  valor_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- pago_em is nullable (NULL = not yet paid)
  pago_em TIMESTAMPTZ,
  comprovante_path TEXT,
  comprovante_url TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT instituto_comissao_pagamentos_unique_mes UNIQUE (instituto_id, mes_referencia)
);

CREATE INDEX IF NOT EXISTS instituto_comissao_pagamentos_instituto_idx
  ON instituto_comissao_pagamentos(instituto_id);

CREATE INDEX IF NOT EXISTS instituto_comissao_pagamentos_mes_idx
  ON instituto_comissao_pagamentos(mes_referencia DESC);

ALTER TABLE instituto_comissao_pagamentos ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_instituto_comissao_pagamentos_updated_at ON instituto_comissao_pagamentos;
CREATE TRIGGER update_instituto_comissao_pagamentos_updated_at
  BEFORE UPDATE ON instituto_comissao_pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. Extend cadastros with instituto fields
-- ============================================================
ALTER TABLE cadastros
  ADD COLUMN IF NOT EXISTS instituto_id UUID REFERENCES institutos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instituto_codigo TEXT,
  -- When true, onboarding fee (adesão) is waived for this member
  ADD COLUMN IF NOT EXISTS sem_adesao BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS cadastros_instituto_id_idx ON cadastros(instituto_id);
CREATE INDEX IF NOT EXISTS cadastros_instituto_codigo_idx ON cadastros(instituto_codigo);
