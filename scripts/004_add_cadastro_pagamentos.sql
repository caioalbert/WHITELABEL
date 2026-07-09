ALTER TABLE cadastros
  ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDENTE_PAGAMENTO',
  ADD COLUMN IF NOT EXISTS adesao_pago_em TIMESTAMP WITH TIME ZONE;

UPDATE cadastros
SET status = 'PENDENTE_PAGAMENTO'
WHERE status IS NULL;

ALTER TABLE cadastros
  ALTER COLUMN status SET DEFAULT 'PENDENTE_PAGAMENTO',
  ALTER COLUMN status SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cadastros_asaas_payment_id_idx
  ON cadastros(asaas_payment_id)
  WHERE asaas_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cadastros_asaas_subscription_id_idx
  ON cadastros(asaas_subscription_id)
  WHERE asaas_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS cadastros_status_idx
  ON cadastros(status);
