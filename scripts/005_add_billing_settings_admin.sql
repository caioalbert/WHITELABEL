ALTER TABLE cadastros
  ADD COLUMN IF NOT EXISTS mensalidade_billing_type TEXT;

CREATE TABLE IF NOT EXISTS cobranca_configuracoes (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  adesao_value NUMERIC(10,2) NOT NULL DEFAULT 49.90,
  mensalidade_value NUMERIC(10,2) NOT NULL DEFAULT 49.90,
  mensalidade_billing_types TEXT[] NOT NULL DEFAULT ARRAY['PIX']::TEXT[],
  default_mensalidade_billing_type TEXT NOT NULL DEFAULT 'PIX',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO cobranca_configuracoes (
  id,
  adesao_value,
  mensalidade_value,
  mensalidade_billing_types,
  default_mensalidade_billing_type
) VALUES (
  true,
  49.90,
  49.90,
  ARRAY['PIX']::TEXT[],
  'PIX'
)
ON CONFLICT (id) DO NOTHING;
