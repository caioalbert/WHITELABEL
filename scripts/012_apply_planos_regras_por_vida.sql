-- Aplica regras comerciais atuais dos planos.
-- Individual: R$ 29,90 sem dependentes.
-- Familiar: mínimo 3 vidas (titular + 2 dependentes), R$ 24,90 por vida.
-- Empresarial: mínimo 10 vidas (titular + 9 dependentes), R$ 21,90 por vida.

UPDATE planos
SET
  nome = 'Plano Individual',
  valor = 29.90,
  ativo = true,
  permite_dependentes = false,
  dependentes_minimos = 0,
  max_dependentes = NULL,
  valor_dependente_adicional = 0,
  updated_at = NOW()
WHERE UPPER(codigo) = 'INDIVIDUAL';

UPDATE planos
SET
  nome = 'Plano Familiar',
  valor = 24.90,
  ativo = true,
  permite_dependentes = true,
  dependentes_minimos = 2,
  max_dependentes = NULL,
  valor_dependente_adicional = 24.90,
  updated_at = NOW()
WHERE UPPER(codigo) = 'FAMILIAR';

INSERT INTO planos (
  codigo,
  nome,
  valor,
  ativo,
  ordem,
  permite_dependentes,
  dependentes_minimos,
  max_dependentes,
  valor_dependente_adicional
)
SELECT
  'PLANO-EMPRESARIAL',
  'Plano Empresarial',
  21.90,
  true,
  COALESCE((SELECT MAX(ordem) FROM planos), 0) + 1,
  true,
  9,
  NULL,
  21.90
WHERE NOT EXISTS (
  SELECT 1
  FROM planos
  WHERE UPPER(codigo) IN ('PLANO-EMPRESARIAL', 'EMPRESARIAL')
     OR UPPER(nome) LIKE '%EMPRESARIAL%'
);

UPDATE planos
SET
  codigo = 'PLANO-EMPRESARIAL',
  nome = 'Plano Empresarial',
  valor = 21.90,
  ativo = true,
  permite_dependentes = true,
  dependentes_minimos = 9,
  max_dependentes = NULL,
  valor_dependente_adicional = 21.90,
  updated_at = NOW()
WHERE UPPER(codigo) IN ('PLANO-EMPRESARIAL', 'EMPRESARIAL')
   OR UPPER(nome) LIKE '%EMPRESARIAL%';
