-- scripts/017_instituto_own_plans.sql
-- Adds:
--   1. comissao_percentual_adesao to institutos
--   2. instituto_planos table (institute-owned plans, independent of global planos)

-- 1. Commission on adhesion for institutos
ALTER TABLE institutos
  ADD COLUMN IF NOT EXISTS comissao_percentual_adesao NUMERIC(5,2) NOT NULL DEFAULT 0;

-- 2. Instituto-owned plans table
CREATE TABLE IF NOT EXISTS instituto_planos (
  id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  instituto_id              UUID          NOT NULL REFERENCES institutos(id) ON DELETE CASCADE,
  nome                      TEXT          NOT NULL,
  descricao                 TEXT          NOT NULL DEFAULT '',
  valor                     NUMERIC(10,2) NOT NULL CHECK (valor > 0),
  permite_dependentes       BOOLEAN       NOT NULL DEFAULT false,
  dependentes_minimos       INTEGER       NOT NULL DEFAULT 0,
  max_dependentes           INTEGER,
  valor_dependente_adicional NUMERIC(10,2) NOT NULL DEFAULT 0,
  ativo                     BOOLEAN       NOT NULL DEFAULT true,
  ordem                     INTEGER       NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE instituto_planos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_instituto_planos_instituto_id
  ON instituto_planos(instituto_id);

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER update_instituto_planos_updated_at
  BEFORE UPDATE ON instituto_planos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
