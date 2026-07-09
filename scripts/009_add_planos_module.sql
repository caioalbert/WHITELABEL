CREATE TABLE IF NOT EXISTS planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE planos
  ADD COLUMN IF NOT EXISTS codigo TEXT,
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ordem INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS planos_codigo_idx ON planos(codigo);
CREATE INDEX IF NOT EXISTS planos_ordem_idx ON planos(ordem, created_at);

WITH cfg AS (
  SELECT
    COALESCE(mensalidade_individual_value, mensalidade_value, adesao_value, 49.90) AS individual_value,
    COALESCE(mensalidade_familiar_value, mensalidade_value, adesao_value, 79.90) AS familiar_value
  FROM cobranca_configuracoes
  WHERE id = true
  LIMIT 1
)
INSERT INTO planos (codigo, nome, valor, ativo, ordem)
SELECT
  'INDIVIDUAL',
  'Plano Individual',
  COALESCE((SELECT individual_value FROM cfg), 49.90),
  true,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM planos WHERE codigo = 'INDIVIDUAL'
);

WITH cfg AS (
  SELECT
    COALESCE(mensalidade_individual_value, mensalidade_value, adesao_value, 49.90) AS individual_value,
    COALESCE(mensalidade_familiar_value, mensalidade_value, adesao_value, 79.90) AS familiar_value
  FROM cobranca_configuracoes
  WHERE id = true
  LIMIT 1
)
INSERT INTO planos (codigo, nome, valor, ativo, ordem)
SELECT
  'FAMILIAR',
  'Plano Familiar',
  COALESCE((SELECT familiar_value FROM cfg), 79.90),
  true,
  2
WHERE NOT EXISTS (
  SELECT 1 FROM planos WHERE codigo = 'FAMILIAR'
);

ALTER TABLE planos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_planos_updated_at ON planos;
CREATE TRIGGER update_planos_updated_at
  BEFORE UPDATE ON planos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
