ALTER TABLE cadastros
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS cadastros_asaas_customer_id_idx
  ON cadastros(asaas_customer_id)
  WHERE asaas_customer_id IS NOT NULL;
