-- ============================================================
-- Migration 020: Rename instituto → parceiro
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. Renomear tabelas principais
ALTER TABLE IF EXISTS institutos RENAME TO parceiros;
ALTER TABLE IF EXISTS instituto_planos RENAME TO parceiro_planos;
ALTER TABLE IF EXISTS instituto_plano_precos RENAME TO parceiro_plano_precos;

-- 2. Renomear coluna FK em parceiro_planos
ALTER TABLE IF EXISTS parceiro_planos
  RENAME COLUMN instituto_id TO parceiro_id;

-- 3. Renomear coluna FK em parceiro_plano_precos
ALTER TABLE IF EXISTS parceiro_plano_precos
  RENAME COLUMN instituto_id TO parceiro_id;

-- 4. Renomear colunas na tabela cadastros
ALTER TABLE IF EXISTS cadastros
  RENAME COLUMN instituto_id TO parceiro_id;

ALTER TABLE IF EXISTS cadastros
  RENAME COLUMN instituto_codigo TO parceiro_codigo;

-- 5. Recriar índices com nomes novos
--    (os antigos são removidos automaticamente pelo RENAME TABLE,
--     mas índices explícitos precisam ser recriados)

DROP INDEX IF EXISTS institutos_email_idx;
DROP INDEX IF EXISTS institutos_codigo_idx;
DROP INDEX IF EXISTS instituto_plano_precos_instituto_idx;
DROP INDEX IF EXISTS instituto_plano_precos_plano_idx;
DROP INDEX IF EXISTS instituto_comissao_pagamentos_instituto_idx;
DROP INDEX IF EXISTS cadastros_instituto_id_idx;
DROP INDEX IF EXISTS cadastros_instituto_codigo_idx;
DROP INDEX IF EXISTS idx_instituto_planos_instituto_id;

CREATE UNIQUE INDEX IF NOT EXISTS parceiros_email_idx
  ON parceiros(email);

CREATE UNIQUE INDEX IF NOT EXISTS parceiros_codigo_idx
  ON parceiros(codigo_indicacao);

CREATE INDEX IF NOT EXISTS parceiro_plano_precos_parceiro_idx
  ON parceiro_plano_precos(parceiro_id);

CREATE INDEX IF NOT EXISTS parceiro_plano_precos_plano_idx
  ON parceiro_plano_precos(plano_id);

CREATE INDEX IF NOT EXISTS cadastros_parceiro_id_idx
  ON cadastros(parceiro_id);

CREATE INDEX IF NOT EXISTS cadastros_parceiro_codigo_idx
  ON cadastros(parceiro_codigo);

CREATE INDEX IF NOT EXISTS idx_parceiro_planos_parceiro_id
  ON parceiro_planos(parceiro_id);

-- 6. RLS: reabilitar nas tabelas renomeadas (o Postgres mantém as políticas)
ALTER TABLE IF EXISTS parceiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS parceiro_planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS parceiro_plano_precos ENABLE ROW LEVEL SECURITY;

-- 7. Verificação rápida
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('parceiros', 'parceiro_planos', 'parceiro_plano_precos')
ORDER BY table_name;
