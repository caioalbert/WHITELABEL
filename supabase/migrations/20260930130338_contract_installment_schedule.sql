-- Novos contratos: a primeira parcela integra o total de meses.
-- Campos nulos preservam as condições de contratos anteriores à mudança.
BEGIN;

ALTER TABLE public.cadastros
  ADD COLUMN IF NOT EXISTS primeira_parcela_vencimento DATE,
  ADD COLUMN IF NOT EXISTS dia_vencimento SMALLINT,
  ADD COLUMN IF NOT EXISTS parcelas_mesmo_dia BOOLEAN,
  ADD COLUMN IF NOT EXISTS contrato_meses SMALLINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cadastros_billing_schedule_check' AND conrelid = 'public.cadastros'::regclass) THEN
    ALTER TABLE public.cadastros ADD CONSTRAINT cadastros_billing_schedule_check CHECK (
      (primeira_parcela_vencimento IS NULL AND dia_vencimento IS NULL AND parcelas_mesmo_dia IS NULL AND contrato_meses IS NULL)
      OR
      (primeira_parcela_vencimento IS NOT NULL AND dia_vencimento IS NOT NULL AND parcelas_mesmo_dia IS NOT NULL AND contrato_meses IS NOT NULL
       AND dia_vencimento BETWEEN 1 AND 31 AND contrato_meses BETWEEN 1 AND 60
       AND (NOT parcelas_mesmo_dia OR dia_vencimento = EXTRACT(DAY FROM primeira_parcela_vencimento)))
    );
  END IF;
END $$;

COMMENT ON COLUMN public.cadastros.contrato_meses IS 'Total de parcelas incluindo a primeira. Nulo identifica contrato legado.';
COMMENT ON COLUMN public.cadastros.dia_vencimento IS 'Dia escolhido para parcelas posteriores; usar último dia em meses mais curtos.';

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS primeira_parcela_vencimento DATE,
  ADD COLUMN IF NOT EXISTS dia_vencimento SMALLINT,
  ADD COLUMN IF NOT EXISTS parcelas_mesmo_dia BOOLEAN,
  ADD COLUMN IF NOT EXISTS contrato_meses SMALLINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empresas_billing_schedule_check' AND conrelid = 'public.empresas'::regclass) THEN
    ALTER TABLE public.empresas ADD CONSTRAINT empresas_billing_schedule_check CHECK (
      (primeira_parcela_vencimento IS NULL AND dia_vencimento IS NULL AND parcelas_mesmo_dia IS NULL AND contrato_meses IS NULL)
      OR
      (primeira_parcela_vencimento IS NOT NULL AND dia_vencimento IS NOT NULL AND parcelas_mesmo_dia IS NOT NULL AND contrato_meses IS NOT NULL
       AND dia_vencimento BETWEEN 1 AND 31 AND contrato_meses BETWEEN 1 AND 60
       AND (NOT parcelas_mesmo_dia OR dia_vencimento = EXTRACT(DAY FROM primeira_parcela_vencimento)))
    );
  END IF;
END $$;

COMMENT ON COLUMN public.empresas.contrato_meses IS 'Total de parcelas incluindo a primeira. Nulo identifica contrato legado.';
COMMENT ON COLUMN public.empresas.dia_vencimento IS 'Dia escolhido para parcelas posteriores; usar último dia em meses mais curtos.';

COMMIT;
