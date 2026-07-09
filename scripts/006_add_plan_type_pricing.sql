ALTER TABLE cadastros
  ADD COLUMN IF NOT EXISTS tipo_plano TEXT DEFAULT 'INDIVIDUAL',
  ADD COLUMN IF NOT EXISTS mensalidade_valor NUMERIC(10,2);

UPDATE cadastros
SET tipo_plano = 'INDIVIDUAL'
WHERE tipo_plano IS NULL;

ALTER TABLE cadastros
  ALTER COLUMN tipo_plano SET DEFAULT 'INDIVIDUAL',
  ALTER COLUMN tipo_plano SET NOT NULL;

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
