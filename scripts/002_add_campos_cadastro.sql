-- Migração incremental para bancos já existentes
-- Remove campos de igreja e adiciona email dos dependentes

ALTER TABLE dependentes
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Preencher emails antigos com o email do titular para evitar dependentes sem contato
UPDATE dependentes AS dep
SET email = cad.email
FROM cadastros AS cad
WHERE dep.cadastro_id = cad.id
  AND (dep.email IS NULL OR trim(dep.email) = '');

ALTER TABLE cadastros
  DROP COLUMN IF EXISTS congregacao_atual,
  DROP COLUMN IF EXISTS posicao_igreja;
