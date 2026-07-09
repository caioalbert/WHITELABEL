-- Normaliza meios de cobrança para o novo padrão:
-- cliente escolhe apenas BolePIX (BOLETO) ou Cartão de Crédito.

BEGIN;

-- Atualiza histórico de cadastros que ainda usa PIX como valor legado.
UPDATE cadastros
SET mensalidade_billing_type = 'BOLETO'
WHERE UPPER(TRIM(COALESCE(mensalidade_billing_type, ''))) = 'PIX';

-- Normaliza configuração global de formas permitidas.
WITH normalized AS (
  SELECT
    id,
    COALESCE(
      ARRAY(
        SELECT DISTINCT normalized_type
        FROM (
          SELECT CASE
            WHEN UPPER(TRIM(raw_type)) = 'PIX' THEN 'BOLETO'
            WHEN UPPER(TRIM(raw_type)) IN ('BOLETO', 'CREDIT_CARD') THEN UPPER(TRIM(raw_type))
            ELSE NULL
          END AS normalized_type
          FROM UNNEST(COALESCE(mensalidade_billing_types, ARRAY[]::text[])) AS raw_type
        ) mapped
        WHERE normalized_type IS NOT NULL
      ),
      ARRAY[]::text[]
    ) AS normalized_types,
    CASE
      WHEN UPPER(TRIM(COALESCE(default_mensalidade_billing_type, ''))) = 'CREDIT_CARD'
        THEN 'CREDIT_CARD'
      ELSE 'BOLETO'
    END AS normalized_default
  FROM cobranca_configuracoes
  WHERE id = true
)
UPDATE cobranca_configuracoes cfg
SET
  mensalidade_billing_types = CASE
    WHEN CARDINALITY(normalized.normalized_types) > 0
      THEN normalized.normalized_types
    ELSE ARRAY['BOLETO', 'CREDIT_CARD']::text[]
  END,
  default_mensalidade_billing_type = CASE
    WHEN normalized.normalized_default = 'CREDIT_CARD' AND (
      CARDINALITY(normalized.normalized_types) = 0
      OR 'CREDIT_CARD' = ANY(normalized.normalized_types)
    )
      THEN 'CREDIT_CARD'
    ELSE 'BOLETO'
  END,
  updated_at = NOW()
FROM normalized
WHERE cfg.id = normalized.id;

COMMIT;
