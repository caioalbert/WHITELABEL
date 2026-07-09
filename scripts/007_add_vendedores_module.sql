CREATE TABLE IF NOT EXISTS vendedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  codigo_indicacao TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  auth_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE vendedores
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auth_user_id UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS vendedores_email_idx ON vendedores(email);
CREATE UNIQUE INDEX IF NOT EXISTS vendedores_codigo_idx ON vendedores(codigo_indicacao);

ALTER TABLE cadastros
  ADD COLUMN IF NOT EXISTS vendedor_id UUID,
  ADD COLUMN IF NOT EXISTS vendedor_codigo TEXT;

CREATE INDEX IF NOT EXISTS cadastros_vendedor_id_idx ON cadastros(vendedor_id);
CREATE INDEX IF NOT EXISTS cadastros_vendedor_codigo_idx ON cadastros(vendedor_codigo);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cadastros_vendedor_id_fkey'
  ) THEN
    ALTER TABLE cadastros
      ADD CONSTRAINT cadastros_vendedor_id_fkey
      FOREIGN KEY (vendedor_id)
      REFERENCES vendedores(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

ALTER TABLE vendedores ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_vendedores_updated_at ON vendedores;
CREATE TRIGGER update_vendedores_updated_at
  BEFORE UPDATE ON vendedores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
