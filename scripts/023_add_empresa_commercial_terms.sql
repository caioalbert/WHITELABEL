-- Condições comerciais definidas no cadastro administrativo de empresas.
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS sem_adesao BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS valor_adesao NUMERIC(10,2);

COMMENT ON COLUMN empresas.sem_adesao IS
  'Se true, a empresa foi cadastrada sem cobrança de adesão.';

COMMENT ON COLUMN empresas.valor_adesao IS
  'Valor acordado para adesão empresarial; nulo quando a adesão é isenta.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'empresas_valor_adesao_check'
  ) THEN
    ALTER TABLE empresas
      ADD CONSTRAINT empresas_valor_adesao_check
      CHECK (valor_adesao IS NULL OR valor_adesao > 0);
  END IF;
END
$$;
