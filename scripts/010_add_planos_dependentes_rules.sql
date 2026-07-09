ALTER TABLE planos
  ADD COLUMN IF NOT EXISTS permite_dependentes BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dependentes_minimos INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_dependentes INTEGER,
  ADD COLUMN IF NOT EXISTS valor_dependente_adicional NUMERIC(10,2) NOT NULL DEFAULT 0;

UPDATE planos
SET
  permite_dependentes = true,
  dependentes_minimos = CASE
    WHEN dependentes_minimos IS NULL OR dependentes_minimos < 1 THEN 1
    ELSE dependentes_minimos
  END,
  max_dependentes = COALESCE(max_dependentes, 4)
WHERE codigo = 'FAMILIAR';

UPDATE planos
SET
  permite_dependentes = false,
  dependentes_minimos = 0,
  max_dependentes = NULL,
  valor_dependente_adicional = 0
WHERE codigo = 'INDIVIDUAL';

ALTER TABLE planos
  DROP CONSTRAINT IF EXISTS planos_dependentes_minimos_non_negative,
  DROP CONSTRAINT IF EXISTS planos_max_dependentes_non_negative,
  DROP CONSTRAINT IF EXISTS planos_dependentes_min_max_check,
  DROP CONSTRAINT IF EXISTS planos_valor_dependente_adicional_non_negative;

ALTER TABLE planos
  ADD CONSTRAINT planos_dependentes_minimos_non_negative CHECK (dependentes_minimos >= 0),
  ADD CONSTRAINT planos_max_dependentes_non_negative CHECK (max_dependentes IS NULL OR max_dependentes >= 0),
  ADD CONSTRAINT planos_dependentes_min_max_check CHECK (
    max_dependentes IS NULL OR max_dependentes = 0 OR max_dependentes >= dependentes_minimos
  ),
  ADD CONSTRAINT planos_valor_dependente_adicional_non_negative CHECK (valor_dependente_adicional >= 0);
