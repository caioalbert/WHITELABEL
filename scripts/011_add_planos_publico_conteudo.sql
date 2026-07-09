ALTER TABLE planos
  ADD COLUMN IF NOT EXISTS descricao_publica TEXT,
  ADD COLUMN IF NOT EXISTS beneficios_publicos TEXT;
