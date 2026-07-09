CREATE TABLE IF NOT EXISTS vendedor_comissao_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,
  mes_referencia DATE NOT NULL,
  valor_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  pago_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  comprovante_path TEXT,
  comprovante_url TEXT,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE vendedor_comissao_pagamentos
  ADD COLUMN IF NOT EXISTS vendedor_id UUID,
  ADD COLUMN IF NOT EXISTS mes_referencia DATE,
  ADD COLUMN IF NOT EXISTS valor_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pago_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS comprovante_path TEXT,
  ADD COLUMN IF NOT EXISTS comprovante_url TEXT,
  ADD COLUMN IF NOT EXISTS observacao TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vendedor_comissao_pagamentos_vendedor_id_fkey'
  ) THEN
    ALTER TABLE vendedor_comissao_pagamentos
      ADD CONSTRAINT vendedor_comissao_pagamentos_vendedor_id_fkey
      FOREIGN KEY (vendedor_id)
      REFERENCES vendedores(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS vendedor_comissao_pagamentos_unique_mes_idx
  ON vendedor_comissao_pagamentos(vendedor_id, mes_referencia);

CREATE INDEX IF NOT EXISTS vendedor_comissao_pagamentos_vendedor_idx
  ON vendedor_comissao_pagamentos(vendedor_id);

CREATE INDEX IF NOT EXISTS vendedor_comissao_pagamentos_mes_idx
  ON vendedor_comissao_pagamentos(mes_referencia DESC);

ALTER TABLE vendedor_comissao_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_vendedor_comissao_pagamentos_updated_at ON vendedor_comissao_pagamentos;
CREATE TRIGGER update_vendedor_comissao_pagamentos_updated_at
  BEFORE UPDATE ON vendedor_comissao_pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
